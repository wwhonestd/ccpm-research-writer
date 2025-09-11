/**
 * TemplateSelector - Template selection and preview component
 * Provides template selection interface with detailed preview and quick start functionality
 */

import { SYSTEM_TEMPLATES, DocumentTemplate, TemplateUtils } from '../../data/document-templates.js';
import { StorageService } from '../../services/StorageService.js';

export class TemplateSelector {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        if (!this.container) {
            throw new Error('TemplateSelector: Container element not found');
        }

        this.options = {
            showPreview: true,
            enableQuickStart: true,
            showWordCountDetails: true,
            showStructurePreview: true,
            maxSuggestedTemplates: 6,
            compact: false, // Compact mode for smaller displays
            ...options
        };

        // Services
        this.storage = new StorageService();

        // State
        this.templates = [];
        this.selectedTemplate = null;
        this.previewMode = 'structure'; // 'structure', 'details', 'outline'

        // Event system
        this.eventListeners = {};

        this.init();
    }

    init() {
        this.loadTemplates();
        this.render();
        this.bindEvents();
        
        // Auto-select first template if available
        if (this.templates.length > 0) {
            this.selectTemplate(this.templates[0].id);
        }
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
        this.templates = [...SYSTEM_TEMPLATES];

        // Load user templates
        try {
            const userTemplates = this.storage.list('templates') || [];
            this.templates.push(...userTemplates.map(data => DocumentTemplate.fromJSON(data)));
        } catch (error) {
            console.error('Failed to load user templates:', error);
        }

        // Sort templates by usage and category
        this.templates.sort((a, b) => {
            // System templates first, then by usage count
            if (a.isSystem !== b.isSystem) {
                return a.isSystem ? -1 : 1;
            }
            return (b.stats.usageCount || 0) - (a.stats.usageCount || 0);
        });
    }

    // Rendering
    render() {
        this.container.className = `template-selector ${this.options.compact ? 'template-selector--compact' : ''}`;
        this.container.innerHTML = this.getHTML();
        
        // Cache DOM elements
        this.elements = {
            sidebar: this.container.querySelector('.template-selector__sidebar'),
            preview: this.container.querySelector('.template-selector__preview'),
            actions: this.container.querySelector('.template-selector__actions')
        };

        this.renderTemplateList();
        if (this.selectedTemplate) {
            this.renderPreview();
        }
    }

    getHTML() {
        return `
            <div class="template-selector__layout">
                <div class="template-selector__sidebar">
                    <div class="template-selector__header">
                        <h3 class="template-selector__title">Choose a Template</h3>
                        <div class="template-selector__subtitle">
                            Select a document template to get started
                        </div>
                    </div>
                    
                    <div class="template-selector__search">
                        <input type="text" 
                               class="template-selector__search-input" 
                               placeholder="Search templates...">
                    </div>

                    <div class="template-selector__categories">
                        <button class="template-selector__category template-selector__category--active" data-category="all">
                            All Templates
                        </button>
                        <button class="template-selector__category" data-category="popular">
                            Most Used
                        </button>
                        <button class="template-selector__category" data-category="academic">
                            Academic
                        </button>
                        <button class="template-selector__category" data-category="business">
                            Business
                        </button>
                        <button class="template-selector__category" data-category="technical">
                            Technical
                        </button>
                    </div>
                    
                    <div class="template-selector__list">
                        <!-- Template list will be rendered here -->
                    </div>
                </div>

                ${this.options.showPreview ? `
                    <div class="template-selector__preview">
                        <!-- Preview will be rendered here -->
                    </div>
                ` : ''}
            </div>

            ${this.options.enableQuickStart ? `
                <div class="template-selector__actions">
                    <button class="template-selector__btn template-selector__btn--secondary" data-action="customize-template">
                        Customize
                    </button>
                    <button class="template-selector__btn template-selector__btn--primary" data-action="use-template">
                        Use This Template
                    </button>
                    <button class="template-selector__btn template-selector__btn--outline" data-action="blank-document">
                        Start Blank
                    </button>
                </div>
            ` : ''}
        `;
    }

    renderTemplateList() {
        const list = this.container.querySelector('.template-selector__list');
        if (!list) return;

        // Get filtered templates based on current category
        const filteredTemplates = this.getFilteredTemplates();

        if (filteredTemplates.length === 0) {
            list.innerHTML = `
                <div class="template-selector__empty">
                    <div class="template-selector__empty-icon">🔍</div>
                    <div class="template-selector__empty-text">No templates found</div>
                </div>
            `;
            return;
        }

        list.innerHTML = filteredTemplates.map(template => this.renderTemplateListItem(template)).join('');
    }

    renderTemplateListItem(template) {
        const categoryIcon = TemplateUtils.getCategoryIcon(template.category);
        const isSelected = this.selectedTemplate && this.selectedTemplate.id === template.id;
        
        return `
            <div class="template-selector__item ${isSelected ? 'template-selector__item--selected' : ''}" 
                 data-template-id="${template.id}">
                <div class="template-selector__item-icon">
                    ${categoryIcon}
                </div>
                
                <div class="template-selector__item-content">
                    <div class="template-selector__item-header">
                        <h4 class="template-selector__item-title">${template.name}</h4>
                        ${template.stats.usageCount > 0 ? `
                            <div class="template-selector__item-badge">
                                ${template.stats.usageCount} uses
                            </div>
                        ` : ''}
                    </div>
                    
                    <p class="template-selector__item-description">
                        ${template.description}
                    </p>
                    
                    <div class="template-selector__item-meta">
                        <span class="template-selector__item-complexity template-selector__item-complexity--${template.config.complexity}">
                            ${template.config.complexity}
                        </span>
                        <span class="template-selector__item-word-count">
                            ${template.config.defaultWordCount.toLocaleString()} words
                        </span>
                        <span class="template-selector__item-time">
                            ${template.config.estimatedTime}
                        </span>
                    </div>
                </div>
                
                <div class="template-selector__item-actions">
                    <button class="template-selector__item-action" 
                            data-action="quick-preview" 
                            data-template-id="${template.id}"
                            title="Quick preview">
                        👁
                    </button>
                </div>
            </div>
        `;
    }

    renderPreview() {
        if (!this.selectedTemplate || !this.elements.preview) return;

        const template = this.selectedTemplate;
        const categoryIcon = TemplateUtils.getCategoryIcon(template.category);
        const complexityColor = TemplateUtils.getComplexityColor(template.config.complexity);
        const readingTime = TemplateUtils.estimateReadingTime(template.config.defaultWordCount);

        this.elements.preview.innerHTML = `
            <div class="template-preview">
                <div class="template-preview__header">
                    <div class="template-preview__icon">${categoryIcon}</div>
                    <div class="template-preview__title-section">
                        <h3 class="template-preview__title">${template.name}</h3>
                        <p class="template-preview__description">${template.description}</p>
                    </div>
                </div>

                <div class="template-preview__tabs">
                    <button class="template-preview__tab ${this.previewMode === 'structure' ? 'template-preview__tab--active' : ''}" 
                            data-preview-mode="structure">
                        Structure
                    </button>
                    <button class="template-preview__tab ${this.previewMode === 'details' ? 'template-preview__tab--active' : ''}" 
                            data-preview-mode="details">
                        Details
                    </button>
                    ${this.options.showStructurePreview ? `
                        <button class="template-preview__tab ${this.previewMode === 'outline' ? 'template-preview__tab--active' : ''}" 
                                data-preview-mode="outline">
                            Outline Preview
                        </button>
                    ` : ''}
                </div>

                <div class="template-preview__content">
                    ${this.renderPreviewContent()}
                </div>

                <div class="template-preview__footer">
                    <div class="template-preview__stats">
                        <div class="template-preview__stat">
                            <span class="template-preview__stat-label">Complexity:</span>
                            <span class="template-preview__stat-value" style="color: ${complexityColor}">
                                ${template.config.complexity}
                            </span>
                        </div>
                        <div class="template-preview__stat">
                            <span class="template-preview__stat-label">Est. Length:</span>
                            <span class="template-preview__stat-value">
                                ${template.config.defaultWordCount.toLocaleString()} words
                            </span>
                        </div>
                        <div class="template-preview__stat">
                            <span class="template-preview__stat-label">Reading Time:</span>
                            <span class="template-preview__stat-value">
                                ${readingTime}
                            </span>
                        </div>
                        <div class="template-preview__stat">
                            <span class="template-preview__stat-label">Est. Writing Time:</span>
                            <span class="template-preview__stat-value">
                                ${template.config.estimatedTime}
                            </span>
                        </div>
                    </div>

                    ${template.tags.length > 0 ? `
                        <div class="template-preview__tags">
                            ${template.tags.map(tag => 
                                `<span class="template-preview__tag">${tag}</span>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPreviewContent() {
        if (!this.selectedTemplate) return '';

        switch (this.previewMode) {
            case 'structure':
                return this.renderStructurePreview();
            case 'details':
                return this.renderDetailsPreview();
            case 'outline':
                return this.renderOutlinePreview();
            default:
                return '';
        }
    }

    renderStructurePreview() {
        const template = this.selectedTemplate;
        
        return `
            <div class="template-structure-preview">
                <div class="template-structure-preview__header">
                    <h4>Document Structure</h4>
                    <div class="template-structure-preview__stats">
                        ${template.structure.length} main sections
                    </div>
                </div>
                
                <div class="template-structure-preview__sections">
                    ${template.structure.map((section, index) => this.renderSectionPreview(section, index, 0)).join('')}
                </div>
            </div>
        `;
    }

    renderSectionPreview(section, index, level) {
        const hasChildren = section.children && section.children.length > 0;
        const indent = level * 20;
        
        return `
            <div class="template-section-preview" style="margin-left: ${indent}px">
                <div class="template-section-preview__header">
                    <div class="template-section-preview__number">
                        ${level === 0 ? (index + 1) : (index + 1)}
                    </div>
                    <div class="template-section-preview__content">
                        <div class="template-section-preview__title">
                            ${section.title}
                            ${section.required ? '<span class="template-section-preview__required">*</span>' : ''}
                        </div>
                        ${section.description ? `
                            <div class="template-section-preview__description">
                                ${section.description}
                            </div>
                        ` : ''}
                        
                        <div class="template-section-preview__meta">
                            ${section.wordAllocation ? `
                                <span class="template-section-preview__words">
                                    ~${section.wordAllocation} words
                                </span>
                            ` : ''}
                            ${section.estimatedTime ? `
                                <span class="template-section-preview__time">
                                    ${section.estimatedTime}
                                </span>
                            ` : ''}
                            ${section.difficulty ? `
                                <span class="template-section-preview__difficulty template-section-preview__difficulty--${section.difficulty}">
                                    ${section.difficulty}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                ${hasChildren ? `
                    <div class="template-section-preview__children">
                        ${section.children.map((child, childIndex) => 
                            this.renderSectionPreview(child, childIndex, level + 1)
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderDetailsPreview() {
        const template = this.selectedTemplate;
        
        return `
            <div class="template-details-preview">
                <div class="template-details-preview__section">
                    <h4>Template Information</h4>
                    <dl class="template-details-preview__list">
                        <dt>Category</dt>
                        <dd>${template.category.charAt(0).toUpperCase() + template.category.slice(1)}</dd>
                        
                        <dt>Type</dt>
                        <dd>${template.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</dd>
                        
                        <dt>Author</dt>
                        <dd>${template.author}</dd>
                        
                        <dt>Version</dt>
                        <dd>${template.version}</dd>
                        
                        ${template.stats.usageCount > 0 ? `
                            <dt>Usage Count</dt>
                            <dd>${template.stats.usageCount} times</dd>
                        ` : ''}
                        
                        ${template.stats.averageRating > 0 ? `
                            <dt>Average Rating</dt>
                            <dd>★ ${template.stats.averageRating.toFixed(1)} (${template.stats.totalRatings} reviews)</dd>
                        ` : ''}
                    </dl>
                </div>

                <div class="template-details-preview__section">
                    <h4>Document Configuration</h4>
                    <dl class="template-details-preview__list">
                        <dt>Suggested Length</dt>
                        <dd>${template.config.suggestedLength}</dd>
                        
                        <dt>Citation Style</dt>
                        <dd>${template.config.citationStyle.toUpperCase()}</dd>
                        
                        <dt>Required Sections</dt>
                        <dd>
                            ${template.config.requiredSections.length > 0 
                                ? template.config.requiredSections.join(', ')
                                : 'None specified'
                            }
                        </dd>
                        
                        ${template.config.optionalSections.length > 0 ? `
                            <dt>Optional Sections</dt>
                            <dd>${template.config.optionalSections.join(', ')}</dd>
                        ` : ''}
                    </dl>
                </div>

                ${template.structure.some(s => s.tips) ? `
                    <div class="template-details-preview__section">
                        <h4>Writing Tips</h4>
                        <ul class="template-details-preview__tips">
                            ${template.structure
                                .filter(s => s.tips && s.tips.length > 0)
                                .slice(0, 5)
                                .map(s => s.tips.map(tip => `<li><strong>${s.title}:</strong> ${tip}</li>`).join(''))
                                .join('')
                            }
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderOutlinePreview() {
        const template = this.selectedTemplate;
        const outlineStructure = template.toOutlineStructure();
        
        return `
            <div class="template-outline-preview">
                <div class="template-outline-preview__header">
                    <h4>Outline Preview</h4>
                    <div class="template-outline-preview__note">
                        This is how your document will be structured when you use this template.
                    </div>
                </div>
                
                <div class="template-outline-preview__tree">
                    ${this.renderOutlineNode(outlineStructure)}
                </div>
                
                <div class="template-outline-preview__footer">
                    <div class="template-outline-preview__legend">
                        <div class="template-outline-preview__legend-item">
                            <span class="template-section-preview__required">*</span> = Required section
                        </div>
                        <div class="template-outline-preview__legend-item">
                            Word counts are suggestions and can be adjusted
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderOutlineNode(node) {
        if (node.level === 0) {
            return node.children.map(child => this.renderOutlineNode(child)).join('');
        }

        const hasChildren = node.children && node.children.length > 0;
        const indent = (node.level - 1) * 20;
        
        return `
            <div class="template-outline-node" style="margin-left: ${indent}px">
                <div class="template-outline-node__content">
                    <span class="template-outline-node__level">${node.level}</span>
                    <span class="template-outline-node__title">${node.title}</span>
                    ${node.metadata?.isRequired ? '<span class="template-section-preview__required">*</span>' : ''}
                    <span class="template-outline-node__words">(${node.allocatedWords} words)</span>
                </div>
                
                ${hasChildren ? `
                    <div class="template-outline-node__children">
                        ${node.children.map(child => this.renderOutlineNode(child)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Event binding
    bindEvents() {
        // Search
        const searchInput = this.container.querySelector('.template-selector__search-input');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchQuery = e.target.value;
                this.renderTemplateList();
            }, 300));
        }

        // Category buttons
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-selector__category')) {
                const category = e.target.dataset.category;
                this.setCategory(category);
            }
        });

        // Template selection
        this.container.addEventListener('click', (e) => {
            const item = e.target.closest('.template-selector__item');
            if (item && !e.target.closest('.template-selector__item-actions')) {
                const templateId = item.dataset.templateId;
                this.selectTemplate(templateId);
            }
        });

        // Preview tabs
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-preview__tab')) {
                const mode = e.target.dataset.previewMode;
                this.setPreviewMode(mode);
            }
        });

        // Actions
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const templateId = e.target.dataset.templateId;
            
            switch (action) {
                case 'use-template':
                    this.useSelectedTemplate();
                    break;
                case 'customize-template':
                    this.customizeSelectedTemplate();
                    break;
                case 'blank-document':
                    this.startBlankDocument();
                    break;
                case 'quick-preview':
                    this.selectTemplate(templateId);
                    break;
            }
        });
    }

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

    // Template operations
    selectTemplate(templateId) {
        const template = this.getTemplateById(templateId);
        if (!template) return;

        this.selectedTemplate = template;
        
        // Update UI
        const items = this.container.querySelectorAll('.template-selector__item');
        items.forEach(item => {
            item.classList.toggle('template-selector__item--selected', 
                item.dataset.templateId === templateId);
        });

        // Update actions button state
        const useButton = this.container.querySelector('[data-action="use-template"]');
        const customizeButton = this.container.querySelector('[data-action="customize-template"]');
        
        if (useButton) useButton.disabled = false;
        if (customizeButton) customizeButton.disabled = false;

        this.renderPreview();
        this.emit('templateSelect', { template });
    }

    setCategory(category) {
        this.currentCategory = category;
        
        // Update UI
        const buttons = this.container.querySelectorAll('.template-selector__category');
        buttons.forEach(btn => {
            btn.classList.toggle('template-selector__category--active', 
                btn.dataset.category === category);
        });

        this.renderTemplateList();
    }

    setPreviewMode(mode) {
        this.previewMode = mode;
        
        // Update tabs
        const tabs = this.container.querySelectorAll('.template-preview__tab');
        tabs.forEach(tab => {
            tab.classList.toggle('template-preview__tab--active', 
                tab.dataset.previewMode === mode);
        });

        this.renderPreview();
    }

    getFilteredTemplates() {
        let filtered = [...this.templates];

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(template => 
                template.name.toLowerCase().includes(query) ||
                template.description.toLowerCase().includes(query) ||
                template.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply category filter
        if (this.currentCategory && this.currentCategory !== 'all') {
            if (this.currentCategory === 'popular') {
                filtered = filtered.filter(template => template.stats.usageCount > 0)
                    .sort((a, b) => b.stats.usageCount - a.stats.usageCount);
            } else {
                filtered = filtered.filter(template => template.category === this.currentCategory);
            }
        }

        return filtered;
    }

    getTemplateById(templateId) {
        return this.templates.find(template => template.id === templateId);
    }

    // Actions
    useSelectedTemplate() {
        if (!this.selectedTemplate) return;

        // Update usage statistics
        this.selectedTemplate.stats.usageCount++;
        if (!this.selectedTemplate.isSystem) {
            try {
                this.storage.update('templates', this.selectedTemplate.id, this.selectedTemplate.toJSON());
            } catch (error) {
                console.error('Failed to update template stats:', error);
            }
        }

        this.emit('templateUse', { template: this.selectedTemplate });
    }

    customizeSelectedTemplate() {
        if (!this.selectedTemplate) return;

        this.emit('templateCustomize', { template: this.selectedTemplate });
    }

    startBlankDocument() {
        this.emit('blankDocument', {});
    }

    // Public API
    setTemplates(templates) {
        this.templates = templates;
        this.renderTemplateList();
        
        if (this.templates.length > 0 && !this.selectedTemplate) {
            this.selectTemplate(this.templates[0].id);
        }
    }

    getSelectedTemplate() {
        return this.selectedTemplate;
    }

    // Cleanup
    destroy() {
        this.eventListeners = {};
        this.container.innerHTML = '';
    }
}