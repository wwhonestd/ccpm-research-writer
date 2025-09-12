/**
 * AnalysisEngine - Core research analysis logic for gap identification, trend analysis, and insights
 * Integrates with LiteratureManager and NoteManager from completed streams A & B
 */

import { LiteratureManager } from './LiteratureManager.js';
import { NoteManager } from './NoteManager.js';

export class AnalysisEngine {
    constructor() {
        this.literatureManager = new LiteratureManager();
        this.noteManager = new NoteManager();
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
        this.analysisResults = new Map();
        
        // Configuration for analysis thresholds
        this.config = {
            gapThreshold: 0.3, // Minimum gap score to consider significant
            connectionStrength: 0.5, // Minimum connection strength
            trendMinCount: 3, // Minimum occurrences to identify trend
            keywordMinFrequency: 2,
            timeframeMonths: 24 // Default analysis timeframe
        };
    }

    /**
     * Perform comprehensive research gap analysis
     */
    async analyzeResearchGaps(projectId = null, options = {}) {
        const startTime = performance.now();
        
        try {
            const cacheKey = `gaps_${projectId}_${JSON.stringify(options)}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            // Get literature and notes data
            const citations = await this.literatureManager.getCitations();
            const notes = await this.noteManager.listNotes();
            
            // Filter by project if specified
            const filteredCitations = projectId ? 
                citations.filter(c => c.projectId === projectId) : citations;
            const filteredNotes = projectId ? 
                notes.filter(n => n.projectId === projectId) : notes;

            // Analyze different types of gaps
            const gaps = {
                temporal: await this.analyzeTemporalGaps(filteredCitations, options),
                topical: await this.analyzeTopicalGaps(filteredCitations, filteredNotes, options),
                methodological: await this.analyzeMethodologicalGaps(filteredCitations, options),
                geographical: await this.analyzeGeographicalGaps(filteredCitations, options),
                theoretical: await this.analyzeTheoreticalGaps(filteredNotes, options),
                empirical: await this.analyzeEmpiricalGaps(filteredCitations, filteredNotes, options)
            };

            // Generate summary and recommendations
            const summary = this.generateGapSummary(gaps);
            const recommendations = this.generateRecommendations(gaps);

            const result = {
                projectId,
                timestamp: new Date().toISOString(),
                analysisTime: performance.now() - startTime,
                totalCitations: filteredCitations.length,
                totalNotes: filteredNotes.length,
                gaps,
                summary,
                recommendations,
                metadata: {
                    version: '1.0',
                    algorithm: 'comprehensive',
                    confidence: this.calculateOverallConfidence(gaps)
                }
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Research gap analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze temporal gaps in research coverage
     */
    async analyzeTemporalGaps(citations, options = {}) {
        try {
            const timeframe = options.timeframeMonths || this.config.timeframeMonths;
            const currentYear = new Date().getFullYear();
            const startYear = currentYear - Math.floor(timeframe / 12);

            // Group citations by year
            const yearDistribution = {};
            citations.forEach(citation => {
                const year = citation.year || currentYear;
                if (year >= startYear) {
                    yearDistribution[year] = (yearDistribution[year] || 0) + 1;
                }
            });

            // Identify temporal gaps
            const gaps = [];
            for (let year = startYear; year <= currentYear; year++) {
                const count = yearDistribution[year] || 0;
                const averageCount = Object.values(yearDistribution).reduce((a, b) => a + b, 0) / 
                    Object.keys(yearDistribution).length;
                
                if (count < averageCount * this.config.gapThreshold) {
                    gaps.push({
                        year,
                        count,
                        expectedCount: Math.round(averageCount),
                        gapSeverity: (averageCount - count) / averageCount,
                        description: `Limited research coverage in ${year}`
                    });
                }
            }

            return {
                type: 'temporal',
                timeframe: `${startYear}-${currentYear}`,
                distribution: yearDistribution,
                gaps,
                trends: this.identifyTemporalTrends(yearDistribution),
                confidence: gaps.length > 0 ? 0.8 : 0.9
            };
        } catch (error) {
            console.error('Temporal gap analysis failed:', error);
            return { type: 'temporal', gaps: [], error: error.message };
        }
    }

    /**
     * Analyze topical gaps in research areas
     */
    async analyzeTopicalGaps(citations, notes, options = {}) {
        try {
            // Extract topics from citations and notes
            const citationTopics = this.extractTopicsFromCitations(citations);
            const noteTopics = this.extractTopicsFromNotes(notes);
            
            // Combine and analyze topic coverage
            const allTopics = new Map();
            
            // Weight citation topics higher as they represent published research
            citationTopics.forEach(topic => {
                allTopics.set(topic.term, {
                    term: topic.term,
                    citationCount: topic.count,
                    noteCount: 0,
                    totalWeight: topic.count * 1.5 // Citations weighted 1.5x
                });
            });

            noteTopics.forEach(topic => {
                const existing = allTopics.get(topic.term);
                if (existing) {
                    existing.noteCount = topic.count;
                    existing.totalWeight += topic.count;
                } else {
                    allTopics.set(topic.term, {
                        term: topic.term,
                        citationCount: 0,
                        noteCount: topic.count,
                        totalWeight: topic.count
                    });
                }
            });

            // Identify underrepresented topics
            const topics = Array.from(allTopics.values());
            const averageWeight = topics.reduce((sum, topic) => sum + topic.totalWeight, 0) / topics.length;
            
            const gaps = topics
                .filter(topic => topic.totalWeight < averageWeight * this.config.gapThreshold)
                .sort((a, b) => a.totalWeight - b.totalWeight)
                .map(topic => ({
                    topic: topic.term,
                    currentCoverage: topic.totalWeight,
                    expectedCoverage: Math.round(averageWeight),
                    gapSeverity: (averageWeight - topic.totalWeight) / averageWeight,
                    citationCount: topic.citationCount,
                    noteCount: topic.noteCount,
                    description: `Underrepresented topic: ${topic.term}`
                }));

            return {
                type: 'topical',
                totalTopics: topics.length,
                averageCoverage: Math.round(averageWeight),
                gaps,
                topTopics: topics
                    .sort((a, b) => b.totalWeight - a.totalWeight)
                    .slice(0, 10)
                    .map(t => ({ topic: t.term, coverage: t.totalWeight })),
                confidence: 0.85
            };
        } catch (error) {
            console.error('Topical gap analysis failed:', error);
            return { type: 'topical', gaps: [], error: error.message };
        }
    }

    /**
     * Analyze methodological gaps in research approaches
     */
    async analyzeMethodologicalGaps(citations, options = {}) {
        try {
            // Extract methodology indicators from citation content
            const methodologies = new Map();
            const methodKeywords = [
                'qualitative', 'quantitative', 'mixed methods', 'case study',
                'survey', 'interview', 'experiment', 'meta-analysis',
                'systematic review', 'ethnography', 'grounded theory',
                'content analysis', 'statistical', 'regression', 'correlation'
            ];

            citations.forEach(citation => {
                const content = `${citation.title} ${citation.publication}`.toLowerCase();
                methodKeywords.forEach(method => {
                    if (content.includes(method)) {
                        methodologies.set(method, (methodologies.get(method) || 0) + 1);
                    }
                });
            });

            // Identify underrepresented methodologies
            const methods = Array.from(methodologies.entries());
            const totalMethodUses = methods.reduce((sum, [, count]) => sum + count, 0);
            const averageUse = totalMethodUses / methods.length;

            const gaps = methods
                .filter(([method, count]) => count < averageUse * this.config.gapThreshold)
                .sort((a, b) => a[1] - b[1])
                .map(([method, count]) => ({
                    methodology: method,
                    currentUse: count,
                    expectedUse: Math.round(averageUse),
                    gapSeverity: (averageUse - count) / averageUse,
                    description: `Underutilized methodology: ${method}`
                }));

            return {
                type: 'methodological',
                totalMethodologies: methods.length,
                methodDistribution: Object.fromEntries(methodologies),
                gaps,
                dominant: methods
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([method, count]) => ({ method, count })),
                confidence: 0.75
            };
        } catch (error) {
            console.error('Methodological gap analysis failed:', error);
            return { type: 'methodological', gaps: [], error: error.message };
        }
    }

    /**
     * Analyze geographical gaps in research coverage
     */
    async analyzeGeographicalGaps(citations, options = {}) {
        try {
            // Extract geographical indicators
            const locations = new Map();
            const geoKeywords = [
                'USA', 'United States', 'Europe', 'UK', 'Germany', 'France',
                'China', 'Japan', 'India', 'Brazil', 'Canada', 'Australia',
                'Africa', 'Asia', 'global', 'international', 'cross-national'
            ];

            citations.forEach(citation => {
                const content = `${citation.title} ${citation.publication}`.toLowerCase();
                geoKeywords.forEach(location => {
                    if (content.includes(location.toLowerCase())) {
                        locations.set(location, (locations.get(location) || 0) + 1);
                    }
                });
            });

            const regions = Array.from(locations.entries());
            const totalRegionCoverage = regions.reduce((sum, [, count]) => sum + count, 0);
            const averageCoverage = totalRegionCoverage / regions.length;

            const gaps = regions
                .filter(([region, count]) => count < averageCoverage * this.config.gapThreshold)
                .sort((a, b) => a[1] - b[1])
                .map(([region, count]) => ({
                    region,
                    currentCoverage: count,
                    expectedCoverage: Math.round(averageCoverage),
                    gapSeverity: (averageCoverage - count) / averageCoverage,
                    description: `Limited geographical coverage: ${region}`
                }));

            return {
                type: 'geographical',
                totalRegions: regions.length,
                regionDistribution: Object.fromEntries(locations),
                gaps,
                dominantRegions: regions
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([region, count]) => ({ region, count })),
                confidence: 0.7
            };
        } catch (error) {
            console.error('Geographical gap analysis failed:', error);
            return { type: 'geographical', gaps: [], error: error.message };
        }
    }

    /**
     * Analyze theoretical gaps from notes and ideas
     */
    async analyzeTheoreticalGaps(notes, options = {}) {
        try {
            // Extract theoretical concepts from notes
            const theories = new Map();
            const theoreticalKeywords = [
                'theory', 'framework', 'model', 'concept', 'paradigm',
                'hypothesis', 'proposition', 'principle', 'approach'
            ];

            notes.forEach(note => {
                const content = `${note.title} ${note.content}`.toLowerCase();
                theoreticalKeywords.forEach(keyword => {
                    if (content.includes(keyword)) {
                        theories.set(keyword, (theories.get(keyword) || 0) + 1);
                    }
                });

                // Extract theory-adjacent terms from note tags
                note.tags.forEach(tag => {
                    if (tag.toLowerCase().includes('theory') || 
                        tag.toLowerCase().includes('model') ||
                        tag.toLowerCase().includes('framework')) {
                        theories.set(tag, (theories.get(tag) || 0) + 1);
                    }
                });
            });

            const concepts = Array.from(theories.entries());
            const totalUses = concepts.reduce((sum, [, count]) => sum + count, 0);
            const averageUse = totalUses / concepts.length;

            const gaps = concepts
                .filter(([concept, count]) => count < averageUse * this.config.gapThreshold)
                .sort((a, b) => a[1] - b[1])
                .map(([concept, count]) => ({
                    concept,
                    currentUse: count,
                    expectedUse: Math.round(averageUse),
                    gapSeverity: (averageUse - count) / averageUse,
                    description: `Underexplored theoretical concept: ${concept}`
                }));

            return {
                type: 'theoretical',
                totalConcepts: concepts.length,
                conceptDistribution: Object.fromEntries(theories),
                gaps,
                dominantConcepts: concepts
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([concept, count]) => ({ concept, count })),
                confidence: 0.8
            };
        } catch (error) {
            console.error('Theoretical gap analysis failed:', error);
            return { type: 'theoretical', gaps: [], error: error.message };
        }
    }

    /**
     * Analyze empirical gaps between theory and evidence
     */
    async analyzeEmpiricalGaps(citations, notes, options = {}) {
        try {
            // Identify theoretical claims in notes
            const theoreticalClaims = notes.filter(note => 
                note.type === 'analysis' || note.type === 'idea' ||
                note.content.toLowerCase().includes('hypothesis') ||
                note.content.toLowerCase().includes('theory')
            );

            // Identify empirical evidence in citations
            const empiricalEvidence = citations.filter(citation =>
                citation.title.toLowerCase().includes('empirical') ||
                citation.title.toLowerCase().includes('evidence') ||
                citation.title.toLowerCase().includes('data') ||
                citation.title.toLowerCase().includes('study')
            );

            // Match theoretical claims with empirical support
            const gaps = [];
            theoreticalClaims.forEach(claim => {
                const claimKeywords = this.extractKeywords(claim.content);
                let supportingEvidence = 0;

                empiricalEvidence.forEach(evidence => {
                    const evidenceKeywords = this.extractKeywords(
                        `${evidence.title} ${evidence.publication}`
                    );
                    const overlap = this.calculateKeywordOverlap(claimKeywords, evidenceKeywords);
                    
                    if (overlap > 0.3) {
                        supportingEvidence++;
                    }
                });

                if (supportingEvidence < this.config.trendMinCount) {
                    gaps.push({
                        claim: claim.title,
                        claimId: claim.id,
                        supportingEvidence,
                        expectedEvidence: this.config.trendMinCount,
                        gapSeverity: (this.config.trendMinCount - supportingEvidence) / this.config.trendMinCount,
                        keywords: claimKeywords.slice(0, 5),
                        description: `Theoretical claim needs more empirical support: ${claim.title}`
                    });
                }
            });

            return {
                type: 'empirical',
                totalClaims: theoreticalClaims.length,
                totalEvidence: empiricalEvidence.length,
                gaps: gaps.slice(0, 10), // Top 10 gaps
                coverage: {
                    wellSupported: theoreticalClaims.length - gaps.length,
                    needsSupport: gaps.length,
                    ratio: gaps.length / theoreticalClaims.length
                },
                confidence: 0.75
            };
        } catch (error) {
            console.error('Empirical gap analysis failed:', error);
            return { type: 'empirical', gaps: [], error: error.message };
        }
    }

    /**
     * Perform connection mapping analysis between literature and notes
     */
    async analyzeConnections(projectId = null, options = {}) {
        try {
            const cacheKey = `connections_${projectId}_${JSON.stringify(options)}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;

            const citations = await this.literatureManager.getCitations();
            const notes = await this.noteManager.listNotes();
            
            // Filter by project if specified
            const filteredCitations = projectId ? 
                citations.filter(c => c.projectId === projectId) : citations;
            const filteredNotes = projectId ? 
                notes.filter(n => n.projectId === projectId) : notes;

            // Analyze different types of connections
            const connections = {
                citationToNote: this.analyzeCitationNoteConnections(filteredCitations, filteredNotes),
                noteToNote: this.analyzeNoteNoteConnections(filteredNotes),
                topicalClusters: this.identifyTopicalClusters(filteredCitations, filteredNotes),
                authorNetworks: this.analyzeAuthorNetworks(filteredCitations),
                temporalConnections: this.analyzeTemporalConnections(filteredCitations, filteredNotes)
            };

            // Generate network metrics
            const metrics = this.calculateNetworkMetrics(connections);
            
            // Create visualization data
            const visualization = this.prepareVisualizationData(connections, options);

            const result = {
                projectId,
                timestamp: new Date().toISOString(),
                totalCitations: filteredCitations.length,
                totalNotes: filteredNotes.length,
                connections,
                metrics,
                visualization,
                insights: this.generateConnectionInsights(connections, metrics)
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.error('Connection analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze connections between citations and notes
     */
    analyzeCitationNoteConnections(citations, notes) {
        const connections = [];
        
        notes.forEach(note => {
            // Direct citation links
            note.linkedCitations.forEach(citationId => {
                const citation = citations.find(c => c.id === citationId);
                if (citation) {
                    connections.push({
                        type: 'direct',
                        source: citation.id,
                        target: note.id,
                        strength: 1.0,
                        sourceType: 'citation',
                        targetType: 'note'
                    });
                }
            });

            // Indirect connections through keyword matching
            const noteKeywords = this.extractKeywords(note.content);
            citations.forEach(citation => {
                if (!note.linkedCitations.includes(citation.id)) {
                    const citationKeywords = this.extractKeywords(
                        `${citation.title} ${citation.publication}`
                    );
                    const similarity = this.calculateKeywordOverlap(noteKeywords, citationKeywords);
                    
                    if (similarity > this.config.connectionStrength) {
                        connections.push({
                            type: 'semantic',
                            source: citation.id,
                            target: note.id,
                            strength: similarity,
                            sourceType: 'citation',
                            targetType: 'note',
                            sharedKeywords: this.getSharedKeywords(noteKeywords, citationKeywords)
                        });
                    }
                }
            });
        });

        return connections;
    }

    /**
     * Analyze connections between notes
     */
    analyzeNoteNoteConnections(notes) {
        const connections = [];
        
        notes.forEach((note1, i) => {
            // Direct note links
            note1.linkedNotes.forEach(linkedId => {
                const linkedNote = notes.find(n => n.id === linkedId);
                if (linkedNote) {
                    connections.push({
                        type: 'direct',
                        source: note1.id,
                        target: linkedNote.id,
                        strength: 1.0,
                        sourceType: 'note',
                        targetType: 'note'
                    });
                }
            });

            // Semantic connections
            for (let j = i + 1; j < notes.length; j++) {
                const note2 = notes[j];
                if (!note1.linkedNotes.includes(note2.id)) {
                    const keywords1 = this.extractKeywords(note1.content);
                    const keywords2 = this.extractKeywords(note2.content);
                    const similarity = this.calculateKeywordOverlap(keywords1, keywords2);
                    
                    if (similarity > this.config.connectionStrength) {
                        connections.push({
                            type: 'semantic',
                            source: note1.id,
                            target: note2.id,
                            strength: similarity,
                            sourceType: 'note',
                            targetType: 'note',
                            sharedKeywords: this.getSharedKeywords(keywords1, keywords2)
                        });
                    }
                }
            }
        });

        return connections;
    }

    /**
     * Identify topical clusters in the research
     */
    identifyTopicalClusters(citations, notes) {
        const allItems = [
            ...citations.map(c => ({ ...c, type: 'citation' })),
            ...notes.map(n => ({ ...n, type: 'note' }))
        ];

        // Extract keywords for clustering
        const itemKeywords = allItems.map(item => {
            const content = item.type === 'citation' ? 
                `${item.title} ${item.publication}` : 
                `${item.title} ${item.content}`;
            return {
                id: item.id,
                type: item.type,
                keywords: this.extractKeywords(content),
                title: item.title
            };
        });

        // Simple clustering based on keyword overlap
        const clusters = [];
        const assigned = new Set();

        itemKeywords.forEach(item => {
            if (assigned.has(item.id)) return;

            const cluster = {
                id: `cluster_${clusters.length + 1}`,
                items: [item],
                keywords: [...item.keywords],
                strength: 1.0
            };

            // Find related items
            itemKeywords.forEach(otherItem => {
                if (otherItem.id !== item.id && !assigned.has(otherItem.id)) {
                    const overlap = this.calculateKeywordOverlap(item.keywords, otherItem.keywords);
                    if (overlap > 0.4) {
                        cluster.items.push(otherItem);
                        cluster.keywords = this.mergeKeywords(cluster.keywords, otherItem.keywords);
                        assigned.add(otherItem.id);
                    }
                }
            });

            if (cluster.items.length > 1) {
                cluster.strength = cluster.items.length / allItems.length;
                clusters.push(cluster);
                cluster.items.forEach(item => assigned.add(item.id));
            }
        });

        return clusters.sort((a, b) => b.items.length - a.items.length);
    }

    /**
     * Analyze author collaboration networks
     */
    analyzeAuthorNetworks(citations) {
        const authorConnections = new Map();
        const authorFrequency = new Map();

        // Build author frequency and co-authorship networks
        citations.forEach(citation => {
            citation.authors.forEach(author => {
                authorFrequency.set(author, (authorFrequency.get(author) || 0) + 1);
            });

            // Co-authorship connections
            for (let i = 0; i < citation.authors.length - 1; i++) {
                for (let j = i + 1; j < citation.authors.length; j++) {
                    const author1 = citation.authors[i];
                    const author2 = citation.authors[j];
                    const key = [author1, author2].sort().join('|');
                    
                    if (!authorConnections.has(key)) {
                        authorConnections.set(key, {
                            author1,
                            author2,
                            collaborations: 0,
                            papers: []
                        });
                    }
                    
                    const connection = authorConnections.get(key);
                    connection.collaborations++;
                    connection.papers.push(citation.id);
                }
            }
        });

        return {
            totalAuthors: authorFrequency.size,
            topAuthors: Array.from(authorFrequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([author, count]) => ({ author, publications: count })),
            collaborations: Array.from(authorConnections.values())
                .filter(conn => conn.collaborations > 1)
                .sort((a, b) => b.collaborations - a.collaborations)
                .slice(0, 20),
            networkDensity: authorConnections.size / (authorFrequency.size * (authorFrequency.size - 1) / 2)
        };
    }

    /**
     * Analyze temporal connections between research items
     */
    analyzeTemporalConnections(citations, notes) {
        const timelineItems = [
            ...citations.map(c => ({
                id: c.id,
                type: 'citation',
                date: new Date(c.year || new Date().getFullYear(), 0, 1),
                title: c.title,
                year: c.year
            })),
            ...notes.map(n => ({
                id: n.id,
                type: 'note',
                date: new Date(n.created),
                title: n.title,
                year: new Date(n.created).getFullYear()
            }))
        ].sort((a, b) => a.date - b.date);

        // Identify temporal patterns
        const yearlyActivity = {};
        timelineItems.forEach(item => {
            const year = item.year;
            if (!yearlyActivity[year]) {
                yearlyActivity[year] = { citations: 0, notes: 0, total: 0 };
            }
            yearlyActivity[year][item.type === 'citation' ? 'citations' : 'notes']++;
            yearlyActivity[year].total++;
        });

        return {
            timeline: timelineItems,
            yearlyActivity,
            trends: this.identifyTemporalTrends(yearlyActivity),
            patterns: {
                averageItemsPerYear: Object.values(yearlyActivity).reduce((sum, year) => sum + year.total, 0) / 
                    Object.keys(yearlyActivity).length,
                mostActiveYear: Object.entries(yearlyActivity)
                    .sort((a, b) => b[1].total - a[1].total)[0],
                researchVelocity: this.calculateResearchVelocity(yearlyActivity)
            }
        };
    }

    /**
     * Calculate overall network metrics
     */
    calculateNetworkMetrics(connections) {
        const allConnections = [
            ...connections.citationToNote,
            ...connections.noteToNote
        ];

        const nodes = new Set();
        allConnections.forEach(conn => {
            nodes.add(conn.source);
            nodes.add(conn.target);
        });

        const totalNodes = nodes.size;
        const totalEdges = allConnections.length;
        const maxPossibleEdges = totalNodes * (totalNodes - 1) / 2;

        return {
            totalNodes,
            totalEdges,
            density: totalEdges / maxPossibleEdges,
            averageConnectionsPerNode: totalEdges / totalNodes,
            strongConnections: allConnections.filter(c => c.strength > 0.8).length,
            weakConnections: allConnections.filter(c => c.strength < 0.4).length,
            clusterCount: connections.topicalClusters.length,
            largestCluster: connections.topicalClusters.length > 0 ? 
                connections.topicalClusters[0].items.length : 0,
            isolatedNodes: this.findIsolatedNodes(allConnections, nodes)
        };
    }

    /**
     * Prepare data for network visualization
     */
    prepareVisualizationData(connections, options = {}) {
        const maxNodes = options.maxNodes || 100;
        const minStrength = options.minStrength || 0.3;

        // Combine all connections
        const allConnections = [
            ...connections.citationToNote,
            ...connections.noteToNote
        ].filter(conn => conn.strength >= minStrength);

        // Get most connected nodes
        const nodeConnections = new Map();
        allConnections.forEach(conn => {
            nodeConnections.set(conn.source, (nodeConnections.get(conn.source) || 0) + 1);
            nodeConnections.set(conn.target, (nodeConnections.get(conn.target) || 0) + 1);
        });

        const topNodes = Array.from(nodeConnections.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxNodes)
            .map(([id]) => id);

        // Filter connections to top nodes
        const filteredConnections = allConnections.filter(conn =>
            topNodes.includes(conn.source) && topNodes.includes(conn.target)
        );

        // Create node data
        const nodes = topNodes.map(nodeId => {
            const connectionCount = nodeConnections.get(nodeId) || 0;
            const sourceType = filteredConnections.find(c => 
                c.source === nodeId || c.target === nodeId
            )?.sourceType || 'unknown';

            return {
                id: nodeId,
                type: sourceType,
                connections: connectionCount,
                size: Math.min(Math.max(connectionCount * 2, 5), 25),
                importance: connectionCount / Math.max(...nodeConnections.values())
            };
        });

        // Create edge data
        const edges = filteredConnections.map(conn => ({
            source: conn.source,
            target: conn.target,
            strength: conn.strength,
            type: conn.type,
            width: Math.max(conn.strength * 5, 1),
            color: conn.type === 'direct' ? '#2196F3' : '#FFC107'
        }));

        return {
            nodes,
            edges,
            clusters: connections.topicalClusters.slice(0, 10),
            stats: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
                avgStrength: edges.reduce((sum, e) => sum + e.strength, 0) / edges.length
            }
        };
    }

    // Utility methods

    extractTopicsFromCitations(citations) {
        const topics = new Map();
        
        citations.forEach(citation => {
            const content = `${citation.title} ${citation.publication}`.toLowerCase();
            const keywords = this.extractKeywords(content);
            
            keywords.forEach(keyword => {
                topics.set(keyword, (topics.get(keyword) || 0) + 1);
            });
        });

        return Array.from(topics.entries())
            .filter(([, count]) => count >= this.config.keywordMinFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([term, count]) => ({ term, count }));
    }

    extractTopicsFromNotes(notes) {
        const topics = new Map();
        
        notes.forEach(note => {
            const keywords = this.extractKeywords(`${note.title} ${note.content}`);
            
            keywords.forEach(keyword => {
                topics.set(keyword, (topics.get(keyword) || 0) + 1);
            });

            // Include tags
            note.tags.forEach(tag => {
                topics.set(tag, (topics.get(tag) || 0) + 1);
            });
        });

        return Array.from(topics.entries())
            .filter(([, count]) => count >= this.config.keywordMinFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([term, count]) => ({ term, count }));
    }

    extractKeywords(text) {
        if (!text) return [];
        
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !this.isStopWord(word));
    }

    isStopWord(word) {
        const stopWords = [
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
            'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
            'boy', 'did', 'she', 'use', 'your', 'from', 'that', 'with', 'have',
            'this', 'will', 'word', 'they', 'were', 'been', 'said', 'each', 'which',
            'their', 'time', 'would', 'there', 'what', 'about', 'when', 'make',
            'more', 'very', 'after', 'first', 'well', 'where', 'come', 'work',
            'such', 'through', 'just', 'form', 'much', 'great', 'think', 'say',
            'help', 'low', 'line', 'turn', 'cause', 'same', 'mean', 'move', 'right',
            'show', 'also', 'before', 'large', 'must', 'big', 'year', 'took', 'kind',
            'came', 'find', 'over', 'think', 'back', 'other', 'many', 'then', 'them'
        ];
        
        return stopWords.includes(word);
    }

    calculateKeywordOverlap(keywords1, keywords2) {
        if (keywords1.length === 0 || keywords2.length === 0) return 0;
        
        const set1 = new Set(keywords1);
        const set2 = new Set(keywords2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        
        return intersection.size / Math.min(set1.size, set2.size);
    }

    getSharedKeywords(keywords1, keywords2) {
        const set1 = new Set(keywords1);
        const set2 = new Set(keywords2);
        return [...set1].filter(x => set2.has(x));
    }

    mergeKeywords(keywords1, keywords2) {
        return [...new Set([...keywords1, ...keywords2])];
    }

    identifyTemporalTrends(yearData) {
        const years = Object.keys(yearData).sort();
        if (years.length < 3) return [];

        const trends = [];
        
        // Calculate year-over-year growth
        for (let i = 1; i < years.length; i++) {
            const currentYear = parseInt(years[i]);
            const prevYear = parseInt(years[i - 1]);
            const currentCount = typeof yearData[currentYear] === 'object' ? 
                yearData[currentYear].total : yearData[currentYear];
            const prevCount = typeof yearData[prevYear] === 'object' ? 
                yearData[prevYear].total : yearData[prevYear];
            
            const growth = (currentCount - prevCount) / prevCount;
            
            if (Math.abs(growth) > 0.5) { // Significant change
                trends.push({
                    year: currentYear,
                    type: growth > 0 ? 'increase' : 'decrease',
                    magnitude: Math.abs(growth),
                    description: `${growth > 0 ? 'Significant increase' : 'Significant decrease'} in ${currentYear}`
                });
            }
        }

        return trends;
    }

    calculateResearchVelocity(yearlyActivity) {
        const years = Object.keys(yearlyActivity).sort();
        if (years.length < 2) return 0;

        const recentYears = years.slice(-3); // Last 3 years
        const averageRecent = recentYears.reduce((sum, year) => 
            sum + yearlyActivity[year].total, 0) / recentYears.length;

        const earlierYears = years.slice(0, -3);
        if (earlierYears.length === 0) return averageRecent;

        const averageEarlier = earlierYears.reduce((sum, year) => 
            sum + yearlyActivity[year].total, 0) / earlierYears.length;

        return (averageRecent - averageEarlier) / averageEarlier;
    }

    findIsolatedNodes(connections, allNodes) {
        const connectedNodes = new Set();
        connections.forEach(conn => {
            connectedNodes.add(conn.source);
            connectedNodes.add(conn.target);
        });

        return [...allNodes].filter(node => !connectedNodes.has(node)).length;
    }

    generateGapSummary(gaps) {
        const totalGaps = Object.values(gaps).reduce((sum, gapType) => 
            sum + (gapType.gaps ? gapType.gaps.length : 0), 0);

        const gapsByType = Object.entries(gaps)
            .map(([type, data]) => ({
                type,
                count: data.gaps ? data.gaps.length : 0,
                confidence: data.confidence || 0
            }))
            .filter(g => g.count > 0)
            .sort((a, b) => b.count - a.count);

        return {
            totalGaps,
            mostSignificant: gapsByType.slice(0, 3),
            overallSeverity: totalGaps > 10 ? 'high' : totalGaps > 5 ? 'medium' : 'low',
            recommendations: totalGaps > 0 ? 
                'Focus research efforts on identified gap areas' : 
                'Research coverage appears comprehensive'
        };
    }

    generateRecommendations(gaps) {
        const recommendations = [];

        Object.entries(gaps).forEach(([type, data]) => {
            if (data.gaps && data.gaps.length > 0) {
                const topGaps = data.gaps.slice(0, 3);
                
                topGaps.forEach((gap, index) => {
                    recommendations.push({
                        priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
                        type,
                        gap: gap.description || gap.topic || gap.methodology || gap.concept,
                        action: this.getRecommendationAction(type, gap),
                        confidence: data.confidence || 0.5
                    });
                });
            }
        });

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }).slice(0, 10);
    }

    getRecommendationAction(type, gap) {
        const actions = {
            temporal: `Investigate research developments in ${gap.year || 'recent years'}`,
            topical: `Expand research on ${gap.topic}`,
            methodological: `Consider applying ${gap.methodology} methodology`,
            geographical: `Explore research contexts in ${gap.region}`,
            theoretical: `Develop theoretical framework for ${gap.concept}`,
            empirical: `Gather empirical evidence for theoretical claims`
        };

        return actions[type] || 'Investigate further';
    }

    generateConnectionInsights(connections, metrics) {
        const insights = [];

        if (metrics.density < 0.3) {
            insights.push({
                type: 'connectivity',
                level: 'warning',
                message: 'Research network has low connectivity. Consider creating more links between related items.',
                metric: `Density: ${(metrics.density * 100).toFixed(1)}%`
            });
        }

        if (connections.topicalClusters.length > 0) {
            const largestCluster = connections.topicalClusters[0];
            insights.push({
                type: 'clustering',
                level: 'info',
                message: `Strong topical cluster identified with ${largestCluster.items.length} related items.`,
                details: `Primary keywords: ${largestCluster.keywords.slice(0, 5).join(', ')}`
            });
        }

        if (metrics.isolatedNodes > metrics.totalNodes * 0.2) {
            insights.push({
                type: 'isolation',
                level: 'warning',
                message: `${metrics.isolatedNodes} items appear disconnected from the main research network.`,
                recommendation: 'Review isolated items for potential connections.'
            });
        }

        return insights;
    }

    calculateOverallConfidence(gaps) {
        const confidenceValues = Object.values(gaps)
            .map(g => g.confidence || 0)
            .filter(c => c > 0);

        if (confidenceValues.length === 0) return 0;
        
        return confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length;
    }

    // Cache management
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}