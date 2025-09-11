/**
 * TemplateLibrary - Browse and manage document templates
 * Provides browsing, searching, filtering, and management of templates
 */

import { SYSTEM_TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_TYPES, DocumentTemplate, TemplateUtils } from '../../data/document-templates.js';
import { StorageService } from '../../services/StorageService.js';
import { ImportExportService } from '../../services/ImportExport.js';

export class TemplateLibrary {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        if (!this.container) {
            throw new Error('TemplateLibrary: Container element not found');
        }

        this.options = {
            showSystemTemplates: true,
            showUserTemplates: true,
            enableSearch: true,
            enableFilters: true,
            enableImportExport: true,
            templatesPerPage: 12,
            defaultView: 'grid', // 'grid' or 'list'
            ...options
        };

        // Services
        this.storage = new StorageService();
        this.importExport = new ImportExportService(this.storage);

        // State
        this.templates = [];
        this.filteredTemplates = [];
        this.currentPage = 1;
        this.currentFilter = { category: 'all', complexity: 'all', type: 'all' };
        this.searchQuery = '';
        this.currentView = this.options.defaultView;
        this.selectedTemplate = null;

        // Event system
        this.eventListeners = {};

        this.init();
    }

    init() {
        this.loadTemplates();
        this.render();
        this.bindEvents();
        this.applyFilters();
    }

    // Event system
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.eventListeners[event]) return;
        const index = this.eventListeners[event].indexOf(callback);
        if (index > -1) {
            this.eventListeners[event].splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    // Template loading
    loadTemplates() {
        this.templates = [];

        // Load system templates
        if (this.options.showSystemTemplates) {
            this.templates.push(...SYSTEM_TEMPLATES);
        }

        // Load user templates
        if (this.options.showUserTemplates) {
            try {
                const userTemplates = this.storage.list('templates') || [];
                this.templates.push(...userTemplates.map(data => DocumentTemplate.fromJSON(data)));
            } catch (error) {
                console.error('Failed to load user templates:', error);
            }
        }

        this.filteredTemplates = [...this.templates];
    }

    // Rendering
    render() {
        this.container.className = 'template-library';
        this.container.innerHTML = this.getHTML();
        
        // Cache DOM elements
        this.elements = {
            header: this.container.querySelector('.template-library__header'),
            toolbar: this.container.querySelector('.template-library__toolbar'),
            content: this.container.querySelector('.template-library__content'),
            pagination: this.container.querySelector('.template-library__pagination'),
            stats: this.container.querySelector('.template-library__stats')
        };

        this.updateStats();
        this.renderTemplates();
    }

    getHTML() {
        return `
            <div class="template-library__header">
                <h3 class="template-library__title">Template Library</h3>
                <div class="template-library__actions">
                    <button class="template-library__btn template-library__btn--primary" data-action="create-template">
                        Create Template
                    </button>
                    ${this.options.enableImportExport ? `
                        <button class="template-library__btn template-library__btn--secondary" data-action="import-templates">
                            Import
                        </button>
                        <button class="template-library__btn template-library__btn--secondary" data-action="export-templates">
                            Export
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="template-library__toolbar">
                ${this.options.enableSearch ? `
                    <div class="template-library__search">
                        <input type="text" 
                               class="template-library__search-input" 
                               placeholder="Search templates..."
                               value="${this.searchQuery}">
                        <button class="template-library__search-clear" data-action="clear-search" title="Clear search">×</button>
                    </div>
                ` : ''}

                ${this.options.enableFilters ? `
                    <div class="template-library__filters">
                        <select class="template-library__filter" data-filter="category">
                            <option value="all">All Categories</option>
                            ${Object.entries(TEMPLATE_CATEGORIES).map(([key, value]) => 
                                `<option value="${value}" ${this.currentFilter.category === value ? 'selected' : ''}>
                                    ${key.charAt(0) + key.slice(1).toLowerCase()}
                                </option>`
                            ).join('')}
                        </select>

                        <select class="template-library__filter" data-filter="complexity">
                            <option value="all">All Levels</option>
                            <option value="beginner" ${this.currentFilter.complexity === 'beginner' ? 'selected' : ''}>Beginner</option>
                            <option value="intermediate" ${this.currentFilter.complexity === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                            <option value="advanced" ${this.currentFilter.complexity === 'advanced' ? 'selected' : ''}>Advanced</option>
                        </select>

                        <select class="template-library__filter" data-filter="type">
                            <option value="all">All Types</option>
                            ${Object.entries(TEMPLATE_TYPES).slice(0, 10).map(([key, value]) => 
                                `<option value="${value}" ${this.currentFilter.type === value ? 'selected' : ''}>
                                    ${key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                ` : ''}

                <div class="template-library__view-controls">
                    <button class="template-library__view-btn ${this.currentView === 'grid' ? 'template-library__view-btn--active' : ''}" 
                            data-action="set-view" data-view="grid" title="Grid view">
                        ⊞
                    </button>
                    <button class="template-library__view-btn ${this.currentView === 'list' ? 'template-library__view-btn--active' : ''}" 
                            data-action="set-view" data-view="list" title="List view">
                        ☰
                    </button>
                </div>
            </div>

            <div class="template-library__stats">
                <span class="template-library__stat">
                    Showing <span class="template-library__stat-value" data-stat="showing">0</span> 
                    of <span class="template-library__stat-value" data-stat="total">0</span> templates
                </span>
            </div>

            <div class="template-library__content template-library__content--${this.currentView}">
                <!-- Templates will be rendered here -->
            </div>

            <div class="template-library__pagination">
                <!-- Pagination will be rendered here -->
            </div>
        `;
    }

    renderTemplates() {
        const startIndex = (this.currentPage - 1) * this.options.templatesPerPage;
        const endIndex = startIndex + this.options.templatesPerPage;
        const pageTemplates = this.filteredTemplates.slice(startIndex, endIndex);

        if (pageTemplates.length === 0) {
            this.elements.content.innerHTML = this.renderEmptyState();
            this.elements.pagination.innerHTML = '';
            return;
        }

        this.elements.content.innerHTML = pageTemplates.map(template => 
            this.currentView === 'grid' ? this.renderTemplateCard(template) : this.renderTemplateListItem(template)
        ).join('');

        this.renderPagination();
    }

    renderTemplateCard(template) {
        const validation = template.validate();
        const categoryIcon = TemplateUtils.getCategoryIcon(template.category);
        const complexityColor = TemplateUtils.getComplexityColor(template.config.complexity);
        const readingTime = TemplateUtils.estimateReadingTime(template.config.defaultWordCount);

        return `
            <div class="template-card ${!validation.isValid ? 'template-card--invalid' : ''}" 
                 data-template-id="${template.id}">
                <div class="template-card__header">
                    <div class="template-card__category" title="${template.category}">
                        ${categoryIcon}
                    </div>
                    <div class="template-card__actions">
                        <button class="template-card__action" data-action="preview-template" data-template-id="${template.id}" title="Preview">
                            👁
                        </button>
                        <button class="template-card__action" data-action="use-template" data-template-id="${template.id}" title="Use template">
                            ▶
                        </button>
                        ${!template.isSystem ? `
                            <button class="template-card__action template-card__action--edit" 
                                    data-action="edit-template" data-template-id="${template.id}" title="Edit">
                                ✏
                            </button>
                            <button class="template-card__action template-card__action--delete" 
                                    data-action="delete-template" data-template-id="${template.id}" title="Delete">
                                🗑
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="template-card__content">
                    <h4 class="template-card__title">${template.name}</h4>
                    <p class="template-card__description">${template.description}</p>
                    
                    <div class="template-card__meta">
                        <div class="template-card__complexity" 
                             style="color: ${complexityColor}" 
                             title="Complexity: ${template.config.complexity}">
                            ${template.config.complexity}
                        </div>
                        <div class="template-card__word-count" title="Estimated word count">
                            ${template.config.defaultWordCount.toLocaleString()} words
                        </div>
                        <div class="template-card__reading-time" title="Estimated reading time">
                            ${readingTime}
                        </div>
                    </div>

                    <div class="template-card__tags">
                        ${template.tags.slice(0, 3).map(tag => 
                            `<span class="template-card__tag">${tag}</span>`
                        ).join('')}
                        ${template.tags.length > 3 ? `<span class="template-card__tag template-card__tag--more">+${template.tags.length - 3}</span>` : ''}
                    </div>

                    ${template.stats.usageCount > 0 ? `
                        <div class="template-card__stats">
                            <span class="template-card__stat">Used ${template.stats.usageCount} times</span>
                            ${template.stats.averageRating > 0 ? `
                                <span class="template-card__stat">★ ${template.stats.averageRating.toFixed(1)}</span>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderTemplateListItem(template) {
        const validation = template.validate();
        const categoryIcon = TemplateUtils.getCategoryIcon(template.category);
        const complexityColor = TemplateUtils.getComplexityColor(template.config.complexity);

        return `
            <div class="template-list-item ${!validation.isValid ? 'template-list-item--invalid' : ''}" 
                 data-template-id="${template.id}">
                <div class="template-list-item__icon">
                    ${categoryIcon}
                </div>
                
                <div class="template-list-item__content">
                    <div class="template-list-item__header">
                        <h4 class="template-list-item__title">${template.name}</h4>
                        <div class="template-list-item__meta">
                            <span class="template-list-item__complexity" style="color: ${complexityColor}">
                                ${template.config.complexity}
                            </span>
                            <span class="template-list-item__word-count">
                                ${template.config.defaultWordCount.toLocaleString()} words
                            </span>
                            <span class="template-list-item__author">by ${template.author}</span>
                        </div>
                    </div>
                    
                    <p class="template-list-item__description">${template.description}</p>
                    
                    <div class="template-list-item__tags">
                        ${template.tags.map(tag => 
                            `<span class="template-list-item__tag">${tag}</span>`
                        ).join('')}
                    </div>
                </div>

                <div class="template-list-item__actions">
                    <button class="template-library__btn template-library__btn--small template-library__btn--secondary" 
                            data-action="preview-template" data-template-id="${template.id}">
                        Preview
                    </button>
                    <button class="template-library__btn template-library__btn--small template-library__btn--primary" 
                            data-action="use-template" data-template-id="${template.id}">
                        Use Template
                    </button>
                    ${!template.isSystem ? `
                        <button class="template-library__btn template-library__btn--small" 
                                data-action="edit-template" data-template-id="${template.id}">
                            Edit
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        const hasFilters = this.searchQuery || 
                          this.currentFilter.category !== 'all' || 
                          this.currentFilter.complexity !== 'all' || 
                          this.currentFilter.type !== 'all';

        if (hasFilters) {
            return `
                <div class="template-library__empty">
                    <div class="template-library__empty-icon">🔍</div>
                    <h4 class="template-library__empty-title">No templates found</h4>
                    <p class="template-library__empty-description">
                        Try adjusting your search criteria or filters
                    </p>
                    <button class="template-library__btn template-library__btn--secondary" data-action="clear-all-filters">
                        Clear All Filters
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="template-library__empty">
                    <div class="template-library__empty-icon">📝</div>
                    <h4 class="template-library__empty-title">No templates available</h4>
                    <p class="template-library__empty-description">
                        Create your first template to get started
                    </p>
                    <button class="template-library__btn template-library__btn--primary" data-action="create-template">
                        Create Template
                    </button>
                </div>
            `;
        }
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredTemplates.length / this.options.templatesPerPage);
        
        if (totalPages <= 1) {
            this.elements.pagination.innerHTML = '';
            return;
        }

        const prevDisabled = this.currentPage === 1;
        const nextDisabled = this.currentPage === totalPages;

        let paginationHTML = `
            <div class="template-pagination">
                <button class="template-pagination__btn ${prevDisabled ? 'template-pagination__btn--disabled' : ''}" 
                        data-action="prev-page" ${prevDisabled ? 'disabled' : ''}>
                    Previous
                </button>
                
                <div class="template-pagination__pages">
        `;

        // Show page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `
                <button class="template-pagination__page" data-action="goto-page" data-page="1">1</button>
                ${startPage > 2 ? '<span class="template-pagination__ellipsis">...</span>' : ''}
            `;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="template-pagination__page ${i === this.currentPage ? 'template-pagination__page--active' : ''}" 
                        data-action="goto-page" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            paginationHTML += `
                ${endPage < totalPages - 1 ? '<span class="template-pagination__ellipsis">...</span>' : ''}
                <button class="template-pagination__page" data-action="goto-page" data-page="${totalPages}">${totalPages}</button>
            `;
        }

        paginationHTML += `
                </div>
                
                <button class="template-pagination__btn ${nextDisabled ? 'template-pagination__btn--disabled' : ''}" 
                        data-action="next-page" ${nextDisabled ? 'disabled' : ''}>
                    Next
                </button>
            </div>
        `;

        this.elements.pagination.innerHTML = paginationHTML;
    }

    // Event binding
    bindEvents() {
        // Search input
        const searchInput = this.container.querySelector('.template-library__search-input');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
            }, 300));

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.searchQuery = '';
                    this.applyFilters();
                }
            });
        }

        // Filter dropdowns
        this.container.addEventListener('change', (e) => {
            if (e.target.classList.contains('template-library__filter')) {
                const filterType = e.target.dataset.filter;
                const filterValue = e.target.value;
                this.currentFilter[filterType] = filterValue;
                this.applyFilters();
            }
        });

        // Action buttons
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const templateId = e.target.dataset.templateId;
            
            switch (action) {
                case 'create-template':
                    this.createTemplate();
                    break;
                case 'import-templates':
                    this.showImportDialog();
                    break;
                case 'export-templates':
                    this.showExportDialog();
                    break;
                case 'clear-search':
                    this.clearSearch();
                    break;
                case 'clear-all-filters':
                    this.clearAllFilters();
                    break;
                case 'set-view':
                    this.setView(e.target.dataset.view);
                    break;
                case 'preview-template':
                    this.previewTemplate(templateId);
                    break;
                case 'use-template':
                    this.useTemplate(templateId);
                    break;
                case 'edit-template':
                    this.editTemplate(templateId);
                    break;
                case 'delete-template':
                    this.deleteTemplate(templateId);
                    break;
                case 'prev-page':
                    this.goToPage(this.currentPage - 1);
                    break;
                case 'next-page':
                    this.goToPage(this.currentPage + 1);
                    break;
                case 'goto-page':
                    this.goToPage(parseInt(e.target.dataset.page));
                    break;
            }
        });

        // Template card clicks
        this.container.addEventListener('click', (e) => {
            const card = e.target.closest('.template-card, .template-list-item');
            if (card && !e.target.closest('.template-card__actions, .template-list-item__actions')) {
                const templateId = card.dataset.templateId;
                this.selectTemplate(templateId);
            }
        });
    }

    // Utility methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Filter and search
    applyFilters() {
        this.filteredTemplates = this.templates.filter(template => {
            // Search filter
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                const matchesSearch = 
                    template.name.toLowerCase().includes(query) ||
                    template.description.toLowerCase().includes(query) ||
                    template.tags.some(tag => tag.toLowerCase().includes(query));
                
                if (!matchesSearch) return false;
            }

            // Category filter
            if (this.currentFilter.category !== 'all' && template.category !== this.currentFilter.category) {
                return false;
            }

            // Complexity filter
            if (this.currentFilter.complexity !== 'all' && template.config.complexity !== this.currentFilter.complexity) {
                return false;
            }

            // Type filter
            if (this.currentFilter.type !== 'all' && template.type !== this.currentFilter.type) {
                return false;
            }

            return true;
        });

        this.currentPage = 1; // Reset to first page
        this.updateStats();
        this.renderTemplates();
    }

    clearSearch() {
        const searchInput = this.container.querySelector('.template-library__search-input');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
            this.applyFilters();
        }
    }

    clearAllFilters() {
        this.searchQuery = '';
        this.currentFilter = { category: 'all', complexity: 'all', type: 'all' };
        
        // Reset UI
        const searchInput = this.container.querySelector('.template-library__search-input');
        if (searchInput) searchInput.value = '';
        
        const filters = this.container.querySelectorAll('.template-library__filter');
        filters.forEach(filter => filter.value = 'all');
        
        this.applyFilters();
    }

    setView(view) {
        this.currentView = view;
        this.elements.content.className = `template-library__content template-library__content--${view}`;
        
        // Update view buttons
        const viewButtons = this.container.querySelectorAll('.template-library__view-btn');
        viewButtons.forEach(btn => {
            btn.classList.toggle('template-library__view-btn--active', btn.dataset.view === view);
        });
        
        this.renderTemplates();
    }

    updateStats() {
        const showingCount = Math.min(this.options.templatesPerPage, this.filteredTemplates.length);
        const totalCount = this.filteredTemplates.length;
        
        const showingStat = this.container.querySelector('[data-stat="showing"]');
        const totalStat = this.container.querySelector('[data-stat="total"]');
        
        if (showingStat) showingStat.textContent = showingCount;
        if (totalStat) totalStat.textContent = totalCount;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredTemplates.length / this.options.templatesPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderTemplates();
        this.updateStats();
    }

    // Template operations
    selectTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template) return;

        this.selectedTemplate = template;
        
        // Update UI
        const cards = this.container.querySelectorAll('.template-card, .template-list-item');
        cards.forEach(card => {
            card.classList.toggle('template-card--selected', card.dataset.templateId === templateId);
            card.classList.toggle('template-list-item--selected', card.dataset.templateId === templateId);
        });

        this.emit('templateSelect', { template });
    }

    previewTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template) return;

        this.emit('templatePreview', { template });
    }

    useTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template) return;

        // Update usage statistics
        template.stats.usageCount++;
        if (!template.isSystem) {
            this.saveUserTemplate(template);
        }

        this.emit('templateUse', { template });
    }

    editTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template || template.isSystem) return;

        this.emit('templateEdit', { template });
    }

    deleteTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template || template.isSystem) return;

        if (confirm(`Delete template "${template.name}"? This action cannot be undone.`)) {
            try {
                this.storage.delete('templates', templateId);
                this.loadTemplates();
                this.applyFilters();
                this.emit('templateDelete', { template });
            } catch (error) {
                console.error('Failed to delete template:', error);
                alert('Failed to delete template. Please try again.');
            }
        }
    }

    createTemplate() {
        this.emit('templateCreate', {});
    }

    // Template management
    getTemplateById(templateId) {
        return this.templates.find(template => template.id === templateId);
    }

    addTemplate(templateData) {
        try {
            const template = templateData instanceof DocumentTemplate 
                ? templateData 
                : new DocumentTemplate(templateData);

            const validation = template.validate();
            if (!validation.isValid) {
                throw new Error('Invalid template: ' + validation.errors.join(', '));
            }

            this.storage.create('templates', template.toJSON());
            this.loadTemplates();
            this.applyFilters();
            this.emit('templateAdd', { template });
            return template;
        } catch (error) {
            console.error('Failed to add template:', error);
            throw error;
        }
    }

    updateTemplate(templateId, updates) {
        try {
            const template = this.getTemplateById(templateId);
            if (!template || template.isSystem) {
                throw new Error('Cannot update system template');
            }

            Object.assign(template, updates);
            template.updated = new Date().toISOString();

            const validation = template.validate();
            if (!validation.isValid) {
                throw new Error('Invalid template: ' + validation.errors.join(', '));
            }

            this.storage.update('templates', templateId, template.toJSON());
            this.loadTemplates();
            this.applyFilters();
            this.emit('templateUpdate', { template });
            return template;
        } catch (error) {
            console.error('Failed to update template:', error);
            throw error;
        }
    }

    saveUserTemplate(template) {
        if (template.isSystem) return;
        
        try {
            this.storage.update('templates', template.id, template.toJSON());
        } catch (error) {
            console.error('Failed to save template stats:', error);
        }
    }

    // Import/Export
    showImportDialog() {
        const input = document.createElement('textarea');
        input.placeholder = 'Paste template JSON data here...';
        input.style.width = '100%';
        input.style.height = '200px';
        input.style.margin = '10px 0';

        const dialog = this.createDialog('Import Templates', [
            { type: 'element', element: input },
            { type: 'button', text: 'Import', primary: true, action: () => {
                this.importTemplates(input.value);
                this.closeDialog(dialog);
            }},
            { type: 'button', text: 'Cancel', action: () => this.closeDialog(dialog) }
        ]);
    }

    importTemplates(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const templates = Array.isArray(data) ? data : [data];
            let imported = 0;

            templates.forEach(templateData => {
                try {
                    const template = new DocumentTemplate({
                        ...templateData,
                        isSystem: false,
                        author: 'Imported',
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        id: undefined // Generate new ID
                    });
                    
                    this.addTemplate(template);
                    imported++;
                } catch (error) {
                    console.warn('Failed to import template:', error);
                }
            });

            alert(`Successfully imported ${imported} template(s)`);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import templates. Please check the JSON format.');
        }
    }

    showExportDialog() {
        const userTemplates = this.templates.filter(t => !t.isSystem);
        
        if (userTemplates.length === 0) {
            alert('No user templates to export');
            return;
        }

        const output = document.createElement('textarea');
        output.style.width = '100%';
        output.style.height = '300px';
        output.style.margin = '10px 0';
        output.readOnly = true;
        output.value = JSON.stringify(userTemplates.map(t => t.toJSON()), null, 2);

        const dialog = this.createDialog('Export Templates', [
            { type: 'label', text: `Exporting ${userTemplates.length} template(s):` },
            { type: 'element', element: output },
            { type: 'button', text: 'Copy to Clipboard', primary: true, action: () => {
                output.select();
                document.execCommand('copy');
                alert('Templates copied to clipboard!');
            }},
            { type: 'button', text: 'Close', action: () => this.closeDialog(dialog) }
        ]);
    }

    // Dialog helpers (reused from OutlineBuilder)
    createDialog(title, elements) {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.style.cssText = `
            background: white; border-radius: 8px; padding: 20px;
            max-width: 500px; width: 90%; max-height: 80vh; overflow: auto;
        `;

        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.marginTop = '0';
        dialog.appendChild(titleElement);

        elements.forEach(element => {
            if (element.type === 'element') {
                dialog.appendChild(element.element);
            } else if (element.type === 'button') {
                const button = document.createElement('button');
                button.textContent = element.text;
                button.className = element.primary ? 'template-library__btn template-library__btn--primary' : 'template-library__btn template-library__btn--secondary';
                button.style.marginRight = '8px';
                button.addEventListener('click', element.action);
                dialog.appendChild(button);
            } else if (element.type === 'label') {
                const label = document.createElement('label');
                label.textContent = element.text;
                label.style.display = 'block';
                label.style.margin = '10px 0 5px 0';
                dialog.appendChild(label);
            }
        });

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeDialog(overlay);
            }
        });

        return overlay;
    }

    closeDialog(dialog) {
        if (dialog.parentNode) {
            document.body.removeChild(dialog);
        }
    }

    // Cleanup
    destroy() {
        this.eventListeners = {};
        this.container.innerHTML = '';
    }
}