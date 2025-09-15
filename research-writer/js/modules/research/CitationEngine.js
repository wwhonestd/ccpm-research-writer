/**
 * Citation Engine - Enhanced citation formatting engine with APA, MLA, Chicago, IEEE, and custom formats
 * Extends the existing Citation model with advanced formatting capabilities
 */

import { Citation } from '../../models/Citation.js';

export class CitationEngine {
    constructor(options = {}) {
        this.defaultStyle = options.defaultStyle || 'apa';
        this.locale = options.locale || 'en-US';
        this.abbreviations = new Map();
        this.customStyles = new Map();
        this.templateCache = new Map();
        
        // Initialize built-in abbreviations
        this.initializeAbbreviations();
        
        // Initialize custom formatters
        this.initializeCustomStyles();
    }

    /**
     * Format a citation in the specified style
     */
    formatCitation(citation, style = null, options = {}) {
        try {
            if (!citation) {
                throw new Error('Citation is required');
            }
            
            const citationObj = citation instanceof Citation ? citation : new Citation(citation);
            const targetStyle = style || this.defaultStyle;
            
            // Check for custom style first
            if (this.customStyles.has(targetStyle)) {
                return this.formatCustomStyle(citationObj, targetStyle, options);
            }
            
            // Use built-in formatters
            switch (targetStyle.toLowerCase()) {
                case 'apa':
                    return this.formatAPA(citationObj, options);
                case 'mla':
                    return this.formatMLA(citationObj, options);
                case 'chicago':
                    return this.formatChicago(citationObj, options);
                case 'ieee':
                    return this.formatIEEE(citationObj, options);
                case 'harvard':
                    return this.formatHarvard(citationObj, options);
                case 'vancouver':
                    return this.formatVancouver(citationObj, options);
                default:
                    console.warn(`Unknown citation style: ${targetStyle}, falling back to APA`);
                    return this.formatAPA(citationObj, options);
            }
        } catch (error) {
            console.error('Citation formatting error:', error);
            return `[Citation formatting error: ${error.message}]`;
        }
    }

    /**
     * Format multiple citations as a bibliography
     */
    formatBibliography(citations, style = null, options = {}) {
        try {
            if (!Array.isArray(citations)) {
                citations = [citations];
            }
            
            const targetStyle = style || this.defaultStyle;
            const bibOptions = {
                numbered: options.numbered || false,
                alphabetical: options.alphabetical !== false,
                hanging: options.hanging !== false,
                spacing: options.spacing || 'double',
                ...options
            };
            
            // Sort citations if requested
            let sortedCitations = [...citations];
            if (bibOptions.alphabetical) {
                sortedCitations = this.sortCitationsAlphabetically(citations);
            }
            
            // Format each citation
            const formattedCitations = sortedCitations.map((citation, index) => {
                const formatted = this.formatCitation(citation, targetStyle, bibOptions);
                
                if (bibOptions.numbered) {
                    return `${index + 1}. ${formatted}`;
                }
                
                return formatted;
            });
            
            // Join with appropriate spacing
            const separator = bibOptions.spacing === 'single' ? '\n' : '\n\n';
            return formattedCitations.join(separator);
            
        } catch (error) {
            console.error('Bibliography formatting error:', error);
            return `[Bibliography formatting error: ${error.message}]`;
        }
    }

    /**
     * Format in-text citations
     */
    formatInText(citations, style = null, options = {}) {
        try {
            if (!Array.isArray(citations)) {
                citations = [citations];
            }
            
            const targetStyle = style || this.defaultStyle;
            
            switch (targetStyle.toLowerCase()) {
                case 'apa':
                    return this.formatInTextAPA(citations, options);
                case 'mla':
                    return this.formatInTextMLA(citations, options);
                case 'chicago':
                    return this.formatInTextChicago(citations, options);
                case 'ieee':
                    return this.formatInTextIEEE(citations, options);
                case 'harvard':
                    return this.formatInTextHarvard(citations, options);
                case 'vancouver':
                    return this.formatInTextVancouver(citations, options);
                default:
                    return this.formatInTextAPA(citations, options);
            }
        } catch (error) {
            console.error('In-text citation formatting error:', error);
            return `[In-text citation error: ${error.message}]`;
        }
    }

    // APA 7th Edition Formatting

    formatAPA(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatAPAAuthors(citation.authors);
        formatted += authors;
        
        // Year
        const year = citation.year ? `(${citation.year})` : '(n.d.)';
        formatted += ` ${year}.`;
        
        // Title
        if (citation.title) {
            const title = citation.type === 'book' 
                ? `<em>${citation.title}</em>` 
                : citation.title;
            formatted += ` ${title}.`;
        }
        
        // Publication/Container
        if (citation.publication) {
            if (citation.type === 'article') {
                formatted += ` <em>${citation.publication}</em>`;
                if (citation.volume) {
                    formatted += `, <em>${citation.volume}</em>`;
                    if (citation.issue) {
                        formatted += `(${citation.issue})`;
                    }
                    if (citation.pages) {
                        formatted += `, ${citation.pages}`;
                    }
                }
            } else {
                formatted += ` <em>${citation.publication}</em>.`;
            }
        }
        
        // Publisher
        if (citation.publisher && citation.type !== 'article') {
            formatted += ` ${citation.publisher}.`;
        }
        
        // DOI or URL
        if (citation.doi) {
            formatted += ` https://doi.org/${citation.doi}`;
        } else if (citation.url && !citation.publication) {
            formatted += ` ${citation.url}`;
        }
        
        return formatted.trim();
    }

    formatAPAAuthors(authors) {
        if (!authors || authors.length === 0) return '[No author]';
        
        if (authors.length === 1) {
            return this.formatAuthorLastFirst(authors[0]);
        } else if (authors.length === 2) {
            return `${this.formatAuthorLastFirst(authors[0])}, & ${this.formatAuthorLastFirst(authors[1])}`;
        } else if (authors.length <= 20) {
            const formattedAuthors = authors.slice(0, -1).map(author => this.formatAuthorLastFirst(author));
            return `${formattedAuthors.join(', ')}, & ${this.formatAuthorLastFirst(authors[authors.length - 1])}`;
        } else {
            // 21+ authors - use ellipsis format
            const firstAuthors = authors.slice(0, 19).map(author => this.formatAuthorLastFirst(author));
            return `${firstAuthors.join(', ')}, ... ${this.formatAuthorLastFirst(authors[authors.length - 1])}`;
        }
    }

    formatInTextAPA(citations, options = {}) {
        if (citations.length === 1) {
            const citation = citations[0];
            const citationObj = citation instanceof Citation ? citation : new Citation(citation);
            const authors = this.getInTextAuthorsAPA(citationObj.authors);
            const year = citationObj.year || 'n.d.';
            
            if (options.parenthetical) {
                return `(${authors}, ${year})`;
            } else {
                return `${authors} (${year})`;
            }
        } else {
            // Multiple citations
            const formatted = citations.map(citation => {
                const citationObj = citation instanceof Citation ? citation : new Citation(citation);
                const authors = this.getInTextAuthorsAPA(citationObj.authors);
                const year = citationObj.year || 'n.d.';
                return `${authors}, ${year}`;
            });
            return `(${formatted.join('; ')})`;
        }
    }

    getInTextAuthorsAPA(authors) {
        if (!authors || authors.length === 0) return '[No author]';
        
        if (authors.length === 1) {
            return this.getLastName(authors[0]);
        } else if (authors.length === 2) {
            return `${this.getLastName(authors[0])} & ${this.getLastName(authors[1])}`;
        } else if (authors.length >= 3) {
            return `${this.getLastName(authors[0])} et al.`;
        }
        
        return authors[0];
    }

    // MLA 9th Edition Formatting

    formatMLA(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatMLAAuthors(citation.authors);
        formatted += authors;
        
        // Title
        if (citation.title) {
            const title = citation.type === 'book' || citation.type === 'website'
                ? `<em>${citation.title}</em>` 
                : `"${citation.title}"`;
            formatted += ` ${title}.`;
        }
        
        // Container
        if (citation.publication) {
            formatted += ` <em>${citation.publication}</em>`;
            
            if (citation.volume) {
                formatted += `, vol. ${citation.volume}`;
            }
            if (citation.issue) {
                formatted += `, no. ${citation.issue}`;
            }
            formatted += ',';
        }
        
        // Date
        if (citation.year) {
            formatted += ` ${citation.year}`;
            if (citation.pages) {
                formatted += `, pp. ${citation.pages}`;
            }
            formatted += '.';
        }
        
        // Location (DOI or URL)
        if (citation.doi) {
            formatted += ` https://doi.org/${citation.doi}.`;
        } else if (citation.url) {
            formatted += ` ${citation.url}.`;
        }
        
        return formatted.trim();
    }

    formatMLAAuthors(authors) {
        if (!authors || authors.length === 0) return '';
        
        if (authors.length === 1) {
            return `${this.formatAuthorLastFirst(authors[0])}.`;
        } else if (authors.length === 2) {
            return `${this.formatAuthorLastFirst(authors[0])}, and ${this.formatAuthorFirstLast(authors[1])}.`;
        } else {
            return `${this.formatAuthorLastFirst(authors[0])}, et al.`;
        }
    }

    formatInTextMLA(citations, options = {}) {
        if (citations.length === 1) {
            const citation = citations[0];
            const citationObj = citation instanceof Citation ? citation : new Citation(citation);
            const author = this.getLastName(citationObj.authors[0] || 'Unknown');
            
            if (options.pageNumber) {
                return `(${author} ${options.pageNumber})`;
            } else {
                return `(${author})`;
            }
        } else {
            const formatted = citations.map(citation => {
                const citationObj = citation instanceof Citation ? citation : new Citation(citation);
                return this.getLastName(citationObj.authors[0] || 'Unknown');
            });
            return `(${formatted.join('; ')})`;
        }
    }

    // Chicago 17th Edition Formatting (Notes-Bibliography style)

    formatChicago(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatChicagoAuthors(citation.authors);
        formatted += authors;
        
        // Title
        if (citation.title) {
            const title = citation.type === 'book' 
                ? `<em>${citation.title}</em>` 
                : `"${citation.title}"`;
            formatted += ` ${title}`;
            
            if (citation.type === 'article' && citation.publication) {
                formatted += `,`;
            } else {
                formatted += `.`;
            }
        }
        
        // Publication
        if (citation.publication) {
            if (citation.type === 'article') {
                formatted += ` <em>${citation.publication}</em>`;
                if (citation.volume) {
                    formatted += ` ${citation.volume}`;
                    if (citation.issue) {
                        formatted += `, no. ${citation.issue}`;
                    }
                }
            }
        }
        
        // Publication info
        if (citation.publisher || citation.year) {
            formatted += ' (';
            if (citation.publisher) {
                formatted += citation.publisher;
                if (citation.year) formatted += ', ';
            }
            if (citation.year) {
                formatted += citation.year;
            }
            formatted += ')';
        }
        
        // Pages
        if (citation.pages && citation.type === 'article') {
            formatted += `: ${citation.pages}`;
        }
        
        formatted += '.';
        
        // DOI or URL
        if (citation.doi) {
            formatted += ` https://doi.org/${citation.doi}.`;
        } else if (citation.url) {
            formatted += ` ${citation.url}.`;
        }
        
        return formatted.trim();
    }

    formatChicagoAuthors(authors) {
        if (!authors || authors.length === 0) return '';
        
        if (authors.length === 1) {
            return `${this.formatAuthorLastFirst(authors[0])}.`;
        } else if (authors.length <= 3) {
            const formattedAuthors = authors.slice(0, -1).map((author, index) => 
                index === 0 ? this.formatAuthorLastFirst(author) : this.formatAuthorFirstLast(author)
            );
            return `${formattedAuthors.join(', ')}, and ${this.formatAuthorFirstLast(authors[authors.length - 1])}.`;
        } else {
            return `${this.formatAuthorLastFirst(authors[0])}, et al.`;
        }
    }

    formatInTextChicago(citations, options = {}) {
        // Chicago uses footnotes, so this is simplified
        if (citations.length === 1) {
            const citation = citations[0];
            const citationObj = citation instanceof Citation ? citation : new Citation(citation);
            const author = this.getLastName(citationObj.authors[0] || 'Unknown');
            const year = citationObj.year || 'n.d.';
            return `(${author} ${year})`;
        } else {
            const formatted = citations.map(citation => {
                const citationObj = citation instanceof Citation ? citation : new Citation(citation);
                const author = this.getLastName(citationObj.authors[0] || 'Unknown');
                const year = citationObj.year || 'n.d.';
                return `${author} ${year}`;
            });
            return `(${formatted.join('; ')})`;
        }
    }

    // IEEE Formatting

    formatIEEE(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatIEEEAuthors(citation.authors);
        formatted += authors;
        
        // Title
        if (citation.title) {
            const title = citation.type === 'book' 
                ? `<em>${citation.title}</em>` 
                : `"${citation.title},"`;
            formatted += ` ${title}`;
        }
        
        // Publication
        if (citation.publication) {
            if (citation.type === 'article') {
                formatted += ` <em>${citation.publication}</em>`;
                if (citation.volume) {
                    formatted += `, vol. ${citation.volume}`;
                }
                if (citation.issue) {
                    formatted += `, no. ${citation.issue}`;
                }
                if (citation.pages) {
                    formatted += `, pp. ${citation.pages}`;
                }
            } else {
                formatted += ` <em>${citation.publication}</em>`;
            }
        }
        
        // Publisher and year
        if (citation.publisher) {
            formatted += `, ${citation.publisher}`;
        }
        if (citation.year) {
            formatted += `, ${citation.year}`;
        }
        
        formatted += '.';
        
        // DOI or URL
        if (citation.doi) {
            formatted += ` DOI: ${citation.doi}.`;
        } else if (citation.url) {
            formatted += ` [Online]. Available: ${citation.url}`;
        }
        
        return formatted.trim();
    }

    formatIEEEAuthors(authors) {
        if (!authors || authors.length === 0) return '';
        
        const formattedAuthors = authors.map(author => {
            const parts = author.split(' ');
            if (parts.length >= 2) {
                const firstName = parts.slice(0, -1).map(name => `${name.charAt(0)}.`).join(' ');
                const lastName = parts[parts.length - 1];
                return `${firstName} ${lastName}`;
            }
            return author;
        });
        
        if (formattedAuthors.length === 1) {
            return `${formattedAuthors[0]},`;
        } else if (formattedAuthors.length === 2) {
            return `${formattedAuthors[0]} and ${formattedAuthors[1]},`;
        } else {
            return `${formattedAuthors.join(', ')},`;
        }
    }

    formatInTextIEEE(citations, options = {}) {
        // IEEE uses numbered references
        if (options.numbers) {
            return `[${options.numbers.join(', ')}]`;
        } else {
            // Fallback if no numbers provided
            return `[${citations.map((_, index) => index + 1).join(', ')}]`;
        }
    }

    // Harvard Formatting

    formatHarvard(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatHarvardAuthors(citation.authors);
        formatted += authors;
        
        // Year
        if (citation.year) {
            formatted += ` ${citation.year}.`;
        } else {
            formatted += ' n.d.';
        }
        
        // Title
        if (citation.title) {
            if (citation.type === 'book') {
                formatted += ` <em>${citation.title}</em>.`;
            } else {
                formatted += ` '${citation.title}'.`;
            }
        }
        
        // Publication
        if (citation.publication) {
            if (citation.type === 'article') {
                formatted += ` <em>${citation.publication}</em>`;
                if (citation.volume) {
                    formatted += `, ${citation.volume}`;
                    if (citation.issue) {
                        formatted += `(${citation.issue})`;
                    }
                }
                if (citation.pages) {
                    formatted += `, pp. ${citation.pages}`;
                }
            }
        }
        
        // Publisher
        if (citation.publisher) {
            formatted += ` ${citation.publisher}.`;
        }
        
        // DOI or URL
        if (citation.doi) {
            formatted += ` DOI: ${citation.doi}.`;
        } else if (citation.url) {
            formatted += ` Available at: ${citation.url}`;
        }
        
        return formatted.trim();
    }

    formatHarvardAuthors(authors) {
        if (!authors || authors.length === 0) return 'Anon.';
        
        if (authors.length === 1) {
            return `${this.formatAuthorLastFirst(authors[0])}`;
        } else if (authors.length === 2) {
            return `${this.getLastName(authors[0])} & ${this.getLastName(authors[1])}`;
        } else if (authors.length >= 3) {
            return `${this.getLastName(authors[0])} et al.`;
        }
        
        return authors[0];
    }

    formatInTextHarvard(citations, options = {}) {
        return this.formatInTextAPA(citations, options); // Harvard in-text is similar to APA
    }

    // Vancouver Formatting

    formatVancouver(citation, options = {}) {
        let formatted = '';
        
        // Authors
        const authors = this.formatVancouverAuthors(citation.authors);
        formatted += authors;
        
        // Title
        if (citation.title) {
            formatted += ` ${citation.title}.`;
        }
        
        // Publication
        if (citation.publication) {
            const abbrev = this.getJournalAbbreviation(citation.publication);
            formatted += ` ${abbrev}`;
            
            if (citation.year) {
                formatted += ` ${citation.year}`;
            }
            
            if (citation.volume) {
                formatted += `;${citation.volume}`;
                if (citation.issue) {
                    formatted += `(${citation.issue})`;
                }
            }
            
            if (citation.pages) {
                formatted += `:${citation.pages}`;
            }
        }
        
        formatted += '.';
        
        return formatted.trim();
    }

    formatVancouverAuthors(authors) {
        if (!authors || authors.length === 0) return '';
        
        const formattedAuthors = authors.map(author => {
            const parts = author.split(' ');
            if (parts.length >= 2) {
                const lastName = parts[parts.length - 1];
                const initials = parts.slice(0, -1).map(name => name.charAt(0).toUpperCase()).join('');
                return `${lastName} ${initials}`;
            }
            return author;
        });
        
        if (formattedAuthors.length <= 6) {
            return `${formattedAuthors.join(', ')}.`;
        } else {
            return `${formattedAuthors.slice(0, 6).join(', ')}, et al.`;
        }
    }

    formatInTextVancouver(citations, options = {}) {
        // Vancouver uses numbered superscripts
        if (options.numbers) {
            return options.numbers.map(num => `<sup>${num}</sup>`).join('');
        } else {
            return `<sup>${citations.map((_, index) => index + 1).join(',')}</sup>`;
        }
    }

    // Utility methods

    formatAuthorLastFirst(author) {
        const parts = author.split(' ');
        if (parts.length >= 2) {
            const lastName = parts[parts.length - 1];
            const firstName = parts.slice(0, -1).join(' ');
            return `${lastName}, ${firstName}`;
        }
        return author;
    }

    formatAuthorFirstLast(author) {
        return author; // Already in first-last format
    }

    getLastName(author) {
        const parts = author.split(' ');
        return parts[parts.length - 1];
    }

    getJournalAbbreviation(journal) {
        // This would normally connect to a journal abbreviation database
        // For now, return the full journal name
        return this.abbreviations.get(journal.toLowerCase()) || journal;
    }

    sortCitationsAlphabetically(citations) {
        return citations.sort((a, b) => {
            const aAuthor = a.authors && a.authors.length > 0 ? this.getLastName(a.authors[0]) : '';
            const bAuthor = b.authors && b.authors.length > 0 ? this.getLastName(b.authors[0]) : '';
            
            if (aAuthor !== bAuthor) {
                return aAuthor.localeCompare(bAuthor);
            }
            
            // If same author, sort by year
            const aYear = a.year || 0;
            const bYear = b.year || 0;
            return aYear - bYear;
        });
    }

    // Custom style management

    addCustomStyle(name, formatter) {
        if (typeof formatter === 'function') {
            this.customStyles.set(name.toLowerCase(), formatter);
        } else {
            throw new Error('Custom style formatter must be a function');
        }
    }

    removeCustomStyle(name) {
        return this.customStyles.delete(name.toLowerCase());
    }

    formatCustomStyle(citation, styleName, options) {
        const formatter = this.customStyles.get(styleName.toLowerCase());
        if (!formatter) {
            throw new Error(`Custom style '${styleName}' not found`);
        }
        
        try {
            return formatter(citation, options, this);
        } catch (error) {
            throw new Error(`Custom style formatting error: ${error.message}`);
        }
    }

    // Abbreviation management

    addAbbreviation(full, abbreviated) {
        this.abbreviations.set(full.toLowerCase(), abbreviated);
    }

    removeAbbreviation(full) {
        return this.abbreviations.delete(full.toLowerCase());
    }

    initializeAbbreviations() {
        // Common journal abbreviations
        const commonAbbreviations = {
            'nature': 'Nature',
            'science': 'Science',
            'journal of the american chemical society': 'J. Am. Chem. Soc.',
            'proceedings of the national academy of sciences': 'Proc. Natl. Acad. Sci.',
            'new england journal of medicine': 'N. Engl. J. Med.',
            'journal of biological chemistry': 'J. Biol. Chem.',
            'physical review letters': 'Phys. Rev. Lett.'
        };
        
        Object.entries(commonAbbreviations).forEach(([full, abbrev]) => {
            this.abbreviations.set(full, abbrev);
        });
    }

    initializeCustomStyles() {
        // Example custom style
        this.addCustomStyle('ama', (citation, options, engine) => {
            // American Medical Association style
            let formatted = '';
            
            const authors = citation.authors.slice(0, 6).map(author => {
                const parts = author.split(' ');
                if (parts.length >= 2) {
                    const lastName = parts[parts.length - 1];
                    const initials = parts.slice(0, -1).map(name => name.charAt(0).toUpperCase()).join('');
                    return `${lastName} ${initials}`;
                }
                return author;
            });
            
            if (citation.authors.length > 6) {
                authors.push('et al');
            }
            
            formatted += authors.join(', ') + '.';
            
            if (citation.title) {
                formatted += ` ${citation.title}.`;
            }
            
            if (citation.publication) {
                formatted += ` <em>${citation.publication}</em>.`;
            }
            
            if (citation.year) {
                formatted += ` ${citation.year}`;
            }
            
            if (citation.volume) {
                formatted += `;${citation.volume}`;
                if (citation.issue) {
                    formatted += `(${citation.issue})`;
                }
            }
            
            if (citation.pages) {
                formatted += `:${citation.pages}`;
            }
            
            formatted += '.';
            
            return formatted;
        });
    }

    // Validation methods

    validateCitation(citation) {
        const citationObj = citation instanceof Citation ? citation : new Citation(citation);
        const errors = [];
        
        if (!citationObj.title || citationObj.title.trim() === '') {
            errors.push('Title is required');
        }
        
        if (!citationObj.authors || citationObj.authors.length === 0) {
            errors.push('At least one author is required');
        }
        
        if (citationObj.year && (citationObj.year < 1000 || citationObj.year > new Date().getFullYear() + 5)) {
            errors.push('Year must be between 1000 and current year + 5');
        }
        
        if (citationObj.doi && !this.isValidDOI(citationObj.doi)) {
            errors.push('DOI format is invalid');
        }
        
        if (citationObj.url && !this.isValidURL(citationObj.url)) {
            errors.push('URL format is invalid');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    isValidDOI(doi) {
        const doiRegex = /^10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/;
        return doiRegex.test(doi);
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Export/Import settings

    exportSettings() {
        return {
            defaultStyle: this.defaultStyle,
            locale: this.locale,
            customStyles: Array.from(this.customStyles.keys()),
            abbreviations: Object.fromEntries(this.abbreviations)
        };
    }

    importSettings(settings) {
        if (settings.defaultStyle) {
            this.defaultStyle = settings.defaultStyle;
        }
        
        if (settings.locale) {
            this.locale = settings.locale;
        }
        
        if (settings.abbreviations) {
            Object.entries(settings.abbreviations).forEach(([full, abbrev]) => {
                this.abbreviations.set(full, abbrev);
            });
        }
    }

    // Get available styles

    getAvailableStyles() {
        const builtInStyles = ['apa', 'mla', 'chicago', 'ieee', 'harvard', 'vancouver'];
        const customStyles = Array.from(this.customStyles.keys());
        return {
            builtIn: builtInStyles,
            custom: customStyles,
            all: [...builtInStyles, ...customStyles]
        };
    }
}