/**
 * TemplateCustomizer - Template creation and editing component
 * Allows users to create custom templates and modify existing ones
 */

import { DocumentTemplate, TEMPLATE_CATEGORIES, TEMPLATE_TYPES, TemplateUtils } from '../../data/document-templates.js';
import { StorageService } from '../../services/StorageService.js';
import { ImportExportService } from '../../services/ImportExport.js';

export class TemplateCustomizer {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        if (!this.container) {
            throw new Error('TemplateCustomizer: Container element not found');
        }

        this.options = {
            enableAdvancedOptions: true,
            showPreview: true,
            enableImportExport: true,
            maxStructureDepth: 5,
            enableValidation: true,
            autoSave: true,
            autoSaveDelay: 2000,
            ...options
        };

        // Services
        this.storage = new StorageService();
        this.importExport = new ImportExportService(this.storage);

        // State
        this.template = null;
        this.isEditing = false;
        this.currentMode = 'basic'; // 'basic', 'structure', 'config', 'preview'
        this.hasUnsavedChanges = false;
        this.validationErrors = [];
        this.autoSaveTimeout = null;

        // Event system
        this.eventListeners = {};

        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
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

    // Template operations
    createNew() {
        this.template = new DocumentTemplate({
            name: 'New Template',
            description: 'A custom document template',
            category: TEMPLATE_CATEGORIES.CUSTOM,
            type: TEMPLATE_TYPES.CUSTOM,
            tags: [],
            structure: [
                {
                    title: 'Introduction',
                    description: 'Opening section of the document',
                    wordAllocation: 500,
                    required: true
                },
                {
                    title: 'Main Content',
                    description: 'Primary content section',
                    wordAllocation: 1000,
                    required: true
                },
                {
                    title: 'Conclusion',
                    description: 'Concluding section',
                    wordAllocation: 300,
                    required: true
                }
            ],
            config: {
                defaultWordCount: 1800,
                suggestedLength: 'short',
                estimatedTime: '2-3 hours',
                complexity: 'beginner',
                citationStyle: 'apa'
            }
        });

        this.isEditing = false;
        this.hasUnsavedChanges = true;
        this.render();
        this.emit('templateCreate', { template: this.template });
    }

    editTemplate(template) {
        if (template.isSystem) {
            // Create a copy for editing
            this.template = template.clone(`${template.name} (Custom)`);
            this.isEditing = false;
        } else {
            this.template = template;
            this.isEditing = true;
        }

        this.hasUnsavedChanges = false;
        this.render();
        this.emit('templateEdit', { template: this.template });
    }

    // Rendering
    render() {
        this.container.className = 'template-customizer';
        this.container.innerHTML = this.getHTML();
        
        // Cache DOM elements
        this.elements = {
            header: this.container.querySelector('.template-customizer__header'),
            tabs: this.container.querySelector('.template-customizer__tabs'),
            content: this.container.querySelector('.template-customizer__content'),
            actions: this.container.querySelector('.template-customizer__actions'),
            validation: this.container.querySelector('.template-customizer__validation')
        };

        this.renderCurrentMode();
        this.validateTemplate();
        this.updateSaveStatus();
    }

    getHTML() {
        const template = this.template;
        const hasTemplate = template !== null;

        return `
            <div class="template-customizer__header">
                <div class="template-customizer__title-section">
                    <h3 class="template-customizer__title">
                        ${hasTemplate ? (this.isEditing ? 'Edit Template' : 'Create Template') : 'Template Customizer'}
                    </h3>
                    ${hasTemplate ? `
                        <div class="template-customizer__subtitle">
                            ${template.name}
                            ${this.hasUnsavedChanges ? ' (unsaved changes)' : ''}
                        </div>
                    ` : ''}
                </div>
                
                <div class="template-customizer__header-actions">
                    ${!hasTemplate ? `
                        <button class="template-customizer__btn template-customizer__btn--primary" data-action="create-new">
                            Create New Template
                        </button>
                    ` : ''}
                    ${this.options.enableImportExport ? `
                        <button class="template-customizer__btn template-customizer__btn--secondary" data-action="import-template">
                            Import Template
                        </button>
                    ` : ''}
                </div>
            </div>

            ${hasTemplate ? `
                <div class="template-customizer__tabs">
                    <button class="template-customizer__tab ${this.currentMode === 'basic' ? 'template-customizer__tab--active' : ''}" 
                            data-mode="basic">
                        Basic Info
                    </button>
                    <button class="template-customizer__tab ${this.currentMode === 'structure' ? 'template-customizer__tab--active' : ''}" 
                            data-mode="structure">
                        Structure
                    </button>
                    <button class="template-customizer__tab ${this.currentMode === 'config' ? 'template-customizer__tab--active' : ''}" 
                            data-mode="config">
                        Configuration
                    </button>
                    ${this.options.showPreview ? `
                        <button class="template-customizer__tab ${this.currentMode === 'preview' ? 'template-customizer__tab--active' : ''}" 
                                data-mode="preview">
                            Preview
                        </button>
                    ` : ''}
                </div>

                <div class="template-customizer__validation">
                    <!-- Validation messages will be rendered here -->
                </div>

                <div class="template-customizer__content">
                    <!-- Content will be rendered based on current mode -->
                </div>

                <div class="template-customizer__actions">
                    <button class="template-customizer__btn template-customizer__btn--secondary" data-action="cancel">
                        Cancel
                    </button>
                    ${this.options.enableImportExport ? `
                        <button class="template-customizer__btn template-customizer__btn--secondary" data-action="export-template">
                            Export
                        </button>
                    ` : ''}
                    <button class="template-customizer__btn template-customizer__btn--primary" data-action="save" ${this.validationErrors.length > 0 ? 'disabled' : ''}>
                        ${this.isEditing ? 'Update Template' : 'Save Template'}
                    </button>
                </div>
            ` : `
                <div class="template-customizer__empty">
                    <div class="template-customizer__empty-icon">📝</div>
                    <h4 class="template-customizer__empty-title">Create a Custom Template</h4>
                    <p class="template-customizer__empty-description">
                        Design your own document template with custom structure, sections, and configuration.
                    </p>
                    <button class="template-customizer__btn template-customizer__btn--primary" data-action="create-new">
                        Get Started
                    </button>
                </div>
            `}
        `;
    }

    renderCurrentMode() {
        if (!this.template || !this.elements.content) return;

        switch (this.currentMode) {
            case 'basic':
                this.renderBasicInfo();
                break;
            case 'structure':
                this.renderStructureEditor();
                break;
            case 'config':
                this.renderConfiguration();
                break;
            case 'preview':
                this.renderPreview();
                break;
        }
    }

    renderBasicInfo() {
        const template = this.template;
        
        this.elements.content.innerHTML = `
            <form class="template-form">
                <div class="template-form__section">
                    <h4 class="template-form__section-title">Template Information</h4>
                    
                    <div class="template-form__row">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-name">
                                Template Name *
                            </label>
                            <input type="text" 
                                   id="template-name" 
                                   class="template-form__input" 
                                   value="${template.name}" 
                                   placeholder="Enter template name"
                                   data-field="name"
                                   required>
                        </div>
                    </div>

                    <div class="template-form__row">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-description">
                                Description *
                            </label>
                            <textarea id="template-description" 
                                      class="template-form__textarea" 
                                      placeholder="Describe what this template is for"
                                      data-field="description"
                                      rows="3"
                                      required>${template.description}</textarea>
                        </div>
                    </div>

                    <div class="template-form__row template-form__row--two-column">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-category">
                                Category *
                            </label>
                            <select id="template-category" 
                                    class="template-form__select" 
                                    data-field="category"
                                    required>
                                ${Object.entries(TEMPLATE_CATEGORIES).map(([key, value]) => 
                                    `<option value="${value}" ${template.category === value ? 'selected' : ''}>
                                        ${key.charAt(0) + key.slice(1).toLowerCase()}
                                    </option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="template-form__field">
                            <label class="template-form__label" for="template-type">
                                Type *
                            </label>
                            <select id="template-type" 
                                    class="template-form__select" 
                                    data-field="type"
                                    required>
                                ${Object.entries(TEMPLATE_TYPES).map(([key, value]) => 
                                    `<option value="${value}" ${template.type === value ? 'selected' : ''}>
                                        ${key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
                                    </option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="template-form__row">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-tags">
                                Tags
                            </label>
                            <input type="text" 
                                   id="template-tags" 
                                   class="template-form__input" 
                                   value="${template.tags.join(', ')}" 
                                   placeholder="Enter tags separated by commas"
                                   data-field="tags">
                            <div class="template-form__help">
                                Separate multiple tags with commas (e.g., academic, research, thesis)
                            </div>
                        </div>
                    </div>
                </div>

                <div class="template-form__section">
                    <h4 class="template-form__section-title">Template Settings</h4>
                    
                    <div class="template-form__row template-form__row--three-column">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-complexity">
                                Complexity Level
                            </label>
                            <select id="template-complexity" 
                                    class="template-form__select" 
                                    data-field="config.complexity">
                                <option value="beginner" ${template.config.complexity === 'beginner' ? 'selected' : ''}>Beginner</option>
                                <option value="intermediate" ${template.config.complexity === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                                <option value="advanced" ${template.config.complexity === 'advanced' ? 'selected' : ''}>Advanced</option>
                                <option value="expert" ${template.config.complexity === 'expert' ? 'selected' : ''}>Expert</option>
                            </select>
                        </div>

                        <div class="template-form__field">
                            <label class="template-form__label" for="template-word-count">
                                Default Word Count
                            </label>
                            <input type="number" 
                                   id="template-word-count" 
                                   class="template-form__input" 
                                   value="${template.config.defaultWordCount}" 
                                   min="100" 
                                   max="100000"
                                   data-field="config.defaultWordCount">
                        </div>

                        <div class="template-form__field">
                            <label class="template-form__label" for="template-time">
                                Estimated Time
                            </label>
                            <input type="text" 
                                   id="template-time" 
                                   class="template-form__input" 
                                   value="${template.config.estimatedTime}" 
                                   placeholder="e.g., 2-3 hours"
                                   data-field="config.estimatedTime">
                        </div>
                    </div>

                    <div class="template-form__row template-form__row--two-column">
                        <div class="template-form__field">
                            <label class="template-form__label" for="template-length">
                                Suggested Length
                            </label>
                            <select id="template-length" 
                                    class="template-form__select" 
                                    data-field="config.suggestedLength">
                                <option value="short" ${template.config.suggestedLength === 'short' ? 'selected' : ''}>Short</option>
                                <option value="medium" ${template.config.suggestedLength === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="long" ${template.config.suggestedLength === 'long' ? 'selected' : ''}>Long</option>
                                <option value="very-long" ${template.config.suggestedLength === 'very-long' ? 'selected' : ''}>Very Long</option>
                            </select>
                        </div>

                        <div class="template-form__field">
                            <label class="template-form__label" for="template-citation">
                                Citation Style
                            </label>
                            <select id="template-citation" 
                                    class="template-form__select" 
                                    data-field="config.citationStyle">
                                <option value="apa" ${template.config.citationStyle === 'apa' ? 'selected' : ''}>APA</option>
                                <option value="mla" ${template.config.citationStyle === 'mla' ? 'selected' : ''}>MLA</option>
                                <option value="chicago" ${template.config.citationStyle === 'chicago' ? 'selected' : ''}>Chicago</option>
                                <option value="harvard" ${template.config.citationStyle === 'harvard' ? 'selected' : ''}>Harvard</option>
                                <option value="ieee" ${template.config.citationStyle === 'ieee' ? 'selected' : ''}>IEEE</option>
                                <option value="informal" ${template.config.citationStyle === 'informal' ? 'selected' : ''}>Informal</option>
                            </select>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    renderStructureEditor() {
        const template = this.template;
        
        this.elements.content.innerHTML = `
            <div class="structure-editor">
                <div class="structure-editor__header">
                    <h4 class="structure-editor__title">Document Structure</h4>
                    <div class="structure-editor__actions">
                        <button class="template-customizer__btn template-customizer__btn--small template-customizer__btn--primary" 
                                data-action="add-section">
                            Add Section
                        </button>
                        <button class="template-customizer__btn template-customizer__btn--small template-customizer__btn--secondary" 
                                data-action="import-structure">
                            Import from Outline
                        </button>
                    </div>
                </div>

                <div class="structure-editor__help">
                    <p>Design the structure of your document by adding sections and subsections. 
                    Each section can have a description, word allocation, and be marked as required.</p>
                </div>

                <div class="structure-editor__list">
                    ${template.structure.map((section, index) => this.renderSectionEditor(section, index, 0)).join('')}
                </div>

                <div class="structure-editor__stats">
                    <div class="structure-editor__stat">
                        <span class="structure-editor__stat-label">Total Sections:</span>
                        <span class="structure-editor__stat-value">${this.countTotalSections(template.structure)}</span>
                    </div>
                    <div class="structure-editor__stat">
                        <span class="structure-editor__stat-label">Total Word Allocation:</span>
                        <span class="structure-editor__stat-value">${this.calculateTotalWords(template.structure)}</span>
                    </div>
                    <div class="structure-editor__stat">
                        <span class="structure-editor__stat-label">Word Count Match:</span>
                        <span class="structure-editor__stat-value ${this.calculateTotalWords(template.structure) === template.config.defaultWordCount ? 'structure-editor__stat-value--success' : 'structure-editor__stat-value--warning'}">
                            ${this.calculateTotalWords(template.structure) === template.config.defaultWordCount ? '✓' : '⚠'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    renderSectionEditor(section, index, level) {
        const indent = level * 30;
        const hasChildren = section.children && section.children.length > 0;
        
        return `
            <div class="section-editor" style="margin-left: ${indent}px" data-section-index="${index}" data-section-level="${level}">
                <div class="section-editor__content">
                    <div class="section-editor__handle">
                        ⋮⋮
                    </div>
                    
                    <div class="section-editor__main">
                        <div class="section-editor__header">
                            <input type="text" 
                                   class="section-editor__title" 
                                   value="${section.title}" 
                                   placeholder="Section title"
                                   data-field="title">
                            <div class="section-editor__controls">
                                <label class="section-editor__checkbox">
                                    <input type="checkbox" ${section.required ? 'checked' : ''} data-field="required">
                                    Required
                                </label>
                                <button class="section-editor__action" data-action="add-subsection" title="Add subsection">+</button>
                                <button class="section-editor__action section-editor__action--danger" data-action="remove-section" title="Remove section">×</button>
                            </div>
                        </div>
                        
                        <div class="section-editor__details">
                            <textarea class="section-editor__description" 
                                      placeholder="Section description (optional)"
                                      rows="2"
                                      data-field="description">${section.description || ''}</textarea>
                            
                            <div class="section-editor__meta">
                                <div class="section-editor__field">
                                    <label>Words:</label>
                                    <input type="number" 
                                           class="section-editor__input" 
                                           value="${section.wordAllocation || 0}" 
                                           min="0" 
                                           max="10000"
                                           data-field="wordAllocation">
                                </div>
                                
                                <div class="section-editor__field">
                                    <label>Time:</label>
                                    <input type="text" 
                                           class="section-editor__input" 
                                           value="${section.estimatedTime || ''}" 
                                           placeholder="e.g., 30 min"
                                           data-field="estimatedTime">
                                </div>
                                
                                <div class="section-editor__field">
                                    <label>Difficulty:</label>
                                    <select class="section-editor__select" data-field="difficulty">
                                        <option value="">Not set</option>
                                        <option value="easy" ${section.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                                        <option value="medium" ${section.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                                        <option value="hard" ${section.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${hasChildren ? `
                    <div class="section-editor__children">
                        ${section.children.map((child, childIndex) => 
                            this.renderSectionEditor(child, childIndex, level + 1)
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderConfiguration() {
        const template = this.template;
        
        this.elements.content.innerHTML = `
            <div class="config-editor">
                <div class="config-editor__section">
                    <h4 class="config-editor__title">Document Requirements</h4>
                    
                    <div class="config-editor__field">
                        <label class="config-editor__label">Required Sections</label>
                        <div class="config-editor__help">
                            Sections that must be included in documents using this template
                        </div>
                        <div class="config-editor__tags">
                            <div class="tag-input" data-field="config.requiredSections">
                                ${(template.config.requiredSections || []).map(section => 
                                    `<span class="tag-input__tag">
                                        ${section}
                                        <button type="button" class="tag-input__remove">×</button>
                                    </span>`
                                ).join('')}
                                <input type="text" class="tag-input__input" placeholder="Add required section...">
                            </div>
                        </div>
                    </div>

                    <div class="config-editor__field">
                        <label class="config-editor__label">Optional Sections</label>
                        <div class="config-editor__help">
                            Sections that can be included but are not required
                        </div>
                        <div class="config-editor__tags">
                            <div class="tag-input" data-field="config.optionalSections">
                                ${(template.config.optionalSections || []).map(section => 
                                    `<span class="tag-input__tag">
                                        ${section}
                                        <button type="button" class="tag-input__remove">×</button>
                                    </span>`
                                ).join('')}
                                <input type="text" class="tag-input__input" placeholder="Add optional section...">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="config-editor__section">
                    <h4 class="config-editor__title">Template Metadata</h4>
                    
                    <div class="config-editor__row">
                        <div class="config-editor__field">
                            <label class="config-editor__label">Version</label>
                            <input type="text" 
                                   class="config-editor__input" 
                                   value="${template.version}" 
                                   data-field="version">
                        </div>
                    </div>

                    <div class="config-editor__row">
                        <label class="config-editor__checkbox">
                            <input type="checkbox" ${template.isPublic ? 'checked' : ''} data-field="isPublic">
                            Make this template public (other users can see and use it)
                        </label>
                    </div>
                </div>

                ${this.options.enableAdvancedOptions ? `
                    <div class="config-editor__section">
                        <h4 class="config-editor__title">Advanced Options</h4>
                        
                        <div class="config-editor__field">
                            <label class="config-editor__label">Template JSON</label>
                            <div class="config-editor__help">
                                Advanced users can directly edit the template JSON structure
                            </div>
                            <textarea class="config-editor__json" 
                                      rows="10" 
                                      data-field="json">${JSON.stringify(template.toJSON(), null, 2)}</textarea>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderPreview() {
        if (!this.template) return;

        const outlineStructure = this.template.toOutlineStructure();
        
        this.elements.content.innerHTML = `
            <div class="template-preview-editor">
                <div class="template-preview-editor__header">
                    <h4 class="template-preview-editor__title">Template Preview</h4>
                    <div class="template-preview-editor__subtitle">
                        This is how your template will appear to users
                    </div>
                </div>

                <div class="template-preview-card">
                    <div class="template-preview-card__header">
                        <div class="template-preview-card__icon">
                            ${TemplateUtils.getCategoryIcon(this.template.category)}
                        </div>
                        <div class="template-preview-card__info">
                            <h3 class="template-preview-card__title">${this.template.name}</h3>
                            <p class="template-preview-card__description">${this.template.description}</p>
                        </div>
                    </div>

                    <div class="template-preview-card__meta">
                        <div class="template-preview-card__stat">
                            <strong>Category:</strong> ${this.template.category}
                        </div>
                        <div class="template-preview-card__stat">
                            <strong>Complexity:</strong> 
                            <span style="color: ${TemplateUtils.getComplexityColor(this.template.config.complexity)}">
                                ${this.template.config.complexity}
                            </span>
                        </div>
                        <div class="template-preview-card__stat">
                            <strong>Word Count:</strong> ${this.template.config.defaultWordCount.toLocaleString()}
                        </div>
                        <div class="template-preview-card__stat">
                            <strong>Estimated Time:</strong> ${this.template.config.estimatedTime}
                        </div>
                    </div>

                    ${this.template.tags.length > 0 ? `
                        <div class="template-preview-card__tags">
                            ${this.template.tags.map(tag => `<span class="template-preview-card__tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="template-preview-card__structure">
                        <h4 class="template-preview-card__structure-title">Document Structure</h4>
                        <div class="template-preview-card__outline">
                            ${this.renderPreviewOutline(outlineStructure)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPreviewOutline(node) {
        if (node.level === 0) {
            return node.children.map(child => this.renderPreviewOutline(child)).join('');
        }

        const hasChildren = node.children && node.children.length > 0;
        const indent = (node.level - 1) * 20;
        
        return `
            <div class="template-preview-outline-node" style="margin-left: ${indent}px">
                <div class="template-preview-outline-node__content">
                    <span class="template-preview-outline-node__level">${node.level}</span>
                    <span class="template-preview-outline-node__title">${node.title}</span>
                    ${node.metadata?.isRequired ? '<span class="template-preview-outline-node__required">*</span>' : ''}
                    <span class="template-preview-outline-node__words">(${node.allocatedWords} words)</span>
                </div>
                
                ${hasChildren ? `
                    <div class="template-preview-outline-node__children">
                        ${node.children.map(child => this.renderPreviewOutline(child)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Event binding
    bindEvents() {
        if (!this.container) return;

        // Mode tabs
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-customizer__tab')) {
                const mode = e.target.dataset.mode;
                this.setMode(mode);
            }
        });

        // Actions
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'create-new':
                    this.createNew();
                    break;
                case 'save':
                    this.saveTemplate();
                    break;
                case 'cancel':
                    this.cancelEditing();
                    break;
                case 'export-template':
                    this.exportTemplate();
                    break;
                case 'import-template':
                    this.showImportDialog();
                    break;
                case 'add-section':
                    this.addSection();
                    break;
                case 'add-subsection':
                    this.addSubsection(e.target);
                    break;
                case 'remove-section':
                    this.removeSection(e.target);
                    break;
                case 'import-structure':
                    this.importStructure();
                    break;
            }
        });

        // Form changes
        this.container.addEventListener('input', (e) => {
            if (e.target.dataset.field) {
                this.handleFieldChange(e.target);
            }
        });

        this.container.addEventListener('change', (e) => {
            if (e.target.dataset.field) {
                this.handleFieldChange(e.target);
            }
        });

        // Tag input handling
        this.container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('tag-input__input') && e.key === 'Enter') {
                e.preventDefault();
                this.addTag(e.target);
            }
        });

        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-input__remove')) {
                this.removeTag(e.target);
            }
        });
    }

    // Field handling
    handleFieldChange(element) {
        if (!this.template) return;

        const field = element.dataset.field;
        const value = this.getFieldValue(element);
        
        this.setNestedProperty(this.template, field, value);
        this.markAsChanged();
        this.scheduleAutoSave();
        this.validateTemplate();
    }

    getFieldValue(element) {
        switch (element.type) {
            case 'checkbox':
                return element.checked;
            case 'number':
                return parseInt(element.value) || 0;
            case 'text':
            case 'textarea':
            case 'select-one':
                if (element.dataset.field === 'tags') {
                    return element.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                }
                return element.value;
            default:
                return element.value;
        }
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // Structure editing
    addSection() {
        if (!this.template) return;

        const newSection = {
            title: 'New Section',
            description: '',
            wordAllocation: Math.floor(this.template.config.defaultWordCount * 0.1),
            required: false,
            estimatedTime: '30 minutes',
            difficulty: 'medium'
        };

        this.template.structure.push(newSection);
        this.markAsChanged();
        this.renderCurrentMode();
    }

    addSubsection(button) {
        const sectionEditor = button.closest('.section-editor');
        const sectionIndex = parseInt(sectionEditor.dataset.sectionIndex);
        const sectionLevel = parseInt(sectionEditor.dataset.sectionLevel);
        
        if (sectionLevel >= this.options.maxStructureDepth) {
            alert(`Maximum nesting depth of ${this.options.maxStructureDepth} levels reached`);
            return;
        }

        const section = this.getSectionByPath([sectionIndex]);
        if (!section.children) section.children = [];
        
        section.children.push({
            title: 'New Subsection',
            description: '',
            wordAllocation: Math.floor(section.wordAllocation * 0.3),
            required: false
        });

        this.markAsChanged();
        this.renderCurrentMode();
    }

    removeSection(button) {
        const sectionEditor = button.closest('.section-editor');
        const sectionIndex = parseInt(sectionEditor.dataset.sectionIndex);
        
        if (confirm('Remove this section? This action cannot be undone.')) {
            this.template.structure.splice(sectionIndex, 1);
            this.markAsChanged();
            this.renderCurrentMode();
        }
    }

    getSectionByPath(path) {
        return path.reduce((current, index) => current[index], this.template.structure);
    }

    // Utility methods
    countTotalSections(structure) {
        return structure.reduce((count, section) => {
            return count + 1 + (section.children ? this.countTotalSections(section.children) : 0);
        }, 0);
    }

    calculateTotalWords(structure) {
        return structure.reduce((total, section) => {
            return total + (section.wordAllocation || 0) + 
                   (section.children ? this.calculateTotalWords(section.children) : 0);
        }, 0);
    }

    // Validation
    validateTemplate() {
        if (!this.template) {
            this.validationErrors = [];
            return;
        }

        const validation = this.template.validate();
        this.validationErrors = validation.errors;
        
        // Additional custom validations
        const totalWords = this.calculateTotalWords(this.template.structure);
        if (Math.abs(totalWords - this.template.config.defaultWordCount) > this.template.config.defaultWordCount * 0.1) {
            this.validationErrors.push(`Word allocation (${totalWords}) should be close to default word count (${this.template.config.defaultWordCount})`);
        }

        this.renderValidation();
        this.updateSaveButton();
    }

    renderValidation() {
        if (!this.elements.validation) return;

        if (this.validationErrors.length === 0) {
            this.elements.validation.innerHTML = '';
            return;
        }

        this.elements.validation.innerHTML = `
            <div class="template-customizer__validation-content">
                <h4 class="template-customizer__validation-title">Validation Issues</h4>
                <ul class="template-customizer__validation-list">
                    ${this.validationErrors.map(error => 
                        `<li class="template-customizer__validation-item">${error}</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    }

    updateSaveButton() {
        const saveButton = this.container.querySelector('[data-action="save"]');
        if (saveButton) {
            saveButton.disabled = this.validationErrors.length > 0;
        }
    }

    // Save/Load operations
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateSaveStatus();
    }

    updateSaveStatus() {
        const subtitle = this.container.querySelector('.template-customizer__subtitle');
        if (subtitle && this.template) {
            subtitle.textContent = `${this.template.name}${this.hasUnsavedChanges ? ' (unsaved changes)' : ''}`;
        }
    }

    scheduleAutoSave() {
        if (!this.options.autoSave) return;
        
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveTemplate(true);
        }, this.options.autoSaveDelay);
    }

    saveTemplate(isAutoSave = false) {
        if (!this.template || this.validationErrors.length > 0) return;

        try {
            this.template.updated = new Date().toISOString();
            
            if (this.isEditing) {
                this.storage.update('templates', this.template.id, this.template.toJSON());
            } else {
                this.storage.create('templates', this.template.toJSON());
                this.isEditing = true;
            }

            this.hasUnsavedChanges = false;
            this.updateSaveStatus();

            if (!isAutoSave) {
                this.emit('templateSave', { template: this.template });
                alert('Template saved successfully!');
            }
        } catch (error) {
            console.error('Failed to save template:', error);
            if (!isAutoSave) {
                alert('Failed to save template. Please try again.');
            }
        }
    }

    cancelEditing() {
        if (this.hasUnsavedChanges) {
            if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                return;
            }
        }

        this.template = null;
        this.isEditing = false;
        this.hasUnsavedChanges = false;
        this.render();
        this.emit('templateCancel', {});
    }

    // Mode switching
    setMode(mode) {
        this.currentMode = mode;
        
        // Update tabs
        const tabs = this.container.querySelectorAll('.template-customizer__tab');
        tabs.forEach(tab => {
            tab.classList.toggle('template-customizer__tab--active', tab.dataset.mode === mode);
        });

        this.renderCurrentMode();
    }

    // Import/Export
    exportTemplate() {
        if (!this.template) return;

        const data = JSON.stringify(this.template.toJSON(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showImportDialog() {
        const input = document.createElement('textarea');
        input.placeholder = 'Paste template JSON here...';
        input.style.width = '100%';
        input.style.height = '200px';
        input.style.margin = '10px 0';

        const dialog = this.createDialog('Import Template', [
            { type: 'element', element: input },
            { type: 'button', text: 'Import', primary: true, action: () => {
                this.importTemplate(input.value);
                this.closeDialog(dialog);
            }},
            { type: 'button', text: 'Cancel', action: () => this.closeDialog(dialog) }
        ]);
    }

    importTemplate(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.template = new DocumentTemplate({
                ...data,
                id: undefined, // Generate new ID
                author: 'Imported',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            });

            this.isEditing = false;
            this.hasUnsavedChanges = true;
            this.render();
            this.emit('templateImport', { template: this.template });
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to import template. Please check the JSON format.');
        }
    }

    // Tag management
    addTag(input) {
        const value = input.value.trim();
        if (!value) return;

        const tagContainer = input.closest('.tag-input');
        const field = tagContainer.dataset.field;
        
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-input__tag';
        tagElement.innerHTML = `
            ${value}
            <button type="button" class="tag-input__remove">×</button>
        `;
        
        input.parentNode.insertBefore(tagElement, input);
        input.value = '';
        
        this.updateTagField(tagContainer, field);
    }

    removeTag(button) {
        const tagContainer = button.closest('.tag-input');
        const field = tagContainer.dataset.field;
        
        button.parentNode.remove();
        this.updateTagField(tagContainer, field);
    }

    updateTagField(tagContainer, field) {
        const tags = Array.from(tagContainer.querySelectorAll('.tag-input__tag'))
            .map(tag => tag.textContent.replace('×', '').trim());
        
        this.setNestedProperty(this.template, field, tags);
        this.markAsChanged();
    }

    // Dialog helpers (reused from other components)
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
                button.className = element.primary ? 'template-customizer__btn template-customizer__btn--primary' : 'template-customizer__btn template-customizer__btn--secondary';
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

    // Public API
    getTemplate() {
        return this.template;
    }

    setTemplate(template) {
        this.editTemplate(template);
    }

    // Cleanup
    destroy() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.eventListeners = {};
        this.container.innerHTML = '';
    }
}