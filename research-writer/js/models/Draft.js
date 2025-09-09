/**
 * Draft Data Model - Document drafts with version tracking and collaboration
 */
export class Draft {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || 'Untitled Draft';
        this.content = data.content || '';
        this.abstract = data.abstract || '';
        this.documentType = data.documentType || 'paper';
        this.formatting = data.formatting || 'markdown';
        this.citationStyle = data.citationStyle || 'apa';
        this.author = data.author || '';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.status = data.status || 'draft';
        this.version = data.version || '1.0.0';
        this.versionHistory = data.versionHistory || [];
        this.wordCountTarget = data.wordCountTarget || 0;
        this.pageCountTarget = data.pageCountTarget || 0;
        this.deadline = data.deadline || null;
        this.sections = data.sections || [];
        this.linkedNotes = data.linkedNotes || [];
        this.linkedCitations = data.linkedCitations || [];
        
        this.updateDerivedFields();
    }

    generateId() {
        return 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    updateDerivedFields() {
        this.wordCount = this.countWords();
        this.characterCount = this.content.length;
        this.pageCount = this.estimatePages();
        this.paragraphCount = this.countParagraphs();
        this.readingTime = Math.ceil(this.wordCount / 200);
        this.complexity = this.calculateReadabilityScore();
    }

    countWords() {
        if (!this.content) return 0;
        return this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    countParagraphs() {
        if (!this.content) return 0;
        return this.content.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length;
    }

    estimatePages() {
        return Math.ceil(this.wordCount / 250);
    }

    calculateReadabilityScore() {
        if (!this.content || this.wordCount === 0) return 0;
        const sentences = this.content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        if (sentences === 0) return 0;
        const avgWordsPerSentence = this.wordCount / sentences;
        return Math.max(0, Math.min(100, Math.round(206.835 - (1.015 * avgWordsPerSentence))));
    }

    isValid() {
        return !!(this.id && this.title);
    }

    createVersion(comment = 'Version update') {
        const versionEntry = {
            version: this.version,
            timestamp: this.updated,
            comment: comment,
            wordCount: this.wordCount
        };
        
        this.versionHistory.unshift(versionEntry);
        this.version = this.incrementVersion(this.version);
        this.updated = new Date().toISOString();
        
        if (this.versionHistory.length > 50) {
            this.versionHistory = this.versionHistory.slice(0, 50);
        }
    }

    incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2]++;
        return parts.join('.');
    }

    update(data) {
        const significantChange = data.content && data.content !== this.content;
        const updatedData = {
            ...this.toJSON(),
            ...data,
            updated: new Date().toISOString()
        };
        
        const updatedDraft = new Draft(updatedData);
        
        if (significantChange) {
            updatedDraft.createVersion('Content updated');
        }
        
        return updatedDraft;
    }

    addSection(title, content = '', position = -1) {
        const section = {
            id: 'section_' + Date.now(),
            title: title,
            content: content,
            order: position >= 0 ? position : this.sections.length,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        
        if (position >= 0 && position < this.sections.length) {
            this.sections.splice(position, 0, section);
        } else {
            this.sections.push(section);
        }
        
        this.reorderSections();
        this.updated = new Date().toISOString();
        return section.id;
    }

    removeSection(sectionId) {
        this.sections = this.sections.filter(section => section.id !== sectionId);
        this.reorderSections();
        this.updated = new Date().toISOString();
    }

    reorderSections() {
        this.sections.forEach((section, index) => {
            section.order = index;
        });
    }

    linkNote(noteId) {
        if (!this.linkedNotes.includes(noteId)) {
            this.linkedNotes.push(noteId);
            this.updated = new Date().toISOString();
        }
    }

    linkCitation(citationId) {
        if (!this.linkedCitations.includes(citationId)) {
            this.linkedCitations.push(citationId);
            this.updated = new Date().toISOString();
        }
    }

    toMarkdown() {
        let markdown = `# ${this.title}\n\n`;
        
        if (this.abstract) {
            markdown += `## Abstract\n\n${this.abstract}\n\n`;
        }
        
        if (this.sections && this.sections.length > 0) {
            this.sections.forEach(section => {
                markdown += `## ${section.title}\n\n${section.content}\n\n`;
            });
        } else {
            markdown += this.content + '\n\n';
        }
        
        markdown += `---\n`;
        markdown += `*Author: ${this.author}*\n`;
        markdown += `*Version: ${this.version}*\n`;
        markdown += `*Word Count: ${this.wordCount}*\n`;
        
        return markdown;
    }

    getStats() {
        const progressPercent = this.wordCountTarget > 0 
            ? Math.min(100, Math.round((this.wordCount / this.wordCountTarget) * 100))
            : 0;
            
        return {
            wordCount: this.wordCount,
            characterCount: this.characterCount,
            paragraphCount: this.paragraphCount,
            pageCount: this.pageCount,
            readingTime: this.readingTime,
            complexity: this.complexity,
            progressPercent: progressPercent,
            isOverTarget: this.wordCount > this.wordCountTarget && this.wordCountTarget > 0,
            daysSinceCreated: Math.floor((new Date() - new Date(this.created)) / (1000 * 60 * 60 * 24)),
            daysSinceUpdated: Math.floor((new Date() - new Date(this.updated)) / (1000 * 60 * 60 * 24)),
            isOverdue: this.deadline && new Date() > new Date(this.deadline),
            versionCount: this.versionHistory.length,
            linkedResourcesCount: this.linkedNotes.length + this.linkedCitations.length
        };
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            abstract: this.abstract,
            documentType: this.documentType,
            formatting: this.formatting,
            citationStyle: this.citationStyle,
            author: this.author,
            created: this.created,
            updated: this.updated,
            status: this.status,
            version: this.version,
            versionHistory: this.versionHistory,
            wordCount: this.wordCount,
            characterCount: this.characterCount,
            pageCount: this.pageCount,
            paragraphCount: this.paragraphCount,
            readingTime: this.readingTime,
            complexity: this.complexity,
            wordCountTarget: this.wordCountTarget,
            pageCountTarget: this.pageCountTarget,
            deadline: this.deadline,
            sections: this.sections,
            linkedNotes: this.linkedNotes,
            linkedCitations: this.linkedCitations
        };
    }

    static fromJSON(data) {
        return new Draft(data);
    }

    toExportFormat(format = 'json') {
        if (format === 'csv') {
            return {
                id: this.id,
                title: this.title,
                documentType: this.documentType,
                status: this.status,
                author: this.author,
                wordCount: this.wordCount,
                pageCount: this.pageCount,
                version: this.version,
                created: this.created,
                updated: this.updated,
                deadline: this.deadline,
                progressPercent: this.getStats().progressPercent
            };
        }
        return this.toJSON();
    }
}

export const DraftSchema = {
    type: 'object',
    required: ['id', 'title', 'created'],
    properties: {
        id: { type: 'string', pattern: '^draft_' },
        title: { type: 'string', minLength: 1, maxLength: 500 },
        content: { type: 'string' },
        abstract: { type: 'string', maxLength: 5000 },
        documentType: { type: 'string', enum: ['paper', 'thesis', 'dissertation', 'report', 'article', 'book', 'chapter'] },
        formatting: { type: 'string', enum: ['markdown', 'html', 'latex', 'docx', 'plain'] },
        citationStyle: { type: 'string', enum: ['apa', 'mla', 'chicago', 'harvard', 'ieee'] },
        author: { type: 'string', maxLength: 200 },
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['draft', 'review', 'revision', 'final', 'published', 'archived'] },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        versionHistory: { type: 'array', items: { type: 'object' } },
        wordCount: { type: 'number', minimum: 0 },
        characterCount: { type: 'number', minimum: 0 },
        pageCount: { type: 'number', minimum: 0 },
        paragraphCount: { type: 'number', minimum: 0 },
        readingTime: { type: 'number', minimum: 0 },
        complexity: { type: 'number', minimum: 0, maximum: 100 },
        wordCountTarget: { type: 'number', minimum: 0 },
        pageCountTarget: { type: 'number', minimum: 0 },
        deadline: { type: ['string', 'null'], format: 'date-time' },
        sections: { type: 'array', items: { type: 'object' } },
        linkedNotes: { type: 'array', items: { type: 'string' } },
        linkedCitations: { type: 'array', items: { type: 'string' } }
    }
};