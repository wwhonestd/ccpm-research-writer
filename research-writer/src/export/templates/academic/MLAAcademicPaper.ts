/**
 * MLA Academic Paper Template
 * Implements MLA 9th Edition formatting for academic papers
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

export class MLAAcademicPaper extends AcademicTemplate {
    readonly config: TemplateConfig = {
        id: 'mla-academic-paper',
        name: 'MLA Academic Paper',
        type: TEMPLATE_TYPES.ACADEMIC_PAPER,
        style: ACADEMIC_STYLES.MLA,
        description: 'Standard MLA 9th Edition format for academic papers and essays',

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
                fontWeight: 'normal',
                spacing: { before: 0, after: 0 },
                alignment: 'center'
            },
            2: {
                fontSize: 12,
                fontWeight: 'normal',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            },
            3: {
                fontSize: 12,
                fontWeight: 'normal',
                spacing: { before: 0, after: 0 },
                alignment: 'left'
            }
        },

        citations: {
            style: ACADEMIC_STYLES.MLA,
            inTextFormat: 'parenthetical',
            bibliographyTitle: 'Works Cited',
            bibliographyStyle: {
                hanging: true,
                spacing: 'double',
                sortBy: 'author'
            }
        },

        titlePage: {
            required: false,
            elements: {
                title: { position: 'center-top', alignment: 'center', fontSize: 12 },
                author: { position: 'left-top', alignment: 'left', fontSize: 12 },
                institution: { position: 'left-top', alignment: 'left', fontSize: 12 },
                date: { position: 'left-top', alignment: 'left', fontSize: 12 }
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
            captionFormat: 'Fig. {number}. {title}',
            numbering: 'continuous',
            alignment: 'center'
        },

        tables: {
            captionPosition: 'above',
            captionFormat: 'Table {number}. {title}',
            numbering: 'continuous',
            alignment: 'center',
            borderStyle: 'none'
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
                left: '{author-last}',
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
            blockQuoteIndent: 1.0,
            firstLineIndent: 0.5
        },

        customSettings: {
            headerFormat: 'last-name page',
            worksCitedRequired: true,
            outlineSupported: true,
            blockQuoteRequired: true
        }
    };

    /**
     * Process document with MLA formatting
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
     * Validate document against MLA requirements
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
            errors.push('Author information is required for MLA format');
        }

        if (!document.sections || document.sections.length === 0) {
            errors.push('Document must have content sections');
        }

        // MLA-specific requirements
        if (this.config.customSettings.worksCitedRequired && document.citations && document.citations.length > 0 && !document.bibliography) {
            warnings.push('Works Cited page is required when citations are present');
        }

        // Content structure validation
        if (document.sections) {
            let hasIntroduction = false;
            let hasConclusion = false;

            for (const section of document.sections) {
                const title = section.title.toLowerCase();
                if (title.includes('introduction') || section === document.sections[0]) {
                    hasIntroduction = true;
                }
                if (title.includes('conclusion') || section === document.sections[document.sections.length - 1]) {
                    hasConclusion = true;
                }
            }

            if (!hasIntroduction) {
                suggestions.push('Consider starting with a clear introduction');
            }
            if (!hasConclusion) {
                suggestions.push('Consider ending with a conclusion');
            }
        }

        // Check for proper citation format
        if (document.citations && document.citations.length > 0) {
            for (const citation of document.citations) {
                if (!citation.authors || citation.authors.length === 0) {
                    warnings.push(`Citation "${citation.title || citation.id}" missing author information`);
                }
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
     * Format document according to MLA style
     */
    private async formatDocument(document: DocumentStructure, options?: any): Promise<string> {
        let formatted = '';

        // MLA header and title (no separate title page)
        formatted += this.formatHeader(document);

        // Main content
        formatted += this.formatMainContent(document);

        // Works Cited
        if (document.bibliography) {
            formatted += this.formatWorksCited(document);
        }

        return formatted;
    }

    /**
     * Format MLA header and title
     */
    private formatHeader(document: DocumentStructure): string {
        const author = document.author || 'Student Name';
        const instructor = document.metadata?.instructor || 'Instructor Name';
        const course = document.metadata?.course || 'Course Name';
        const date = document.date ? this.formatMLADate(new Date(document.date)) : this.formatMLADate(new Date());
        const title = document.title || 'Untitled';

        return `
            <div class="mla-header">
                <div class="page-header">
                    <div class="header-left">${this.getLastName(author)}</div>
                    <div class="header-right">1</div>
                </div>

                <div class="heading-block">
                    <div class="student-name">${author}</div>
                    <div class="instructor-name">${instructor}</div>
                    <div class="course-name">${course}</div>
                    <div class="date">${date}</div>
                </div>

                <h1 class="paper-title">${title}</h1>
            </div>
        `;
    }

    /**
     * Format main content
     */
    private formatMainContent(document: DocumentStructure): string {
        let content = '';
        let pageNumber = 1;

        content += '<div class="main-content">';

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

        // MLA typically doesn't use many heading levels
        if (level <= 2 && section.title) {
            sectionHtml += `<h${Math.min(level + 1, 3)} class="mla-heading-${level}">${section.title}</h${Math.min(level + 1, 3)}>`;
        }

        // Format content
        if (section.content) {
            // Split into paragraphs and apply MLA formatting
            const paragraphs = section.content.split('\n\n');
            for (const paragraph of paragraphs) {
                if (paragraph.trim()) {
                    // Check if it's a block quote (longer than 4 lines or explicitly marked)
                    if (this.isBlockQuote(paragraph)) {
                        sectionHtml += `<blockquote class="mla-block-quote">${paragraph.trim()}</blockquote>`;
                    } else {
                        sectionHtml += `<p class="mla-paragraph">${paragraph.trim()}</p>`;
                    }
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
     * Format Works Cited section
     */
    private formatWorksCited(document: DocumentStructure): string {
        const authorLastName = this.getLastName(document.author || 'Student');

        return `
            <div class="works-cited-page">
                <div class="page-header">
                    <div class="header-left">${authorLastName}</div>
                    <div class="header-right">{page}</div>
                </div>

                <h2 class="works-cited-title">Works Cited</h2>
                <div class="works-cited-content">
                    ${document.bibliography || ''}
                </div>
            </div>
        `;
    }

    /**
     * Format date in MLA style (Day Month Year)
     */
    private formatMLADate(date: Date): string {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    }

    /**
     * Get last name from full name
     */
    private getLastName(fullName: string): string {
        const parts = fullName.trim().split(' ');
        return parts[parts.length - 1];
    }

    /**
     * Check if paragraph should be formatted as block quote
     */
    private isBlockQuote(paragraph: string): boolean {
        // Simple heuristic: if paragraph starts with quote or is very long
        const lines = paragraph.split('\n');
        const isLong = lines.length > 4 || paragraph.length > 300;
        const startsWithQuote = paragraph.trim().startsWith('"') || paragraph.trim().startsWith('"');

        return isLong || startsWithQuote;
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

        // Estimate page count (250 words per page for double-spaced MLA)
        const pageCount = Math.ceil(wordCount / 250) + (document.bibliography ? 1 : 0);

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
     * Get MLA-specific export options
     */
    getExportOptions(): Record<string, any> {
        return {
            pageSize: this.config.pageSize,
            margins: this.config.margins,
            font: this.config.font,
            lineSpacing: this.config.spacing.lineSpacing,
            headerFormat: this.config.customSettings.headerFormat,
            titlePage: false,
            firstPageHeader: true,
            worksCited: this.config.customSettings.worksCitedRequired,
            referenceStyle: 'mla'
        };
    }
}

export default MLAAcademicPaper;