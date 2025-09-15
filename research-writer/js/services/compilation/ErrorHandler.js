/**
 * ErrorHandler - Comprehensive error handling and validation service
 * Provides centralized error management for the export and compilation pipeline
 * Includes validation, error recovery, and detailed error reporting
 */

export class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            enableLogging: options.enableLogging !== false,
            enableRecovery: options.enableRecovery !== false,
            enableRetry: options.enableRetry !== false,
            maxRetryAttempts: options.maxRetryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            logLevel: options.logLevel || 'error', // 'debug', 'info', 'warn', 'error'
            ...options
        };

        this.errorTypes = new Map();
        this.validators = new Map();
        this.recoveryStrategies = new Map();
        this.errorLog = [];
        this.errorStats = new Map();

        this.isInitialized = false;
    }

    async init() {
        try {
            this.initializeErrorTypes();
            this.initializeValidators();
            this.initializeRecoveryStrategies();
            this.isInitialized = true;
            console.log('Error handler initialized');
        } catch (error) {
            console.error('Error handler initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize error type definitions
     */
    initializeErrorTypes() {
        // Validation errors
        this.errorTypes.set('VALIDATION_ERROR', {
            code: 'VALIDATION_ERROR',
            severity: 'error',
            recoverable: true,
            category: 'validation',
            defaultMessage: 'Validation failed'
        });

        // Compilation errors
        this.errorTypes.set('COMPILATION_ERROR', {
            code: 'COMPILATION_ERROR',
            severity: 'error',
            recoverable: true,
            category: 'compilation',
            defaultMessage: 'Document compilation failed'
        });

        // Export errors
        this.errorTypes.set('EXPORT_ERROR', {
            code: 'EXPORT_ERROR',
            severity: 'error',
            recoverable: true,
            category: 'export',
            defaultMessage: 'Export process failed'
        });

        // Template errors
        this.errorTypes.set('TEMPLATE_ERROR', {
            code: 'TEMPLATE_ERROR',
            severity: 'error',
            recoverable: true,
            category: 'template',
            defaultMessage: 'Template processing failed'
        });

        // Citation errors
        this.errorTypes.set('CITATION_ERROR', {
            code: 'CITATION_ERROR',
            severity: 'warning',
            recoverable: true,
            category: 'citation',
            defaultMessage: 'Citation processing issue'
        });

        // Research integration errors
        this.errorTypes.set('RESEARCH_ERROR', {
            code: 'RESEARCH_ERROR',
            severity: 'warning',
            recoverable: true,
            category: 'research',
            defaultMessage: 'Research integration issue'
        });

        // System errors
        this.errorTypes.set('SYSTEM_ERROR', {
            code: 'SYSTEM_ERROR',
            severity: 'critical',
            recoverable: false,
            category: 'system',
            defaultMessage: 'System error occurred'
        });

        // Resource errors
        this.errorTypes.set('RESOURCE_ERROR', {
            code: 'RESOURCE_ERROR',
            severity: 'error',
            recoverable: true,
            category: 'resource',
            defaultMessage: 'Resource access error'
        });

        // Configuration errors
        this.errorTypes.set('CONFIG_ERROR', {
            code: 'CONFIG_ERROR',
            severity: 'error',
            recoverable: false,
            category: 'configuration',
            defaultMessage: 'Configuration error'
        });

        console.log(`Initialized ${this.errorTypes.size} error types`);
    }

    /**
     * Initialize validators
     */
    initializeValidators() {
        // Document structure validator
        this.validators.set('document', {
            name: 'document',
            validate: this.validateDocument.bind(this),
            required: true
        });

        // Template validator
        this.validators.set('template', {
            name: 'template',
            validate: this.validateTemplate.bind(this),
            required: false
        });

        // Export options validator
        this.validators.set('exportOptions', {
            name: 'exportOptions',
            validate: this.validateExportOptions.bind(this),
            required: false
        });

        // Citation data validator
        this.validators.set('citations', {
            name: 'citations',
            validate: this.validateCitations.bind(this),
            required: false
        });

        // File path validator
        this.validators.set('filePath', {
            name: 'filePath',
            validate: this.validateFilePath.bind(this),
            required: false
        });

        console.log(`Initialized ${this.validators.size} validators`);
    }

    /**
     * Initialize recovery strategies
     */
    initializeRecoveryStrategies() {
        // Validation error recovery
        this.recoveryStrategies.set('VALIDATION_ERROR', {
            strategy: this.recoverFromValidationError.bind(this),
            maxAttempts: 2
        });

        // Compilation error recovery
        this.recoveryStrategies.set('COMPILATION_ERROR', {
            strategy: this.recoverFromCompilationError.bind(this),
            maxAttempts: 3
        });

        // Export error recovery
        this.recoveryStrategies.set('EXPORT_ERROR', {
            strategy: this.recoverFromExportError.bind(this),
            maxAttempts: 2
        });

        // Template error recovery
        this.recoveryStrategies.set('TEMPLATE_ERROR', {
            strategy: this.recoverFromTemplateError.bind(this),
            maxAttempts: 1
        });

        // Resource error recovery
        this.recoveryStrategies.set('RESOURCE_ERROR', {
            strategy: this.recoverFromResourceError.bind(this),
            maxAttempts: 3
        });

        console.log(`Initialized ${this.recoveryStrategies.size} recovery strategies`);
    }

    /**
     * Handle error with comprehensive processing
     */
    async handleError(error, context = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        const errorInfo = this.processError(error, context);
        
        // Log error
        if (this.options.enableLogging) {
            this.logError(errorInfo);
        }

        // Update statistics
        this.updateErrorStats(errorInfo);

        // Attempt recovery if enabled and possible
        if (this.options.enableRecovery && errorInfo.recoverable) {
            try {
                const recovery = await this.attemptRecovery(errorInfo, context);
                if (recovery.success) {
                    this.log('info', `Error recovery successful for ${errorInfo.code}`);
                    return {
                        success: true,
                        recovered: true,
                        result: recovery.result,
                        error: errorInfo
                    };
                }
            } catch (recoveryError) {
                this.log('error', `Error recovery failed: ${recoveryError.message}`);
                errorInfo.recoveryError = recoveryError.message;
            }
        }

        // Return error information
        return {
            success: false,
            recovered: false,
            error: errorInfo
        };
    }

    /**
     * Process error into structured format
     */
    processError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            id: this.generateErrorId(),
            originalError: error,
            context: { ...context }
        };

        // Detect error type
        const errorType = this.detectErrorType(error, context);
        const typeInfo = this.errorTypes.get(errorType) || this.errorTypes.get('SYSTEM_ERROR');

        errorInfo.code = typeInfo.code;
        errorInfo.type = errorType;
        errorInfo.severity = typeInfo.severity;
        errorInfo.recoverable = typeInfo.recoverable;
        errorInfo.category = typeInfo.category;

        // Extract error message
        errorInfo.message = error.message || typeInfo.defaultMessage;
        
        // Extract stack trace
        if (error.stack) {
            errorInfo.stack = error.stack;
        }

        // Add context-specific information
        this.enhanceErrorInfo(errorInfo, context);

        return errorInfo;
    }

    /**
     * Detect error type based on error and context
     */
    detectErrorType(error, context) {
        const message = error.message?.toLowerCase() || '';
        const contextType = context.type || '';

        // Check for specific error patterns
        if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
            return 'VALIDATION_ERROR';
        }

        if (message.includes('compilation') || message.includes('compile')) {
            return 'COMPILATION_ERROR';
        }

        if (message.includes('export') || contextType === 'export') {
            return 'EXPORT_ERROR';
        }

        if (message.includes('template') || contextType === 'template') {
            return 'TEMPLATE_ERROR';
        }

        if (message.includes('citation') || contextType === 'citation') {
            return 'CITATION_ERROR';
        }

        if (message.includes('research') || contextType === 'research') {
            return 'RESEARCH_ERROR';
        }

        if (message.includes('file') || message.includes('path') || message.includes('resource')) {
            return 'RESOURCE_ERROR';
        }

        if (message.includes('config') || contextType === 'configuration') {
            return 'CONFIG_ERROR';
        }

        // Default to system error
        return 'SYSTEM_ERROR';
    }

    /**
     * Enhance error information with context
     */
    enhanceErrorInfo(errorInfo, context) {
        // Add operation information
        if (context.operation) {
            errorInfo.operation = context.operation;
        }

        // Add document information
        if (context.document) {
            errorInfo.document = {
                id: context.document.id,
                title: context.document.title,
                type: context.document.type
            };
        }

        // Add format information
        if (context.format) {
            errorInfo.format = context.format;
        }

        // Add processor information
        if (context.processor) {
            errorInfo.processor = context.processor;
        }

        // Add validation details
        if (context.validation) {
            errorInfo.validation = context.validation;
        }

        // Add suggestions
        errorInfo.suggestions = this.generateSuggestions(errorInfo, context);
    }

    /**
     * Generate error suggestions
     */
    generateSuggestions(errorInfo, context) {
        const suggestions = [];

        switch (errorInfo.type) {
            case 'VALIDATION_ERROR':
                suggestions.push('Check required fields are present');
                suggestions.push('Verify data types match expected format');
                suggestions.push('Review validation rules documentation');
                break;

            case 'COMPILATION_ERROR':
                suggestions.push('Check document structure and content');
                suggestions.push('Verify all sections have valid content');
                suggestions.push('Review compilation settings');
                break;

            case 'EXPORT_ERROR':
                suggestions.push('Check export format compatibility');
                suggestions.push('Verify processor configuration');
                suggestions.push('Try a different export format');
                break;

            case 'TEMPLATE_ERROR':
                suggestions.push('Validate template syntax');
                suggestions.push('Check template variable definitions');
                suggestions.push('Try using a default template');
                break;

            case 'CITATION_ERROR':
                suggestions.push('Check citation data completeness');
                suggestions.push('Verify citation format compatibility');
                suggestions.push('Review citation style requirements');
                break;

            case 'RESEARCH_ERROR':
                suggestions.push('Check research data availability');
                suggestions.push('Verify integration settings');
                suggestions.push('Try disabling research integration');
                break;

            case 'RESOURCE_ERROR':
                suggestions.push('Check file permissions');
                suggestions.push('Verify file paths exist');
                suggestions.push('Check disk space availability');
                break;

            case 'CONFIG_ERROR':
                suggestions.push('Review configuration settings');
                suggestions.push('Check for missing required configuration');
                suggestions.push('Reset to default configuration');
                break;

            default:
                suggestions.push('Check system logs for more details');
                suggestions.push('Try restarting the operation');
                suggestions.push('Contact support if issue persists');
        }

        return suggestions;
    }

    /**
     * Attempt error recovery
     */
    async attemptRecovery(errorInfo, context) {
        const strategy = this.recoveryStrategies.get(errorInfo.type);
        if (!strategy) {
            return { success: false, reason: 'No recovery strategy available' };
        }

        const maxAttempts = strategy.maxAttempts || 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.log('info', `Attempting recovery for ${errorInfo.type}, attempt ${attempt}/${maxAttempts}`);
                
                const result = await strategy.strategy(errorInfo, context, attempt);
                
                if (result.success) {
                    this.log('info', `Recovery successful on attempt ${attempt}`);
                    return result;
                }

                if (attempt < maxAttempts) {
                    await this.delay(this.options.retryDelay * attempt);
                }
            } catch (recoveryError) {
                this.log('error', `Recovery attempt ${attempt} failed: ${recoveryError.message}`);
                
                if (attempt === maxAttempts) {
                    return { 
                        success: false, 
                        reason: `All recovery attempts failed. Last error: ${recoveryError.message}` 
                    };
                }
            }
        }

        return { success: false, reason: 'Recovery attempts exhausted' };
    }

    // Recovery strategy implementations

    async recoverFromValidationError(errorInfo, context, attempt) {
        // Try to fix common validation issues
        if (context.document) {
            const document = { ...context.document };
            
            // Add missing required fields with defaults
            if (!document.title) document.title = 'Untitled Document';
            if (!document.author) document.author = 'Unknown Author';
            if (!document.content && (!document.sections || document.sections.length === 0)) {
                document.sections = [{ title: 'Content', content: 'No content provided' }];
            }

            return {
                success: true,
                result: { document },
                message: 'Added default values for missing required fields'
            };
        }

        return { success: false, reason: 'Cannot recover: insufficient context' };
    }

    async recoverFromCompilationError(errorInfo, context, attempt) {
        if (attempt === 1) {
            // Try with simplified options
            const simplifiedOptions = {
                ...context.options,
                processMarkdown: false,
                resolveReferences: false,
                extractMetadata: false
            };

            return {
                success: true,
                result: { options: simplifiedOptions },
                message: 'Retrying with simplified compilation options'
            };
        }

        return { success: false, reason: 'Simplified compilation still failed' };
    }

    async recoverFromExportError(errorInfo, context, attempt) {
        if (context.format && attempt === 1) {
            // Try with basic format options
            const basicOptions = {
                includeTOC: false,
                includeHeaders: false,
                includeFooters: false
            };

            return {
                success: true,
                result: { options: basicOptions },
                message: 'Retrying with basic export options'
            };
        }

        return { success: false, reason: 'Basic export options still failed' };
    }

    async recoverFromTemplateError(errorInfo, context, attempt) {
        // Fall back to default template
        return {
            success: true,
            result: { useDefaultTemplate: true },
            message: 'Using default template instead'
        };
    }

    async recoverFromResourceError(errorInfo, context, attempt) {
        // Retry with delay (resource might be temporarily unavailable)
        await this.delay(this.options.retryDelay * attempt);
        
        return {
            success: true,
            result: { retry: true },
            message: `Retrying resource access after delay`
        };
    }

    // Validation implementations

    validateDocument(document) {
        const errors = [];
        const warnings = [];

        if (!document) {
            errors.push('Document is required');
            return { valid: false, errors, warnings };
        }

        if (!document.title) {
            warnings.push('Document has no title');
        }

        if (!document.content && (!document.sections || document.sections.length === 0)) {
            errors.push('Document must have content or sections');
        }

        if (document.sections) {
            document.sections.forEach((section, index) => {
                if (!section.title) {
                    warnings.push(`Section ${index + 1} has no title`);
                }
                if (!section.content) {
                    warnings.push(`Section ${index + 1} has no content`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateTemplate(template) {
        const errors = [];
        const warnings = [];

        if (!template) {
            return { valid: true, errors, warnings }; // Template is optional
        }

        if (typeof template !== 'object') {
            errors.push('Template must be an object');
            return { valid: false, errors, warnings };
        }

        if (!template.name) {
            errors.push('Template must have a name');
        }

        if (!template.template) {
            errors.push('Template must have template content');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateExportOptions(options) {
        const errors = [];
        const warnings = [];

        if (!options || typeof options !== 'object') {
            return { valid: true, errors, warnings }; // Options are optional
        }

        if (options.format && typeof options.format !== 'string') {
            errors.push('Format must be a string');
        }

        if (options.template && typeof options.template !== 'string') {
            errors.push('Template ID must be a string');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateCitations(citations) {
        const errors = [];
        const warnings = [];

        if (!citations) {
            return { valid: true, errors, warnings }; // Citations are optional
        }

        if (!Array.isArray(citations)) {
            errors.push('Citations must be an array');
            return { valid: false, errors, warnings };
        }

        citations.forEach((citation, index) => {
            if (!citation.id && !citation.key) {
                warnings.push(`Citation ${index + 1} has no ID or key`);
            }
            if (!citation.title) {
                warnings.push(`Citation ${index + 1} has no title`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateFilePath(path) {
        const errors = [];
        const warnings = [];

        if (!path) {
            return { valid: true, errors, warnings }; // Path is optional
        }

        if (typeof path !== 'string') {
            errors.push('File path must be a string');
            return { valid: false, errors, warnings };
        }

        // Check for potentially dangerous paths
        if (path.includes('..')) {
            warnings.push('Path contains directory traversal');
        }

        if (path.length > 260) {
            warnings.push('Path may be too long for some systems');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate data using specified validator
     */
    async validate(validatorName, data) {
        const validator = this.validators.get(validatorName);
        if (!validator) {
            throw new Error(`Unknown validator: ${validatorName}`);
        }

        try {
            return validator.validate(data);
        } catch (error) {
            return {
                valid: false,
                errors: [`Validation failed: ${error.message}`],
                warnings: []
            };
        }
    }

    /**
     * Log error information
     */
    logError(errorInfo) {
        this.errorLog.push(errorInfo);
        
        // Keep only recent errors to prevent memory bloat
        if (this.errorLog.length > 1000) {
            this.errorLog = this.errorLog.slice(-500);
        }

        // Log to console based on severity and log level
        this.log(errorInfo.severity, `Error ${errorInfo.id}: ${errorInfo.message}`, errorInfo);
    }

    /**
     * Log message with level
     */
    log(level, message, data = null) {
        if (!this.options.enableLogging) return;

        const levels = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
        const currentLevel = levels[this.options.logLevel] || 2;
        const messageLevel = levels[level] || 1;

        if (messageLevel >= currentLevel) {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
            
            if (data) {
                console[level] || console.log(logMessage, data);
            } else {
                console[level] || console.log(logMessage);
            }
        }
    }

    /**
     * Update error statistics
     */
    updateErrorStats(errorInfo) {
        const key = `${errorInfo.type}_${errorInfo.severity}`;
        const current = this.errorStats.get(key) || 0;
        this.errorStats.set(key, current + 1);
    }

    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Delay utility for recovery attempts
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics
     */
    getStats() {
        return {
            totalErrors: this.errorLog.length,
            errorsByType: Object.fromEntries(this.errorStats.entries()),
            recentErrors: this.errorLog.slice(-10).map(error => ({
                id: error.id,
                type: error.type,
                message: error.message,
                timestamp: error.timestamp
            }))
        };
    }

    /**
     * Get error log
     */
    getErrorLog(limit = 50) {
        return this.errorLog.slice(-limit);
    }

    /**
     * Clear error log
     */
    clearErrorLog() {
        this.errorLog = [];
        this.errorStats.clear();
        console.log('Error log cleared');
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.clearErrorLog();
        this.errorTypes.clear();
        this.validators.clear();
        this.recoveryStrategies.clear();
        this.isInitialized = false;
        console.log('Error handler destroyed');
    }
}