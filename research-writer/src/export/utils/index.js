/**
 * Export System Utilities
 * Shared utilities for export processing and document handling
 */

import { EXPORT_FORMATS, CITATION_STYLES } from '../types/index.js';

/**
 * Document Processing Utilities
 */
export const DocumentUtils = {
    /**
     * Extract metadata from document
     */
    extractMetadata(document) {
        return {
            title: document.title || 'Untitled Document',
            author: document.author || 'Unknown Author',
            date: document.date || new Date().toISOString(),
            abstract: document.abstract || null,
            keywords: document.keywords || [],
            wordCount: this.calculateWordCount(document),
            sectionCount: document.sections?.length || 0,
            figureCount: this.countFigures(document),
            tableCount: this.countTables(document),
            citationCount: this.countCitations(document)
        };
    },

    /**
     * Calculate document word count
     */
    calculateWordCount(document) {
        let wordCount = 0;

        // Count title words
        if (document.title) {
            wordCount += document.title.split(/\s+/).filter(word => word.length > 0).length;
        }

        // Count abstract words
        if (document.abstract) {
            wordCount += document.abstract.split(/\s+/).filter(word => word.length > 0).length;
        }

        // Count section words
        if (document.sections) {
            for (const section of document.sections) {
                if (section.title) {
                    wordCount += section.title.split(/\s+/).filter(word => word.length > 0).length;
                }
                if (section.content) {
                    wordCount += section.content.split(/\s+/).filter(word => word.length > 0).length;
                }
            }
        }

        return wordCount;
    },

    /**
     * Count figures in document
     */
    countFigures(document) {
        let count = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.content) {
                    // Count markdown images and figure references
                    const figureMatches = section.content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
                    count += figureMatches.length;
                }
                if (section.figures) {
                    count += section.figures.length;
                }
            }
        }

        return count;
    },

    /**
     * Count tables in document
     */
    countTables(document) {
        let count = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.content) {
                    // Count markdown tables
                    const tableMatches = section.content.match(/\|(.+)\|\n\|(-+\|)+/g) || [];
                    count += tableMatches.length;
                }
                if (section.tables) {
                    count += section.tables.length;
                }
            }
        }

        return count;
    },

    /**
     * Count citations in document
     */
    countCitations(document) {
        let count = 0;

        if (document.sections) {
            for (const section of document.sections) {
                if (section.content) {
                    // Count citation references
                    const citationMatches = section.content.match(/\[@?[^\]]+\]/g) || [];
                    count += citationMatches.length;
                }
            }
        }

        if (document.citations) {
            count = Math.max(count, document.citations.length);
        }

        return count;
    },

    /**
     * Normalize document structure
     */
    normalizeDocument(document) {
        const normalized = {
            id: document.id || this.generateDocumentId(),
            title: document.title || 'Untitled Document',
            author: document.author || null,
            date: document.date || new Date().toISOString(),
            abstract: document.abstract || null,
            keywords: document.keywords || [],
            sections: [],
            citations: document.citations || [],
            bibliography: document.bibliography || null,
            metadata: document.metadata || {}
        };

        // Normalize sections
        if (document.sections && Array.isArray(document.sections)) {
            normalized.sections = document.sections.map((section, index) => ({
                id: section.id || `section-${index + 1}`,
                title: section.title || `Section ${index + 1}`,
                level: section.level || 1,
                content: section.content || '',
                subsections: section.subsections || [],
                figures: section.figures || [],
                tables: section.tables || [],
                pageBreakBefore: section.pageBreakBefore || false,
                pageBreakAfter: section.pageBreakAfter || false
            }));
        } else if (document.content) {
            // Convert single content block to section
            normalized.sections = [{
                id: 'main-content',
                title: normalized.title,
                level: 1,
                content: document.content,
                subsections: [],
                figures: [],
                tables: [],
                pageBreakBefore: false,
                pageBreakAfter: false
            }];
        }

        return normalized;
    },

    /**
     * Generate unique document ID
     */
    generateDocumentId() {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Validate document structure
     */
    validateStructure(document) {
        const errors = [];

        if (!document) {
            return { valid: false, errors: ['Document is required'] };
        }

        if (!document.title || typeof document.title !== 'string') {
            errors.push('Document must have a valid title');
        }

        if (!document.sections && !document.content) {
            errors.push('Document must have sections or content');
        }

        if (document.sections) {
            if (!Array.isArray(document.sections)) {
                errors.push('Sections must be an array');
            } else {
                document.sections.forEach((section, index) => {
                    if (!section.title) {
                        errors.push(`Section ${index + 1} must have a title`);
                    }
                    if (section.level && (section.level < 1 || section.level > 6)) {
                        errors.push(`Section ${index + 1} level must be between 1 and 6`);
                    }
                });
            }
        }

        return { valid: errors.length === 0, errors };
    }
};

/**
 * Content Processing Utilities
 */
export const ContentUtils = {
    /**
     * Clean content for export
     */
    cleanContent(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        return content
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove leading/trailing whitespace
            .trim()
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    },

    /**
     * Extract citations from content
     */
    extractCitations(content) {
        if (!content) return [];

        const citations = [];
        const citationRegex = /\[@?([^\]]+)\]/g;
        let match;

        while ((match = citationRegex.exec(content)) !== null) {
            const citation = match[1].trim();
            if (citation && !citations.includes(citation)) {
                citations.push(citation);
            }
        }

        return citations;
    },

    /**
     * Extract figures from content
     */
    extractFigures(content) {
        if (!content) return [];

        const figures = [];
        const figureRegex = /!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g;
        let match;

        while ((match = figureRegex.exec(content)) !== null) {
            const [fullMatch, caption, src, attributes] = match;
            figures.push({
                caption: caption || 'Untitled Figure',
                src: src,
                attributes: attributes ? this.parseAttributes(attributes) : {},
                originalText: fullMatch
            });
        }

        return figures;
    },

    /**
     * Extract tables from content
     */
    extractTables(content) {
        if (!content) return [];

        const tables = [];
        const tableRegex = /\|(.+)\|\n\|(-+\|)+\n((?:\|.+\|\n?)+)/g;
        let match;

        while ((match = tableRegex.exec(content)) !== null) {
            const [fullMatch, headerRow, , dataRows] = match;

            const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
            const rows = dataRows.trim().split('\n').map(row =>
                row.split('|').map(cell => cell.trim()).filter(cell => cell)
            );

            tables.push({
                headers,
                rows,
                caption: `Table ${tables.length + 1}`,
                originalText: fullMatch
            });
        }

        return tables;
    },

    /**
     * Parse attributes string
     */
    parseAttributes(attributeString) {
        const attributes = {};
        if (!attributeString) return attributes;

        const pairs = attributeString.split(',');
        pairs.forEach(pair => {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value) {
                attributes[key] = value.replace(/['"]/g, '');
            }
        });

        return attributes;
    },

    /**
     * Convert markdown formatting to structured format
     */
    parseMarkdownFormatting(content) {
        if (!content) return content;

        return content
            // Headers
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
            .replace(/^###### (.*$)/gim, '<h6>$1</h6>')

            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')

            // Code
            .replace(/`(.*?)`/g, '<code>$1</code>')

            // Lists
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<oli>$1</oli>')

            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<link href="$2">$1</link>');
    },

    /**
     * Strip formatting for plain text
     */
    stripFormatting(content) {
        if (!content) return '';

        return content
            // Remove markdown formatting
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^#+\s/gm, '')
            .replace(/^\*\s/gm, '')
            .replace(/^\d+\.\s/gm, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '')

            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }
};

/**
 * Format-Specific Utilities
 */
export const FormatUtils = {
    /**
     * Get format-specific requirements
     */
    getFormatRequirements(format) {
        const requirements = {
            [EXPORT_FORMATS.PDF]: {
                supportedFeatures: ['figures', 'tables', 'citations', 'toc', 'headers', 'footers'],
                requiredOptions: [],
                optionalOptions: ['pageSize', 'margins', 'fontSize', 'fontFamily'],
                outputType: 'binary',
                mimeType: 'application/pdf',
                fileExtension: 'pdf'
            },
            [EXPORT_FORMATS.DOCX]: {
                supportedFeatures: ['figures', 'tables', 'citations', 'toc', 'styles', 'comments'],
                requiredOptions: [],
                optionalOptions: ['template', 'styles', 'trackChanges'],
                outputType: 'binary',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                fileExtension: 'docx'
            },
            [EXPORT_FORMATS.LATEX]: {
                supportedFeatures: ['figures', 'tables', 'citations', 'toc', 'math', 'packages'],
                requiredOptions: [],
                optionalOptions: ['documentClass', 'packages', 'bibliography'],
                outputType: 'text',
                mimeType: 'text/x-latex',
                fileExtension: 'tex'
            },
            [EXPORT_FORMATS.HTML]: {
                supportedFeatures: ['figures', 'tables', 'citations', 'links', 'css'],
                requiredOptions: [],
                optionalOptions: ['css', 'javascript', 'template'],
                outputType: 'text',
                mimeType: 'text/html',
                fileExtension: 'html'
            },
            [EXPORT_FORMATS.MARKDOWN]: {
                supportedFeatures: ['figures', 'tables', 'links', 'code'],
                requiredOptions: [],
                optionalOptions: ['flavor'],
                outputType: 'text',
                mimeType: 'text/markdown',
                fileExtension: 'md'
            }
        };

        return requirements[format] || null;
    },

    /**
     * Validate format compatibility
     */
    validateFormatCompatibility(document, format) {
        const requirements = this.getFormatRequirements(format);
        if (!requirements) {
            return { compatible: false, errors: [`Unsupported format: ${format}`] };
        }

        const errors = [];
        const metadata = DocumentUtils.extractMetadata(document);

        // Check if document has features not supported by format
        if (metadata.figureCount > 0 && !requirements.supportedFeatures.includes('figures')) {
            errors.push(`Format ${format} does not support figures`);
        }

        if (metadata.tableCount > 0 && !requirements.supportedFeatures.includes('tables')) {
            errors.push(`Format ${format} does not support tables`);
        }

        if (metadata.citationCount > 0 && !requirements.supportedFeatures.includes('citations')) {
            errors.push(`Format ${format} does not support citations`);
        }

        return { compatible: errors.length === 0, errors };
    },

    /**
     * Get default options for format
     */
    getDefaultOptions(format) {
        const defaults = {
            [EXPORT_FORMATS.PDF]: {
                pageSize: 'A4',
                margins: { top: 72, bottom: 72, left: 72, right: 72 },
                fontSize: 12,
                fontFamily: 'Times-Roman',
                includeTOC: true,
                includeHeaders: true,
                includeFooters: true
            },
            [EXPORT_FORMATS.DOCX]: {
                pageSize: 'A4',
                fontSize: 12,
                fontFamily: 'Times New Roman',
                includeTOC: true,
                includeStyles: true,
                trackChanges: false
            },
            [EXPORT_FORMATS.LATEX]: {
                documentClass: 'article',
                packages: ['amsmath', 'graphicx', 'hyperref'],
                bibliography: true,
                citationStyle: CITATION_STYLES.APA
            },
            [EXPORT_FORMATS.HTML]: {
                includeCSS: true,
                responsive: true,
                standalone: true
            },
            [EXPORT_FORMATS.MARKDOWN]: {
                flavor: 'github',
                includeTOC: false
            }
        };

        return defaults[format] || {};
    }
};

/**
 * Performance and Monitoring Utilities
 */
export const PerformanceUtils = {
    /**
     * Create performance timer
     */
    createTimer() {
        const start = performance.now();
        return {
            start,
            elapsed() {
                return performance.now() - start;
            },
            lap() {
                const elapsed = this.elapsed();
                console.log(`Timer lap: ${elapsed.toFixed(2)}ms`);
                return elapsed;
            },
            stop() {
                const elapsed = this.elapsed();
                console.log(`Timer stopped: ${elapsed.toFixed(2)}ms`);
                return elapsed;
            }
        };
    },

    /**
     * Measure function execution time
     */
    async measureAsync(fn, name = 'operation') {
        const timer = this.createTimer();
        try {
            const result = await fn();
            const elapsed = timer.stop();
            console.log(`${name} completed in ${elapsed.toFixed(2)}ms`);
            return { result, elapsed };
        } catch (error) {
            const elapsed = timer.stop();
            console.log(`${name} failed after ${elapsed.toFixed(2)}ms`);
            throw error;
        }
    },

    /**
     * Calculate memory usage
     */
    getMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage();
        }
        return null;
    },

    /**
     * Create performance monitor
     */
    createMonitor(name = 'operation') {
        return {
            name,
            metrics: {
                operations: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                errors: 0
            },

            record(elapsed, error = false) {
                this.metrics.operations++;

                if (error) {
                    this.metrics.errors++;
                } else {
                    this.metrics.totalTime += elapsed;
                    this.metrics.averageTime = this.metrics.totalTime / (this.metrics.operations - this.metrics.errors);
                    this.metrics.minTime = Math.min(this.metrics.minTime, elapsed);
                    this.metrics.maxTime = Math.max(this.metrics.maxTime, elapsed);
                }
            },

            getStats() {
                return {
                    name: this.name,
                    ...this.metrics,
                    successRate: (this.metrics.operations - this.metrics.errors) / this.metrics.operations,
                    errorRate: this.metrics.errors / this.metrics.operations
                };
            }
        };
    }
};

/**
 * File and Storage Utilities
 */
export const FileUtils = {
    /**
     * Generate safe filename
     */
    generateSafeFilename(title, format, timestamp = true) {
        let filename = title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50); // Limit length

        if (timestamp) {
            const dateStr = new Date().toISOString().split('T')[0];
            filename += `-${dateStr}`;
        }

        return `${filename}.${format}`;
    },

    /**
     * Estimate file size
     */
    estimateFileSize(document, format) {
        const metadata = DocumentUtils.extractMetadata(document);
        const baseSize = metadata.wordCount * 6; // ~6 bytes per word average

        const formatMultipliers = {
            [EXPORT_FORMATS.PDF]: 15,     // PDF compression and formatting
            [EXPORT_FORMATS.DOCX]: 10,    // XML compression
            [EXPORT_FORMATS.LATEX]: 2,    // Plain text with markup
            [EXPORT_FORMATS.HTML]: 3,     // HTML markup
            [EXPORT_FORMATS.MARKDOWN]: 1  // Minimal markup
        };

        const multiplier = formatMultipliers[format] || 5;
        return Math.max(1024, baseSize * multiplier); // Minimum 1KB
    },

    /**
     * Validate file size limits
     */
    validateFileSize(estimatedSize, maxSize = 50 * 1024 * 1024) {
        return {
            valid: estimatedSize <= maxSize,
            estimatedSize,
            maxSize,
            exceededBy: Math.max(0, estimatedSize - maxSize)
        };
    }
};

// Export all utilities
export default {
    DocumentUtils,
    ContentUtils,
    FormatUtils,
    PerformanceUtils,
    FileUtils
};