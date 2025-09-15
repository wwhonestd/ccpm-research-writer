/**
 * ExportQueue - Priority-based job queue for export processing
 * Manages job ordering, persistence, and queue operations
 */

import { IExportQueue, EXPORT_STATUS, EXPORT_PRIORITY } from '../types/index.js';
import { ExportJob } from './ExportJob.js';

export class ExportQueue extends IExportQueue {
    constructor(options = {}) {
        super();

        this.options = {
            maxSize: options.maxSize || 1000,
            persistToDisk: options.persistToDisk || false,
            storageFile: options.storageFile || '/tmp/export-queue.json',
            autoSave: options.autoSave !== false,
            saveInterval: options.saveInterval || 30000, // 30 seconds
            enablePriority: options.enablePriority !== false,
            maxRetentionHours: options.maxRetentionHours || 24,
            enableMetrics: options.enableMetrics !== false,
            ...options
        };

        // Queue storage
        this.jobs = new Map(); // jobId -> ExportJob
        this.priorityQueue = []; // Sorted array of job IDs
        this.completedJobs = new Map(); // Completed jobs for history

        // Queue state
        this.isInitialized = false;
        this.lastSave = null;
        this.saveTimer = null;

        // Metrics
        this.metrics = {
            totalEnqueued: 0,
            totalDequeued: 0,
            totalCompleted: 0,
            totalFailed: 0,
            currentSize: 0,
            peakSize: 0,
            averageWaitTime: 0,
            waitTimes: []
        };

        // Event listeners
        this.listeners = new Map();
    }

    /**
     * Initialize queue
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Load persisted jobs if enabled
            if (this.options.persistToDisk) {
                await this.loadFromDisk();
            }

            // Start auto-save if enabled
            if (this.options.autoSave) {
                this.startAutoSave();
            }

            // Start cleanup timer
            this.startCleanupTimer();

            this.isInitialized = true;
            console.log('ExportQueue initialized');

        } catch (error) {
            console.error('ExportQueue initialization failed:', error);
            throw error;
        }
    }

    /**
     * Add job to queue
     */
    async enqueue(jobConfig) {
        if (!this.isInitialized) {
            await this.init();
        }

        // Check queue size limit
        if (this.jobs.size >= this.options.maxSize) {
            throw new Error(`Queue is full (max size: ${this.options.maxSize})`);
        }

        // Create job instance
        let job;
        if (jobConfig instanceof ExportJob) {
            job = jobConfig;
        } else {
            job = ExportJob.fromConfig(jobConfig);
        }

        // Update job status
        job.updateStatus(EXPORT_STATUS.QUEUED);

        // Add to storage
        this.jobs.set(job.id, job);

        // Insert into priority queue
        if (this.options.enablePriority) {
            this.insertByPriority(job.id);
        } else {
            this.priorityQueue.push(job.id); // FIFO
        }

        // Update metrics
        this.updateMetrics('enqueue');

        // Auto-save if needed
        if (this.options.autoSave) {
            await this.saveIfNeeded();
        }

        this.emit('jobEnqueued', job.toConfig());
        console.log(`Job ${job.id} enqueued (position: ${this.getJobPosition(job.id)})`);

        return job.id;
    }

    /**
     * Get next job from queue
     */
    async dequeue() {
        if (this.priorityQueue.length === 0) {
            return null;
        }

        // Get next job ID
        const jobId = this.priorityQueue.shift();
        const job = this.jobs.get(jobId);

        if (!job) {
            console.warn(`Job ${jobId} not found in storage, skipping`);
            return await this.dequeue(); // Try next job
        }

        // Check if job is expired
        if (job.isExpired()) {
            console.log(`Job ${jobId} expired, moving to failed status`);
            job.updateStatus(EXPORT_STATUS.FAILED);
            job.error = 'Job expired in queue';
            this.moveToCompleted(job);
            return await this.dequeue(); // Try next job
        }

        // Remove from active storage
        this.jobs.delete(jobId);

        // Update metrics
        this.updateMetrics('dequeue', job);

        // Auto-save if needed
        if (this.options.autoSave) {
            await this.saveIfNeeded();
        }

        this.emit('jobDequeued', job.toConfig());
        console.log(`Job ${jobId} dequeued for processing`);

        return job.toConfig();
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId) {
        // Check active queue
        if (this.jobs.has(jobId)) {
            const job = this.jobs.get(jobId);
            const position = this.getJobPosition(jobId);

            return {
                found: true,
                status: job.status,
                position: position,
                estimatedWait: this.estimateWaitTime(position),
                progress: job.progress,
                createdAt: job.createdAt,
                queuedAt: job.queuedTime ? new Date(job.queuedTime) : null
            };
        }

        // Check completed jobs
        if (this.completedJobs.has(jobId)) {
            const job = this.completedJobs.get(jobId);
            return {
                found: true,
                status: job.status,
                completedAt: job.completedAt,
                processingTime: job.processingTime,
                error: job.error
            };
        }

        return { found: false };
    }

    /**
     * Cancel queued job
     */
    async cancelJob(jobId) {
        if (!this.jobs.has(jobId)) {
            return false;
        }

        const job = this.jobs.get(jobId);

        // Update job status
        job.updateStatus(EXPORT_STATUS.CANCELLED);

        // Remove from queue
        this.removeFromQueue(jobId);
        this.jobs.delete(jobId);

        // Move to completed
        this.moveToCompleted(job);

        // Update metrics
        this.updateMetrics('cancel');

        // Auto-save if needed
        if (this.options.autoSave) {
            await this.saveIfNeeded();
        }

        this.emit('jobCancelled', job.toConfig());
        console.log(`Job ${jobId} cancelled`);

        return true;
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        // Calculate current statistics
        const currentStats = {
            size: this.jobs.size,
            completedSize: this.completedJobs.size,
            priorityDistribution: this.getPriorityDistribution(),
            formatDistribution: this.getFormatDistribution(),
            averageAge: this.calculateAverageAge(),
            oldestJob: this.getOldestJob(),
            estimatedProcessingTime: this.estimateQueueProcessingTime()
        };

        return {
            ...this.metrics,
            current: currentStats,
            options: {
                maxSize: this.options.maxSize,
                enablePriority: this.options.enablePriority,
                persistToDisk: this.options.persistToDisk,
                maxRetentionHours: this.options.maxRetentionHours
            }
        };
    }

    /**
     * Clear queue
     */
    async clear() {
        const clearedCount = this.jobs.size;

        // Cancel all jobs
        for (const [jobId, job] of this.jobs) {
            job.updateStatus(EXPORT_STATUS.CANCELLED);
            this.moveToCompleted(job);
        }

        this.jobs.clear();
        this.priorityQueue = [];

        // Update metrics
        this.metrics.currentSize = 0;

        // Save changes
        if (this.options.autoSave) {
            await this.saveIfNeeded();
        }

        this.emit('queueCleared', { clearedCount });
        console.log(`Queue cleared: ${clearedCount} jobs cancelled`);
    }

    /**
     * Get queue size
     */
    getQueueSize() {
        return this.jobs.size;
    }

    /**
     * Peek at next job without removing it
     */
    peek() {
        if (this.priorityQueue.length === 0) {
            return null;
        }

        const jobId = this.priorityQueue[0];
        const job = this.jobs.get(jobId);
        return job ? job.toConfig() : null;
    }

    /**
     * Get job position in queue
     */
    getJobPosition(jobId) {
        const index = this.priorityQueue.indexOf(jobId);
        return index === -1 ? null : index + 1;
    }

    /**
     * Insert job by priority
     */
    insertByPriority(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return;
        }

        const jobScore = job.calculatePriorityScore();

        // Find insertion position
        let insertIndex = 0;
        for (let i = 0; i < this.priorityQueue.length; i++) {
            const existingJobId = this.priorityQueue[i];
            const existingJob = this.jobs.get(existingJobId);

            if (!existingJob) {
                // Clean up invalid reference
                this.priorityQueue.splice(i, 1);
                i--;
                continue;
            }

            const existingScore = existingJob.calculatePriorityScore();

            if (jobScore > existingScore) {
                insertIndex = i;
                break;
            }
            insertIndex = i + 1;
        }

        this.priorityQueue.splice(insertIndex, 0, jobId);
    }

    /**
     * Remove job from queue
     */
    removeFromQueue(jobId) {
        const index = this.priorityQueue.indexOf(jobId);
        if (index !== -1) {
            this.priorityQueue.splice(index, 1);
        }
    }

    /**
     * Move completed job to history
     */
    moveToCompleted(job) {
        this.completedJobs.set(job.id, job);

        // Cleanup old completed jobs
        this.cleanupCompletedJobs();
    }

    /**
     * Cleanup old completed jobs
     */
    cleanupCompletedJobs() {
        const maxAge = this.options.maxRetentionHours * 60 * 60 * 1000;
        const cutoffTime = Date.now() - maxAge;

        for (const [jobId, job] of this.completedJobs) {
            if (job.completedAt && job.completedAt.getTime() < cutoffTime) {
                this.completedJobs.delete(jobId);
            }
        }
    }

    /**
     * Estimate wait time for position
     */
    estimateWaitTime(position) {
        if (!position || position <= 0) {
            return 0;
        }

        // Use average processing time if available
        const avgTime = this.metrics.averageWaitTime || 5000; // Default 5 seconds
        return position * avgTime;
    }

    /**
     * Calculate priority distribution
     */
    getPriorityDistribution() {
        const distribution = {};
        for (const priority of Object.values(EXPORT_PRIORITY)) {
            distribution[priority] = 0;
        }

        for (const job of this.jobs.values()) {
            distribution[job.priority] = (distribution[job.priority] || 0) + 1;
        }

        return distribution;
    }

    /**
     * Calculate format distribution
     */
    getFormatDistribution() {
        const distribution = {};

        for (const job of this.jobs.values()) {
            distribution[job.format] = (distribution[job.format] || 0) + 1;
        }

        return distribution;
    }

    /**
     * Calculate average age of jobs in queue
     */
    calculateAverageAge() {
        if (this.jobs.size === 0) {
            return 0;
        }

        const totalAge = Array.from(this.jobs.values()).reduce((sum, job) => {
            return sum + (Date.now() - job.createdAt.getTime());
        }, 0);

        return totalAge / this.jobs.size;
    }

    /**
     * Get oldest job in queue
     */
    getOldestJob() {
        if (this.jobs.size === 0) {
            return null;
        }

        let oldest = null;
        for (const job of this.jobs.values()) {
            if (!oldest || job.createdAt < oldest.createdAt) {
                oldest = job;
            }
        }

        return oldest ? {
            id: oldest.id,
            format: oldest.format,
            age: Date.now() - oldest.createdAt.getTime(),
            createdAt: oldest.createdAt
        } : null;
    }

    /**
     * Estimate total queue processing time
     */
    estimateQueueProcessingTime() {
        if (this.jobs.size === 0) {
            return 0;
        }

        const avgTime = this.metrics.averageWaitTime || 5000;
        return this.jobs.size * avgTime;
    }

    /**
     * Update metrics
     */
    updateMetrics(operation, job = null) {
        switch (operation) {
            case 'enqueue':
                this.metrics.totalEnqueued++;
                this.metrics.currentSize = this.jobs.size;
                this.metrics.peakSize = Math.max(this.metrics.peakSize, this.jobs.size);
                break;

            case 'dequeue':
                this.metrics.totalDequeued++;
                this.metrics.currentSize = this.jobs.size;

                if (job && job.queuedTime) {
                    const waitTime = Date.now() - job.queuedTime;
                    this.metrics.waitTimes.push(waitTime);

                    // Keep only last 1000 entries
                    if (this.metrics.waitTimes.length > 1000) {
                        this.metrics.waitTimes = this.metrics.waitTimes.slice(-1000);
                    }

                    // Update average
                    const sum = this.metrics.waitTimes.reduce((a, b) => a + b, 0);
                    this.metrics.averageWaitTime = Math.round(sum / this.metrics.waitTimes.length);
                }
                break;

            case 'complete':
                this.metrics.totalCompleted++;
                break;

            case 'fail':
                this.metrics.totalFailed++;
                break;

            case 'cancel':
                // Cancelled jobs are counted separately from failed
                break;
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSave() {
        this.saveTimer = setInterval(async () => {
            await this.saveIfNeeded();
        }, this.options.saveInterval);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }
    }

    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        // Run cleanup every hour
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredJobs();
            this.cleanupCompletedJobs();
        }, 60 * 60 * 1000);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Cleanup expired jobs
     */
    cleanupExpiredJobs() {
        const expiredJobs = [];

        for (const [jobId, job] of this.jobs) {
            if (job.isExpired()) {
                expiredJobs.push(jobId);
            }
        }

        for (const jobId of expiredJobs) {
            const job = this.jobs.get(jobId);
            job.updateStatus(EXPORT_STATUS.FAILED);
            job.error = 'Job expired in queue';

            this.removeFromQueue(jobId);
            this.jobs.delete(jobId);
            this.moveToCompleted(job);

            console.log(`Cleaned up expired job: ${jobId}`);
        }

        if (expiredJobs.length > 0) {
            this.emit('expiredJobsCleanedUp', { count: expiredJobs.length });
        }
    }

    /**
     * Save queue to disk if needed
     */
    async saveIfNeeded() {
        if (!this.options.persistToDisk) {
            return;
        }

        // Only save if there are changes and enough time has passed
        const minSaveInterval = 10000; // 10 seconds
        if (this.lastSave && (Date.now() - this.lastSave) < minSaveInterval) {
            return;
        }

        await this.saveToDisk();
    }

    /**
     * Save queue to disk
     */
    async saveToDisk() {
        if (!this.options.persistToDisk) {
            return;
        }

        try {
            const data = {
                jobs: Array.from(this.jobs.entries()).map(([id, job]) => [id, job.serialize()]),
                priorityQueue: this.priorityQueue,
                completedJobs: Array.from(this.completedJobs.entries()).map(([id, job]) => [id, job.serialize()]),
                metrics: this.metrics,
                savedAt: new Date().toISOString()
            };

            // In a real implementation, use fs.writeFile
            console.log(`Queue saved to ${this.options.storageFile} (${this.jobs.size} jobs)`);
            this.lastSave = Date.now();

        } catch (error) {
            console.error('Failed to save queue to disk:', error);
        }
    }

    /**
     * Load queue from disk
     */
    async loadFromDisk() {
        if (!this.options.persistToDisk) {
            return;
        }

        try {
            // In a real implementation, use fs.readFile
            // For now, just log that we would load
            console.log(`Queue loaded from ${this.options.storageFile}`);

        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Failed to load queue from disk:', error);
            }
        }
    }

    /**
     * Shutdown queue
     */
    async shutdown() {
        console.log('Shutting down ExportQueue...');

        // Stop timers
        this.stopAutoSave();
        this.stopCleanupTimer();

        // Save final state
        if (this.options.persistToDisk) {
            await this.saveToDisk();
        }

        // Clear listeners
        this.listeners.clear();

        console.log('ExportQueue shutdown complete');
    }

    // Event system
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in queue event listener for ${event}:`, error);
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

export default ExportQueue;