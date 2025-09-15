/**
 * CitationIntegration - Citation and bibliography processing module
 * Handles integration of citation data with document compilation process
 * Provides bibliography generation and citation formatting services
 */

import { StorageService } from '../../services/StorageService.js';
import { Citation } from '../../models/Citation.js';

export class CitationIntegration {
    constructor(options = {}) {
        this.options = {
            defaultStyle: options.defaultStyle || 'apa',
            enableCache: options.enableCache !== false,
            validateCitations: options.validateCitations !== false,
            autoFormat: options.autoFormat !== false,
            groupSimilar: options.groupSimilar || false,
            ...options
        };

        this.storageService = new StorageService();
        this.citationCache = new Map();
        this.formatters = new Map();
        this.validators = new Map();
        
        this.isInitialized = false;
    }

    async init() {
        try {
            await this.initializeFormatters();
            await this.initializeValidators();
            this.isInitialized = true;
            console.log('Citation integration initialized');
        } catch (error) {
            console.error('Citation integration initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize citation formatters
     */
    async initializeFormatters() {
        // APA formatter
        this.formatters.set('apa', {
            name: 'APA (7th Edition)',
            formatCitation: this.formatAPACitation.bind(this),
            formatBibliography: this.formatAPABibliography.bind(this),
            inlineFormat: 'author-date',
            supports: ['article', 'book', 'chapter', 'conference', 'thesis', 'website', 'report']
        });

        // MLA formatter
        this.formatters.set('mla', {
            name: 'MLA (8th Edition)',
            formatCitation: this.formatMLACitation.bind(this),
            formatBibliography: this.formatMLABibliography.bind(this),
            inlineFormat: 'author-page',
            supports: ['article', 'book', 'chapter', 'conference', 'thesis', 'website']
        });

        // Chicago formatter
        this.formatters.set('chicago', {
            name: 'Chicago (17th Edition)',
            formatCitation: this.formatChicagoCitation.bind(this),
            formatBibliography: this.formatChicagoBibliography.bind(this),
            inlineFormat: 'notes',
            supports: ['article', 'book', 'chapter', 'conference', 'thesis', 'website', 'report']
        });

        // IEEE formatter
        this.formatters.set('ieee', {
            name: 'IEEE',
            formatCitation: this.formatIEEECitation.bind(this),
            formatBibliography: this.formatIEEEBibliography.bind(this),
            inlineFormat: 'numeric',
            supports: ['article', 'book', 'chapter', 'conference', 'thesis', 'report']
        });

        console.log(`Initialized ${this.formatters.size} citation formatters`);
    }

    /**
     * Initialize citation validators
     */
    async initializeValidators() {
        // Required fields validator
        this.validators.set('required', {
            validate: this.validateRequiredFields.bind(this),
            critical: true
        });

        // DOI validator
        this.validators.set('doi', {
            validate: this.validateDOI.bind(this),
            critical: false
        });

        // ISBN validator
        this.validators.set('isbn', {
            validate: this.validateISBN.bind(this),
            critical: false
        });

        // URL validator
        this.validators.set('url', {
            validate: this.validateURL.bind(this),
            critical: false
        });

        console.log(`Initialized ${this.validators.size} citation validators`);
    }

    /**
     * Get citations for document
     */
    async getCitationsForDocument(document) {
        try {
            const citationIds = this.extractCitationIds(document);
            const citations = [];

            for (const id of citationIds) {
                const citation = await this.getCitationById(id);
                if (citation) {
                    citations.push(citation);
                } else {
                    console.warn(`Citation not found: ${id}`);
                }
            }

            console.log(`Retrieved ${citations.length} citations for document`);
            return citations;
        } catch (error) {
            console.error('Failed to get citations for document:', error);
            return [];
        }
    }

    /**
     * Extract citation IDs from document content
     */
    extractCitationIds(document) {
        const citationIds = new Set();

        // Extract from sections
        if (document.sections) {
            document.sections.forEach(section => {
                if (section.content) {
                    const matches = section.content.match(/\[@?([^\]]+)\]/g);
                    if (matches) {
                        matches.forEach(match => {
                            const id = match.replace(/\[@?([^\]]+)\]/, '$1');
                            citationIds.add(id);
                        });
                    }
                }
            });
        }

        // Extract from main content
        if (document.content) {
            const matches = document.content.match(/\[@?([^\]]+)\]/g);
            if (matches) {
                matches.forEach(match => {
                    const id = match.replace(/\[@?([^\]]+)\]/, '$1');
                    citationIds.add(id);
                });
            }
        }

        return Array.from(citationIds);
    }

    /**
     * Get citation by ID
     */
    async getCitationById(id) {
        try {
            // Check cache first
            if (this.options.enableCache && this.citationCache.has(id)) {
                return this.citationCache.get(id);
            }

            // Get from storage
            const citation = this.storageService.get('citations', id);
            
            if (citation) {
                // Cache the citation
                if (this.options.enableCache) {
                    this.citationCache.set(id, citation);
                }
                return citation;
            }

            return null;
        } catch (error) {
            console.error(`Failed to get citation ${id}:`, error);
            return null;
        }
    }

    /**
     * Generate bibliography for citations
     */
    async generateBibliography(citations, style = null, options = {}) {
        const citationStyle = style || this.options.defaultStyle;
        const formatter = this.formatters.get(citationStyle);

        if (!formatter) {
            throw new Error(`Unsupported citation style: ${citationStyle}`);
        }

        try {
            // Validate citations if enabled
            if (this.options.validateCitations) {
                citations = await this.validateCitations(citations);
            }

            // Sort citations
            const sortedCitations = this.sortCitations(citations, citationStyle, options);

            // Format bibliography entries
            const entries = [];
            for (let i = 0; i < sortedCitations.length; i++) {
                const citation = sortedCitations[i];
                const formatted = await formatter.formatBibliography(citation, i + 1, options);
                entries.push({
                    citation,
                    formatted,
                    index: i + 1
                });
            }

            const bibliography = {
                style: citationStyle,
                styleName: formatter.name,
                entries,
                metadata: {
                    totalEntries: entries.length,
                    generatedAt: new Date().toISOString(),
                    options
                }
            };

            console.log(`Generated bibliography with ${entries.length} entries in ${citationStyle} style`);
            return bibliography;
        } catch (error) {
            console.error('Bibliography generation failed:', error);
            throw new Error(`Bibliography generation failed: ${error.message}`);
        }
    }

    /**
     * Sort citations by style requirements
     */
    sortCitations(citations, style, options) {
        const sortBy = options.sortBy || this.getDefaultSortOrder(style);

        return [...citations].sort((a, b) => {
            switch (sortBy) {
                case 'author':
                    const authorA = this.getFirstAuthor(a);
                    const authorB = this.getFirstAuthor(b);
                    return authorA.localeCompare(authorB);
                
                case 'year':
                    const yearA = parseInt(a.year) || 0;
                    const yearB = parseInt(b.year) || 0;
                    return yearB - yearA; // Descending
                
                case 'title':
                    const titleA = a.title || '';
                    const titleB = b.title || '';
                    return titleA.localeCompare(titleB);
                
                case 'appearance':
                    // Keep original order (order of appearance in text)
                    return 0;
                
                default:
                    // Default: author-year
                    const authCompare = this.getFirstAuthor(a).localeCompare(this.getFirstAuthor(b));
                    if (authCompare !== 0) return authCompare;
                    return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
            }
        });
    }

    /**
     * Get default sort order for style
     */
    getDefaultSortOrder(style) {
        const defaultOrders = {
            'apa': 'author',
            'mla': 'author',
            'chicago': 'author',
            'ieee': 'appearance'
        };
        return defaultOrders[style] || 'author';
    }

    /**
     * Get first author for sorting
     */
    getFirstAuthor(citation) {
        if (!citation.authors || citation.authors.length === 0) {
            return 'Unknown';
        }
        
        const firstAuthor = citation.authors[0];
        // Extract last name for sorting
        const parts = firstAuthor.split(',');
        if (parts.length > 1) {
            return parts[0].trim(); // Last name first format
        }
        
        const nameParts = firstAuthor.split(' ');
        return nameParts[nameParts.length - 1]; // Last word as last name
    }

    /**
     * Validate citations
     */
    async validateCitations(citations) {
        const validatedCitations = [];

        for (const citation of citations) {
            const validation = await this.validateCitation(citation);
            
            if (validation.valid) {
                validatedCitations.push(citation);
            } else {
                console.warn(`Citation validation failed for ${citation.id}:`, validation.errors);
                // Still include but mark as having issues
                validatedCitations.push({
                    ...citation,
                    validationErrors: validation.errors
                });
            }
        }

        return validatedCitations;
    }

    /**
     * Validate single citation
     */
    async validateCitation(citation) {
        const errors = [];
        const warnings = [];

        for (const [name, validator] of this.validators.entries()) {
            try {
                const result = await validator.validate(citation);
                if (result.errors) errors.push(...result.errors);
                if (result.warnings) warnings.push(...result.warnings);
            } catch (error) {
                if (validator.critical) {
                    errors.push(`${name} validation failed: ${error.message}`);
                } else {
                    warnings.push(`${name} validation failed: ${error.message}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Citation formatters for different styles

    /**
     * Format APA citation
     */
    formatAPACitation(citation, index, options) {
        const authors = this.formatAuthors(citation.authors, 'apa');
        const year = citation.year || 'n.d.';
        
        return `(${authors}, ${year})`;
    }

    /**
     * Format APA bibliography entry
     */
    formatAPABibliography(citation, index, options) {
        let entry = '';
        
        // Authors
        if (citation.authors && citation.authors.length > 0) {
            entry += this.formatAuthors(citation.authors, 'apa-bib') + '. ';
        }
        
        // Year
        entry += `(${citation.year || 'n.d.'}). `;
        
        // Title
        if (citation.title) {
            if (citation.type === 'article') {
                entry += `${citation.title}. `;
            } else {
                entry += `*${citation.title}*. `;
            }
        }
        
        // Publication details
        if (citation.publication) {
            if (citation.type === 'article') {
                entry += `*${citation.publication}*`;
                if (citation.volume) entry += `, ${citation.volume}`;
                if (citation.issue) entry += `(${citation.issue})`;
                if (citation.pages) entry += `, ${citation.pages}`;
                entry += '. ';
            } else {
                entry += `${citation.publication}. `;
            }
        }
        
        // Publisher
        if (citation.publisher) {
            entry += `${citation.publisher}. `;
        }
        
        // DOI or URL
        if (citation.doi) {
            entry += `https://doi.org/${citation.doi}`;
        } else if (citation.url) {
            entry += citation.url;
        }
        
        return entry.trim();
    }

    /**
     * Format MLA citation
     */
    formatMLACitation(citation, index, options) {
        const authors = this.formatAuthors(citation.authors, 'mla');
        const page = options.page || '';
        
        if (page) {
            return `(${authors} ${page})`;
        }
        return `(${authors})`;
    }

    /**
     * Format MLA bibliography entry
     */
    formatMLABibliography(citation, index, options) {
        let entry = '';
        
        // Authors
        if (citation.authors && citation.authors.length > 0) {
            entry += this.formatAuthors(citation.authors, 'mla-bib') + '. ';
        }
        
        // Title
        if (citation.title) {
            if (citation.type === 'article') {
                entry += `"${citation.title}." `;
            } else {
                entry += `*${citation.title}*. `;
            }
        }
        
        // Publication
        if (citation.publication) {
            entry += `*${citation.publication}*, `;
        }
        
        // Volume/Issue
        if (citation.volume) {
            entry += `vol. ${citation.volume}, `;
            if (citation.issue) {
                entry += `no. ${citation.issue}, `;
            }
        }
        
        // Year
        if (citation.year) {
            entry += `${citation.year}, `;
        }
        
        // Pages
        if (citation.pages) {
            entry += `pp. ${citation.pages}. `;
        }
        
        // URL and access date
        if (citation.url) {
            entry += `${citation.url}.`;
        }
        
        return entry.trim();
    }

    /**
     * Format Chicago citation
     */
    formatChicagoCitation(citation, index, options) {
        // Chicago uses footnotes - return footnote number
        return `<sup>${index}</sup>`;
    }

    /**
     * Format Chicago bibliography entry
     */
    formatChicagoBibliography(citation, index, options) {
        // Similar to APA but with different punctuation and formatting
        let entry = '';
        
        if (citation.authors && citation.authors.length > 0) {
            entry += this.formatAuthors(citation.authors, 'chicago-bib') + '. ';
        }
        
        if (citation.title) {
            if (citation.type === 'article') {
                entry += `"${citation.title}." `;
            } else {
                entry += `*${citation.title}*. `;
            }
        }
        
        if (citation.publication) {
            entry += `*${citation.publication}* `;
        }
        
        if (citation.volume) {
            entry += `${citation.volume}, `;
            if (citation.issue) {
                entry += `no. ${citation.issue} `;
            }
        }
        
        if (citation.year) {
            entry += `(${citation.year})`;
        }
        
        if (citation.pages) {
            entry += `: ${citation.pages}.`;
        }
        
        if (citation.doi) {
            entry += ` doi:${citation.doi}.`;
        }
        
        return entry.trim();
    }

    /**
     * Format IEEE citation
     */
    formatIEEECitation(citation, index, options) {
        return `[${index}]`;
    }

    /**
     * Format IEEE bibliography entry
     */
    formatIEEEBibliography(citation, index, options) {
        let entry = `[${index}] `;
        
        // Authors
        if (citation.authors && citation.authors.length > 0) {
            entry += this.formatAuthors(citation.authors, 'ieee') + ', ';
        }
        
        // Title
        if (citation.title) {
            if (citation.type === 'article') {
                entry += `"${citation.title}," `;
            } else {
                entry += `*${citation.title}*, `;
            }
        }
        
        // Publication
        if (citation.publication) {
            entry += `*${citation.publication}*, `;
        }
        
        // Volume and issue
        if (citation.volume) {
            entry += `vol. ${citation.volume}, `;
            if (citation.issue) {
                entry += `no. ${citation.issue}, `;
            }
        }
        
        // Pages
        if (citation.pages) {
            entry += `pp. ${citation.pages}, `;
        }
        
        // Date
        if (citation.year) {
            entry += `${citation.year}.`;
        }
        
        return entry.trim();
    }

    /**
     * Format authors according to style
     */
    formatAuthors(authors, style) {
        if (!authors || authors.length === 0) return 'Unknown';
        
        switch (style) {
            case 'apa':
            case 'apa-bib':
                if (authors.length === 1) {
                    return this.formatAuthorName(authors[0], 'last-first');
                } else if (authors.length === 2) {
                    return `${this.formatAuthorName(authors[0], 'last-first')} & ${this.formatAuthorName(authors[1], 'last-first')}`;
                } else {
                    return `${this.formatAuthorName(authors[0], 'last-first')} et al.`;
                }
            
            case 'mla':
            case 'mla-bib':
                if (authors.length === 1) {
                    return this.formatAuthorName(authors[0], 'last-first');
                } else if (authors.length === 2) {
                    return `${this.formatAuthorName(authors[0], 'last-first')} and ${this.formatAuthorName(authors[1], 'first-last')}`;
                } else {
                    return `${this.formatAuthorName(authors[0], 'last-first')} et al.`;
                }
            
            case 'chicago-bib':
                // Similar to MLA
                if (authors.length === 1) {
                    return this.formatAuthorName(authors[0], 'last-first');
                } else if (authors.length === 2) {
                    return `${this.formatAuthorName(authors[0], 'last-first')}, and ${this.formatAuthorName(authors[1], 'first-last')}`;
                } else {
                    return `${this.formatAuthorName(authors[0], 'last-first')}, et al.`;
                }
            
            case 'ieee':
                if (authors.length <= 6) {
                    return authors.map(author => this.formatAuthorName(author, 'first-last')).join(', ');
                } else {
                    return `${this.formatAuthorName(authors[0], 'first-last')} et al.`;
                }
            
            default:
                return authors.join(', ');
        }
    }

    /**
     * Format individual author name
     */
    formatAuthorName(name, format) {
        if (format === 'last-first') {
            // Check if already in "Last, First" format
            if (name.includes(',')) {
                return name;
            }
            
            // Convert "First Last" to "Last, First"
            const parts = name.trim().split(' ');
            if (parts.length >= 2) {
                const last = parts[parts.length - 1];
                const first = parts.slice(0, -1).join(' ');
                return `${last}, ${first}`;
            }
        } else if (format === 'first-last') {
            // Check if in "Last, First" format
            if (name.includes(',')) {
                const parts = name.split(',');
                if (parts.length === 2) {
                    return `${parts[1].trim()} ${parts[0].trim()}`;
                }
            }
        }
        
        return name;
    }

    // Validation methods

    validateRequiredFields(citation) {
        const errors = [];
        
        if (!citation.title) errors.push('Title is required');
        if (!citation.authors || citation.authors.length === 0) errors.push('At least one author is required');
        if (!citation.year) errors.push('Year is required');
        
        return { errors, warnings: [] };
    }

    validateDOI(citation) {
        const errors = [];
        const warnings = [];
        
        if (citation.doi) {
            const doiPattern = /^10\.\d{4,}\/\S+$/;
            if (!doiPattern.test(citation.doi)) {
                warnings.push('DOI format appears invalid');
            }
        }
        
        return { errors, warnings };
    }

    validateISBN(citation) {
        const errors = [];
        const warnings = [];
        
        if (citation.isbn) {
            const cleanISBN = citation.isbn.replace(/[-\s]/g, '');
            if (!/^(\d{10}|\d{13})$/.test(cleanISBN)) {
                warnings.push('ISBN format appears invalid');
            }
        }
        
        return { errors, warnings };
    }

    validateURL(citation) {
        const errors = [];
        const warnings = [];
        
        if (citation.url) {
            try {
                new URL(citation.url);
            } catch {
                warnings.push('URL format appears invalid');
            }
        }
        
        return { errors, warnings };
    }

    /**
     * Clear citation cache
     */
    clearCache() {
        this.citationCache.clear();
        console.log('Citation cache cleared');
    }

    /**
     * Get supported citation styles
     */
    getSupportedStyles() {
        return Array.from(this.formatters.keys());
    }

    /**
     * Get formatter information
     */
    getFormatterInfo(style) {
        const formatter = this.formatters.get(style);
        if (formatter) {
            return {
                name: formatter.name,
                inlineFormat: formatter.inlineFormat,
                supports: formatter.supports
            };
        }
        return null;
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.clearCache();
        this.formatters.clear();
        this.validators.clear();
        this.isInitialized = false;
        console.log('Citation integration destroyed');
    }
}