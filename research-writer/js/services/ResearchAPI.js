/**
 * Research API Service - External API integration for literature retrieval
 * Integrates with CrossRef, PubMed, and other academic databases
 * Features rate limiting, caching, error handling, and offline capability
 */

import { Citation } from '../models/Citation.js';

export class ResearchAPI {
    constructor(options = {}) {
        this.options = {
            crossRefEmail: options.crossRefEmail || '',
            userAgent: options.userAgent || 'Research Writer v1.0',
            cacheTimeout: options.cacheTimeout || 60 * 60 * 1000, // 1 hour
            maxCacheSize: options.maxCacheSize || 1000,
            rateLimitDelay: options.rateLimitDelay || 1000, // 1 second
            maxRetries: options.maxRetries || 3,
            requestTimeout: options.requestTimeout || 30000, // 30 seconds
            ...options
        };
        
        // API endpoints
        this.endpoints = {
            crossref: 'https://api.crossref.org',
            pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
            openalex: 'https://api.openalex.org',
            semanticScholar: 'https://api.semanticscholar.org'
        };
        
        // Rate limiting and caching
        this.requestQueues = new Map();
        this.cache = new Map();
        this.isOnline = navigator.onLine;
        
        // Request tracking for rate limiting
        this.lastRequestTimes = new Map();
        this.requestCounts = new Map();
        
        // Initialize event listeners
        this.initializeNetworkListeners();
        
        // Cleanup cache periodically
        this.setupCacheCleanup();
    }

    /**
     * Search for academic papers by query
     */
    async searchPapers(query, options = {}) {
        try {
            const searchOptions = {
                source: options.source || 'crossref',
                limit: options.limit || 20,
                offset: options.offset || 0,
                filters: options.filters || {},
                sort: options.sort || 'relevance',
                ...options
            };
            
            switch (searchOptions.source) {
                case 'crossref':
                    return await this.searchCrossRef(query, searchOptions);
                case 'pubmed':
                    return await this.searchPubMed(query, searchOptions);
                case 'openalex':
                    return await this.searchOpenAlex(query, searchOptions);
                case 'semanticscholar':
                    return await this.searchSemanticScholar(query, searchOptions);
                case 'all':
                    return await this.searchMultipleSources(query, searchOptions);
                default:
                    throw new Error(`Unsupported search source: ${searchOptions.source}`);
            }
        } catch (error) {
            console.error('Paper search error:', error);
            throw error;
        }
    }

    /**
     * Get paper details by DOI
     */
    async getPaperByDOI(doi, options = {}) {
        try {
            if (!doi) {
                throw new Error('DOI is required');
            }
            
            const cleanDOI = this.cleanDOI(doi);
            const cacheKey = `doi_${cleanDOI}`;
            
            // Check cache first
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            
            // Try CrossRef first (most comprehensive)
            let result = await this.getCrossRefByDOI(cleanDOI, options);
            
            // Enhance with additional data if requested
            if (options.enhance && result) {
                result = await this.enhancePaperData(result, options);
            }
            
            // Cache the result
            if (result) {
                this.setCache(cacheKey, result);
            }
            
            return result;
        } catch (error) {
            console.error('DOI lookup error:', error);
            throw error;
        }
    }

    /**
     * Get paper by PubMed ID
     */
    async getPaperByPMID(pmid, options = {}) {
        try {
            if (!pmid) {
                throw new Error('PMID is required');
            }
            
            const cacheKey = `pmid_${pmid}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            
            const result = await this.getPubMedByID(pmid, options);
            
            if (result) {
                this.setCache(cacheKey, result);
            }
            
            return result;
        } catch (error) {
            console.error('PMID lookup error:', error);
            throw error;
        }
    }

    /**
     * CrossRef API integration
     */
    async searchCrossRef(query, options = {}) {
        try {
            await this.respectRateLimit('crossref');
            
            const params = new URLSearchParams({
                query: query,
                rows: options.limit || 20,
                offset: options.offset || 0,
                sort: options.sort || 'relevance',
                filter: this.buildCrossRefFilters(options.filters)
            });
            
            const url = `${this.endpoints.crossref}/works?${params}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'User-Agent': this.getUserAgent(),
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.message && data.message.items) {
                return {
                    results: data.message.items.map(item => this.parseCrossRefItem(item)),
                    totalResults: data.message['total-results'],
                    source: 'crossref',
                    query: query
                };
            } else {
                throw new Error('Invalid CrossRef response');
            }
        } catch (error) {
            console.error('CrossRef search error:', error);
            throw error;
        }
    }

    async getCrossRefByDOI(doi, options = {}) {
        try {
            await this.respectRateLimit('crossref');
            
            const url = `${this.endpoints.crossref}/works/${encodeURIComponent(doi)}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'User-Agent': this.getUserAgent(),
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.message) {
                return this.parseCrossRefItem(data.message);
            } else {
                throw new Error('Paper not found in CrossRef');
            }
        } catch (error) {
            if (error.name === 'NotFoundError' || error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    parseCrossRefItem(item) {
        try {
            const authors = (item.author || []).map(author => {
                if (author.given && author.family) {
                    return `${author.given} ${author.family}`;
                } else if (author.family) {
                    return author.family;
                } else if (author.name) {
                    return author.name;
                }
                return 'Unknown Author';
            });
            
            const citationData = {
                title: (item.title && item.title[0]) || '',
                authors: authors,
                year: this.extractYear(item.published || item['published-print'] || item['published-online']),
                type: this.mapCrossRefType(item.type),
                publication: (item['container-title'] && item['container-title'][0]) || '',
                publisher: item.publisher || '',
                doi: item.DOI || '',
                url: item.URL || '',
                volume: item.volume || '',
                issue: item.issue || '',
                pages: this.formatPages(item.page),
                abstract: item.abstract || '',
                issn: (item.ISSN && item.ISSN[0]) || '',
                isbn: (item.ISBN && item.ISBN[0]) || '',
                references: item['reference-count'] || 0,
                citationCount: item['is-referenced-by-count'] || 0,
                source: 'crossref'
            };
            
            return new Citation(citationData);
        } catch (error) {
            console.warn('Error parsing CrossRef item:', error);
            return null;
        }
    }

    /**
     * PubMed API integration
     */
    async searchPubMed(query, options = {}) {
        try {
            await this.respectRateLimit('pubmed');
            
            // First, search for IDs
            const searchParams = new URLSearchParams({
                db: 'pubmed',
                term: query,
                retmax: options.limit || 20,
                retstart: options.offset || 0,
                sort: options.sort || 'relevance',
                retmode: 'json'
            });
            
            const searchUrl = `${this.endpoints.pubmed}/esearch.fcgi?${searchParams}`;
            const searchResponse = await this.makeRequest(searchUrl);
            const searchData = await searchResponse.json();
            
            if (!searchData.esearchresult || !searchData.esearchresult.idlist) {
                return {
                    results: [],
                    totalResults: 0,
                    source: 'pubmed',
                    query: query
                };
            }
            
            const ids = searchData.esearchresult.idlist;
            if (ids.length === 0) {
                return {
                    results: [],
                    totalResults: 0,
                    source: 'pubmed',
                    query: query
                };
            }
            
            // Fetch details for the IDs
            const results = await this.getPubMedDetails(ids);
            
            return {
                results: results,
                totalResults: parseInt(searchData.esearchresult.count) || 0,
                source: 'pubmed',
                query: query
            };
        } catch (error) {
            console.error('PubMed search error:', error);
            throw error;
        }
    }

    async getPubMedByID(pmid, options = {}) {
        try {
            const details = await this.getPubMedDetails([pmid]);
            return details.length > 0 ? details[0] : null;
        } catch (error) {
            console.error('PubMed ID lookup error:', error);
            throw error;
        }
    }

    async getPubMedDetails(ids) {
        try {
            await this.respectRateLimit('pubmed');
            
            const fetchParams = new URLSearchParams({
                db: 'pubmed',
                id: ids.join(','),
                retmode: 'xml'
            });
            
            const fetchUrl = `${this.endpoints.pubmed}/efetch.fcgi?${fetchParams}`;
            const response = await this.makeRequest(fetchUrl);
            const xmlText = await response.text();
            
            return this.parsePubMedXML(xmlText);
        } catch (error) {
            console.error('PubMed details fetch error:', error);
            return [];
        }
    }

    parsePubMedXML(xmlText) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            const articles = doc.querySelectorAll('PubmedArticle');
            const results = [];
            
            articles.forEach(article => {
                try {
                    const medlineCitation = article.querySelector('MedlineCitation');
                    const articleElement = medlineCitation.querySelector('Article');
                    
                    if (!articleElement) return;
                    
                    // Extract authors
                    const authorList = articleElement.querySelector('AuthorList');
                    const authors = [];
                    if (authorList) {
                        const authorElements = authorList.querySelectorAll('Author');
                        authorElements.forEach(author => {
                            const lastName = author.querySelector('LastName')?.textContent || '';
                            const foreName = author.querySelector('ForeName')?.textContent || '';
                            if (lastName && foreName) {
                                authors.push(`${foreName} ${lastName}`);
                            } else if (lastName) {
                                authors.push(lastName);
                            }
                        });
                    }
                    
                    // Extract other fields
                    const title = articleElement.querySelector('ArticleTitle')?.textContent || '';
                    const journal = articleElement.querySelector('Journal Title')?.textContent || 
                                   articleElement.querySelector('MedlineTA')?.textContent || '';
                    const volume = articleElement.querySelector('Volume')?.textContent || '';
                    const issue = articleElement.querySelector('Issue')?.textContent || '';
                    const pages = articleElement.querySelector('Pagination MedlinePgn')?.textContent || '';
                    const abstract = articleElement.querySelector('Abstract AbstractText')?.textContent || '';
                    
                    // Extract year
                    const pubDate = articleElement.querySelector('Journal JournalIssue PubDate');
                    let year = null;
                    if (pubDate) {
                        const yearElement = pubDate.querySelector('Year');
                        if (yearElement) {
                            year = parseInt(yearElement.textContent);
                        }
                    }
                    
                    // Extract PMID
                    const pmid = medlineCitation.querySelector('PMID')?.textContent || '';
                    
                    // Extract DOI
                    const articleIds = article.querySelectorAll('ArticleId');
                    let doi = '';
                    articleIds.forEach(id => {
                        if (id.getAttribute('IdType') === 'doi') {
                            doi = id.textContent;
                        }
                    });
                    
                    const citationData = {
                        title: title,
                        authors: authors,
                        year: year,
                        type: 'article',
                        publication: journal,
                        volume: volume,
                        issue: issue,
                        pages: pages,
                        abstract: abstract,
                        doi: doi,
                        pmid: pmid,
                        source: 'pubmed'
                    };
                    
                    results.push(new Citation(citationData));
                } catch (error) {
                    console.warn('Error parsing PubMed article:', error);
                }
            });
            
            return results;
        } catch (error) {
            console.error('PubMed XML parsing error:', error);
            return [];
        }
    }

    /**
     * OpenAlex API integration
     */
    async searchOpenAlex(query, options = {}) {
        try {
            await this.respectRateLimit('openalex');
            
            const params = new URLSearchParams({
                search: query,
                per_page: options.limit || 20,
                page: Math.floor((options.offset || 0) / (options.limit || 20)) + 1,
                sort: this.mapOpenAlexSort(options.sort)
            });
            
            const url = `${this.endpoints.openalex}/works?${params}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'User-Agent': this.getUserAgent(),
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.results) {
                return {
                    results: data.results.map(item => this.parseOpenAlexItem(item)),
                    totalResults: data.meta?.count || 0,
                    source: 'openalex',
                    query: query
                };
            } else {
                throw new Error('Invalid OpenAlex response');
            }
        } catch (error) {
            console.error('OpenAlex search error:', error);
            throw error;
        }
    }

    parseOpenAlexItem(item) {
        try {
            const authors = (item.authorships || []).map(authorship => {
                return authorship.author?.display_name || 'Unknown Author';
            });
            
            const citationData = {
                title: item.title || '',
                authors: authors,
                year: item.publication_year || null,
                type: this.mapOpenAlexType(item.type),
                publication: item.primary_location?.source?.display_name || '',
                doi: item.doi ? item.doi.replace('https://doi.org/', '') : '',
                url: item.doi || item.primary_location?.landing_page_url || '',
                abstract: item.abstract_inverted_index ? this.reconstructAbstract(item.abstract_inverted_index) : '',
                citationCount: item.cited_by_count || 0,
                source: 'openalex'
            };
            
            return new Citation(citationData);
        } catch (error) {
            console.warn('Error parsing OpenAlex item:', error);
            return null;
        }
    }

    /**
     * Semantic Scholar API integration
     */
    async searchSemanticScholar(query, options = {}) {
        try {
            await this.respectRateLimit('semanticscholar');
            
            const params = new URLSearchParams({
                query: query,
                limit: options.limit || 20,
                offset: options.offset || 0,
                fields: 'paperId,title,authors,year,venue,citationCount,abstract,url,externalIds'
            });
            
            const url = `${this.endpoints.semanticScholar}/graph/v1/paper/search?${params}`;
            const response = await this.makeRequest(url, {
                headers: {
                    'User-Agent': this.getUserAgent(),
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.data) {
                return {
                    results: data.data.map(item => this.parseSemanticScholarItem(item)),
                    totalResults: data.total || 0,
                    source: 'semanticscholar',
                    query: query
                };
            } else {
                throw new Error('Invalid Semantic Scholar response');
            }
        } catch (error) {
            console.error('Semantic Scholar search error:', error);
            throw error;
        }
    }

    parseSemanticScholarItem(item) {
        try {
            const authors = (item.authors || []).map(author => author.name || 'Unknown Author');
            
            const citationData = {
                title: item.title || '',
                authors: authors,
                year: item.year || null,
                type: 'article',
                publication: item.venue || '',
                doi: item.externalIds?.DOI || '',
                url: item.url || '',
                abstract: item.abstract || '',
                citationCount: item.citationCount || 0,
                semanticScholarId: item.paperId,
                source: 'semanticscholar'
            };
            
            return new Citation(citationData);
        } catch (error) {
            console.warn('Error parsing Semantic Scholar item:', error);
            return null;
        }
    }

    /**
     * Search multiple sources and combine results
     */
    async searchMultipleSources(query, options = {}) {
        try {
            const sources = options.sources || ['crossref', 'pubmed', 'openalex'];
            const promises = sources.map(source => 
                this.searchPapers(query, { ...options, source }).catch(error => {
                    console.warn(`Search failed for ${source}:`, error);
                    return { results: [], totalResults: 0, source };
                })
            );
            
            const results = await Promise.all(promises);
            
            // Combine and deduplicate results
            const combinedResults = [];
            const seenDOIs = new Set();
            const seenTitles = new Set();
            
            results.forEach(result => {
                result.results.forEach(citation => {
                    let isUnique = true;
                    
                    // Check for DOI duplicates
                    if (citation.doi) {
                        if (seenDOIs.has(citation.doi.toLowerCase())) {
                            isUnique = false;
                        } else {
                            seenDOIs.add(citation.doi.toLowerCase());
                        }
                    }
                    
                    // Check for title duplicates
                    if (isUnique && citation.title) {
                        const normalizedTitle = citation.title.toLowerCase().replace(/[^\w\s]/g, '');
                        if (seenTitles.has(normalizedTitle)) {
                            isUnique = false;
                        } else {
                            seenTitles.add(normalizedTitle);
                        }
                    }
                    
                    if (isUnique) {
                        combinedResults.push(citation);
                    }
                });
            });
            
            // Sort by relevance or citation count
            combinedResults.sort((a, b) => {
                if (options.sort === 'citations') {
                    return (b.citationCount || 0) - (a.citationCount || 0);
                }
                return 0; // Keep original order for relevance
            });
            
            // Apply limit
            const limit = options.limit || 20;
            const limitedResults = combinedResults.slice(0, limit);
            
            return {
                results: limitedResults,
                totalResults: combinedResults.length,
                source: 'multiple',
                sources: sources,
                query: query
            };
        } catch (error) {
            console.error('Multiple source search error:', error);
            throw error;
        }
    }

    /**
     * Enhance paper data with additional information
     */
    async enhancePaperData(citation, options = {}) {
        try {
            const enhanced = { ...citation };
            
            // Try to get additional data from different sources
            if (citation.doi && options.enhanceFromCrossRef && citation.source !== 'crossref') {
                try {
                    const crossRefData = await this.getCrossRefByDOI(citation.doi);
                    if (crossRefData) {
                        enhanced.citationCount = crossRefData.citationCount || enhanced.citationCount;
                        enhanced.references = crossRefData.references || enhanced.references;
                        if (!enhanced.abstract && crossRefData.abstract) {
                            enhanced.abstract = crossRefData.abstract;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to enhance with CrossRef data:', error);
                }
            }
            
            // Try to get citation data from Semantic Scholar
            if (options.enhanceFromSemanticScholar && citation.title) {
                try {
                    const semanticData = await this.searchSemanticScholar(citation.title, { limit: 1 });
                    if (semanticData.results.length > 0) {
                        const match = semanticData.results[0];
                        enhanced.citationCount = match.citationCount || enhanced.citationCount;
                        enhanced.semanticScholarId = match.semanticScholarId;
                        if (!enhanced.abstract && match.abstract) {
                            enhanced.abstract = match.abstract;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to enhance with Semantic Scholar data:', error);
                }
            }
            
            return enhanced;
        } catch (error) {
            console.error('Paper enhancement error:', error);
            return citation;
        }
    }

    // Rate limiting methods

    async respectRateLimit(source) {
        const now = Date.now();
        const lastTime = this.lastRequestTimes.get(source) || 0;
        const timeSinceLastRequest = now - lastTime;
        
        if (timeSinceLastRequest < this.options.rateLimitDelay) {
            const delay = this.options.rateLimitDelay - timeSinceLastRequest;
            await this.sleep(delay);
        }
        
        this.lastRequestTimes.set(source, Date.now());
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // HTTP request methods

    async makeRequest(url, options = {}) {
        try {
            if (!this.isOnline) {
                throw new Error('Network is offline');
            }
            
            const requestOptions = {
                timeout: this.options.requestTimeout,
                ...options
            };
            
            // Add timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
            
            const response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 404) {
                    const error = new Error(`Resource not found: ${url}`);
                    error.name = 'NotFoundError';
                    throw error;
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded');
                } else {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }
            }
            
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // Utility methods

    getUserAgent() {
        const email = this.options.crossRefEmail ? `; mailto:${this.options.crossRefEmail}` : '';
        return `${this.options.userAgent}${email}`;
    }

    cleanDOI(doi) {
        return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
    }

    extractYear(dateObj) {
        if (!dateObj) return null;
        
        if (dateObj['date-parts'] && dateObj['date-parts'][0] && dateObj['date-parts'][0][0]) {
            return dateObj['date-parts'][0][0];
        }
        
        if (typeof dateObj === 'string') {
            const match = dateObj.match(/\d{4}/);
            return match ? parseInt(match[0]) : null;
        }
        
        return null;
    }

    formatPages(pageString) {
        if (!pageString) return '';
        return pageString.replace(/(\d+)-(\d+)/, '$1-$2');
    }

    reconstructAbstract(abstractIndex) {
        if (!abstractIndex) return '';
        
        const words = [];
        Object.entries(abstractIndex).forEach(([word, positions]) => {
            positions.forEach(pos => {
                words[pos] = word;
            });
        });
        
        return words.filter(word => word).join(' ');
    }

    // Type mapping methods

    mapCrossRefType(type) {
        const typeMap = {
            'journal-article': 'article',
            'book-chapter': 'chapter',
            'book': 'book',
            'proceedings-article': 'conference',
            'posted-content': 'preprint',
            'dissertation': 'thesis'
        };
        return typeMap[type] || 'article';
    }

    mapOpenAlexType(type) {
        const typeMap = {
            'article': 'article',
            'book': 'book',
            'book-chapter': 'chapter',
            'dissertation': 'thesis',
            'preprint': 'preprint'
        };
        return typeMap[type] || 'article';
    }

    mapOpenAlexSort(sort) {
        const sortMap = {
            'relevance': 'relevance_score:desc',
            'date': 'publication_date:desc',
            'citations': 'cited_by_count:desc'
        };
        return sortMap[sort] || 'relevance_score:desc';
    }

    buildCrossRefFilters(filters) {
        if (!filters || Object.keys(filters).length === 0) return '';
        
        const filterParts = [];
        
        if (filters.fromYear) {
            filterParts.push(`from-pub-date:${filters.fromYear}`);
        }
        
        if (filters.untilYear) {
            filterParts.push(`until-pub-date:${filters.untilYear}`);
        }
        
        if (filters.type) {
            filterParts.push(`type:${filters.type}`);
        }
        
        if (filters.hasOrcid) {
            filterParts.push('has-orcid:true');
        }
        
        if (filters.hasDOI) {
            filterParts.push('has-full-text:true');
        }
        
        return filterParts.join(',');
    }

    // Caching methods

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
            return cached.data;
        }
        
        // Remove expired entry
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }

    setCache(key, data) {
        // Implement LRU cache
        if (this.cache.size >= this.options.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.options.maxCacheSize,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
        };
    }

    setupCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp >= this.options.cacheTimeout) {
                    this.cache.delete(key);
                }
            }
        }, this.options.cacheTimeout);
    }

    // Network event handling

    initializeNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network connection restored');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network connection lost');
        });
    }

    // Statistics and monitoring

    getStats() {
        const stats = {
            cacheSize: this.cache.size,
            isOnline: this.isOnline,
            requestCounts: Object.fromEntries(this.requestCounts),
            lastRequestTimes: Object.fromEntries(this.lastRequestTimes)
        };
        
        return stats;
    }

    // Configuration methods

    updateConfig(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    getConfig() {
        return { ...this.options };
    }
}