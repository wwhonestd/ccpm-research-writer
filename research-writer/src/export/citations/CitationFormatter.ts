/**
 * Citation Formatter - Main citation formatting system
 * Provides automated citation formatting and bibliography generation for multiple academic styles
 */

import { CITATION_STYLES } from '../types/index.js';

/**
 * Citation source types
 */
export const CITATION_TYPES = {
    BOOK: 'book',
    JOURNAL_ARTICLE: 'journal-article',
    CONFERENCE_PAPER: 'conference-paper',
    THESIS: 'thesis',
    WEBSITE: 'website',
    CHAPTER: 'chapter',
    NEWSPAPER: 'newspaper',
    REPORT: 'report',
    PATENT: 'patent',
    SOFTWARE: 'software'
} as const;

/**
 * Citation source interface
 */
export interface CitationSource {
    id: string;
    type: keyof typeof CITATION_TYPES;
    title: string;
    authors: Author[];
    year?: number;

    // Book fields
    publisher?: string;
    publisherLocation?: string;
    edition?: string;
    isbn?: string;

    // Journal fields
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;

    // Conference fields
    conference?: string;
    conferenceLocation?: string;

    // Thesis fields
    institution?: string;
    degreeType?: string;

    // Website fields
    url?: string;
    accessDate?: Date;
    siteName?: string;

    // Chapter fields
    bookTitle?: string;
    chapterNumber?: number;
    editors?: Author[];

    // General fields
    abstract?: string;
    keywords?: string[];
    language?: string;
    notes?: string;
}

/**
 * Author interface
 */
export interface Author {
    firstName: string;
    lastName: string;
    middleName?: string;
    suffix?: string;
    prefix?: string;
}

/**
 * Citation options for formatting
 */
export interface CitationOptions {
    style: keyof typeof CITATION_STYLES;
    includeUrl?: boolean;
    includeDoiUrl?: boolean;
    maxAuthors?: number;
    useEtAl?: boolean;
    dateFormat?: 'year' | 'full' | 'month-year';
    titleCase?: 'title' | 'sentence' | 'preserve';
}

/**
 * Bibliography configuration
 */
export interface BibliographyConfig {
    style: keyof typeof CITATION_STYLES;
    sortBy?: 'author' | 'year' | 'title' | 'custom';
    groupBy?: 'type' | 'year' | 'none';
    includeAbstracts?: boolean;
    includeKeywords?: boolean;
    hangingIndent?: boolean;
    spacing?: 'single' | 'double' | 'one-and-half';
}

/**
 * Formatted citation result
 */
export interface FormattedCitation {
    inText: string;
    fullReference: string;
    source: CitationSource;
    style: string;
}

/**
 * Bibliography entry
 */
export interface BibliographyEntry {
    id: string;
    reference: string;
    source: CitationSource;
    sortKey: string;
}

/**
 * Abstract citation style interface
 */
export abstract class CitationStyle {
    abstract readonly name: string;
    abstract readonly shortName: string;

    /**
     * Format in-text citation
     */
    abstract formatInText(sources: CitationSource[], options?: Partial<CitationOptions>): string;

    /**
     * Format full reference for bibliography
     */
    abstract formatReference(source: CitationSource, options?: Partial<CitationOptions>): string;

    /**
     * Format author names according to style
     */
    abstract formatAuthors(authors: Author[], maxAuthors?: number, useEtAl?: boolean): string;

    /**
     * Format title according to style
     */
    abstract formatTitle(title: string, titleCase?: 'title' | 'sentence' | 'preserve'): string;

    /**
     * Get style-specific bibliography configuration
     */
    getBibliographyDefaults(): Partial<BibliographyConfig> {
        return {
            sortBy: 'author',
            groupBy: 'none',
            hangingIndent: true,
            spacing: 'double'
        };
    }
}

/**
 * Main citation formatter class
 */
export class CitationFormatter {
    private styles: Map<string, CitationStyle> = new Map();
    private defaultOptions: CitationOptions = {
        style: 'apa',
        includeUrl: true,
        includeDoiUrl: true,
        maxAuthors: 7,
        useEtAl: true,
        dateFormat: 'year',
        titleCase: 'title'
    };

    /**
     * Register a citation style
     */
    registerStyle(style: CitationStyle): void {
        this.styles.set(style.shortName, style);
    }

    /**
     * Get available citation styles
     */
    getAvailableStyles(): string[] {
        return Array.from(this.styles.keys());
    }

    /**
     * Check if a style is supported
     */
    isStyleSupported(style: string): boolean {
        return this.styles.has(style);
    }

    /**
     * Format a single citation
     */
    formatCitation(source: CitationSource, options?: Partial<CitationOptions>): FormattedCitation {
        const mergedOptions = { ...this.defaultOptions, ...options };
        const style = this.getStyle(mergedOptions.style);

        return {
            inText: style.formatInText([source], mergedOptions),
            fullReference: style.formatReference(source, mergedOptions),
            source,
            style: mergedOptions.style
        };
    }

    /**
     * Format multiple citations for in-text use
     */
    formatInTextCitations(sources: CitationSource[], options?: Partial<CitationOptions>): string {
        const mergedOptions = { ...this.defaultOptions, ...options };
        const style = this.getStyle(mergedOptions.style);

        return style.formatInText(sources, mergedOptions);
    }

    /**
     * Generate bibliography from citations
     */
    generateBibliography(sources: CitationSource[], config?: Partial<BibliographyConfig>): BibliographyEntry[] {
        if (!sources.length) return [];

        const styleConfig = config?.style || this.defaultOptions.style;
        const style = this.getStyle(styleConfig);
        const mergedConfig = { ...style.getBibliographyDefaults(), ...config };

        // Create bibliography entries
        const entries: BibliographyEntry[] = sources.map(source => ({
            id: source.id,
            reference: style.formatReference(source, { style: styleConfig }),
            source,
            sortKey: this.generateSortKey(source, mergedConfig.sortBy || 'author')
        }));

        // Sort entries
        entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        return entries;
    }

    /**
     * Generate formatted bibliography text
     */
    generateBibliographyText(sources: CitationSource[], config?: Partial<BibliographyConfig>): string {
        const entries = this.generateBibliography(sources, config);
        const mergedConfig = { ...this.getStyle(config?.style || this.defaultOptions.style).getBibliographyDefaults(), ...config };

        let result = '';
        let currentGroup = '';

        for (const entry of entries) {
            // Add group headers if grouping is enabled
            if (mergedConfig.groupBy && mergedConfig.groupBy !== 'none') {
                const group = this.getGroupKey(entry.source, mergedConfig.groupBy);
                if (group !== currentGroup) {
                    if (result) result += '\n\n';
                    result += `${group}\n`;
                    currentGroup = group;
                }
            }

            // Add spacing between entries
            if (result && !result.endsWith('\n\n')) {
                result += mergedConfig.spacing === 'double' ? '\n\n' : '\n';
            }

            // Add the reference with hanging indent if specified
            if (mergedConfig.hangingIndent) {
                const lines = entry.reference.split('\n');
                result += lines[0] + '\n';
                for (let i = 1; i < lines.length; i++) {
                    result += '    ' + lines[i] + '\n';
                }
            } else {
                result += entry.reference + '\n';
            }
        }

        return result.trim();
    }

    /**
     * Validate citation source
     */
    validateSource(source: CitationSource): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!source.id) errors.push('Citation ID is required');
        if (!source.title) errors.push('Title is required');
        if (!source.authors || source.authors.length === 0) errors.push('At least one author is required');
        if (!source.type) errors.push('Citation type is required');

        // Type-specific validation
        switch (source.type) {
            case CITATION_TYPES.JOURNAL_ARTICLE:
                if (!source.journal) errors.push('Journal name is required for journal articles');
                break;
            case CITATION_TYPES.BOOK:
                if (!source.publisher) errors.push('Publisher is required for books');
                break;
            case CITATION_TYPES.WEBSITE:
                if (!source.url) errors.push('URL is required for websites');
                break;
            case CITATION_TYPES.THESIS:
                if (!source.institution) errors.push('Institution is required for theses');
                break;
        }

        // Author validation
        source.authors.forEach((author, index) => {
            if (!author.firstName) errors.push(`Author ${index + 1}: First name is required`);
            if (!author.lastName) errors.push(`Author ${index + 1}: Last name is required`);
        });

        return { valid: errors.length === 0, errors };
    }

    /**
     * Get citation style instance
     */
    private getStyle(styleName: string): CitationStyle {
        const style = this.styles.get(styleName);
        if (!style) {
            throw new Error(`Citation style '${styleName}' is not supported. Available styles: ${this.getAvailableStyles().join(', ')}`);
        }
        return style;
    }

    /**
     * Generate sort key for bibliography ordering
     */
    private generateSortKey(source: CitationSource, sortBy: string): string {
        switch (sortBy) {
            case 'author':
                return source.authors[0]?.lastName?.toLowerCase() || '';
            case 'year':
                return (source.year || 9999).toString().padStart(4, '0');
            case 'title':
                return source.title.toLowerCase();
            default:
                return source.id;
        }
    }

    /**
     * Get group key for bibliography grouping
     */
    private getGroupKey(source: CitationSource, groupBy: string): string {
        switch (groupBy) {
            case 'type':
                return this.formatCitationType(source.type);
            case 'year':
                return source.year ? source.year.toString() : 'No Date';
            default:
                return '';
        }
    }

    /**
     * Format citation type for display
     */
    private formatCitationType(type: string): string {
        const typeNames: Record<string, string> = {
            [CITATION_TYPES.BOOK]: 'Books',
            [CITATION_TYPES.JOURNAL_ARTICLE]: 'Journal Articles',
            [CITATION_TYPES.CONFERENCE_PAPER]: 'Conference Papers',
            [CITATION_TYPES.THESIS]: 'Theses and Dissertations',
            [CITATION_TYPES.WEBSITE]: 'Web Sources',
            [CITATION_TYPES.CHAPTER]: 'Book Chapters',
            [CITATION_TYPES.NEWSPAPER]: 'Newspaper Articles',
            [CITATION_TYPES.REPORT]: 'Reports',
            [CITATION_TYPES.PATENT]: 'Patents',
            [CITATION_TYPES.SOFTWARE]: 'Software'
        };
        return typeNames[type] || 'Other Sources';
    }
}

/**
 * Utility functions for citation formatting
 */
export class CitationUtils {
    /**
     * Format author name according to pattern
     */
    static formatAuthorName(author: Author, pattern: 'first-last' | 'last-first' | 'last-first-middle' | 'initials'): string {
        const { firstName, lastName, middleName, prefix, suffix } = author;

        switch (pattern) {
            case 'first-last':
                return `${prefix ? prefix + ' ' : ''}${firstName} ${middleName ? middleName + ' ' : ''}${lastName}${suffix ? ', ' + suffix : ''}`;

            case 'last-first':
                return `${lastName}, ${firstName}${middleName ? ' ' + middleName : ''}${suffix ? ', ' + suffix : ''}`;

            case 'last-first-middle':
                return `${lastName}, ${firstName}${middleName ? ' ' + middleName[0] + '.' : ''}${suffix ? ', ' + suffix : ''}`;

            case 'initials':
                return `${lastName}, ${firstName[0]}.${middleName ? ' ' + middleName[0] + '.' : ''}`;

            default:
                return `${firstName} ${lastName}`;
        }
    }

    /**
     * Convert title to specified case
     */
    static convertTitleCase(title: string, caseType: 'title' | 'sentence' | 'preserve'): string {
        switch (caseType) {
            case 'title':
                return title.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

            case 'sentence':
                return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();

            case 'preserve':
            default:
                return title;
        }
    }

    /**
     * Format page range
     */
    static formatPageRange(pages: string): string {
        if (!pages) return '';

        // Handle different page range formats
        if (pages.includes('-')) {
            const [start, end] = pages.split('-');
            return `${start}-${end}`;
        }

        if (pages.includes('–')) {
            return pages; // Already formatted with en dash
        }

        return pages;
    }

    /**
     * Format DOI URL
     */
    static formatDoiUrl(doi: string): string {
        if (!doi) return '';

        // Remove existing URL prefix if present
        const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
        return `https://doi.org/${cleanDoi}`;
    }

    /**
     * Format access date
     */
    static formatAccessDate(date: Date, format: 'iso' | 'us' | 'uk' = 'iso'): string {
        if (!date) return '';

        switch (format) {
            case 'us':
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

            case 'uk':
                return date.toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

            case 'iso':
            default:
                return date.toISOString().split('T')[0];
        }
    }

    /**
     * Truncate author list with et al.
     */
    static truncateAuthors(authors: Author[], maxAuthors: number, useEtAl: boolean = true): { authors: Author[]; hasMore: boolean } {
        if (!useEtAl || authors.length <= maxAuthors) {
            return { authors, hasMore: false };
        }

        return {
            authors: authors.slice(0, maxAuthors),
            hasMore: true
        };
    }
}

export default CitationFormatter;