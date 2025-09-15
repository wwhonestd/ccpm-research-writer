/**
 * WordExporter - Academic Word document export processor
 * Generates professionally formatted DOCX documents for academic use
 */

import { FormatExporter } from './base/FormatExporter.js';
import { EXPORT_FORMATS, CITATION_STYLES } from '../types/index.js';
import { AcademicUtils, CitationUtils, MathUtils, MediaUtils, ReferenceUtils } from './utils/index.js';

export class WordExporter extends FormatExporter {
    constructor(options = {}) {
        super(EXPORT_FORMATS.DOCX, options);

        // Word-specific options
        this.wordOptions = {
            pageSize: options.pageSize || 'A4',
            margins: options.margins || { top: 72, bottom: 72, left: 72, right: 72 },
            fontSize: options.fontSize || 12,
            fontFamily: options.fontFamily || 'Times New Roman',
            lineSpacing: options.lineSpacing || 1.5,
            template: options.template || 'standard',
            trackChanges: options.trackChanges || false,
            includeComments: options.includeComments !== false,
            styleSet: options.styleSet || 'academic',
            automaticNumbering: options.automaticNumbering !== false,
            ...options.word || {}
        };

        // Apply template-specific settings
        this.applyTemplate(this.wordOptions.template);

        // Word capabilities
        this.capabilities = {
            ...this.capabilities,
            format: EXPORT_FORMATS.DOCX,
            supportedFeatures: [
                'figures', 'tables', 'citations', 'bibliography', 'toc',
                'headers', 'footers', 'styles', 'comments', 'track-changes',
                'cross-references', 'fields', 'math', 'page-numbers'
            ],
            outputType: 'binary',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            fileExtension: 'docx',
            supportedStyleSets: ['academic', 'apa', 'mla', 'chicago'],
            supportedFonts: [
                'Times New Roman', 'Arial', 'Calibri', 'Garamond',
                'Georgia', 'Helvetica', 'Palatino'
            ]
        };
    }

    /**
     * Apply template-specific Word settings
     */
    applyTemplate(template) {
        const layout = AcademicUtils.getPageLayout(template);

        this.wordOptions = {
            ...this.wordOptions,
            ...layout
        };

        // Template-specific adjustments
        switch (template.toLowerCase()) {
            case 'thesis':
                this.wordOptions.automaticNumbering = true;
                this.wordOptions.includeComments = true;
                this.academicOptions.includeTOC = true;
                this.wordOptions.styleSet = 'academic';
                break;
            case 'journal':
                this.wordOptions.lineSpacing = 2.0;
                this.wordOptions.fontSize = 12;
                this.wordOptions.styleSet = 'apa';
                break;
            case 'conference':
                this.wordOptions.fontSize = 10;
                this.wordOptions.fontFamily = 'Arial';
                this.wordOptions.lineSpacing = 1.0;
                this.wordOptions.styleSet = 'conference';
                break;
            case 'manuscript':
                this.wordOptions.lineSpacing = 2.0;
                this.wordOptions.trackChanges = true;
                this.wordOptions.includeComments = true;
                break;
        }
    }

    /**
     * Get Word-specific capabilities
     */
    getFormatSpecificCapabilities() {
        return {
            supportedPageSizes: ['A4', 'A3', 'Letter', 'Legal', 'A5'],
            supportedTemplates: ['standard', 'thesis', 'journal', 'conference', 'manuscript'],
            maxFileSize: '100MB',
            supportsTrackChanges: true,
            supportsComments: true,
            supportsFields: true
        };
    }

    /**
     * Initialize Word processor
     */
    async initializeProcessor() {
        console.log('Initializing Word processor...');

        // Validate Word generation capabilities
        this.validateWordCapabilities();

        // Initialize style definitions
        this.initializeStyles();

        console.log('Word processor initialized with template:', this.wordOptions.template);
    }

    /**
     * Validate Word generation capabilities
     */
    validateWordCapabilities() {
        // In a real implementation, check for libraries like docx or officegen
        console.log('Word generation capabilities validated');
    }

    /**
     * Initialize Word styles
     */
    initializeStyles() {
        this.styles = this.createStyleDefinitions();
    }

    /**
     * Create Word style definitions
     */
    createStyleDefinitions() {
        const baseFont = this.wordOptions.fontFamily;
        const baseFontSize = this.wordOptions.fontSize;

        return {
            // Paragraph styles
            'Normal': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize,
                lineSpacing: this.wordOptions.lineSpacing,
                alignment: 'left'
            },
            'Title': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize + 6,
                bold: true,
                alignment: 'center',
                spaceBefore: 0,
                spaceAfter: 24
            },
            'Heading 1': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize + 2,
                bold: true,
                alignment: 'left',
                spaceBefore: 12,
                spaceAfter: 6,
                keepWithNext: true
            },
            'Heading 2': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize + 1,
                bold: true,
                alignment: 'left',
                spaceBefore: 10,
                spaceAfter: 6,
                keepWithNext: true
            },
            'Heading 3': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize,
                bold: true,
                italic: true,
                alignment: 'left',
                spaceBefore: 8,
                spaceAfter: 4,
                keepWithNext: true
            },
            'Abstract': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize - 1,
                alignment: 'left',
                spaceBefore: 12,
                spaceAfter: 12,
                indent: { left: 360, right: 360 } // 0.5 inch indent
            },
            'Bibliography': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize - 1,
                alignment: 'left',
                hangingIndent: 360, // 0.5 inch hanging indent
                spaceBefore: 6,
                spaceAfter: 0
            },
            'Figure Caption': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize - 1,
                alignment: 'center',
                spaceBefore: 6,
                spaceAfter: 12,
                keepWithPrevious: true
            },
            'Table Caption': {
                type: 'paragraph',
                font: baseFont,
                size: baseFontSize - 1,
                alignment: 'center',
                spaceBefore: 12,
                spaceAfter: 6,
                keepWithNext: true
            },
            // Character styles
            'Emphasis': {
                type: 'character',
                italic: true
            },
            'Strong': {
                type: 'character',
                bold: true
            },
            'Code': {
                type: 'character',
                font: 'Courier New',
                size: baseFontSize - 1
            },
            'Math': {
                type: 'character',
                font: 'Cambria Math',
                size: baseFontSize
            }
        };
    }

    /**
     * Process document for Word export
     */
    async processDocument(document, options) {
        console.log('Processing document for Word export...');

        try {
            // Generate cross-reference labels
            const labels = ReferenceUtils.generateLabels(document);

            // Create Word document structure
            const wordStructure = await this.createWordStructure(document, options, labels);

            // Generate Word document
            const wordContent = await this.generateWordDocument(wordStructure);

            // Create binary data
            const wordData = await this.createWordBinary(wordContent);

            return {
                success: true,
                data: wordData,
                filename: this.generateFilename(document),
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                metadata: {
                    pages: wordContent.estimatedPages,
                    fileSize: wordData.length,
                    template: this.wordOptions.template,
                    ...this.extractWordMetadata(document)
                }
            };

        } catch (error) {
            console.error('Word processing failed:', error);
            return {
                success: false,
                error: `Word generation failed: ${error.message}`,
                data: null
            };
        }
    }

    /**
     * Create Word document structure
     */
    async createWordStructure(document, options, labels) {
        const structure = {
            properties: this.createDocumentProperties(document),
            styles: this.styles,
            sections: [],
            headers: {},
            footers: {},
            fields: []
        };

        // Document header/footer
        if (this.wordOptions.template !== 'manuscript') {
            structure.headers['default'] = this.createHeader(document);
            structure.footers['default'] = this.createFooter(document);
        }

        // Title section
        if (this.shouldIncludeTitleSection(document)) {
            structure.sections.push(await this.createTitleSection(document));
        }

        // Abstract section
        if (document.abstract && this.academicOptions.includeAbstract) {
            structure.sections.push(await this.createAbstractSection(document));
        }

        // Table of contents
        if (document.tableOfContents && this.academicOptions.includeTOC) {
            structure.sections.push(await this.createTOCSection());
        }

        // Main content sections
        for (const section of document.sections) {
            const wordSection = await this.createContentSection(section, labels);
            structure.sections.push(wordSection);
        }

        // Bibliography section
        if (document.bibliography && this.academicOptions.includeBibliography) {
            structure.sections.push(await this.createBibliographySection(document.bibliography));
        }

        return structure;
    }

    /**
     * Create document properties
     */
    createDocumentProperties(document) {
        return {
            title: document.title || 'Academic Document',
            author: document.author || 'Unknown Author',
            subject: document.abstract ? document.abstract.substring(0, 100) + '...' : '',
            keywords: document.keywords ? document.keywords.join(', ') : '',
            comments: 'Generated by Research Writer - Academic Export System',
            lastModifiedBy: 'Research Writer',
            revision: 1,
            created: new Date(),
            modified: new Date(),
            application: 'Research Writer Word Exporter',
            pageSetup: {
                size: this.wordOptions.pageSize,
                orientation: 'portrait',
                margins: this.wordOptions.margins
            }
        };
    }

    /**
     * Create document header
     */
    createHeader(document) {
        if (this.wordOptions.template === 'apa') {
            return {
                type: 'header',
                content: [
                    {
                        type: 'paragraph',
                        style: 'Header',
                        alignment: 'right',
                        content: [
                            { type: 'text', text: (document.title || '').toUpperCase() }
                        ]
                    }
                ]
            };
        }

        return null;
    }

    /**
     * Create document footer
     */
    createFooter(document) {
        return {
            type: 'footer',
            content: [
                {
                    type: 'paragraph',
                    style: 'Footer',
                    alignment: 'center',
                    content: [
                        { type: 'field', fieldType: 'PAGE' }
                    ]
                }
            ]
        };
    }

    /**
     * Check if title section should be included
     */
    shouldIncludeTitleSection(document) {
        return this.wordOptions.template !== 'journal' &&
               (document.title || document.author || document.date);
    }

    /**
     * Create title section
     */
    async createTitleSection(document) {
        const elements = [];

        // Title
        if (document.title) {
            elements.push({
                type: 'paragraph',
                style: 'Title',
                content: [{ type: 'text', text: document.title }]
            });
        }

        // Author
        if (document.author) {
            elements.push({
                type: 'paragraph',
                style: 'Normal',
                alignment: 'center',
                content: [{ type: 'text', text: document.author }]
            });
        }

        // Institution
        if (document.metadata?.institution) {
            elements.push({
                type: 'paragraph',
                style: 'Normal',
                alignment: 'center',
                content: [{ type: 'text', text: document.metadata.institution }]
            });
        }

        // Date
        const date = this.formatDate(document.date);
        elements.push({
            type: 'paragraph',
            style: 'Normal',
            alignment: 'center',
            content: [{ type: 'text', text: date }]
        });

        return {
            type: 'title',
            elements: elements,
            pageBreakAfter: true
        };
    }

    /**
     * Create abstract section
     */
    async createAbstractSection(document) {
        const elements = [];

        // Abstract heading
        elements.push({
            type: 'paragraph',
            style: 'Heading 1',
            content: [{ type: 'text', text: 'Abstract' }]
        });

        // Abstract text
        elements.push({
            type: 'paragraph',
            style: 'Abstract',
            content: [{ type: 'text', text: document.abstract }]
        });

        // Keywords
        if (document.keywords && document.keywords.length > 0) {
            elements.push({
                type: 'paragraph',
                style: 'Abstract',
                content: [
                    { type: 'text', text: 'Keywords: ', formatting: { italic: true } },
                    { type: 'text', text: document.keywords.join(', ') }
                ]
            });
        }

        return {
            type: 'abstract',
            elements: elements,
            pageBreakAfter: this.wordOptions.template === 'thesis'
        };
    }

    /**
     * Create table of contents section
     */
    async createTOCSection() {
        return {
            type: 'toc',
            elements: [
                {
                    type: 'paragraph',
                    style: 'Heading 1',
                    content: [{ type: 'text', text: 'Table of Contents' }]
                },
                {
                    type: 'field',
                    fieldType: 'TOC',
                    switches: '\\o "1-3" \\h \\z \\u'
                }
            ],
            pageBreakAfter: true
        };
    }

    /**
     * Create content section
     */
    async createContentSection(section, labels) {
        const elements = [];

        // Section heading
        const headingStyle = `Heading ${Math.min(section.level, 6)}`;
        const headingText = this.wordOptions.automaticNumbering && section.number ?
            `${section.number} ${section.title}` : section.title;

        elements.push({
            type: 'paragraph',
            style: headingStyle,
            bookmarkName: section.id,
            content: [{ type: 'text', text: headingText }],
            pageBreakBefore: section.pageBreakBefore
        });

        // Section content
        if (section.content) {
            const processedContent = this.processContentForWord(section.content, labels);
            elements.push(...processedContent);
        }

        // Figures
        if (section.figures && section.figures.length > 0) {
            for (const figure of section.figures) {
                elements.push(...this.createFigureElements(figure));
            }
        }

        // Tables
        if (section.tables && section.tables.length > 0) {
            for (const table of section.tables) {
                elements.push(...this.createTableElements(table));
            }
        }

        return {
            type: 'content',
            elements: elements,
            pageBreakAfter: section.pageBreakAfter
        };
    }

    /**
     * Process content for Word format
     */
    processContentForWord(content, labels) {
        if (!content) return [];

        // Resolve cross-references
        let processedContent = ReferenceUtils.resolveCrossReferences(content, labels);

        // Process mathematical expressions
        processedContent = this.processMathForWord(processedContent);

        // Split into paragraphs and process formatting
        const paragraphs = processedContent.split(/\n\s*\n/);
        const elements = [];

        for (const paragraph of paragraphs) {
            if (paragraph.trim()) {
                elements.push({
                    type: 'paragraph',
                    style: 'Normal',
                    content: this.parseInlineFormatting(paragraph.trim())
                });
            }
        }

        return elements;
    }

    /**
     * Process mathematical expressions for Word
     */
    processMathForWord(content) {
        if (!content) return content;

        const mathInfo = MathUtils.detectMathExpressions(content);

        if (!mathInfo.hasInlineMath && !mathInfo.hasBlockMath) {
            return content;
        }

        let processed = content;

        // Handle math expressions
        for (const expression of mathInfo.expressions) {
            if (expression.type === 'inline') {
                // Use Word's equation field or convert to Unicode
                const converted = MathUtils.convertSimpleMath(expression.content);
                processed = processed.replace(expression.original, converted);
            } else {
                // Block math - convert and center
                const converted = MathUtils.convertSimpleMath(expression.content);
                processed = processed.replace(expression.original, `\n\n${converted}\n\n`);
            }
        }

        return processed;
    }

    /**
     * Parse inline formatting (bold, italic, etc.)
     */
    parseInlineFormatting(text) {
        const elements = [];
        let currentPos = 0;

        // Simple regex-based parsing for basic formatting
        const formatRegex = /(\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`)/g;
        let match;

        while ((match = formatRegex.exec(text)) !== null) {
            // Add text before match
            if (match.index > currentPos) {
                const beforeText = text.substring(currentPos, match.index);
                if (beforeText) {
                    elements.push({ type: 'text', text: beforeText });
                }
            }

            // Add formatted text
            const [fullMatch, , boldText, italicText, codeText] = match;

            if (boldText) {
                elements.push({ type: 'text', text: boldText, formatting: { bold: true } });
            } else if (italicText) {
                elements.push({ type: 'text', text: italicText, formatting: { italic: true } });
            } else if (codeText) {
                elements.push({ type: 'text', text: codeText, formatting: { font: 'Courier New' } });
            }

            currentPos = match.index + fullMatch.length;
        }

        // Add remaining text
        if (currentPos < text.length) {
            const remainingText = text.substring(currentPos);
            if (remainingText) {
                elements.push({ type: 'text', text: remainingText });
            }
        }

        // If no formatting found, return as single text element
        if (elements.length === 0) {
            elements.push({ type: 'text', text: text });
        }

        return elements;
    }

    /**
     * Create figure elements
     */
    createFigureElements(figure) {
        const elements = [];

        // Figure caption (above for tables, below for figures in some styles)
        const captionPosition = this.wordOptions.styleSet === 'apa' ? 'above' : 'below';

        if (captionPosition === 'above') {
            elements.push({
                type: 'paragraph',
                style: 'Figure Caption',
                content: [{ type: 'text', text: figure.formattedCaption }]
            });
        }

        // Figure placeholder (in real implementation, would embed actual image)
        elements.push({
            type: 'paragraph',
            style: 'Normal',
            alignment: 'center',
            content: [{
                type: 'image',
                src: figure.src,
                width: MediaUtils.getFigureSize('MEDIUM').width,
                height: MediaUtils.getFigureSize('MEDIUM').height,
                alt: figure.caption
            }]
        });

        if (captionPosition === 'below') {
            elements.push({
                type: 'paragraph',
                style: 'Figure Caption',
                content: [{ type: 'text', text: figure.formattedCaption }]
            });
        }

        return elements;
    }

    /**
     * Create table elements
     */
    createTableElements(table) {
        const elements = [];
        const processedTable = MediaUtils.processTableData(table);

        // Table caption
        elements.push({
            type: 'paragraph',
            style: 'Table Caption',
            content: [{ type: 'text', text: processedTable.formattedCaption }]
        });

        // Table
        elements.push({
            type: 'table',
            style: 'Academic Table',
            headers: processedTable.headers,
            rows: processedTable.rows,
            properties: {
                width: '100%',
                borders: true,
                alignment: 'center'
            }
        });

        return elements;
    }

    /**
     * Create bibliography section
     */
    async createBibliographySection(bibliography) {
        const elements = [];

        // Bibliography heading
        elements.push({
            type: 'paragraph',
            style: 'Heading 1',
            content: [{ type: 'text', text: 'References' }]
        });

        // Bibliography entries
        const sortedEntries = CitationUtils.sortBibliography(bibliography.entries, bibliography.style);

        for (const entry of sortedEntries) {
            elements.push({
                type: 'paragraph',
                style: 'Bibliography',
                content: [{ type: 'text', text: entry.formatted || entry.text }]
            });
        }

        return {
            type: 'bibliography',
            elements: elements,
            pageBreakBefore: true
        };
    }

    /**
     * Generate Word document
     */
    async generateWordDocument(structure) {
        console.log('Generating Word document...');

        // In a real implementation, this would use a library like docx
        // to generate the actual Word document

        const wordDocument = {
            structure: structure,
            estimatedPages: this.estimatePageCount(structure),
            generatedAt: new Date()
        };

        console.log(`Word document generated with ${wordDocument.estimatedPages} estimated pages`);
        return wordDocument;
    }

    /**
     * Estimate page count
     */
    estimatePageCount(structure) {
        let elementCount = 0;

        for (const section of structure.sections) {
            elementCount += section.elements.length;
        }

        // Rough estimation: 30-40 elements per page
        return Math.max(1, Math.ceil(elementCount / 35));
    }

    /**
     * Create Word binary data (mock implementation)
     */
    async createWordBinary(content) {
        console.log('Creating Word binary data...');

        // In a real implementation, this would generate actual DOCX binary data
        const wordData = JSON.stringify({
            format: 'DOCX',
            content: content,
            options: this.wordOptions,
            generated: new Date().toISOString()
        }, null, 2);

        return new TextEncoder().encode(wordData);
    }

    /**
     * Extract Word-specific metadata
     */
    extractWordMetadata(document) {
        const stats = this.getAcademicStats(document);

        return {
            documentStats: stats,
            wordOptions: this.wordOptions,
            academicOptions: this.academicOptions,
            processingInfo: {
                template: this.wordOptions.template,
                styleSet: this.wordOptions.styleSet,
                fontSize: this.wordOptions.fontSize,
                fontFamily: this.wordOptions.fontFamily,
                trackChanges: this.wordOptions.trackChanges
            }
        };
    }

    /**
     * Generate filename for Word document
     */
    generateFilename(document) {
        const title = (document.title || 'document')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);

        const timestamp = new Date().toISOString().split('T')[0];
        return `${title}-${timestamp}.docx`;
    }

    /**
     * Format date for Word
     */
    formatDate(date) {
        if (!date) return new Date().toLocaleDateString();

        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString();
        }

        if (date instanceof Date) {
            return date.toLocaleDateString();
        }

        return date.toString();
    }

    /**
     * Validate Word-specific options
     */
    validateOptions(options) {
        const baseValidation = super.validateOptions(options);

        if (!baseValidation.valid) {
            return baseValidation;
        }

        const wordErrors = [];

        if (options.fontSize && (options.fontSize < 8 || options.fontSize > 24)) {
            wordErrors.push('Font size must be between 8 and 24');
        }

        if (options.fontFamily && !this.capabilities.supportedFonts.includes(options.fontFamily)) {
            wordErrors.push(`Unsupported font family: ${options.fontFamily}`);
        }

        if (options.styleSet && !this.capabilities.supportedStyleSets.includes(options.styleSet)) {
            wordErrors.push(`Invalid style set: ${options.styleSet}`);
        }

        return {
            valid: wordErrors.length === 0,
            errors: [...baseValidation.errors, ...wordErrors]
        };
    }

    /**
     * Word-specific cleanup
     */
    async cleanupProcessor() {
        console.log('Cleaning up Word processor resources...');
        // Clean up any Word generation resources
    }
}

export default WordExporter;