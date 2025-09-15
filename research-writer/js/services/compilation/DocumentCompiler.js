/**
 * DocumentCompiler - Central document compilation service
 * Coordinates the compilation of documents with integrated citation and research data
 * Prepares documents for format-specific processors with content aggregation and validation
 */

export class DocumentCompiler {
    constructor(options = {}) {
        this.options = {
            validateContent: options.validateContent !== false,
            sanitizeHtml: options.sanitizeHtml !== false,
            processMarkdown: options.processMarkdown !== false,
            extractMetadata: options.extractMetadata !== false,
            resolveReferences: options.resolveReferences !== false,
            optimizeImages: options.optimizeImages || false,
            compressContent: options.compressContent || false,
            enableCache: options.enableCache !== false,
            timeout: options.timeout || 30000,
            ...options
        };

        this.compilationCache = new Map();
        this.referenceRegistry = new Map();
        this.metadataExtractors = new Map();
        this.contentProcessors = new Map();
        this.validationRules = new Map();

        this.isInitialized = false;
    }

    async init() {
        try {
            await this.initializeProcessors();
            await this.initializeValidators();
            await this.initializeExtractors();
            this.isInitialized = true;
            console.log('Document compiler initialized');
        } catch (error) {
            console.error('Document compiler initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize content processors
     */
    async initializeProcessors() {
        // Markdown processor
        this.contentProcessors.set('markdown', {
            name: 'markdown',
            process: this.processMarkdown.bind(this),
            supports: ['md', 'markdown', 'text']
        });

        // HTML processor
        this.contentProcessors.set('html', {
            name: 'html',
            process: this.processHtml.bind(this),
            supports: ['html', 'htm']
        });

        // Plain text processor
        this.contentProcessors.set('text', {
            name: 'text',
            process: this.processPlainText.bind(this),
            supports: ['txt', 'text']
        });

        console.log('Content processors initialized');
    }

    /**
     * Initialize content validators
     */
    async initializeValidators() {
        // Structure validation
        this.validationRules.set('structure', {
            name: 'structure',
            validate: this.validateStructure.bind(this),
            critical: true
        });

        // Content validation
        this.validationRules.set('content', {
            name: 'content',
            validate: this.validateContent.bind(this),
            critical: true
        });

        // Reference validation
        this.validationRules.set('references', {
            name: 'references',
            validate: this.validateReferences.bind(this),
            critical: false
        });

        // Metadata validation
        this.validationRules.set('metadata', {
            name: 'metadata',
            validate: this.validateMetadata.bind(this),
            critical: false
        });

        console.log('Validation rules initialized');
    }

    /**
     * Initialize metadata extractors
     */
    async initializeExtractors() {
        // Document metadata extractor
        this.metadataExtractors.set('document', {
            extract: this.extractDocumentMetadata.bind(this),
            priority: 1
        });

        // Content metadata extractor
        this.metadataExtractors.set('content', {
            extract: this.extractContentMetadata.bind(this),
            priority: 2
        });

        // Reference metadata extractor
        this.metadataExtractors.set('references', {
            extract: this.extractReferenceMetadata.bind(this),
            priority: 3
        });

        console.log('Metadata extractors initialized');
    }

    /**
     * Compile document with all integrations
     */
    async compile(document, context = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        const compilationId = this.generateCompilationId();
        const startTime = Date.now();

        try {
            console.log(`Starting compilation ${compilationId}`);

            // Step 1: Validate input
            await this.validateInput(document, context);

            // Step 2: Create compilation context
            const compilationContext = await this.createCompilationContext(document, context, compilationId);

            // Step 3: Process document structure
            const structuredDocument = await this.processDocumentStructure(document, compilationContext);

            // Step 4: Integrate citations
            const documentWithCitations = await this.integrateCitations(structuredDocument, compilationContext);

            // Step 5: Integrate research data
            const documentWithResearch = await this.integrateResearchData(documentWithCitations, compilationContext);

            // Step 6: Process content
            const processedDocument = await this.processDocumentContent(documentWithResearch, compilationContext);

            // Step 7: Extract and merge metadata
            const documentWithMetadata = await this.extractAndMergeMetadata(processedDocument, compilationContext);

            // Step 8: Resolve references and cross-references
            const resolvedDocument = await this.resolveReferences(documentWithMetadata, compilationContext);

            // Step 9: Final validation
            await this.performFinalValidation(resolvedDocument, compilationContext);

            // Step 10: Create compiled result
            const compiledDocument = await this.createCompiledDocument(resolvedDocument, compilationContext);

            const processingTime = Date.now() - startTime;
            console.log(`Compilation ${compilationId} completed in ${processingTime}ms`);

            return compiledDocument;

        } catch (error) {
            console.error(`Compilation ${compilationId} failed:`, error);
            throw new Error(`Document compilation failed: ${error.message}`);
        }
    }

    /**
     * Validate input document and context
     */
    async validateInput(document, context) {
        if (!document) {
            throw new Error('Document is required for compilation');
        }

        if (!document.content && !document.sections) {
            throw new Error('Document must have content or sections');
        }

        // Additional validation if enabled
        if (this.options.validateContent) {
            const validation = await this.runValidation('structure', document);
            if (!validation.valid && validation.critical) {
                throw new Error(`Document structure validation failed: ${validation.errors.join(', ')}`);
            }
        }
    }

    /**
     * Create compilation context
     */
    async createCompilationContext(document, context, compilationId) {
        const compilationContext = {
            id: compilationId,
            startTime: Date.now(),
            document: { ...document },
            originalContext: { ...context },
            options: { ...this.options },
            metadata: {},
            citations: context.citations || [],
            bibliography: context.bibliography || null,
            research: context.research || null,
            notes: context.notes || [],
            references: new Map(),
            processingFlags: new Set(),
            errors: [],
            warnings: []
        };

        // Set processing flags based on options
        if (this.options.processMarkdown) compilationContext.processingFlags.add('markdown');
        if (this.options.sanitizeHtml) compilationContext.processingFlags.add('sanitize_html');
        if (this.options.resolveReferences) compilationContext.processingFlags.add('resolve_references');

        return compilationContext;
    }

    /**
     * Process document structure
     */
    async processDocumentStructure(document, context) {
        const structured = {
            id: document.id || `doc_${Date.now()}`,
            title: document.title || 'Untitled Document',
            author: document.author || null,
            date: document.date || new Date().toISOString(),
            abstract: document.abstract || null,
            keywords: Array.isArray(document.keywords) ? document.keywords : [],
            sections: [],
            content: null,
            metadata: document.metadata || {}
        };

        // Process sections or convert content to sections
        if (document.sections && Array.isArray(document.sections)) {
            structured.sections = document.sections.map((section, index) => ({
                id: section.id || `section_${index}`,
                title: section.title || `Section ${index + 1}`,
                level: section.level || 1,
                content: section.content || '',
                metadata: section.metadata || {},
                pageBreakBefore: section.pageBreakBefore || false,
                pageBreakAfter: section.pageBreakAfter || false
            }));
        } else if (document.content) {
            // Convert single content to sections
            structured.sections = [{
                id: 'main_content',
                title: structured.title,
                level: 1,
                content: document.content,
                metadata: {}
            }];
        }

        console.log(`Processed document structure with ${structured.sections.length} sections`);
        return structured;
    }

    /**
     * Integrate citations into document
     */
    async integrateCitations(document, context) {
        if (!context.citations || context.citations.length === 0) {
            return document;
        }

        const documentWithCitations = { ...document };

        // Process citations in content
        for (const section of documentWithCitations.sections) {
            section.content = this.processCitationsInContent(section.content, context.citations);
        }

        // Add bibliography if available
        if (context.bibliography) {
            documentWithCitations.bibliography = context.bibliography;
        }

        console.log(`Integrated ${context.citations.length} citations`);
        return documentWithCitations;
    }

    /**
     * Process citations in content
     */
    processCitationsInContent(content, citations) {
        let processed = content;

        // Create citation map for quick lookup
        const citationMap = new Map();
        citations.forEach(citation => {
            if (citation.id) citationMap.set(citation.id, citation);
            if (citation.key) citationMap.set(citation.key, citation);
        });

        // Process citation references
        processed = processed.replace(/\[@?([^\]]+)\]/g, (match, citationRef) => {
            const citation = citationMap.get(citationRef);
            if (citation) {
                // Return formatted citation reference
                return `[${citation.authors?.[0] || 'Unknown'}, ${citation.year || 'n.d.'}]`;
            }
            return match; // Keep original if not found
        });

        return processed;
    }

    /**
     * Integrate research data
     */
    async integrateResearchData(document, context) {
        if (!context.research && !context.notes) {
            return document;
        }

        const documentWithResearch = { ...document };

        // Add research metadata
        if (context.research) {
            documentWithResearch.metadata.research = {
                analysisData: context.research.analysisData || null,
                connections: context.research.connections || [],
                gaps: context.research.gaps || []
            };
        }

        // Integrate notes
        if (context.notes && context.notes.length > 0) {
            documentWithResearch.metadata.notes = context.notes.map(note => ({
                id: note.id,
                title: note.title,
                content: note.content,
                tags: note.tags || []
            }));
        }

        console.log('Research data integrated');
        return documentWithResearch;
    }

    /**
     * Process document content
     */
    async processDocumentContent(document, context) {
        const processedDocument = { ...document };

        // Process each section's content
        for (let i = 0; i < processedDocument.sections.length; i++) {
            const section = processedDocument.sections[i];
            
            // Determine content type
            const contentType = this.detectContentType(section.content);
            
            // Get appropriate processor
            const processor = this.getContentProcessor(contentType);
            
            if (processor) {
                try {
                    section.content = await processor.process(section.content, context);
                    console.log(`Processed section ${section.id} with ${contentType} processor`);
                } catch (error) {
                    context.warnings.push(`Failed to process section ${section.id}: ${error.message}`);
                }
            }
        }

        return processedDocument;
    }

    /**
     * Detect content type
     */
    detectContentType(content) {
        if (!content || typeof content !== 'string') return 'text';

        // Check for HTML tags
        if (/<[^>]+>/.test(content)) return 'html';
        
        // Check for Markdown syntax
        if (/^#{1,6}\s|^\*\*.*\*\*|\*.*\*|^\* |^\d+\. |\[.*\]\(.*\)/m.test(content)) return 'markdown';
        
        return 'text';
    }

    /**
     * Get content processor
     */
    getContentProcessor(contentType) {
        return this.contentProcessors.get(contentType) || this.contentProcessors.get('text');
    }

    /**
     * Process Markdown content
     */
    async processMarkdown(content, context) {
        if (!this.options.processMarkdown) return content;

        let processed = content;

        // Basic Markdown processing (in a real implementation, use a proper Markdown parser)
        processed = processed
            .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
            .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
            .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
            .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
            .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
            .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^\* (.+)$/gm, '<li>$1</li>')
            .replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');

        return processed;
    }

    /**
     * Process HTML content
     */
    async processHtml(content, context) {
        if (!this.options.sanitizeHtml) return content;

        // Basic HTML sanitization (in a real implementation, use a proper HTML sanitizer)
        let processed = content;

        // Remove dangerous elements
        processed = processed
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
            .replace(/<object[^>]*>.*?<\/object>/gi, '')
            .replace(/<embed[^>]*>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

        return processed;
    }

    /**
     * Process plain text content
     */
    async processPlainText(content, context) {
        // Just return the content as-is, maybe with some basic formatting
        return content.trim();
    }

    /**
     * Extract and merge metadata
     */
    async extractAndMergeMetadata(document, context) {
        if (!this.options.extractMetadata) return document;

        const documentWithMetadata = { ...document };
        const extractedMetadata = {};

        // Run all metadata extractors
        for (const [name, extractor] of this.metadataExtractors.entries()) {
            try {
                const metadata = await extractor.extract(document, context);
                extractedMetadata[name] = metadata;
            } catch (error) {
                context.warnings.push(`Metadata extraction failed for ${name}: ${error.message}`);
            }
        }

        // Merge extracted metadata with existing metadata
        documentWithMetadata.metadata = {
            ...document.metadata,
            ...extractedMetadata,
            compilation: {
                id: context.id,
                timestamp: new Date().toISOString(),
                processingFlags: Array.from(context.processingFlags)
            }
        };

        return documentWithMetadata;
    }

    /**
     * Extract document metadata
     */
    async extractDocumentMetadata(document, context) {
        return {
            wordCount: this.calculateWordCount(document),
            sectionCount: document.sections ? document.sections.length : 0,
            hasAbstract: Boolean(document.abstract),
            hasKeywords: Boolean(document.keywords && document.keywords.length > 0),
            estimatedReadTime: this.estimateReadTime(document)
        };
    }

    /**
     * Extract content metadata
     */
    async extractContentMetadata(document, context) {
        const contentStats = {
            totalCharacters: 0,
            totalWords: 0,
            headingCount: 0,
            listCount: 0,
            linkCount: 0,
            imageCount: 0,
            tableCount: 0
        };

        // Analyze each section
        document.sections?.forEach(section => {
            if (section.content) {
                const content = section.content;
                contentStats.totalCharacters += content.length;
                contentStats.totalWords += content.split(/\s+/).filter(w => w.length > 0).length;
                contentStats.headingCount += (content.match(/^#+\s/gm) || []).length;
                contentStats.listCount += (content.match(/^\* |^\d+\. /gm) || []).length;
                contentStats.linkCount += (content.match(/\[.*?\]\(.*?\)/g) || []).length;
                contentStats.imageCount += (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
                contentStats.tableCount += (content.match(/\|.*\|/g) || []).filter(line => line.includes('|')).length;
            }
        });

        return contentStats;
    }

    /**
     * Extract reference metadata
     */
    async extractReferenceMetadata(document, context) {
        const referenceStats = {
            citationCount: 0,
            uniqueCitations: 0,
            bibliographyEntries: 0,
            externalLinks: 0
        };

        // Count citations in content
        document.sections?.forEach(section => {
            if (section.content) {
                const citations = section.content.match(/\[@?[^\]]+\]/g) || [];
                referenceStats.citationCount += citations.length;
            }
        });

        if (context.citations) {
            referenceStats.uniqueCitations = context.citations.length;
        }

        if (context.bibliography?.entries) {
            referenceStats.bibliographyEntries = context.bibliography.entries.length;
        }

        return referenceStats;
    }

    /**
     * Resolve references and cross-references
     */
    async resolveReferences(document, context) {
        if (!this.options.resolveReferences) return document;

        const resolvedDocument = { ...document };
        
        // Build reference registry
        this.buildReferenceRegistry(resolvedDocument, context);

        // Resolve internal references
        for (const section of resolvedDocument.sections) {
            section.content = this.resolveInternalReferences(section.content, context);
        }

        console.log('References resolved');
        return resolvedDocument;
    }

    /**
     * Build reference registry
     */
    buildReferenceRegistry(document, context) {
        // Register sections
        document.sections?.forEach(section => {
            if (section.id) {
                context.references.set(section.id, {
                    type: 'section',
                    title: section.title,
                    level: section.level
                });
            }
        });

        // Register figures, tables, etc. would go here
        console.log(`Built reference registry with ${context.references.size} entries`);
    }

    /**
     * Resolve internal references
     */
    resolveInternalReferences(content, context) {
        // Resolve section references like [see Section](#section-id)
        return content.replace(/\[([^\]]*)\]\(#([^)]+)\)/g, (match, text, ref) => {
            const reference = context.references.get(ref);
            if (reference) {
                return `${text} (${reference.title})`;
            }
            return match;
        });
    }

    /**
     * Perform final validation
     */
    async performFinalValidation(document, context) {
        const validationResults = [];

        for (const [name, validator] of this.validationRules.entries()) {
            try {
                const result = await validator.validate(document, context);
                validationResults.push({ name, ...result });
                
                if (!result.valid && validator.critical) {
                    throw new Error(`Critical validation failed for ${name}: ${result.errors.join(', ')}`);
                }
                
                if (result.warnings) {
                    context.warnings.push(...result.warnings);
                }
            } catch (error) {
                if (validator.critical) {
                    throw error;
                } else {
                    context.warnings.push(`Validation failed for ${name}: ${error.message}`);
                }
            }
        }

        console.log(`Final validation completed with ${validationResults.length} checks`);
    }

    /**
     * Create compiled document
     */
    async createCompiledDocument(document, context) {
        const compiled = {
            ...document,
            compilationMetadata: {
                id: context.id,
                compiledAt: new Date().toISOString(),
                processingTime: Date.now() - context.startTime,
                processingFlags: Array.from(context.processingFlags),
                warnings: context.warnings,
                errors: context.errors,
                version: '1.0.0'
            }
        };

        // Clean up internal processing data
        delete compiled.metadata?.compilation;

        console.log(`Compiled document created with ${context.warnings.length} warnings`);
        return compiled;
    }

    // Validation methods
    async runValidation(validatorName, data) {
        const validator = this.validationRules.get(validatorName);
        if (!validator) {
            throw new Error(`Unknown validator: ${validatorName}`);
        }
        return await validator.validate(data);
    }

    validateStructure(document) {
        const errors = [];
        const warnings = [];

        if (!document.title) {
            warnings.push('Document has no title');
        }

        if (!document.sections || document.sections.length === 0) {
            if (!document.content) {
                errors.push('Document has no content or sections');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            critical: true
        };
    }

    validateContent(document) {
        const errors = [];
        const warnings = [];

        // Check for empty sections
        document.sections?.forEach((section, index) => {
            if (!section.content || section.content.trim().length === 0) {
                warnings.push(`Section ${index + 1} has no content`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            critical: false
        };
    }

    validateReferences(document) {
        const errors = [];
        const warnings = [];

        // Basic reference validation would go here
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            critical: false
        };
    }

    validateMetadata(document) {
        const errors = [];
        const warnings = [];

        if (!document.author) {
            warnings.push('Document has no author specified');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            critical: false
        };
    }

    // Utility methods
    generateCompilationId() {
        return `compile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateWordCount(document) {
        let totalWords = 0;
        
        document.sections?.forEach(section => {
            if (section.content) {
                totalWords += section.content.split(/\s+/).filter(word => word.length > 0).length;
            }
        });

        return totalWords;
    }

    estimateReadTime(document) {
        const wordCount = this.calculateWordCount(document);
        return Math.ceil(wordCount / 200); // Average reading speed: 200 words per minute
    }

    /**
     * Clear compilation cache
     */
    clearCache() {
        this.compilationCache.clear();
        console.log('Compilation cache cleared');
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.clearCache();
        this.referenceRegistry.clear();
        this.metadataExtractors.clear();
        this.contentProcessors.clear();
        this.validationRules.clear();
        this.isInitialized = false;
        console.log('Document compiler destroyed');
    }
}