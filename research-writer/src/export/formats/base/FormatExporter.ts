/**
 * FormatExporter - Enhanced base class for academic format exporters
 * Extends BaseExportProcessor with academic formatting capabilities
 */

import { BaseExportProcessor } from '../BaseExportProcessor.js';
import { EXPORT_FORMATS, CITATION_STYLES } from '../../types/index.js';
import { DocumentUtils, ContentUtils, FormatUtils } from '../../utils/index.js';

// Type definitions for academic formatting
export interface AcademicOptions {
    citationStyle: string;
    includeBibliography: boolean;
    includeTOC: boolean;
    includeAbstract: boolean;
    includeKeywords: boolean;
    pageNumbering: boolean;
    academicHeaderFooter: boolean;
    numberSections?: boolean;
}

export interface DocumentStructure {
    title?: string;
    author?: string;
    date?: string | Date;
    abstract?: string;
    keywords?: string[];
    sections: Section[];
    citations?: Citation[];
    bibliography?: Bibliography;
    tableOfContents?: TOCEntry[];
    academic?: AcademicOptions;
    metadata?: DocumentMetadata;
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
    pageBreakBefore?: boolean;
    pageBreakAfter?: boolean;
}

export interface Citation {
    id?: string;
    key?: string;
    author?: string | Author[];
    title?: string;
    year?: string | number;
    formatted?: string;
    [key: string]: any;
}

export interface Author {
    given?: string;
    family?: string;
    literal?: string;
}

export interface Bibliography {
    style: string;
    entries: Citation[];
}

export interface TOCEntry {
    title: string;
    level: number;
    number?: string;
    id?: string;
    pageNumber?: number | null;
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

export interface DocumentMetadata {
    institution?: string;
    department?: string;
    wordCount?: number;
    sectionCount?: number;
    figureCount?: number;
    tableCount?: number;
    citationCount?: number;
    [key: string]: any;
}

export interface FormatCapabilities {
    supportedFeatures: string[];
    citationStyles: string[];
    academicTemplates: string[];
    [key: string]: any;
}

export interface AcademicStats {
    hasAbstract: boolean;
    hasKeywords: boolean;
    hasBibliography: boolean;
    sectionCount: number;
    figureCount: number;
    tableCount: number;
    citationCount: number;
    mathExpressions: number;
    wordCount: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class FormatExporter extends BaseExportProcessor {
    protected academicOptions: AcademicOptions;
    protected capabilities: FormatCapabilities & { [key: string]: any };

    constructor(format: string, options: any = {}) {
        super(format, options);

        // Academic formatting options
        this.academicOptions = {
            citationStyle: options.citationStyle || CITATION_STYLES.APA,
            includeBibliography: options.includeBibliography !== false,
            includeTOC: options.includeTOC !== false,
            includeAbstract: options.includeAbstract !== false,
            includeKeywords: options.includeKeywords !== false,
            pageNumbering: options.pageNumbering !== false,
            academicHeaderFooter: options.academicHeaderFooter !== false,
            ...options.academic || {}
        };

        // Enhanced capabilities for academic formats
        this.capabilities = {
            ...this.capabilities,
            supportedFeatures: [
                'figures', 'tables', 'citations', 'bibliography', 'toc',
                'headers', 'footers', 'abstract', 'keywords', 'math',
                'cross-references', 'appendices'
            ],
            citationStyles: Object.values(CITATION_STYLES),
            academicTemplates: ['standard', 'thesis', 'journal', 'conference'],
            ...this.getFormatSpecificCapabilities()
        };
    }

    /**
     * Override in subclasses to specify format-specific capabilities
     */
    protected getFormatSpecificCapabilities(): Partial<FormatCapabilities> {
        return {};
    }

    /**
     * Enhanced preprocessing with academic structure
     */
    async preprocessDocument(document: DocumentStructure, options: any): Promise<DocumentStructure> {
        // First apply base preprocessing
        const baseDocument = await super.preprocessDocument(document, options);

        // Academic structure enhancement
        const academicDocument = await this.enhanceAcademicStructure(baseDocument as DocumentStructure, options);

        // Process academic elements
        await this.processAcademicElements(academicDocument, options);

        return academicDocument;
    }

    /**
     * Enhance document structure for academic formatting
     */
    protected async enhanceAcademicStructure(document: DocumentStructure, options: any): Promise<DocumentStructure> {
        const enhanced = { ...document };

        // Ensure proper academic structure
        enhanced.academic = {
            citationStyle: this.academicOptions.citationStyle,
            includeBibliography: this.academicOptions.includeBibliography,
            includeTOC: this.academicOptions.includeTOC,
            includeAbstract: this.academicOptions.includeAbstract,
            includeKeywords: this.academicOptions.includeKeywords,
            pageNumbering: this.academicOptions.pageNumbering,
            academicHeaderFooter: this.academicOptions.academicHeaderFooter,
            ...document.academic
        };

        // Process section hierarchy for academic structure
        if (enhanced.sections) {
            enhanced.sections = this.normalizeAcademicHierarchy(enhanced.sections);
        }

        // Generate table of contents if requested
        if (enhanced.academic.includeTOC) {
            enhanced.tableOfContents = this.generateTableOfContents(enhanced.sections);
        }

        // Process bibliography if citations exist
        if (enhanced.citations && enhanced.citations.length > 0 && enhanced.academic.includeBibliography) {
            enhanced.bibliography = await this.processBibliography(enhanced.citations, enhanced.academic.citationStyle);
        }

        return enhanced;
    }

    /**
     * Normalize section hierarchy for academic standards
     */
    protected normalizeAcademicHierarchy(sections: Section[]): Section[] {
        return sections.map((section, index) => {
            const normalized = { ...section };

            // Ensure proper heading levels
            if (!normalized.level || normalized.level < 1) {
                normalized.level = 1;
            }

            // Add section numbers if not present
            if (!normalized.number && this.academicOptions.numberSections !== false) {
                normalized.number = this.generateSectionNumber(sections, index);
            }

            // Process subsections recursively
            if (normalized.subsections && normalized.subsections.length > 0) {
                normalized.subsections = this.normalizeAcademicHierarchy(normalized.subsections);
            }

            return normalized;
        });
    }

    /**
     * Generate section number based on hierarchy
     */
    protected generateSectionNumber(sections: Section[], currentIndex: number): string {
        let counter = 1;
        for (let i = 0; i <= currentIndex; i++) {
            if (sections[i].level === sections[currentIndex].level) {
                if (i === currentIndex) {
                    return counter.toString();
                }
                counter++;
            }
        }
        return counter.toString();
    }

    /**
     * Generate table of contents from sections
     */
    protected generateTableOfContents(sections: Section[]): TOCEntry[] {
        const toc: TOCEntry[] = [];

        const processSections = (sectionList: Section[], level: number = 1): void => {
            for (const section of sectionList) {
                if (section.title && section.level <= 3) { // Usually limit TOC to 3 levels
                    toc.push({
                        title: section.title,
                        level: section.level,
                        number: section.number,
                        id: section.id,
                        pageNumber: null // Will be filled during rendering
                    });

                    if (section.subsections) {
                        processSections(section.subsections, level + 1);
                    }
                }
            }
        };

        processSections(sections);
        return toc;
    }

    /**
     * Process bibliography from citations
     */
    protected async processBibliography(citations: Citation[], style: string): Promise<Bibliography> {
        const bibliography: Bibliography = {
            style: style,
            entries: []
        };

        for (const citation of citations) {
            const entry = await this.formatCitationEntry(citation, style);
            if (entry) {
                bibliography.entries.push(entry);
            }
        }

        // Sort bibliography entries alphabetically by author
        bibliography.entries.sort((a, b) => {
            const authorA = a.author || '';
            const authorB = b.author || '';
            return String(authorA).localeCompare(String(authorB));
        });

        return bibliography;
    }

    /**
     * Format individual citation entry
     */
    protected async formatCitationEntry(citation: Citation, style: string): Promise<Citation | null> {
        // This is a simplified implementation
        // In practice, you'd integrate with a citation library like Citation.js

        if (typeof citation === 'string') {
            // Simple string citation - parse basic info
            return {
                id: citation,
                formatted: citation,
                author: 'Unknown',
                year: 'n.d.',
                title: citation
            };
        }

        if (typeof citation === 'object') {
            // Structured citation object
            const formatted = this.formatCitationByStyle(citation, style);
            return {
                id: citation.id || citation.key,
                ...citation,
                formatted
            };
        }

        return null;
    }

    /**
     * Format citation based on style
     */
    protected formatCitationByStyle(citation: Citation, style: string): string {
        const author = citation.author || 'Unknown';
        const year = citation.year || 'n.d.';
        const title = citation.title || 'Unknown Title';

        switch (style) {
            case CITATION_STYLES.APA:
                return `${author}. (${year}). ${title}.`;
            case CITATION_STYLES.MLA:
                return `${author}. "${title}." ${year}.`;
            case CITATION_STYLES.CHICAGO:
                return `${author}. "${title}." Accessed ${year}.`;
            default:
                return `${author}. (${year}). ${title}.`;
        }
    }

    /**
     * Process academic elements (figures, tables, math)
     */
    protected async processAcademicElements(document: DocumentStructure, options: any): Promise<DocumentStructure> {
        for (const section of document.sections) {
            // Process mathematical expressions
            if (section.content) {
                section.content = this.processMathExpressions(section.content);
            }

            // Ensure figure and table captions are properly formatted
            if (section.figures) {
                section.figures = this.formatFigureCaptions(section.figures);
            }

            if (section.tables) {
                section.tables = this.formatTableCaptions(section.tables);
            }
        }

        return document;
    }

    /**
     * Process mathematical expressions in content
     */
    protected processMathExpressions(content: string): string {
        if (!content) return content;

        // Mark inline math expressions
        content = content.replace(/\$([^$]+)\$/g, '<math-inline>$1</math-inline>');

        // Mark block math expressions
        content = content.replace(/\$\$([^$]+)\$\$/g, '<math-block>$1</math-block>');

        return content;
    }

    /**
     * Format figure captions for academic standards
     */
    protected formatFigureCaptions(figures: Figure[]): Figure[] {
        return figures.map((figure, index) => ({
            ...figure,
            number: index + 1,
            formattedCaption: `Figure ${index + 1}: ${figure.caption || 'Untitled Figure'}`
        }));
    }

    /**
     * Format table captions for academic standards
     */
    protected formatTableCaptions(tables: Table[]): Table[] {
        return tables.map((table, index) => ({
            ...table,
            number: index + 1,
            formattedCaption: `Table ${index + 1}: ${table.caption || 'Untitled Table'}`
        }));
    }

    /**
     * Enhanced validation for academic documents
     */
    validateInputs(document: DocumentStructure, options: any): void {
        // Apply base validation
        super.validateInputs(document, options);

        // Additional academic validation
        this.validateAcademicStructure(document, options);
    }

    /**
     * Validate academic document structure
     */
    protected validateAcademicStructure(document: DocumentStructure, options: any): void {
        const warnings: string[] = [];

        // Check for abstract in academic documents
        if (this.academicOptions.includeAbstract && !document.abstract) {
            warnings.push('Academic document should include an abstract');
        }

        // Check for keywords
        if (this.academicOptions.includeKeywords && (!document.keywords || document.keywords.length === 0)) {
            warnings.push('Academic document should include keywords');
        }

        // Validate citation format
        if (document.citations && document.citations.length > 0) {
            const invalidCitations = document.citations.filter(citation =>
                typeof citation !== 'string' && typeof citation !== 'object'
            );
            if (invalidCitations.length > 0) {
                warnings.push(`Found ${invalidCitations.length} invalid citation(s)`);
            }
        }

        // Check section structure
        if (document.sections && document.sections.length > 0) {
            const hasProperHierarchy = this.validateSectionHierarchy(document.sections);
            if (!hasProperHierarchy) {
                warnings.push('Document section hierarchy may not follow academic standards');
            }
        }

        if (warnings.length > 0) {
            console.warn(`Academic structure warnings: ${warnings.join(', ')}`);
        }
    }

    /**
     * Validate section hierarchy follows academic standards
     */
    protected validateSectionHierarchy(sections: Section[]): boolean {
        let previousLevel = 0;

        for (const section of sections) {
            // Check for level jumps (e.g., level 1 to level 3)
            if (section.level > previousLevel + 1) {
                return false;
            }
            previousLevel = section.level;

            // Validate subsections recursively
            if (section.subsections && !this.validateSectionHierarchy(section.subsections)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Enhanced options validation for academic formats
     */
    validateOptions(options: any): ValidationResult {
        const validation = super.validateOptions(options);

        if (!validation.valid) {
            return validation;
        }

        // Additional academic options validation
        const academicErrors: string[] = [];

        if (options.citationStyle && !Object.values(CITATION_STYLES).includes(options.citationStyle)) {
            academicErrors.push(`Invalid citation style: ${options.citationStyle}`);
        }

        if (options.academic) {
            // Validate academic-specific options
            const academic = options.academic;

            if (academic.template && typeof academic.template !== 'string') {
                academicErrors.push('Academic template must be a string');
            }
        }

        return {
            valid: academicErrors.length === 0,
            errors: [...validation.errors, ...academicErrors]
        };
    }

    /**
     * Get academic processing statistics
     */
    getAcademicStats(document: DocumentStructure): AcademicStats {
        const metadata = DocumentUtils.extractMetadata(document);

        return {
            hasAbstract: !!document.abstract,
            hasKeywords: !!(document.keywords && document.keywords.length > 0),
            hasBibliography: !!(document.bibliography || (document.citations && document.citations.length > 0)),
            sectionCount: metadata.sectionCount,
            figureCount: metadata.figureCount,
            tableCount: metadata.tableCount,
            citationCount: metadata.citationCount,
            mathExpressions: this.countMathExpressions(document),
            wordCount: metadata.wordCount
        };
    }

    /**
     * Count mathematical expressions in document
     */
    protected countMathExpressions(document: DocumentStructure): number {
        let count = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.content) {
                    const inlineMath = section.content.match(/\$[^$]+\$/g) || [];
                    const blockMath = section.content.match(/\$\$[^$]+\$\$/g) || [];
                    count += inlineMath.length + blockMath.length;
                }
            }
        }

        return count;
    }

    /**
     * Enhanced statistics including academic metrics
     */
    getStats(): any {
        const baseStats = super.getStats();

        return {
            ...baseStats,
            academicOptions: this.academicOptions,
            supportedCitationStyles: this.capabilities.citationStyles,
            academicFeatures: this.capabilities.supportedFeatures.filter((f: string) =>
                ['citations', 'bibliography', 'toc', 'abstract', 'math'].includes(f)
            )
        };
    }
}

export default FormatExporter;