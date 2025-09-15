/**
 * Export System Types and Interfaces
 * Defines the core types, interfaces, and schemas for the pluggable export system
 */

/**
 * Export formats supported by the system
 */
export const EXPORT_FORMATS = {
    PDF: 'pdf',
    DOCX: 'docx',
    LATEX: 'latex',
    HTML: 'html',
    MARKDOWN: 'markdown'
};

/**
 * Export job statuses
 */
export const EXPORT_STATUS = {
    PENDING: 'pending',
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * Export priority levels
 */
export const EXPORT_PRIORITY = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    URGENT: 3
};

/**
 * Academic citation styles
 */
export const CITATION_STYLES = {
    APA: 'apa',
    MLA: 'mla',
    CHICAGO: 'chicago',
    IEEE: 'ieee',
    HARVARD: 'harvard',
    VANCOUVER: 'vancouver'
};

/**
 * Export job configuration schema
 * @typedef {Object} ExportJobConfig
 * @property {string} id - Unique job identifier
 * @property {string} format - Target export format
 * @property {Object} document - Document data to export
 * @property {Object} options - Format-specific export options
 * @property {number} priority - Job priority level
 * @property {Date} createdAt - Job creation timestamp
 * @property {Date} scheduledAt - Job scheduled execution time
 * @property {number} timeout - Maximum processing time in ms
 * @property {Object} metadata - Additional job metadata
 */

/**
 * Export result schema
 * @typedef {Object} ExportResult
 * @property {boolean} success - Export success status
 * @property {string} jobId - Associated job identifier
 * @property {string} format - Export format used
 * @property {Buffer|Uint8Array} data - Exported file data
 * @property {string} filename - Suggested filename
 * @property {string} mimeType - MIME type of exported data
 * @property {Object} metadata - Export metadata
 * @property {number} processingTime - Time taken to process
 * @property {Date} completedAt - Completion timestamp
 * @property {string} [error] - Error message if failed
 */

/**
 * Document structure schema
 * @typedef {Object} DocumentStructure
 * @property {string} title - Document title
 * @property {string} [author] - Document author
 * @property {Date} [date] - Document date
 * @property {string} [abstract] - Document abstract
 * @property {string[]} [keywords] - Document keywords
 * @property {Section[]} sections - Document sections
 * @property {Citation[]} [citations] - Document citations
 * @property {Bibliography} [bibliography] - Document bibliography
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Document section schema
 * @typedef {Object} Section
 * @property {string} id - Section identifier
 * @property {string} title - Section title
 * @property {number} level - Heading level (1-6)
 * @property {string} content - Section content
 * @property {Section[]} [subsections] - Nested subsections
 * @property {Figure[]} [figures] - Section figures
 * @property {Table[]} [tables] - Section tables
 * @property {boolean} [pageBreakBefore] - Insert page break before
 * @property {boolean} [pageBreakAfter] - Insert page break after
 */

/**
 * Export processor interface
 * All format-specific processors must implement these methods
 */
export class IExportProcessor {
    /**
     * Initialize the processor
     * @returns {Promise<void>}
     */
    async init() {
        throw new Error('init() must be implemented by processor');
    }

    /**
     * Process document export
     * @param {DocumentStructure} document - Document to export
     * @param {Object} options - Export options
     * @returns {Promise<ExportResult>}
     */
    async process(document, options) {
        throw new Error('process() must be implemented by processor');
    }

    /**
     * Get processor capabilities and requirements
     * @returns {Object} Processor capabilities
     */
    getCapabilities() {
        return {
            format: null,
            supportedFeatures: [],
            requiredOptions: [],
            optionalOptions: [],
            outputType: 'binary'
        };
    }

    /**
     * Validate export options
     * @param {Object} options - Options to validate
     * @returns {Object} Validation result
     */
    validateOptions(options) {
        return { valid: true, errors: [] };
    }

    /**
     * Cancel ongoing export (if supported)
     * @param {string} jobId - Job to cancel
     * @returns {Promise<boolean>} Cancellation success
     */
    async cancelExport(jobId) {
        return false; // Not supported by default
    }

    /**
     * Cleanup processor resources
     * @returns {Promise<void>}
     */
    async destroy() {
        // Override in implementations
    }
}

/**
 * Export queue interface
 * Defines methods for job queue management
 */
export class IExportQueue {
    /**
     * Add job to queue
     * @param {ExportJobConfig} job - Job to queue
     * @returns {Promise<string>} Job ID
     */
    async enqueue(job) {
        throw new Error('enqueue() must be implemented');
    }

    /**
     * Get next job from queue
     * @returns {Promise<ExportJobConfig|null>}
     */
    async dequeue() {
        throw new Error('dequeue() must be implemented');
    }

    /**
     * Get job status
     * @param {string} jobId - Job identifier
     * @returns {Promise<Object>}
     */
    async getJobStatus(jobId) {
        throw new Error('getJobStatus() must be implemented');
    }

    /**
     * Cancel queued job
     * @param {string} jobId - Job to cancel
     * @returns {Promise<boolean>}
     */
    async cancelJob(jobId) {
        throw new Error('cancelJob() must be implemented');
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        throw new Error('getStats() must be implemented');
    }

    /**
     * Clear queue
     * @returns {Promise<void>}
     */
    async clear() {
        throw new Error('clear() must be implemented');
    }
}

/**
 * Export engine interface
 * Main engine orchestrating exports
 */
export class IExportEngine {
    /**
     * Initialize export engine
     * @returns {Promise<void>}
     */
    async init() {
        throw new Error('init() must be implemented');
    }

    /**
     * Register export processor
     * @param {string} format - Format identifier
     * @param {IExportProcessor} processor - Processor instance
     * @returns {Promise<void>}
     */
    async registerProcessor(format, processor) {
        throw new Error('registerProcessor() must be implemented');
    }

    /**
     * Export document
     * @param {DocumentStructure} document - Document to export
     * @param {string} format - Target format
     * @param {Object} options - Export options
     * @returns {Promise<ExportResult>}
     */
    async exportDocument(document, format, options) {
        throw new Error('exportDocument() must be implemented');
    }

    /**
     * Get supported formats
     * @returns {string[]}
     */
    getSupportedFormats() {
        throw new Error('getSupportedFormats() must be implemented');
    }

    /**
     * Get engine statistics
     * @returns {Object}
     */
    getStats() {
        throw new Error('getStats() must be implemented');
    }

    /**
     * Shutdown engine
     * @returns {Promise<void>}
     */
    async shutdown() {
        throw new Error('shutdown() must be implemented');
    }
}

/**
 * Validation schemas
 */
export const ValidationSchemas = {
    /**
     * Validate document structure
     * @param {Object} document - Document to validate
     * @returns {Object} Validation result
     */
    validateDocument(document) {
        const errors = [];

        if (!document) {
            errors.push('Document is required');
            return { valid: false, errors };
        }

        if (!document.title || typeof document.title !== 'string') {
            errors.push('Document title is required and must be a string');
        }

        if (!document.sections || !Array.isArray(document.sections)) {
            errors.push('Document must have sections array');
        } else {
            document.sections.forEach((section, index) => {
                if (!section.id || typeof section.id !== 'string') {
                    errors.push(`Section ${index} must have a valid ID`);
                }
                if (!section.title || typeof section.title !== 'string') {
                    errors.push(`Section ${index} must have a valid title`);
                }
                if (!section.content || typeof section.content !== 'string') {
                    errors.push(`Section ${index} must have content`);
                }
            });
        }

        return { valid: errors.length === 0, errors };
    },

    /**
     * Validate export options
     * @param {Object} options - Options to validate
     * @param {string} format - Target format
     * @returns {Object} Validation result
     */
    validateExportOptions(options, format) {
        const errors = [];

        if (!options || typeof options !== 'object') {
            return { valid: true, errors: [] }; // Options are optional
        }

        // Format-specific validation
        switch (format) {
            case EXPORT_FORMATS.PDF:
                if (options.pageSize && !['A4', 'A3', 'Letter', 'Legal'].includes(options.pageSize)) {
                    errors.push('Invalid PDF page size');
                }
                break;
            case EXPORT_FORMATS.DOCX:
                if (options.fontSize && (options.fontSize < 8 || options.fontSize > 72)) {
                    errors.push('DOCX font size must be between 8 and 72');
                }
                break;
            case EXPORT_FORMATS.LATEX:
                if (options.documentClass && !['article', 'report', 'book'].includes(options.documentClass)) {
                    errors.push('Invalid LaTeX document class');
                }
                break;
        }

        return { valid: errors.length === 0, errors };
    }
};

/**
 * Utility functions for export system
 */
export const ExportUtils = {
    /**
     * Generate unique job ID
     * @returns {string}
     */
    generateJobId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Generate filename from document
     * @param {DocumentStructure} document - Document
     * @param {string} format - Export format
     * @returns {string}
     */
    generateFilename(document, format) {
        const title = (document.title || 'document')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const timestamp = new Date().toISOString().split('T')[0];
        return `${title}-${timestamp}.${format}`;
    },

    /**
     * Get MIME type for format
     * @param {string} format - Export format
     * @returns {string}
     */
    getMimeType(format) {
        const mimeTypes = {
            [EXPORT_FORMATS.PDF]: 'application/pdf',
            [EXPORT_FORMATS.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            [EXPORT_FORMATS.LATEX]: 'text/x-latex',
            [EXPORT_FORMATS.HTML]: 'text/html',
            [EXPORT_FORMATS.MARKDOWN]: 'text/markdown'
        };
        return mimeTypes[format] || 'application/octet-stream';
    },

    /**
     * Estimate processing time based on document size and format
     * @param {DocumentStructure} document - Document
     * @param {string} format - Export format
     * @returns {number} Estimated time in milliseconds
     */
    estimateProcessingTime(document, format) {
        let contentLength = 0;

        if (document.sections) {
            contentLength = document.sections.reduce((total, section) =>
                total + (section.content ? section.content.length : 0), 0);
        }

        // Base time estimates (per 1000 characters)
        const formatMultipliers = {
            [EXPORT_FORMATS.PDF]: 100,
            [EXPORT_FORMATS.DOCX]: 80,
            [EXPORT_FORMATS.LATEX]: 60,
            [EXPORT_FORMATS.HTML]: 40,
            [EXPORT_FORMATS.MARKDOWN]: 20
        };

        const multiplier = formatMultipliers[format] || 50;
        return Math.max(1000, (contentLength / 1000) * multiplier);
    },

    /**
     * Calculate priority score
     * @param {ExportJobConfig} job - Export job
     * @returns {number}
     */
    calculatePriorityScore(job) {
        let score = job.priority || EXPORT_PRIORITY.NORMAL;

        // Adjust for scheduling
        if (job.scheduledAt && job.scheduledAt <= new Date()) {
            score += 1;
        }

        // Adjust for timeout urgency
        if (job.timeout && job.timeout < 30000) {
            score += 0.5;
        }

        return score;
    }
};

export default {
    EXPORT_FORMATS,
    EXPORT_STATUS,
    EXPORT_PRIORITY,
    CITATION_STYLES,
    IExportProcessor,
    IExportQueue,
    IExportEngine,
    ValidationSchemas,
    ExportUtils
};