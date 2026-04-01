/**
 * Search Query Parser
 *
 * Parses tokens into an AST (Abstract Syntax Tree).
 * Handles operator precedence: NOT > AND > OR
 */

import { Token, TokenType, SearchableField, SEARCHABLE_FIELDS } from './tokenizer';

// AST Node Types
export type ASTNode =
  | AndNode
  | OrNode
  | NotNode
  | TermNode
  | PhraseNode
  | FieldNode
  | WildcardNode
  | GroupNode;

export interface AndNode {
  type: 'AND';
  left: ASTNode;
  right: ASTNode;
}

export interface OrNode {
  type: 'OR';
  left: ASTNode;
  right: ASTNode;
}

export interface NotNode {
  type: 'NOT';
  operand: ASTNode;
}

export interface TermNode {
  type: 'TERM';
  value: string;
}

export interface PhraseNode {
  type: 'PHRASE';
  value: string;
}

export interface WildcardNode {
  type: 'WILDCARD';
  value: string;  // e.g., "dev*"
  prefix: string; // e.g., "dev"
}

export interface FieldNode {
  type: 'FIELD';
  field: SearchableField;
  operator: '=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: string | number | Date | RelativeDate;
}

export interface RelativeDate {
  type: 'relative';
  amount: number;
  unit: 'd' | 'm' | 'y';
}

export interface GroupNode {
  type: 'GROUP';
  expression: ASTNode;
}

export interface ParseError {
  message: string;
  position: number;
}

export interface ParseResult {
  ast: ASTNode | null;
  errors: ParseError[];
}

export function parse(tokens: Token[]): ParseResult {
  const errors: ParseError[] = [];
  let pos = 0;

  function peek(offset = 0): Token {
    return tokens[pos + offset] || { type: 'EOF', value: '', position: -1 };
  }

  function advance(): Token {
    return tokens[pos++] || { type: 'EOF', value: '', position: -1 };
  }

  function expect(type: TokenType): Token | null {
    if (peek().type === type) {
      return advance();
    }
    errors.push({
      message: `Expected ${type}, got ${peek().type}`,
      position: peek().position,
    });
    return null;
  }

  // Grammar (in order of precedence, lowest to highest):
  // expression -> orExpr
  // orExpr     -> andExpr (OR andExpr)*
  // andExpr    -> notExpr (AND? notExpr)*  (implicit AND between terms)
  // notExpr    -> NOT? primary
  // primary    -> TERM | PHRASE | WILDCARD | FIELD | LPAREN expression RPAREN

  function parseExpression(): ASTNode | null {
    return parseOrExpr();
  }

  function parseOrExpr(): ASTNode | null {
    let left = parseAndExpr();
    if (!left) return null;

    while (peek().type === 'OR') {
      advance(); // consume OR
      const right = parseAndExpr();
      if (!right) {
        errors.push({
          message: 'Expected expression after OR',
          position: peek().position,
        });
        return left;
      }
      left = { type: 'OR', left, right };
    }

    return left;
  }

  function parseAndExpr(): ASTNode | null {
    let left = parseNotExpr();
    if (!left) return null;

    // Handle explicit AND and implicit AND (adjacent terms)
    while (true) {
      const next = peek();

      // Explicit AND
      if (next.type === 'AND') {
        advance(); // consume AND
        const right = parseNotExpr();
        if (!right) {
          errors.push({
            message: 'Expected expression after AND',
            position: peek().position,
          });
          return left;
        }
        left = { type: 'AND', left, right };
        continue;
      }

      // Implicit AND: if next token starts a new term (not OR, not ), not EOF)
      if (
        next.type !== 'OR' &&
        next.type !== 'RPAREN' &&
        next.type !== 'EOF'
      ) {
        const right = parseNotExpr();
        if (right) {
          left = { type: 'AND', left, right };
          continue;
        }
      }

      break;
    }

    return left;
  }

  function parseNotExpr(): ASTNode | null {
    if (peek().type === 'NOT') {
      advance(); // consume NOT
      const operand = parseNotExpr(); // Allow chained NOTs
      if (!operand) {
        errors.push({
          message: 'Expected expression after NOT',
          position: peek().position,
        });
        return null;
      }
      return { type: 'NOT', operand };
    }

    return parsePrimary();
  }

  function parsePrimary(): ASTNode | null {
    const token = peek();

    // Grouped expression
    if (token.type === 'LPAREN') {
      advance(); // consume (
      const expr = parseExpression();
      if (!expr) {
        errors.push({
          message: 'Expected expression inside parentheses',
          position: peek().position,
        });
        return null;
      }
      if (!expect('RPAREN')) {
        errors.push({
          message: 'Missing closing parenthesis',
          position: peek().position,
        });
      }
      return { type: 'GROUP', expression: expr };
    }

    // Field:value
    if (token.type === 'FIELD') {
      return parseField();
    }

    // Phrase
    if (token.type === 'PHRASE') {
      advance();
      return { type: 'PHRASE', value: token.value };
    }

    // Wildcard
    if (token.type === 'WILDCARD') {
      advance();
      const prefix = token.value.replace(/\*+$/, '');
      return { type: 'WILDCARD', value: token.value, prefix };
    }

    // Regular term
    if (token.type === 'WORD') {
      advance();
      return { type: 'TERM', value: token.value };
    }

    // Date/number as standalone term (unusual but handle it)
    if (token.type === 'DATE' || token.type === 'RELATIVE_DATE' || token.type === 'NUMBER') {
      advance();
      return { type: 'TERM', value: token.value };
    }

    // Nothing valid
    if (token.type !== 'EOF' && token.type !== 'RPAREN') {
      errors.push({
        message: `Unexpected token: ${token.type}`,
        position: token.position,
      });
      advance(); // skip bad token
    }

    return null;
  }

  function parseField(): FieldNode | null {
    const fieldToken = advance(); // consume FIELD
    const field = fieldToken.value as SearchableField;

    let operator: FieldNode['operator'] = 'contains';
    let value: string | number | Date | RelativeDate = '';

    // Check for operator
    if (peek().type === 'OPERATOR') {
      const opToken = advance();
      operator = opToken.value as '>' | '<' | '>=' | '<=';
      if (opToken.value === '=') {
        operator = '=';
      }
    }

    // Get the value
    const valueToken = peek();
    if (
      valueToken.type === 'WORD' ||
      valueToken.type === 'PHRASE' ||
      valueToken.type === 'NUMBER' ||
      valueToken.type === 'DATE' ||
      valueToken.type === 'RELATIVE_DATE'
    ) {
      advance();

      if (valueToken.type === 'RELATIVE_DATE') {
        const match = valueToken.value.match(/^(\d+)([dmyDMY])$/);
        if (match) {
          value = {
            type: 'relative' as const,
            amount: parseInt(match[1], 10),
            unit: match[2].toLowerCase() as 'd' | 'm' | 'y',
          };
        }
      } else if (valueToken.type === 'DATE') {
        value = new Date(valueToken.value);
      } else if (valueToken.type === 'NUMBER') {
        value = parseInt(valueToken.value, 10);
      } else {
        value = valueToken.value;
      }
    } else {
      errors.push({
        message: `Expected value after ${field}:`,
        position: valueToken.position,
      });
    }

    return { type: 'FIELD', field, operator, value };
  }

  // Start parsing
  if (tokens.length === 0 || (tokens.length === 1 && tokens[0].type === 'EOF')) {
    return { ast: null, errors: [] };
  }

  const ast = parseExpression();

  // Check for leftover tokens
  if (peek().type !== 'EOF') {
    errors.push({
      message: `Unexpected token at end: ${peek().type}`,
      position: peek().position,
    });
  }

  return { ast, errors };
}

/**
 * Pretty print an AST node for debugging
 */
export function printAST(node: ASTNode | null, indent = 0): string {
  if (!node) return '(empty)';

  const pad = '  '.repeat(indent);

  switch (node.type) {
    case 'AND':
      return `${pad}AND\n${printAST(node.left, indent + 1)}\n${printAST(node.right, indent + 1)}`;
    case 'OR':
      return `${pad}OR\n${printAST(node.left, indent + 1)}\n${printAST(node.right, indent + 1)}`;
    case 'NOT':
      return `${pad}NOT\n${printAST(node.operand, indent + 1)}`;
    case 'TERM':
      return `${pad}TERM: "${node.value}"`;
    case 'PHRASE':
      return `${pad}PHRASE: "${node.value}"`;
    case 'WILDCARD':
      return `${pad}WILDCARD: "${node.value}"`;
    case 'FIELD':
      const val = typeof node.value === 'object' && 'type' in node.value
        ? `${node.value.amount}${node.value.unit}`
        : node.value;
      return `${pad}FIELD: ${node.field} ${node.operator} "${val}"`;
    case 'GROUP':
      return `${pad}GROUP\n${printAST(node.expression, indent + 1)}`;
  }
}
