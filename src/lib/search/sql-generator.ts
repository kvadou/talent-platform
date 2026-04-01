/**
 * SQL Generator
 *
 * Converts a search AST into PostgreSQL query components.
 * Generates both full-text search queries and WHERE clauses.
 */

import {
  ASTNode,
  TermNode,
  PhraseNode,
  WildcardNode,
  FieldNode,
  AndNode,
  OrNode,
  NotNode,
  GroupNode,
  RelativeDate,
} from './parser';
import { SearchableField } from './tokenizer';

export interface SQLQuery {
  // Full-text search query (for tsvector)
  tsQuery: string | null;
  // WHERE clause conditions
  whereConditions: string[];
  // Parameters for prepared statement
  params: any[];
  // Human-readable explanation of the query
  explanation: string;
}

interface GeneratorContext {
  params: any[];
  paramIndex: number;
  explanations: string[];
}

/**
 * Field mappings to actual database columns/expressions
 */
const FIELD_MAPPINGS: Record<SearchableField, { column: string; type: 'text' | 'date' | 'array' | 'join' }> = {
  name: { column: `CONCAT(c."firstName", ' ', c."lastName")`, type: 'text' },
  email: { column: 'c.email', type: 'text' },
  location: { column: `CONCAT(c.city, ' ', c.state, ' ', c.country)`, type: 'text' },
  city: { column: 'c.city', type: 'text' },
  state: { column: 'c.state', type: 'text' },
  country: { column: 'c.country', type: 'text' },
  tag: { column: 'c.tags', type: 'array' },
  source: { column: 'c.source', type: 'text' },
  status: { column: 'a.status', type: 'join' },  // Requires application join
  stage: { column: 's.name', type: 'join' },     // Requires stage join
  job: { column: 'j.title', type: 'join' },      // Requires job join
  note: { column: 'c.notes', type: 'text' },
  applied: { column: 'a."createdAt"', type: 'date' },
  updated: { column: 'c."updatedAt"', type: 'date' },
  created: { column: 'c."createdAt"', type: 'date' },
};

/**
 * Generate SQL from an AST
 */
export function generateSQL(ast: ASTNode | null): SQLQuery {
  if (!ast) {
    return {
      tsQuery: null,
      whereConditions: [],
      params: [],
      explanation: 'No search query',
    };
  }

  const ctx: GeneratorContext = {
    params: [],
    paramIndex: 1,
    explanations: [],
  };

  // Separate full-text terms from field conditions
  const { tsTerms, conditions } = extractComponents(ast, ctx);

  // Build tsquery string
  let tsQuery: string | null = null;
  if (tsTerms.length > 0) {
    tsQuery = tsTerms.join(' & ');
    ctx.explanations.unshift(`Full-text search: ${tsTerms.join(', ')}`);
  }

  return {
    tsQuery,
    whereConditions: conditions,
    params: ctx.params,
    explanation: ctx.explanations.join('; '),
  };
}

interface ExtractedComponents {
  tsTerms: string[];  // Terms for full-text search
  conditions: string[]; // SQL WHERE conditions
}

function extractComponents(node: ASTNode, ctx: GeneratorContext): ExtractedComponents {
  switch (node.type) {
    case 'TERM':
      return extractTerm(node, ctx);
    case 'PHRASE':
      return extractPhrase(node, ctx);
    case 'WILDCARD':
      return extractWildcard(node, ctx);
    case 'FIELD':
      return extractField(node, ctx);
    case 'AND':
      return extractAnd(node, ctx);
    case 'OR':
      return extractOr(node, ctx);
    case 'NOT':
      return extractNot(node, ctx);
    case 'GROUP':
      return extractComponents(node.expression, ctx);
  }
}

function extractTerm(node: TermNode, ctx: GeneratorContext): ExtractedComponents {
  // Escape special characters for tsquery
  const term = node.value.replace(/[&|!():*]/g, '');
  if (!term) return { tsTerms: [], conditions: [] };

  return {
    tsTerms: [term],
    conditions: [],
  };
}

function extractPhrase(node: PhraseNode, ctx: GeneratorContext): ExtractedComponents {
  // For phrases, we use phraseto_tsquery
  const words = node.value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { tsTerms: [], conditions: [] };

  // Create phrase query: word1 <-> word2 <-> word3 (adjacency operator)
  const phraseQuery = words.map(w => w.replace(/[&|!():*]/g, '')).join(' <-> ');

  return {
    tsTerms: [`(${phraseQuery})`],
    conditions: [],
  };
}

function extractWildcard(node: WildcardNode, ctx: GeneratorContext): ExtractedComponents {
  // PostgreSQL tsquery supports prefix matching with :*
  const prefix = node.prefix.replace(/[&|!():*]/g, '');
  if (!prefix) return { tsTerms: [], conditions: [] };

  return {
    tsTerms: [`${prefix}:*`],
    conditions: [],
  };
}

function extractField(node: FieldNode, ctx: GeneratorContext): ExtractedComponents {
  const mapping = FIELD_MAPPINGS[node.field];
  if (!mapping) {
    ctx.explanations.push(`Unknown field: ${node.field}`);
    return { tsTerms: [], conditions: [] };
  }

  let condition: string;
  const paramPlaceholder = `$${ctx.paramIndex++}`;

  // Handle different field types
  if (mapping.type === 'array') {
    // Array field (tags)
    if (node.operator === 'contains' || node.operator === '=') {
      condition = `${paramPlaceholder} = ANY(${mapping.column})`;
      ctx.params.push(String(node.value));
      ctx.explanations.push(`Tag contains "${node.value}"`);
    } else {
      return { tsTerms: [], conditions: [] };
    }
  } else if (mapping.type === 'date') {
    // Date field
    const dateValue = resolveDate(node.value);
    if (!dateValue) {
      ctx.explanations.push(`Invalid date: ${node.value}`);
      return { tsTerms: [], conditions: [] };
    }

    const op = node.operator === 'contains' || node.operator === '=' ? '=' : node.operator;
    condition = `${mapping.column} ${op} ${paramPlaceholder}`;
    ctx.params.push(dateValue);

    const opText = { '>': 'after', '<': 'before', '>=': 'on or after', '<=': 'on or before', '=': 'on' }[op] || op;
    ctx.explanations.push(`${node.field} ${opText} ${formatDate(dateValue)}`);
  } else if (mapping.type === 'join') {
    // Fields requiring joins - handled specially
    if (node.operator === 'contains') {
      condition = `${mapping.column} ILIKE ${paramPlaceholder}`;
      ctx.params.push(`%${node.value}%`);
    } else if (node.operator === '=') {
      condition = `LOWER(${mapping.column}) = LOWER(${paramPlaceholder})`;
      ctx.params.push(String(node.value));
    } else {
      condition = `${mapping.column} ${node.operator} ${paramPlaceholder}`;
      ctx.params.push(node.value);
    }
    ctx.explanations.push(`${node.field}: "${node.value}"`);
  } else {
    // Text field
    if (node.operator === 'contains') {
      condition = `${mapping.column} ILIKE ${paramPlaceholder}`;
      ctx.params.push(`%${node.value}%`);
    } else if (node.operator === '=') {
      condition = `LOWER(${mapping.column}) = LOWER(${paramPlaceholder})`;
      ctx.params.push(String(node.value));
    } else {
      condition = `${mapping.column} ${node.operator} ${paramPlaceholder}`;
      ctx.params.push(node.value);
    }
    ctx.explanations.push(`${node.field}: "${node.value}"`);
  }

  return {
    tsTerms: [],
    conditions: [condition],
  };
}

function extractAnd(node: AndNode, ctx: GeneratorContext): ExtractedComponents {
  const left = extractComponents(node.left, ctx);
  const right = extractComponents(node.right, ctx);

  return {
    tsTerms: [...left.tsTerms, ...right.tsTerms],
    conditions: [...left.conditions, ...right.conditions],
  };
}

function extractOr(node: OrNode, ctx: GeneratorContext): ExtractedComponents {
  const left = extractComponents(node.left, ctx);
  const right = extractComponents(node.right, ctx);

  // For OR, we need to handle tsTerms and conditions differently
  const result: ExtractedComponents = {
    tsTerms: [],
    conditions: [],
  };

  // Combine tsTerms with OR
  if (left.tsTerms.length > 0 && right.tsTerms.length > 0) {
    const leftTs = left.tsTerms.length === 1 ? left.tsTerms[0] : `(${left.tsTerms.join(' & ')})`;
    const rightTs = right.tsTerms.length === 1 ? right.tsTerms[0] : `(${right.tsTerms.join(' & ')})`;
    result.tsTerms = [`(${leftTs} | ${rightTs})`];
  } else if (left.tsTerms.length > 0) {
    result.tsTerms = left.tsTerms;
  } else if (right.tsTerms.length > 0) {
    result.tsTerms = right.tsTerms;
  }

  // Combine conditions with OR
  if (left.conditions.length > 0 && right.conditions.length > 0) {
    const leftCond = left.conditions.length === 1 ? left.conditions[0] : `(${left.conditions.join(' AND ')})`;
    const rightCond = right.conditions.length === 1 ? right.conditions[0] : `(${right.conditions.join(' AND ')})`;
    result.conditions = [`(${leftCond} OR ${rightCond})`];
  } else {
    result.conditions = [...left.conditions, ...right.conditions];
  }

  return result;
}

function extractNot(node: NotNode, ctx: GeneratorContext): ExtractedComponents {
  const inner = extractComponents(node.operand, ctx);

  return {
    // Negate tsTerms with !
    tsTerms: inner.tsTerms.map(t => `!${t}`),
    // Negate conditions with NOT
    conditions: inner.conditions.map(c => `NOT (${c})`),
  };
}

/**
 * Resolve a date value (absolute or relative) to a Date object
 */
function resolveDate(value: string | number | Date | RelativeDate): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && 'type' in value && value.type === 'relative') {
    const now = new Date();
    const { amount, unit } = value;

    switch (unit) {
      case 'd':
        now.setDate(now.getDate() - amount);
        break;
      case 'm':
        now.setMonth(now.getMonth() - amount);
        break;
      case 'y':
        now.setFullYear(now.getFullYear() - amount);
        break;
    }
    return now;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if the query requires joins to other tables
 */
export function requiresJoins(ast: ASTNode | null): { application: boolean; stage: boolean; job: boolean } {
  if (!ast) return { application: false, stage: false, job: false };

  const result = { application: false, stage: false, job: false };

  function walk(node: ASTNode) {
    switch (node.type) {
      case 'FIELD':
        if (['status', 'applied'].includes(node.field)) {
          result.application = true;
        }
        if (node.field === 'stage') {
          result.application = true;
          result.stage = true;
        }
        if (node.field === 'job') {
          result.application = true;
          result.job = true;
        }
        break;
      case 'AND':
      case 'OR':
        walk(node.left);
        walk(node.right);
        break;
      case 'NOT':
        walk(node.operand);
        break;
      case 'GROUP':
        walk(node.expression);
        break;
    }
  }

  walk(ast);
  return result;
}
