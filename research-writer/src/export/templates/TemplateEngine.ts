/**
 * Template Engine - Academic formatting templates system
 * Provides template-based formatting for different publication types and styles
 */

import { DocumentStructure } from '../types/index.js';

/**
 * Template types for different academic publications
 */
export const TEMPLATE_TYPES = {
    ACADEMIC_PAPER: 'academic-paper',
    THESIS: 'thesis',
    DISSERTATION: 'dissertation',
    JOURNAL_ARTICLE: 'journal-article',
    CONFERENCE_PAPER: 'conference-paper',
    RESEARCH_PROPOSAL: 'research-proposal',
    TECHNICAL_REPORT: 'technical-report',
    BOOK_CHAPTER: 'book-chapter',
    PRESENTATION: 'presentation',
    POSTER: 'poster'
} as const;

/**
 * Academic styles for templates
 */
export const ACADEMIC_STYLES = {
    APA: 'apa',
    MLA: 'mla',
    CHICAGO: 'chicago',
    IEEE: 'ieee',
    HARVARD: 'harvard',
    VANCOUVER: 'vancouver',
    TURABIAN: 'turabian',
    ASA: 'asa'
} as const;

/**
 * Template configuration interface
 */
export interface TemplateConfig {
    id: string;
    name: string;
    type: keyof typeof TEMPLATE_TYPES;
    style: keyof typeof ACADEMIC_STYLES;
    description: string;

    // Page layout settings
    pageSize: 'A4' | 'A3' | 'Letter' | 'Legal';
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
        unit: 'in' | 'cm' | 'mm' | 'pt';
    };

    // Typography settings
    font: {
        family: string;
        size: number;
        lineHeight: number;
        unit: 'pt' | 'px';
    };

    // Heading styles
    headings: {
        [level: number]: {
            fontSize: number;
            fontWeight: 'normal' | 'bold';
            spacing: {
                before: number;
                after: number;
            };
            alignment: 'left' | 'center' | 'right';
            numberingStyle?: 'decimal' | 'roman' | 'alpha' | 'none';
        };
    };

    // Citation and bibliography settings
    citations: {
        style: keyof typeof ACADEMIC_STYLES;
        inTextFormat: 'parenthetical' | 'narrative' | 'footnote' | 'endnote';
        bibliographyTitle: string;
        bibliographyStyle: {
            hanging: boolean;
            spacing: 'single' | 'double' | 'one-and-half';
            sortBy: 'author' | 'year' | 'title';
        };
    };

    // Title page settings
    titlePage: {
        required: boolean;
        elements: {
            title: { position: string; alignment: string; fontSize: number };
            author: { position: string; alignment: string; fontSize: number };
            institution: { position: string; alignment: string; fontSize: number };
            date: { position: string; alignment: string; fontSize: number };
            abstract?: { position: string; alignment: string; fontSize: number };
        };
    };

    // Table of contents settings
    tableOfContents: {
        required: boolean;
        title: string;
        maxDepth: number;
        includePageNumbers: boolean;
        dotLeaders: boolean;
    };

    // Figure and table settings
    figures: {
        captionPosition: 'above' | 'below';
        captionFormat: string; // e.g., "Figure {number}: {title}"
        numbering: 'continuous' | 'by-chapter';
        alignment: 'left' | 'center' | 'right';
    };

    tables: {
        captionPosition: 'above' | 'below';
        captionFormat: string; // e.g., "Table {number}: {title}"
        numbering: 'continuous' | 'by-chapter';
        alignment: 'left' | 'center' | 'right';
        borderStyle: 'none' | 'minimal' | 'full';
    };

    // Page numbering
    pageNumbers: {
        format: 'arabic' | 'roman' | 'alpha';
        position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        startPage: number;
        showOnFirstPage: boolean;
    };

    // Headers and footers
    headers: {
        enabled: boolean;
        content: {
            left?: string;
            center?: string;
            right?: string;
        };
        showOnFirstPage: boolean;
    };

    footers: {
        enabled: boolean;
        content: {
            left?: string;
            center?: string;
            right?: string;
        };
        showOnFirstPage: boolean;
    };

    // Spacing and formatting
    spacing: {
        lineSpacing: 'single' | 'one-and-half' | 'double';
        paragraphSpacing: number;
        blockQuoteIndent: number;
        firstLineIndent: number;
    };

    // Additional style-specific settings
    customSettings?: Record<string, any>;
}

/**
 * Template processing result
 */
export interface TemplateResult {
    success: boolean;
    document: DocumentStructure;
    formattedContent: string;
    metadata: {
        templateId: string;
        processingTime: number;
        warnings: string[];
        statistics: {
            pageCount: number;
            wordCount: number;
            characterCount: number;
            figureCount: number;
            tableCount: number;
            citationCount: number;
        };
    };
}

/**
 * Template validation result
 */
export interface TemplateValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

/**
 * Abstract template class
 */
export abstract class AcademicTemplate {
    abstract readonly config: TemplateConfig;

    /**
     * Process document with this template
     */
    abstract process(document: DocumentStructure, options?: any): Promise<TemplateResult>;

    /**
     * Validate document against template requirements
     */
    abstract validate(document: DocumentStructure): TemplateValidation;

    /**
     * Get template preview
     */
    abstract getPreview(): string;

    /**
     * Get template-specific export options
     */
    getExportOptions(): Record<string, any> {
        return {};
    }

    /**
     * Get template compatibility with export formats
     */
    getFormatCompatibility(): Record<string, boolean> {
        return {
            pdf: true,
            docx: true,
            latex: true,
            html: true
        };
    }
}

/**
 * Main template engine class
 */
export class TemplateEngine {
    private templates: Map<string, AcademicTemplate> = new Map();
    private defaultTemplate: string | null = null;

    /**
     * Register a template
     */
    registerTemplate(template: AcademicTemplate): void {
        this.templates.set(template.config.id, template);

        // Set as default if it's the first template
        if (!this.defaultTemplate) {
            this.defaultTemplate = template.config.id;
        }
    }

    /**
     * Get available templates
     */
    getAvailableTemplates(): TemplateConfig[] {
        return Array.from(this.templates.values()).map(template => template.config);
    }

    /**
     * Get templates by type
     */
    getTemplatesByType(type: keyof typeof TEMPLATE_TYPES): TemplateConfig[] {
        return this.getAvailableTemplates().filter(config => config.type === type);
    }

    /**
     * Get templates by style
     */
    getTemplatesByStyle(style: keyof typeof ACADEMIC_STYLES): TemplateConfig[] {
        return this.getAvailableTemplates().filter(config => config.style === style);
    }

    /**
     * Check if template exists
     */
    hasTemplate(templateId: string): boolean {
        return this.templates.has(templateId);
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId: string): AcademicTemplate | null {
        return this.templates.get(templateId) || null;
    }

    /**
     * Set default template
     */
    setDefaultTemplate(templateId: string): void {
        if (!this.hasTemplate(templateId)) {
            throw new Error(`Template '${templateId}' not found`);
        }
        this.defaultTemplate = templateId;
    }

    /**
     * Get default template
     */
    getDefaultTemplate(): AcademicTemplate | null {
        if (!this.defaultTemplate) return null;
        return this.getTemplate(this.defaultTemplate);
    }

    /**
     * Process document with specified template
     */
    async processDocument(
        document: DocumentStructure,
        templateId?: string,
        options?: any
    ): Promise<TemplateResult> {
        const template = templateId
            ? this.getTemplate(templateId)
            : this.getDefaultTemplate();

        if (!template) {
            throw new Error(
                templateId
                    ? `Template '${templateId}' not found`
                    : 'No default template set'
            );
        }

        return template.process(document, options);
    }

    /**
     * Validate document against template
     */
    validateDocument(document: DocumentStructure, templateId?: string): TemplateValidation {
        const template = templateId
            ? this.getTemplate(templateId)
            : this.getDefaultTemplate();

        if (!template) {
            return {
                valid: false,
                errors: [templateId ? `Template '${templateId}' not found` : 'No default template set'],
                warnings: [],
                suggestions: []
            };
        }

        return template.validate(document);
    }

    /**
     * Get template recommendations based on document analysis
     */
    getTemplateRecommendations(document: DocumentStructure): TemplateConfig[] {
        const recommendations: Array<{ template: TemplateConfig; score: number }> = [];

        for (const template of this.templates.values()) {
            const score = this.calculateTemplateScore(document, template);
            recommendations.push({ template: template.config, score });
        }

        // Sort by score (highest first)
        recommendations.sort((a, b) => b.score - a.score);

        return recommendations.slice(0, 5).map(rec => rec.template);
    }

    /**
     * Calculate template suitability score
     */
    private calculateTemplateScore(document: DocumentStructure, template: AcademicTemplate): number {
        let score = 0;

        // Basic document structure analysis
        if (document.abstract && template.config.titlePage.elements.abstract) {
            score += 20;
        }

        if (document.sections && document.sections.length > 5 && template.config.tableOfContents.required) {
            score += 15;
        }

        if (document.citations && document.citations.length > 0) {
            score += 10;
        }

        // Content analysis
        const totalContent = document.sections?.reduce((total, section) =>
            total + (section.content?.length || 0), 0) || 0;

        if (totalContent > 10000) { // Long document
            if (template.config.type === TEMPLATE_TYPES.THESIS ||
                template.config.type === TEMPLATE_TYPES.DISSERTATION) {
                score += 25;
            }
        } else if (totalContent > 3000) { // Medium document
            if (template.config.type === TEMPLATE_TYPES.ACADEMIC_PAPER ||
                template.config.type === TEMPLATE_TYPES.JOURNAL_ARTICLE) {
                score += 25;
            }
        } else { // Short document
            if (template.config.type === TEMPLATE_TYPES.CONFERENCE_PAPER ||
                template.config.type === TEMPLATE_TYPES.RESEARCH_PROPOSAL) {
                score += 25;
            }
        }

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Export template configuration
     */
    exportTemplateConfig(templateId: string): string {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        return JSON.stringify(template.config, null, 2);
    }

    /**
     * Import template configuration
     */
    importTemplateConfig(configJson: string): TemplateConfig {
        try {
            const config = JSON.parse(configJson);
            this.validateTemplateConfig(config);
            return config;
        } catch (error) {
            throw new Error(`Invalid template configuration: ${error.message}`);
        }
    }

    /**
     * Validate template configuration
     */
    private validateTemplateConfig(config: any): void {
        const required = ['id', 'name', 'type', 'style', 'pageSize', 'margins', 'font'];

        for (const field of required) {
            if (!config[field]) {
                throw new Error(`Required field '${field}' is missing`);
            }
        }

        if (!Object.values(TEMPLATE_TYPES).includes(config.type)) {
            throw new Error(`Invalid template type: ${config.type}`);
        }

        if (!Object.values(ACADEMIC_STYLES).includes(config.style)) {
            throw new Error(`Invalid academic style: ${config.style}`);
        }
    }

    /**
     * Get engine statistics
     */
    getStats(): {
        totalTemplates: number;
        templatesByType: Record<string, number>;
        templatesByStyle: Record<string, number>;
    } {
        const templatesByType: Record<string, number> = {};
        const templatesByStyle: Record<string, number> = {};

        for (const template of this.templates.values()) {
            const type = template.config.type;
            const style = template.config.style;

            templatesByType[type] = (templatesByType[type] || 0) + 1;
            templatesByStyle[style] = (templatesByStyle[style] || 0) + 1;
        }

        return {
            totalTemplates: this.templates.size,
            templatesByType,
            templatesByStyle
        };
    }
}

/**
 * Template utilities
 */
export class TemplateUtils {
    /**
     * Convert template margins to CSS
     */
    static marginsToCSS(margins: TemplateConfig['margins']): string {
        const { top, bottom, left, right, unit } = margins;
        return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`;
    }

    /**
     * Convert template font to CSS
     */
    static fontToCSS(font: TemplateConfig['font']): string {
        return `${font.size}${font.unit}/${font.lineHeight} "${font.family}"`;
    }

    /**
     * Format template heading style to CSS
     */
    static headingToCSS(heading: TemplateConfig['headings'][number]): string {
        return `
            font-size: ${heading.fontSize}pt;
            font-weight: ${heading.fontWeight};
            text-align: ${heading.alignment};
            margin-top: ${heading.spacing.before}pt;
            margin-bottom: ${heading.spacing.after}pt;
        `;
    }

    /**
     * Generate template preview HTML
     */
    static generatePreviewHTML(config: TemplateConfig): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.name} Preview</title>
                <style>
                    body {
                        font-family: "${config.font.family}";
                        font-size: ${config.font.size}${config.font.unit};
                        line-height: ${config.font.lineHeight};
                        margin: ${this.marginsToCSS(config.margins)};
                        max-width: 800px;
                    }
                    h1 { ${this.headingToCSS(config.headings[1] || {})} }
                    h2 { ${this.headingToCSS(config.headings[2] || {})} }
                    h3 { ${this.headingToCSS(config.headings[3] || {})} }
                </style>
            </head>
            <body>
                <h1>Sample Title</h1>
                <p>This is a preview of the ${config.name} template (${config.style.toUpperCase()} style).</p>
                <h2>Section Heading</h2>
                <p>Sample paragraph text showing the formatting and typography settings.</p>
                <h3>Subsection</h3>
                <p>Additional content to demonstrate heading hierarchy and spacing.</p>
            </body>
            </html>
        `;
    }
}

export default TemplateEngine;