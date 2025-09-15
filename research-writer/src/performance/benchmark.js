/**
 * Performance Benchmark Suite
 * Establishes performance baselines and measures improvements
 */

import { performanceMonitor } from './monitor.js';
import { performanceOptimizer } from './optimizer.js';

export class PerformanceBenchmark {
    constructor(options = {}) {
        this.options = {
            enableAutomaticBaseline: true,
            benchmarkSuites: ['rendering', 'interaction', 'memory', 'network'],
            iterations: 10,
            warmupRuns: 3,
            reportingEnabled: true,
            comparisonThreshold: 5, // 5% improvement threshold
            ...options
        };

        this.baselines = new Map();
        this.benchmarkResults = new Map();
        this.currentSession = {
            startTime: Date.now(),
            sessionId: this.generateSessionId(),
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            memoryInfo: this.getMemoryInfo()
        };

        this.init();
    }

    init() {
        if (this.options.enableAutomaticBaseline) {
            this.establishBaselines();
        }

        this.setupPerformanceObservers();
        this.schedulePeriodicBenchmarks();
    }

    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    getMemoryInfo() {
        if ('memory' in performance) {
            return {
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize
            };
        }
        return null;
    }

    async establishBaselines() {
        console.log('📊 Establishing performance baselines...');
        performanceMonitor.startTimer('baseline_establishment');

        const baselineSuites = {
            rendering: () => this.benchmarkRendering(),
            interaction: () => this.benchmarkInteraction(),
            memory: () => this.benchmarkMemory(),
            network: () => this.benchmarkNetwork(),
            componentLifecycle: () => this.benchmarkComponentLifecycle(),
            virtualScrolling: () => this.benchmarkVirtualScrolling(),
            searchAndFilter: () => this.benchmarkSearchAndFilter()
        };

        for (const [suiteName, benchmarkFn] of Object.entries(baselineSuites)) {
            if (this.options.benchmarkSuites.includes(suiteName)) {
                try {
                    const result = await this.runBenchmarkSuite(suiteName, benchmarkFn);
                    this.baselines.set(suiteName, result);
                    console.log(`✅ ${suiteName} baseline established:`, result.summary);
                } catch (error) {
                    console.error(`❌ Failed to establish ${suiteName} baseline:`, error);
                }
            }
        }

        const totalTime = performanceMonitor.endTimer('baseline_establishment');
        console.log(`📈 Baselines established in ${Math.round(totalTime)}ms`);

        this.saveBaselines();
        return this.baselines;
    }

    async runBenchmarkSuite(suiteName, benchmarkFn, iterations = this.options.iterations) {
        const results = {
            suiteName,
            timestamp: Date.now(),
            iterations,
            runs: [],
            summary: {}
        };

        // Warmup runs
        for (let i = 0; i < this.options.warmupRuns; i++) {
            try {
                await benchmarkFn();
            } catch (error) {
                console.warn(`Warmup run ${i + 1} failed:`, error);
            }
        }

        // Actual benchmark runs
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();

            try {
                const runResult = await benchmarkFn();
                const endTime = performance.now();
                const duration = endTime - startTime;

                results.runs.push({
                    iteration: i + 1,
                    duration,
                    success: true,
                    result: runResult,
                    memoryUsage: this.getMemoryInfo()
                });

            } catch (error) {
                const endTime = performance.now();
                const duration = endTime - startTime;

                results.runs.push({
                    iteration: i + 1,
                    duration,
                    success: false,
                    error: error.message,
                    memoryUsage: this.getMemoryInfo()
                });
            }

            // Small delay between runs to prevent browser throttling
            await this.delay(10);
        }

        // Calculate summary statistics
        const successfulRuns = results.runs.filter(run => run.success);
        const durations = successfulRuns.map(run => run.duration);

        if (durations.length > 0) {
            results.summary = {
                average: durations.reduce((a, b) => a + b, 0) / durations.length,
                min: Math.min(...durations),
                max: Math.max(...durations),
                median: this.calculateMedian(durations),
                p95: this.calculatePercentile(durations, 95),
                p99: this.calculatePercentile(durations, 99),
                successRate: (successfulRuns.length / iterations) * 100,
                memoryDelta: this.calculateMemoryDelta(results.runs)
            };
        }

        return results;
    }

    async benchmarkRendering() {
        const startTime = performance.now();

        // Create a test container
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: 800px;
            height: 600px;
        `;
        document.body.appendChild(container);

        try {
            // Simulate rendering a complex component
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < 100; i++) {
                const item = document.createElement('div');
                item.className = 'test-item';
                item.innerHTML = `
                    <div class="item-header">
                        <h3>Item ${i + 1}</h3>
                        <span class="status">Active</span>
                    </div>
                    <div class="item-content">
                        <p>This is test content for item ${i + 1}</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.random() * 100}%"></div>
                        </div>
                    </div>
                `;
                fragment.appendChild(item);
            }

            container.appendChild(fragment);

            // Force layout and paint
            const rect = container.getBoundingClientRect();
            const computedStyle = getComputedStyle(container);

            const endTime = performance.now();

            return {
                itemsRendered: 100,
                renderTime: endTime - startTime,
                dimensions: { width: rect.width, height: rect.height },
                computedProperties: computedStyle.length
            };

        } finally {
            document.body.removeChild(container);
        }
    }

    async benchmarkInteraction() {
        const startTime = performance.now();

        // Create interactive elements
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: 400px;
            height: 300px;
        `;

        const button = document.createElement('button');
        button.textContent = 'Test Button';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'test';

        container.appendChild(button);
        container.appendChild(input);
        document.body.appendChild(container);

        try {
            // Simulate interactions
            let interactionCount = 0;

            // Button clicks
            for (let i = 0; i < 10; i++) {
                button.click();
                interactionCount++;
                await this.delay(1);
            }

            // Input events
            for (let i = 0; i < 10; i++) {
                input.focus();
                input.value = `test${i}`;
                input.blur();
                interactionCount++;
                await this.delay(1);
            }

            const endTime = performance.now();

            return {
                interactions: interactionCount,
                averageInteractionTime: (endTime - startTime) / interactionCount
            };

        } finally {
            document.body.removeChild(container);
        }
    }

    async benchmarkMemory() {
        const startMemory = this.getMemoryInfo();

        // Create memory-intensive operations
        const arrays = [];
        const objects = [];

        // Allocate memory
        for (let i = 0; i < 1000; i++) {
            arrays.push(new Array(100).fill(Math.random()));
            objects.push({
                id: i,
                data: new Array(50).fill(null).map(() => ({
                    value: Math.random(),
                    timestamp: Date.now()
                }))
            });
        }

        const midMemory = this.getMemoryInfo();

        // Clean up
        arrays.length = 0;
        objects.length = 0;

        // Force garbage collection if available
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }

        await this.delay(100); // Wait for GC

        const endMemory = this.getMemoryInfo();

        return {
            startMemory,
            peakMemory: midMemory,
            endMemory,
            memoryDelta: endMemory ? endMemory.usedJSHeapSize - startMemory.usedJSHeapSize : null,
            gcEffectiveness: midMemory && endMemory ?
                ((midMemory.usedJSHeapSize - endMemory.usedJSHeapSize) / midMemory.usedJSHeapSize) * 100 : null
        };
    }

    async benchmarkNetwork() {
        const startTime = performance.now();

        // Simulate network operations
        const promises = [];

        for (let i = 0; i < 5; i++) {
            promises.push(
                fetch(`data:text/plain,test-data-${i}`)
                    .then(response => response.text())
                    .catch(error => ({ error: error.message }))
            );
        }

        const results = await Promise.all(promises);
        const endTime = performance.now();

        const successful = results.filter(result => !result.error).length;

        return {
            requestCount: 5,
            successfulRequests: successful,
            totalTime: endTime - startTime,
            averageRequestTime: (endTime - startTime) / 5
        };
    }

    async benchmarkComponentLifecycle() {
        const startTime = performance.now();

        // Simulate component creation, updates, and destruction
        const components = [];

        // Creation phase
        for (let i = 0; i < 50; i++) {
            const component = {
                id: i,
                element: document.createElement('div'),
                state: { count: 0, active: true },
                props: { name: `Component ${i}`, type: 'test' }
            };

            component.element.innerHTML = `
                <h4>${component.props.name}</h4>
                <p>State: ${component.state.count}</p>
            `;

            components.push(component);
        }

        // Update phase
        components.forEach(component => {
            component.state.count += Math.floor(Math.random() * 10);
            component.element.querySelector('p').textContent = `State: ${component.state.count}`;
        });

        // Destruction phase
        components.forEach(component => {
            component.element.remove();
            component.state = null;
            component.props = null;
        });

        const endTime = performance.now();

        return {
            componentsProcessed: 50,
            lifecycleTime: endTime - startTime,
            averageComponentTime: (endTime - startTime) / 50
        };
    }

    async benchmarkVirtualScrolling() {
        const startTime = performance.now();

        // Simulate virtual scrolling performance
        const itemCount = 1000;
        const viewportHeight = 400;
        const itemHeight = 50;
        const visibleItems = Math.ceil(viewportHeight / itemHeight);

        let scrollPosition = 0;
        const scrollIncrement = itemHeight;

        for (let i = 0; i < 20; i++) {
            scrollPosition += scrollIncrement;

            // Calculate visible range
            const startIndex = Math.floor(scrollPosition / itemHeight);
            const endIndex = Math.min(startIndex + visibleItems, itemCount);

            // Simulate rendering visible items
            const visibleRange = endIndex - startIndex;

            // Small delay to simulate rendering
            await this.delay(1);
        }

        const endTime = performance.now();

        return {
            totalItems: itemCount,
            scrollOperations: 20,
            scrollingTime: endTime - startTime,
            averageScrollTime: (endTime - startTime) / 20
        };
    }

    async benchmarkSearchAndFilter() {
        const startTime = performance.now();

        // Generate test data
        const testData = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            category: ['A', 'B', 'C'][i % 3],
            status: ['active', 'inactive'][i % 2],
            value: Math.random() * 100,
            tags: [`tag${i % 5}`, `category${i % 3}`]
        }));

        // Search operations
        const searchQueries = ['Item 1', 'Category A', 'tag0', 'active'];
        let totalResults = 0;

        for (const query of searchQueries) {
            const results = testData.filter(item =>
                item.name.includes(query) ||
                item.category.includes(query) ||
                item.status.includes(query) ||
                item.tags.some(tag => tag.includes(query))
            );
            totalResults += results.length;
        }

        // Filter operations
        const filterOperations = [
            { category: 'A' },
            { status: 'active' },
            { category: 'B', status: 'inactive' }
        ];

        for (const filter of filterOperations) {
            const filtered = testData.filter(item =>
                Object.entries(filter).every(([key, value]) => item[key] === value)
            );
            totalResults += filtered.length;
        }

        const endTime = performance.now();

        return {
            dataSize: 1000,
            searchQueries: searchQueries.length,
            filterOperations: filterOperations.length,
            totalResults,
            operationTime: endTime - startTime,
            averageOperationTime: (endTime - startTime) / (searchQueries.length + filterOperations.length)
        };
    }

    setupPerformanceObservers() {
        // Long Task Observer
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        console.warn('Long task detected:', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });

                        performanceMonitor.recordMetric(
                            'long_task',
                            entry.duration,
                            'performance',
                            { startTime: entry.startTime, name: entry.name }
                        );
                    }
                });

                longTaskObserver.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Long task observer not supported:', error);
            }
        }

        // Layout Shift Observer
        if ('PerformanceObserver' in window) {
            try {
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.value > 0.1) { // CLS threshold
                            console.warn('Layout shift detected:', entry.value);

                            performanceMonitor.recordMetric(
                                'layout_shift',
                                entry.value,
                                'performance',
                                { sources: entry.sources }
                            );
                        }
                    }
                });

                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (error) {
                console.warn('Layout shift observer not supported:', error);
            }
        }
    }

    schedulePeriodicBenchmarks() {
        if (!this.options.reportingEnabled) return;

        // Run micro-benchmarks every 5 minutes
        setInterval(() => {
            this.runMicroBenchmarks();
        }, 300000);

        // Run full benchmarks every 30 minutes
        setInterval(() => {
            this.runFullBenchmarks();
        }, 1800000);
    }

    async runMicroBenchmarks() {
        const microBenchmarks = {
            quickRender: () => this.quickRenderTest(),
            memoryCheck: () => this.benchmarkMemory(),
            interactionSpeed: () => this.quickInteractionTest()
        };

        for (const [name, benchmark] of Object.entries(microBenchmarks)) {
            try {
                const result = await this.runBenchmarkSuite(`micro_${name}`, benchmark, 3);
                this.recordBenchmarkResult(name, result);
            } catch (error) {
                console.warn(`Micro benchmark ${name} failed:`, error);
            }
        }
    }

    async runFullBenchmarks() {
        console.log('🔄 Running periodic full benchmarks...');
        const results = await this.establishBaselines();
        this.compareWithBaselines(results);
    }

    async quickRenderTest() {
        const startTime = performance.now();

        const container = document.createElement('div');
        for (let i = 0; i < 10; i++) {
            const item = document.createElement('div');
            item.textContent = `Quick test ${i}`;
            container.appendChild(item);
        }

        const endTime = performance.now();
        return { renderTime: endTime - startTime, itemCount: 10 };
    }

    async quickInteractionTest() {
        const button = document.createElement('button');
        document.body.appendChild(button);

        const startTime = performance.now();
        button.click();
        const endTime = performance.now();

        document.body.removeChild(button);

        return { interactionTime: endTime - startTime };
    }

    compareWithBaselines(currentResults) {
        if (!currentResults || this.baselines.size === 0) {
            console.log('⚠️ No baselines available for comparison');
            return;
        }

        const comparisons = new Map();

        for (const [suiteName, currentResult] of currentResults.entries()) {
            const baseline = this.baselines.get(suiteName);

            if (baseline && baseline.summary && currentResult.summary) {
                const improvement = this.calculateImprovement(
                    baseline.summary.average,
                    currentResult.summary.average
                );

                comparisons.set(suiteName, {
                    baseline: baseline.summary.average,
                    current: currentResult.summary.average,
                    improvement,
                    significant: Math.abs(improvement) >= this.options.comparisonThreshold
                });

                if (improvement > this.options.comparisonThreshold) {
                    console.log(`🚀 ${suiteName}: ${improvement.toFixed(1)}% improvement`);
                } else if (improvement < -this.options.comparisonThreshold) {
                    console.warn(`📉 ${suiteName}: ${Math.abs(improvement).toFixed(1)}% regression`);
                } else {
                    console.log(`➡️ ${suiteName}: ${improvement.toFixed(1)}% change (not significant)`);
                }
            }
        }

        this.generatePerformanceReport(comparisons);
        return comparisons;
    }

    calculateImprovement(baseline, current) {
        // Lower is better for performance metrics (time-based)
        return ((baseline - current) / baseline) * 100;
    }

    generatePerformanceReport(comparisons) {
        const report = {
            timestamp: Date.now(),
            sessionId: this.currentSession.sessionId,
            summary: {
                totalBenchmarks: comparisons.size,
                improvements: Array.from(comparisons.values()).filter(c => c.improvement > this.options.comparisonThreshold).length,
                regressions: Array.from(comparisons.values()).filter(c => c.improvement < -this.options.comparisonThreshold).length,
                stable: Array.from(comparisons.values()).filter(c => Math.abs(c.improvement) < this.options.comparisonThreshold).length
            },
            comparisons: Object.fromEntries(comparisons),
            environment: {
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                memory: this.getMemoryInfo(),
                connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown'
            }
        };

        console.log('📊 Performance Report:', report);

        // Store report for later analysis
        this.savePerformanceReport(report);

        return report;
    }

    recordBenchmarkResult(name, result) {
        if (!this.benchmarkResults.has(name)) {
            this.benchmarkResults.set(name, []);
        }

        this.benchmarkResults.get(name).push({
            timestamp: Date.now(),
            result
        });

        // Keep only last 50 results per benchmark
        const results = this.benchmarkResults.get(name);
        if (results.length > 50) {
            this.benchmarkResults.set(name, results.slice(-50));
        }
    }

    saveBaselines() {
        if (!localStorage) return;

        try {
            const baselineData = {
                version: '1.0',
                timestamp: Date.now(),
                baselines: Object.fromEntries(this.baselines),
                environment: this.currentSession
            };

            localStorage.setItem('performance_baselines', JSON.stringify(baselineData));
            console.log('💾 Baselines saved to localStorage');
        } catch (error) {
            console.warn('Failed to save baselines:', error);
        }
    }

    loadBaselines() {
        if (!localStorage) return false;

        try {
            const saved = localStorage.getItem('performance_baselines');
            if (!saved) return false;

            const data = JSON.parse(saved);
            const age = Date.now() - data.timestamp;

            // Don't use baselines older than 7 days
            if (age > 7 * 24 * 60 * 60 * 1000) {
                console.log('🗑️ Clearing outdated baselines');
                localStorage.removeItem('performance_baselines');
                return false;
            }

            this.baselines = new Map(Object.entries(data.baselines));
            console.log('📂 Loaded baselines from localStorage');
            return true;
        } catch (error) {
            console.warn('Failed to load baselines:', error);
            return false;
        }
    }

    savePerformanceReport(report) {
        if (!localStorage) return;

        try {
            const reports = JSON.parse(localStorage.getItem('performance_reports') || '[]');
            reports.push(report);

            // Keep only last 20 reports
            const recentReports = reports.slice(-20);
            localStorage.setItem('performance_reports', JSON.stringify(recentReports));
        } catch (error) {
            console.warn('Failed to save performance report:', error);
        }
    }

    getPerformanceHistory() {
        if (!localStorage) return [];

        try {
            return JSON.parse(localStorage.getItem('performance_reports') || '[]');
        } catch (error) {
            console.warn('Failed to load performance history:', error);
            return [];
        }
    }

    // Utility methods
    calculateMedian(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    calculatePercentile(values, percentile) {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    calculateMemoryDelta(runs) {
        if (runs.length < 2) return null;

        const firstRun = runs[0].memoryUsage;
        const lastRun = runs[runs.length - 1].memoryUsage;

        if (!firstRun || !lastRun) return null;

        return {
            delta: lastRun.usedJSHeapSize - firstRun.usedJSHeapSize,
            percentage: ((lastRun.usedJSHeapSize - firstRun.usedJSHeapSize) / firstRun.usedJSHeapSize) * 100
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API methods
    async measureComponentPerformance(componentName, componentFn) {
        const result = await this.runBenchmarkSuite(
            `component_${componentName}`,
            componentFn,
            5 // Fewer iterations for component-specific tests
        );

        this.recordBenchmarkResult(`component_${componentName}`, result);
        return result;
    }

    getBaselineReport() {
        const report = {
            baselines: Object.fromEntries(this.baselines),
            environment: this.currentSession,
            timestamp: Date.now()
        };

        return report;
    }

    clearBaselines() {
        this.baselines.clear();

        if (localStorage) {
            localStorage.removeItem('performance_baselines');
        }

        console.log('🗑️ Performance baselines cleared');
    }

    destroy() {
        // Clear any running intervals
        if (this.periodicBenchmarkInterval) {
            clearInterval(this.periodicBenchmarkInterval);
        }

        if (this.microBenchmarkInterval) {
            clearInterval(this.microBenchmarkInterval);
        }

        // Clear data structures
        this.baselines.clear();
        this.benchmarkResults.clear();
    }
}

// Export singleton instance
export const performanceBenchmark = new PerformanceBenchmark();

// Convenience functions
export const establishBaseline = () => performanceBenchmark.establishBaselines();
export const measureComponent = (name, fn) => performanceBenchmark.measureComponentPerformance(name, fn);
export const getReport = () => performanceBenchmark.getBaselineReport();
export const comparePerformance = (current) => performanceBenchmark.compareWithBaselines(current);