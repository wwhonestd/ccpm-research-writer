/**
 * ExportManager - Multi-format document export system
 * Orchestrates the export pipeline for PDF, DOCX, LaTeX and other formats
 * Integrates with citation and research modules for comprehensive document generation
 */

import { PDFExportProcessor } from './processors/PDFExportProcessor.js';
import { DOCXExportProcessor } from './processors/DOCXExportProcessor.js';
import { LaTeXExportProcessor } from './processors/LaTeXExportProcessor.js';
import { DocumentCompiler } from '../../services/compilation/DocumentCompiler.js';
import { CitationIntegration } from '../../integration/citation/CitationIntegration.js';
import { ResearchIntegration } from '../../integration/research/ResearchIntegration.js';

export class ExportManager {
    constructor(options = {}) {
        this.options = {
            tempDir: options.tempDir || '/tmp/research-writer',
            maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
            timeout: options.timeout || 30000, // 30 seconds
            enableCache: options.enableCache !== false,
            ...options
        };

        // Initialize processors
        this.processors = new Map();
        this.processors.set('pdf', new PDFExportProcessor(this.options));
        this.processors.set('docx', new DOCXExportProcessor(this.options));
        this.processors.set('latex', new LaTeXExportProcessor(this.options));

        // Initialize services
        this.compiler = new DocumentCompiler(this.options);
        this.citationIntegration = new CitationIntegration();
        this.researchIntegration = new ResearchIntegration();

        // Export queue for batch processing
        this.exportQueue = [];
        this.isProcessing = false;

        // Cache for compiled documents
        this.compilationCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

        this.init();
    }

    async init() {
        try {
            // Initialize all processors
            for (const [format, processor] of this.processors) {
                await processor.init();
                console.log(`${format.toUpperCase()} processor initialized`);
            }

            // Initialize compiler
            await this.compiler.init();
            console.log('Document compiler initialized');

            // Initialize integration modules
            await this.citationIntegration.init();
            await this.researchIntegration.init();
            console.log('Integration modules initialized');

            console.log('ExportManager initialized successfully');
        } catch (error) {
            console.error('ExportManager initialization failed:', error);
            throw new Error(`Export system initialization failed: ${error.message}`);
        }
    }

    /**
     * Export document to specified format
     * @param {Object} document - Document data to export
     * @param {string} format - Export format (pdf, docx, latex)
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Export result with file data or download link
     */
    async exportDocument(document, format, options = {}) {
        const exportId = this.generateExportId();
        
        try {
            // Validate inputs
            this.validateExportRequest(document, format);

            // Prepare export context
            const context = await this.prepareExportContext(document, format, options);

            // Add to processing queue if batch mode enabled
            if (options.batch) {
                return this.queueExport({ exportId, document, format, options, context });
            }

            // Process export immediately
            return await this.processExport(exportId, document, format, options, context);

        } catch (error) {
            console.error(`Export failed for format ${format}:`, error);
            return {
                success: false,
                exportId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process export request
     */
    async processExport(exportId, document, format, options, context) {
        const startTime = Date.now();
        
        try {
            console.log(`Starting export ${exportId} to ${format}`);

            // Check cache if enabled
            const cacheKey = this.generateCacheKey(document, format, options);
            if (this.options.enableCache && this.compilationCache.has(cacheKey)) {
                const cached = this.compilationCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheExpiry) {
                    console.log(`Using cached result for export ${exportId}`);
                    return {
                        ...cached.result,
                        exportId,
                        cached: true,
                        processingTime: Date.now() - startTime
                    };
                }
            }

            // Step 1: Compile document with integrations
            const compiledDocument = await this.compiler.compile(document, context);

            // Step 2: Process with format-specific processor
            const processor = this.processors.get(format);
            if (!processor) {
                throw new Error(`Unsupported export format: ${format}`);
            }

            const exportResult = await processor.process(compiledDocument, options);

            // Step 3: Post-process and finalize
            const finalResult = await this.finalizeExport(exportResult, format, options);

            // Cache result if enabled
            if (this.options.enableCache) {
                this.compilationCache.set(cacheKey, {
                    result: finalResult,
                    timestamp: Date.now()
                });
            }

            console.log(`Export ${exportId} completed successfully in ${Date.now() - startTime}ms`);

            return {
                success: true,
                exportId,
                format,
                ...finalResult,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Export processing failed for ${exportId}:`, error);
            throw error;
        }
    }

    /**
     * Prepare export context with integrated data
     */
    async prepareExportContext(document, format, options) {
        const context = {
            document,
            format,
            options,
            metadata: {
                exportId: this.generateExportId(),
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        try {
            // Integrate citations
            if (options.includeCitations !== false) {
                context.citations = await this.citationIntegration.getCitationsForDocument(document);
                context.bibliography = await this.citationIntegration.generateBibliography(
                    context.citations, 
                    options.citationStyle || 'apa'
                );
            }

            // Integrate research data
            if (options.includeResearch !== false) {
                context.research = await this.researchIntegration.getResearchDataForDocument(document);
                context.notes = await this.researchIntegration.getNotesForDocument(document);
            }

            // Add format-specific context
            context.formatContext = await this.getFormatSpecificContext(format, options);

            return context;
        } catch (error) {
            console.error('Failed to prepare export context:', error);
            // Continue with basic context on integration failure
            return context;
        }
    }

    /**
     * Get format-specific context and settings
     */
    async getFormatSpecificContext(format, options) {
        const processor = this.processors.get(format);
        if (processor && processor.getContextRequirements) {
            return await processor.getContextRequirements(options);
        }
        return {};
    }

    /**
     * Finalize export with post-processing
     */
    async finalizeExport(exportResult, format, options) {
        const finalized = { ...exportResult };

        // Add metadata
        finalized.metadata = {
            format,
            fileSize: exportResult.data ? exportResult.data.length : 0,
            generatedAt: new Date().toISOString(),
            options: this.sanitizeOptions(options)
        };

        // Validate file size
        if (finalized.metadata.fileSize > this.options.maxFileSize) {
            throw new Error(`Export file size exceeds limit: ${finalized.metadata.fileSize} bytes`);
        }

        // Generate download link if requested
        if (options.generateDownloadLink) {
            finalized.downloadLink = await this.generateDownloadLink(exportResult.data, format);
        }

        // Generate preview if supported and requested
        if (options.generatePreview && this.supportsPreview(format)) {
            finalized.preview = await this.generatePreview(exportResult.data, format);
        }

        return finalized;
    }

    /**
     * Queue export for batch processing
     */
    async queueExport(exportRequest) {
        this.exportQueue.push(exportRequest);
        
        if (!this.isProcessing) {
            this.processQueue();
        }

        return {
            success: true,
            exportId: exportRequest.exportId,
            queued: true,
            queuePosition: this.exportQueue.length,
            estimatedWait: this.exportQueue.length * 5000 // Rough estimate
        };
    }

    /**
     * Process export queue
     */
    async processQueue() {
        if (this.isProcessing || this.exportQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`Processing export queue with ${this.exportQueue.length} items`);

        while (this.exportQueue.length > 0) {
            const request = this.exportQueue.shift();
            
            try {
                const result = await this.processExport(
                    request.exportId,
                    request.document,
                    request.format,
                    request.options,
                    request.context
                );
                
                // Emit result event
                this.emit('exportComplete', { ...result });
                
            } catch (error) {
                console.error(`Queued export ${request.exportId} failed:`, error);
                this.emit('exportError', { 
                    exportId: request.exportId, 
                    error: error.message 
                });
            }
        }

        this.isProcessing = false;
        console.log('Export queue processing completed');
    }

    /**
     * Get supported export formats
     */
    getSupportedFormats() {
        return Array.from(this.processors.keys());
    }

    /**
     * Get export status
     */
    getExportStatus(exportId) {
        // Check if in queue
        const queuePosition = this.exportQueue.findIndex(item => item.exportId === exportId);
        if (queuePosition !== -1) {
            return {
                status: 'queued',
                position: queuePosition + 1,
                estimatedWait: (queuePosition + 1) * 5000
            };
        }

        // Check cache for completed exports
        for (const [key, cached] of this.compilationCache.entries()) {
            if (cached.result.exportId === exportId) {
                return {
                    status: 'completed',
                    result: cached.result
                };
            }
        }

        return { status: 'not_found' };
    }

    /**
     * Cancel export
     */
    async cancelExport(exportId) {
        // Remove from queue
        const queueIndex = this.exportQueue.findIndex(item => item.exportId === exportId);
        if (queueIndex !== -1) {
            this.exportQueue.splice(queueIndex, 1);
            return { success: true, message: 'Export cancelled' };
        }

        // Try to cancel active processing (if supported by processors)
        for (const processor of this.processors.values()) {
            if (processor.cancelExport) {
                const cancelled = await processor.cancelExport(exportId);
                if (cancelled) {
                    return { success: true, message: 'Export cancelled' };
                }
            }
        }

        return { success: false, message: 'Export not found or cannot be cancelled' };
    }

    /**
     * Clear compilation cache
     */
    clearCache() {
        this.compilationCache.clear();
        console.log('Export cache cleared');
    }

    /**
     * Get export statistics
     */
    getStats() {
        return {
            supportedFormats: this.getSupportedFormats(),
            queueLength: this.exportQueue.length,
            cacheSize: this.compilationCache.size,
            isProcessing: this.isProcessing,
            uptime: Date.now() - this.startTime
        };
    }

    // Utility methods
    generateExportId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateCacheKey(document, format, options) {
        const key = {
            documentId: document.id || document.title,
            format,
            options: this.sanitizeOptions(options)
        };
        return JSON.stringify(key);
    }

    sanitizeOptions(options) {
        // Remove sensitive or non-serializable options
        const sanitized = { ...options };
        delete sanitized.callbacks;
        delete sanitized.streams;
        delete sanitized.tempDir;
        return sanitized;
    }

    validateExportRequest(document, format) {
        if (!document) {
            throw new Error('Document is required for export');
        }

        if (!format || !this.processors.has(format)) {
            throw new Error(`Unsupported or missing export format: ${format}`);
        }

        if (!document.content && !document.sections) {
            throw new Error('Document must have content or sections to export');
        }
    }

    async generateDownloadLink(data, format) {
        // In a real implementation, upload to cloud storage or serve statically
        const blob = new Blob([data], { type: this.getMimeType(format) });
        return URL.createObjectURL(blob);
    }

    getMimeType(format) {
        const mimeTypes = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'latex': 'text/x-latex'
        };
        return mimeTypes[format] || 'application/octet-stream';
    }

    supportsPreview(format) {
        return ['pdf'].includes(format);
    }

    async generatePreview(data, format) {
        // Generate preview based on format
        if (format === 'pdf') {
            // Generate thumbnail or extract first page
            return {
                type: 'thumbnail',
                url: await this.generateThumbnail(data)
            };
        }
        return null;
    }

    async generateThumbnail(pdfData) {
        // Placeholder for PDF thumbnail generation
        return 'data:image/png;base64,placeholder';
    }

    // Simple event emitter
    emit(event, data) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners && this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        // Cancel all queued exports
        this.exportQueue = [];
        
        // Clear cache
        this.clearCache();
        
        // Destroy processors
        for (const processor of this.processors.values()) {
            if (processor.destroy) {
                await processor.destroy();
            }
        }
        
        // Destroy compiler
        if (this.compiler.destroy) {
            await this.compiler.destroy();
        }

        console.log('ExportManager destroyed');
    }
}