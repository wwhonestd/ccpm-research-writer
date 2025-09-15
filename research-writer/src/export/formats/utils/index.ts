/**
 * Format-Specific Utilities
 * Common utilities for academic format exporters - TypeScript enhanced
 */

import { CITATION_STYLES } from '../../types/index.js';

// Type definitions
export interface PageLayout {
    pageSize: string;
    margins: { top: number; bottom: number; left: number; right: number };
    fontSize: number;
    lineSpacing: number;
    fontFamily: string;
}

export interface CitationStyleConfig {
    name: string;
    inTextFormat: string;
    bibliographySort: 'alphabetical' | 'chronological' | 'none';
    dateFormat: string;
    titleCase: 'sentence' | 'title';
    italicizeTitle: boolean;
}

export interface Author {
    given?: string;
    family?: string;
    literal?: string;
}

export interface Citation {
    id?: string;
    key?: string;
    author?: string | Author | Author[];
    creator?: string;
    title?: string;
    year?: string | number;
    formatted?: string;
    text?: string;
    [key: string]: any;
}

export interface MathExpression {
    type: 'inline' | 'block';
    content: string;
    original: string;
}

export interface MathDetectionResult {
    hasInlineMath: boolean;
    hasBlockMath: boolean;
    expressions: MathExpression[];
}

export interface FigureSize {
    width: number;
    height: number;
}

export interface Figure {
    id?: string;
    number?: number;
    caption?: string;
    formattedCaption?: string;
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
}

export interface Table {
    id?: string;
    number?: number;
    caption?: string;
    formattedCaption?: string;
    headers?: string[];
    rows?: string[][];
    columnCount?: number;
    rowCount?: number;
}

export interface ProcessedTable extends Table {
    formattedCaption: string;
    columnCount: number;
    rowCount: number;
}

export interface DocumentMetadata {
    sectionCount: number;
    figureCount: number;
    tableCount: number;
    citationCount: number;
    wordCount: number;
    [key: string]: any;
}

export interface Section {
    id: string;
    title: string;
    level: number;
    number?: string;
    content?: string;
    subsections?: Section[];
    figures?: Figure[];
    tables?: Table[];
}

export interface DocumentStructure {
    title?: string;
    sections: Section[];
    citations?: Citation[];
    metadata?: DocumentMetadata;
    [key: string]: any;
}

export interface CrossReferenceLabels {
    sections: Map<string, string>;
    figures: Map<string, number>;
    tables: Map<string, number>;
    equations: Map<string, number>;
}

export interface MediaValidationResult {
    isValid: boolean;
    issues: string[];
}

export interface ConversionUtils {
    pointsToInches: (points: number) => number;
    inchesToPoints: (inches: number) => number;
    pointsToCm: (points: number) => number;
    cmToPoints: (cm: number) => number;
}

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
    } as const,

    /**
     * Get page layout configuration
     */
    getPageLayout(template: string = 'STANDARD'): PageLayout {
        const templateKey = template.toUpperCase() as keyof typeof this.PAGE_LAYOUTS;
        return this.PAGE_LAYOUTS[templateKey] || this.PAGE_LAYOUTS.STANDARD;
    },

    /**
     * Convert measurements between units
     */
    convertUnits: {
        pointsToInches: (points: number): number => points / 72,
        inchesToPoints: (inches: number): number => inches * 72,
        pointsToCm: (points: number): number => points * 0.0352778,
        cmToPoints: (cm: number): number => cm / 0.0352778
    } as ConversionUtils,

    /**
     * Calculate optimal line height for readability
     */
    calculateLineHeight(fontSize: number, type: 'academic' | 'journal' | 'thesis' = 'academic'): number {
        switch (type) {
            case 'journal':
                return fontSize * 1.2;
            case 'thesis':
                return fontSize * 2.0;
            default:
                return fontSize * 1.5;
        }
    },

    /**
     * Get recommended margins for different document types
     */
    getRecommendedMargins(documentType: 'standard' | 'thesis' | 'journal' | 'conference'): { top: number; bottom: number; left: number; right: number } {
        const layout = this.getPageLayout(documentType);
        return layout.margins;
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
        },
        [CITATION_STYLES.IEEE]: {
            name: 'Institute of Electrical and Electronics Engineers',
            inTextFormat: '[Number]',
            bibliographySort: 'none',
            dateFormat: 'YYYY',
            titleCase: 'title',
            italicizeTitle: false
        },
        [CITATION_STYLES.HARVARD]: {
            name: 'Harvard Referencing System',
            inTextFormat: '(Author Year)',
            bibliographySort: 'alphabetical',
            dateFormat: 'YYYY',
            titleCase: 'sentence',
            italicizeTitle: true
        },
        [CITATION_STYLES.VANCOUVER]: {
            name: 'Vancouver Referencing System',
            inTextFormat: '(Number)',
            bibliographySort: 'none',
            dateFormat: 'YYYY',
            titleCase: 'sentence',
            italicizeTitle: false
        }
    } as Record<string, CitationStyleConfig>,

    /**
     * Get citation style configuration
     */
    getStyleConfig(style: string): CitationStyleConfig {
        return this.STYLE_CONFIGS[style] || this.STYLE_CONFIGS[CITATION_STYLES.APA];
    },

    /**
     * Parse citation key to extract components
     */
    parseCitationKey(citationKey: string): { author?: string; year?: string; suffix?: string; key?: string } | null {
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
    sortBibliography(entries: Citation[], style: string): Citation[] {
        const config = this.getStyleConfig(style);

        if (config.bibliographySort === 'alphabetical') {
            return [...entries].sort((a, b) => {
                const authorA = this.getAuthorSortKey(a.author || a.creator || '');
                const authorB = this.getAuthorSortKey(b.author || b.creator || '');
                return authorA.localeCompare(authorB);
            });
        } else if (config.bibliographySort === 'chronological') {
            return [...entries].sort((a, b) => {
                const yearA = parseInt(String(a.year || '0'));
                const yearB = parseInt(String(b.year || '0'));
                return yearA - yearB;
            });
        }

        return entries; // No sorting for other styles
    },

    /**
     * Get sort key for author (handles various formats)
     */
    getAuthorSortKey(author: string | Author | Author[]): string {
        if (typeof author === 'string') {
            return author.toLowerCase();
        }

        if (Array.isArray(author)) {
            if (author.length === 0) return '';
            return this.getAuthorSortKey(author[0]);
        }

        if (typeof author === 'object') {
            return (author.family || author.literal || '').toLowerCase();
        }

        return '';
    },

    /**
     * Format author names according to style
     */
    formatAuthorNames(authors: string | Author | Author[], style: string, inText: boolean = false): string {
        if (!authors) return 'Unknown';

        const config = this.getStyleConfig(style);

        if (typeof authors === 'string') {
            return authors;
        }

        const authorArray = Array.isArray(authors) ? authors : [authors];

        if (authorArray.length === 0) return 'Unknown';

        if (authorArray.length === 1) {
            return this.formatSingleAuthor(authorArray[0], style, inText);
        }

        if (authorArray.length === 2) {
            const author1 = this.formatSingleAuthor(authorArray[0], style, inText);
            const author2 = this.formatSingleAuthor(authorArray[1], style, inText);
            return `${author1} & ${author2}`;
        }

        if (authorArray.length > 2) {
            if (inText && authorArray.length > 3) {
                const firstAuthor = this.formatSingleAuthor(authorArray[0], style, inText);
                return `${firstAuthor} et al.`;
            }

            const formattedAuthors = authorArray.slice(0, -1).map(author =>
                this.formatSingleAuthor(author, style, inText)
            );
            const lastAuthor = this.formatSingleAuthor(authorArray[authorArray.length - 1], style, inText);

            return `${formattedAuthors.join(', ')}, & ${lastAuthor}`;
        }

        return 'Unknown';
    },

    /**
     * Format single author name
     */
    formatSingleAuthor(author: string | Author, style: string, inText: boolean = false): string {
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
    },

    /**
     * Generate in-text citation
     */
    generateInTextCitation(citation: Citation, style: string): string {
        const config = this.getStyleConfig(style);
        const author = this.formatAuthorNames(citation.author || citation.creator || 'Unknown', style, true);
        const year = citation.year || 'n.d.';

        switch (style) {
            case CITATION_STYLES.APA:
            case CITATION_STYLES.CHICAGO:
            case CITATION_STYLES.HARVARD:
                return `(${author}, ${year})`;
            case CITATION_STYLES.MLA:
                return `(${author})`;
            case CITATION_STYLES.IEEE:
            case CITATION_STYLES.VANCOUVER:
                return `[${citation.id || '?'}]`;
            default:
                return `(${author}, ${year})`;
        }
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
        'infty': '∞', 'partial': '∂', 'nabla': '∇',
        'sqrt': '√', 'propto': '∝', 'equiv': '≡'
    } as Record<string, string>,

    /**
     * Convert simple LaTeX math to Unicode
     */
    convertSimpleMath(mathExpression: string): string {
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

        // Handle fractions (simplified)
        converted = converted.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1)/($2)');

        return converted;
    },

    /**
     * Convert text to superscript Unicode
     */
    toSuperscript(text: string): string {
        const superscriptMap: Record<string, string> = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
            'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
        };

        return text.split('').map(char => superscriptMap[char] || char).join('');
    },

    /**
     * Convert text to subscript Unicode
     */
    toSubscript(text: string): string {
        const subscriptMap: Record<string, string> = {
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
    detectMathExpressions(text: string): MathDetectionResult {
        if (!text) return { hasInlineMath: false, hasBlockMath: false, expressions: [] };

        const expressions: MathExpression[] = [];

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
    },

    /**
     * Validate mathematical expression syntax
     */
    validateMathExpression(expression: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check for balanced braces
        let braceCount = 0;
        for (const char of expression) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            if (braceCount < 0) {
                errors.push('Unmatched closing brace');
                break;
            }
        }
        if (braceCount > 0) {
            errors.push('Unmatched opening brace');
        }

        // Check for balanced parentheses
        let parenCount = 0;
        for (const char of expression) {
            if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
            if (parenCount < 0) {
                errors.push('Unmatched closing parenthesis');
                break;
            }
        }
        if (parenCount > 0) {
            errors.push('Unmatched opening parenthesis');
        }

        return {
            isValid: errors.length === 0,
            errors
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
        FULL_WIDTH: { width: 612, height: 459 }, // 8.5" x 6.375"
        THUMBNAIL: { width: 144, height: 108 }   // 2" x 1.5"
    } as Record<string, FigureSize>,

    /**
     * Get figure size configuration
     */
    getFigureSize(size: string = 'MEDIUM'): FigureSize {
        return this.FIGURE_SIZES[size.toUpperCase()] || this.FIGURE_SIZES.MEDIUM;
    },

    /**
     * Calculate aspect ratio preserving dimensions
     */
    calculateAspectRatioDimensions(originalWidth: number, originalHeight: number, targetWidth?: number, targetHeight?: number): FigureSize {
        const aspectRatio = originalWidth / originalHeight;

        if (targetWidth && !targetHeight) {
            return {
                width: targetWidth,
                height: targetWidth / aspectRatio
            };
        }

        if (targetHeight && !targetWidth) {
            return {
                width: targetHeight * aspectRatio,
                height: targetHeight
            };
        }

        if (targetWidth && targetHeight) {
            // Use the constraint that results in smaller dimensions
            const widthBasedHeight = targetWidth / aspectRatio;
            const heightBasedWidth = targetHeight * aspectRatio;

            if (widthBasedHeight <= targetHeight) {
                return { width: targetWidth, height: widthBasedHeight };
            } else {
                return { width: heightBasedWidth, height: targetHeight };
            }
        }

        // Default to medium size
        return this.FIGURE_SIZES.MEDIUM;
    },

    /**
     * Format figure caption according to academic standards
     */
    formatFigureCaption(figure: Figure, figureNumber: number, includeNumber: boolean = true): Figure {
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
    formatTableCaption(table: Table, tableNumber: number, includeNumber: boolean = true): Table {
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
    processTableData(table: Table): ProcessedTable {
        const processed: ProcessedTable = {
            ...table,
            formattedCaption: table.formattedCaption || table.caption || 'Untitled Table',
            columnCount: 0,
            rowCount: 0
        };

        // Ensure headers exist
        if (!processed.headers || processed.headers.length === 0) {
            processed.headers = processed.rows?.[0] || [];
            processed.rows = processed.rows?.slice(1) || [];
        }

        // Add row and column count
        processed.columnCount = processed.headers?.length || 0;
        processed.rowCount = processed.rows?.length || 0;

        // Validate table structure
        if (processed.rows) {
            for (let i = 0; i < processed.rows.length; i++) {
                const row = processed.rows[i];
                if (row.length !== processed.columnCount) {
                    // Pad or trim row to match column count
                    if (row.length < processed.columnCount) {
                        processed.rows[i] = [...row, ...Array(processed.columnCount - row.length).fill('')];
                    } else {
                        processed.rows[i] = row.slice(0, processed.columnCount);
                    }
                }
            }
        }

        return processed;
    },

    /**
     * Validate media elements for academic standards
     */
    validateMediaElements(document: DocumentStructure): MediaValidationResult {
        const issues: string[] = [];

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
                        if (figure.width && figure.width <= 0) {
                            issues.push(`Figure in section "${section.title}" (${index + 1}) has invalid width`);
                        }
                        if (figure.height && figure.height <= 0) {
                            issues.push(`Figure in section "${section.title}" (${index + 1}) has invalid height`);
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
                        if (!table.rows || table.rows.length === 0) {
                            issues.push(`Table in section "${section.title}" (${index + 1}) has no data rows`);
                        }
                    });
                }
            }
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    },

    /**
     * Get supported image formats
     */
    getSupportedImageFormats(): string[] {
        return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'pdf', 'eps'];
    },

    /**
     * Validate image format
     */
    isValidImageFormat(filename: string): boolean {
        const extension = filename.toLowerCase().split('.').pop();
        return extension ? this.getSupportedImageFormats().includes(extension) : false;
    }
};

/**
 * Cross-Reference Utilities
 */
export const ReferenceUtils = {
    /**
     * Generate cross-reference labels
     */
    generateLabels(document: DocumentStructure): CrossReferenceLabels {
        const labels: CrossReferenceLabels = {
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
    processSectionLabels(sections: Section[], labelMap: Map<string, string>, prefix: string = ''): void {
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
    resolveCrossReferences(text: string, labels: CrossReferenceLabels): string {
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
    },

    /**
     * Generate table of contents from sections
     */
    generateTableOfContents(sections: Section[], maxDepth: number = 3): Array<{ title: string; level: number; number?: string; id: string }> {
        const toc: Array<{ title: string; level: number; number?: string; id: string }> = [];

        const processSections = (sectionList: Section[], currentDepth: number = 1): void => {
            for (const section of sectionList) {
                if (section.title && currentDepth <= maxDepth) {
                    toc.push({
                        title: section.title,
                        level: section.level,
                        number: section.number,
                        id: section.id
                    });

                    if (section.subsections && currentDepth < maxDepth) {
                        processSections(section.subsections, currentDepth + 1);
                    }
                }
            }
        };

        processSections(sections);
        return toc;
    },

    /**
     * Validate cross-reference integrity
     */
    validateCrossReferences(text: string, labels: CrossReferenceLabels): { isValid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!text) return { isValid: true, issues };

        // Find all references in text
        const refMatches = text.match(/\\ref\{([^}]+)\}/g) || [];

        for (const match of refMatches) {
            const fullRef = match.match(/\\ref\{([^}]+)\}/);
            if (fullRef) {
                const refId = fullRef[1];
                const [type, id] = refId.split(':', 2);

                let found = false;
                switch (type) {
                    case 'sec':
                        found = labels.sections.has(id);
                        break;
                    case 'fig':
                        found = labels.figures.has(id);
                        break;
                    case 'tbl':
                        found = labels.tables.has(id);
                        break;
                    case 'eq':
                        found = labels.equations.has(id);
                        break;
                }

                if (!found) {
                    issues.push(`Reference not found: ${refId}`);
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
 * Document Processing Utilities
 */
export const DocumentUtils = {
    /**
     * Extract document metadata
     */
    extractMetadata(document: DocumentStructure): DocumentMetadata {
        let sectionCount = 0;
        let figureCount = 0;
        let tableCount = 0;
        let wordCount = 0;

        const countSections = (sections: Section[]): void => {
            for (const section of sections) {
                sectionCount++;

                if (section.content) {
                    wordCount += this.countWords(section.content);
                }

                if (section.figures) {
                    figureCount += section.figures.length;
                }

                if (section.tables) {
                    tableCount += section.tables.length;
                }

                if (section.subsections) {
                    countSections(section.subsections);
                }
            }
        };

        if (document.sections) {
            countSections(document.sections);
        }

        return {
            sectionCount,
            figureCount,
            tableCount,
            citationCount: document.citations?.length || 0,
            wordCount,
            ...document.metadata
        };
    },

    /**
     * Count words in text
     */
    countWords(text: string): number {
        if (!text) return 0;

        // Remove math expressions and special formatting
        const cleanText = text
            .replace(/\$\$[^$]+\$\$/g, '') // Block math
            .replace(/\$[^$]+\$/g, '') // Inline math
            .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, '') // LaTeX commands
            .replace(/[^\w\s]/g, ' '); // Non-word characters

        return cleanText.trim().split(/\s+/).filter(word => word.length > 0).length;
    },

    /**
     * Estimate reading time in minutes
     */
    estimateReadingTime(document: DocumentStructure, wordsPerMinute: number = 200): number {
        const metadata = this.extractMetadata(document);
        return Math.ceil(metadata.wordCount / wordsPerMinute);
    },

    /**
     * Calculate document complexity score
     */
    calculateComplexityScore(document: DocumentStructure): number {
        const metadata = this.extractMetadata(document);

        // Factors that contribute to complexity
        const sectionComplexity = Math.min(metadata.sectionCount / 10, 1); // Normalized to max 1
        const lengthComplexity = Math.min(metadata.wordCount / 10000, 1); // Normalized to max 1
        const mediaComplexity = Math.min((metadata.figureCount + metadata.tableCount) / 20, 1);
        const citationComplexity = Math.min(metadata.citationCount / 50, 1);

        // Math complexity
        let mathComplexity = 0;
        if (document.sections) {
            const totalMathExpressions = document.sections.reduce((total, section) => {
                if (section.content) {
                    const mathInfo = MathUtils.detectMathExpressions(section.content);
                    return total + mathInfo.expressions.length;
                }
                return total;
            }, 0);
            mathComplexity = Math.min(totalMathExpressions / 30, 1);
        }

        // Weighted average
        return (
            sectionComplexity * 0.2 +
            lengthComplexity * 0.3 +
            mediaComplexity * 0.2 +
            citationComplexity * 0.15 +
            mathComplexity * 0.15
        );
    }
};

// Export all utilities
export default {
    AcademicUtils,
    CitationUtils,
    MathUtils,
    MediaUtils,
    ReferenceUtils,
    DocumentUtils
};