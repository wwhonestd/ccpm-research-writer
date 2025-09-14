/**
 * Performance Monitoring System
 * Tracks and measures application performance with focus on large documents and complex workflows
 */

export class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            enableRealTimeMonitoring: true,
            sampleRate: 1.0, // 100% sampling
            trackUserTiming: true,
            trackMemoryUsage: true,
            trackDOMMetrics: true,
            bufferSize: 1000,
            reportingInterval: 5000, // 5 seconds
            ...options
        };

        this.metrics = new Map();
        this.timings = new Map();
        this.observers = new Map();
        this.buffer = [];
        this.baseline = null;
        this.listeners = new Set();

        this.init();
    }

    init() {
        if (this.options.enableRealTimeMonitoring) {
            this.setupObservers();
            this.startReporting();
        }
    }

    setupObservers() {
        // Performance Observer for navigation and resource timing
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordMetric(entry.name, entry.duration, entry.entryType);
                }
            });

            observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'mark'] });
            this.observers.set('performance', observer);
        }

        // Mutation Observer for DOM changes
        if (this.options.trackDOMMetrics) {
            const mutationObserver = new MutationObserver((mutations) => {
                this.recordMetric('dom_mutations', mutations.length, 'dom');
            });

            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
            this.observers.set('mutation', mutationObserver);
        }

        // Intersection Observer for viewport performance
        const intersectionObserver = new IntersectionObserver((entries) => {
            const visibleElements = entries.filter(entry => entry.isIntersecting).length;
            this.recordMetric('visible_elements', visibleElements, 'viewport');
        });

        this.observers.set('intersection', intersectionObserver);
    }

    // Core measurement methods
    startTimer(label) {
        const startTime = performance.now();
        this.timings.set(label, { start: startTime, end: null });

        if (this.options.trackUserTiming && 'mark' in performance) {
            performance.mark(`${label}-start`);
        }

        return startTime;
    }

    endTimer(label) {
        const timing = this.timings.get(label);
        if (!timing) {
            console.warn(`No timer found for label: ${label}`);
            return null;
        }

        const endTime = performance.now();
        const duration = endTime - timing.start;
        timing.end = endTime;

        if (this.options.trackUserTiming && 'measure' in performance) {
            try {
                performance.measure(label, `${label}-start`);
            } catch (e) {
                // Silently handle cases where mark doesn't exist
            }
        }

        this.recordMetric(label, duration, 'timer');
        return duration;
    }

    recordMetric(name, value, type = 'custom', metadata = {}) {
        const timestamp = Date.now();
        const metric = {
            name,
            value,
            type,
            timestamp,
            metadata: {
                url: window.location.pathname,
                userAgent: navigator.userAgent.split(' ')[0],
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                ...metadata
            }
        };

        // Store in metrics map for quick access
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name).push(metric);

        // Add to buffer for batch reporting
        this.buffer.push(metric);

        // Trim buffer if it exceeds size limit
        if (this.buffer.length > this.options.bufferSize) {
            this.buffer = this.buffer.slice(-this.options.bufferSize);
        }

        // Notify listeners
        this.notifyListeners(metric);
    }

    // Memory monitoring
    measureMemoryUsage() {
        if (!this.options.trackMemoryUsage) return null;

        const memoryInfo = {
            timestamp: Date.now()
        };

        // Modern browsers
        if ('memory' in performance) {
            memoryInfo.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
            memoryInfo.totalJSHeapSize = performance.memory.totalJSHeapSize;
            memoryInfo.usedJSHeapSize = performance.memory.usedJSHeapSize;
        }

        // Store memory metrics
        this.recordMetric('memory_usage', memoryInfo.usedJSHeapSize || 0, 'memory', memoryInfo);
        return memoryInfo;
    }

    // DOM performance metrics
    measureDOMMetrics() {
        if (!this.options.trackDOMMetrics) return null;

        const domMetrics = {
            nodeCount: document.querySelectorAll('*').length,
            depth: this.calculateDOMDepth(),
            styleSheets: document.styleSheets.length,
            images: document.images.length,
            scripts: document.scripts.length,
            timestamp: Date.now()
        };

        Object.entries(domMetrics).forEach(([key, value]) => {
            if (key !== 'timestamp') {
                this.recordMetric(`dom_${key}`, value, 'dom');
            }
        });

        return domMetrics;
    }

    calculateDOMDepth() {
        let maxDepth = 0;

        function traverse(element, depth = 0) {
            maxDepth = Math.max(maxDepth, depth);
            for (const child of element.children) {
                traverse(child, depth + 1);
            }
        }

        traverse(document.body);
        return maxDepth;
    }

    // Component-specific performance tracking
    trackComponentRender(componentName, renderFunction) {
        return (...args) => {
            this.startTimer(`component_render_${componentName}`);

            try {
                const result = renderFunction.apply(this, args);

                // Handle both sync and async render functions
                if (result && typeof result.then === 'function') {
                    return result.finally(() => {
                        this.endTimer(`component_render_${componentName}`);
                    });
                } else {
                    this.endTimer(`component_render_${componentName}`);
                    return result;
                }
            } catch (error) {
                this.endTimer(`component_render_${componentName}`);
                this.recordMetric(`component_error_${componentName}`, 1, 'error', { error: error.message });
                throw error;
            }
        };
    }

    // Export-specific performance tracking
    trackExportOperation(exportType, operation) {
        return async (...args) => {
            const timerLabel = `export_${exportType}_${operation}`;
            this.startTimer(timerLabel);

            try {
                const result = await operation.apply(this, args);
                this.endTimer(timerLabel);
                this.recordMetric(`export_success_${exportType}`, 1, 'export');
                return result;
            } catch (error) {
                this.endTimer(timerLabel);
                this.recordMetric(`export_error_${exportType}`, 1, 'export', { error: error.message });
                throw error;
            }
        };
    }

    // Analysis and reporting
    getMetrics(name = null, since = null) {
        if (name) {
            const metrics = this.metrics.get(name) || [];
            return since ? metrics.filter(m => m.timestamp >= since) : metrics;
        }

        const allMetrics = {};
        for (const [key, values] of this.metrics.entries()) {
            allMetrics[key] = since ? values.filter(m => m.timestamp >= since) : values;
        }
        return allMetrics;
    }

    getPerformanceReport() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        const report = {
            timestamp: now,
            timeRange: '1 hour',
            summary: {},
            components: {},
            exports: {},
            memory: this.measureMemoryUsage(),
            dom: this.measureDOMMetrics()
        };

        // Analyze metrics for summary
        for (const [name, metrics] of this.metrics.entries()) {
            const recentMetrics = metrics.filter(m => m.timestamp >= oneHourAgo);

            if (recentMetrics.length === 0) continue;

            const values = recentMetrics.map(m => m.value).filter(v => typeof v === 'number');

            if (values.length > 0) {
                const summary = {
                    count: recentMetrics.length,
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    type: recentMetrics[0].type
                };

                if (name.includes('component_render_')) {
                    report.components[name.replace('component_render_', '')] = summary;
                } else if (name.includes('export_')) {
                    const exportKey = name.replace(/export_(success_|error_)?/, '');
                    report.exports[exportKey] = summary;
                } else {
                    report.summary[name] = summary;
                }
            }
        }

        return report;
    }

    // Baseline establishment and comparison
    establishBaseline() {
        this.baseline = {
            timestamp: Date.now(),
            metrics: this.getPerformanceReport(),
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };

        console.log('Performance baseline established:', this.baseline);
        return this.baseline;
    }

    compareToBaseline() {
        if (!this.baseline) {
            throw new Error('No baseline established. Call establishBaseline() first.');
        }

        const current = this.getPerformanceReport();
        const comparison = {
            timestamp: Date.now(),
            baselineTimestamp: this.baseline.timestamp,
            improvements: {},
            regressions: {},
            overall: { improved: 0, regressed: 0, unchanged: 0 }
        };

        // Compare component performance
        for (const [component, currentStats] of Object.entries(current.components)) {
            const baselineStats = this.baseline.metrics.components[component];

            if (baselineStats) {
                const improvement = ((baselineStats.avg - currentStats.avg) / baselineStats.avg) * 100;

                if (Math.abs(improvement) > 5) { // 5% threshold
                    if (improvement > 0) {
                        comparison.improvements[component] = `${improvement.toFixed(1)}% faster`;
                        comparison.overall.improved++;
                    } else {
                        comparison.regressions[component] = `${Math.abs(improvement).toFixed(1)}% slower`;
                        comparison.overall.regressed++;
                    }
                } else {
                    comparison.overall.unchanged++;
                }
            }
        }

        return comparison;
    }

    // Event system
    addEventListener(type, listener) {
        this.listeners.add({ type, listener });
    }

    removeEventListener(type, listener) {
        this.listeners.delete({ type, listener });
    }

    notifyListeners(metric) {
        this.listeners.forEach(({ type, listener }) => {
            if (type === 'all' || type === metric.type) {
                try {
                    listener(metric);
                } catch (error) {
                    console.error('Error in performance listener:', error);
                }
            }
        });
    }

    startReporting() {
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }

        this.reportingInterval = setInterval(() => {
            if (this.buffer.length > 0) {
                this.measureMemoryUsage();
                this.measureDOMMetrics();
            }
        }, this.options.reportingInterval);
    }

    // Cleanup
    destroy() {
        // Clear intervals
        if (this.reportingInterval) {
            clearInterval(this.reportingInterval);
        }

        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Clear data
        this.metrics.clear();
        this.timings.clear();
        this.buffer = [];
        this.listeners.clear();
    }
}

// Singleton instance for global use
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const startTimer = (label) => performanceMonitor.startTimer(label);
export const endTimer = (label) => performanceMonitor.endTimer(label);
export const recordMetric = (name, value, type, metadata) => performanceMonitor.recordMetric(name, value, type, metadata);
export const trackComponent = (name, fn) => performanceMonitor.trackComponentRender(name, fn);
export const trackExport = (type, fn) => performanceMonitor.trackExportOperation(type, fn);