/**
 * Performance Optimization Utilities
 * Provides optimization strategies for large documents and complex workflows
 */

import { performanceMonitor } from './monitor.js';

export class PerformanceOptimizer {
    constructor(options = {}) {
        this.options = {
            debounceDelay: 300,
            throttleDelay: 100,
            intersectionThreshold: 0.1,
            lazyLoadMargin: '100px',
            maxConcurrentRequests: 3,
            cacheSize: 100,
            enableVirtualization: true,
            chunkSize: 50,
            ...options
        };

        this.cache = new Map();
        this.requestQueue = [];
        this.activeRequests = 0;
        this.observers = new Map();

        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupMemoryPressureHandling();
    }

    // Debouncing and throttling utilities
    debounce(func, delay = this.options.debounceDelay) {
        let timeoutId;
        return function debounced(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    throttle(func, delay = this.options.throttleDelay) {
        let lastCall = 0;
        return function throttled(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }

    // Advanced debouncing with immediate execution
    debounceWithImmediate(func, delay = this.options.debounceDelay) {
        let timeoutId;
        return function debouncedImmediate(...args) {
            const callNow = !timeoutId;
            clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                timeoutId = null;
            }, delay);

            if (callNow) {
                return func.apply(this, args);
            }
        };
    }

    // Request queue management for API calls
    async queueRequest(requestFunction, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const request = {
                execute: requestFunction,
                resolve,
                reject,
                priority,
                timestamp: Date.now()
            };

            // Insert based on priority
            if (priority === 'high') {
                this.requestQueue.unshift(request);
            } else {
                this.requestQueue.push(request);
            }

            this.processQueue();
        });
    }

    async processQueue() {
        if (this.activeRequests >= this.options.maxConcurrentRequests || this.requestQueue.length === 0) {
            return;
        }

        const request = this.requestQueue.shift();
        this.activeRequests++;

        try {
            const result = await request.execute();
            request.resolve(result);
        } catch (error) {
            request.reject(error);
        } finally {
            this.activeRequests--;
            this.processQueue(); // Process next request
        }
    }

    // Intelligent caching system
    cache(key, value, ttl = 300000) { // 5 minutes default TTL
        const expiryTime = Date.now() + ttl;

        // Remove expired entries
        this.cleanExpiredCache();

        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.options.cacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            expiryTime,
            accessTime: Date.now(),
            hitCount: 0
        });
    }

    getFromCache(key) {
        const cached = this.cache.get(key);

        if (!cached) return null;

        if (Date.now() > cached.expiryTime) {
            this.cache.delete(key);
            return null;
        }

        // Update access metrics
        cached.accessTime = Date.now();
        cached.hitCount++;

        return cached.value;
    }

    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiryTime) {
                this.cache.delete(key);
            }
        }
    }

    // Virtual scrolling for large lists
    createVirtualScroller(container, items, renderItem, itemHeight = 50) {
        if (!this.options.enableVirtualization || items.length < 100) {
            // Fallback to normal rendering for small lists
            return this.renderAllItems(container, items, renderItem);
        }

        const virtualScroller = {
            container,
            items,
            renderItem,
            itemHeight,
            visibleCount: Math.ceil(container.clientHeight / itemHeight) + 2,
            scrollTop: 0,
            startIndex: 0,
            endIndex: 0,
            viewport: null,

            init() {
                this.setupViewport();
                this.render();
                this.setupScrollListener();
            },

            setupViewport() {
                container.innerHTML = '';

                // Create viewport
                this.viewport = document.createElement('div');
                this.viewport.style.cssText = `
                    height: ${container.clientHeight}px;
                    overflow: auto;
                    position: relative;
                `;

                // Create scrollable area
                const scrollArea = document.createElement('div');
                scrollArea.style.height = `${items.length * itemHeight}px`;
                this.viewport.appendChild(scrollArea);

                container.appendChild(this.viewport);
            },

            setupScrollListener() {
                const throttledScroll = performanceOptimizer.throttle(() => {
                    this.scrollTop = this.viewport.scrollTop;
                    this.render();
                }, 16); // ~60fps

                this.viewport.addEventListener('scroll', throttledScroll);
            },

            render() {
                const startIndex = Math.floor(this.scrollTop / this.itemHeight);
                const endIndex = Math.min(startIndex + this.visibleCount, items.length);

                if (startIndex === this.startIndex && endIndex === this.endIndex) {
                    return; // No change needed
                }

                this.startIndex = startIndex;
                this.endIndex = endIndex;

                // Clear and render visible items
                const scrollArea = this.viewport.firstChild;
                scrollArea.innerHTML = '';

                for (let i = startIndex; i < endIndex; i++) {
                    const item = renderItem(items[i], i);
                    item.style.cssText = `
                        position: absolute;
                        top: ${i * this.itemHeight}px;
                        width: 100%;
                        height: ${this.itemHeight}px;
                    `;
                    scrollArea.appendChild(item);
                }
            }
        };

        virtualScroller.init();
        return virtualScroller;
    }

    renderAllItems(container, items, renderItem) {
        container.innerHTML = '';
        items.forEach((item, index) => {
            container.appendChild(renderItem(item, index));
        });
    }

    // Lazy loading implementation
    setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    const loader = element.dataset.loader;

                    if (loader && window[loader]) {
                        window[loader](element);
                        observer.unobserve(element);
                    }
                }
            });
        }, {
            rootMargin: this.options.lazyLoadMargin,
            threshold: this.options.intersectionThreshold
        });

        this.observers.set('intersection', observer);
    }

    observeForLazyLoad(element, loaderFunction) {
        const observer = this.observers.get('intersection');
        if (observer) {
            // Store loader function reference
            const functionName = `loader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            window[functionName] = loaderFunction;
            element.dataset.loader = functionName;

            observer.observe(element);
        }
    }

    // Chunked processing for large datasets
    async processInChunks(data, processor, chunkSize = this.options.chunkSize) {
        const results = [];
        const chunks = this.createChunks(data, chunkSize);

        for (const chunk of chunks) {
            const chunkResults = await processor(chunk);
            results.push(...chunkResults);

            // Yield to browser between chunks
            await this.yieldToMain();
        }

        return results;
    }

    createChunks(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    yieldToMain(minTime = 5) {
        return new Promise(resolve => {
            const deadline = Date.now() + minTime;

            function scheduler() {
                if (Date.now() >= deadline) {
                    resolve();
                } else {
                    setTimeout(scheduler, 0);
                }
            }

            scheduler();
        });
    }

    // Memory pressure handling
    setupMemoryPressureHandling() {
        if ('memory' in performance) {
            const checkMemoryPressure = () => {
                const memInfo = performance.memory;
                const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;

                if (usageRatio > 0.8) {
                    this.handleMemoryPressure();
                }
            };

            // Check every 30 seconds
            setInterval(checkMemoryPressure, 30000);
        }
    }

    handleMemoryPressure() {
        console.log('Memory pressure detected, cleaning up...');

        // Clear expired cache
        this.cleanExpiredCache();

        // Clear old performance data
        performanceMonitor.buffer = performanceMonitor.buffer.slice(-100);

        // Trigger garbage collection hint
        if ('gc' in window && typeof window.gc === 'function') {
            window.gc();
        }

        // Notify components to clean up
        window.dispatchEvent(new CustomEvent('memory-pressure'));
    }

    // DOM optimization utilities
    batchDOMUpdates(updates) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                updates.forEach(update => update());
                resolve();
            });
        });
    }

    optimizeReflow(element, updates) {
        // Read all measurements first
        const computedStyles = [];
        updates.forEach(update => {
            if (update.read) {
                computedStyles.push(update.read(element));
            }
        });

        // Then apply all updates
        return this.batchDOMUpdates(updates.map((update, index) => {
            return () => update.write(element, computedStyles[index]);
        }));
    }

    // Image optimization
    createOptimizedImage(src, options = {}) {
        const {
            lazy = true,
            quality = 85,
            format = 'webp',
            fallbackFormat = 'jpeg',
            sizes = '100vw'
        } = options;

        const picture = document.createElement('picture');

        // WebP source
        if (format === 'webp') {
            const webpSource = document.createElement('source');
            webpSource.srcset = this.generateSrcSet(src, 'webp', quality);
            webpSource.type = 'image/webp';
            webpSource.sizes = sizes;
            picture.appendChild(webpSource);
        }

        // Fallback image
        const img = document.createElement('img');
        img.src = lazy ? this.generatePlaceholder(300, 200) : src;
        img.alt = options.alt || '';

        if (lazy) {
            img.dataset.src = src;
            img.loading = 'lazy';
            this.observeForLazyLoad(img, (element) => {
                element.src = element.dataset.src;
                element.classList.add('loaded');
            });
        }

        picture.appendChild(img);
        return picture;
    }

    generateSrcSet(baseSrc, format, quality) {
        const sizes = [480, 768, 1024, 1440];
        return sizes.map(size =>
            `${this.resizeImage(baseSrc, size, format, quality)} ${size}w`
        ).join(', ');
    }

    resizeImage(src, width, format, quality) {
        // In a real implementation, this would call an image service
        // For now, return the original source
        return src;
    }

    generatePlaceholder(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#d0d0d0';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', width / 2, height / 2);

        return canvas.toDataURL();
    }

    // Component optimization helpers
    memoize(func, keyGenerator = (...args) => JSON.stringify(args)) {
        const memoCache = new Map();

        return function memoized(...args) {
            const key = keyGenerator(...args);

            if (memoCache.has(key)) {
                return memoCache.get(key);
            }

            const result = func.apply(this, args);
            memoCache.set(key, result);

            return result;
        };
    }

    createMutationObserver(callback, options = {}) {
        const defaultOptions = {
            childList: true,
            subtree: false,
            attributes: false,
            attributeOldValue: false,
            characterData: false,
            characterDataOldValue: false
        };

        const observer = new MutationObserver(this.throttle(callback, 100));
        const mergedOptions = { ...defaultOptions, ...options };

        return {
            observe: (target) => observer.observe(target, mergedOptions),
            disconnect: () => observer.disconnect()
        };
    }

    // Cleanup
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.cache.clear();
        this.requestQueue = [];
    }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Convenience functions
export const debounce = (func, delay) => performanceOptimizer.debounce(func, delay);
export const throttle = (func, delay) => performanceOptimizer.throttle(func, delay);
export const cache = (key, value, ttl) => performanceOptimizer.cache(key, value, ttl);
export const getFromCache = (key) => performanceOptimizer.getFromCache(key);
export const memoize = (func, keyGen) => performanceOptimizer.memoize(func, keyGen);
export const processInChunks = (data, processor, chunkSize) => performanceOptimizer.processInChunks(data, processor, chunkSize);