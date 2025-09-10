/**
 * NoteManager - Core module for note CRUD operations, search, and organization
 * Integrates with StorageService for persistence and Note model for data structure
 */

import { StorageService } from '../../services/StorageService.js';
import { Note } from '../../models/Note.js';

export class NoteManager {
    constructor() {
        this.storage = new StorageService();
        this.collection = 'notes';
        this.searchIndex = new Map();
        this.tagIndex = new Map();
        this.categoryIndex = new Map();
        this.linkIndex = new Map();
        
        this.initializeIndexes();
    }

    /**
     * Initialize search and categorization indexes for performance
     */
    async initializeIndexes() {
        try {
            const notes = await this.listNotes();
            this.rebuildIndexes(notes);
        } catch (error) {
            console.error('Failed to initialize NoteManager indexes:', error);
        }
    }

    /**
     * Rebuild all indexes from note data
     */
    rebuildIndexes(notes) {
        this.searchIndex.clear();
        this.tagIndex.clear();
        this.categoryIndex.clear();
        this.linkIndex.clear();

        notes.forEach(note => {
            this.updateIndexes(note, 'add');
        });
    }

    /**
     * Update indexes when notes are added/updated/removed
     */
    updateIndexes(note, operation = 'add') {
        if (operation === 'remove') {
            // Remove from indexes
            this.searchIndex.delete(note.id);
            
            note.tags.forEach(tag => {
                const tagNotes = this.tagIndex.get(tag) || new Set();
                tagNotes.delete(note.id);
                if (tagNotes.size === 0) {
                    this.tagIndex.delete(tag);
                } else {
                    this.tagIndex.set(tag, tagNotes);
                }
            });

            const categoryNotes = this.categoryIndex.get(note.category) || new Set();
            categoryNotes.delete(note.id);
            if (categoryNotes.size === 0) {
                this.categoryIndex.delete(note.category);
            } else {
                this.categoryIndex.set(note.category, categoryNotes);
            }

            // Remove link indexes
            note.linkedNotes.forEach(linkedId => {
                const links = this.linkIndex.get(linkedId) || new Set();
                links.delete(note.id);
                if (links.size === 0) {
                    this.linkIndex.delete(linkedId);
                } else {
                    this.linkIndex.set(linkedId, links);
                }
            });
        } else {
            // Add/update indexes
            const searchContent = `${note.title} ${note.content} ${note.tags.join(' ')} ${note.category}`.toLowerCase();
            this.searchIndex.set(note.id, searchContent);

            // Tag index
            note.tags.forEach(tag => {
                const tagNotes = this.tagIndex.get(tag) || new Set();
                tagNotes.add(note.id);
                this.tagIndex.set(tag, tagNotes);
            });

            // Category index
            const categoryNotes = this.categoryIndex.get(note.category) || new Set();
            categoryNotes.add(note.id);
            this.categoryIndex.set(note.category, categoryNotes);

            // Link index
            note.linkedNotes.forEach(linkedId => {
                const links = this.linkIndex.get(linkedId) || new Set();
                links.add(note.id);
                this.linkIndex.set(linkedId, links);
            });
        }
    }

    /**
     * Create a new note
     */
    async createNote(noteData) {
        try {
            const note = new Note(noteData);
            
            if (!note.isValid()) {
                throw new Error('Invalid note data: title is required');
            }

            const savedNote = this.storage.create(this.collection, note.toJSON());
            this.updateIndexes(note, 'add');
            
            return Note.fromJSON(savedNote);
        } catch (error) {
            console.error('Failed to create note:', error);
            throw error;
        }
    }

    /**
     * Read a note by ID
     */
    async getNote(id) {
        try {
            const noteData = this.storage.read(this.collection, id);
            return noteData ? Note.fromJSON(noteData) : null;
        } catch (error) {
            console.error(`Failed to get note ${id}:`, error);
            return null;
        }
    }

    /**
     * Update an existing note
     */
    async updateNote(id, updates) {
        try {
            const existingNote = await this.getNote(id);
            if (!existingNote) {
                throw new Error(`Note with id ${id} not found`);
            }

            // Remove from indexes before update
            this.updateIndexes(existingNote, 'remove');

            const updatedNote = existingNote.update(updates);
            const savedNote = this.storage.update(this.collection, id, updatedNote.toJSON());
            
            // Add back to indexes after update
            this.updateIndexes(updatedNote, 'add');
            
            return Note.fromJSON(savedNote);
        } catch (error) {
            console.error(`Failed to update note ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete a note (soft delete)
     */
    async deleteNote(id, permanent = false) {
        try {
            if (permanent) {
                const existingNote = await this.getNote(id);
                if (existingNote) {
                    this.updateIndexes(existingNote, 'remove');
                }
                return this.storage.delete(this.collection, id);
            } else {
                // Soft delete
                return await this.updateNote(id, { status: 'deleted' });
            }
        } catch (error) {
            console.error(`Failed to delete note ${id}:`, error);
            throw error;
        }
    }

    /**
     * List notes with filtering and sorting
     */
    async listNotes(options = {}) {
        try {
            const notes = this.storage.list(this.collection, {
                filter: (note) => {
                    // Filter out deleted notes unless explicitly requested
                    if (!options.includeDeleted && note.status === 'deleted') {
                        return false;
                    }
                    return true;
                },
                sortBy: options.sortBy || 'updated',
                sortOrder: options.sortOrder || 'desc',
                limit: options.limit,
                offset: options.offset
            });

            return notes.map(note => Note.fromJSON(note));
        } catch (error) {
            console.error('Failed to list notes:', error);
            return [];
        }
    }

    /**
     * Search notes with advanced filtering (<300ms performance target)
     */
    async searchNotes(query, filters = {}) {
        const startTime = performance.now();
        
        try {
            let results = new Set();
            const queryLower = query.toLowerCase();

            // Fast text search using pre-built index
            if (query.trim()) {
                this.searchIndex.forEach((content, noteId) => {
                    if (content.includes(queryLower)) {
                        results.add(noteId);
                    }
                });
            } else {
                // No query - get all notes
                const notes = await this.listNotes();
                notes.forEach(note => results.add(note.id));
            }

            // Apply filters
            if (filters.tags && filters.tags.length > 0) {
                const tagResults = new Set();
                filters.tags.forEach(tag => {
                    const tagNotes = this.tagIndex.get(tag) || new Set();
                    tagNotes.forEach(noteId => tagResults.add(noteId));
                });
                
                if (filters.tagOperator === 'AND') {
                    results = new Set([...results].filter(id => tagResults.has(id)));
                } else {
                    // OR operation
                    results = new Set([...results, ...tagResults]);
                }
            }

            if (filters.categories && filters.categories.length > 0) {
                const categoryResults = new Set();
                filters.categories.forEach(category => {
                    const categoryNotes = this.categoryIndex.get(category) || new Set();
                    categoryNotes.forEach(noteId => categoryResults.add(noteId));
                });
                results = new Set([...results].filter(id => categoryResults.has(id)));
            }

            if (filters.type) {
                const filteredResults = new Set();
                for (const noteId of results) {
                    const note = await this.getNote(noteId);
                    if (note && note.type === filters.type) {
                        filteredResults.add(noteId);
                    }
                }
                results = filteredResults;
            }

            if (filters.dateRange) {
                const { startDate, endDate } = filters.dateRange;
                const filteredResults = new Set();
                for (const noteId of results) {
                    const note = await this.getNote(noteId);
                    if (note) {
                        const noteDate = new Date(note.created);
                        if ((!startDate || noteDate >= new Date(startDate)) &&
                            (!endDate || noteDate <= new Date(endDate))) {
                            filteredResults.add(noteId);
                        }
                    }
                }
                results = filteredResults;
            }

            // Convert to note objects and sort
            const notePromises = [...results].map(id => this.getNote(id));
            const notes = (await Promise.all(notePromises)).filter(note => note !== null);

            // Apply sorting
            const sortBy = filters.sortBy || 'updated';
            const sortOrder = filters.sortOrder || 'desc';
            
            notes.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                
                if (sortOrder === 'asc') {
                    return aVal < bVal ? -1 : (aVal > bVal ? 1 : 0);
                } else {
                    return aVal > bVal ? -1 : (aVal < bVal ? 1 : 0);
                }
            });

            // Apply pagination
            const offset = filters.offset || 0;
            const limit = filters.limit || notes.length;
            const paginatedNotes = notes.slice(offset, offset + limit);

            const endTime = performance.now();
            const searchTime = endTime - startTime;

            console.log(`Search completed in ${searchTime.toFixed(2)}ms`);

            return {
                notes: paginatedNotes,
                total: notes.length,
                searchTime,
                performanceTarget: searchTime < 300
            };
        } catch (error) {
            console.error('Search failed:', error);
            return {
                notes: [],
                total: 0,
                searchTime: performance.now() - startTime,
                performanceTarget: false,
                error: error.message
            };
        }
    }

    /**
     * Get notes linked to a specific note
     */
    async getLinkedNotes(noteId) {
        try {
            const linkedIds = this.linkIndex.get(noteId) || new Set();
            const notePromises = [...linkedIds].map(id => this.getNote(id));
            const linkedNotes = await Promise.all(notePromises);
            return linkedNotes.filter(note => note !== null);
        } catch (error) {
            console.error(`Failed to get linked notes for ${noteId}:`, error);
            return [];
        }
    }

    /**
     * Link two notes together
     */
    async linkNotes(noteId1, noteId2) {
        try {
            const note1 = await this.getNote(noteId1);
            const note2 = await this.getNote(noteId2);

            if (!note1 || !note2) {
                throw new Error('One or both notes not found');
            }

            // Update both notes
            await this.updateNote(noteId1, {
                linkedNotes: [...new Set([...note1.linkedNotes, noteId2])]
            });
            
            await this.updateNote(noteId2, {
                linkedNotes: [...new Set([...note2.linkedNotes, noteId1])]
            });

            return true;
        } catch (error) {
            console.error(`Failed to link notes ${noteId1} and ${noteId2}:`, error);
            throw error;
        }
    }

    /**
     * Unlink two notes
     */
    async unlinkNotes(noteId1, noteId2) {
        try {
            const note1 = await this.getNote(noteId1);
            const note2 = await this.getNote(noteId2);

            if (!note1 || !note2) {
                throw new Error('One or both notes not found');
            }

            // Update both notes
            await this.updateNote(noteId1, {
                linkedNotes: note1.linkedNotes.filter(id => id !== noteId2)
            });
            
            await this.updateNote(noteId2, {
                linkedNotes: note2.linkedNotes.filter(id => id !== noteId1)
            });

            return true;
        } catch (error) {
            console.error(`Failed to unlink notes ${noteId1} and ${noteId2}:`, error);
            throw error;
        }
    }

    /**
     * Get all unique tags
     */
    getAllTags() {
        return [...this.tagIndex.keys()].sort();
    }

    /**
     * Get all categories
     */
    getAllCategories() {
        return [...this.categoryIndex.keys()].sort();
    }

    /**
     * Get notes by tag
     */
    async getNotesByTag(tag) {
        try {
            const noteIds = this.tagIndex.get(tag) || new Set();
            const notePromises = [...noteIds].map(id => this.getNote(id));
            const notes = await Promise.all(notePromises);
            return notes.filter(note => note !== null);
        } catch (error) {
            console.error(`Failed to get notes by tag ${tag}:`, error);
            return [];
        }
    }

    /**
     * Get notes by category
     */
    async getNotesByCategory(category) {
        try {
            const noteIds = this.categoryIndex.get(category) || new Set();
            const notePromises = [...noteIds].map(id => this.getNote(id));
            const notes = await Promise.all(notePromises);
            return notes.filter(note => note !== null);
        } catch (error) {
            console.error(`Failed to get notes by category ${category}:`, error);
            return [];
        }
    }

    /**
     * Get note statistics
     */
    async getStatistics() {
        try {
            const notes = await this.listNotes();
            const totalNotes = notes.length;
            const totalWords = notes.reduce((sum, note) => sum + (note.wordCount || 0), 0);
            const totalCharacters = notes.reduce((sum, note) => sum + (note.characterCount || 0), 0);
            
            const typeDistribution = {};
            const categoryDistribution = {};
            const tagFrequency = {};

            notes.forEach(note => {
                // Type distribution
                typeDistribution[note.type] = (typeDistribution[note.type] || 0) + 1;
                
                // Category distribution
                categoryDistribution[note.category] = (categoryDistribution[note.category] || 0) + 1;
                
                // Tag frequency
                note.tags.forEach(tag => {
                    tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                });
            });

            return {
                totalNotes,
                totalWords,
                totalCharacters,
                averageWordsPerNote: totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0,
                typeDistribution,
                categoryDistribution,
                tagFrequency,
                totalTags: Object.keys(tagFrequency).length,
                totalCategories: Object.keys(categoryDistribution).length,
                mostUsedTags: Object.entries(tagFrequency)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([tag, count]) => ({ tag, count }))
            };
        } catch (error) {
            console.error('Failed to get statistics:', error);
            return null;
        }
    }

    /**
     * Export notes in various formats
     */
    async exportNotes(format = 'json', options = {}) {
        try {
            const notes = await this.listNotes(options);
            
            switch (format) {
                case 'markdown':
                    return notes.map(note => note.toMarkdown()).join('\n\n---\n\n');
                
                case 'csv':
                    const csvHeaders = ['id', 'title', 'type', 'category', 'tags', 'wordCount', 'created', 'updated', 'status'];
                    const csvRows = [
                        csvHeaders.join(','),
                        ...notes.map(note => {
                            const exportData = note.toExportFormat('csv');
                            return csvHeaders.map(header => 
                                `"${(exportData[header] || '').toString().replace(/"/g, '""')}"`
                            ).join(',');
                        })
                    ];
                    return csvRows.join('\n');
                
                case 'json':
                default:
                    return JSON.stringify(notes.map(note => note.toJSON()), null, 2);
            }
        } catch (error) {
            console.error(`Failed to export notes in ${format} format:`, error);
            throw error;
        }
    }

    /**
     * Import notes from various formats
     */
    async importNotes(data, format = 'json') {
        try {
            let notesToImport = [];
            
            switch (format) {
                case 'json':
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    notesToImport = Array.isArray(parsed) ? parsed : [parsed];
                    break;
                
                case 'csv':
                    // Basic CSV parsing - in production, use a proper CSV parser
                    const lines = data.split('\n');
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
                        const noteData = {};
                        
                        headers.forEach((header, index) => {
                            if (header === 'tags' && values[index]) {
                                noteData[header] = values[index].split('; ');
                            } else {
                                noteData[header] = values[index];
                            }
                        });
                        
                        if (noteData.title) {
                            notesToImport.push(noteData);
                        }
                    }
                    break;
                
                default:
                    throw new Error(`Unsupported import format: ${format}`);
            }

            const results = {
                imported: 0,
                errors: [],
                duplicates: 0
            };

            for (const noteData of notesToImport) {
                try {
                    // Check for duplicates
                    if (await this.getNote(noteData.id)) {
                        results.duplicates++;
                        continue;
                    }

                    await this.createNote(noteData);
                    results.imported++;
                } catch (error) {
                    results.errors.push({
                        note: noteData.title || noteData.id,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error(`Failed to import notes from ${format}:`, error);
            throw error;
        }
    }

    /**
     * Cleanup and maintenance operations
     */
    async cleanup() {
        try {
            // Rebuild indexes
            const notes = await this.listNotes({ includeDeleted: true });
            this.rebuildIndexes(notes);
            
            // Clean up orphaned links
            let cleanedLinks = 0;
            for (const note of notes) {
                const validLinks = [];
                
                for (const linkedId of note.linkedNotes) {
                    const linkedNote = await this.getNote(linkedId);
                    if (linkedNote) {
                        validLinks.push(linkedId);
                    } else {
                        cleanedLinks++;
                    }
                }
                
                if (validLinks.length !== note.linkedNotes.length) {
                    await this.updateNote(note.id, { linkedNotes: validLinks });
                }
            }

            return {
                message: 'Cleanup completed successfully',
                indexesRebuilt: true,
                cleanedLinks
            };
        } catch (error) {
            console.error('Cleanup failed:', error);
            throw error;
        }
    }
}