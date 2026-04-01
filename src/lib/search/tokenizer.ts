/**
 * Search Query Tokenizer
 *
 * Converts a search string into tokens for parsing.
 * Supports: AND, OR, NOT, -, phrases, parentheses, field:value, wildcards
 */

export type TokenType =
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN'
  | 'COLON'
  | 'QUOTE'
  | 'WORD'
  | 'PHRASE'
  | 'FIELD'
  | 'OPERATOR'  // >, <, >=, <=
  | 'NUMBER'
  | 'DATE'
  | 'RELATIVE_DATE'  // 7d, 3m, 1y
  | 'WILDCARD'  // word*
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export interface TokenizerError {
  message: string;
  position: number;
}

export interface TokenizerResult {
  tokens: Token[];
  errors: TokenizerError[];
}

const OPERATORS = ['>=', '<=', '>', '<', '='];
const KEYWORDS = ['AND', 'OR', 'NOT'];

// Fields that can be searched with field:value syntax
export const SEARCHABLE_FIELDS = [
  'name',
  'email',
  'location',
  'city',
  'state',
  'country',
  'tag',
  'source',
  'status',
  'stage',
  'job',
  'note',
  'applied',
  'updated',
  'created',
] as const;

export type SearchableField = typeof SEARCHABLE_FIELDS[number];

export function tokenize(input: string): TokenizerResult {
  const tokens: Token[] = [];
  const errors: TokenizerError[] = [];
  let pos = 0;

  function peek(offset = 0): string {
    return input[pos + offset] || '';
  }

  function advance(count = 1): string {
    const chars = input.slice(pos, pos + count);
    pos += count;
    return chars;
  }

  function skipWhitespace(): void {
    while (pos < input.length && /\s/.test(peek())) {
      advance();
    }
  }

  function readWhile(predicate: (char: string) => boolean): string {
    let result = '';
    while (pos < input.length && predicate(peek())) {
      result += advance();
    }
    return result;
  }

  function readQuotedString(): string {
    const quote = advance(); // consume opening quote
    let result = '';
    let escaped = false;

    while (pos < input.length) {
      const char = peek();

      if (escaped) {
        result += char;
        advance();
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
        advance();
      } else if (char === quote) {
        advance(); // consume closing quote
        return result;
      } else {
        result += char;
        advance();
      }
    }

    // Unclosed quote - return what we have
    errors.push({
      message: 'Unclosed quote',
      position: pos,
    });
    return result;
  }

  function isWordChar(char: string): boolean {
    return /[\w@.*_-]/.test(char);
  }

  function isDateChar(char: string): boolean {
    return /[\d-]/.test(char);
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;

    const startPos = pos;
    const char = peek();

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: advance(), position: startPos });
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: advance(), position: startPos });
      continue;
    }

    // Quoted phrase
    if (char === '"' || char === "'") {
      const phrase = readQuotedString();
      tokens.push({ type: 'PHRASE', value: phrase, position: startPos });
      continue;
    }

    // Operators (>=, <=, >, <)
    const twoChar = peek() + peek(1);
    if (OPERATORS.includes(twoChar)) {
      tokens.push({ type: 'OPERATOR', value: advance(2), position: startPos });
      continue;
    }
    if (OPERATORS.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: advance(), position: startPos });
      continue;
    }

    // Negation prefix (-)
    if (char === '-' && /[\w"']/.test(peek(1))) {
      advance(); // consume -
      tokens.push({ type: 'NOT', value: '-', position: startPos });
      continue;
    }

    // Words, keywords, fields, dates, wildcards
    if (isWordChar(char) || char === '-') {
      const word = readWhile(isWordChar);
      const upperWord = word.toUpperCase();

      // Check for keyword
      if (KEYWORDS.includes(upperWord)) {
        tokens.push({ type: upperWord as 'AND' | 'OR' | 'NOT', value: word, position: startPos });
        continue;
      }

      // Check for field:value
      if (peek() === ':') {
        advance(); // consume :
        const fieldLower = word.toLowerCase();

        // Check if it's a known field
        if (SEARCHABLE_FIELDS.includes(fieldLower as SearchableField)) {
          tokens.push({ type: 'FIELD', value: fieldLower, position: startPos });

          // Now read the value
          skipWhitespace();

          // Check for operator after field
          const nextTwoChar = peek() + peek(1);
          if (OPERATORS.includes(nextTwoChar)) {
            tokens.push({ type: 'OPERATOR', value: advance(2), position: pos });
          } else if (OPERATORS.includes(peek())) {
            tokens.push({ type: 'OPERATOR', value: advance(), position: pos });
          }

          skipWhitespace();

          // Read the value (could be quoted or unquoted)
          if (peek() === '"' || peek() === "'") {
            const phrase = readQuotedString();
            tokens.push({ type: 'PHRASE', value: phrase, position: pos });
          } else {
            const value = readWhile((c) => /[\w@.*_\/-]/.test(c));
            if (value) {
              // Check for relative date (7d, 3m, 1y)
              if (/^\d+[dmyDMY]$/.test(value)) {
                tokens.push({ type: 'RELATIVE_DATE', value, position: pos });
              }
              // Check for date (YYYY-MM-DD)
              else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                tokens.push({ type: 'DATE', value, position: pos });
              }
              // Check for number
              else if (/^\d+$/.test(value)) {
                tokens.push({ type: 'NUMBER', value, position: pos });
              }
              // Regular word/value
              else {
                tokens.push({ type: 'WORD', value, position: pos });
              }
            }
          }
          continue;
        }
      }

      // Check for wildcard
      if (word.includes('*')) {
        tokens.push({ type: 'WILDCARD', value: word, position: startPos });
        continue;
      }

      // Check for relative date (7d, 3m, 1y)
      if (/^\d+[dmyDMY]$/.test(word)) {
        tokens.push({ type: 'RELATIVE_DATE', value: word, position: startPos });
        continue;
      }

      // Check for date (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(word)) {
        tokens.push({ type: 'DATE', value: word, position: startPos });
        continue;
      }

      // Regular word
      tokens.push({ type: 'WORD', value: word, position: startPos });
      continue;
    }

    // Unknown character - skip it
    errors.push({
      message: `Unexpected character: ${char}`,
      position: pos,
    });
    advance();
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return { tokens, errors };
}
