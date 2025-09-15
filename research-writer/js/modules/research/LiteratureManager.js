/**
 * Literature Manager - Manages literature organization, import/export, and collection management
 * Integrates with Citation model from Issue #3 StorageService for data persistence
 */

import { Citation } from '../../models/Citation.js';
import { StorageService } from '../../services/StorageService.js';

export class LiteratureManager {
    constructor(storageService = null) {
        this.storage = storageService || new StorageService();
        this.collection = 'citations';
        this.eventListeners = new Map();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.importProgressCallback = null;
        this.exportProgressCallback = null;
        
        // Supported file formats
        this.supportedFormats = {
            import: ['json', 'bibtex', 'bib', 'ris', 'csv'],
            export: ['json', 'bibtex', 'bib', 'ris', 'csv', 'txt']
        };
    }

    // Core literature management methods

    /**
     * Add a new citation to the literature collection
     */
    async addCitation(citationData) {
        try {
            const citation = citationData instanceof Citation ? citationData : new Citation(citationData);
            
            if (!citation.isValid()) {
                throw new Error('Citation data is invalid');
            }
            
            const result = this.storage.create(this.collection, citation.toJSON());
            this.invalidateCache();
            this.emit('citation:added', { citation: result });
            
            return result;
        } catch (error) {
            console.error('Failed to add citation:', error);
            throw error;
        }
    }

    /**
     * Update an existing citation
     */
    async updateCitation(id, updatedData) {
        try {
            const existingCitation = this.storage.read(this.collection, id);
            if (!existingCitation) {
                throw new Error(`Citation with id ${id} not found`);
            }

            // Merge with existing data
            const mergedData = { ...existingCitation, ...updatedData, id };
            const citation = new Citation(mergedData);
            
            if (!citation.isValid()) {
                throw new Error('Updated citation data is invalid');
            }

            const result = this.storage.update(this.collection, id, citation.toJSON());
            this.invalidateCache();
            this.emit('citation:updated', { citation: result });
            
            return result;
        } catch (error) {
            console.error('Failed to update citation:', error);
            throw error;
        }
    }

    /**
     * Delete a citation from the collection
     */
    async deleteCitation(id) {
        try {
            const citation = this.storage.read(this.collection, id);
            if (!citation) {
                return false;
            }

            const success = this.storage.delete(this.collection, id);
            if (success) {
                this.invalidateCache();
                this.emit('citation:deleted', { id, citation });
            }
            
            return success;
        } catch (error) {
            console.error('Failed to delete citation:', error);
            return false;
        }
    }

    /**
     * Get a citation by ID
     */
    getCitation(id) {
        try {
            const data = this.storage.read(this.collection, id);
            return data ? Citation.fromJSON(data) : null;
        } catch (error) {
            console.error('Failed to get citation:', error);
            return null;
        }
    }

    /**
     * Get all citations with optional filtering and sorting
     */
    getCitations(options = {}) {
        const cacheKey = this.generateCacheKey('citations', options);
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const data = this.storage.list(this.collection, options);
            const citations = data.map(item => Citation.fromJSON(item));
            
            this.setCache(cacheKey, citations);
            return citations;
        } catch (error) {
            console.error('Failed to get citations:', error);
            return [];
        }
    }

    /**
     * Search citations by term
     */
    searchCitations(query, fields = ['title', 'authors', 'publication', 'tags']) {
        if (!query || query.trim() === '') {
            return this.getCitations();
        }

        try {
            const data = this.storage.search(this.collection, query, fields);
            return data.map(item => Citation.fromJSON(item));
        } catch (error) {
            console.error('Failed to search citations:', error);
            return [];
        }
    }

    /**
     * Get citations count with optional filtering
     */
    getCount(filter = null) {
        try {
            return this.storage.count(this.collection, filter);
        } catch (error) {
            console.error('Failed to get citations count:', error);
            return 0;
        }
    }

    // Import methods

    /**
     * Import citations from a file
     */
    async importFromFile(file) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            const extension = this.getFileExtension(file.name);
            if (!this.supportedFormats.import.includes(extension)) {
                throw new Error(`Unsupported file format: ${extension}`);
            }

            const content = await this.readFileContent(file);
            return await this.importFromContent(content, extension);
        } catch (error) {
            console.error('Failed to import from file:', error);
            throw error;
        }
    }

    /**
     * Import citations from content string
     */
    async importFromContent(content, format) {
        try {
            let citations = [];
            
            switch (format.toLowerCase()) {
                case 'json':
                    citations = await this.parseJSON(content);
                    break;
                case 'bibtex':
                case 'bib':
                    citations = await this.parseBibTeX(content);
                    break;
                case 'ris':
                    citations = await this.parseRIS(content);
                    break;
                case 'csv':
                    citations = await this.parseCSV(content);
                    break;
                default:
                    throw new Error(`Unsupported import format: ${format}`);
            }

            if (!Array.isArray(citations)) {
                throw new Error('Import did not return valid citation array');
            }

            // Process imports with progress tracking
            const results = {
                total: citations.length,
                imported: 0,
                errors: [],
                duplicates: []
            };

            for (let i = 0; i < citations.length; i++) {
                try {
                    const citation = citations[i] instanceof Citation ? citations[i] : new Citation(citations[i]);
                    
                    // Check for duplicates based on DOI or title+author combination
                    if (this.isDuplicate(citation)) {
                        results.duplicates.push({
                            index: i,
                            citation: citation.toJSON(),
                            reason: 'Duplicate found'
                        });
                        continue;
                    }

                    await this.addCitation(citation);
                    results.imported++;

                    if (this.importProgressCallback) {
                        this.importProgressCallback({
                            current: i + 1,
                            total: citations.length,
                            imported: results.imported,
                            citation: citation.toJSON()
                        });
                    }
                } catch (error) {
                    results.errors.push({
                        index: i,
                        citation: citations[i],
                        error: error.message
                    });
                }
            }

            this.emit('import:completed', results);
            return results;
        } catch (error) {
            console.error('Failed to import content:', error);
            throw error;
        }
    }

    // Export methods

    /**
     * Export citations to a specific format
     */
    async exportToFormat(citations, format, options = {}) {
        try {
            if (!Array.isArray(citations)) {
                citations = this.getCitations();
            }

            if (citations.length === 0) {
                throw new Error('No citations to export');
            }

            if (!this.supportedFormats.export.includes(format)) {
                throw new Error(`Unsupported export format: ${format}`);
            }

            let content = '';
            
            switch (format.toLowerCase()) {
                case 'json':
                    content = this.exportToJSON(citations, options);
                    break;
                case 'bibtex':
                case 'bib':
                    content = this.exportToBibTeX(citations, options);
                    break;
                case 'ris':
                    content = this.exportToRIS(citations, options);
                    break;
                case 'csv':
                    content = this.exportToCSV(citations, options);
                    break;
                case 'txt':
                    content = this.exportToText(citations, options);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            this.emit('export:completed', { 
                format, 
                count: citations.length,
                size: content.length 
            });

            return content;
        } catch (error) {
            console.error('Failed to export citations:', error);
            throw error;
        }
    }

    /**
     * Download exported content as file
     */
    async downloadExport(citations, format, filename = null) {
        try {
            const content = await this.exportToFormat(citations, format);
            
            if (!filename) {
                const timestamp = new Date().toISOString().split('T')[0];
                filename = `citations_${timestamp}.${format}`;
            }

            const blob = new Blob([content], { 
                type: this.getMimeType(format) 
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the object URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            return true;
        } catch (error) {
            console.error('Failed to download export:', error);
            throw error;
        }
    }

    // Format-specific parsing methods

    /**
     * Parse JSON format
     */
    async parseJSON(content) {
        try {
            const data = JSON.parse(content);
            
            // Handle different JSON structures
            if (Array.isArray(data)) {
                return data.map(item => new Citation(item));
            } else if (data.citations && Array.isArray(data.citations)) {
                return data.citations.map(item => new Citation(item));
            } else if (data.items && Array.isArray(data.items)) {
                return data.items.map(item => new Citation(item));
            } else {
                // Single citation
                return [new Citation(data)];
            }
        } catch (error) {
            throw new Error(`Invalid JSON format: ${error.message}`);
        }
    }

    /**
     * Parse BibTeX format
     */
    async parseBibTeX(content) {
        try {
            const citations = [];
            const entries = content.match(/@\w+\{[^@]*\}/g) || [];
            
            for (const entry of entries) {
                const citation = this.parseBibTeXEntry(entry);
                if (citation) {
                    citations.push(citation);
                }
            }
            
            return citations;
        } catch (error) {
            throw new Error(`Invalid BibTeX format: ${error.message}`);
        }
    }

    /**
     * Parse single BibTeX entry
     */
    parseBibTeXEntry(entry) {
        try {
            // Extract entry type and key
            const typeMatch = entry.match(/@(\w+)\{([^,]*),/);
            if (!typeMatch) return null;
            
            const type = typeMatch[1].toLowerCase();
            const key = typeMatch[2].trim();
            
            // Extract fields
            const fieldRegex = /(\w+)\s*=\s*\{([^}]*)\}/g;
            const fields = {};
            let match;
            
            while ((match = fieldRegex.exec(entry)) !== null) {
                fields[match[1].toLowerCase()] = match[2].trim();
            }
            
            // Map BibTeX fields to Citation model
            const citationData = {
                id: key || undefined,
                type: this.mapBibTeXType(type),
                title: fields.title || '',
                authors: this.parseBibTeXAuthors(fields.author || ''),
                year: parseInt(fields.year) || null,
                publication: fields.journal || fields.booktitle || '',
                publisher: fields.publisher || '',
                doi: fields.doi || '',
                url: fields.url || ''
            };
            
            return new Citation(citationData);
        } catch (error) {
            console.warn('Failed to parse BibTeX entry:', error);
            return null;
        }
    }

    /**
     * Parse RIS format
     */
    async parseRIS(content) {
        try {
            const citations = [];
            const entries = content.split(/\n\s*\n/).filter(entry => entry.trim());
            
            for (const entry of entries) {
                const citation = this.parseRISEntry(entry);
                if (citation) {
                    citations.push(citation);
                }
            }
            
            return citations;
        } catch (error) {
            throw new Error(`Invalid RIS format: ${error.message}`);
        }
    }

    /**
     * Parse single RIS entry
     */
    parseRISEntry(entry) {
        try {
            const lines = entry.split('\n').map(line => line.trim()).filter(line => line);
            const fields = {};
            
            for (const line of lines) {
                const match = line.match(/^(\w{2})\s*-\s*(.*)$/);
                if (match) {
                    const key = match[1];
                    const value = match[2];
                    
                    if (fields[key]) {
                        if (Array.isArray(fields[key])) {
                            fields[key].push(value);
                        } else {
                            fields[key] = [fields[key], value];
                        }
                    } else {
                        fields[key] = value;
                    }
                }
            }
            
            // Map RIS fields to Citation model
            const citationData = {
                type: this.mapRISType(fields.TY || 'JOUR'),
                title: fields.TI || fields.T1 || '',
                authors: this.parseRISAuthors(fields.AU || fields.A1 || []),
                year: parseInt(fields.PY || fields.Y1) || null,
                publication: fields.JO || fields.JF || fields.T2 || '',
                publisher: fields.PB || '',
                doi: fields.DO || '',
                url: fields.UR || fields.L1 || ''
            };
            
            return new Citation(citationData);
        } catch (error) {
            console.warn('Failed to parse RIS entry:', error);
            return null;
        }
    }

    /**
     * Parse CSV format
     */
    async parseCSV(content) {
        try {
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
            if (lines.length < 2) {
                throw new Error('CSV must have header and at least one data row');
            }
            
            const headers = this.parseCSVLine(lines[0]);
            const citations = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length !== headers.length) continue;
                
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header.toLowerCase()] = values[index] || '';
                });
                
                // Map CSV fields to Citation model
                const citationData = {
                    title: rowData.title || '',
                    authors: this.parseCSVAuthors(rowData.authors || ''),
                    year: parseInt(rowData.year) || null,
                    type: rowData.type || 'article',
                    publication: rowData.publication || '',
                    publisher: rowData.publisher || '',
                    doi: rowData.doi || '',
                    url: rowData.url || ''
                };
                
                citations.push(new Citation(citationData));
            }
            
            return citations;
        } catch (error) {
            throw new Error(`Invalid CSV format: ${error.message}`);
        }
    }

    // Format-specific export methods

    /**
     * Export to JSON format
     */
    exportToJSON(citations, options = {}) {
        const data = {
            exported: new Date().toISOString(),
            count: citations.length,
            format: 'json',
            citations: citations.map(citation => citation.toJSON())
        };
        
        return JSON.stringify(data, null, options.pretty ? 2 : 0);
    }

    /**
     * Export to BibTeX format
     */
    exportToBibTeX(citations, options = {}) {
        let output = '';
        
        if (options.header) {
            output += `% Generated by Research Writer on ${new Date().toISOString()}\n\n`;
        }
        
        citations.forEach((citation, index) => {
            if (index > 0) output += '\n';
            output += citation.toBibTeX() + '\n';
        });
        
        return output;
    }

    /**
     * Export to RIS format
     */
    exportToRIS(citations, options = {}) {
        let output = '';
        
        citations.forEach((citation, index) => {
            if (index > 0) output += '\n';
            output += this.citationToRIS(citation) + '\n';
        });
        
        return output;
    }

    /**
     * Export to CSV format
     */
    exportToCSV(citations, options = {}) {
        const headers = ['title', 'authors', 'year', 'type', 'publication', 'publisher', 'doi', 'url'];
        let output = headers.join(',') + '\n';
        
        citations.forEach(citation => {
            const row = headers.map(header => {
                let value = citation[header] || '';
                if (Array.isArray(value)) {
                    value = value.join('; ');
                }
                // Escape CSV values
                value = String(value).replace(/"/g, '""');
                return `"${value}"`;
            });
            output += row.join(',') + '\n';
        });
        
        return output;
    }

    /**
     * Export to plain text format
     */
    exportToText(citations, options = {}) {
        const style = options.style || 'apa';
        let output = `Citations exported on ${new Date().toLocaleDateString()}\n`;
        output += `Format: ${style.toUpperCase()}\n`;
        output += `Count: ${citations.length}\n\n`;
        output += '=' * 50 + '\n\n';
        
        citations.forEach((citation, index) => {
            output += `${index + 1}. ${citation.format(style)}\n\n`;
        });
        
        return output;
    }

    // Utility methods

    /**
     * Check if citation is duplicate
     */
    isDuplicate(citation) {
        const existing = this.getCitations();
        
        return existing.some(existingCitation => {
            // Check by DOI first (most reliable)
            if (citation.doi && existingCitation.doi) {
                return citation.doi.toLowerCase() === existingCitation.doi.toLowerCase();
            }
            
            // Check by title and first author
            if (citation.title && existingCitation.title && 
                citation.authors.length > 0 && existingCitation.authors.length > 0) {
                const titleMatch = citation.title.toLowerCase() === existingCitation.title.toLowerCase();
                const authorMatch = citation.authors[0].toLowerCase() === existingCitation.authors[0].toLowerCase();
                return titleMatch && authorMatch;
            }
            
            return false;
        });
    }

    /**
     * Generate cache key
     */
    generateCacheKey(prefix, options) {
        return `${prefix}_${JSON.stringify(options)}`;
    }

    /**
     * Get from cache
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Set cache
     */
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate cache
     */
    invalidateCache() {
        this.cache.clear();
    }

    /**
     * Read file content
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Get file extension
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Get MIME type for format
     */
    getMimeType(format) {
        const mimeTypes = {
            json: 'application/json',
            bibtex: 'application/x-bibtex',
            bib: 'application/x-bibtex',
            ris: 'application/x-research-info-systems',
            csv: 'text/csv',
            txt: 'text/plain'
        };
        return mimeTypes[format.toLowerCase()] || 'text/plain';
    }

    // Helper parsing methods

    parseBibTeXAuthors(authorString) {
        if (!authorString) return [];
        return authorString.split(' and ').map(author => author.trim()).filter(author => author);
    }

    parseRISAuthors(authors) {
        if (!authors) return [];
        return Array.isArray(authors) ? authors : [authors];
    }

    parseCSVAuthors(authorString) {
        if (!authorString) return [];
        return authorString.split(/[;,]/).map(author => author.trim()).filter(author => author);
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result.map(field => field.replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
    }

    mapBibTeXType(bibType) {
        const typeMap = {
            article: 'article',
            inproceedings: 'conference',
            book: 'book',
            phdthesis: 'thesis',
            mastersthesis: 'thesis',
            misc: 'website'
        };
        return typeMap[bibType] || 'article';
    }

    mapRISType(risType) {
        const typeMap = {
            JOUR: 'article',
            BOOK: 'book',
            CONF: 'conference',
            THES: 'thesis',
            ELEC: 'website'
        };
        return typeMap[risType] || 'article';
    }

    citationToRIS(citation) {
        let ris = `TY  - ${this.mapTypeToRIS(citation.type)}\n`;
        
        if (citation.title) ris += `TI  - ${citation.title}\n`;
        
        citation.authors.forEach(author => {
            ris += `AU  - ${author}\n`;
        });
        
        if (citation.year) ris += `PY  - ${citation.year}\n`;
        if (citation.publication) ris += `JO  - ${citation.publication}\n`;
        if (citation.publisher) ris += `PB  - ${citation.publisher}\n`;
        if (citation.doi) ris += `DO  - ${citation.doi}\n`;
        if (citation.url) ris += `UR  - ${citation.url}\n`;
        
        ris += `ER  - \n`;
        
        return ris;
    }

    mapTypeToRIS(type) {
        const typeMap = {
            article: 'JOUR',
            book: 'BOOK',
            conference: 'CONF',
            thesis: 'THES',
            website: 'ELEC'
        };
        return typeMap[type] || 'JOUR';
    }

    // Event handling

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event callback error for ${event}:`, error);
                }
            });
        }
    }

    // Progress callbacks

    setImportProgressCallback(callback) {
        this.importProgressCallback = callback;
    }

    setExportProgressCallback(callback) {
        this.exportProgressCallback = callback;
    }
}