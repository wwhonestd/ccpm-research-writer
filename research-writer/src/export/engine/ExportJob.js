/**
 * ExportJob - Represents an individual export task
 * Manages job state, progress tracking, and execution context
 */

import { EXPORT_STATUS, EXPORT_PRIORITY } from '../types/index.js';

export class ExportJob {
    constructor(config) {
        this.id = config.id;
        this.format = config.format;
        this.document = config.document;
        this.options = config.options || {};
        this.priority = config.priority || EXPORT_PRIORITY.NORMAL;
        this.timeout = config.timeout || 30000;
        this.createdAt = config.createdAt || new Date();
        this.scheduledAt = config.scheduledAt || null;
        this.metadata = config.metadata || {};

        // Runtime state
        this.status = EXPORT_STATUS.PENDING;
        this.progress = 0;
        this.startedAt = null;
        this.completedAt = null;
        this.error = null;
        this.result = null;
        this.estimatedCompletion = null;

        // Execution context
        this.processingSteps = [];
        this.currentStep = null;
        this.retryCount = 0;
        this.maxRetries = config.maxRetries || 0;

        // Timing
        this.processingTime = 0;
        this.queuedTime = 0;

        this.validate();
    }

    /**
     * Validate job configuration
     */
    validate() {
        if (!this.id || typeof this.id !== 'string') {
            throw new Error('Job ID is required and must be a string');
        }

        if (!this.format || typeof this.format !== 'string') {
            throw new Error('Export format is required and must be a string');
        }

        if (!this.document || typeof this.document !== 'object') {
            throw new Error('Document is required and must be an object');
        }

        if (this.priority < 0 || this.priority > 3) {
            throw new Error('Priority must be between 0 and 3');
        }

        if (this.timeout <= 0) {
            throw new Error('Timeout must be greater than 0');
        }
    }

    /**
     * Update job status
     */
    updateStatus(newStatus, progressUpdate = null) {
        const oldStatus = this.status;
        this.status = newStatus;

        // Handle status-specific updates
        switch (newStatus) {
            case EXPORT_STATUS.QUEUED:
                this.queuedTime = Date.now();
                break;

            case EXPORT_STATUS.PROCESSING:
                this.startedAt = new Date();
                this.estimateCompletion();
                break;

            case EXPORT_STATUS.COMPLETED:
                this.completedAt = new Date();
                this.progress = 100;
                this.processingTime = Date.now() - (this.startedAt?.getTime() || Date.now());
                break;

            case EXPORT_STATUS.FAILED:
            case EXPORT_STATUS.CANCELLED:
                this.completedAt = new Date();
                if (this.startedAt) {
                    this.processingTime = Date.now() - this.startedAt.getTime();
                }
                break;
        }

        // Update progress if provided
        if (progressUpdate !== null) {
            this.updateProgress(progressUpdate);
        }

        this.logStatusChange(oldStatus, newStatus);
    }

    /**
     * Update job progress
     */
    updateProgress(progress, currentStep = null) {
        if (typeof progress === 'number' && progress >= 0 && progress <= 100) {
            this.progress = progress;

            // Update estimated completion
            if (this.startedAt && progress > 0) {
                this.estimateCompletion();
            }
        }

        if (currentStep) {
            this.currentStep = currentStep;
            this.processingSteps.push({
                step: currentStep,
                timestamp: new Date(),
                progress: progress
            });
        }
    }

    /**
     * Estimate completion time
     */
    estimateCompletion() {
        if (!this.startedAt || this.progress <= 0) {
            return;
        }

        const elapsedTime = Date.now() - this.startedAt.getTime();
        const estimatedTotalTime = (elapsedTime / this.progress) * 100;
        const remainingTime = estimatedTotalTime - elapsedTime;

        this.estimatedCompletion = new Date(Date.now() + remainingTime);
    }

    /**
     * Check if job has expired
     */
    isExpired() {
        if (this.status === EXPORT_STATUS.COMPLETED ||
            this.status === EXPORT_STATUS.FAILED ||
            this.status === EXPORT_STATUS.CANCELLED) {
            return false;
        }

        // Check if queued too long (24 hours)
        if (this.status === EXPORT_STATUS.QUEUED && this.queuedTime) {
            const maxQueueTime = 24 * 60 * 60 * 1000; // 24 hours
            return (Date.now() - this.queuedTime) > maxQueueTime;
        }

        // Check processing timeout
        if (this.status === EXPORT_STATUS.PROCESSING && this.startedAt) {
            return (Date.now() - this.startedAt.getTime()) > this.timeout;
        }

        return false;
    }

    /**
     * Check if job can be retried
     */
    canRetry() {
        return this.status === EXPORT_STATUS.FAILED &&
               this.retryCount < this.maxRetries &&
               !this.isExpired();
    }

    /**
     * Prepare job for retry
     */
    prepareForRetry() {
        if (!this.canRetry()) {
            throw new Error('Job cannot be retried');
        }

        this.retryCount++;
        this.status = EXPORT_STATUS.PENDING;
        this.progress = 0;
        this.startedAt = null;
        this.completedAt = null;
        this.error = null;
        this.result = null;
        this.estimatedCompletion = null;
        this.currentStep = null;

        // Keep processing steps for debugging
        this.processingSteps.push({
            step: `Retry ${this.retryCount}`,
            timestamp: new Date(),
            progress: 0
        });

        console.log(`Job ${this.id} prepared for retry ${this.retryCount}/${this.maxRetries}`);
    }

    /**
     * Calculate priority score for queue ordering
     */
    calculatePriorityScore() {
        let score = this.priority;

        // Age factor (older jobs get higher priority)
        const ageHours = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
        score += Math.min(ageHours * 0.1, 1); // Max 1 point for age

        // Scheduling factor
        if (this.scheduledAt && this.scheduledAt <= new Date()) {
            score += 2; // Higher priority for scheduled jobs
        }

        // Retry penalty (lower priority for retries)
        score -= this.retryCount * 0.2;

        // Timeout urgency
        if (this.timeout < 10000) { // Less than 10 seconds
            score += 1;
        }

        return Math.max(0, score);
    }

    /**
     * Get job summary
     */
    getSummary() {
        return {
            id: this.id,
            format: this.format,
            status: this.status,
            progress: this.progress,
            priority: this.priority,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            processingTime: this.processingTime,
            queuedTime: this.queuedTime ? (Date.now() - this.queuedTime) : 0,
            estimatedCompletion: this.estimatedCompletion,
            currentStep: this.currentStep,
            retryCount: this.retryCount,
            error: this.error,
            isExpired: this.isExpired(),
            canRetry: this.canRetry()
        };
    }

    /**
     * Get detailed information
     */
    getDetails() {
        return {
            ...this.getSummary(),
            document: {
                title: this.document.title,
                sectionCount: this.document.sections?.length || 0,
                hasAbstract: !!this.document.abstract,
                hasKeywords: !!(this.document.keywords?.length),
                estimatedSize: this.estimateDocumentSize()
            },
            options: this.options,
            metadata: this.metadata,
            processingSteps: this.processingSteps,
            timeout: this.timeout,
            maxRetries: this.maxRetries
        };
    }

    /**
     * Estimate document size
     */
    estimateDocumentSize() {
        let size = 0;

        if (this.document.title) {
            size += this.document.title.length;
        }

        if (this.document.abstract) {
            size += this.document.abstract.length;
        }

        if (this.document.sections) {
            size += this.document.sections.reduce((total, section) => {
                return total + (section.title?.length || 0) + (section.content?.length || 0);
            }, 0);
        }

        return size;
    }

    /**
     * Log status changes
     */
    logStatusChange(oldStatus, newStatus) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Job ${this.id}: ${oldStatus} → ${newStatus}`);

        if (newStatus === EXPORT_STATUS.PROCESSING) {
            console.log(`[${timestamp}] Job ${this.id}: Starting ${this.format} export for "${this.document.title}"`);
        }

        if (newStatus === EXPORT_STATUS.COMPLETED) {
            console.log(`[${timestamp}] Job ${this.id}: Completed in ${this.processingTime}ms`);
        }

        if (newStatus === EXPORT_STATUS.FAILED && this.error) {
            console.log(`[${timestamp}] Job ${this.id}: Failed - ${this.error}`);
        }
    }

    /**
     * Convert to configuration object
     */
    toConfig() {
        return {
            id: this.id,
            format: this.format,
            document: this.document,
            options: this.options,
            priority: this.priority,
            timeout: this.timeout,
            createdAt: this.createdAt,
            scheduledAt: this.scheduledAt,
            metadata: this.metadata,
            maxRetries: this.maxRetries
        };
    }

    /**
     * Create job from configuration
     */
    static fromConfig(config) {
        return new ExportJob(config);
    }

    /**
     * Create job with default values
     */
    static create(document, format, options = {}) {
        const jobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return new ExportJob({
            id: jobId,
            format,
            document,
            options,
            priority: options.priority || EXPORT_PRIORITY.NORMAL,
            timeout: options.timeout || 30000,
            createdAt: new Date(),
            scheduledAt: options.scheduledAt || null,
            metadata: options.metadata || {},
            maxRetries: options.maxRetries || 0
        });
    }

    /**
     * Clone job with new ID
     */
    clone() {
        const config = this.toConfig();
        config.id = `${config.id}_clone_${Date.now()}`;
        return new ExportJob(config);
    }

    /**
     * Serialize job for storage
     */
    serialize() {
        return JSON.stringify({
            ...this.toConfig(),
            status: this.status,
            progress: this.progress,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            error: this.error,
            processingSteps: this.processingSteps,
            retryCount: this.retryCount
        });
    }

    /**
     * Deserialize job from storage
     */
    static deserialize(data) {
        const parsed = JSON.parse(data);
        const job = new ExportJob(parsed);

        // Restore runtime state
        job.status = parsed.status || EXPORT_STATUS.PENDING;
        job.progress = parsed.progress || 0;
        job.startedAt = parsed.startedAt ? new Date(parsed.startedAt) : null;
        job.completedAt = parsed.completedAt ? new Date(parsed.completedAt) : null;
        job.error = parsed.error || null;
        job.processingSteps = parsed.processingSteps || [];
        job.retryCount = parsed.retryCount || 0;

        return job;
    }

    /**
     * Compare jobs for sorting (higher priority first)
     */
    static compare(jobA, jobB) {
        const scoreA = jobA.calculatePriorityScore();
        const scoreB = jobB.calculatePriorityScore();

        if (scoreA !== scoreB) {
            return scoreB - scoreA; // Higher score first
        }

        // If same priority score, order by creation time (FIFO)
        return jobA.createdAt.getTime() - jobB.createdAt.getTime();
    }

    /**
     * Validate job compatibility with processor capabilities
     */
    validateCompatibility(capabilities) {
        const errors = [];

        if (capabilities.format !== this.format) {
            errors.push(`Format mismatch: job requires ${this.format}, processor supports ${capabilities.format}`);
        }

        // Check required options
        if (capabilities.requiredOptions) {
            for (const required of capabilities.requiredOptions) {
                if (!this.options.hasOwnProperty(required)) {
                    errors.push(`Missing required option: ${required}`);
                }
            }
        }

        // Check document size limits
        if (capabilities.maxContentLength) {
            const docSize = this.estimateDocumentSize();
            if (docSize > capabilities.maxContentLength) {
                errors.push(`Document size ${docSize} exceeds processor limit ${capabilities.maxContentLength}`);
            }
        }

        return {
            compatible: errors.length === 0,
            errors
        };
    }
}

export default ExportJob;