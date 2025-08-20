/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Escapes a string for use in a regular expression.
const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Parses a filter query string into a structured array of conditions.
 * @param {string} query The raw filter string.
 * @returns {Array<{type: 'phrase' | 'regex', value: string | RegExp}>}
 */
export function parseFilterQuery(query) {
    if (!query || !query.trim()) {
        return [];
    }

    // Split by spaces, but keep quoted parts together
    const terms = query.match(/"[^"]+"|\S+/g) || [];

    return terms.map(term => {
        // 1. Handle quoted phrases
        if (term.startsWith('"') && term.endsWith('"')) {
            return {
                type: 'phrase',
                value: term.slice(1, -1).toLowerCase(),
            };
        }

        // 2. Handle wildcard/regex terms with corrected logic
        let regexStr = term;

        // Step 1: Temporarily replace user-escaped characters and the wildcard `*` 
        // with unique, safe placeholders. Using a timestamp to ensure uniqueness.
        const PLACEHOLDERS = {
            TILDE: `__TILDE_${Date.now()}__`,
            STAR_LITERAL: `__STAR_LITERAL_${Date.now()}__`,
            WILDCARD: `__WILDCARD_${Date.now()}__`,
        };
        
        // Process escapes first, then the general wildcard.
        regexStr = regexStr.replace(/~~/g, PLACEHOLDERS.TILDE);
        regexStr = regexStr.replace(/~\*/g, PLACEHOLDERS.STAR_LITERAL);
        regexStr = regexStr.replace(/\*/g, PLACEHOLDERS.WILDCARD);

        // Step 2: Now that wildcards and user-escapes are protected,
        // escape all remaining special regex characters.
        regexStr = escapeRegex(regexStr);

        // Step 3: Replace the placeholders with their final regex equivalents.
        // The placeholder itself needs to be escaped in the replacement regex.
        const replacePlaceholder = (str, placeholder, replacement) => {
            return str.replace(new RegExp(escapeRegex(placeholder), 'g'), replacement);
        }
        
        regexStr = replacePlaceholder(regexStr, PLACEHOLDERS.TILDE, '~');
        regexStr = replacePlaceholder(regexStr, PLACEHOLDERS.STAR_LITERAL, '\\*'); // a literal star
        regexStr = replacePlaceholder(regexStr, PLACEHOLDERS.WILDCARD, '.*');   // the "any character" wildcard

        return {
            type: 'regex',
            value: new RegExp(regexStr, 'i'), // Case-insensitive
        };
    });
}

/**
 * Tests if a given value matches any of the parsed filter conditions.
 * @param {*} value The value from the cell.
 * @param {Array<{type: 'phrase' | 'regex', value: string | RegExp}>} conditions Parsed conditions from parseFilterQuery.
 * @returns {boolean}
 */
export function testValue(value, conditions) {
    if (conditions.length === 0) {
        return true; // No filter means it passes
    }
    // Don't filter rows with objects/arrays in the cell
    if (typeof value === 'object' && value !== null) {
        return true;
    }
    
    const stringValue = String(value ?? ''); // Handle null/undefined gracefully

    // Use .some() for OR logic: the value must match at least one condition.
    return conditions.some(condition => {
        if (condition.type === 'phrase') {
            return stringValue.toLowerCase().includes(condition.value);
        }
        if (condition.type === 'regex') {
            return condition.value.test(stringValue);
        }
        return false;
    });
}