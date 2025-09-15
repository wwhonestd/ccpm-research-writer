/**
 * BaseExportProcessor - Abstract base class for format-specific processors
 * Provides common functionality and interface for all export processors
 */

import { IExportProcessor, EXPORT_STATUS } from '../types/index.js';
import { DocumentUtils, ContentUtils, FormatUtils, PerformanceUtils } from '../utils/index.js';

export class BaseExportProcessor extends IExportProcessor {
    constructor(format, options = {}) {
        super();

        this.format = format;
        this.options = {
            timeout: options.timeout || 30000,
            maxContentLength: options.maxContentLength || 1000000,
            enableMetrics: options.enableMetrics !== false,
            enableCaching: options.enableCaching !== false,
            cacheExpiry: options.cacheExpiry || 5 * 60 * 1000, // 5 minutes
            ...options
        };

        // Processing state
        this.isInitialized = false;
        this.activeJobs = new Map();

        // Performance monitoring
        this.performanceMonitor = PerformanceUtils.createMonitor(`${format}_processor`);

        // Caching
        this.cache = new Map();
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            evictions: 0
        };

        // Capabilities (to be overridden by subclasses)
        this.capabilities = {
            format: this.format,
            supportedFeatures: [],
            requiredOptions: [],
            optionalOptions: [],
            outputType: 'binary',
            maxContentLength: this.options.maxContentLength
        };
    }

    /**
     * Initialize processor (override in subclasses)
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Subclass-specific initialization
            await this.initializeProcessor();

            // Start cache cleanup timer
            if (this.options.enableCaching) {
                this.startCacheCleanup();
            }

            this.isInitialized = true;
            console.log(`${this.format} processor initialized`);

        } catch (error) {
            console.error(`${this.format} processor initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Override this method in subclasses for specific initialization
     */
    async initializeProcessor() {
        // Default implementation - no specific initialization needed
    }

    /**
     * Process document export with common pipeline
     */
    async process(document, options = {}) {
        const timer = PerformanceUtils.createTimer();
        const jobId = this.generateJobId();

        try {
            // Validate inputs
            this.validateInputs(document, options);

            // Check cache if enabled
            if (this.options.enableCaching) {
                const cached = this.checkCache(document, options);
                if (cached) {
                    this.cacheMetrics.hits++;
                    console.log(`Cache hit for ${this.format} export`);
                    return cached;
                }
                this.cacheMetrics.misses++;
            }

            // Track active job
            this.activeJobs.set(jobId, {
                document,
                options,
                startTime: Date.now(),
                status: EXPORT_STATUS.PROCESSING
            });

            console.log(`Starting ${this.format} export (job: ${jobId})`);

            // Pre-process document
            const processedDocument = await this.preprocessDocument(document, options);

            // Format-specific processing (implemented by subclasses)
            const result = await this.processDocument(processedDocument, options);

            // Post-process result
            const finalResult = await this.postprocessResult(result, processedDocument, options);

            // Cache result if enabled
            if (this.options.enableCaching && finalResult.success) {
                this.cacheResult(document, options, finalResult);
            }

            // Update metrics
            const elapsed = timer.stop();
            this.performanceMonitor.record(elapsed);

            // Clean up
            this.activeJobs.delete(jobId);

            console.log(`${this.format} export completed (job: ${jobId}) in ${elapsed.toFixed(2)}ms`);

            return {
                ...finalResult,
                processingTime: elapsed,
                jobId
            };

        } catch (error) {
            const elapsed = timer.elapsed();
            this.performanceMonitor.record(elapsed, true);
            this.activeJobs.delete(jobId);

            console.error(`${this.format} export failed (job: ${jobId}):`, error);
            throw error;
        }
    }

    /**
     * Override this method in subclasses for format-specific processing
     */
    async processDocument(document, options) {
        throw new Error(`processDocument() must be implemented by ${this.format} processor`);
    }

    /**
     * Pre-process document before format-specific processing
     */
    async preprocessDocument(document, options) {
        // Normalize document structure
        const normalized = DocumentUtils.normalizeDocument(document);

        // Extract and process content
        for (const section of normalized.sections) {
            // Clean content
            section.content = ContentUtils.cleanContent(section.content);

            // Extract embedded elements
            if (!section.figures || section.figures.length === 0) {
                section.figures = ContentUtils.extractFigures(section.content);
            }

            if (!section.tables || section.tables.length === 0) {
                section.tables = ContentUtils.extractTables(section.content);
            }

            // Process citations if not already done
            if (options.includeCitations !== false && (!normalized.citations || normalized.citations.length === 0)) {
                const citations = ContentUtils.extractCitations(section.content);
                normalized.citations = [...(normalized.citations || []), ...citations];
            }
        }

        // Remove duplicate citations
        if (normalized.citations) {
            normalized.citations = [...new Set(normalized.citations)];
        }

        return normalized;
    }

    /**
     * Post-process export result
     */
    async postprocessResult(result, document, options) {
        // Ensure result has required fields
        const finalResult = {
            success: true,
            data: null,
            filename: null,
            mimeType: null,
            metadata: {},
            ...result
        };

        // Generate filename if not provided
        if (!finalResult.filename) {
            const requirements = FormatUtils.getFormatRequirements(this.format);
            const extension = requirements?.fileExtension || this.format;
            finalResult.filename = `${document.title || 'document'}.${extension}`;
        }

        // Set MIME type if not provided
        if (!finalResult.mimeType) {
            const requirements = FormatUtils.getFormatRequirements(this.format);
            finalResult.mimeType = requirements?.mimeType || 'application/octet-stream';
        }

        // Add metadata
        finalResult.metadata = {
            format: this.format,
            processor: this.constructor.name,
            documentMetadata: DocumentUtils.extractMetadata(document),
            processingOptions: this.sanitizeOptions(options),
            ...finalResult.metadata
        };

        return finalResult;
    }

    /**
     * Validate processor inputs
     */
    validateInputs(document, options) {
        // Validate document
        const docValidation = DocumentUtils.validateStructure(document);
        if (!docValidation.valid) {
            throw new Error(`Document validation failed: ${docValidation.errors.join(', ')}`);
        }

        // Validate processor compatibility
        const compatibility = FormatUtils.validateFormatCompatibility(document, this.format);
        if (!compatibility.compatible) {
            console.warn(`Format compatibility warnings: ${compatibility.errors.join(', ')}`);
        }

        // Validate options
        const optionValidation = this.validateOptions(options);
        if (!optionValidation.valid) {
            throw new Error(`Options validation failed: ${optionValidation.errors.join(', ')}`);
        }

        // Check document size
        const metadata = DocumentUtils.extractMetadata(document);
        if (metadata.wordCount * 6 > this.options.maxContentLength) { // ~6 bytes per word
            throw new Error(`Document too large for processing: ${metadata.wordCount} words`);
        }
    }

    /**
     * Validate export options (override in subclasses for specific validation)
     */
    validateOptions(options) {
        const errors = [];

        // Check required options
        for (const required of this.capabilities.requiredOptions) {
            if (!options.hasOwnProperty(required)) {
                errors.push(`Missing required option: ${required}`);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Get processor capabilities
     */
    getCapabilities() {
        return { ...this.capabilities };
    }

    /**
     * Cancel export job
     */
    async cancelExport(jobId) {
        if (this.activeJobs.has(jobId)) {
            const job = this.activeJobs.get(jobId);
            job.status = EXPORT_STATUS.CANCELLED;

            // Subclasses can override this for specific cancellation logic
            const cancelled = await this.cancelProcessing(jobId);

            if (cancelled) {
                this.activeJobs.delete(jobId);
                console.log(`${this.format} export cancelled: ${jobId}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Override in subclasses for specific cancellation logic
     */
    async cancelProcessing(jobId) {
        return false; // Default: cancellation not supported
    }

    /**
     * Cache management
     */
    checkCache(document, options) {
        if (!this.options.enableCaching) {
            return null;
        }

        const cacheKey = this.generateCacheKey(document, options);
        const cached = this.cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < this.options.cacheExpiry) {
            return cached.result;
        }

        if (cached) {
            this.cache.delete(cacheKey);
            this.cacheMetrics.evictions++;
        }

        return null;
    }

    cacheResult(document, options, result) {
        if (!this.options.enableCaching) {
            return;
        }

        const cacheKey = this.generateCacheKey(document, options);
        this.cache.set(cacheKey, {
            result: { ...result },
            timestamp: Date.now()
        });
    }

    generateCacheKey(document, options) {
        const key = {
            documentId: document.id || document.title,
            documentHash: this.hashContent(document),
            options: this.sanitizeOptions(options)
        };
        return JSON.stringify(key);
    }

    hashContent(document) {
        // Simple content hash
        const content = JSON.stringify({
            title: document.title,
            sections: document.sections?.map(s => ({
                title: s.title,
                content: s.content?.substring(0, 100) // First 100 chars
            }))
        });

        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Start cache cleanup timer
     */
    startCacheCleanup() {
        this.cacheCleanupTimer = setInterval(() => {
            this.cleanupCache();
        }, this.options.cacheExpiry / 2); // Cleanup twice per expiry period
    }

    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if ((now - entry.timestamp) >= this.options.cacheExpiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.cacheMetrics.evictions += cleaned;
            console.log(`${this.format} processor: cleaned ${cleaned} expired cache entries`);
        }
    }

    /**
     * Get processor statistics
     */
    getStats() {
        return {
            format: this.format,
            isInitialized: this.isInitialized,
            activeJobs: this.activeJobs.size,
            capabilities: this.capabilities,
            performance: this.performanceMonitor.getStats(),
            cache: {
                enabled: this.options.enableCaching,
                size: this.cache.size,
                metrics: this.cacheMetrics,
                hitRate: this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses) || 0
            }
        };
    }

    /**
     * Cleanup processor resources
     */
    async destroy() {
        console.log(`Shutting down ${this.format} processor...`);

        // Cancel active jobs
        for (const jobId of this.activeJobs.keys()) {
            await this.cancelExport(jobId);
        }

        // Stop timers
        if (this.cacheCleanupTimer) {
            clearInterval(this.cacheCleanupTimer);
            this.cacheCleanupTimer = null;
        }

        // Clear caches
        this.cache.clear();

        // Subclass-specific cleanup
        await this.cleanupProcessor();

        this.isInitialized = false;
        console.log(`${this.format} processor shut down`);
    }

    /**
     * Override in subclasses for specific cleanup
     */
    async cleanupProcessor() {
        // Default implementation - no specific cleanup needed
    }

    // Utility methods
    generateJobId() {
        return `${this.format}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    sanitizeOptions(options) {
        const sanitized = { ...options };
        // Remove non-serializable options
        delete sanitized.callbacks;
        delete sanitized.streams;
        delete sanitized.tempDir;
        return sanitized;
    }
}

export default BaseExportProcessor;