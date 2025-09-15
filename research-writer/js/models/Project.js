/**
 * Project Data Model - Research project data structure and validation
 */
export class Project {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.description = data.description || '';
        this.author = data.author || '';
        this.status = data.status || 'planning';
        this.priority = data.priority || 'medium';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.tags = data.tags || [];
        this.citations = data.citations || [];
        this.notes = data.notes || [];
        this.drafts = data.drafts || [];
    }

    generateId() {
        return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    isValid() {
        return !!(this.id && this.title && this.author);
    }

    getStats() {
        return {
            totalCitations: this.citations.length,
            totalNotes: this.notes.length,
            totalDrafts: this.drafts.length,
            completionScore: this.calculateCompletionScore()
        };
    }

    calculateCompletionScore() {
        let score = 0;
        if (this.title) score += 20;
        if (this.description) score += 20;
        if (this.citations.length > 0) score += 30;
        if (this.notes.length > 0) score += 15;
        if (this.drafts.length > 0) score += 15;
        return Math.min(score, 100);
    }

    update(data) {
        const updatedData = { ...this.toJSON(), ...data, updated: new Date().toISOString() };
        return new Project(updatedData);
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            author: this.author,
            status: this.status,
            priority: this.priority,
            created: this.created,
            updated: this.updated,
            tags: this.tags,
            citations: this.citations,
            notes: this.notes,
            drafts: this.drafts
        };
    }

    static fromJSON(data) {
        return new Project(data);
    }

    toExportFormat(format = 'json') {
        if (format === 'csv') {
            return {
                id: this.id,
                title: this.title,
                author: this.author,
                status: this.status,
                priority: this.priority,
                created: this.created,
                updated: this.updated,
                citationCount: this.citations.length,
                noteCount: this.notes.length,
                draftCount: this.drafts.length
            };
        }
        return this.toJSON();
    }
}

export const ProjectSchema = {
    type: 'object',
    required: ['id', 'title', 'author', 'created'],
    properties: {
        id: { type: 'string', pattern: '^proj_' },
        title: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', maxLength: 2000 },
        author: { type: 'string', minLength: 1, maxLength: 200 },
        status: { type: 'string', enum: ['planning', 'active', 'completed', 'archived'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        tags: { type: 'array', items: { type: 'string', maxLength: 50 } },
        citations: { type: 'array', items: { type: 'string' } },
        notes: { type: 'array', items: { type: 'string' } },
        drafts: { type: 'array', items: { type: 'string' } }
    }
};