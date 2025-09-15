/**
 * APA Academic Paper Template
 * Implements APA 7th Edition formatting for academic papers
 */

import {
    AcademicTemplate,
    TemplateConfig,
    TemplateResult,
    TemplateValidation,
    TEMPLATE_TYPES,
    ACADEMIC_STYLES,
    TemplateUtils
} from '../TemplateEngine.js';
import { DocumentStructure } from '../../types/index.js';

export class APAAcademicPaper extends AcademicTemplate {
    readonly config: TemplateConfig = {
        id: 'apa-academic-paper',
        name: 'APA Academic Paper',
        type: TEMPLATE_TYPES.ACADEMIC_PAPER,
        style: ACADEMIC_STYLES.APA,
        description: 'Standard APA 7th Edition format for academic papers and research articles',

        pageSize: 'Letter',
        margins: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1,
            unit: 'in'
        },

        font: {
            family: 'Times New Roman',
            size: 12,
            lineHeight: 2.0,
            unit: 'pt'
        },

        headings: {
            1: {
                fontSize: 12,
                fontWeight: 'bold',
                spacing: { before: 0, after: 0 },
                alignment: 'center'
            },
            2: {
                fontSize: 12,
                fontWeight: 'bold',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            },
            3: {
                fontSize: 12,
                fontWeight: 'bold',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            },
            4: {
                fontSize: 12,
                fontWeight: 'bold',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            },
            5: {
                fontSize: 12,
                fontWeight: 'bold',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            }
        },

        citations: {
            style: ACADEMIC_STYLES.APA,
            inTextFormat: 'parenthetical',
            bibliographyTitle: 'References',
            bibliographyStyle: {
                hanging: true,
                spacing: 'double',
                sortBy: 'author'
            }
        },

        titlePage: {
            required: true,
            elements: {
                title: { position: 'center-top', alignment: 'center', fontSize: 12 },
                author: { position: 'center-middle', alignment: 'center', fontSize: 12 },
                institution: { position: 'center-middle', alignment: 'center', fontSize: 12 },
                date: { position: 'center-middle', alignment: 'center', fontSize: 12 }
            }
        },

        tableOfContents: {
            required: false,
            title: 'Table of Contents',
            maxDepth: 3,
            includePageNumbers: true,
            dotLeaders: true
        },

        figures: {
            captionPosition: 'below',
            captionFormat: 'Figure {number}. {title}',
            numbering: 'continuous',
            alignment: 'center'
        },

        tables: {
            captionPosition: 'above',
            captionFormat: 'Table {number}. {title}',
            numbering: 'continuous',
            alignment: 'center',
            borderStyle: 'minimal'
        },

        pageNumbers: {
            format: 'arabic',
            position: 'top-right',
            startPage: 1,
            showOnFirstPage: true
        },

        headers: {
            enabled: true,
            content: {
                left: '{title-short}',
                right: '{page}'
            },
            showOnFirstPage: true
        },

        footers: {
            enabled: false,
            content: {},
            showOnFirstPage: false
        },

        spacing: {
            lineSpacing: 'double',
            paragraphSpacing: 0,
            blockQuoteIndent: 0.5,
            firstLineIndent: 0.5
        },

        customSettings: {
            runningHead: true,
            authorNote: false,
            abstractRequired: true,
            keywordsRequired: true,
            appendicesSupported: true
        }
    };

    /**
     * Process document with APA formatting
     */
    async process(document: DocumentStructure, options?: any): Promise<TemplateResult> {
        const startTime = Date.now();
        const warnings: string[] = [];

        try {
            // Validate document first
            const validation = this.validate(document);
            if (!validation.valid) {
                throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
            }

            warnings.push(...validation.warnings);

            // Process the document
            const formattedContent = await this.formatDocument(document, options);

            // Calculate statistics
            const statistics = this.calculateStatistics(document, formattedContent);

            return {
                success: true,
                document,
                formattedContent,
                metadata: {
                    templateId: this.config.id,
                    processingTime: Date.now() - startTime,
                    warnings,
                    statistics
                }
            };
        } catch (error) {
            return {
                success: false,
                document,
                formattedContent: '',
                metadata: {
                    templateId: this.config.id,
                    processingTime: Date.now() - startTime,
                    warnings: [...warnings, error.message],
                    statistics: {
                        pageCount: 0,
                        wordCount: 0,
                        characterCount: 0,
                        figureCount: 0,
                        tableCount: 0,
                        citationCount: 0
                    }
                }
            };
        }
    }

    /**
     * Validate document against APA requirements
     */
    validate(document: DocumentStructure): TemplateValidation {
        const errors: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Required elements
        if (!document.title) {
            errors.push('Document title is required');
        }

        if (!document.author) {
            errors.push('Author information is required for APA format');
        }

        if (!document.sections || document.sections.length === 0) {
            errors.push('Document must have content sections');
        }

        // APA-specific requirements
        if (this.config.customSettings.abstractRequired && !document.abstract) {
            warnings.push('Abstract is recommended for APA papers');
        }

        if (this.config.customSettings.keywordsRequired && !document.keywords) {
            warnings.push('Keywords are recommended for APA papers');
        }

        // Content structure validation
        if (document.sections) {
            let hasIntroduction = false;
            let hasMethod = false;
            let hasResults = false;
            let hasDiscussion = false;

            for (const section of document.sections) {
                const title = section.title.toLowerCase();
                if (title.includes('introduction')) hasIntroduction = true;
                if (title.includes('method') || title.includes('methodology')) hasMethod = true;
                if (title.includes('result')) hasResults = true;
                if (title.includes('discussion') || title.includes('conclusion')) hasDiscussion = true;
            }

            if (!hasIntroduction) {
                suggestions.push('Consider adding an Introduction section');
            }
            if (!hasMethod && document.sections.length > 3) {
                suggestions.push('Consider adding a Methods section for empirical research');
            }
            if (!hasResults && hasMethod) {
                suggestions.push('Consider adding a Results section for empirical research');
            }
            if (!hasDiscussion) {
                suggestions.push('Consider adding a Discussion or Conclusion section');
            }
        }

        // Citation validation
        if (document.citations && document.citations.length > 0) {
            if (!document.bibliography) {
                warnings.push('References section is required when citations are present');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            suggestions
        };
    }

    /**
     * Get template preview
     */
    getPreview(): string {
        return TemplateUtils.generatePreviewHTML(this.config);
    }

    /**
     * Format document according to APA style
     */
    private async formatDocument(document: DocumentStructure, options?: any): Promise<string> {
        let formatted = '';

        // Title page
        formatted += this.formatTitlePage(document);

        // Abstract page (if present)
        if (document.abstract) {
            formatted += this.formatAbstractPage(document);
        }

        // Main content
        formatted += this.formatMainContent(document);

        // References
        if (document.bibliography) {
            formatted += this.formatReferences(document);
        }

        // Appendices (if any)
        if (document.metadata?.appendices) {
            formatted += this.formatAppendices(document.metadata.appendices);
        }

        return formatted;
    }

    /**
     * Format APA title page
     */
    private formatTitlePage(document: DocumentStructure): string {
        const title = document.title || 'Untitled';
        const author = document.author || 'Unknown Author';
        const institution = document.metadata?.institution || '';
        const date = document.date ? new Date(document.date).toLocaleDateString() : new Date().toLocaleDateString();

        return `
            <div class="title-page">
                <div class="running-head">
                    <div class="page-number">1</div>
                    <div class="running-head-text">${this.generateRunningHead(title)}</div>
                </div>

                <div class="title-content">
                    <h1 class="paper-title">${title}</h1>
                    <div class="author-info">
                        <div class="author-name">${author}</div>
                        ${institution ? `<div class="institution">${institution}</div>` : ''}
                        <div class="date">${date}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format abstract page
     */
    private formatAbstractPage(document: DocumentStructure): string {
        const abstract = document.abstract || '';
        const keywords = document.keywords ? document.keywords.join(', ') : '';

        return `
            <div class="abstract-page">
                <div class="running-head">
                    <div class="page-number">2</div>
                    <div class="running-head-text">${this.generateRunningHead(document.title)}</div>
                </div>

                <h2 class="abstract-title">Abstract</h2>
                <div class="abstract-content">
                    <p>${abstract}</p>
                    ${keywords ? `<p class="keywords"><em>Keywords:</em> ${keywords}</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Format main content
     */
    private formatMainContent(document: DocumentStructure): string {
        let content = '';
        let pageNumber = document.abstract ? 3 : 2;

        // Main title
        content += `
            <div class="main-content">
                <div class="running-head">
                    <div class="page-number">${pageNumber}</div>
                    <div class="running-head-text">${this.generateRunningHead(document.title)}</div>
                </div>

                <h1 class="main-title">${document.title}</h1>
        `;

        // Process sections
        if (document.sections) {
            for (const section of document.sections) {
                content += this.formatSection(section);
            }
        }

        content += '</div>';
        return content;
    }

    /**
     * Format individual section
     */
    private formatSection(section: any, level: number = 1): string {
        let sectionHtml = '';

        // Format heading according to APA levels
        const headingClass = this.getAPAHeadingClass(level);
        sectionHtml += `<h${Math.min(level + 1, 6)} class="${headingClass}">${section.title}</h${Math.min(level + 1, 6)}>`;

        // Format content
        if (section.content) {
            // Split into paragraphs and apply APA formatting
            const paragraphs = section.content.split('\n\n');
            for (const paragraph of paragraphs) {
                if (paragraph.trim()) {
                    sectionHtml += `<p class="body-text">${paragraph.trim()}</p>`;
                }
            }
        }

        // Process subsections
        if (section.subsections) {
            for (const subsection of section.subsections) {
                sectionHtml += this.formatSection(subsection, level + 1);
            }
        }

        return sectionHtml;
    }

    /**
     * Format references section
     */
    private formatReferences(document: DocumentStructure): string {
        return `
            <div class="references-page">
                <div class="running-head">
                    <div class="page-number">{page}</div>
                    <div class="running-head-text">${this.generateRunningHead(document.title)}</div>
                </div>

                <h2 class="references-title">References</h2>
                <div class="references-content">
                    ${document.bibliography || ''}
                </div>
            </div>
        `;
    }

    /**
     * Format appendices
     */
    private formatAppendices(appendices: any[]): string {
        let content = '';

        for (let i = 0; i < appendices.length; i++) {
            const appendix = appendices[i];
            const letter = String.fromCharCode(65 + i); // A, B, C, etc.

            content += `
                <div class="appendix-page">
                    <div class="running-head">
                        <div class="page-number">{page}</div>
                        <div class="running-head-text">${this.generateRunningHead(appendix.title)}</div>
                    </div>

                    <h2 class="appendix-title">Appendix ${letter}: ${appendix.title}</h2>
                    <div class="appendix-content">
                        ${appendix.content}
                    </div>
                </div>
            `;
        }

        return content;
    }

    /**
     * Generate APA running head
     */
    private generateRunningHead(title: string): string {
        // APA running head should be 50 characters or less
        const runningHead = title.toUpperCase();
        return runningHead.length > 50 ? runningHead.substring(0, 47) + '...' : runningHead;
    }

    /**
     * Get APA heading class based on level
     */
    private getAPAHeadingClass(level: number): string {
        const classes = [
            'apa-level-1', // Centered, Bold, Title Case
            'apa-level-2', // Flush Left, Bold, Title Case
            'apa-level-3', // Flush Left, Bold Italic, Title Case
            'apa-level-4', // Indented, Bold, Title Case, Ending with Period
            'apa-level-5'  // Indented, Bold Italic, Title Case, Ending with Period
        ];
        return classes[Math.min(level - 1, 4)] || 'apa-level-5';
    }

    /**
     * Calculate document statistics
     */
    private calculateStatistics(document: DocumentStructure, formattedContent: string): any {
        let wordCount = 0;
        let characterCount = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.content) {
                    const words = section.content.split(/\s+/).filter(word => word.length > 0);
                    wordCount += words.length;
                    characterCount += section.content.length;
                }
            }
        }

        // Add abstract words
        if (document.abstract) {
            const abstractWords = document.abstract.split(/\s+/).filter(word => word.length > 0);
            wordCount += abstractWords.length;
            characterCount += document.abstract.length;
        }

        // Estimate page count (250 words per page for double-spaced APA)
        const pageCount = Math.ceil(wordCount / 250) + (document.abstract ? 1 : 0) + 1; // +1 for title page

        return {
            pageCount,
            wordCount,
            characterCount,
            figureCount: document.sections?.reduce((count, section) =>
                count + (section.figures?.length || 0), 0) || 0,
            tableCount: document.sections?.reduce((count, section) =>
                count + (section.tables?.length || 0), 0) || 0,
            citationCount: document.citations?.length || 0
        };
    }

    /**
     * Get APA-specific export options
     */
    getExportOptions(): Record<string, any> {
        return {
            pageSize: this.config.pageSize,
            margins: this.config.margins,
            font: this.config.font,
            lineSpacing: this.config.spacing.lineSpacing,
            runningHead: this.config.customSettings.runningHead,
            titlePage: true,
            abstractPage: this.config.customSettings.abstractRequired,
            referenceStyle: 'apa'
        };
    }
}

export default APAAcademicPaper;