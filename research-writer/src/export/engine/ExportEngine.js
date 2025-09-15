/**
 * ExportEngine - Core pluggable export orchestration engine
 * Manages format processors, job queues, and export workflows
 */

import {
    IExportEngine,
    EXPORT_STATUS,
    EXPORT_PRIORITY,
    ValidationSchemas,
    ExportUtils
} from '../types/index.js';
import { ExportQueue } from './ExportQueue.js';
import { ExportJob } from './ExportJob.js';

export class ExportEngine extends IExportEngine {
    constructor(options = {}) {
        super();

        this.options = {
            maxConcurrentJobs: options.maxConcurrentJobs || 3,
            defaultTimeout: options.defaultTimeout || 30000,
            enableCache: options.enableCache !== false,
            cacheExpiryMs: options.cacheExpiryMs || 5 * 60 * 1000, // 5 minutes
            enableMetrics: options.enableMetrics !== false,
            maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
            tempDir: options.tempDir || '/tmp/research-writer',
            ...options
        };

        // Core components
        this.processors = new Map();
        this.queue = new ExportQueue(this.options);
        this.activeJobs = new Map();
        this.jobHistory = new Map();

        // Caching system
        this.exportCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;

        // Metrics and monitoring
        this.metrics = {
            totalExports: 0,
            successfulExports: 0,
            failedExports: 0,
            averageProcessingTime: 0,
            processingTimes: [],
            formatCounts: new Map(),
            errorCounts: new Map()
        };

        // Event listeners
        this.listeners = new Map();

        // Engine state
        this.isInitialized = false;
        this.isProcessing = false;
        this.isShuttingDown = false;
        this.startTime = Date.now();

        this.setupProcessingLoop();
    }

    /**
     * Initialize the export engine
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('Initializing ExportEngine...');

            // Initialize queue
            await this.queue.init();

            // Initialize all registered processors
            const initPromises = Array.from(this.processors.values()).map(async processor => {
                try {
                    await processor.init();
                    console.log(`Processor for format ${processor.getCapabilities().format} initialized`);
                } catch (error) {
                    console.error(`Failed to initialize processor:`, error);
                    throw error;
                }
            });

            await Promise.all(initPromises);

            // Start processing loop
            this.startProcessingLoop();

            this.isInitialized = true;
            this.emit('initialized');
            console.log('ExportEngine initialized successfully');

        } catch (error) {
            console.error('ExportEngine initialization failed:', error);
            throw new Error(`Export engine initialization failed: ${error.message}`);
        }
    }

    /**
     * Register format processor
     */
    async registerProcessor(format, processor) {
        if (!format || typeof format !== 'string') {
            throw new Error('Format must be a non-empty string');
        }

        if (!processor || typeof processor.process !== 'function') {
            throw new Error('Processor must implement the IExportProcessor interface');
        }

        // Validate processor capabilities
        const capabilities = processor.getCapabilities();
        if (!capabilities.format) {
            throw new Error('Processor must define its format in capabilities');
        }

        if (capabilities.format !== format) {
            throw new Error(`Processor format ${capabilities.format} does not match registration format ${format}`);
        }

        this.processors.set(format, processor);
        console.log(`Registered processor for format: ${format}`);

        // Initialize if engine is already initialized
        if (this.isInitialized) {
            try {
                await processor.init();
                console.log(`Late-registered processor for ${format} initialized`);
            } catch (error) {
                console.error(`Failed to initialize late-registered processor:`, error);
                this.processors.delete(format);
                throw error;
            }
        }

        this.emit('processorRegistered', { format, processor });
    }

    /**
     * Export document
     */
    async exportDocument(document, format, options = {}) {
        // Generate job ID and validate inputs
        const jobId = ExportUtils.generateJobId();

        try {
            // Validate document
            const documentValidation = ValidationSchemas.validateDocument(document);
            if (!documentValidation.valid) {
                throw new Error(`Document validation failed: ${documentValidation.errors.join(', ')}`);
            }

            // Validate format and processor availability
            if (!this.processors.has(format)) {
                throw new Error(`Unsupported export format: ${format}. Available formats: ${this.getSupportedFormats().join(', ')}`);
            }

            // Validate export options
            const optionsValidation = ValidationSchemas.validateExportOptions(options, format);
            if (!optionsValidation.valid) {
                throw new Error(`Export options validation failed: ${optionsValidation.errors.join(', ')}`);
            }

            // Check cache if enabled
            if (this.options.enableCache) {
                const cacheKey = this.generateCacheKey(document, format, options);
                const cached = this.exportCache.get(cacheKey);

                if (cached && (Date.now() - cached.timestamp) < this.options.cacheExpiryMs) {
                    this.cacheHits++;
                    console.log(`Cache hit for export ${jobId}`);

                    return {
                        ...cached.result,
                        jobId,
                        cached: true,
                        timestamp: new Date().toISOString()
                    };
                }
                this.cacheMisses++;
            }

            // Create export job
            const job = new ExportJob({
                id: jobId,
                format,
                document,
                options,
                priority: options.priority || EXPORT_PRIORITY.NORMAL,
                timeout: options.timeout || this.options.defaultTimeout,
                createdAt: new Date(),
                metadata: {
                    estimatedTime: ExportUtils.estimateProcessingTime(document, format),
                    clientInfo: options.clientInfo || {}
                }
            });

            // Immediate processing or queue
            if (options.immediate && this.activeJobs.size < this.options.maxConcurrentJobs) {
                return await this.processJobImmediate(job);
            } else {
                // Queue the job
                await this.queue.enqueue(job.toConfig());

                return {
                    success: true,
                    jobId,
                    status: EXPORT_STATUS.QUEUED,
                    queuePosition: await this.queue.getQueueSize(),
                    estimatedWait: job.metadata.estimatedTime,
                    message: 'Export job queued successfully'
                };
            }

        } catch (error) {
            this.updateMetrics('failed', format, 0, error.message);
            console.error(`Export failed for job ${jobId}:`, error);

            return {
                success: false,
                jobId,
                status: EXPORT_STATUS.FAILED,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process job immediately (bypass queue)
     */
    async processJobImmediate(job) {
        const startTime = Date.now();

        try {
            // Mark as active
            this.activeJobs.set(job.id, job);
            job.updateStatus(EXPORT_STATUS.PROCESSING);

            this.emit('jobStarted', job.toConfig());

            // Get processor and process
            const processor = this.processors.get(job.format);
            const result = await processor.process(job.document, job.options);

            // Validate result
            if (!result || !result.data) {
                throw new Error('Processor returned invalid result');
            }

            // Check file size
            if (result.data.length > this.options.maxFileSize) {
                throw new Error(`Export file size exceeds limit: ${result.data.length} bytes`);
            }

            const processingTime = Date.now() - startTime;

            // Create final result
            const exportResult = {
                success: true,
                jobId: job.id,
                format: job.format,
                ...result,
                processingTime,
                completedAt: new Date().toISOString(),
                metadata: {
                    ...result.metadata,
                    jobMetadata: job.metadata
                }
            };

            // Cache result if enabled
            if (this.options.enableCache) {
                const cacheKey = this.generateCacheKey(job.document, job.format, job.options);
                this.exportCache.set(cacheKey, {
                    result: exportResult,
                    timestamp: Date.now()
                });
            }

            // Update metrics and cleanup
            this.updateMetrics('success', job.format, processingTime);
            job.updateStatus(EXPORT_STATUS.COMPLETED);
            this.activeJobs.delete(job.id);
            this.jobHistory.set(job.id, job);

            this.emit('jobCompleted', { job: job.toConfig(), result: exportResult });

            console.log(`Export ${job.id} completed successfully in ${processingTime}ms`);
            return exportResult;

        } catch (error) {
            const processingTime = Date.now() - startTime;

            // Handle failure
            job.updateStatus(EXPORT_STATUS.FAILED);
            job.error = error.message;

            this.updateMetrics('failed', job.format, processingTime, error.message);
            this.activeJobs.delete(job.id);
            this.jobHistory.set(job.id, job);

            this.emit('jobFailed', { job: job.toConfig(), error: error.message });

            console.error(`Export ${job.id} failed:`, error);
            throw error;
        }
    }

    /**
     * Setup processing loop
     */
    setupProcessingLoop() {
        this.processingInterval = null;
    }

    /**
     * Start processing loop
     */
    startProcessingLoop() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 1000); // Check queue every second

        console.log('Export processing loop started');
    }

    /**
     * Process queue
     */
    async processQueue() {
        if (this.isShuttingDown || this.activeJobs.size >= this.options.maxConcurrentJobs) {
            return;
        }

        try {
            const jobConfig = await this.queue.dequeue();
            if (!jobConfig) {
                return; // No jobs in queue
            }

            const job = ExportJob.fromConfig(jobConfig);

            // Process job in background
            this.processJobImmediate(job).catch(error => {
                console.error('Background job processing failed:', error);
            });

        } catch (error) {
            console.error('Queue processing error:', error);
        }
    }

    /**
     * Stop processing loop
     */
    stopProcessingLoop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.isProcessing = false;
        console.log('Export processing loop stopped');
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId) {
        // Check active jobs
        if (this.activeJobs.has(jobId)) {
            const job = this.activeJobs.get(jobId);
            return {
                status: job.status,
                progress: job.progress,
                startedAt: job.startedAt,
                estimatedCompletion: job.estimatedCompletion
            };
        }

        // Check job history
        if (this.jobHistory.has(jobId)) {
            const job = this.jobHistory.get(jobId);
            return {
                status: job.status,
                completedAt: job.completedAt,
                error: job.error
            };
        }

        // Check queue
        const queueStatus = await this.queue.getJobStatus(jobId);
        if (queueStatus.found) {
            return queueStatus;
        }

        return { status: 'not_found' };
    }

    /**
     * Cancel export job
     */
    async cancelJob(jobId) {
        // Try to cancel active job
        if (this.activeJobs.has(jobId)) {
            const job = this.activeJobs.get(jobId);
            const processor = this.processors.get(job.format);

            let cancelled = false;
            if (processor.cancelExport) {
                cancelled = await processor.cancelExport(jobId);
            }

            if (cancelled) {
                job.updateStatus(EXPORT_STATUS.CANCELLED);
                this.activeJobs.delete(jobId);
                this.jobHistory.set(jobId, job);
                this.emit('jobCancelled', job.toConfig());
                return { success: true, message: 'Active job cancelled' };
            }
        }

        // Try to cancel queued job
        const queueCancelled = await this.queue.cancelJob(jobId);
        if (queueCancelled) {
            return { success: true, message: 'Queued job cancelled' };
        }

        return { success: false, message: 'Job not found or cannot be cancelled' };
    }

    /**
     * Get supported formats
     */
    getSupportedFormats() {
        return Array.from(this.processors.keys());
    }

    /**
     * Get engine statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            supportedFormats: this.getSupportedFormats(),
            activeJobs: this.activeJobs.size,
            queueSize: this.queue.getQueueSize(),
            totalProcessors: this.processors.size,
            uptime: Date.now() - this.startTime,
            cache: {
                enabled: this.options.enableCache,
                size: this.exportCache.size,
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
            },
            metrics: {
                ...this.metrics,
                averageProcessingTime: this.calculateAverageProcessingTime()
            }
        };
    }

    /**
     * Shutdown engine gracefully
     */
    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }

        console.log('Shutting down ExportEngine...');
        this.isShuttingDown = true;
        this.emit('shuttingDown');

        // Stop processing new jobs
        this.stopProcessingLoop();

        // Wait for active jobs to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const startShutdown = Date.now();

        while (this.activeJobs.size > 0 && (Date.now() - startShutdown) < shutdownTimeout) {
            console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Force cancel remaining jobs
        if (this.activeJobs.size > 0) {
            console.log(`Force cancelling ${this.activeJobs.size} remaining jobs`);
            for (const [jobId] of this.activeJobs) {
                await this.cancelJob(jobId);
            }
        }

        // Shutdown queue
        await this.queue.shutdown();

        // Shutdown processors
        for (const [format, processor] of this.processors) {
            try {
                if (processor.destroy) {
                    await processor.destroy();
                }
                console.log(`Processor for ${format} shut down`);
            } catch (error) {
                console.error(`Error shutting down processor for ${format}:`, error);
            }
        }

        // Clear caches and state
        this.exportCache.clear();
        this.activeJobs.clear();
        this.jobHistory.clear();
        this.processors.clear();
        this.listeners.clear();

        this.isInitialized = false;
        this.emit('shutdown');
        console.log('ExportEngine shutdown complete');
    }

    // Utility methods
    generateCacheKey(document, format, options) {
        const key = {
            documentId: document.id || document.title,
            documentHash: this.hashDocument(document),
            format,
            optionsHash: this.hashOptions(options)
        };
        return JSON.stringify(key);
    }

    hashDocument(document) {
        // Simple hash of document content
        const content = JSON.stringify({
            title: document.title,
            sections: document.sections?.map(s => ({ title: s.title, content: s.content?.substring(0, 100) }))
        });
        return this.simpleHash(content);
    }

    hashOptions(options) {
        // Simple hash of serializable options
        const serializable = { ...options };
        delete serializable.callbacks;
        delete serializable.streams;
        return this.simpleHash(JSON.stringify(serializable));
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    updateMetrics(type, format, processingTime, error = null) {
        this.metrics.totalExports++;

        if (type === 'success') {
            this.metrics.successfulExports++;
        } else {
            this.metrics.failedExports++;

            if (error) {
                const errorCount = this.metrics.errorCounts.get(error) || 0;
                this.metrics.errorCounts.set(error, errorCount + 1);
            }
        }

        // Track format usage
        const formatCount = this.metrics.formatCounts.get(format) || 0;
        this.metrics.formatCounts.set(format, formatCount + 1);

        // Track processing times
        if (processingTime > 0) {
            this.metrics.processingTimes.push(processingTime);
            // Keep only last 1000 entries
            if (this.metrics.processingTimes.length > 1000) {
                this.metrics.processingTimes = this.metrics.processingTimes.slice(-1000);
            }
        }
    }

    calculateAverageProcessingTime() {
        if (this.metrics.processingTimes.length === 0) {
            return 0;
        }
        const sum = this.metrics.processingTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.metrics.processingTimes.length);
    }

    // Event system
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

export default ExportEngine;