/**
 * ImportExport Service
 * Handles importing and exporting data in various formats (JSON, CSV, BibTeX, RIS)
 * with format conversion and data transformation capabilities
 */

import { Project } from '../models/Project.js';
import { Citation } from '../models/Citation.js';
import { Note } from '../models/Note.js';
import { Draft } from '../models/Draft.js';
import { DataValidator } from './DataValidator.js';

export class ImportExportService {
    constructor(storageService) {
        this.storageService = storageService;
        this.validator = new DataValidator();
        this.supportedFormats = ['json', 'csv', 'bibtex', 'ris', 'markdown', 'latex'];
        this.modelClasses = {
            projects: Project,
            citations: Citation,
            notes: Note,
            drafts: Draft
        };
    }

    // Export functionality
    async exportData(options = {}) {
        const {
            collections = ['projects', 'citations', 'notes', 'drafts'],
            format = 'json',
            filters = {},
            includeMetadata = true,
            compression = false
        } = options;

        try {
            const exportData = {
                metadata: includeMetadata ? this.generateExportMetadata() : null,
                data: {}
            };

            // Export each collection
            for (const collection of collections) {
                const items = this.getFilteredItems(collection, filters[collection]);
                exportData.data[collection] = items;
            }

            // Format the data
            const formattedData = await this.formatExportData(exportData, format);
            
            // Apply compression if requested
            if (compression && format === 'json') {
                return this.compressData(formattedData);
            }

            return formattedData;
        } catch (error) {
            console.error('Export failed:', error);
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    generateExportMetadata() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            source: 'research-writer',
            totalItems: this.storageService.getStats().totalItems,
            storageStats: this.storageService.getStats()
        };
    }

    getFilteredItems(collection, filter) {
        const items = this.storageService.list(collection);
        
        if (!filter) return items;

        return items.filter(item => {
            for (const [field, criteria] of Object.entries(filter)) {
                if (!this.matchesCriteria(item[field], criteria)) {
                    return false;
                }
            }
            return true;
        });
    }

    matchesCriteria(value, criteria) {
        if (typeof criteria === 'function') {
            return criteria(value);
        }
        
        if (Array.isArray(criteria)) {
            return criteria.includes(value);
        }
        
        if (typeof criteria === 'object' && criteria !== null) {
            if (criteria.startsWith) return value && value.startsWith(criteria.startsWith);
            if (criteria.contains) return value && value.includes(criteria.contains);
            if (criteria.regex) return new RegExp(criteria.regex).test(value);
            if (criteria.min !== undefined) return value >= criteria.min;
            if (criteria.max !== undefined) return value <= criteria.max;
        }
        
        return value === criteria;
    }

    async formatExportData(exportData, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(exportData, null, 2);
            case 'csv':
                return this.formatAsCSV(exportData);
            case 'bibtex':
                return this.formatAsBibTeX(exportData);
            case 'ris':
                return this.formatAsRIS(exportData);
            case 'markdown':
                return this.formatAsMarkdown(exportData);
            case 'latex':
                return this.formatAsLaTeX(exportData);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    formatAsCSV(exportData) {
        let csv = '';
        
        for (const [collection, items] of Object.entries(exportData.data)) {
            if (items.length === 0) continue;
            
            csv += `# ${collection.toUpperCase()}\n`;
            
            // Get headers from the first item
            const sampleItem = items[0].toExportFormat ? items[0].toExportFormat('csv') : items[0];
            const headers = Object.keys(sampleItem);
            csv += headers.join(',') + '\n';
            
            // Add data rows
            items.forEach(item => {
                const csvItem = item.toExportFormat ? item.toExportFormat('csv') : item;
                const values = headers.map(header => {
                    const value = csvItem[header];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });
            
            csv += '\n';
        }
        
        return csv;
    }

    formatAsBibTeX(exportData) {
        let bibtex = '';
        
        if (exportData.data.citations) {
            bibtex += '% Research Writer Export - Citations\n';
            bibtex += `% Generated: ${new Date().toISOString()}\n\n`;
            
            exportData.data.citations.forEach(citation => {
                if (citation.toBibTeX) {
                    bibtex += citation.toBibTeX() + '\n\n';
                } else {
                    // Fallback BibTeX generation
                    bibtex += this.generateBibTeX(citation) + '\n\n';
                }
            });
        }
        
        return bibtex;
    }

    generateBibTeX(citation) {
        let bibtex = `@${citation.type || 'article'}{${citation.id},\n`;
        
        if (citation.title) bibtex += `  title={${citation.title}},\n`;
        if (citation.authors && citation.authors.length > 0) {
            bibtex += `  author={${citation.authors.join(' and ')}},\n`;
        }
        if (citation.year) bibtex += `  year={${citation.year}},\n`;
        if (citation.publication) bibtex += `  journal={${citation.publication}},\n`;
        if (citation.publisher) bibtex += `  publisher={${citation.publisher}},\n`;
        if (citation.volume) bibtex += `  volume={${citation.volume}},\n`;
        if (citation.issue) bibtex += `  number={${citation.issue}},\n`;
        if (citation.pages) bibtex += `  pages={${citation.pages}},\n`;
        if (citation.doi) bibtex += `  doi={${citation.doi}},\n`;
        if (citation.url) bibtex += `  url={${citation.url}},\n`;
        if (citation.isbn) bibtex += `  isbn={${citation.isbn}},\n`;
        
        bibtex += '}';
        return bibtex;
    }

    formatAsRIS(exportData) {
        let ris = '';
        
        if (exportData.data.citations) {
            exportData.data.citations.forEach(citation => {
                ris += this.generateRIS(citation) + '\n';
            });
        }
        
        return ris;
    }

    generateRIS(citation) {
        const typeMap = {
            article: 'JOUR',
            book: 'BOOK',
            chapter: 'CHAP',
            conference: 'CONF',
            thesis: 'THES',
            report: 'RPRT',
            website: 'ELEC'
        };
        
        let ris = `TY  - ${typeMap[citation.type] || 'GEN'}\n`;
        
        if (citation.title) ris += `TI  - ${citation.title}\n`;
        if (citation.authors) {
            citation.authors.forEach(author => {
                ris += `AU  - ${author}\n`;
            });
        }
        if (citation.year) ris += `PY  - ${citation.year}\n`;
        if (citation.publication) ris += `JO  - ${citation.publication}\n`;
        if (citation.publisher) ris += `PB  - ${citation.publisher}\n`;
        if (citation.volume) ris += `VL  - ${citation.volume}\n`;
        if (citation.issue) ris += `IS  - ${citation.issue}\n`;
        if (citation.pages) ris += `SP  - ${citation.pages}\n`;
        if (citation.doi) ris += `DO  - ${citation.doi}\n`;
        if (citation.url) ris += `UR  - ${citation.url}\n`;
        if (citation.abstract) ris += `AB  - ${citation.abstract}\n`;
        if (citation.keywords && citation.keywords.length > 0) {
            ris += `KW  - ${citation.keywords.join(', ')}\n`;
        }
        
        ris += 'ER  -\n';
        return ris;
    }

    formatAsMarkdown(exportData) {
        let markdown = '# Research Writer Export\n\n';
        
        if (exportData.metadata) {
            markdown += `*Generated: ${exportData.metadata.timestamp}*\n\n`;
        }
        
        for (const [collection, items] of Object.entries(exportData.data)) {
            if (items.length === 0) continue;
            
            markdown += `## ${collection.charAt(0).toUpperCase() + collection.slice(1)}\n\n`;
            
            items.forEach(item => {
                if (item.toMarkdown) {
                    markdown += item.toMarkdown() + '\n\n';
                } else {
                    markdown += this.generateMarkdown(item, collection) + '\n\n';
                }
            });
        }
        
        return markdown;
    }

    generateMarkdown(item, collection) {
        let markdown = `### ${item.title || item.id}\n\n`;
        
        if (item.content) {
            markdown += item.content + '\n\n';
        }
        
        if (item.tags && item.tags.length > 0) {
            markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
        }
        
        markdown += `*Created: ${item.created}*\n`;
        
        return markdown;
    }

    formatAsLaTeX(exportData) {
        let latex = '\\documentclass{article}\n';
        latex += '\\usepackage[utf8]{inputenc}\n';
        latex += '\\usepackage{url}\n';
        latex += '\\title{Research Writer Export}\n';
        latex += '\\date{\\today}\n\n';
        latex += '\\begin{document}\n';
        latex += '\\maketitle\n\n';
        
        for (const [collection, items] of Object.entries(exportData.data)) {
            if (items.length === 0) continue;
            
            latex += `\\section{${collection.charAt(0).toUpperCase() + collection.slice(1)}}\n\n`;
            
            items.forEach(item => {
                if (item.toLaTeX) {
                    latex += item.toLaTeX() + '\n\n';
                } else {
                    latex += this.generateLaTeX(item) + '\n\n';
                }
            });
        }
        
        latex += '\\end{document}';
        return latex;
    }

    generateLaTeX(item) {
        let latex = `\\subsection{${this.escapeLaTeX(item.title || item.id)}}\n\n`;
        
        if (item.content) {
            latex += this.escapeLaTeX(item.content) + '\n\n';
        }
        
        return latex;
    }

    escapeLaTeX(text) {
        if (typeof text !== 'string') return text;
        
        const replacements = {
            '\\': '\\textbackslash{}',
            '{': '\\{',
            '}': '\\}',
            '$': '\\$',
            '&': '\\&',
            '%': '\\%',
            '#': '\\#',
            '^': '\\textasciicircum{}',
            '_': '\\_',
            '~': '\\textasciitilde{}'
        };
        
        return text.replace(/[\\{}$&%#^_~]/g, match => replacements[match]);
    }

    // Import functionality
    async importData(data, options = {}) {
        const {
            format = 'json',
            merge = false,
            validate = true,
            createBackup = true,
            dryRun = false
        } = options;

        try {
            // Create backup before import if requested
            if (createBackup && !dryRun) {
                await this.storageService.createBackup();
            }

            // Parse the input data
            const parsedData = await this.parseImportData(data, format);
            
            // Validate the data if requested
            if (validate) {
                const validationResults = this.validateImportData(parsedData);
                if (validationResults.errors.length > 0 && !options.ignoreValidationErrors) {
                    return {
                        success: false,
                        errors: validationResults.errors,
                        warnings: validationResults.warnings
                    };
                }
            }

            // Perform the import
            if (dryRun) {
                return this.simulateImport(parsedData, { merge });
            } else {
                return this.performImport(parsedData, { merge });
            }
        } catch (error) {
            console.error('Import failed:', error);
            throw new Error(`Import failed: ${error.message}`);
        }
    }

    async parseImportData(data, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return this.parseJSON(data);
            case 'csv':
                return this.parseCSV(data);
            case 'bibtex':
                return this.parseBibTeX(data);
            case 'ris':
                return this.parseRIS(data);
            default:
                throw new Error(`Unsupported import format: ${format}`);
        }
    }

    parseJSON(data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Handle different JSON structures
        if (parsed.data) {
            return parsed; // Standard export format
        } else if (parsed.collections || parsed.projects || parsed.citations || parsed.notes || parsed.drafts) {
            return { data: parsed }; // Direct collection data
        } else {
            throw new Error('Invalid JSON structure for import');
        }
    }

    parseCSV(csvData) {
        const lines = csvData.split('\n').map(line => line.trim()).filter(line => line);
        const result = { data: {} };
        let currentCollection = null;
        let headers = [];
        
        for (const line of lines) {
            if (line.startsWith('# ')) {
                // Collection header
                currentCollection = line.substring(2).toLowerCase();
                result.data[currentCollection] = [];
                headers = [];
            } else if (currentCollection && headers.length === 0) {
                // Header row
                headers = this.parseCSVLine(line);
            } else if (currentCollection && headers.length > 0) {
                // Data row
                const values = this.parseCSVLine(line);
                const item = {};
                
                headers.forEach((header, index) => {
                    const value = values[index] || '';
                    item[header] = this.parseCSVValue(value);
                });
                
                result.data[currentCollection].push(item);
            }
        }
        
        return result;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    parseCSVValue(value) {
        if (value === '') return null;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (/^\d+$/.test(value)) return parseInt(value);
        if (/^\d*\.\d+$/.test(value)) return parseFloat(value);
        if (value.includes(';')) return value.split(';').map(v => v.trim());
        return value;
    }

    parseBibTeX(bibtexData) {
        const entries = [];
        const regex = /@(\w+)\s*{\s*([^,]+)\s*,\s*([\s\S]*?)\n}\s*(?=@|\s*$)/gi;
        let match;
        
        while ((match = regex.exec(bibtexData)) !== null) {
            const [, type, key, content] = match;
            const entry = {
                id: key.trim(),
                type: type.toLowerCase(),
                ...this.parseBibTeXFields(content)
            };
            entries.push(entry);
        }
        
        return {
            data: {
                citations: entries
            }
        };
    }

    parseBibTeXFields(content) {
        const fields = {};
        const fieldRegex = /(\w+)\s*=\s*{([^}]*)}/g;
        let match;
        
        while ((match = fieldRegex.exec(content)) !== null) {
            const [, field, value] = match;
            const fieldName = this.mapBibTeXField(field);
            fields[fieldName] = value.trim();
        }
        
        // Convert author field to array
        if (fields.authors) {
            fields.authors = fields.authors.split(' and ').map(author => author.trim());
        }
        
        return fields;
    }

    mapBibTeXField(bibField) {
        const mapping = {
            title: 'title',
            author: 'authors',
            year: 'year',
            journal: 'publication',
            publisher: 'publisher',
            volume: 'volume',
            number: 'issue',
            pages: 'pages',
            doi: 'doi',
            url: 'url',
            isbn: 'isbn',
            issn: 'issn'
        };
        
        return mapping[bibField.toLowerCase()] || bibField;
    }

    parseRIS(risData) {
        const entries = [];
        const lines = risData.split('\n').map(line => line.trim());
        let currentEntry = {};
        
        for (const line of lines) {
            if (line.startsWith('TY  -')) {
                if (Object.keys(currentEntry).length > 0) {
                    entries.push(currentEntry);
                }
                currentEntry = { type: this.mapRISType(line.substring(6).trim()) };
            } else if (line.startsWith('ER  -')) {
                if (Object.keys(currentEntry).length > 0) {
                    entries.push(currentEntry);
                    currentEntry = {};
                }
            } else if (line.includes('  - ')) {
                const [tag, ...valueParts] = line.split('  - ');
                const value = valueParts.join('  - ').trim();
                const field = this.mapRISField(tag.trim());
                
                if (field === 'authors') {
                    if (!currentEntry.authors) currentEntry.authors = [];
                    currentEntry.authors.push(value);
                } else if (field) {
                    currentEntry[field] = value;
                }
            }
        }
        
        return {
            data: {
                citations: entries
            }
        };
    }

    mapRISType(risType) {
        const mapping = {
            JOUR: 'article',
            BOOK: 'book',
            CHAP: 'chapter',
            CONF: 'conference',
            THES: 'thesis',
            RPRT: 'report',
            ELEC: 'website'
        };
        
        return mapping[risType] || 'article';
    }

    mapRISField(risField) {
        const mapping = {
            TI: 'title',
            AU: 'authors',
            PY: 'year',
            JO: 'publication',
            PB: 'publisher',
            VL: 'volume',
            IS: 'issue',
            SP: 'pages',
            DO: 'doi',
            UR: 'url',
            AB: 'abstract',
            KW: 'keywords'
        };
        
        return mapping[risField];
    }

    validateImportData(parsedData) {
        const errors = [];
        const warnings = [];
        
        if (!parsedData.data || typeof parsedData.data !== 'object') {
            errors.push('Invalid data structure: missing data object');
            return { errors, warnings };
        }
        
        for (const [collection, items] of Object.entries(parsedData.data)) {
            if (!Array.isArray(items)) {
                errors.push(`Invalid data structure: ${collection} must be an array`);
                continue;
            }
            
            items.forEach((item, index) => {
                const validation = this.validator.validate(collection, item);
                if (!validation.valid) {
                    errors.push(`${collection}[${index}]: ${validation.errors.join(', ')}`);
                }
                if (validation.warnings && validation.warnings.length > 0) {
                    warnings.push(`${collection}[${index}]: ${validation.warnings.join(', ')}`);
                }
            });
        }
        
        return { errors, warnings };
    }

    simulateImport(parsedData, options) {
        const { merge } = options;
        const results = {
            success: true,
            summary: {
                totalItems: 0,
                newItems: 0,
                updatedItems: 0,
                skippedItems: 0,
                errors: []
            },
            details: {}
        };
        
        for (const [collection, items] of Object.entries(parsedData.data)) {
            const collectionResult = {
                total: items.length,
                new: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };
            
            items.forEach(item => {
                results.summary.totalItems++;
                
                const exists = this.storageService.exists(collection, item.id);
                
                if (exists && !merge) {
                    collectionResult.skipped++;
                    results.summary.skippedItems++;
                } else if (exists) {
                    collectionResult.updated++;
                    results.summary.updatedItems++;
                } else {
                    collectionResult.new++;
                    results.summary.newItems++;
                }
            });
            
            results.details[collection] = collectionResult;
        }
        
        return results;
    }

    performImport(parsedData, options) {
        const { merge } = options;
        const results = {
            success: true,
            summary: {
                totalItems: 0,
                newItems: 0,
                updatedItems: 0,
                skippedItems: 0,
                errors: []
            },
            details: {}
        };
        
        for (const [collection, items] of Object.entries(parsedData.data)) {
            const collectionResult = {
                total: items.length,
                new: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };
            
            items.forEach(item => {
                try {
                    results.summary.totalItems++;
                    
                    // Create model instance
                    const ModelClass = this.modelClasses[collection];
                    if (ModelClass) {
                        item = new ModelClass(item);
                    }
                    
                    const exists = this.storageService.exists(collection, item.id);
                    
                    if (exists && !merge) {
                        collectionResult.skipped++;
                        results.summary.skippedItems++;
                    } else if (exists) {
                        this.storageService.update(collection, item.id, item);
                        collectionResult.updated++;
                        results.summary.updatedItems++;
                    } else {
                        this.storageService.create(collection, item);
                        collectionResult.new++;
                        results.summary.newItems++;
                    }
                } catch (error) {
                    collectionResult.errors.push({
                        item: item.id || 'unknown',
                        error: error.message
                    });
                    results.summary.errors.push({
                        collection,
                        item: item.id || 'unknown',
                        error: error.message
                    });
                }
            });
            
            results.details[collection] = collectionResult;
        }
        
        return results;
    }

    // Utility methods
    compressData(data) {
        // Simple compression - in production, use a proper compression library
        const compressed = JSON.stringify(data);
        return {
            compressed: true,
            data: compressed,
            originalSize: compressed.length,
            compressedSize: compressed.length // Placeholder
        };
    }

    decompressData(compressedData) {
        if (compressedData.compressed) {
            return JSON.parse(compressedData.data);
        }
        return compressedData;
    }

    // Template generation
    generateImportTemplate(format, collection = null) {
        const templates = {
            json: this.generateJSONTemplate(collection),
            csv: this.generateCSVTemplate(collection),
            bibtex: this.generateBibTeXTemplate(),
            ris: this.generateRISTemplate()
        };
        
        return templates[format.toLowerCase()] || templates.json;
    }

    generateJSONTemplate(collection) {
        const template = {
            metadata: {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                source: 'import-template'
            },
            data: {}
        };
        
        const sampleData = {
            projects: [new Project({ title: 'Sample Project', author: 'Author Name' })],
            citations: [new Citation({ title: 'Sample Article', authors: ['Author Name'], year: 2023 })],
            notes: [new Note({ title: 'Sample Note', content: 'Note content here' })],
            drafts: [new Draft({ title: 'Sample Draft', content: 'Draft content here' })]
        };
        
        if (collection) {
            template.data[collection] = sampleData[collection] || [];
        } else {
            template.data = sampleData;
        }
        
        return JSON.stringify(template, null, 2);
    }

    generateCSVTemplate(collection) {
        const templates = {
            projects: 'id,title,author,status,priority,created,description\nproj_example,Sample Project,Author Name,active,medium,2023-01-01T00:00:00.000Z,Project description',
            citations: 'id,title,authors,year,type,publication,doi\ncite_example,Sample Article,"Author Name",2023,article,Journal Name,10.1000/example',
            notes: 'id,title,content,type,tags,created\nnote_example,Sample Note,Note content here,general,"tag1; tag2",2023-01-01T00:00:00.000Z',
            drafts: 'id,title,content,documentType,wordCount,status,created\ndraft_example,Sample Draft,Draft content here,paper,100,draft,2023-01-01T00:00:00.000Z'
        };
        
        if (collection) {
            return `# ${collection.toUpperCase()}\n${templates[collection] || ''}`;
        }
        
        return Object.entries(templates)
            .map(([coll, template]) => `# ${coll.toUpperCase()}\n${template}`)
            .join('\n\n');
    }

    generateBibTeXTemplate() {
        return `@article{sample_key,
  title={Sample Article Title},
  author={Last, First and Second, Author},
  journal={Journal Name},
  volume={1},
  number={1},
  pages={1--10},
  year={2023},
  publisher={Publisher Name},
  doi={10.1000/example}
}

@book{sample_book,
  title={Sample Book Title},
  author={Author, Name},
  publisher={Publisher Name},
  year={2023},
  isbn={978-0000000000}
}`;
    }

    generateRISTemplate() {
        return `TY  - JOUR
TI  - Sample Article Title
AU  - Last, First
AU  - Second, Author
JO  - Journal Name
VL  - 1
IS  - 1
SP  - 1-10
PY  - 2023
PB  - Publisher Name
DO  - 10.1000/example
UR  - https://example.com
ER  -

TY  - BOOK
TI  - Sample Book Title
AU  - Author, Name
PB  - Publisher Name
PY  - 2023
ER  -`;
    }
}