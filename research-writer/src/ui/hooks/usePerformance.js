/**
 * Performance Hooks for UI Components
 * Provides performance monitoring and optimization hooks for React-like component usage
 */

import { performanceMonitor } from '../../performance/monitor.js';
import { performanceOptimizer, debounce, throttle, memoize } from '../../performance/optimizer.js';

/**
 * Hook for component performance monitoring
 */
export function usePerformanceMonitoring(componentName, options = {}) {
    const {
        trackRender = true,
        trackInteractions = true,
        sampleRate = 1.0
    } = options;

    let isMonitoring = false;

    const startMonitoring = () => {
        if (!isMonitoring && Math.random() < sampleRate) {
            performanceMonitor.startTimer(`component_${componentName}_lifecycle`);
            isMonitoring = true;
        }
    };

    const endMonitoring = () => {
        if (isMonitoring) {
            performanceMonitor.endTimer(`component_${componentName}_lifecycle`);
            isMonitoring = false;
        }
    };

    const trackInteraction = (interactionType) => {
        performanceMonitor.recordMetric(
            `interaction_${componentName}_${interactionType}`,
            1,
            'interaction',
            { component: componentName, type: interactionType }
        );
    };

    // Auto-track render performance
    if (trackRender) {
        const originalRender = window.requestAnimationFrame;
        window.requestAnimationFrame = function(callback) {
            return originalRender.call(this, function() {
                startMonitoring();
                const result = callback.apply(this, arguments);
                endMonitoring();
                return result;
            });
        };
    }

    return {
        startMonitoring,
        endMonitoring,
        trackInteraction,

        // Convenience methods for common tracking scenarios
        trackMount: () => trackInteraction('mount'),
        trackUnmount: () => trackInteraction('unmount'),
        trackUpdate: () => trackInteraction('update'),
        trackClick: () => trackInteraction('click'),
        trackSubmit: () => trackInteraction('submit'),
        trackError: (error) => performanceMonitor.recordMetric(
            `error_${componentName}`,
            1,
            'error',
            { component: componentName, error: error.message }
        )
    };
}

/**
 * Hook for debounced functions
 */
export function useDebounce(func, delay = 300, deps = []) {
    let debouncedFunction = null;

    const updateDebouncedFunction = () => {
        debouncedFunction = debounce(func, delay);
    };

    // Update debounced function when dependencies change
    if (!debouncedFunction || deps.some((dep, index) => dep !== updateDebouncedFunction.lastDeps?.[index])) {
        updateDebouncedFunction();
        updateDebouncedFunction.lastDeps = deps;
    }

    return debouncedFunction;
}

/**
 * Hook for throttled functions
 */
export function useThrottle(func, delay = 100, deps = []) {
    let throttledFunction = null;

    const updateThrottledFunction = () => {
        throttledFunction = throttle(func, delay);
    };

    // Update throttled function when dependencies change
    if (!throttledFunction || deps.some((dep, index) => dep !== updateThrottledFunction.lastDeps?.[index])) {
        updateThrottledFunction();
        updateThrottledFunction.lastDeps = deps;
    }

    return throttledFunction;
}

/**
 * Hook for memoized computations
 */
export function useMemoizedComputation(computeFn, keyGenerator, deps = []) {
    let memoizedFunction = null;

    const updateMemoizedFunction = () => {
        memoizedFunction = memoize(computeFn, keyGenerator);
    };

    // Update memoized function when dependencies change
    if (!memoizedFunction || deps.some((dep, index) => dep !== updateMemoizedFunction.lastDeps?.[index])) {
        updateMemoizedFunction();
        updateMemoizedFunction.lastDeps = deps;
    }

    return memoizedFunction;
}

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll(containerRef, items, renderItem, itemHeight = 50) {
    let virtualScroller = null;

    const setupVirtualScrolling = () => {
        if (containerRef.current && items.length > 0) {
            virtualScroller = performanceOptimizer.createVirtualScroller(
                containerRef.current,
                items,
                renderItem,
                itemHeight
            );
        }
    };

    const cleanup = () => {
        if (virtualScroller && virtualScroller.destroy) {
            virtualScroller.destroy();
            virtualScroller = null;
        }
    };

    return {
        setupVirtualScrolling,
        cleanup,
        virtualScroller
    };
}

/**
 * Hook for lazy loading
 */
export function useLazyLoading(elementRef, loadFunction, options = {}) {
    const {
        threshold = 0.1,
        rootMargin = '100px',
        triggerOnce = true
    } = options;

    let hasTriggered = false;

    const setupLazyLoading = () => {
        if (elementRef.current && (!hasTriggered || !triggerOnce)) {
            performanceOptimizer.observeForLazyLoad(elementRef.current, () => {
                loadFunction();
                hasTriggered = true;
            });
        }
    };

    return {
        setupLazyLoading,
        hasLoaded: hasTriggered
    };
}

/**
 * Hook for performance metrics collection
 */
export function usePerformanceMetrics(componentName) {
    const metrics = {
        renders: 0,
        lastRenderTime: null,
        averageRenderTime: 0,
        errors: 0,
        interactions: 0
    };

    const recordRender = (renderTime) => {
        metrics.renders++;
        metrics.lastRenderTime = renderTime;
        metrics.averageRenderTime = (
            (metrics.averageRenderTime * (metrics.renders - 1) + renderTime) / metrics.renders
        );

        performanceMonitor.recordMetric(
            `component_render_${componentName}`,
            renderTime,
            'render',
            {
                component: componentName,
                renderCount: metrics.renders,
                averageTime: metrics.averageRenderTime
            }
        );
    };

    const recordError = (error) => {
        metrics.errors++;
        performanceMonitor.recordMetric(
            `component_error_${componentName}`,
            1,
            'error',
            {
                component: componentName,
                error: error.message,
                totalErrors: metrics.errors
            }
        );
    };

    const recordInteraction = (type) => {
        metrics.interactions++;
        performanceMonitor.recordMetric(
            `component_interaction_${componentName}`,
            1,
            'interaction',
            {
                component: componentName,
                type,
                totalInteractions: metrics.interactions
            }
        );
    };

    const getMetrics = () => ({ ...metrics });

    return {
        recordRender,
        recordError,
        recordInteraction,
        getMetrics
    };
}

/**
 * Hook for request queuing and batching
 */
export function useRequestQueue(options = {}) {
    const {
        maxConcurrent = 3,
        batchDelay = 100,
        priority = 'normal'
    } = options;

    let requestBatch = [];
    let batchTimer = null;

    const queueRequest = (requestFn, requestPriority = priority) => {
        return performanceOptimizer.queueRequest(requestFn, requestPriority);
    };

    const batchRequests = (requests) => {
        requestBatch.push(...requests);

        if (batchTimer) {
            clearTimeout(batchTimer);
        }

        batchTimer = setTimeout(() => {
            const currentBatch = requestBatch.slice();
            requestBatch = [];

            // Execute batch
            return Promise.all(currentBatch.map(request => queueRequest(request)));
        }, batchDelay);
    };

    return {
        queueRequest,
        batchRequests
    };
}

/**
 * Hook for memory monitoring
 */
export function useMemoryMonitoring(componentName, options = {}) {
    const {
        trackUsage = true,
        alertThreshold = 0.8,
        cleanupOnPressure = true
    } = options;

    let memoryMetrics = {
        peak: 0,
        current: 0,
        alerts: 0
    };

    const recordMemoryUsage = () => {
        if (!trackUsage) return;

        const memory = performanceMonitor.measureMemoryUsage();
        if (memory && memory.usedJSHeapSize) {
            memoryMetrics.current = memory.usedJSHeapSize;
            memoryMetrics.peak = Math.max(memoryMetrics.peak, memory.usedJSHeapSize);

            const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
            if (usageRatio > alertThreshold) {
                memoryMetrics.alerts++;

                if (cleanupOnPressure) {
                    performanceOptimizer.handleMemoryPressure();
                }
            }

            performanceMonitor.recordMetric(
                `memory_${componentName}`,
                memory.usedJSHeapSize,
                'memory',
                {
                    component: componentName,
                    usageRatio: usageRatio.toFixed(3),
                    peak: memoryMetrics.peak
                }
            );
        }
    };

    const getMemoryMetrics = () => ({ ...memoryMetrics });

    // Set up periodic monitoring
    const startMemoryMonitoring = (interval = 5000) => {
        const monitoringInterval = setInterval(recordMemoryUsage, interval);
        return () => clearInterval(monitoringInterval);
    };

    return {
        recordMemoryUsage,
        getMemoryMetrics,
        startMemoryMonitoring
    };
}

/**
 * Hook for chunked processing
 */
export function useChunkedProcessing(processingFunction, options = {}) {
    const {
        chunkSize = 50,
        delay = 5,
        onProgress = null
    } = options;

    const processInChunks = async (data) => {
        const results = [];
        const chunks = [];

        // Create chunks
        for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
        }

        // Process chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunkResult = await processingFunction(chunks[i]);
            results.push(...chunkResult);

            if (onProgress) {
                onProgress({
                    processed: i + 1,
                    total: chunks.length,
                    percentage: ((i + 1) / chunks.length) * 100
                });
            }

            // Yield to main thread
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    };

    return {
        processInChunks
    };
}

/**
 * Hook for DOM optimization
 */
export function useDOMOptimization() {
    const batchDOMUpdates = (updates) => {
        return performanceOptimizer.batchDOMUpdates(updates);
    };

    const optimizeReflow = (element, updates) => {
        return performanceOptimizer.optimizeReflow(element, updates);
    };

    const createMutationObserver = (callback, options) => {
        return performanceOptimizer.createMutationObserver(callback, options);
    };

    return {
        batchDOMUpdates,
        optimizeReflow,
        createMutationObserver
    };
}

/**
 * Hook for export performance optimization
 */
export function useExportPerformance(exportType) {
    const trackExportOperation = (operation) => {
        return performanceMonitor.trackExportOperation(exportType, operation);
    };

    const optimizeForExport = {
        // Optimize images for export
        processImages: async (images) => {
            return performanceOptimizer.processInChunks(
                images,
                (chunk) => Promise.all(chunk.map(img => optimizeImageForExport(img))),
                10 // Smaller chunks for memory-intensive operations
            );
        },

        // Optimize text content
        processText: (text) => {
            // Remove unnecessary whitespace and optimize formatting
            return text
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n\n')
                .trim();
        },

        // Optimize citations
        processCitations: async (citations) => {
            return performanceOptimizer.processInChunks(
                citations,
                (chunk) => Promise.all(chunk.map(citation => formatCitation(citation))),
                25
            );
        }
    };

    const optimizeImageForExport = async (image) => {
        // Placeholder for image optimization logic
        return image;
    };

    const formatCitation = async (citation) => {
        // Placeholder for citation formatting logic
        return citation;
    };

    return {
        trackExportOperation,
        optimizeForExport
    };
}

// Utility functions for hook composition
export function composeHooks(...hooks) {
    return (props) => {
        const results = {};
        hooks.forEach((hook, index) => {
            const hookResult = hook(props);
            results[`hook${index}`] = hookResult;
        });
        return results;
    };
}

export function createPerformanceHOC(WrappedComponent, options = {}) {
    return function PerformanceWrappedComponent(props) {
        const { trackInteraction } = usePerformanceMonitoring(
            WrappedComponent.name || 'AnonymousComponent',
            options
        );

        // Add performance tracking to common event handlers
        const enhancedProps = {
            ...props,
            onClick: props.onClick ? (...args) => {
                trackInteraction('click');
                return props.onClick(...args);
            } : undefined,
            onSubmit: props.onSubmit ? (...args) => {
                trackInteraction('submit');
                return props.onSubmit(...args);
            } : undefined
        };

        return WrappedComponent(enhancedProps);
    };
}