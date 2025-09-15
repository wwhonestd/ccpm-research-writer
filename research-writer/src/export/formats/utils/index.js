/**
 * Format-Specific Utilities
 * Common utilities for academic format exporters
 */

import { CITATION_STYLES } from '../../types/index.js';

/**
 * Academic Document Processing Utilities
 */
export const AcademicUtils = {
    /**
     * Standard academic page layouts
     */
    PAGE_LAYOUTS: {
        STANDARD: {
            pageSize: 'A4',
            margins: { top: 72, bottom: 72, left: 72, right: 72 }, // 1 inch in points
            fontSize: 12,
            lineSpacing: 1.5,
            fontFamily: 'Times New Roman'
        },
        THESIS: {
            pageSize: 'A4',
            margins: { top: 72, bottom: 72, left: 90, right: 72 }, // Extra left margin for binding
            fontSize: 12,
            lineSpacing: 2.0,
            fontFamily: 'Times New Roman'
        },
        JOURNAL: {
            pageSize: 'A4',
            margins: { top: 72, bottom: 72, left: 72, right: 72 },
            fontSize: 11,
            lineSpacing: 1.0,
            fontFamily: 'Times New Roman'
        },
        CONFERENCE: {
            pageSize: 'A4',
            margins: { top: 54, bottom: 54, left: 54, right: 54 }, // Smaller margins
            fontSize: 10,
            lineSpacing: 1.0,
            fontFamily: 'Arial'
        }
    },

    /**
     * Get page layout configuration
     */
    getPageLayout(template = 'STANDARD') {
        return this.PAGE_LAYOUTS[template.toUpperCase()] || this.PAGE_LAYOUTS.STANDARD;
    },

    /**
     * Convert measurements between units
     */
    convertUnits: {
        pointsToInches: (points) => points / 72,
        inchesToPoints: (inches) => inches * 72,
        pointsToCm: (points) => points * 0.0352778,
        cmToPoints: (cm) => cm / 0.0352778
    }
};

/**
 * Bibliography and Citation Utilities
 */
export const CitationUtils = {
    /**
     * Citation style configurations
     */
    STYLE_CONFIGS: {
        [CITATION_STYLES.APA]: {
            name: 'American Psychological Association',
            inTextFormat: '(Author, Year)',
            bibliographySort: 'alphabetical',
            dateFormat: 'YYYY',
            titleCase: 'sentence',
            italicizeTitle: false
        },
        [CITATION_STYLES.MLA]: {
            name: 'Modern Language Association',
            inTextFormat: '(Author Page)',
            bibliographySort: 'alphabetical',
            dateFormat: 'DD Mon YYYY',
            titleCase: 'title',
            italicizeTitle: true
        },
        [CITATION_STYLES.CHICAGO]: {
            name: 'Chicago Manual of Style',
            inTextFormat: '(Author Year)',
            bibliographySort: 'alphabetical',
            dateFormat: 'Month DD, YYYY',
            titleCase: 'title',
            italicizeTitle: true
        }
    },

    /**
     * Get citation style configuration
     */
    getStyleConfig(style) {
        return this.STYLE_CONFIGS[style] || this.STYLE_CONFIGS[CITATION_STYLES.APA];
    },

    /**
     * Parse citation key to extract components
     */
    parseCitationKey(citationKey) {
        // Handle common citation key formats
        if (typeof citationKey !== 'string') return null;

        // Format: AuthorYear (e.g., Smith2023)
        const authorYearMatch = citationKey.match(/^([A-Za-z]+)(\d{4})([a-z]?)$/);
        if (authorYearMatch) {
            return {
                author: authorYearMatch[1],
                year: authorYearMatch[2],
                suffix: authorYearMatch[3] || ''
            };
        }

        // Format: author:year (e.g., smith:2023)
        const colonFormat = citationKey.match(/^([^:]+):(\d{4})([a-z]?)$/);
        if (colonFormat) {
            return {
                author: colonFormat[1],
                year: colonFormat[2],
                suffix: colonFormat[3] || ''
            };
        }

        return { key: citationKey };
    },

    /**
     * Sort bibliography entries by style
     */
    sortBibliography(entries, style) {
        const config = this.getStyleConfig(style);

        if (config.bibliographySort === 'alphabetical') {
            return entries.sort((a, b) => {
                const authorA = (a.author || a.creator || '').toLowerCase();
                const authorB = (b.author || b.creator || '').toLowerCase();
                return authorA.localeCompare(authorB);
            });
        }

        return entries; // No sorting for other styles
    },

    /**
     * Format author names according to style
     */
    formatAuthorNames(authors, style, inText = false) {
        if (!authors || authors.length === 0) return 'Unknown';

        const config = this.getStyleConfig(style);

        if (typeof authors === 'string') {
            authors = [authors];
        }

        if (authors.length === 1) {
            return this.formatSingleAuthor(authors[0], style, inText);
        }

        if (authors.length === 2) {
            const author1 = this.formatSingleAuthor(authors[0], style, inText);
            const author2 = this.formatSingleAuthor(authors[1], style, inText);
            return `${author1} & ${author2}`;
        }

        if (authors.length > 2) {
            if (inText && authors.length > 3) {
                const firstAuthor = this.formatSingleAuthor(authors[0], style, inText);
                return `${firstAuthor} et al.`;
            }

            const formattedAuthors = authors.slice(0, -1).map(author =>
                this.formatSingleAuthor(author, style, inText)
            );
            const lastAuthor = this.formatSingleAuthor(authors[authors.length - 1], style, inText);

            return `${formattedAuthors.join(', ')}, & ${lastAuthor}`;
        }

        return authors.join(', ');
    },

    /**
     * Format single author name
     */
    formatSingleAuthor(author, style, inText = false) {
        if (typeof author === 'string') {
            return author;
        }

        if (typeof author === 'object') {
            const { given, family, literal } = author;

            if (literal) return literal;

            if (given && family) {
                return inText ? family : `${family}, ${given}`;
            }

            return family || given || 'Unknown';
        }

        return 'Unknown';
    }
};

/**
 * Mathematical Expression Utilities
 */
export const MathUtils = {
    /**
     * LaTeX math commands commonly used in academic documents
     */
    COMMON_COMMANDS: {
        // Greek letters
        'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ',
        'epsilon': 'ε', 'zeta': 'ζ', 'eta': 'η', 'theta': 'θ',
        'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'pi': 'π',
        'sigma': 'σ', 'tau': 'τ', 'phi': 'φ', 'chi': 'χ',
        'psi': 'ψ', 'omega': 'ω',

        // Mathematical operators
        'sum': '∑', 'prod': '∏', 'int': '∫',
        'pm': '±', 'mp': '∓', 'times': '×', 'div': '÷',
        'leq': '≤', 'geq': '≥', 'neq': '≠', 'approx': '≈',
        'infty': '∞', 'partial': '∂', 'nabla': '∇'
    },

    /**
     * Convert simple LaTeX math to Unicode
     */
    convertSimpleMath(mathExpression) {
        let converted = mathExpression;

        // Replace common LaTeX commands
        for (const [latex, unicode] of Object.entries(this.COMMON_COMMANDS)) {
            const regex = new RegExp(`\\\\${latex}\\b`, 'g');
            converted = converted.replace(regex, unicode);
        }

        // Handle subscripts and superscripts (simplified)
        converted = converted.replace(/\^{([^}]+)}/g, (match, content) => {
            return this.toSuperscript(content);
        });

        converted = converted.replace(/_{([^}]+)}/g, (match, content) => {
            return this.toSubscript(content);
        });

        return converted;
    },

    /**
     * Convert text to superscript Unicode
     */
    toSuperscript(text) {
        const superscriptMap = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
            'n': 'ⁿ', 'i': 'ⁱ'
        };

        return text.split('').map(char => superscriptMap[char] || char).join('');
    },

    /**
     * Convert text to subscript Unicode
     */
    toSubscript(text) {
        const subscriptMap = {
            '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
            '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
            '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
            'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'o': 'ₒ', 'u': 'ᵤ',
            'x': 'ₓ', 'n': 'ₙ'
        };

        return text.split('').map(char => subscriptMap[char] || char).join('');
    },

    /**
     * Detect mathematical expressions in text
     */
    detectMathExpressions(text) {
        if (!text) return { hasInlineMath: false, hasBlockMath: false, expressions: [] };

        const expressions = [];

        // Inline math: $...$
        const inlineMatches = text.match(/\$([^$]+)\$/g) || [];
        inlineMatches.forEach(match => {
            expressions.push({
                type: 'inline',
                content: match.slice(1, -1),
                original: match
            });
        });

        // Block math: $$...$$
        const blockMatches = text.match(/\$\$([^$]+)\$\$/g) || [];
        blockMatches.forEach(match => {
            expressions.push({
                type: 'block',
                content: match.slice(2, -2),
                original: match
            });
        });

        return {
            hasInlineMath: inlineMatches.length > 0,
            hasBlockMath: blockMatches.length > 0,
            expressions
        };
    }
};

/**
 * Figure and Table Utilities
 */
export const MediaUtils = {
    /**
     * Standard academic figure sizes (in points)
     */
    FIGURE_SIZES: {
        SMALL: { width: 216, height: 162 },     // 3" x 2.25"
        MEDIUM: { width: 360, height: 270 },    // 5" x 3.75"
        LARGE: { width: 504, height: 378 },     // 7" x 5.25"
        FULL_WIDTH: { width: 612, height: 459 } // 8.5" x 6.375"
    },

    /**
     * Get figure size configuration
     */
    getFigureSize(size = 'MEDIUM') {
        return this.FIGURE_SIZES[size.toUpperCase()] || this.FIGURE_SIZES.MEDIUM;
    },

    /**
     * Format figure caption according to academic standards
     */
    formatFigureCaption(figure, figureNumber, includeNumber = true) {
        const prefix = includeNumber ? `Figure ${figureNumber}: ` : '';
        const caption = figure.caption || 'Untitled Figure';

        return {
            ...figure,
            formattedCaption: `${prefix}${caption}`,
            number: figureNumber
        };
    },

    /**
     * Format table caption according to academic standards
     */
    formatTableCaption(table, tableNumber, includeNumber = true) {
        const prefix = includeNumber ? `Table ${tableNumber}: ` : '';
        const caption = table.caption || 'Untitled Table';

        return {
            ...table,
            formattedCaption: `${prefix}${caption}`,
            number: tableNumber
        };
    },

    /**
     * Process table data for academic formatting
     */
    processTableData(table) {
        const processed = { ...table };

        // Ensure headers exist
        if (!processed.headers || processed.headers.length === 0) {
            processed.headers = processed.rows?.[0] || [];
            processed.rows = processed.rows?.slice(1) || [];
        }

        // Add row and column count
        processed.columnCount = processed.headers.length;
        processed.rowCount = processed.rows?.length || 0;

        return processed;
    },

    /**
     * Validate media elements for academic standards
     */
    validateMediaElements(document) {
        const issues = [];

        if (document.sections) {
            for (const section of document.sections) {
                // Check figures
                if (section.figures) {
                    section.figures.forEach((figure, index) => {
                        if (!figure.caption) {
                            issues.push(`Figure in section "${section.title}" (${index + 1}) missing caption`);
                        }
                        if (!figure.src) {
                            issues.push(`Figure in section "${section.title}" (${index + 1}) missing source`);
                        }
                    });
                }

                // Check tables
                if (section.tables) {
                    section.tables.forEach((table, index) => {
                        if (!table.caption) {
                            issues.push(`Table in section "${section.title}" (${index + 1}) missing caption`);
                        }
                        if (!table.headers || table.headers.length === 0) {
                            issues.push(`Table in section "${section.title}" (${index + 1}) missing headers`);
                        }
                    });
                }
            }
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }
};

/**
 * Cross-Reference Utilities
 */
export const ReferenceUtils = {
    /**
     * Generate cross-reference labels
     */
    generateLabels(document) {
        const labels = {
            sections: new Map(),
            figures: new Map(),
            tables: new Map(),
            equations: new Map()
        };

        // Process sections
        if (document.sections) {
            this.processSectionLabels(document.sections, labels.sections);
        }

        // Process figures and tables
        let figureCount = 0;
        let tableCount = 0;
        let equationCount = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.figures) {
                    section.figures.forEach((figure, index) => {
                        figureCount++;
                        const id = figure.id || `fig-${section.id}-${index}`;
                        labels.figures.set(id, figureCount);
                        figure.number = figureCount;
                        figure.id = id;
                    });
                }

                if (section.tables) {
                    section.tables.forEach((table, index) => {
                        tableCount++;
                        const id = table.id || `tbl-${section.id}-${index}`;
                        labels.tables.set(id, tableCount);
                        table.number = tableCount;
                        table.id = id;
                    });
                }

                // Count equations in content
                if (section.content) {
                    const mathBlocks = section.content.match(/\$\$([^$]+)\$\$/g) || [];
                    mathBlocks.forEach((block, index) => {
                        equationCount++;
                        const id = `eq-${section.id}-${index}`;
                        labels.equations.set(id, equationCount);
                    });
                }
            }
        }

        return labels;
    },

    /**
     * Process section labels recursively
     */
    processSectionLabels(sections, labelMap, prefix = '') {
        sections.forEach((section, index) => {
            const sectionNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
            const id = section.id || `sec-${sectionNumber}`;

            labelMap.set(id, sectionNumber);
            section.number = sectionNumber;
            section.id = id;

            if (section.subsections) {
                this.processSectionLabels(section.subsections, labelMap, sectionNumber);
            }
        });
    },

    /**
     * Resolve cross-references in text
     */
    resolveCrossReferences(text, labels) {
        if (!text) return text;

        let resolved = text;

        // Section references: \ref{sec:id}
        resolved = resolved.replace(/\\ref\{sec:([^}]+)\}/g, (match, id) => {
            const number = labels.sections.get(id);
            return number ? `Section ${number}` : match;
        });

        // Figure references: \ref{fig:id}
        resolved = resolved.replace(/\\ref\{fig:([^}]+)\}/g, (match, id) => {
            const number = labels.figures.get(id);
            return number ? `Figure ${number}` : match;
        });

        // Table references: \ref{tbl:id}
        resolved = resolved.replace(/\\ref\{tbl:([^}]+)\}/g, (match, id) => {
            const number = labels.tables.get(id);
            return number ? `Table ${number}` : match;
        });

        // Equation references: \ref{eq:id}
        resolved = resolved.replace(/\\ref\{eq:([^}]+)\}/g, (match, id) => {
            const number = labels.equations.get(id);
            return number ? `Equation (${number})` : match;
        });

        return resolved;
    }
};

// Export all utilities
export default {
    AcademicUtils,
    CitationUtils,
    MathUtils,
    MediaUtils,
    ReferenceUtils
};