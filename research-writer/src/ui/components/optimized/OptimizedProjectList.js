/**
 * OptimizedProjectList - Performance-enhanced wrapper for ProjectList
 * Adds virtual scrolling, lazy loading, and smart caching to existing ProjectList
 */

import { usePerformanceMonitoring, useVirtualScroll, useDebounce, useMemoryMonitoring } from '../../hooks/usePerformance.js';
import { performanceOptimizer, debounce, throttle, memoize } from '../../../performance/optimizer.js';
import { performanceMonitor, trackComponent } from '../../../performance/monitor.js';

export class OptimizedProjectList {
    constructor(container, projectManager, options = {}) {
        this.container = container;
        this.projectManager = projectManager;
        this.options = {
            enableVirtualScrolling: true,
            virtualScrollThreshold: 100, // Enable virtual scrolling for >100 items
            enableLazyLoading: true,
            enableSmartCaching: true,
            enablePerformanceTracking: true,
            debounceSearch: 300,
            throttleScroll: 16, // ~60fps
            cacheTimeout: 300000, // 5 minutes
            preloadCount: 10, // Preload 10 items ahead
            itemHeight: 120, // Estimated height per project item
            ...options
        };

        this.state = {
            projects: [],
            filteredProjects: [],
            visibleProjects: [],
            searchQuery: '',
            filters: {},
            sortConfig: { field: 'updated', direction: 'desc' },
            currentPage: 1,
            itemsPerPage: 20,
            selectedProjects: new Set(),
            isLoading: false,
            virtualScrolling: false
        };

        this.cache = new Map();
        this.renderCache = new Map();
        this.intersectionObserver = null;
        this.virtualScroller = null;
        this.performance = null;
        this.memoryMonitor = null;

        // Performance-optimized methods
        this.debouncedSearch = debounce(this.performSearch.bind(this), this.options.debounceSearch);
        this.throttledScroll = throttle(this.handleScroll.bind(this), this.options.throttleScroll);
        this.memoizedRender = memoize(this.renderProjectItem.bind(this), (project) =>
            `${project.id}-${project.updated}-${this.state.selectedProjects.has(project.id)}`
        );

        this.init();
    }

    init() {
        if (this.options.enablePerformanceTracking) {
            this.performance = usePerformanceMonitoring('OptimizedProjectList');
            this.memoryMonitor = useMemoryMonitoring('OptimizedProjectList');
            this.performance.startMonitoring();
        }

        this.setupContainer();
        this.setupEventListeners();
        this.loadProjects();

        if (this.options.enablePerformanceTracking) {
            this.performance.endMonitoring();
        }
    }

    setupContainer() {
        this.container.className = 'optimized-project-list';
        this.container.innerHTML = this.getContainerHTML();

        // Get references to key elements
        this.searchInput = this.container.querySelector('.search-input');
        this.filterContainer = this.container.querySelector('.filters-container');
        this.projectsContainer = this.container.querySelector('.projects-container');
        this.paginationContainer = this.container.querySelector('.pagination-container');
        this.loadingIndicator = this.container.querySelector('.loading-indicator');
    }

    getContainerHTML() {
        return `
            <div class="project-list-header">
                <div class="header-content">
                    <h2 class="list-title">Projects</h2>
                    <div class="project-count">
                        <span id="total-count">0</span> projects
                        <span id="filtered-count" class="filtered-count" style="display: none;">
                            (<span id="filtered-number">0</span> filtered)
                        </span>
                    </div>
                </div>

                <div class="list-actions">
                    <button class="btn btn-primary" id="create-project">
                        ➕ New Project
                    </button>
                    <button class="btn btn-secondary" id="bulk-actions-toggle">
                        ⚙️ Bulk Actions
                    </button>
                </div>
            </div>

            <div class="search-and-filters">
                <div class="search-container">
                    <input
                        type="text"
                        class="search-input"
                        placeholder="Search projects..."
                        autocomplete="off"
                    >
                    <button class="search-clear" style="display: none;">✕</button>
                </div>

                <div class="filters-container">
                    <select class="filter-select" data-filter="status">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>

                    <select class="filter-select" data-filter="priority">
                        <option value="">All Priority</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    <select class="sort-select">
                        <option value="updated-desc">Recently Updated</option>
                        <option value="updated-asc">Oldest Updated</option>
                        <option value="created-desc">Recently Created</option>
                        <option value="created-asc">Oldest Created</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                    </select>

                    <button class="btn btn-ghost filter-clear" style="display: none;">
                        Clear Filters
                    </button>
                </div>
            </div>

            <div class="bulk-actions-panel" style="display: none;">
                <div class="bulk-selection">
                    <label>
                        <input type="checkbox" id="select-all"> Select All
                    </label>
                    <span class="selection-count">0 selected</span>
                </div>
                <div class="bulk-operations">
                    <button class="btn btn-secondary" id="bulk-export">Export Selected</button>
                    <button class="btn btn-secondary" id="bulk-archive">Archive Selected</button>
                    <button class="btn btn-danger" id="bulk-delete">Delete Selected</button>
                </div>
            </div>

            <div class="loading-indicator" style="display: none;">
                <div class="spinner"></div>
                <span>Loading projects...</span>
            </div>

            <div class="projects-container" id="projects-list">
                <!-- Projects will be rendered here -->
            </div>

            <div class="pagination-container">
                <!-- Pagination will be rendered here -->
            </div>

            <div class="performance-stats" style="
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                display: none;
            ">
                <div>Render: <span id="render-time">0ms</span></div>
                <div>Memory: <span id="memory-usage">0MB</span></div>
                <div>Cache: <span id="cache-hits">0</span> hits</div>
            </div>
        `;
    }

    setupEventListeners() {
        // Search input with debouncing
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.state.searchQuery = query;

            // Show/hide clear button
            const clearButton = this.container.querySelector('.search-clear');
            clearButton.style.display = query ? 'block' : 'none';

            this.debouncedSearch();
        });

        // Clear search
        this.container.querySelector('.search-clear').addEventListener('click', () => {
            this.searchInput.value = '';
            this.state.searchQuery = '';
            this.container.querySelector('.search-clear').style.display = 'none';
            this.performSearch();
        });

        // Filter selects
        this.container.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', () => {
                this.updateFilters();
                this.applyFiltersAndSort();
            });
        });

        // Sort select
        this.container.querySelector('.sort-select').addEventListener('change', (e) => {
            const [field, direction] = e.target.value.split('-');
            this.state.sortConfig = { field, direction };
            this.applyFiltersAndSort();
        });

        // Clear filters
        this.container.querySelector('.filter-clear').addEventListener('click', () => {
            this.clearFilters();
        });

        // Bulk actions toggle
        this.container.querySelector('#bulk-actions-toggle').addEventListener('click', () => {
            this.toggleBulkActions();
        });

        // Select all
        this.container.querySelector('#select-all').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Virtual scrolling setup
        if (this.options.enableVirtualScrolling) {
            this.projectsContainer.addEventListener('scroll', this.throttledScroll);
        }

        // Intersection observer for lazy loading
        if (this.options.enableLazyLoading) {
            this.setupIntersectionObserver();
        }

        // Memory monitoring
        if (this.options.enablePerformanceTracking) {
            this.memoryMonitor.startMemoryMonitoring(30000); // Every 30 seconds
        }
    }

    setupIntersectionObserver() {
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const projectId = entry.target.dataset.projectId;
                    this.lazyLoadProjectDetails(projectId);
                }
            });
        }, {
            rootMargin: '100px', // Load 100px ahead
            threshold: 0.1
        });
    }

    async loadProjects() {
        this.setLoading(true);

        try {
            const cacheKey = 'all-projects';
            let projects = this.getFromCache(cacheKey);

            if (!projects) {
                // Simulate API call or use actual projectManager
                projects = await this.fetchProjects();
                this.setCache(cacheKey, projects, this.options.cacheTimeout);
            }

            this.state.projects = projects;
            this.applyFiltersAndSort();

        } catch (error) {
            console.error('Failed to load projects:', error);
            this.showError('Failed to load projects. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    async fetchProjects() {
        // Use the actual project manager or simulate
        if (this.projectManager && this.projectManager.getProjects) {
            return this.projectManager.getProjects();
        }

        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate mock projects for demonstration
        return Array.from({ length: 150 }, (_, index) => ({
            id: `project-${index + 1}`,
            name: `Research Project ${index + 1}`,
            description: `Description for project ${index + 1}`,
            status: ['active', 'completed', 'archived'][index % 3],
            priority: ['high', 'medium', 'low'][index % 3],
            created: new Date(Date.now() - Math.random() * 31536000000), // Random within year
            updated: new Date(Date.now() - Math.random() * 7776000000), // Random within 90 days
            tags: [`tag-${(index % 5) + 1}`, `category-${(index % 3) + 1}`],
            author: 'Author Name',
            progress: Math.floor(Math.random() * 101),
            collaborators: Math.floor(Math.random() * 5) + 1
        }));
    }

    performSearch() {
        this.performance?.trackInteraction('search');
        this.applyFiltersAndSort();
    }

    updateFilters() {
        const filters = {};
        this.container.querySelectorAll('.filter-select').forEach(select => {
            if (select.value) {
                filters[select.dataset.filter] = select.value;
            }
        });

        this.state.filters = filters;

        // Show/hide clear filters button
        const hasFilters = Object.keys(filters).length > 0 || this.state.searchQuery;
        this.container.querySelector('.filter-clear').style.display = hasFilters ? 'block' : 'none';
    }

    clearFilters() {
        this.state.filters = {};
        this.state.searchQuery = '';
        this.searchInput.value = '';

        this.container.querySelectorAll('.filter-select').forEach(select => {
            select.value = '';
        });

        this.container.querySelector('.search-clear').style.display = 'none';
        this.container.querySelector('.filter-clear').style.display = 'none';

        this.applyFiltersAndSort();
    }

    applyFiltersAndSort() {
        const startTime = performance.now();

        let filtered = [...this.state.projects];

        // Apply search filter
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            filtered = filtered.filter(project =>
                project.name.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query) ||
                project.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply other filters
        Object.entries(this.state.filters).forEach(([key, value]) => {
            filtered = filtered.filter(project => project[key] === value);
        });

        // Apply sorting
        filtered.sort((a, b) => {
            const { field, direction } = this.state.sortConfig;
            let aVal = a[field];
            let bVal = b[field];

            // Handle date sorting
            if (field === 'created' || field === 'updated') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

            // Handle string sorting
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === 'desc' ? -comparison : comparison;
        });

        this.state.filteredProjects = filtered;
        this.updateCounts();

        // Determine if virtual scrolling should be used
        if (this.options.enableVirtualScrolling &&
            filtered.length > this.options.virtualScrollThreshold) {
            this.enableVirtualScrolling(filtered);
        } else {
            this.renderProjectList(filtered);
        }

        const endTime = performance.now();
        this.updatePerformanceStats({ renderTime: endTime - startTime });

        this.performance?.recordRender(endTime - startTime);
    }

    updateCounts() {
        const totalCount = this.state.projects.length;
        const filteredCount = this.state.filteredProjects.length;
        const isFiltered = filteredCount !== totalCount;

        this.container.querySelector('#total-count').textContent = totalCount;

        const filteredSpan = this.container.querySelector('#filtered-count');
        if (isFiltered) {
            this.container.querySelector('#filtered-number').textContent = filteredCount;
            filteredSpan.style.display = 'inline';
        } else {
            filteredSpan.style.display = 'none';
        }
    }

    enableVirtualScrolling(projects) {
        this.state.virtualScrolling = true;

        if (this.virtualScroller) {
            this.virtualScroller.destroy();
        }

        this.virtualScroller = performanceOptimizer.createVirtualScroller(
            this.projectsContainer,
            projects,
            (project, index) => this.renderProjectItem(project, index),
            this.options.itemHeight
        );

        this.performance?.trackInteraction('virtual_scrolling_enabled');
    }

    renderProjectList(projects) {
        this.state.virtualScrolling = false;

        if (projects.length === 0) {
            this.projectsContainer.innerHTML = this.getEmptyStateHTML();
            return;
        }

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();

        projects.forEach((project, index) => {
            const element = this.renderProjectItem(project, index);
            fragment.appendChild(element);

            // Setup lazy loading
            if (this.options.enableLazyLoading && this.intersectionObserver) {
                this.intersectionObserver.observe(element);
            }
        });

        this.projectsContainer.innerHTML = '';
        this.projectsContainer.appendChild(fragment);
    }

    renderProjectItem(project, index) {
        // Check render cache first
        const cacheKey = `${project.id}-${project.updated}-${this.state.selectedProjects.has(project.id)}`;
        const cachedElement = this.renderCache.get(cacheKey);

        if (cachedElement) {
            return cachedElement.cloneNode(true);
        }

        const element = document.createElement('div');
        element.className = 'project-item';
        element.dataset.projectId = project.id;
        element.style.cssText = `
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            background: white;
            transition: all 0.2s ease;
            cursor: pointer;
            ${this.state.selectedProjects.has(project.id) ? 'background-color: #f0f9ff; border-color: #0ea5e9;' : ''}
        `;

        element.innerHTML = `
            <div class="project-header" style="
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
            ">
                <div class="project-info">
                    <div class="project-selection" style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    ">
                        <input type="checkbox" class="project-checkbox"
                               ${this.state.selectedProjects.has(project.id) ? 'checked' : ''}
                               data-project-id="${project.id}">
                        <h3 class="project-name" style="
                            margin: 0;
                            font-size: 16px;
                            font-weight: 600;
                            color: #1f2937;
                        ">${this.escapeHtml(project.name)}</h3>
                    </div>

                    <p class="project-description" style="
                        margin: 8px 0 0 24px;
                        color: #6b7280;
                        font-size: 14px;
                        line-height: 1.4;
                    ">${this.escapeHtml(project.description)}</p>
                </div>

                <div class="project-status">
                    <span class="status-badge status-${project.status}" style="
                        display: inline-block;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                        ${this.getStatusStyles(project.status)}
                    ">${this.formatStatus(project.status)}</span>
                </div>
            </div>

            <div class="project-meta" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: #9ca3af;
            ">
                <div class="project-details">
                    <span>Priority: ${this.formatPriority(project.priority)}</span>
                    <span style="margin: 0 8px;">•</span>
                    <span>Progress: ${project.progress}%</span>
                    <span style="margin: 0 8px;">•</span>
                    <span>${project.collaborators} collaborator${project.collaborators !== 1 ? 's' : ''}</span>
                </div>

                <div class="project-dates">
                    <span>Updated: ${this.formatDate(project.updated)}</span>
                </div>
            </div>

            <div class="project-progress" style="
                margin-top: 12px;
                background-color: #f3f4f6;
                border-radius: 4px;
                height: 6px;
                overflow: hidden;
            ">
                <div class="progress-fill" style="
                    height: 100%;
                    background-color: ${this.getProgressColor(project.progress)};
                    width: ${project.progress}%;
                    transition: width 0.3s ease;
                "></div>
            </div>

            <div class="project-tags" style="
                margin-top: 12px;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            ">
                ${project.tags.map(tag => `
                    <span class="tag" style="
                        padding: 2px 8px;
                        background-color: #f3f4f6;
                        color: #6b7280;
                        border-radius: 12px;
                        font-size: 11px;
                    ">${this.escapeHtml(tag)}</span>
                `).join('')}
            </div>
        `;

        // Setup event listeners
        this.setupProjectItemEvents(element, project);

        // Cache the rendered element
        this.renderCache.set(cacheKey, element.cloneNode(true));

        // Limit cache size
        if (this.renderCache.size > 100) {
            const firstKey = this.renderCache.keys().next().value;
            this.renderCache.delete(firstKey);
        }

        return element;
    }

    setupProjectItemEvents(element, project) {
        // Checkbox selection
        const checkbox = element.querySelector('.project-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleProjectSelection(project.id, e.target.checked);
        });

        // Click to view/edit project
        element.addEventListener('click', () => {
            this.performance?.trackInteraction('project_click');
            this.options.onProjectSelect?.(project);
        });

        // Hover effects
        element.addEventListener('mouseenter', () => {
            if (!this.state.selectedProjects.has(project.id)) {
                element.style.backgroundColor = '#f9fafb';
            }
        });

        element.addEventListener('mouseleave', () => {
            if (!this.state.selectedProjects.has(project.id)) {
                element.style.backgroundColor = 'white';
            }
        });
    }

    toggleProjectSelection(projectId, selected) {
        if (selected) {
            this.state.selectedProjects.add(projectId);
        } else {
            this.state.selectedProjects.delete(projectId);
        }

        this.updateSelectionUI();
        this.performance?.trackInteraction('project_select');
    }

    toggleSelectAll(selectAll) {
        this.state.selectedProjects.clear();

        if (selectAll) {
            this.state.filteredProjects.forEach(project => {
                this.state.selectedProjects.add(project.id);
            });
        }

        this.updateSelectionUI();
        this.refreshProjectList();
    }

    updateSelectionUI() {
        const selectedCount = this.state.selectedProjects.size;
        const totalCount = this.state.filteredProjects.length;

        // Update selection count
        this.container.querySelector('.selection-count').textContent =
            `${selectedCount} selected`;

        // Update select all checkbox
        const selectAllCheckbox = this.container.querySelector('#select-all');
        selectAllCheckbox.checked = selectedCount === totalCount && totalCount > 0;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;

        // Show/hide bulk actions
        const bulkPanel = this.container.querySelector('.bulk-actions-panel');
        if (selectedCount > 0 && bulkPanel.style.display === 'none') {
            this.showBulkActions();
        }
    }

    toggleBulkActions() {
        const panel = this.container.querySelector('.bulk-actions-panel');
        const isVisible = panel.style.display !== 'none';

        if (isVisible) {
            this.hideBulkActions();
        } else {
            this.showBulkActions();
        }
    }

    showBulkActions() {
        const panel = this.container.querySelector('.bulk-actions-panel');
        panel.style.display = 'flex';

        const button = this.container.querySelector('#bulk-actions-toggle');
        button.textContent = '⚙️ Hide Bulk Actions';
    }

    hideBulkActions() {
        const panel = this.container.querySelector('.bulk-actions-panel');
        panel.style.display = 'none';

        const button = this.container.querySelector('#bulk-actions-toggle');
        button.textContent = '⚙️ Bulk Actions';

        // Clear selections
        this.state.selectedProjects.clear();
        this.refreshProjectList();
    }

    refreshProjectList() {
        // Force re-render without re-applying filters
        if (this.state.virtualScrolling && this.virtualScroller) {
            this.virtualScroller.render();
        } else {
            this.renderProjectList(this.state.filteredProjects);
        }

        this.updateSelectionUI();
    }

    lazyLoadProjectDetails(projectId) {
        // Lazy load additional project details if needed
        const cacheKey = `project-details-${projectId}`;

        if (!this.getFromCache(cacheKey)) {
            // Simulate loading additional details
            setTimeout(() => {
                this.setCache(cacheKey, { loaded: true }, this.options.cacheTimeout);
            }, 100);
        }
    }

    handleScroll() {
        if (this.state.virtualScrolling) return; // Handled by virtual scroller

        // Implement infinite scrolling if needed
        const container = this.projectsContainer;
        const scrollPosition = container.scrollTop + container.clientHeight;
        const scrollHeight = container.scrollHeight;

        if (scrollPosition >= scrollHeight - 100) {
            this.loadMoreProjects();
        }
    }

    async loadMoreProjects() {
        // Implement pagination loading if needed
        if (this.state.isLoading) return;

        // Placeholder for pagination logic
    }

    // Utility methods
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data, ttl = 300000) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl
        });

        // Limit cache size
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    setLoading(loading) {
        this.state.isLoading = loading;
        this.loadingIndicator.style.display = loading ? 'flex' : 'none';
        this.projectsContainer.style.opacity = loading ? '0.5' : '1';
    }

    showError(message) {
        this.projectsContainer.innerHTML = `
            <div class="error-state" style="
                text-align: center;
                padding: 48px 24px;
                color: #ef4444;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3 style="margin: 0 0 8px 0;">Error Loading Projects</h3>
                <p style="margin: 0; color: #6b7280;">${message}</p>
                <button class="btn btn-primary" onclick="this.loadProjects()" style="margin-top: 16px;">
                    Retry
                </button>
            </div>
        `;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state" style="
                text-align: center;
                padding: 48px 24px;
                color: #6b7280;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                <h3 style="margin: 0 0 8px 0; color: #1f2937;">No Projects Found</h3>
                <p style="margin: 0 0 24px 0;">
                    ${this.state.searchQuery || Object.keys(this.state.filters).length > 0
                        ? 'No projects match your current filters.'
                        : 'Get started by creating your first project.'
                    }
                </p>
                ${this.state.searchQuery || Object.keys(this.state.filters).length > 0
                    ? '<button class="btn btn-secondary" onclick="this.clearFilters()">Clear Filters</button>'
                    : '<button class="btn btn-primary" id="create-project">Create Project</button>'
                }
            </div>
        `;
    }

    updatePerformanceStats(stats) {
        if (!this.options.enablePerformanceTracking) return;

        const statsElement = this.container.querySelector('.performance-stats');

        if (stats.renderTime) {
            statsElement.querySelector('#render-time').textContent = `${Math.round(stats.renderTime)}ms`;
        }

        // Update memory usage
        if ('memory' in performance) {
            const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            statsElement.querySelector('#memory-usage').textContent = `${memoryMB}MB`;
        }

        // Update cache hits
        statsElement.querySelector('#cache-hits').textContent = this.renderCache.size;

        // Show stats in development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            statsElement.style.display = 'block';
        }
    }

    // Formatting helpers
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatStatus(status) {
        const statusMap = {
            active: 'Active',
            completed: 'Completed',
            archived: 'Archived'
        };
        return statusMap[status] || status;
    }

    getStatusStyles(status) {
        const styles = {
            active: 'background-color: #dcfce7; color: #15803d;',
            completed: 'background-color: #dbeafe; color: #1d4ed8;',
            archived: 'background-color: #f3f4f6; color: #6b7280;'
        };
        return styles[status] || styles.active;
    }

    formatPriority(priority) {
        const priorityMap = {
            high: '🔴 High',
            medium: '🟡 Medium',
            low: '🟢 Low'
        };
        return priorityMap[priority] || priority;
    }

    getProgressColor(progress) {
        if (progress >= 80) return '#10b981';
        if (progress >= 60) return '#3b82f6';
        if (progress >= 40) return '#f59e0b';
        return '#ef4444';
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Cleanup
    destroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }

        if (this.virtualScroller && this.virtualScroller.destroy) {
            this.virtualScroller.destroy();
        }

        this.cache.clear();
        this.renderCache.clear();

        if (this.performance && this.performance.destroy) {
            this.performance.destroy();
        }

        if (this.memoryMonitor && this.memoryMonitor.destroy) {
            this.memoryMonitor.destroy();
        }
    }
}