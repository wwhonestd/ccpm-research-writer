/**
 * Citation Data Model - Bibliographic citations with APA, MLA, Chicago format support
 */
export class Citation {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.authors = data.authors || [];
        this.year = data.year || null;
        this.type = data.type || 'article';
        this.publication = data.publication || '';
        this.publisher = data.publisher || '';
        this.doi = data.doi || '';
        this.url = data.url || '';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.style = data.style || 'apa';
    }

    generateId() {
        return 'cite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    isValid() {
        return !!(this.id && this.title && this.authors && this.authors.length > 0);
    }

    format(style = null) {
        const citationStyle = style || this.style;
        switch (citationStyle.toLowerCase()) {
            case 'apa': return this.formatAPA();
            case 'mla': return this.formatMLA();
            case 'chicago': return this.formatChicago();
            default: return this.formatAPA();
        }
    }

    formatAPA() {
        let citation = '';
        if (this.authors.length > 0) {
            citation += this.authors.join(', ');
        }
        citation += ` (${this.year || 'n.d.'}).`;
        citation += ` ${this.title}.`;
        if (this.publication) {
            citation += ` <em>${this.publication}</em>.`;
        }
        return citation.trim();
    }

    formatMLA() {
        let citation = '';
        if (this.authors.length > 0) {
            citation += this.authors[0];
            if (this.authors.length > 1) citation += ', et al';
        }
        citation += ` "${this.title}."`;
        if (this.publication) {
            citation += ` <em>${this.publication}</em>`;
        }
        if (this.year) citation += `, ${this.year}`;
        return citation.trim();
    }

    formatChicago() {
        let citation = '';
        if (this.authors.length > 0) {
            citation += this.authors.join(', ');
        }
        citation += ` "${this.title}."`;
        if (this.publication) {
            citation += ` <em>${this.publication}</em>`;
        }
        if (this.year) citation += ` (${this.year})`;
        return citation.trim();
    }

    toBibTeX() {
        let bibtex = `@${this.type}{${this.id},\n`;
        bibtex += `  title={${this.title}},\n`;
        if (this.authors.length > 0) {
            bibtex += `  author={${this.authors.join(' and ')}},\n`;
        }
        if (this.year) bibtex += `  year={${this.year}},\n`;
        if (this.publication) bibtex += `  journal={${this.publication}},\n`;
        if (this.publisher) bibtex += `  publisher={${this.publisher}},\n`;
        if (this.doi) bibtex += `  doi={${this.doi}},\n`;
        if (this.url) bibtex += `  url={${this.url}},\n`;
        bibtex += `}`;
        return bibtex;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            authors: this.authors,
            year: this.year,
            type: this.type,
            publication: this.publication,
            publisher: this.publisher,
            doi: this.doi,
            url: this.url,
            created: this.created,
            updated: this.updated,
            style: this.style
        };
    }

    static fromJSON(data) {
        return new Citation(data);
    }

    toExportFormat(format = 'json') {
        if (format === 'csv') {
            return {
                id: this.id,
                title: this.title,
                authors: this.authors.join('; '),
                year: this.year,
                type: this.type,
                publication: this.publication,
                publisher: this.publisher,
                doi: this.doi,
                url: this.url,
                created: this.created
            };
        }
        return this.toJSON();
    }
}

export const CitationSchema = {
    type: 'object',
    required: ['id', 'title', 'authors'],
    properties: {
        id: { type: 'string', pattern: '^cite_' },
        title: { type: 'string', minLength: 1, maxLength: 1000 },
        authors: { type: 'array', items: { type: 'string', maxLength: 200 }, minItems: 1 },
        year: { type: ['number', 'null'], minimum: 1000, maximum: 3000 },
        type: { type: 'string', enum: ['article', 'book', 'website', 'thesis', 'conference'] },
        publication: { type: 'string', maxLength: 500 },
        publisher: { type: 'string', maxLength: 500 },
        doi: { type: 'string', maxLength: 200 },
        url: { type: 'string', format: 'uri' },
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        style: { type: 'string', enum: ['apa', 'mla', 'chicago'] }
    }
};