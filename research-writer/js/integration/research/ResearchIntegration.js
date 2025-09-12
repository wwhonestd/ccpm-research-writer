/**
 * ResearchIntegration - Research data integration module
 * Handles integration of research notes, analysis data, and connections
 * Provides content aggregation and research context for document compilation
 */

import { StorageService } from '../../services/StorageService.js';
import { Note } from '../../models/Note.js';

export class ResearchIntegration {
    constructor(options = {}) {
        this.options = {
            enableCache: options.enableCache !== false,
            includeAnalysis: options.includeAnalysis !== false,
            includeConnections: options.includeConnections !== false,
            includeGaps: options.includeGaps || false,
            maxNotes: options.maxNotes || 100,
            maxConnections: options.maxConnections || 50,
            aggregationMode: options.aggregationMode || 'relevant', // 'all', 'relevant', 'recent'
            ...options
        };

        this.storageService = new StorageService();
        this.researchCache = new Map();
        this.analysisCache = new Map();
        this.connectionCache = new Map();
        
        this.aggregators = new Map();
        this.filters = new Map();
        this.rankers = new Map();

        this.isInitialized = false;
    }

    async init() {
        try {
            await this.initializeAggregators();
            await this.initializeFilters();
            await this.initializeRankers();
            this.isInitialized = true;
            console.log('Research integration initialized');
        } catch (error) {
            console.error('Research integration initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize content aggregators
     */
    async initializeAggregators() {
        // Note aggregator
        this.aggregators.set('notes', {
            aggregate: this.aggregateNotes.bind(this),
            priority: 1,
            cacheKey: 'notes'
        });

        // Analysis aggregator
        this.aggregators.set('analysis', {
            aggregate: this.aggregateAnalysis.bind(this),
            priority: 2,
            cacheKey: 'analysis'
        });

        // Connection aggregator
        this.aggregators.set('connections', {
            aggregate: this.aggregateConnections.bind(this),
            priority: 3,
            cacheKey: 'connections'
        });

        // Gap aggregator
        this.aggregators.set('gaps', {
            aggregate: this.aggregateGaps.bind(this),
            priority: 4,
            cacheKey: 'gaps'
        });

        console.log('Research aggregators initialized');
    }

    /**
     * Initialize content filters
     */
    async initializeFilters() {
        // Relevance filter
        this.filters.set('relevance', {
            filter: this.filterByRelevance.bind(this),
            weight: 0.4
        });

        // Recency filter
        this.filters.set('recency', {
            filter: this.filterByRecency.bind(this),
            weight: 0.2
        });

        // Quality filter
        this.filters.set('quality', {
            filter: this.filterByQuality.bind(this),
            weight: 0.2
        });

        // Tag filter
        this.filters.set('tags', {
            filter: this.filterByTags.bind(this),
            weight: 0.2
        });

        console.log('Research filters initialized');
    }

    /**
     * Initialize content rankers
     */
    async initializeRankers() {
        // Relevance ranker
        this.rankers.set('relevance', {
            rank: this.rankByRelevance.bind(this),
            weight: 0.5
        });

        // Connection strength ranker
        this.rankers.set('connections', {
            rank: this.rankByConnections.bind(this),
            weight: 0.3
        });

        // Content quality ranker
        this.rankers.set('quality', {
            rank: this.rankByQuality.bind(this),
            weight: 0.2
        });

        console.log('Research rankers initialized');
    }

    /**
     * Get research data for document
     */
    async getResearchDataForDocument(document) {
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            const researchContext = await this.createResearchContext(document);
            const aggregatedData = {};

            // Run all enabled aggregators
            for (const [name, aggregator] of this.aggregators.entries()) {
                if (this.isAggregatorEnabled(name)) {
                    try {
                        const data = await aggregator.aggregate(document, researchContext);
                        aggregatedData[name] = data;
                    } catch (error) {
                        console.warn(`Aggregator ${name} failed:`, error.message);
                        aggregatedData[name] = null;
                    }
                }
            }

            console.log('Research data aggregated for document');
            return {
                context: researchContext,
                ...aggregatedData,
                metadata: {
                    aggregatedAt: new Date().toISOString(),
                    documentId: document.id,
                    mode: this.options.aggregationMode
                }
            };

        } catch (error) {
            console.error('Failed to get research data for document:', error);
            return {
                notes: [],
                analysis: null,
                connections: [],
                gaps: []
            };
        }
    }

    /**
     * Get notes for document
     */
    async getNotesForDocument(document) {
        try {
            const researchContext = await this.createResearchContext(document);
            return await this.aggregateNotes(document, researchContext);
        } catch (error) {
            console.error('Failed to get notes for document:', error);
            return [];
        }
    }

    /**
     * Create research context
     */
    async createResearchContext(document) {
        const context = {
            document: {
                id: document.id,
                title: document.title,
                keywords: document.keywords || [],
                content: this.extractSearchableContent(document)
            },
            searchTerms: this.extractSearchTerms(document),
            relevanceThreshold: 0.3,
            maxResults: {
                notes: this.options.maxNotes,
                connections: this.options.maxConnections
            },
            filters: {
                mode: this.options.aggregationMode,
                includeAnalysis: this.options.includeAnalysis,
                includeConnections: this.options.includeConnections,
                includeGaps: this.options.includeGaps
            }
        };

        return context;
    }

    /**
     * Extract searchable content from document
     */
    extractSearchableContent(document) {
        let content = '';

        if (document.title) {
            content += document.title + ' ';
        }

        if (document.abstract) {
            content += document.abstract + ' ';
        }

        if (document.sections) {
            content += document.sections
                .map(section => (section.title || '') + ' ' + (section.content || ''))
                .join(' ');
        } else if (document.content) {
            content += document.content;
        }

        return content.trim();
    }

    /**
     * Extract search terms from document
     */
    extractSearchTerms(document) {
        const terms = new Set();

        // Add keywords
        if (document.keywords) {
            document.keywords.forEach(keyword => terms.add(keyword.toLowerCase()));
        }

        // Extract important terms from title
        if (document.title) {
            const titleWords = document.title
                .toLowerCase()
                .split(/\W+/)
                .filter(word => word.length > 3)
                .filter(word => !this.isStopWord(word));
            titleWords.forEach(word => terms.add(word));
        }

        return Array.from(terms);
    }

    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one',
            'our', 'had', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
            'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
            'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'her', 'now', 'oil', 'sit', 'set'
        ]);
        return stopWords.has(word);
    }

    // Aggregator methods

    /**
     * Aggregate notes related to document
     */
    async aggregateNotes(document, context) {
        const cacheKey = `notes_${document.id}_${JSON.stringify(context.searchTerms)}`;
        
        if (this.options.enableCache && this.researchCache.has(cacheKey)) {
            return this.researchCache.get(cacheKey);
        }

        try {
            // Get all notes
            const allNotes = this.storageService.list('notes');
            
            // Filter and score notes
            const scoredNotes = [];
            for (const note of allNotes) {
                const relevanceScore = this.calculateNoteRelevance(note, context);
                
                if (relevanceScore >= context.relevanceThreshold) {
                    scoredNotes.push({
                        note,
                        relevanceScore,
                        qualityScore: this.calculateNoteQuality(note),
                        recencyScore: this.calculateRecencyScore(note.created)
                    });
                }
            }

            // Sort by combined score
            scoredNotes.sort((a, b) => {
                const scoreA = (a.relevanceScore * 0.5) + (a.qualityScore * 0.3) + (a.recencyScore * 0.2);
                const scoreB = (b.relevanceScore * 0.5) + (b.qualityScore * 0.3) + (b.recencyScore * 0.2);
                return scoreB - scoreA;
            });

            // Take top results
            const topNotes = scoredNotes
                .slice(0, context.maxResults.notes)
                .map(item => ({
                    ...item.note,
                    relevanceScore: item.relevanceScore,
                    qualityScore: item.qualityScore
                }));

            if (this.options.enableCache) {
                this.researchCache.set(cacheKey, topNotes);
            }

            console.log(`Aggregated ${topNotes.length} relevant notes`);
            return topNotes;

        } catch (error) {
            console.error('Note aggregation failed:', error);
            return [];
        }
    }

    /**
     * Calculate note relevance to document
     */
    calculateNoteRelevance(note, context) {
        let score = 0;
        const noteContent = ((note.title || '') + ' ' + (note.content || '')).toLowerCase();
        const noteWords = new Set(noteContent.split(/\W+/).filter(w => w.length > 2));

        // Keyword matching
        const keywordMatches = context.searchTerms.filter(term => noteContent.includes(term)).length;
        score += (keywordMatches / Math.max(context.searchTerms.length, 1)) * 0.4;

        // Tag matching
        if (note.tags && context.document.keywords) {
            const tagMatches = note.tags.filter(tag => 
                context.document.keywords.some(keyword => 
                    keyword.toLowerCase().includes(tag.toLowerCase())
                )
            ).length;
            score += (tagMatches / Math.max(note.tags.length, 1)) * 0.3;
        }

        // Content similarity
        const documentWords = new Set(context.document.content.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        const intersection = new Set([...noteWords].filter(word => documentWords.has(word)));
        const union = new Set([...noteWords, ...documentWords]);
        const jaccardSimilarity = intersection.size / union.size;
        score += jaccardSimilarity * 0.3;

        return Math.min(score, 1);
    }

    /**
     * Calculate note quality score
     */
    calculateNoteQuality(note) {
        let score = 0;

        // Content length (more content generally indicates higher quality)
        const contentLength = (note.content || '').length;
        score += Math.min(contentLength / 1000, 1) * 0.3;

        // Has title
        if (note.title && note.title.length > 0) {
            score += 0.2;
        }

        // Has tags
        if (note.tags && note.tags.length > 0) {
            score += Math.min(note.tags.length / 5, 1) * 0.2;
        }

        // Has metadata
        if (note.metadata && Object.keys(note.metadata).length > 0) {
            score += 0.2;
        }

        // Structured content (lists, headings, etc.)
        const structureMarkers = (note.content || '').match(/^[#*-]/gm) || [];
        score += Math.min(structureMarkers.length / 10, 1) * 0.1;

        return Math.min(score, 1);
    }

    /**
     * Calculate recency score
     */
    calculateRecencyScore(created) {
        if (!created) return 0;

        const now = Date.now();
        const createdTime = new Date(created).getTime();
        const ageInDays = (now - createdTime) / (1000 * 60 * 60 * 24);

        // Score decreases with age
        if (ageInDays < 7) return 1;
        if (ageInDays < 30) return 0.8;
        if (ageInDays < 90) return 0.6;
        if (ageInDays < 180) return 0.4;
        if (ageInDays < 365) return 0.2;
        return 0.1;
    }

    /**
     * Aggregate analysis data
     */
    async aggregateAnalysis(document, context) {
        if (!this.options.includeAnalysis) return null;

        try {
            // Simulate analysis data aggregation
            // In a real implementation, this would integrate with analysis modules
            const analysisData = {
                overview: {
                    totalNotes: this.storageService.list('notes').length,
                    totalCitations: this.storageService.list('citations').length,
                    analysisDate: new Date().toISOString()
                },
                themes: await this.extractThemes(document, context),
                trends: await this.analyzeTrends(document, context),
                sentiment: await this.analyzeSentiment(document, context)
            };

            console.log('Analysis data aggregated');
            return analysisData;

        } catch (error) {
            console.error('Analysis aggregation failed:', error);
            return null;
        }
    }

    /**
     * Extract themes from research data
     */
    async extractThemes(document, context) {
        const themes = new Map();

        // Analyze notes for common themes
        const notes = await this.aggregateNotes(document, context);
        
        for (const note of notes) {
            if (note.tags) {
                for (const tag of note.tags) {
                    const count = themes.get(tag) || 0;
                    themes.set(tag, count + 1);
                }
            }
        }

        // Return top themes
        return Array.from(themes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([theme, count]) => ({ theme, count, relevance: count / notes.length }));
    }

    /**
     * Analyze trends in research data
     */
    async analyzeTrends(document, context) {
        // Placeholder for trend analysis
        return {
            temporalTrends: [],
            topicalTrends: [],
            citationTrends: []
        };
    }

    /**
     * Analyze sentiment in research data
     */
    async analyzeSentiment(document, context) {
        // Placeholder for sentiment analysis
        return {
            overall: 'neutral',
            confidence: 0.5,
            distribution: {
                positive: 0.3,
                neutral: 0.5,
                negative: 0.2
            }
        };
    }

    /**
     * Aggregate connections between research elements
     */
    async aggregateConnections(document, context) {
        if (!this.options.includeConnections) return [];

        try {
            const connections = [];
            const notes = await this.aggregateNotes(document, context);

            // Find connections between notes based on common tags and content similarity
            for (let i = 0; i < notes.length; i++) {
                for (let j = i + 1; j < notes.length; j++) {
                    const connection = this.calculateNoteConnection(notes[i], notes[j]);
                    if (connection.strength > 0.3) {
                        connections.push({
                            source: notes[i].id,
                            target: notes[j].id,
                            type: 'note-note',
                            strength: connection.strength,
                            reasons: connection.reasons
                        });
                    }
                }
            }

            // Sort by strength and limit results
            connections.sort((a, b) => b.strength - a.strength);
            const topConnections = connections.slice(0, context.maxResults.connections);

            console.log(`Aggregated ${topConnections.length} connections`);
            return topConnections;

        } catch (error) {
            console.error('Connection aggregation failed:', error);
            return [];
        }
    }

    /**
     * Calculate connection strength between two notes
     */
    calculateNoteConnection(note1, note2) {
        let strength = 0;
        const reasons = [];

        // Tag similarity
        if (note1.tags && note2.tags) {
            const commonTags = note1.tags.filter(tag => note2.tags.includes(tag));
            if (commonTags.length > 0) {
                const tagSimilarity = (2 * commonTags.length) / (note1.tags.length + note2.tags.length);
                strength += tagSimilarity * 0.4;
                reasons.push(`Common tags: ${commonTags.join(', ')}`);
            }
        }

        // Content similarity
        const content1 = ((note1.title || '') + ' ' + (note1.content || '')).toLowerCase();
        const content2 = ((note2.title || '') + ' ' + (note2.content || '')).toLowerCase();
        
        const words1 = new Set(content1.split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(content2.split(/\W+/).filter(w => w.length > 3));
        
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);
        
        if (intersection.size > 0) {
            const contentSimilarity = intersection.size / union.size;
            strength += contentSimilarity * 0.6;
            
            if (contentSimilarity > 0.2) {
                reasons.push(`Content similarity: ${Math.round(contentSimilarity * 100)}%`);
            }
        }

        return { strength: Math.min(strength, 1), reasons };
    }

    /**
     * Aggregate research gaps
     */
    async aggregateGaps(document, context) {
        if (!this.options.includeGaps) return [];

        try {
            // Placeholder for gap analysis
            // In a real implementation, this would analyze research coverage and identify gaps
            const gaps = [
                {
                    type: 'methodological',
                    description: 'Limited quantitative analysis methods',
                    severity: 'medium',
                    suggestions: ['Consider adding statistical analysis', 'Include comparative studies']
                },
                {
                    type: 'literature',
                    description: 'Few recent sources (last 2 years)',
                    severity: 'high',
                    suggestions: ['Search for recent publications', 'Update literature review']
                }
            ];

            console.log(`Identified ${gaps.length} research gaps`);
            return gaps;

        } catch (error) {
            console.error('Gap aggregation failed:', error);
            return [];
        }
    }

    // Filter and ranking methods (placeholders for now)

    filterByRelevance(items, threshold) {
        return items.filter(item => item.relevanceScore >= threshold);
    }

    filterByRecency(items, maxAge) {
        const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
        return items.filter(item => new Date(item.created).getTime() >= cutoff);
    }

    filterByQuality(items, threshold) {
        return items.filter(item => item.qualityScore >= threshold);
    }

    filterByTags(items, requiredTags) {
        if (!requiredTags || requiredTags.length === 0) return items;
        return items.filter(item => 
            item.tags && item.tags.some(tag => requiredTags.includes(tag))
        );
    }

    rankByRelevance(items) {
        return items.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    rankByConnections(items) {
        // Placeholder - would rank by number of connections
        return items;
    }

    rankByQuality(items) {
        return items.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    }

    // Utility methods

    isAggregatorEnabled(name) {
        switch (name) {
            case 'analysis':
                return this.options.includeAnalysis;
            case 'connections':
                return this.options.includeConnections;
            case 'gaps':
                return this.options.includeGaps;
            default:
                return true;
        }
    }

    /**
     * Clear research cache
     */
    clearCache() {
        this.researchCache.clear();
        this.analysisCache.clear();
        this.connectionCache.clear();
        console.log('Research cache cleared');
    }

    /**
     * Get aggregation statistics
     */
    getStats() {
        return {
            cacheSize: this.researchCache.size + this.analysisCache.size + this.connectionCache.size,
            aggregators: Array.from(this.aggregators.keys()),
            filters: Array.from(this.filters.keys()),
            rankers: Array.from(this.rankers.keys()),
            options: this.options
        };
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.clearCache();
        this.aggregators.clear();
        this.filters.clear();
        this.rankers.clear();
        this.isInitialized = false;
        console.log('Research integration destroyed');
    }
}