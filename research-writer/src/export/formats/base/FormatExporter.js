/**
 * FormatExporter - Enhanced base class for academic format exporters
 * Extends BaseExportProcessor with academic formatting capabilities
 */

import { BaseExportProcessor } from '../BaseExportProcessor.js';
import { EXPORT_FORMATS, CITATION_STYLES } from '../../types/index.js';
import { DocumentUtils, ContentUtils, FormatUtils } from '../../utils/index.js';

export class FormatExporter extends BaseExportProcessor {
    constructor(format, options = {}) {
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
    getFormatSpecificCapabilities() {
        return {};
    }

    /**
     * Enhanced preprocessing with academic structure
     */
    async preprocessDocument(document, options) {
        // First apply base preprocessing
        const baseDocument = await super.preprocessDocument(document, options);

        // Academic structure enhancement
        const academicDocument = await this.enhanceAcademicStructure(baseDocument, options);

        // Process academic elements
        await this.processAcademicElements(academicDocument, options);

        return academicDocument;
    }

    /**
     * Enhance document structure for academic formatting
     */
    async enhanceAcademicStructure(document, options) {
        const enhanced = { ...document };

        // Ensure proper academic structure
        enhanced.academic = {
            citationStyle: this.academicOptions.citationStyle,
            includeBibliography: this.academicOptions.includeBibliography,
            includeTOC: this.academicOptions.includeTOC,
            includeAbstract: this.academicOptions.includeAbstract,
            includeKeywords: this.academicOptions.includeKeywords,
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
    normalizeAcademicHierarchy(sections) {
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
    generateSectionNumber(sections, currentIndex) {
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
    generateTableOfContents(sections) {
        const toc = [];

        const processSections = (sectionList, level = 1) => {
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
    async processBibliography(citations, style) {
        const bibliography = {
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
            return authorA.localeCompare(authorB);
        });

        return bibliography;
    }

    /**
     * Format individual citation entry
     */
    async formatCitationEntry(citation, style) {
        // This is a simplified implementation
        // In practice, you'd integrate with a citation library like Citation.js

        if (typeof citation === 'string') {
            // Simple string citation - parse basic info
            return {
                id: citation,
                text: citation,
                author: 'Unknown',
                year: 'n.d.',
                formatted: `Unknown. (n.d.). ${citation}.`
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
    formatCitationByStyle(citation, style) {
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
    async processAcademicElements(document, options) {
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
    processMathExpressions(content) {
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
    formatFigureCaptions(figures) {
        return figures.map((figure, index) => ({
            ...figure,
            number: index + 1,
            caption: `Figure ${index + 1}: ${figure.caption || 'Untitled Figure'}`
        }));
    }

    /**
     * Format table captions for academic standards
     */
    formatTableCaptions(tables) {
        return tables.map((table, index) => ({
            ...table,
            number: index + 1,
            caption: `Table ${index + 1}: ${table.caption || 'Untitled Table'}`
        }));
    }

    /**
     * Enhanced validation for academic documents
     */
    validateInputs(document, options) {
        // Apply base validation
        super.validateInputs(document, options);

        // Additional academic validation
        this.validateAcademicStructure(document, options);
    }

    /**
     * Validate academic document structure
     */
    validateAcademicStructure(document, options) {
        const warnings = [];

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
    validateSectionHierarchy(sections) {
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
    validateOptions(options) {
        const validation = super.validateOptions(options);

        if (!validation.valid) {
            return validation;
        }

        // Additional academic options validation
        const academicErrors = [];

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
    getAcademicStats(document) {
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
    countMathExpressions(document) {
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
    getStats() {
        const baseStats = super.getStats();

        return {
            ...baseStats,
            academicOptions: this.academicOptions,
            supportedCitationStyles: this.capabilities.citationStyles,
            academicFeatures: this.capabilities.supportedFeatures.filter(f =>
                ['citations', 'bibliography', 'toc', 'abstract', 'math'].includes(f)
            )
        };
    }
}

export default FormatExporter;