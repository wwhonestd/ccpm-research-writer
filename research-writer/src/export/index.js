/**
 * Export System Entry Point
 * Main interface for the pluggable export system
 */

import { ExportEngine } from './engine/ExportEngine.js';
import { ExportJob } from './engine/ExportJob.js';
import { ExportQueue } from './engine/ExportQueue.js';

import {
    EXPORT_FORMATS,
    EXPORT_STATUS,
    EXPORT_PRIORITY,
    CITATION_STYLES,
    IExportProcessor,
    IExportQueue,
    IExportEngine,
    ValidationSchemas,
    ExportUtils
} from './types/index.js';

/**
 * Export System Manager
 * High-level interface for managing the entire export system
 */
class ExportSystemManager {
    constructor(options = {}) {
        this.options = {
            autoInitialize: options.autoInitialize !== false,
            defaultEngine: options.defaultEngine || 'standard',
            enableMetrics: options.enableMetrics !== false,
            enableLogging: options.enableLogging !== false,
            ...options
        };

        this.engines = new Map();
        this.defaultEngine = null;
        this.isInitialized = false;
        this.systemMetrics = {
            startTime: Date.now(),
            totalExports: 0,
            activeEngines: 0,
            systemUptime: 0
        };

        if (this.options.autoInitialize) {
            this.init();
        }
    }

    /**
     * Initialize the export system
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('Initializing Export System...');

            // Create default engine
            this.defaultEngine = new ExportEngine(this.options);
            this.engines.set('default', this.defaultEngine);

            // Initialize default engine
            await this.defaultEngine.init();

            // Register built-in processors (if available)
            await this.registerBuiltInProcessors();

            this.isInitialized = true;
            this.systemMetrics.activeEngines = this.engines.size;

            console.log('Export System initialized successfully');

        } catch (error) {
            console.error('Export System initialization failed:', error);
            throw error;
        }
    }

    /**
     * Register built-in export processors
     */
    async registerBuiltInProcessors() {
        try {
            // Try to load processors from existing modules
            const processorModules = [
                { format: 'pdf', path: '../../js/modules/export/processors/PDFExportProcessor.js' },
                { format: 'docx', path: '../../js/modules/export/processors/DOCXExportProcessor.js' },
                { format: 'latex', path: '../../js/modules/export/processors/LaTeXExportProcessor.js' }
            ];

            for (const { format, path } of processorModules) {
                try {
                    const module = await import(path);
                    const ProcessorClass = module[`${format.toUpperCase()}ExportProcessor`] ||
                                          module[`${format}ExportProcessor`] ||
                                          module.default;

                    if (ProcessorClass) {
                        const processor = new ProcessorClass(this.options);
                        await this.registerProcessor(format, processor);
                    }
                } catch (error) {
                    console.warn(`Could not load ${format} processor:`, error.message);
                }
            }
        } catch (error) {
            console.warn('Built-in processor registration failed:', error.message);
        }
    }

    /**
     * Register export processor with default engine
     */
    async registerProcessor(format, processor, engineName = 'default') {
        const engine = this.engines.get(engineName);
        if (!engine) {
            throw new Error(`Engine "${engineName}" not found`);
        }

        await engine.registerProcessor(format, processor);
        console.log(`Registered ${format} processor with ${engineName} engine`);
    }

    /**
     * Create new export engine
     */
    async createEngine(name, options = {}) {
        if (this.engines.has(name)) {
            throw new Error(`Engine "${name}" already exists`);
        }

        const engine = new ExportEngine({ ...this.options, ...options });
        await engine.init();

        this.engines.set(name, engine);
        this.systemMetrics.activeEngines = this.engines.size;

        console.log(`Created engine: ${name}`);
        return engine;
    }

    /**
     * Get engine by name
     */
    getEngine(name = 'default') {
        const engine = this.engines.get(name);
        if (!engine) {
            throw new Error(`Engine "${name}" not found`);
        }
        return engine;
    }

    /**
     * Export document using default engine
     */
    async exportDocument(document, format, options = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        const engine = this.getEngine(options.engine);
        const result = await engine.exportDocument(document, format, options);

        // Update system metrics
        this.systemMetrics.totalExports++;

        return result;
    }

    /**
     * Get supported formats across all engines
     */
    getSupportedFormats() {
        const formats = new Set();

        for (const engine of this.engines.values()) {
            engine.getSupportedFormats().forEach(format => formats.add(format));
        }

        return Array.from(formats);
    }

    /**
     * Get system statistics
     */
    getSystemStats() {
        const engineStats = {};
        for (const [name, engine] of this.engines) {
            engineStats[name] = engine.getStats();
        }

        return {
            ...this.systemMetrics,
            systemUptime: Date.now() - this.systemMetrics.startTime,
            engines: engineStats,
            supportedFormats: this.getSupportedFormats(),
            options: this.options
        };
    }

    /**
     * Shutdown entire export system
     */
    async shutdown() {
        console.log('Shutting down Export System...');

        // Shutdown all engines
        const shutdownPromises = Array.from(this.engines.values()).map(engine => engine.shutdown());
        await Promise.all(shutdownPromises);

        // Clear state
        this.engines.clear();
        this.defaultEngine = null;
        this.isInitialized = false;
        this.systemMetrics.activeEngines = 0;

        console.log('Export System shutdown complete');
    }
}

// Create singleton instance
const exportSystem = new ExportSystemManager();

// Export main classes and interfaces
export {
    // Core classes
    ExportEngine,
    ExportJob,
    ExportQueue,
    ExportSystemManager,

    // Types and constants
    EXPORT_FORMATS,
    EXPORT_STATUS,
    EXPORT_PRIORITY,
    CITATION_STYLES,

    // Interfaces
    IExportProcessor,
    IExportQueue,
    IExportEngine,

    // Utilities
    ValidationSchemas,
    ExportUtils,

    // Singleton instance
    exportSystem
};

// Export default interface
export default {
    // Main system manager
    system: exportSystem,

    // Core classes for custom implementations
    ExportEngine,
    ExportJob,
    ExportQueue,

    // Constants and types
    formats: EXPORT_FORMATS,
    status: EXPORT_STATUS,
    priority: EXPORT_PRIORITY,
    citationStyles: CITATION_STYLES,

    // Utilities
    utils: ExportUtils,
    validation: ValidationSchemas,

    // Convenience methods
    async export(document, format, options = {}) {
        return await exportSystem.exportDocument(document, format, options);
    },

    async init(options = {}) {
        if (options && Object.keys(options).length > 0) {
            // Reinitialize with new options
            await exportSystem.shutdown();
            exportSystem.options = { ...exportSystem.options, ...options };
        }
        return await exportSystem.init();
    },

    async registerProcessor(format, processor, engineName) {
        return await exportSystem.registerProcessor(format, processor, engineName);
    },

    getSupportedFormats() {
        return exportSystem.getSupportedFormats();
    },

    getStats() {
        return exportSystem.getSystemStats();
    },

    async shutdown() {
        return await exportSystem.shutdown();
    }
};

/**
 * Quick Export Functions
 * Convenience functions for common export operations
 */

/**
 * Export document to PDF
 */
export async function exportToPDF(document, options = {}) {
    return await exportSystem.exportDocument(document, EXPORT_FORMATS.PDF, options);
}

/**
 * Export document to Word
 */
export async function exportToWord(document, options = {}) {
    return await exportSystem.exportDocument(document, EXPORT_FORMATS.DOCX, options);
}

/**
 * Export document to LaTeX
 */
export async function exportToLaTeX(document, options = {}) {
    return await exportSystem.exportDocument(document, EXPORT_FORMATS.LATEX, options);
}

/**
 * Export document to HTML
 */
export async function exportToHTML(document, options = {}) {
    return await exportSystem.exportDocument(document, EXPORT_FORMATS.HTML, options);
}

/**
 * Export document to Markdown
 */
export async function exportToMarkdown(document, options = {}) {
    return await exportSystem.exportDocument(document, EXPORT_FORMATS.MARKDOWN, options);
}

/**
 * Batch export to multiple formats
 */
export async function exportToMultipleFormats(document, formats, options = {}) {
    const results = {};

    for (const format of formats) {
        try {
            results[format] = await exportSystem.exportDocument(document, format, {
                ...options,
                immediate: false // Use queue for batch processing
            });
        } catch (error) {
            results[format] = {
                success: false,
                error: error.message
            };
        }
    }

    return results;
}

/**
 * Create export job without immediate processing
 */
export function createExportJob(document, format, options = {}) {
    return ExportJob.create(document, format, options);
}

/**
 * Validate document for export
 */
export function validateDocument(document) {
    return ValidationSchemas.validateDocument(document);
}

/**
 * Validate export options
 */
export function validateExportOptions(options, format) {
    return ValidationSchemas.validateExportOptions(options, format);
}

/**
 * Generate filename for export
 */
export function generateFilename(document, format) {
    return ExportUtils.generateFilename(document, format);
}

/**
 * Estimate processing time
 */
export function estimateProcessingTime(document, format) {
    return ExportUtils.estimateProcessingTime(document, format);
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    // Browser environment - initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            exportSystem.init().catch(error => {
                console.error('Auto-initialization failed:', error);
            });
        });
    } else {
        // DOM already ready
        exportSystem.init().catch(error => {
            console.error('Auto-initialization failed:', error);
        });
    }
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExportEngine,
        ExportJob,
        ExportQueue,
        ExportSystemManager,
        exportSystem,
        EXPORT_FORMATS,
        EXPORT_STATUS,
        EXPORT_PRIORITY,
        CITATION_STYLES,
        ValidationSchemas,
        ExportUtils,
        exportToPDF,
        exportToWord,
        exportToLaTeX,
        exportToHTML,
        exportToMarkdown,
        exportToMultipleFormats,
        createExportJob,
        validateDocument,
        validateExportOptions,
        generateFilename,
        estimateProcessingTime
    };
}