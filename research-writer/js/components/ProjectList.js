/**
 * ProjectList - List, search, filter, and sort projects
 * Handles project display, interaction, and bulk operations
 */

export class ProjectList {
    constructor(container, projectManager, options = {}) {
        this.container = container;
        this.projectManager = projectManager;
        this.options = {
            showSearch: true,
            showFilters: true,
            showSort: true,
            showBulkActions: true,
            itemsPerPage: 20,
            defaultSortBy: 'updated',
            defaultSortOrder: 'desc',
            onProjectSelect: null,
            onProjectEdit: null,
            onProjectDelete: null,
            ...options
        };

        this.currentPage = 1;
        this.searchQuery = '';
        this.filters = {
            status: '',
            priority: '',
            tag: '',
            author: ''
        };
        this.sortBy = this.options.defaultSortBy;
        this.sortOrder = this.options.defaultSortOrder;
        this.selectedProjects = new Set();
        this.projects = [];
        this.filteredProjects = [];

        this.init();
    }

    async init() {
        try {
            await this.loadProjects();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing ProjectList:', error);
            this.renderError(error.message);
        }
    }

    async loadProjects() {
        try {
            this.projects = this.projectManager.getProjects({
                sortBy: this.sortBy,
                sortOrder: this.sortOrder
            });
            this.applyFilters();
        } catch (error) {
            console.error('Error loading projects:', error);
            throw error;
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="project-list-container">
                <!-- List Header -->
                <div class="list-header">
                    <div class="list-title">
                        <h2>Projects</h2>
                        <span class="project-count">${this.filteredProjects.length} projects</span>
                    </div>
                    
                    <div class="list-actions">
                        <button class="btn btn-primary create-project-btn">
                            <span aria-hidden="true">➕</span> New Project
                        </button>
                        <button class="btn btn-secondary import-projects-btn">
                            <span aria-hidden="true">📁</span> Import
                        </button>
                        <button class="btn btn-secondary export-projects-btn">
                            <span aria-hidden="true">📤</span> Export
                        </button>
                    </div>
                </div>

                <!-- Search and Filters -->
                ${this.options.showSearch || this.options.showFilters ? this.renderSearchAndFilters() : ''}

                <!-- Bulk Actions -->
                ${this.options.showBulkActions ? this.renderBulkActions() : ''}

                <!-- Project List -->
                <div class="project-list">
                    ${this.filteredProjects.length > 0 ? this.renderProjects() : this.renderEmptyState()}
                </div>

                <!-- Pagination -->
                ${this.filteredProjects.length > this.options.itemsPerPage ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderSearchAndFilters() {
        const uniqueTags = [...new Set(this.projects.flatMap(p => p.tags || []))].sort();
        const uniqueAuthors = [...new Set(this.projects.map(p => p.author).filter(Boolean))].sort();

        return `
            <div class="search-filters">
                ${this.options.showSearch ? `
                    <div class="search-section">
                        <div class="search-input-group">
                            <input 
                                type="search" 
                                class="search-input"
                                placeholder="Search projects by title, description, or tags..."
                                value="${this.searchQuery}"
                                aria-label="Search projects"
                            >
                            <button class="search-clear-btn" aria-label="Clear search" ${!this.searchQuery ? 'style="display: none;"' : ''}>
                                ×
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                ${this.options.showFilters ? `
                    <div class="filters-section">
                        <div class="filter-group">
                            <select class="filter-select status-filter" aria-label="Filter by status">
                                <option value="">All Statuses</option>
                                <option value="planning" ${this.filters.status === 'planning' ? 'selected' : ''}>Planning</option>
                                <option value="active" ${this.filters.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="completed" ${this.filters.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="archived" ${this.filters.status === 'archived' ? 'selected' : ''}>Archived</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <select class="filter-select priority-filter" aria-label="Filter by priority">
                                <option value="">All Priorities</option>
                                <option value="urgent" ${this.filters.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                                <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>High</option>
                                <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="low" ${this.filters.priority === 'low' ? 'selected' : ''}>Low</option>
                            </select>
                        </div>

                        ${uniqueAuthors.length > 1 ? `
                            <div class="filter-group">
                                <select class="filter-select author-filter" aria-label="Filter by author">
                                    <option value="">All Authors</option>
                                    ${uniqueAuthors.map(author => `
                                        <option value="${author}" ${this.filters.author === author ? 'selected' : ''}>
                                            ${author}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}

                        ${uniqueTags.length > 0 ? `
                            <div class="filter-group">
                                <select class="filter-select tag-filter" aria-label="Filter by tag">
                                    <option value="">All Tags</option>
                                    ${uniqueTags.map(tag => `
                                        <option value="${tag}" ${this.filters.tag === tag ? 'selected' : ''}>
                                            ${tag}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}

                        <button class="btn btn-secondary clear-filters-btn">
                            Clear Filters
                        </button>
                    </div>
                ` : ''}

                ${this.options.showSort ? `
                    <div class="sort-section">
                        <label class="sort-label">Sort by:</label>
                        <select class="sort-select" aria-label="Sort projects">
                            <option value="updated:desc" ${this.sortBy === 'updated' && this.sortOrder === 'desc' ? 'selected' : ''}>
                                Recently Updated
                            </option>
                            <option value="created:desc" ${this.sortBy === 'created' && this.sortOrder === 'desc' ? 'selected' : ''}>
                                Recently Created
                            </option>
                            <option value="title:asc" ${this.sortBy === 'title' && this.sortOrder === 'asc' ? 'selected' : ''}>
                                Title (A-Z)
                            </option>
                            <option value="title:desc" ${this.sortBy === 'title' && this.sortOrder === 'desc' ? 'selected' : ''}>
                                Title (Z-A)
                            </option>
                            <option value="author:asc" ${this.sortBy === 'author' && this.sortOrder === 'asc' ? 'selected' : ''}>
                                Author (A-Z)
                            </option>
                            <option value="priority:asc" ${this.sortBy === 'priority' && this.sortOrder === 'asc' ? 'selected' : ''}>
                                Priority (Low to High)
                            </option>
                            <option value="priority:desc" ${this.sortBy === 'priority' && this.sortOrder === 'desc' ? 'selected' : ''}>
                                Priority (High to Low)
                            </option>
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderBulkActions() {
        const hasSelection = this.selectedProjects.size > 0;
        
        return `
            <div class="bulk-actions ${hasSelection ? 'visible' : ''}">
                <div class="bulk-selection">
                    <input 
                        type="checkbox" 
                        class="bulk-select-all" 
                        aria-label="Select all projects"
                        ${this.selectedProjects.size === this.filteredProjects.length && this.filteredProjects.length > 0 ? 'checked' : ''}
                    >
                    <span class="bulk-count">
                        ${this.selectedProjects.size} selected
                    </span>
                </div>
                
                <div class="bulk-buttons">
                    <button class="btn btn-secondary bulk-export-btn" ${!hasSelection ? 'disabled' : ''}>
                        Export Selected
                    </button>
                    <button class="btn btn-secondary bulk-archive-btn" ${!hasSelection ? 'disabled' : ''}>
                        Archive Selected
                    </button>
                    <button class="btn btn-danger bulk-delete-btn" ${!hasSelection ? 'disabled' : ''}>
                        Delete Selected
                    </button>
                </div>
            </div>
        `;
    }

    renderProjects() {
        const startIndex = (this.currentPage - 1) * this.options.itemsPerPage;
        const endIndex = startIndex + this.options.itemsPerPage;
        const pageProjects = this.filteredProjects.slice(startIndex, endIndex);

        return `
            <div class="projects-grid">
                ${pageProjects.map(project => this.renderProjectCard(project)).join('')}
            </div>
        `;
    }

    renderProjectCard(project) {
        const stats = project.getStats();
        const isSelected = this.selectedProjects.has(project.id);
        const updatedDate = new Date(project.updated).toLocaleDateString();
        const template = project.templateId ? this.projectManager.getTemplate(project.templateId) : null;

        return `
            <div class="project-card ${isSelected ? 'selected' : ''}" data-project-id="${project.id}">
                <div class="card-header">
                    <div class="card-selection">
                        <input 
                            type="checkbox" 
                            class="project-select" 
                            aria-label="Select ${project.title}"
                            ${isSelected ? 'checked' : ''}
                        >
                    </div>
                    
                    <div class="card-title-section">
                        <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                        ${template ? `
                            <span class="template-badge" title="${template.name}">
                                ${template.icon}
                            </span>
                        ` : ''}
                    </div>

                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" aria-label="Edit ${project.title}" title="Edit project">
                            <span aria-hidden="true">✏️</span>
                        </button>
                        <button class="card-action-btn duplicate-btn" aria-label="Duplicate ${project.title}" title="Duplicate project">
                            <span aria-hidden="true">📋</span>
                        </button>
                        <button class="card-action-btn delete-btn" aria-label="Delete ${project.title}" title="Delete project">
                            <span aria-hidden="true">🗑️</span>
                        </button>
                    </div>
                </div>

                <div class="card-body">
                    <div class="project-meta">
                        <div class="meta-item">
                            <span class="meta-label">Author:</span>
                            <span class="meta-value">${this.escapeHtml(project.author)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Updated:</span>
                            <span class="meta-value">${updatedDate}</span>
                        </div>
                    </div>

                    ${project.description ? `
                        <div class="project-description">
                            ${this.escapeHtml(project.description.substring(0, 150))}${project.description.length > 150 ? '...' : ''}
                        </div>
                    ` : ''}

                    <div class="project-status">
                        <span class="status-badge status-${project.status}">
                            ${this.formatStatus(project.status)}
                        </span>
                        <span class="priority-badge priority-${project.priority}">
                            ${this.formatPriority(project.priority)}
                        </span>
                    </div>

                    ${project.tags && project.tags.length > 0 ? `
                        <div class="project-tags">
                            ${project.tags.slice(0, 3).map(tag => `
                                <span class="tag-badge">${this.escapeHtml(tag)}</span>
                            `).join('')}
                            ${project.tags.length > 3 ? `
                                <span class="tag-more">+${project.tags.length - 3} more</span>
                            ` : ''}
                        </div>
                    ` : ''}

                    <div class="project-stats">
                        <div class="stat-item">
                            <span class="stat-icon" aria-hidden="true">📚</span>
                            <span class="stat-value">${stats.totalCitations}</span>
                            <span class="stat-label">Citations</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon" aria-hidden="true">📝</span>
                            <span class="stat-value">${stats.totalNotes}</span>
                            <span class="stat-label">Notes</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon" aria-hidden="true">📄</span>
                            <span class="stat-value">${stats.totalDrafts}</span>
                            <span class="stat-label">Drafts</span>
                        </div>
                        <div class="stat-item completion-stat">
                            <div class="completion-bar">
                                <div class="completion-fill" style="width: ${stats.completionScore}%"></div>
                            </div>
                            <span class="completion-text">${stats.completionScore}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        const hasFilters = this.searchQuery || Object.values(this.filters).some(f => f);
        
        if (hasFilters) {
            return `
                <div class="empty-state">
                    <div class="empty-icon" aria-hidden="true">🔍</div>
                    <h3>No projects match your search</h3>
                    <p>Try adjusting your search terms or filters</p>
                    <button class="btn btn-secondary clear-filters-btn">
                        Clear All Filters
                    </button>
                </div>
            `;
        }

        return `
            <div class="empty-state">
                <div class="empty-icon" aria-hidden="true">📝</div>
                <h3>No projects yet</h3>
                <p>Create your first research project to get started</p>
                <button class="btn btn-primary create-project-btn">
                    Create New Project
                </button>
            </div>
        `;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredProjects.length / this.options.itemsPerPage);
        if (totalPages <= 1) return '';

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        return `
            <div class="pagination">
                <button 
                    class="pagination-btn prev-btn" 
                    ${this.currentPage === 1 ? 'disabled' : ''}
                    aria-label="Previous page"
                >
                    ←
                </button>
                
                ${startPage > 1 ? `
                    <button class="pagination-btn page-btn" data-page="1">1</button>
                    ${startPage > 2 ? '<span class="pagination-ellipsis">...</span>' : ''}
                ` : ''}
                
                ${Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                    const page = startPage + i;
                    return `
                        <button 
                            class="pagination-btn page-btn ${page === this.currentPage ? 'active' : ''}"
                            data-page="${page}"
                        >
                            ${page}
                        </button>
                    `;
                }).join('')}
                
                ${endPage < totalPages ? `
                    ${endPage < totalPages - 1 ? '<span class="pagination-ellipsis">...</span>' : ''}
                    <button class="pagination-btn page-btn" data-page="${totalPages}">${totalPages}</button>
                ` : ''}
                
                <button 
                    class="pagination-btn next-btn" 
                    ${this.currentPage === totalPages ? 'disabled' : ''}
                    aria-label="Next page"
                >
                    →
                </button>
            </div>
        `;
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="project-list-container">
                <div class="error-message">
                    <h3>Error Loading Projects</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary refresh-btn">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Search input
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.currentPage = 1;
                    this.applyFilters();
                    this.updateView();
                }, 300);
            });
        }

        // Search clear button
        const searchClearBtn = this.container.querySelector('.search-clear-btn');
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                this.searchQuery = '';
                const searchInput = this.container.querySelector('.search-input');
                if (searchInput) searchInput.value = '';
                this.applyFilters();
                this.updateView();
            });
        }

        // Filter selects
        const filterSelects = this.container.querySelectorAll('.filter-select');
        filterSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const filterType = e.target.className.split(' ')[1].replace('-filter', '');
                this.filters[filterType] = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
                this.updateView();
            });
        });

        // Clear filters button
        const clearFiltersBtn = this.container.querySelector('.clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Sort select
        const sortSelect = this.container.querySelector('.sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const [sortBy, sortOrder] = e.target.value.split(':');
                this.sortBy = sortBy;
                this.sortOrder = sortOrder;
                this.loadProjects();
                this.updateView();
            });
        }

        // Project cards
        this.container.addEventListener('click', this.handleCardActions.bind(this));

        // Bulk actions
        this.setupBulkActions();

        // Pagination
        this.setupPagination();

        // Action buttons
        this.setupActionButtons();
    }

    setupBulkActions() {
        // Select all checkbox
        const selectAllBtn = this.container.querySelector('.bulk-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.filteredProjects.forEach(project => {
                        this.selectedProjects.add(project.id);
                    });
                } else {
                    this.selectedProjects.clear();
                }
                this.updateView();
            });
        }

        // Bulk action buttons
        const bulkExportBtn = this.container.querySelector('.bulk-export-btn');
        if (bulkExportBtn) {
            bulkExportBtn.addEventListener('click', () => {
                this.handleBulkExport();
            });
        }

        const bulkArchiveBtn = this.container.querySelector('.bulk-archive-btn');
        if (bulkArchiveBtn) {
            bulkArchiveBtn.addEventListener('click', () => {
                this.handleBulkArchive();
            });
        }

        const bulkDeleteBtn = this.container.querySelector('.bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                this.handleBulkDelete();
            });
        }
    }

    setupPagination() {
        // Previous/Next buttons
        const prevBtn = this.container.querySelector('.prev-btn');
        const nextBtn = this.container.querySelector('.next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.updateView();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredProjects.length / this.options.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.updateView();
                }
            });
        }

        // Page number buttons
        const pageButtons = this.container.querySelectorAll('.page-btn');
        pageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentPage = parseInt(e.target.dataset.page);
                this.updateView();
            });
        });
    }

    setupActionButtons() {
        // Create project buttons
        const createBtns = this.container.querySelectorAll('.create-project-btn');
        createBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.options.onProjectCreate) {
                    this.options.onProjectCreate();
                }
            });
        });

        // Import/Export buttons
        const importBtn = this.container.querySelector('.import-projects-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.handleImport();
            });
        }

        const exportBtn = this.container.querySelector('.export-projects-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.handleExport();
            });
        }

        // Refresh button (for error state)
        const refreshBtn = this.container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }
    }

    handleCardActions(event) {
        const projectCard = event.target.closest('.project-card');
        if (!projectCard) return;

        const projectId = projectCard.dataset.projectId;
        const project = this.projects.find(p => p.id === projectId);

        // Project selection checkbox
        if (event.target.classList.contains('project-select')) {
            if (event.target.checked) {
                this.selectedProjects.add(projectId);
            } else {
                this.selectedProjects.delete(projectId);
            }
            this.updateBulkActions();
            return;
        }

        // Action buttons
        if (event.target.closest('.edit-btn')) {
            event.preventDefault();
            if (this.options.onProjectEdit) {
                this.options.onProjectEdit(project);
            }
        } else if (event.target.closest('.duplicate-btn')) {
            event.preventDefault();
            this.handleDuplicate(project);
        } else if (event.target.closest('.delete-btn')) {
            event.preventDefault();
            this.handleDelete(project);
        } else if (!event.target.closest('.card-header')) {
            // Click on card body - select project
            if (this.options.onProjectSelect) {
                this.options.onProjectSelect(project);
            }
        }
    }

    async handleDuplicate(project) {
        try {
            const newTitle = await this.showInputDialog(
                'Duplicate Project',
                'Enter title for duplicated project:',
                `${project.title} (Copy)`
            );
            
            if (!newTitle || newTitle === `${project.title} (Copy)`) return;

            await this.projectManager.duplicateProject(project.id, newTitle.trim());
            await this.refresh();
            this.showNotification('Project duplicated successfully', 'success');
        } catch (error) {
            console.error('Error duplicating project:', error);
            this.showNotification(`Error duplicating project: ${error.message}`, 'error');
        }
    }

    async handleDelete(project) {
        const confirmed = await this.showConfirmDialog(
            'Delete Project',
            `Are you sure you want to delete "${project.title}"?`,
            'This action cannot be undone. All associated data will be permanently removed.',
            'Delete',
            'danger'
        );
        
        if (!confirmed) return;

        try {
            await this.projectManager.deleteProject(project.id);
            await this.refresh();
            this.showNotification(`Project "${project.title}" deleted successfully`, 'success');
            
            if (this.options.onProjectDelete) {
                this.options.onProjectDelete(project);
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showNotification(`Error deleting project: ${error.message}`, 'error');
        }
    }

    async handleBulkExport() {
        try {
            const selectedProjects = this.projects.filter(p => this.selectedProjects.has(p.id));
            const exportData = this.projectManager.exportProjects(selectedProjects, 'json');
            
            this.downloadFile(exportData.data, exportData.filename, 'application/json');
            this.showNotification(`${selectedProjects.length} projects exported successfully`, 'success');
        } catch (error) {
            console.error('Error exporting projects:', error);
            this.showNotification(`Error exporting projects: ${error.message}`, 'error');
        }
    }

    async handleBulkArchive() {
        const count = this.selectedProjects.size;
        const confirmed = await this.showConfirmDialog(
            'Archive Projects',
            `Archive ${count} selected project${count > 1 ? 's' : ''}?`,
            'Archived projects can be restored later from the archived status filter.',
            'Archive',
            'warning'
        );
        
        if (!confirmed) return;

        try {
            const promises = Array.from(this.selectedProjects).map(id => 
                this.projectManager.archiveProject(id)
            );
            
            await Promise.all(promises);
            this.selectedProjects.clear();
            await this.refresh();
            this.showNotification(`${count} project${count > 1 ? 's' : ''} archived successfully`, 'success');
        } catch (error) {
            console.error('Error archiving projects:', error);
            this.showNotification(`Error archiving projects: ${error.message}`, 'error');
        }
    }

    async handleBulkDelete() {
        const count = this.selectedProjects.size;
        const confirmed = await this.showConfirmDialog(
            'Delete Projects',
            `Delete ${count} selected project${count > 1 ? 's' : ''}?`,
            'This action cannot be undone. All associated data will be permanently removed.',
            'Delete',
            'danger'
        );
        
        if (!confirmed) return;

        try {
            const promises = Array.from(this.selectedProjects).map(id => 
                this.projectManager.deleteProject(id)
            );
            
            await Promise.all(promises);
            this.selectedProjects.clear();
            await this.refresh();
            this.showNotification(`${count} project${count > 1 ? 's' : ''} deleted successfully`, 'success');
        } catch (error) {
            console.error('Error deleting projects:', error);
            this.showNotification(`Error deleting projects: ${error.message}`, 'error');
        }
    }

    handleImport() {
        // Create file input for import
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const results = await this.projectManager.importProjects(data);
                
                const message = `Import completed: ${results.imported} imported, ${results.skipped} skipped${results.errors.length > 0 ? `, ${results.errors.length} errors` : ''}`;
                this.showNotification(message, results.errors.length > 0 ? 'warning' : 'success');
                
                if (results.errors.length > 0) {
                    console.error('Import errors:', results.errors);
                }
                
                await this.refresh();
            } catch (error) {
                console.error('Error importing projects:', error);
                this.showNotification(`Error importing projects: ${error.message}`, 'error');
            }
        };
        
        fileInput.click();
    }

    handleExport() {
        try {
            const exportData = this.projectManager.exportProjects(this.filteredProjects, 'json');
            this.downloadFile(exportData.data, exportData.filename, 'application/json');
            this.showNotification(`${this.filteredProjects.length} projects exported successfully`, 'success');
        } catch (error) {
            console.error('Error exporting projects:', error);
            this.showNotification(`Error exporting projects: ${error.message}`, 'error');
        }
    }

    applyFilters() {
        let filtered = [...this.projects];

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(project => 
                project.title.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query) ||
                project.author.toLowerCase().includes(query) ||
                (project.tags && project.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }

        // Status filter
        if (this.filters.status) {
            filtered = filtered.filter(project => project.status === this.filters.status);
        }

        // Priority filter
        if (this.filters.priority) {
            filtered = filtered.filter(project => project.priority === this.filters.priority);
        }

        // Author filter
        if (this.filters.author) {
            filtered = filtered.filter(project => project.author === this.filters.author);
        }

        // Tag filter
        if (this.filters.tag) {
            filtered = filtered.filter(project => 
                project.tags && project.tags.includes(this.filters.tag)
            );
        }

        this.filteredProjects = filtered;
    }

    clearAllFilters() {
        this.searchQuery = '';
        this.filters = {
            status: '',
            priority: '',
            tag: '',
            author: ''
        };
        this.currentPage = 1;
        this.applyFilters();
        this.updateView();
    }

    updateView() {
        this.render();
        this.setupEventListeners();
    }

    updateBulkActions() {
        const bulkActionsElement = this.container.querySelector('.bulk-actions');
        if (bulkActionsElement) {
            const hasSelection = this.selectedProjects.size > 0;
            bulkActionsElement.classList.toggle('visible', hasSelection);
            
            const countElement = bulkActionsElement.querySelector('.bulk-count');
            if (countElement) {
                countElement.textContent = `${this.selectedProjects.size} selected`;
            }
            
            const buttons = bulkActionsElement.querySelectorAll('button:not(.bulk-select-all)');
            buttons.forEach(btn => {
                btn.disabled = !hasSelection;
            });
        }
    }

    downloadFile(data, filename, mimeType) {
        const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], 
            { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async refresh() {
        this.selectedProjects.clear();
        await this.loadProjects();
        this.updateView();
    }

    formatStatus(status) {
        const statusMap = {
            planning: 'Planning',
            active: 'Active',
            completed: 'Completed',
            archived: 'Archived'
        };
        return statusMap[status] || status;
    }

    formatPriority(priority) {
        const priorityMap = {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
            urgent: 'Urgent'
        };
        return priorityMap[priority] || priority;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Modal Dialog Methods
    async showConfirmDialog(title, message, details = '', buttonText = 'Confirm', type = 'primary') {
        return new Promise((resolve) => {
            // Create modal backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            `;

            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                transform: scale(0.9);
                transition: transform 0.2s ease-in-out;
            `;

            const typeColors = {
                danger: '#ef4444',
                warning: '#f59e0b',
                primary: '#3b82f6'
            };

            modal.innerHTML = `
                <div class="modal-header" style="margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937;">${this.escapeHtml(title)}</h3>
                </div>
                <div class="modal-body" style="margin-bottom: 24px;">
                    <p style="margin: 0 0 12px 0; color: #4b5563; line-height: 1.5;">${this.escapeHtml(message)}</p>
                    ${details ? `<p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.4;">${this.escapeHtml(details)}</p>` : ''}
                </div>
                <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="modal-cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #d1d5db;
                        background: white;
                        color: #374151;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.15s ease-in-out;
                    ">Cancel</button>
                    <button class="modal-confirm-btn" style="
                        padding: 8px 16px;
                        border: 1px solid ${typeColors[type] || typeColors.primary};
                        background: ${typeColors[type] || typeColors.primary};
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.15s ease-in-out;
                    ">${this.escapeHtml(buttonText)}</button>
                </div>
            `;

            backdrop.appendChild(modal);

            // Handle button clicks
            const cancelBtn = modal.querySelector('.modal-cancel-btn');
            const confirmBtn = modal.querySelector('.modal-confirm-btn');

            const closeModal = (result) => {
                backdrop.style.opacity = '0';
                modal.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    document.body.removeChild(backdrop);
                    resolve(result);
                }, 200);
            };

            cancelBtn.addEventListener('click', () => closeModal(false));
            confirmBtn.addEventListener('click', () => closeModal(true));
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) closeModal(false);
            });

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    closeModal(false);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Show modal
            document.body.appendChild(backdrop);
            requestAnimationFrame(() => {
                backdrop.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });

            // Focus confirm button
            confirmBtn.focus();
        });
    }

    async showInputDialog(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            // Create modal backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            `;

            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'input-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                transform: scale(0.9);
                transition: transform 0.2s ease-in-out;
            `;

            modal.innerHTML = `
                <div class="modal-header" style="margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937;">${this.escapeHtml(title)}</h3>
                </div>
                <div class="modal-body" style="margin-bottom: 24px;">
                    <p style="margin: 0 0 12px 0; color: #4b5563; line-height: 1.5;">${this.escapeHtml(message)}</p>
                    <input type="text" class="modal-input" value="${this.escapeHtml(defaultValue)}" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 16px;
                        transition: border-color 0.15s ease-in-out;
                    " />
                </div>
                <div class="modal-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="modal-cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #d1d5db;
                        background: white;
                        color: #374151;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: all 0.15s ease-in-out;
                    ">Cancel</button>
                    <button class="modal-confirm-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #3b82f6;
                        background: #3b82f6;
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.15s ease-in-out;
                    ">Confirm</button>
                </div>
            `;

            backdrop.appendChild(modal);

            // Handle button clicks and form submission
            const cancelBtn = modal.querySelector('.modal-cancel-btn');
            const confirmBtn = modal.querySelector('.modal-confirm-btn');
            const input = modal.querySelector('.modal-input');

            const closeModal = (result) => {
                backdrop.style.opacity = '0';
                modal.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    document.body.removeChild(backdrop);
                    resolve(result);
                }, 200);
            };

            const handleSubmit = () => {
                const value = input.value.trim();
                if (value) {
                    closeModal(value);
                }
            };

            cancelBtn.addEventListener('click', () => closeModal(null));
            confirmBtn.addEventListener('click', handleSubmit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                }
            });

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) closeModal(null);
            });

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    closeModal(null);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Show modal
            document.body.appendChild(backdrop);
            requestAnimationFrame(() => {
                backdrop.style.opacity = '1';
                modal.style.transform = 'scale(1)';
                input.focus();
                input.select();
            });
        });
    }

    showNotification(message, type = 'info') {
        // Remove existing notification if present
        const existing = document.querySelector('.project-notification');
        if (existing) {
            existing.remove();
        }

        const typeColors = {
            success: { bg: '#dcfce7', border: '#16a34a', text: '#15803d', icon: '✓' },
            error: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626', icon: '✕' },
            warning: { bg: '#fef3c7', border: '#f59e0b', text: '#d97706', icon: '⚠' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#2563eb', icon: 'ℹ' }
        };

        const colors = typeColors[type] || typeColors.info;

        const notification = document.createElement('div');
        notification.className = 'project-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors.bg};
            border: 1px solid ${colors.border};
            border-left: 4px solid ${colors.border};
            color: ${colors.text};
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            max-width: 400px;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out;
        `;

        notification.innerHTML = `
            <span class="notification-icon" style="font-size: 16px;">${colors.icon}</span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
            <button class="notification-close" style="
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
                opacity: 0.7;
                transition: opacity 0.15s ease-in-out;
            ">&times;</button>
        `;

        // Handle close button
        const closeBtn = notification.querySelector('.notification-close');
        const removeNotification = () => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', removeNotification);

        // Auto-remove after delay
        const autoRemoveDelay = type === 'error' ? 8000 : 5000;
        const autoRemoveTimer = setTimeout(removeNotification, autoRemoveDelay);

        // Cancel auto-remove on hover
        notification.addEventListener('mouseenter', () => clearTimeout(autoRemoveTimer));
        notification.addEventListener('mouseleave', () => setTimeout(removeNotification, 2000));

        // Show notification
        document.body.appendChild(notification);
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
    }

    destroy() {
        this.container = null;
        this.projectManager = null;
        this.selectedProjects.clear();
    }
}