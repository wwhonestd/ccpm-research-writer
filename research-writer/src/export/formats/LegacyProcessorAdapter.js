/**
 * LegacyProcessorAdapter - Adapter to integrate existing export processors
 * Bridges the gap between old export processors and new pluggable architecture
 */

import { BaseExportProcessor } from './BaseExportProcessor.js';
import { EXPORT_FORMATS } from '../types/index.js';

export class LegacyProcessorAdapter extends BaseExportProcessor {
    constructor(format, legacyProcessor, options = {}) {
        super(format, options);

        this.legacyProcessor = legacyProcessor;
        this.legacyInitialized = false;

        // Update capabilities based on legacy processor
        if (legacyProcessor.getCapabilities) {
            this.capabilities = {
                ...this.capabilities,
                ...legacyProcessor.getCapabilities()
            };
        } else {
            // Default capabilities based on format
            this.capabilities = this.getDefaultCapabilities(format);
        }
    }

    /**
     * Get default capabilities for known formats
     */
    getDefaultCapabilities(format) {
        const defaults = {
            [EXPORT_FORMATS.PDF]: {
                format: EXPORT_FORMATS.PDF,
                supportedFeatures: ['figures', 'tables', 'citations', 'toc', 'headers', 'footers'],
                requiredOptions: [],
                optionalOptions: [
                    'pageSize', 'margins', 'fontSize', 'fontFamily', 'includeTOC',
                    'includeHeaders', 'includeFooters', 'includeTitlePage'
                ],
                outputType: 'binary',
                maxContentLength: 1000000
            },
            [EXPORT_FORMATS.DOCX]: {
                format: EXPORT_FORMATS.DOCX,
                supportedFeatures: ['figures', 'tables', 'citations', 'toc', 'styles'],
                requiredOptions: [],
                optionalOptions: [
                    'pageSize', 'fontSize', 'fontFamily', 'includeTOC',
                    'includeStyles', 'template', 'trackChanges'
                ],
                outputType: 'binary',
                maxContentLength: 1000000
            },
            [EXPORT_FORMATS.LATEX]: {
                format: EXPORT_FORMATS.LATEX,
                supportedFeatures: ['figures', 'tables', 'citations', 'math', 'packages'],
                requiredOptions: [],
                optionalOptions: [
                    'documentClass', 'packages', 'bibliography', 'citationStyle'
                ],
                outputType: 'text',
                maxContentLength: 1000000
            }
        };

        return defaults[format] || {
            format,
            supportedFeatures: [],
            requiredOptions: [],
            optionalOptions: [],
            outputType: 'binary',
            maxContentLength: 1000000
        };
    }

    /**
     * Initialize legacy processor
     */
    async initializeProcessor() {
        if (!this.legacyProcessor) {
            throw new Error('Legacy processor not provided');
        }

        try {
            if (this.legacyProcessor.init && !this.legacyInitialized) {
                await this.legacyProcessor.init();
                this.legacyInitialized = true;
                console.log(`Legacy ${this.format} processor initialized`);
            }
        } catch (error) {
            console.error(`Legacy ${this.format} processor initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Process document using legacy processor
     */
    async processDocument(document, options) {
        if (!this.legacyProcessor) {
            throw new Error('Legacy processor not available');
        }

        try {
            // Prepare document in legacy format
            const legacyDocument = this.prepareLegacyDocument(document, options);

            // Call legacy processor
            const result = await this.legacyProcessor.process(legacyDocument, options);

            // Transform result to new format
            return this.transformLegacyResult(result, document, options);

        } catch (error) {
            console.error(`Legacy ${this.format} processor failed:`, error);
            throw new Error(`Legacy processor error: ${error.message}`);
        }
    }

    /**
     * Prepare document in format expected by legacy processor
     */
    prepareLegacyDocument(document, options) {
        // Most legacy processors expect the document as-is
        // But we can add integration data if needed
        const legacyDocument = { ...document };

        // Add compilation context for compatibility
        if (options.includeCitations !== false && document.citations) {
            legacyDocument.bibliography = {
                entries: document.citations.map(citation => ({
                    id: citation,
                    citation: citation
                }))
            };
        }

        // Add research integration data if available
        if (options.includeResearch !== false && document.research) {
            legacyDocument.research = document.research;
        }

        return legacyDocument;
    }

    /**
     * Transform legacy processor result to new format
     */
    transformLegacyResult(legacyResult, document, options) {
        if (!legacyResult) {
            throw new Error('Legacy processor returned null result');
        }

        // Handle different legacy result formats
        let transformedResult;

        if (typeof legacyResult === 'object' && legacyResult.data) {
            // Modern legacy format with structured result
            transformedResult = {
                success: true,
                data: legacyResult.data,
                filename: legacyResult.filename,
                mimeType: legacyResult.mimeType,
                metadata: legacyResult.metadata || {}
            };
        } else if (Buffer.isBuffer(legacyResult) || legacyResult instanceof Uint8Array) {
            // Raw binary data
            transformedResult = {
                success: true,
                data: legacyResult,
                filename: this.generateFilename(document),
                mimeType: this.getMimeType(),
                metadata: {
                    size: legacyResult.length,
                    format: this.format
                }
            };
        } else if (typeof legacyResult === 'string') {
            // Text data
            const buffer = Buffer.from(legacyResult, 'utf8');
            transformedResult = {
                success: true,
                data: buffer,
                filename: this.generateFilename(document),
                mimeType: this.getMimeType(),
                metadata: {
                    size: buffer.length,
                    format: this.format,
                    encoding: 'utf8'
                }
            };
        } else {
            throw new Error('Unrecognized legacy processor result format');
        }

        // Validate result
        if (!transformedResult.data) {
            throw new Error('Legacy processor did not return data');
        }

        return transformedResult;
    }

    /**
     * Generate filename for legacy result
     */
    generateFilename(document) {
        const title = (document.title || 'document')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const timestamp = new Date().toISOString().split('T')[0];
        const extension = this.getFileExtension();

        return `${title}-${timestamp}.${extension}`;
    }

    /**
     * Get MIME type for format
     */
    getMimeType() {
        const mimeTypes = {
            [EXPORT_FORMATS.PDF]: 'application/pdf',
            [EXPORT_FORMATS.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            [EXPORT_FORMATS.LATEX]: 'text/x-latex',
            [EXPORT_FORMATS.HTML]: 'text/html',
            [EXPORT_FORMATS.MARKDOWN]: 'text/markdown'
        };

        return mimeTypes[this.format] || 'application/octet-stream';
    }

    /**
     * Get file extension for format
     */
    getFileExtension() {
        const extensions = {
            [EXPORT_FORMATS.PDF]: 'pdf',
            [EXPORT_FORMATS.DOCX]: 'docx',
            [EXPORT_FORMATS.LATEX]: 'tex',
            [EXPORT_FORMATS.HTML]: 'html',
            [EXPORT_FORMATS.MARKDOWN]: 'md'
        };

        return extensions[this.format] || this.format;
    }

    /**
     * Validate options specific to legacy processor
     */
    validateOptions(options) {
        const baseValidation = super.validateOptions(options);

        if (!baseValidation.valid) {
            return baseValidation;
        }

        const errors = [];

        // Validate legacy processor specific options if method exists
        if (this.legacyProcessor.validateOptions) {
            try {
                const legacyValidation = this.legacyProcessor.validateOptions(options);
                if (legacyValidation && !legacyValidation.valid) {
                    errors.push(...legacyValidation.errors);
                }
            } catch (error) {
                console.warn(`Legacy processor validation failed: ${error.message}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Cancel processing if legacy processor supports it
     */
    async cancelProcessing(jobId) {
        if (this.legacyProcessor.cancelExport) {
            try {
                return await this.legacyProcessor.cancelExport(jobId);
            } catch (error) {
                console.warn(`Legacy processor cancellation failed: ${error.message}`);
                return false;
            }
        }
        return false;
    }

    /**
     * Get context requirements from legacy processor
     */
    async getContextRequirements(options) {
        if (this.legacyProcessor.getContextRequirements) {
            try {
                return await this.legacyProcessor.getContextRequirements(options);
            } catch (error) {
                console.warn(`Legacy processor context requirements failed: ${error.message}`);
            }
        }

        return {
            requiredFields: ['title', 'content'],
            optionalFields: ['author', 'abstract', 'keywords', 'sections', 'bibliography'],
            supportedOptions: this.capabilities.optionalOptions,
            outputFormat: this.capabilities.outputType,
            maxContentLength: this.capabilities.maxContentLength
        };
    }

    /**
     * Get processor statistics including legacy processor stats
     */
    getStats() {
        const baseStats = super.getStats();

        // Add legacy processor stats if available
        if (this.legacyProcessor.getStats) {
            try {
                baseStats.legacyProcessor = this.legacyProcessor.getStats();
            } catch (error) {
                console.warn(`Legacy processor stats failed: ${error.message}`);
            }
        }

        return {
            ...baseStats,
            isLegacyAdapter: true,
            legacyProcessorType: this.legacyProcessor.constructor.name,
            legacyInitialized: this.legacyInitialized
        };
    }

    /**
     * Cleanup including legacy processor
     */
    async cleanupProcessor() {
        if (this.legacyProcessor && this.legacyProcessor.destroy) {
            try {
                await this.legacyProcessor.destroy();
                console.log(`Legacy ${this.format} processor destroyed`);
            } catch (error) {
                console.warn(`Legacy processor cleanup failed: ${error.message}`);
            }
        }

        this.legacyInitialized = false;
    }
}

/**
 * Factory function to create legacy processor adapters
 */
export function createLegacyAdapter(format, legacyProcessorClass, options = {}) {
    const legacyProcessor = new legacyProcessorClass(options);
    return new LegacyProcessorAdapter(format, legacyProcessor, options);
}

/**
 * Auto-detect and create adapters for existing processors
 */
export async function createLegacyAdapters(options = {}) {
    const adapters = new Map();

    const processorConfigs = [
        {
            format: EXPORT_FORMATS.PDF,
            modulePath: '../../../js/modules/export/processors/PDFExportProcessor.js',
            className: 'PDFExportProcessor'
        },
        {
            format: EXPORT_FORMATS.DOCX,
            modulePath: '../../../js/modules/export/processors/DOCXExportProcessor.js',
            className: 'DOCXExportProcessor'
        },
        {
            format: EXPORT_FORMATS.LATEX,
            modulePath: '../../../js/modules/export/processors/LaTeXExportProcessor.js',
            className: 'LaTeXExportProcessor'
        }
    ];

    for (const config of processorConfigs) {
        try {
            const module = await import(config.modulePath);
            const ProcessorClass = module[config.className] || module.default;

            if (ProcessorClass) {
                const adapter = createLegacyAdapter(config.format, ProcessorClass, options);
                adapters.set(config.format, adapter);
                console.log(`Created legacy adapter for ${config.format}`);
            } else {
                console.warn(`Could not find ${config.className} in ${config.modulePath}`);
            }
        } catch (error) {
            console.warn(`Failed to create legacy adapter for ${config.format}: ${error.message}`);
        }
    }

    return adapters;
}

export default LegacyProcessorAdapter;