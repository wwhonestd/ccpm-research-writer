/**
 * SearchFilter - Standalone search and filtering component
 * Provides real-time search, filtering, and sorting for project lists
 */

export class SearchFilter {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            placeholder: 'Search projects...',
            searchFields: ['title', 'description', 'author', 'tags'],
            showStatusFilter: true,
            showPriorityFilter: true,
            showAuthorFilter: true,
            showTagFilter: true,
            showSorting: true,
            showClearButton: true,
            searchDelay: 200, // ms for debounced search
            onSearch: null,
            onFilter: null,
            onSort: null,
            onClear: null,
            ...options
        };

        this.state = {
            searchQuery: '',
            filters: {
                status: '',
                priority: '',
                author: '',
                tag: ''
            },
            sortBy: 'updated',
            sortOrder: 'desc'
        };

        this.data = {
            projects: [],
            uniqueAuthors: [],
            uniqueTags: []
        };

        this.searchTimeout = null;
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    /**
     * Update the data source for filters
     */
    updateData(projects = []) {
        this.data.projects = projects;
        this.data.uniqueAuthors = [...new Set(projects.map(p => p.author).filter(Boolean))].sort();
        this.data.uniqueTags = [...new Set(projects.flatMap(p => p.tags || []))].sort();
        
        // Re-render filters to update options
        this.renderFilters();
    }

    render() {
        this.container.innerHTML = `
            <div class="search-filter-container">
                ${this.renderSearchSection()}
                ${this.renderFiltersSection()}
                ${this.options.showSorting ? this.renderSortSection() : ''}
                ${this.renderActiveFilters()}
            </div>
        `;
    }

    renderSearchSection() {
        if (!this.options.placeholder) return '';

        return `
            <div class="search-section">
                <div class="search-input-group">
                    <label for="search-input" class="sr-only">Search projects</label>
                    <input 
                        type="search" 
                        id="search-input"
                        class="search-input"
                        placeholder="${this.options.placeholder}"
                        value="${this.state.searchQuery}"
                        aria-label="Search projects by ${this.options.searchFields.join(', ')}"
                    >
                    <div class="search-input-icon" aria-hidden="true">🔍</div>
                    <button 
                        class="search-clear-btn" 
                        aria-label="Clear search"
                        ${!this.state.searchQuery ? 'style="display: none;"' : ''}
                    >
                        ×
                    </button>
                </div>
            </div>
        `;
    }

    renderFiltersSection() {
        const hasFilters = this.options.showStatusFilter || 
                          this.options.showPriorityFilter || 
                          this.options.showAuthorFilter || 
                          this.options.showTagFilter;

        if (!hasFilters) return '';

        return `
            <div class="filters-section">
                <div class="filters-grid">
                    ${this.options.showStatusFilter ? this.renderStatusFilter() : ''}
                    ${this.options.showPriorityFilter ? this.renderPriorityFilter() : ''}
                    ${this.options.showAuthorFilter && this.data.uniqueAuthors.length > 1 ? this.renderAuthorFilter() : ''}
                    ${this.options.showTagFilter && this.data.uniqueTags.length > 0 ? this.renderTagFilter() : ''}
                </div>
                ${this.options.showClearButton ? this.renderClearButton() : ''}
            </div>
        `;
    }

    renderStatusFilter() {
        return `
            <div class="filter-group">
                <label for="status-filter" class="filter-label">Status</label>
                <select id="status-filter" class="filter-select status-filter" aria-label="Filter by status">
                    <option value="">All Statuses</option>
                    <option value="planning" ${this.state.filters.status === 'planning' ? 'selected' : ''}>Planning</option>
                    <option value="active" ${this.state.filters.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="completed" ${this.state.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="archived" ${this.state.filters.status === 'archived' ? 'selected' : ''}>Archived</option>
                </select>
            </div>
        `;
    }

    renderPriorityFilter() {
        return `
            <div class="filter-group">
                <label for="priority-filter" class="filter-label">Priority</label>
                <select id="priority-filter" class="filter-select priority-filter" aria-label="Filter by priority">
                    <option value="">All Priorities</option>
                    <option value="urgent" ${this.state.filters.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                    <option value="high" ${this.state.filters.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${this.state.filters.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${this.state.filters.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
            </div>
        `;
    }

    renderAuthorFilter() {
        return `
            <div class="filter-group">
                <label for="author-filter" class="filter-label">Author</label>
                <select id="author-filter" class="filter-select author-filter" aria-label="Filter by author">
                    <option value="">All Authors</option>
                    ${this.data.uniqueAuthors.map(author => `
                        <option value="${this.escapeHtml(author)}" ${this.state.filters.author === author ? 'selected' : ''}>
                            ${this.escapeHtml(author)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    renderTagFilter() {
        return `
            <div class="filter-group">
                <label for="tag-filter" class="filter-label">Tag</label>
                <select id="tag-filter" class="filter-select tag-filter" aria-label="Filter by tag">
                    <option value="">All Tags</option>
                    ${this.data.uniqueTags.map(tag => `
                        <option value="${this.escapeHtml(tag)}" ${this.state.filters.tag === tag ? 'selected' : ''}>
                            ${this.escapeHtml(tag)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    renderSortSection() {
        return `
            <div class="sort-section">
                <div class="sort-group">
                    <label for="sort-select" class="sort-label">Sort by:</label>
                    <select id="sort-select" class="sort-select" aria-label="Sort projects">
                        <option value="updated:desc" ${this.state.sortBy === 'updated' && this.state.sortOrder === 'desc' ? 'selected' : ''}>
                            Recently Updated
                        </option>
                        <option value="created:desc" ${this.state.sortBy === 'created' && this.state.sortOrder === 'desc' ? 'selected' : ''}>
                            Recently Created
                        </option>
                        <option value="title:asc" ${this.state.sortBy === 'title' && this.state.sortOrder === 'asc' ? 'selected' : ''}>
                            Title (A-Z)
                        </option>
                        <option value="title:desc" ${this.state.sortBy === 'title' && this.state.sortOrder === 'desc' ? 'selected' : ''}>
                            Title (Z-A)
                        </option>
                        <option value="author:asc" ${this.state.sortBy === 'author' && this.state.sortOrder === 'asc' ? 'selected' : ''}>
                            Author (A-Z)
                        </option>
                        <option value="priority:desc" ${this.state.sortBy === 'priority' && this.state.sortOrder === 'desc' ? 'selected' : ''}>
                            Priority (High to Low)
                        </option>
                        <option value="priority:asc" ${this.state.sortBy === 'priority' && this.state.sortOrder === 'asc' ? 'selected' : ''}>
                            Priority (Low to High)
                        </option>
                    </select>
                </div>
            </div>
        `;
    }

    renderActiveFilters() {
        const activeFilters = this.getActiveFilters();
        if (activeFilters.length === 0) return '';

        return `
            <div class="active-filters">
                <span class="active-filters-label">Active filters:</span>
                <div class="active-filter-tags">
                    ${activeFilters.map(filter => `
                        <button 
                            class="filter-tag" 
                            data-filter-type="${filter.type}" 
                            data-filter-value="${this.escapeHtml(filter.value)}"
                            aria-label="Remove ${filter.label} filter"
                        >
                            ${this.escapeHtml(filter.label)}
                            <span class="filter-remove" aria-hidden="true">×</span>
                        </button>
                    `).join('')}
                </div>
                <button class="clear-all-filters-btn" aria-label="Clear all filters">
                    Clear all
                </button>
            </div>
        `;
    }

    renderClearButton() {
        const hasActiveFilters = Object.values(this.state.filters).some(v => v) || this.state.searchQuery;
        if (!hasActiveFilters) return '';

        return `
            <div class="clear-filters-section">
                <button class="btn btn-secondary clear-filters-btn">
                    Clear Filters
                </button>
            </div>
        `;
    }

    renderFilters() {
        const filtersSection = this.container.querySelector('.filters-section');
        if (filtersSection) {
            filtersSection.innerHTML = this.renderFiltersSection().replace(/<div class="filters-section">|<\/div>$/g, '');
        }
    }

    setupEventListeners() {
        // Search input with debouncing
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.state.searchQuery = e.target.value.trim();
                    this.updateSearchClearButton();
                    this.notifySearch();
                    this.updateActiveFilters();
                }, this.options.searchDelay);
            });

            // Handle search on Enter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(this.searchTimeout);
                    this.state.searchQuery = e.target.value.trim();
                    this.updateSearchClearButton();
                    this.notifySearch();
                    this.updateActiveFilters();
                }
            });
        }

        // Search clear button
        const searchClearBtn = this.container.querySelector('.search-clear-btn');
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Filter selects
        const filterSelects = this.container.querySelectorAll('.filter-select');
        filterSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const filterType = this.getFilterType(e.target);
                this.state.filters[filterType] = e.target.value;
                this.notifyFilter();
                this.updateActiveFilters();
            });
        });

        // Sort select
        const sortSelect = this.container.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const [sortBy, sortOrder] = e.target.value.split(':');
                this.state.sortBy = sortBy;
                this.state.sortOrder = sortOrder;
                this.notifySort();
            });
        }

        // Clear filters button
        const clearFiltersBtn = this.container.querySelector('.clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Clear all filters button  
        const clearAllFiltersBtn = this.container.querySelector('.clear-all-filters-btn');
        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Active filter tags removal
        this.container.addEventListener('click', (e) => {
            const filterTag = e.target.closest('.filter-tag');
            if (filterTag) {
                const filterType = filterTag.dataset.filterType;
                const filterValue = filterTag.dataset.filterValue;
                
                if (filterType === 'search') {
                    this.clearSearch();
                } else {
                    this.state.filters[filterType] = '';
                    this.updateFilterSelect(filterType, '');
                    this.notifyFilter();
                    this.updateActiveFilters();
                }
            }
        });
    }

    getFilterType(element) {
        const classList = Array.from(element.classList);
        if (classList.includes('status-filter')) return 'status';
        if (classList.includes('priority-filter')) return 'priority';
        if (classList.includes('author-filter')) return 'author';
        if (classList.includes('tag-filter')) return 'tag';
        return '';
    }

    getActiveFilters() {
        const active = [];

        // Add search filter if active
        if (this.state.searchQuery) {
            active.push({
                type: 'search',
                value: this.state.searchQuery,
                label: `Search: "${this.state.searchQuery}"`
            });
        }

        // Add other filters
        Object.entries(this.state.filters).forEach(([type, value]) => {
            if (value) {
                const label = this.getFilterLabel(type, value);
                active.push({ type, value, label });
            }
        });

        return active;
    }

    getFilterLabel(type, value) {
        const labels = {
            status: {
                planning: 'Status: Planning',
                active: 'Status: Active', 
                completed: 'Status: Completed',
                archived: 'Status: Archived'
            },
            priority: {
                urgent: 'Priority: Urgent',
                high: 'Priority: High',
                medium: 'Priority: Medium',
                low: 'Priority: Low'
            }
        };

        if (labels[type] && labels[type][value]) {
            return labels[type][value];
        }

        return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${value}`;
    }

    updateSearchClearButton() {
        const clearBtn = this.container.querySelector('.search-clear-btn');
        if (clearBtn) {
            clearBtn.style.display = this.state.searchQuery ? 'flex' : 'none';
        }
    }

    updateFilterSelect(filterType, value) {
        const select = this.container.querySelector(`.${filterType}-filter`);
        if (select) {
            select.value = value;
        }
    }

    updateActiveFilters() {
        const activeFiltersContainer = this.container.querySelector('.active-filters');
        const parent = activeFiltersContainer?.parentNode;
        
        if (activeFiltersContainer) {
            activeFiltersContainer.remove();
        }

        if (parent) {
            parent.insertAdjacentHTML('beforeend', this.renderActiveFilters());
        }

        // Re-attach event listeners for new filter tags
        this.setupActiveFilterListeners();
    }

    setupActiveFilterListeners() {
        const filterTags = this.container.querySelectorAll('.filter-tag');
        filterTags.forEach(tag => {
            if (!tag.dataset.listenerAttached) {
                tag.addEventListener('click', (e) => {
                    const filterType = tag.dataset.filterType;
                    const filterValue = tag.dataset.filterValue;
                    
                    if (filterType === 'search') {
                        this.clearSearch();
                    } else {
                        this.state.filters[filterType] = '';
                        this.updateFilterSelect(filterType, '');
                        this.notifyFilter();
                        this.updateActiveFilters();
                    }
                });
                tag.dataset.listenerAttached = 'true';
            }
        });
    }

    clearSearch() {
        this.state.searchQuery = '';
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        this.updateSearchClearButton();
        this.notifySearch();
        this.updateActiveFilters();
    }

    clearAllFilters() {
        // Clear search
        this.state.searchQuery = '';
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        // Clear filters
        Object.keys(this.state.filters).forEach(key => {
            this.state.filters[key] = '';
        });

        // Update UI
        const filterSelects = this.container.querySelectorAll('.filter-select');
        filterSelects.forEach(select => {
            select.value = '';
        });

        this.updateSearchClearButton();
        this.updateActiveFilters();
        this.notifyClear();
    }

    // Public API methods
    getState() {
        return {
            searchQuery: this.state.searchQuery,
            filters: { ...this.state.filters },
            sortBy: this.state.sortBy,
            sortOrder: this.state.sortOrder
        };
    }

    setState(newState) {
        if (newState.searchQuery !== undefined) {
            this.state.searchQuery = newState.searchQuery;
            const searchInput = this.container.querySelector('.search-input');
            if (searchInput) {
                searchInput.value = this.state.searchQuery;
            }
            this.updateSearchClearButton();
        }

        if (newState.filters) {
            Object.assign(this.state.filters, newState.filters);
            // Update filter selects
            Object.entries(newState.filters).forEach(([type, value]) => {
                this.updateFilterSelect(type, value);
            });
        }

        if (newState.sortBy !== undefined) {
            this.state.sortBy = newState.sortBy;
        }

        if (newState.sortOrder !== undefined) {
            this.state.sortOrder = newState.sortOrder;
        }

        if (newState.sortBy !== undefined || newState.sortOrder !== undefined) {
            const sortSelect = this.container.querySelector('.sort-select');
            if (sortSelect) {
                sortSelect.value = `${this.state.sortBy}:${this.state.sortOrder}`;
            }
        }

        this.updateActiveFilters();
    }

    // Event notification methods
    notifySearch() {
        if (this.options.onSearch) {
            this.options.onSearch({
                query: this.state.searchQuery,
                fields: this.options.searchFields
            });
        }
    }

    notifyFilter() {
        if (this.options.onFilter) {
            this.options.onFilter({
                filters: { ...this.state.filters },
                searchQuery: this.state.searchQuery
            });
        }
    }

    notifySort() {
        if (this.options.onSort) {
            this.options.onSort({
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder
            });
        }
    }

    notifyClear() {
        if (this.options.onClear) {
            this.options.onClear();
        }
        
        // Also notify search and filter with cleared state
        this.notifySearch();
        this.notifyFilter();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.container = null;
        this.data = null;
        this.state = null;
    }
}