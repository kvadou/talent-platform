/**
 * Advanced Search Module
 *
 * Main entry point for search functionality.
 * Provides a clean interface for parsing and executing searches.
 */

export { tokenize, SEARCHABLE_FIELDS, type SearchableField, type Token } from './tokenizer';
export { parse, printAST, type ASTNode, type ParseResult } from './parser';
export { generateSQL, requiresJoins, type SQLQuery } from './sql-generator';

import { tokenize } from './tokenizer';
import { parse, ASTNode } from './parser';
import { generateSQL, requiresJoins, SQLQuery } from './sql-generator';

export interface SearchParseResult {
  /** The parsed AST (null if empty query) */
  ast: ASTNode | null;
  /** Generated SQL components */
  sql: SQLQuery;
  /** Whether the query requires joining to applications/stages/jobs */
  joins: { application: boolean; stage: boolean; job: boolean };
  /** Any errors encountered during parsing */
  errors: Array<{ message: string; position: number }>;
  /** Whether the query is valid */
  isValid: boolean;
  /** Human-readable explanation of what the query does */
  explanation: string;
}

/**
 * Parse a search query string into SQL components
 *
 * @param query - The search query string
 * @returns Parsed result with SQL, AST, and metadata
 *
 * @example
 * ```ts
 * const result = parseSearchQuery('actor AND teacher location:LA');
 * // result.sql.tsQuery = "actor & teacher"
 * // result.sql.whereConditions = ["CONCAT(c.city, ...) ILIKE $1"]
 * // result.sql.params = ["%LA%"]
 * ```
 */
export function parseSearchQuery(query: string): SearchParseResult {
  // Handle empty query
  if (!query || !query.trim()) {
    return {
      ast: null,
      sql: {
        tsQuery: null,
        whereConditions: [],
        params: [],
        explanation: 'No search query',
      },
      joins: { application: false, stage: false, job: false },
      errors: [],
      isValid: true,
      explanation: 'No search query',
    };
  }

  // Tokenize
  const { tokens, errors: tokenErrors } = tokenize(query);

  // Parse
  const { ast, errors: parseErrors } = parse(tokens);

  // Generate SQL
  const sql = generateSQL(ast);

  // Check for required joins
  const joins = requiresJoins(ast);

  // Combine errors
  const errors = [...tokenErrors, ...parseErrors];

  return {
    ast,
    sql,
    joins,
    errors,
    isValid: errors.length === 0,
    explanation: sql.explanation,
  };
}

/**
 * Validate a search query without generating SQL
 *
 * @param query - The search query string
 * @returns Array of error messages (empty if valid)
 */
export function validateSearchQuery(query: string): string[] {
  if (!query || !query.trim()) {
    return [];
  }

  const { tokens, errors: tokenErrors } = tokenize(query);
  const { errors: parseErrors } = parse(tokens);

  return [...tokenErrors, ...parseErrors].map((e) => e.message);
}

/**
 * Get search suggestions based on partial input
 *
 * @param partial - The partial search string
 * @param context - Available values for autocomplete
 * @returns Array of suggestions
 */
export interface SearchContext {
  tags?: string[];
  sources?: string[];
  stages?: string[];
  jobs?: string[];
  statuses?: string[];
}

export interface SearchSuggestion {
  text: string;
  description: string;
  type: 'field' | 'operator' | 'value' | 'example';
}

export function getSearchSuggestions(
  partial: string,
  context: SearchContext = {}
): SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];
  const lower = partial.toLowerCase();
  const lastWord = partial.split(/\s+/).pop()?.toLowerCase() || '';

  // If typing a field name
  if (lastWord && !lastWord.includes(':')) {
    const fieldSuggestions: Array<{ field: string; desc: string }> = [
      { field: 'status:', desc: 'Application status (active, hired, rejected)' },
      { field: 'stage:', desc: 'Pipeline stage name' },
      { field: 'tag:', desc: 'Candidate tags' },
      { field: 'source:', desc: 'Application source' },
      { field: 'location:', desc: 'City, state, or country' },
      { field: 'job:', desc: 'Job title' },
      { field: 'email:', desc: 'Email address' },
      { field: 'name:', desc: 'Candidate name' },
      { field: 'note:', desc: 'Notes content' },
      { field: 'applied:', desc: 'Application date (>7d, >2024-01-01)' },
      { field: 'updated:', desc: 'Last update date' },
    ];

    for (const { field, desc } of fieldSuggestions) {
      if (field.startsWith(lastWord)) {
        suggestions.push({ text: field, description: desc, type: 'field' });
      }
    }
  }

  // If typing after a field:
  const fieldMatch = lastWord.match(/^(\w+):(.*)$/);
  if (fieldMatch) {
    const [, field, valuePartial] = fieldMatch;
    const valueLower = valuePartial.toLowerCase();

    switch (field) {
      case 'status':
        const statuses = context.statuses || ['ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN'];
        for (const status of statuses) {
          if (status.toLowerCase().startsWith(valueLower)) {
            suggestions.push({ text: `status:${status}`, description: `Status is ${status}`, type: 'value' });
          }
        }
        break;

      case 'tag':
        for (const tag of context.tags || []) {
          if (tag.toLowerCase().startsWith(valueLower)) {
            const tagValue = tag.includes(' ') ? `"${tag}"` : tag;
            suggestions.push({ text: `tag:${tagValue}`, description: `Has tag "${tag}"`, type: 'value' });
          }
        }
        break;

      case 'source':
        const sources = context.sources || ['CAREER_PAGE', 'LINKEDIN', 'INDEED', 'GOOGLE', 'REFERRAL', 'DIRECT'];
        for (const source of sources) {
          if (source.toLowerCase().startsWith(valueLower)) {
            suggestions.push({ text: `source:${source}`, description: `Source is ${source}`, type: 'value' });
          }
        }
        break;

      case 'stage':
        for (const stage of context.stages || []) {
          if (stage.toLowerCase().startsWith(valueLower)) {
            const stageValue = stage.includes(' ') ? `"${stage}"` : stage;
            suggestions.push({ text: `stage:${stageValue}`, description: `In stage "${stage}"`, type: 'value' });
          }
        }
        break;

      case 'job':
        for (const job of context.jobs || []) {
          if (job.toLowerCase().startsWith(valueLower)) {
            const jobValue = job.includes(' ') ? `"${job}"` : job;
            suggestions.push({ text: `job:${jobValue}`, description: `Applied to "${job}"`, type: 'value' });
          }
        }
        break;

      case 'applied':
      case 'updated':
      case 'created':
        if (!valuePartial) {
          suggestions.push({ text: `${field}:>7d`, description: 'Last 7 days', type: 'value' });
          suggestions.push({ text: `${field}:>30d`, description: 'Last 30 days', type: 'value' });
          suggestions.push({ text: `${field}:>90d`, description: 'Last 90 days', type: 'value' });
          suggestions.push({ text: `${field}:>2024-01-01`, description: 'After date', type: 'value' });
        }
        break;
    }
  }

  // Operator suggestions
  if (lastWord === 'and' || lastWord === 'or' || lastWord === 'not') {
    // Don't suggest operators right after operators
  } else if (!lastWord.includes(':') && partial.length > 0 && !partial.endsWith(' ')) {
    // Suggest operators after a term
    if (!lower.endsWith('and') && !lower.endsWith('or') && !lower.endsWith('not')) {
      // suggestions.push({ text: ' AND ', description: 'Require both terms', type: 'operator' });
      // suggestions.push({ text: ' OR ', description: 'Either term', type: 'operator' });
      // suggestions.push({ text: ' NOT ', description: 'Exclude term', type: 'operator' });
    }
  }

  // Example suggestions for empty/short queries
  if (partial.length < 3) {
    suggestions.push({
      text: 'actor AND teacher',
      description: 'Must have both terms',
      type: 'example',
    });
    suggestions.push({
      text: 'status:active tag:frontend',
      description: 'Active candidates with tag',
      type: 'example',
    });
    suggestions.push({
      text: '"customer success" applied:>30d',
      description: 'Exact phrase, recent applicants',
      type: 'example',
    });
  }

  return suggestions.slice(0, 8); // Limit to 8 suggestions
}

/**
 * Get all searchable fields with descriptions
 */
export function getSearchableFields(): Array<{ field: string; description: string; examples: string[] }> {
  return [
    { field: 'name', description: 'Candidate first or last name', examples: ['name:john', 'name:smith'] },
    { field: 'email', description: 'Email address', examples: ['email:gmail.com', 'email:john@'] },
    { field: 'location', description: 'City, state, or country', examples: ['location:NYC', 'location:California'] },
    { field: 'tag', description: 'Candidate tags', examples: ['tag:frontend', 'tag:"senior engineer"'] },
    { field: 'source', description: 'Application source', examples: ['source:linkedin', 'source:referral'] },
    { field: 'status', description: 'Application status', examples: ['status:active', 'status:hired'] },
    { field: 'stage', description: 'Pipeline stage', examples: ['stage:"Phone Screen"', 'stage:interview'] },
    { field: 'job', description: 'Job title applied to', examples: ['job:tutor', 'job:"Chess Instructor"'] },
    { field: 'note', description: 'Content in notes', examples: ['note:visa', 'note:"follow up"'] },
    { field: 'applied', description: 'Application date', examples: ['applied:>7d', 'applied:>2024-01-01'] },
    { field: 'updated', description: 'Last activity date', examples: ['updated:>30d', 'updated:<2024-06-01'] },
  ];
}
