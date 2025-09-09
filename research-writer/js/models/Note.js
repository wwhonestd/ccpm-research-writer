/**
 * Note Data Model - Research notes with tagging, categorization, and rich content support
 */
export class Note {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.content = data.content || '';
        this.type = data.type || 'general';
        this.category = data.category || 'uncategorized';
        this.tags = data.tags || [];
        this.keywords = data.keywords || [];
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.status = data.status || 'active';
        this.linkedNotes = data.linkedNotes || [];
        this.linkedCitations = data.linkedCitations || [];
        this.sourceId = data.sourceId || null;
        this.sourceQuote = data.sourceQuote || '';
        
        this.updateDerivedFields();
    }

    generateId() {
        return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    updateDerivedFields() {
        this.wordCount = this.countWords();
        this.characterCount = this.content.length;
        this.readingTime = Math.ceil(this.wordCount / 200);
    }

    countWords() {
        if (!this.content) return 0;
        return this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    isValid() {
        return !!(this.id && this.title);
    }

    update(data) {
        const updatedData = { ...this.toJSON(), ...data, updated: new Date().toISOString() };
        const updatedNote = new Note(updatedData);
        updatedNote.updateDerivedFields();
        return updatedNote;
    }

    extractKeywords(minFrequency = 2) {
        if (!this.content) return [];
        const words = this.content.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);
            
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .filter(([word, count]) => count >= minFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word)
            .slice(0, 10);
    }

    linkToNote(noteId) {
        if (!this.linkedNotes.includes(noteId)) {
            this.linkedNotes.push(noteId);
            this.updated = new Date().toISOString();
        }
    }

    linkToCitation(citationId) {
        if (!this.linkedCitations.includes(citationId)) {
            this.linkedCitations.push(citationId);
            this.updated = new Date().toISOString();
        }
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updated = new Date().toISOString();
        }
    }

    toMarkdown() {
        let markdown = `# ${this.title}\n\n`;
        
        if (this.tags.length > 0) {
            markdown += `**Tags:** ${this.tags.join(', ')}\n\n`;
        }
        
        if (this.category !== 'uncategorized') {
            markdown += `**Category:** ${this.category}\n\n`;
        }
        
        if (this.sourceQuote) {
            markdown += `> ${this.sourceQuote}\n\n`;
        }
        
        markdown += this.content + '\n\n';
        
        markdown += `---\n*Created: ${this.created}*\n*Updated: ${this.updated}*\n`;
        
        return markdown;
    }

    getStats() {
        return {
            wordCount: this.wordCount,
            characterCount: this.characterCount,
            readingTime: this.readingTime,
            tagCount: this.tags.length,
            linkCount: this.linkedNotes.length + this.linkedCitations.length,
            daysSinceCreated: Math.floor((new Date() - new Date(this.created)) / (1000 * 60 * 60 * 24)),
            daysSinceUpdated: Math.floor((new Date() - new Date(this.updated)) / (1000 * 60 * 60 * 24))
        };
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            type: this.type,
            category: this.category,
            tags: this.tags,
            keywords: this.keywords,
            created: this.created,
            updated: this.updated,
            status: this.status,
            wordCount: this.wordCount,
            characterCount: this.characterCount,
            readingTime: this.readingTime,
            linkedNotes: this.linkedNotes,
            linkedCitations: this.linkedCitations,
            sourceId: this.sourceId,
            sourceQuote: this.sourceQuote
        };
    }

    static fromJSON(data) {
        return new Note(data);
    }

    toExportFormat(format = 'json') {
        if (format === 'csv') {
            return {
                id: this.id,
                title: this.title,
                type: this.type,
                category: this.category,
                tags: this.tags.join('; '),
                wordCount: this.wordCount,
                created: this.created,
                updated: this.updated,
                status: this.status,
                linkCount: this.linkedNotes.length + this.linkedCitations.length
            };
        }
        return this.toJSON();
    }
}

export const NoteSchema = {
    type: 'object',
    required: ['id', 'title', 'created'],
    properties: {
        id: { type: 'string', pattern: '^note_' },
        title: { type: 'string', minLength: 1, maxLength: 500 },
        content: { type: 'string', maxLength: 50000 },
        type: { type: 'string', enum: ['general', 'quote', 'summary', 'analysis', 'idea', 'todo', 'question'] },
        category: { type: 'string', maxLength: 100 },
        tags: { type: 'array', items: { type: 'string', maxLength: 50 } },
        keywords: { type: 'array', items: { type: 'string', maxLength: 50 } },
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['active', 'archived', 'deleted'] },
        wordCount: { type: 'number', minimum: 0 },
        characterCount: { type: 'number', minimum: 0 },
        readingTime: { type: 'number', minimum: 0 },
        linkedNotes: { type: 'array', items: { type: 'string' } },
        linkedCitations: { type: 'array', items: { type: 'string' } },
        sourceId: { type: ['string', 'null'] },
        sourceQuote: { type: 'string', maxLength: 2000 }
    }
};