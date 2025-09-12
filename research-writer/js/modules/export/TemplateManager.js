/**
 * TemplateManager - Document template management system
 * Provides template-based document generation with customizable formatting
 * Supports various document types and export formats
 */

export class TemplateManager {
    constructor(options = {}) {
        this.options = {
            templateDir: options.templateDir || './templates',
            enableCache: options.enableCache !== false,
            validateTemplates: options.validateTemplates !== false,
            allowCustomTemplates: options.allowCustomTemplates !== false,
            maxTemplateSize: options.maxTemplateSize || 1024 * 1024, // 1MB
            ...options
        };

        this.templates = new Map();
        this.templateCache = new Map();
        this.templateVars = new Map();
        this.templateFunctions = new Map();

        this.isInitialized = false;
    }

    async init() {
        try {
            await this.loadDefaultTemplates();
            await this.initializeTemplateFunctions();
            this.isInitialized = true;
            console.log('Template manager initialized');
        } catch (error) {
            console.error('Template manager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load default templates
     */
    async loadDefaultTemplates() {
        // Academic paper templates
        this.registerTemplate('academic-paper', {
            name: 'Academic Paper',
            type: 'academic',
            formats: ['pdf', 'docx', 'latex'],
            template: this.createAcademicPaperTemplate(),
            variables: {
                title: { required: true, type: 'string' },
                author: { required: true, type: 'string' },
                institution: { required: false, type: 'string' },
                abstract: { required: true, type: 'text' },
                keywords: { required: false, type: 'array' },
                acknowledgments: { required: false, type: 'text' }
            }
        });

        // Research report template
        this.registerTemplate('research-report', {
            name: 'Research Report',
            type: 'report',
            formats: ['pdf', 'docx'],
            template: this.createResearchReportTemplate(),
            variables: {
                title: { required: true, type: 'string' },
                author: { required: true, type: 'string' },
                organization: { required: false, type: 'string' },
                date: { required: true, type: 'date' },
                executive_summary: { required: false, type: 'text' },
                methodology: { required: false, type: 'text' }
            }
        });

        // Thesis template
        this.registerTemplate('thesis', {
            name: 'Thesis/Dissertation',
            type: 'academic',
            formats: ['pdf', 'latex'],
            template: this.createThesisTemplate(),
            variables: {
                title: { required: true, type: 'string' },
                author: { required: true, type: 'string' },
                degree: { required: true, type: 'string' },
                university: { required: true, type: 'string' },
                department: { required: false, type: 'string' },
                advisor: { required: false, type: 'string' },
                defense_date: { required: false, type: 'date' }
            }
        });

        // Simple article template
        this.registerTemplate('article', {
            name: 'Simple Article',
            type: 'general',
            formats: ['pdf', 'docx', 'html'],
            template: this.createArticleTemplate(),
            variables: {
                title: { required: true, type: 'string' },
                author: { required: false, type: 'string' },
                date: { required: false, type: 'date' },
                subtitle: { required: false, type: 'string' }
            }
        });

        // Technical manual template
        this.registerTemplate('technical-manual', {
            name: 'Technical Manual',
            type: 'technical',
            formats: ['pdf', 'docx', 'html'],
            template: this.createTechnicalManualTemplate(),
            variables: {
                title: { required: true, type: 'string' },
                version: { required: false, type: 'string' },
                author: { required: false, type: 'string' },
                organization: { required: false, type: 'string' },
                revision_date: { required: false, type: 'date' }
            }
        });

        console.log(`Loaded ${this.templates.size} default templates`);
    }

    /**
     * Initialize template functions
     */
    async initializeTemplateFunctions() {
        // Date formatting function
        this.templateFunctions.set('formatDate', (date, format = 'YYYY-MM-DD') => {
            if (!date) return '';
            const d = new Date(date);
            
            switch (format) {
                case 'YYYY-MM-DD':
                    return d.toISOString().split('T')[0];
                case 'MM/DD/YYYY':
                    return d.toLocaleDateString('en-US');
                case 'DD/MM/YYYY':
                    return d.toLocaleDateString('en-GB');
                case 'Month DD, YYYY':
                    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                default:
                    return d.toLocaleDateString();
            }
        });

        // Author formatting function
        this.templateFunctions.set('formatAuthors', (authors, format = 'full') => {
            if (!authors) return '';
            if (typeof authors === 'string') return authors;
            if (!Array.isArray(authors)) return '';
            
            switch (format) {
                case 'last-first':
                    return authors.map(author => {
                        const parts = author.split(' ');
                        if (parts.length >= 2) {
                            const last = parts[parts.length - 1];
                            const first = parts.slice(0, -1).join(' ');
                            return `${last}, ${first}`;
                        }
                        return author;
                    }).join('; ');
                case 'initials':
                    return authors.map(author => {
                        const parts = author.split(' ');
                        if (parts.length >= 2) {
                            const last = parts[parts.length - 1];
                            const initials = parts.slice(0, -1).map(name => name[0] + '.').join(' ');
                            return `${last}, ${initials}`;
                        }
                        return author;
                    }).join('; ');
                default:
                    return authors.join(', ');
            }
        });

        // Word count function
        this.templateFunctions.set('wordCount', (text) => {
            if (!text) return 0;
            return text.split(/\s+/).filter(word => word.length > 0).length;
        });

        // Text excerpt function
        this.templateFunctions.set('excerpt', (text, length = 200) => {
            if (!text) return '';
            if (text.length <= length) return text;
            return text.substring(0, length) + '...';
        });

        // List formatting function
        this.templateFunctions.set('formatList', (items, separator = ', ') => {
            if (!items) return '';
            if (typeof items === 'string') return items;
            if (Array.isArray(items)) return items.join(separator);
            return items.toString();
        });

        console.log(`Initialized ${this.templateFunctions.size} template functions`);
    }

    /**
     * Register a template
     */
    registerTemplate(id, templateConfig) {
        if (this.options.validateTemplates) {
            this.validateTemplate(templateConfig);
        }

        this.templates.set(id, {
            ...templateConfig,
            id,
            createdAt: new Date().toISOString(),
            custom: false
        });

        console.log(`Registered template: ${id}`);
    }

    /**
     * Register custom template
     */
    registerCustomTemplate(id, templateConfig) {
        if (!this.options.allowCustomTemplates) {
            throw new Error('Custom templates are not allowed');
        }

        this.validateTemplate(templateConfig);

        // Check template size
        const templateSize = JSON.stringify(templateConfig).length;
        if (templateSize > this.options.maxTemplateSize) {
            throw new Error(`Template size exceeds maximum: ${templateSize} bytes`);
        }

        this.templates.set(id, {
            ...templateConfig,
            id,
            createdAt: new Date().toISOString(),
            custom: true
        });

        console.log(`Registered custom template: ${id}`);
    }

    /**
     * Apply template to document
     */
    async applyTemplate(templateId, document, variables = {}, options = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const targetFormat = options.format || 'generic';
        if (!template.formats.includes(targetFormat) && !template.formats.includes('*')) {
            throw new Error(`Template ${templateId} does not support format ${targetFormat}`);
        }

        try {
            // Validate required variables
            this.validateTemplateVariables(template, variables);

            // Prepare template context
            const context = await this.prepareTemplateContext(document, variables, template, options);

            // Process template
            const processedTemplate = await this.processTemplate(template.template, context, targetFormat);

            console.log(`Applied template ${templateId} for format ${targetFormat}`);
            return processedTemplate;

        } catch (error) {
            console.error(`Template application failed for ${templateId}:`, error);
            throw new Error(`Template application failed: ${error.message}`);
        }
    }

    /**
     * Prepare template context
     */
    async prepareTemplateContext(document, variables, template, options) {
        const context = {
            // Document data
            document: {
                id: document.id,
                title: document.title,
                author: document.author,
                content: document.content,
                sections: document.sections || [],
                metadata: document.metadata || {},
                ...document
            },

            // Template variables
            variables: {
                ...template.variables,
                ...variables
            },

            // Template metadata
            template: {
                id: template.id,
                name: template.name,
                type: template.type
            },

            // Processing options
            options: {
                format: options.format || 'generic',
                ...options
            },

            // Template functions
            functions: Object.fromEntries(this.templateFunctions.entries()),

            // System data
            system: {
                date: new Date().toISOString(),
                timestamp: Date.now(),
                generator: 'Research Writer Template Manager'
            }
        };

        return context;
    }

    /**
     * Process template with context
     */
    async processTemplate(template, context, format) {
        let processed = template;

        // Replace variables
        processed = this.replaceVariables(processed, context);

        // Process conditionals
        processed = this.processConditionals(processed, context);

        // Process loops
        processed = this.processLoops(processed, context);

        // Process functions
        processed = this.processFunctions(processed, context);

        // Format-specific processing
        processed = this.processFormatSpecific(processed, context, format);

        return processed;
    }

    /**
     * Replace template variables
     */
    replaceVariables(template, context) {
        let processed = template;

        // Simple variable replacement: {{variable}}
        processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
            const value = this.getNestedValue(context, varPath.trim());
            return value !== undefined ? value : '';
        });

        return processed;
    }

    /**
     * Process conditional blocks
     */
    processConditionals(template, context) {
        let processed = template;

        // Process if statements: {{#if variable}}content{{/if}}
        processed = processed.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, 
            (match, condition, content) => {
                const value = this.getNestedValue(context, condition.trim());
                return this.isTruthy(value) ? content : '';
            }
        );

        // Process unless statements: {{#unless variable}}content{{/unless}}
        processed = processed.replace(/\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, 
            (match, condition, content) => {
                const value = this.getNestedValue(context, condition.trim());
                return !this.isTruthy(value) ? content : '';
            }
        );

        return processed;
    }

    /**
     * Process loop blocks
     */
    processLoops(template, context) {
        let processed = template;

        // Process each loops: {{#each items}}content{{/each}}
        processed = processed.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, 
            (match, arrayPath, content) => {
                const array = this.getNestedValue(context, arrayPath.trim());
                if (!Array.isArray(array)) return '';

                return array.map((item, index) => {
                    let itemContent = content;
                    
                    // Replace {{this}} with current item
                    itemContent = itemContent.replace(/\{\{this\}\}/g, item);
                    
                    // Replace {{@index}} with current index
                    itemContent = itemContent.replace(/\{\{@index\}\}/g, index);
                    
                    // Replace item properties if item is object
                    if (typeof item === 'object' && item !== null) {
                        Object.keys(item).forEach(key => {
                            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                            itemContent = itemContent.replace(regex, item[key]);
                        });
                    }

                    return itemContent;
                }).join('');
            }
        );

        return processed;
    }

    /**
     * Process template functions
     */
    processFunctions(template, context) {
        let processed = template;

        // Process function calls: {{function_name(args)}}
        processed = processed.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)\}\}/g, 
            (match, funcName, argsStr) => {
                const func = this.templateFunctions.get(funcName);
                if (!func) {
                    console.warn(`Template function not found: ${funcName}`);
                    return match;
                }

                try {
                    // Parse arguments
                    const args = this.parseTemplateArgs(argsStr, context);
                    
                    // Call function
                    const result = func.apply(null, args);
                    return result !== undefined ? result : '';
                } catch (error) {
                    console.warn(`Template function ${funcName} failed:`, error.message);
                    return match;
                }
            }
        );

        return processed;
    }

    /**
     * Parse template function arguments
     */
    parseTemplateArgs(argsStr, context) {
        if (!argsStr.trim()) return [];

        const args = [];
        const parts = argsStr.split(',');

        for (const part of parts) {
            const arg = part.trim();
            
            // String literal
            if ((arg.startsWith('"') && arg.endsWith('"')) || 
                (arg.startsWith("'") && arg.endsWith("'"))) {
                args.push(arg.slice(1, -1));
            }
            // Number literal
            else if (/^\d+(\.\d+)?$/.test(arg)) {
                args.push(parseFloat(arg));
            }
            // Boolean literal
            else if (arg === 'true' || arg === 'false') {
                args.push(arg === 'true');
            }
            // Variable reference
            else {
                const value = this.getNestedValue(context, arg);
                args.push(value);
            }
        }

        return args;
    }

    /**
     * Process format-specific content
     */
    processFormatSpecific(template, context, format) {
        let processed = template;

        // Process format-specific blocks: {{#format:pdf}}content{{/format:pdf}}
        const formatRegex = new RegExp(`\\{\\{#format:${format}\\}\\}([\\s\\S]*?)\\{\\{\\/format:${format}\\}\\}`, 'g');
        processed = processed.replace(formatRegex, (match, content) => content);

        // Remove other format blocks
        processed = processed.replace(/\{\{#format:[^}]+\}\}[\s\S]*?\{\{\/format:[^}]+\}\}/g, '');

        return processed;
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : undefined;
        }, obj);
    }

    /**
     * Check if value is truthy for templates
     */
    isTruthy(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
    }

    /**
     * Validate template configuration
     */
    validateTemplate(template) {
        if (!template.name) {
            throw new Error('Template must have a name');
        }

        if (!template.template) {
            throw new Error('Template must have template content');
        }

        if (!template.formats || !Array.isArray(template.formats) || template.formats.length === 0) {
            throw new Error('Template must specify supported formats');
        }

        if (!template.variables || typeof template.variables !== 'object') {
            throw new Error('Template must have variables definition');
        }
    }

    /**
     * Validate template variables
     */
    validateTemplateVariables(template, variables) {
        const errors = [];

        for (const [varName, varConfig] of Object.entries(template.variables)) {
            const value = variables[varName];

            if (varConfig.required && (value === undefined || value === null || value === '')) {
                errors.push(`Required variable missing: ${varName}`);
            }

            if (value !== undefined && varConfig.type) {
                if (!this.validateVariableType(value, varConfig.type)) {
                    errors.push(`Invalid type for variable ${varName}: expected ${varConfig.type}`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Template variable validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Validate variable type
     */
    validateVariableType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'date':
                return value instanceof Date || !isNaN(new Date(value).getTime());
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'text':
                return typeof value === 'string';
            default:
                return true; // Unknown type, allow anything
        }
    }

    /**
     * Get available templates
     */
    getTemplates(type = null) {
        const templates = Array.from(this.templates.values());
        
        if (type) {
            return templates.filter(template => template.type === type);
        }
        
        return templates;
    }

    /**
     * Get template by ID
     */
    getTemplate(templateId) {
        return this.templates.get(templateId) || null;
    }

    /**
     * Remove template
     */
    removeTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (template && template.custom) {
            this.templates.delete(templateId);
            console.log(`Removed custom template: ${templateId}`);
            return true;
        }
        return false;
    }

    // Default template definitions

    createAcademicPaperTemplate() {
        return `{{#format:latex}}\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage[margin=1in]{geometry}
\\usepackage{natbib}

\\title{{{variables.title}}}
\\author{{{formatAuthors(variables.author)}}}
{{#if variables.institution}}
\\affiliation{{{variables.institution}}}
{{/if}}
\\date{\\today}

\\begin{document}
\\maketitle

{{#if variables.abstract}}
\\begin{abstract}
{{variables.abstract}}
{{#if variables.keywords}}
\\\\[1em]
\\textbf{Keywords:} {{formatList(variables.keywords)}}
{{/if}}
\\end{abstract}
{{/if}}

{{/format:latex}}{{#format:pdf}}# {{variables.title}}

**Author:** {{formatAuthors(variables.author)}}
{{#if variables.institution}}**Institution:** {{variables.institution}}{{/if}}
**Date:** {{formatDate(system.date, "Month DD, YYYY")}}

{{#if variables.abstract}}
## Abstract

{{variables.abstract}}

{{#if variables.keywords}}**Keywords:** {{formatList(variables.keywords)}}{{/if}}
{{/if}}

{{/format:pdf}}{{#format:docx}}{{variables.title}}

{{formatAuthors(variables.author)}}
{{#if variables.institution}}{{variables.institution}}{{/if}}
{{formatDate(system.date, "Month DD, YYYY")}}

{{#if variables.abstract}}
Abstract

{{variables.abstract}}

{{#if variables.keywords}}Keywords: {{formatList(variables.keywords)}}{{/if}}
{{/if}}

{{/format:docx}}{{#each document.sections}}
{{#format:latex}}\\section{{{title}}}{{/format:latex}}{{#format:pdf}}## {{title}}{{/format:pdf}}{{#format:docx}}{{title}}{{/format:docx}}

{{content}}

{{/each}}

{{#if document.bibliography}}
{{#format:latex}}\\bibliographystyle{plain}
\\bibliography{references}{{/format:latex}}{{#format:pdf}}## References{{/format:pdf}}{{#format:docx}}References{{/format:docx}}

{{#each document.bibliography.entries}}
{{formatted}}

{{/each}}
{{/if}}

{{#if variables.acknowledgments}}
{{#format:latex}}\\section*{Acknowledgments}{{/format:latex}}{{#format:pdf}}## Acknowledgments{{/format:pdf}}{{#format:docx}}Acknowledgments{{/format:docx}}

{{variables.acknowledgments}}
{{/if}}

{{#format:latex}}\\end{document}{{/format:latex}}`;
    }

    createResearchReportTemplate() {
        return `# {{variables.title}}

**Author:** {{variables.author}}
{{#if variables.organization}}**Organization:** {{variables.organization}}{{/if}}
**Date:** {{formatDate(variables.date, "Month DD, YYYY")}}

---

{{#if variables.executive_summary}}
## Executive Summary

{{variables.executive_summary}}

{{/if}}
## Table of Contents

{{#each document.sections}}
{{@index}}. {{title}}
{{/each}}

{{#if variables.methodology}}
## Methodology

{{variables.methodology}}

{{/if}}
{{#each document.sections}}
## {{title}}

{{content}}

{{/each}}

## Conclusion

[Conclusion section to be filled]

{{#if document.bibliography}}
## References

{{#each document.bibliography.entries}}
{{@index}}. {{formatted}}

{{/each}}
{{/if}}`;
    }

    createThesisTemplate() {
        return `{{#format:latex}}\\documentclass[12pt,twoside]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{setspace}
\\usepackage{natbib}
\\usepackage{graphicx}

\\title{{{variables.title}}}
\\author{{{variables.author}}}
\\date{{{formatDate(variables.defense_date, "Month DD, YYYY")}}}

\\begin{document}

\\begin{titlepage}
\\centering
\\vspace*{2cm}

{\\Large {{variables.university}} \\\\}
{{#if variables.department}}{\\large {{variables.department}} \\\\}{{/if}}
\\vspace{2cm}

{\\Huge {{variables.title}} \\\\}
\\vspace{2cm}

{\\large A {{variables.degree}} presented by \\\\}
\\vspace{0.5cm}
{\\Large {{variables.author}} \\\\}
\\vspace{1cm}

{{#if variables.advisor}}{\\normalsize Advisor: {{variables.advisor}} \\\\}{{/if}}
\\vspace{2cm}

{\\normalsize {{formatDate(variables.defense_date, "Month DD, YYYY")}}}

\\end{titlepage}

\\doublespacing

{{/format:latex}}{{#format:pdf}}# {{variables.title}}

**A {{variables.degree}}**

**Presented by {{variables.author}}**

{{variables.university}}
{{#if variables.department}}{{variables.department}}{{/if}}

{{#if variables.advisor}}**Advisor:** {{variables.advisor}}{{/if}}

**{{formatDate(variables.defense_date, "Month DD, YYYY")}}**

---

{{/format:pdf}}{{#each document.sections}}
{{#format:latex}}\\chapter{{{title}}}{{/format:latex}}{{#format:pdf}}## {{title}}{{/format:pdf}}

{{content}}

{{/each}}

{{#if document.bibliography}}
{{#format:latex}}\\bibliographystyle{plain}
\\bibliography{references}{{/format:latex}}{{#format:pdf}}## Bibliography{{/format:pdf}}

{{#each document.bibliography.entries}}
{{formatted}}

{{/each}}
{{/if}}

{{#format:latex}}\\end{document}{{/format:latex}}`;
    }

    createArticleTemplate() {
        return `# {{variables.title}}

{{#if variables.subtitle}}## {{variables.subtitle}}{{/if}}

{{#if variables.author}}**By {{variables.author}}**{{/if}}
{{#if variables.date}}**{{formatDate(variables.date, "Month DD, YYYY")}}**{{/if}}

---

{{#each document.sections}}
## {{title}}

{{content}}

{{/each}}

{{#if document.bibliography}}
## References

{{#each document.bibliography.entries}}
- {{formatted}}
{{/each}}
{{/if}}`;
    }

    createTechnicalManualTemplate() {
        return `# {{variables.title}}

{{#if variables.version}}**Version:** {{variables.version}}{{/if}}
{{#if variables.author}}**Author:** {{variables.author}}{{/if}}
{{#if variables.organization}}**Organization:** {{variables.organization}}{{/if}}
{{#if variables.revision_date}}**Last Revised:** {{formatDate(variables.revision_date, "Month DD, YYYY")}}{{/if}}

---

## Table of Contents

{{#each document.sections}}
{{@index}}. [{{title}}](#{{title}})
{{/each}}

---

{{#each document.sections}}
## {{title}} {#{{title}}}

{{content}}

{{/each}}

---

*This document was generated automatically by Research Writer Template System.*`;
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
        console.log('Template cache cleared');
    }

    /**
     * Get template statistics
     */
    getStats() {
        return {
            totalTemplates: this.templates.size,
            customTemplates: Array.from(this.templates.values()).filter(t => t.custom).length,
            cacheSize: this.templateCache.size,
            templateFunctions: this.templateFunctions.size
        };
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.clearCache();
        this.templates.clear();
        this.templateVars.clear();
        this.templateFunctions.clear();
        this.isInitialized = false;
        console.log('Template manager destroyed');
    }
}