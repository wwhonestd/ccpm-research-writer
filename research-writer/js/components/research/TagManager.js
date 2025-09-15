/**
 * TagManager - Advanced tagging and categorization system
 * Features: hierarchical tags, tag suggestions, tag analytics, bulk operations
 */

export class TagManager {
    constructor(noteManager, options = {}) {
        this.noteManager = noteManager;
        this.options = {
            maxSuggestions: 10,
            minTagLength: 2,
            maxTagLength: 50,
            allowHierarchical: true,
            hierarchySeparator: '/',
            showAnalytics: true,
            enableAutoComplete: true,
            ...options
        };
        
        this.tagCache = new Map();
        this.tagHierarchy = new Map();
        this.tagAnalytics = new Map();
        
        this.init();
    }

    /**
     * Initialize the tag manager
     */
    async init() {
        await this.refreshTagCache();
        this.buildHierarchy();
        this.calculateAnalytics();
    }

    /**
     * Refresh the tag cache from stored notes
     */
    async refreshTagCache() {
        try {
            const notes = await this.noteManager.listNotes();
            this.tagCache.clear();
            
            notes.forEach(note => {
                note.tags.forEach(tag => {
                    if (!this.tagCache.has(tag)) {
                        this.tagCache.set(tag, {
                            name: tag,
                            count: 0,
                            notes: new Set(),
                            created: new Date().toISOString(),
                            lastUsed: null
                        });
                    }
                    
                    const tagData = this.tagCache.get(tag);
                    tagData.count++;
                    tagData.notes.add(note.id);
                    tagData.lastUsed = note.updated;
                });
            });
        } catch (error) {
            console.error('Failed to refresh tag cache:', error);
        }
    }

    /**
     * Build hierarchical tag structure
     */
    buildHierarchy() {
        if (!this.options.allowHierarchical) return;
        
        this.tagHierarchy.clear();
        
        this.tagCache.forEach((tagData, tagName) => {
            if (tagName.includes(this.options.hierarchySeparator)) {
                const parts = tagName.split(this.options.hierarchySeparator);
                let currentLevel = this.tagHierarchy;
                
                parts.forEach((part, index) => {
                    const isLeaf = index === parts.length - 1;
                    
                    if (!currentLevel.has(part)) {
                        currentLevel.set(part, {
                            name: part,
                            fullPath: parts.slice(0, index + 1).join(this.options.hierarchySeparator),
                            children: new Map(),
                            count: 0,
                            isLeaf
                        });
                    }
                    
                    const node = currentLevel.get(part);
                    if (isLeaf) {
                        node.count = tagData.count;
                        node.notes = tagData.notes;
                    }
                    
                    currentLevel = node.children;
                });
            } else {
                // Top-level tag
                if (!this.tagHierarchy.has(tagName)) {
                    this.tagHierarchy.set(tagName, {
                        name: tagName,
                        fullPath: tagName,
                        children: new Map(),
                        count: tagData.count,
                        notes: tagData.notes,
                        isLeaf: true
                    });
                }
            }
        });
    }

    /**
     * Calculate tag analytics
     */
    calculateAnalytics() {
        if (!this.options.showAnalytics) return;
        
        this.tagAnalytics.clear();
        
        const totalTags = this.tagCache.size;
        const totalUsage = Array.from(this.tagCache.values()).reduce((sum, tag) => sum + tag.count, 0);
        
        // Most used tags
        const mostUsed = Array.from(this.tagCache.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([name, data]) => ({ name, count: data.count, percentage: (data.count / totalUsage * 100).toFixed(1) }));
        
        // Recently used tags
        const recentlyUsed = Array.from(this.tagCache.entries())
            .filter(([, data]) => data.lastUsed)
            .sort((a, b) => new Date(b[1].lastUsed) - new Date(a[1].lastUsed))
            .slice(0, 10)
            .map(([name, data]) => ({ name, lastUsed: data.lastUsed }));
        
        // Unused tags (tags used only once)
        const underused = Array.from(this.tagCache.entries())
            .filter(([, data]) => data.count === 1)
            .map(([name, data]) => ({ name, count: data.count }));
        
        // Tag frequency distribution
        const frequencyDistribution = {};
        this.tagCache.forEach(tagData => {
            const freq = tagData.count;
            frequencyDistribution[freq] = (frequencyDistribution[freq] || 0) + 1;
        });
        
        this.tagAnalytics.set('overview', {
            totalTags,
            totalUsage,
            averageUsage: totalUsage / totalTags || 0,
            mostUsed,
            recentlyUsed,
            underused: underused.length,
            frequencyDistribution
        });
    }

    /**
     * Get all tags
     */
    getAllTags() {
        return Array.from(this.tagCache.keys()).sort();
    }

    /**
     * Get tag suggestions based on input
     */
    getTagSuggestions(input, limit = null) {
        const maxSuggestions = limit || this.options.maxSuggestions;
        const inputLower = input.toLowerCase();
        
        if (input.length < this.options.minTagLength) {
            return [];
        }
        
        const suggestions = [];
        
        // Exact matches first
        this.tagCache.forEach((tagData, tagName) => {
            if (tagName.toLowerCase().startsWith(inputLower)) {
                suggestions.push({
                    name: tagName,
                    count: tagData.count,
                    type: 'exact',
                    score: tagData.count * 2 + (tagName.toLowerCase() === inputLower ? 10 : 0)
                });
            }
        });
        
        // Partial matches
        if (suggestions.length < maxSuggestions) {
            this.tagCache.forEach((tagData, tagName) => {
                if (!tagName.toLowerCase().startsWith(inputLower) && 
                    tagName.toLowerCase().includes(inputLower)) {
                    suggestions.push({
                        name: tagName,
                        count: tagData.count,
                        type: 'partial',
                        score: tagData.count
                    });
                }
            });
        }
        
        // Sort by score and return top suggestions
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSuggestions);
    }

    /**
     * Get related tags (tags that commonly appear together)
     */
    async getRelatedTags(targetTag, limit = 5) {
        try {
            const notesWithTag = await this.noteManager.getNotesByTag(targetTag);
            const relatedTags = new Map();
            
            notesWithTag.forEach(note => {
                note.tags.forEach(tag => {
                    if (tag !== targetTag) {
                        relatedTags.set(tag, (relatedTags.get(tag) || 0) + 1);
                    }
                });
            });
            
            return Array.from(relatedTags.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([tag, count]) => ({
                    name: tag,
                    cooccurrence: count,
                    percentage: (count / notesWithTag.length * 100).toFixed(1)
                }));
        } catch (error) {
            console.error('Failed to get related tags:', error);
            return [];
        }
    }

    /**
     * Get hierarchical tag structure for display
     */
    getTagHierarchy() {
        if (!this.options.allowHierarchical) return null;
        
        const convertMapToObject = (map) => {
            const result = {};
            map.forEach((value, key) => {
                result[key] = {
                    ...value,
                    children: convertMapToObject(value.children)
                };
            });
            return result;
        };
        
        return convertMapToObject(this.tagHierarchy);
    }

    /**
     * Create a new tag
     */
    createTag(tagName) {
        if (!this.validateTagName(tagName)) {
            throw new Error(`Invalid tag name: ${tagName}`);
        }
        
        if (this.tagCache.has(tagName)) {
            return false; // Tag already exists
        }
        
        this.tagCache.set(tagName, {
            name: tagName,
            count: 0,
            notes: new Set(),
            created: new Date().toISOString(),
            lastUsed: null
        });
        
        this.buildHierarchy();
        return true;
    }

    /**
     * Rename a tag across all notes
     */
    async renameTag(oldTagName, newTagName) {
        if (!this.validateTagName(newTagName)) {
            throw new Error(`Invalid new tag name: ${newTagName}`);
        }
        
        if (!this.tagCache.has(oldTagName)) {
            throw new Error(`Tag "${oldTagName}" does not exist`);
        }
        
        if (this.tagCache.has(newTagName)) {
            throw new Error(`Tag "${newTagName}" already exists`);
        }
        
        try {
            const notesWithTag = await this.noteManager.getNotesByTag(oldTagName);
            const updatePromises = notesWithTag.map(note => {
                const newTags = note.tags.map(tag => tag === oldTagName ? newTagName : tag);
                return this.noteManager.updateNote(note.id, { tags: newTags });
            });
            
            await Promise.all(updatePromises);
            await this.refreshTagCache();
            this.buildHierarchy();
            this.calculateAnalytics();
            
            return {
                success: true,
                updatedNotes: notesWithTag.length
            };
        } catch (error) {
            console.error('Failed to rename tag:', error);
            throw error;
        }
    }

    /**
     * Merge two tags
     */
    async mergeTags(sourceTag, targetTag) {
        if (!this.tagCache.has(sourceTag)) {
            throw new Error(`Source tag "${sourceTag}" does not exist`);
        }
        
        if (!this.tagCache.has(targetTag)) {
            throw new Error(`Target tag "${targetTag}" does not exist`);
        }
        
        try {
            const notesWithSourceTag = await this.noteManager.getNotesByTag(sourceTag);
            const updatePromises = notesWithSourceTag.map(note => {
                const newTags = note.tags
                    .filter(tag => tag !== sourceTag)
                    .concat(note.tags.includes(targetTag) ? [] : [targetTag]);
                return this.noteManager.updateNote(note.id, { tags: newTags });
            });
            
            await Promise.all(updatePromises);
            await this.refreshTagCache();
            this.buildHierarchy();
            this.calculateAnalytics();
            
            return {
                success: true,
                mergedNotes: notesWithSourceTag.length
            };
        } catch (error) {
            console.error('Failed to merge tags:', error);
            throw error;
        }
    }

    /**
     * Delete a tag from all notes
     */
    async deleteTag(tagName) {
        if (!this.tagCache.has(tagName)) {
            throw new Error(`Tag "${tagName}" does not exist`);
        }
        
        try {
            const notesWithTag = await this.noteManager.getNotesByTag(tagName);
            const updatePromises = notesWithTag.map(note => {
                const newTags = note.tags.filter(tag => tag !== tagName);
                return this.noteManager.updateNote(note.id, { tags: newTags });
            });
            
            await Promise.all(updatePromises);
            await this.refreshTagCache();
            this.buildHierarchy();
            this.calculateAnalytics();
            
            return {
                success: true,
                updatedNotes: notesWithTag.length
            };
        } catch (error) {
            console.error('Failed to delete tag:', error);
            throw error;
        }
    }

    /**
     * Get tag analytics
     */
    getAnalytics() {
        return this.tagAnalytics.get('overview') || {};
    }

    /**
     * Get tag details
     */
    getTagDetails(tagName) {
        const tagData = this.tagCache.get(tagName);
        if (!tagData) return null;
        
        return {
            name: tagName,
            count: tagData.count,
            notes: Array.from(tagData.notes),
            created: tagData.created,
            lastUsed: tagData.lastUsed,
            isHierarchical: tagName.includes(this.options.hierarchySeparator)
        };
    }

    /**
     * Search tags
     */
    searchTags(query, options = {}) {
        const queryLower = query.toLowerCase();
        const results = [];
        
        this.tagCache.forEach((tagData, tagName) => {
            const relevance = this.calculateTagRelevance(tagName, queryLower);
            if (relevance > 0) {
                results.push({
                    name: tagName,
                    count: tagData.count,
                    relevance,
                    notes: Array.from(tagData.notes)
                });
            }
        });
        
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, options.limit || 50);
    }

    /**
     * Calculate tag relevance for search
     */
    calculateTagRelevance(tagName, query) {
        const tagLower = tagName.toLowerCase();
        
        if (tagLower === query) return 100;
        if (tagLower.startsWith(query)) return 80;
        if (tagLower.includes(query)) return 60;
        
        // Fuzzy matching for typos
        const distance = this.levenshteinDistance(tagLower, query);
        if (distance <= 2) return Math.max(0, 40 - distance * 10);
        
        return 0;
    }

    /**
     * Calculate Levenshtein distance for fuzzy matching
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Validate tag name
     */
    validateTagName(tagName) {
        if (!tagName || typeof tagName !== 'string') return false;
        if (tagName.length < this.options.minTagLength) return false;
        if (tagName.length > this.options.maxTagLength) return false;
        if (tagName.trim() !== tagName) return false;
        if (/^[\s\t\n\r]*$/.test(tagName)) return false;
        
        return true;
    }

    /**
     * Export tag data
     */
    exportTags(format = 'json') {
        const tagData = Array.from(this.tagCache.entries()).map(([name, data]) => ({
            name,
            count: data.count,
            created: data.created,
            lastUsed: data.lastUsed,
            noteIds: Array.from(data.notes)
        }));
        
        switch (format) {
            case 'csv':
                const headers = ['name', 'count', 'created', 'lastUsed'];
                const csvRows = [
                    headers.join(','),
                    ...tagData.map(tag => 
                        headers.map(header => `"${(tag[header] || '').toString().replace(/"/g, '""')}"`).join(',')
                    )
                ];
                return csvRows.join('\n');
            
            case 'json':
            default:
                return JSON.stringify({
                    tags: tagData,
                    hierarchy: this.options.allowHierarchical ? this.getTagHierarchy() : null,
                    analytics: this.getAnalytics(),
                    exportedAt: new Date().toISOString()
                }, null, 2);
        }
    }

    /**
     * Import tag data
     */
    async importTags(data, format = 'json') {
        try {
            let tagsToImport = [];
            
            switch (format) {
                case 'json':
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    tagsToImport = parsed.tags || [];
                    break;
                
                case 'csv':
                    const lines = data.split('\n');
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
                        const tagData = {};
                        
                        headers.forEach((header, index) => {
                            tagData[header] = values[index];
                        });
                        
                        if (tagData.name) {
                            tagsToImport.push(tagData);
                        }
                    }
                    break;
                
                default:
                    throw new Error(`Unsupported import format: ${format}`);
            }

            const results = {
                imported: 0,
                skipped: 0,
                errors: []
            };

            for (const tagData of tagsToImport) {
                try {
                    if (this.tagCache.has(tagData.name)) {
                        results.skipped++;
                        continue;
                    }

                    this.createTag(tagData.name);
                    results.imported++;
                } catch (error) {
                    results.errors.push({
                        tag: tagData.name,
                        error: error.message
                    });
                }
            }

            this.buildHierarchy();
            this.calculateAnalytics();

            return results;
        } catch (error) {
            console.error(`Failed to import tags from ${format}:`, error);
            throw error;
        }
    }

    /**
     * Get tag usage statistics
     */
    getUsageStatistics() {
        const tags = Array.from(this.tagCache.values());
        const totalUsage = tags.reduce((sum, tag) => sum + tag.count, 0);
        
        return {
            totalTags: tags.length,
            totalUsage,
            averageUsage: totalUsage / tags.length || 0,
            mostUsed: tags.sort((a, b) => b.count - a.count).slice(0, 5),
            leastUsed: tags.sort((a, b) => a.count - b.count).slice(0, 5),
            usageDistribution: this.getUsageDistribution(tags)
        };
    }

    /**
     * Get usage distribution for visualization
     */
    getUsageDistribution(tags) {
        const distribution = {};
        
        tags.forEach(tag => {
            let range;
            if (tag.count === 1) range = '1';
            else if (tag.count <= 5) range = '2-5';
            else if (tag.count <= 10) range = '6-10';
            else if (tag.count <= 25) range = '11-25';
            else range = '25+';
            
            distribution[range] = (distribution[range] || 0) + 1;
        });
        
        return distribution;
    }
}