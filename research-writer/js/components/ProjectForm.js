/**
 * ProjectForm - Create and edit forms for projects with validation
 * Handles form rendering, validation, template selection, project cloning, and user interaction
 */

import { ValidationEngine, ValidationRules } from '../utils/validation.js';

export class ProjectForm {
    constructor(container, projectManager, options = {}) {
        this.container = container;
        this.projectManager = projectManager;
        this.options = {
            mode: 'create', // 'create', 'edit', or 'clone'
            projectId: null,
            sourceProjectId: null, // For cloning
            templateId: null,
            onSave: null,
            onCancel: null,
            enableAutoSave: true,
            enableRealTimeValidation: true,
            ...options
        };

        this.currentProject = null;
        this.formData = {};
        this.validationErrors = {};
        this.isDirty = false;
        this.isSubmitting = false;
        this.autoSaveTimeout = null;
        this.validator = null;

        this.init();
    }

    async init() {
        try {
            // Initialize validation engine
            this.validator = new ValidationEngine({
                validateOnBlur: this.options.enableRealTimeValidation,
                validateOnInput: this.options.enableRealTimeValidation,
                showSuccessState: false,
                debounceTime: 300
            });

            // Load project data based on mode
            if (this.options.mode === 'edit' && this.options.projectId) {
                this.currentProject = this.projectManager.getProject(this.options.projectId);
                if (!this.currentProject) {
                    throw new Error(`Project ${this.options.projectId} not found`);
                }
                this.formData = { ...this.currentProject.toJSON() };
            } else if (this.options.mode === 'clone' && this.options.sourceProjectId) {
                const sourceProject = this.projectManager.getProject(this.options.sourceProjectId);
                if (!sourceProject) {
                    throw new Error(`Source project ${this.options.sourceProjectId} not found`);
                }
                // Clone project data but reset certain fields
                this.formData = { 
                    ...sourceProject.toJSON(),
                    id: undefined, // Will be generated
                    title: `${sourceProject.title} (Copy)`,
                    created: undefined, // Will be set on save
                    updated: undefined, // Will be set on save
                    status: 'planning' // Reset to planning status
                };
            } else if (this.options.templateId) {
                const template = this.projectManager.getTemplate(this.options.templateId);
                if (template) {
                    this.formData = { ...template.defaults };
                }
            }

            this.render();
            this.setupEventListeners();
            this.setupValidation();
            
            if (this.options.enableAutoSave && this.options.mode === 'edit') {
                this.enableAutoSave();
            }

        } catch (error) {
            console.error('Error initializing ProjectForm:', error);
            this.renderError(error.message);
        }
    }

    render() {
        const template = this.options.templateId ? 
            this.projectManager.getTemplate(this.options.templateId) : null;

        this.container.innerHTML = `
            <div class="project-form-container">
                <form class="project-form" novalidate>
                    <div class="form-header">
                        <h2 class="form-title">
                            ${this.getFormTitle()}
                            ${template ? `<span class="template-badge">${template.icon} ${template.name}</span>` : ''}
                        </h2>
                        <button type="button" class="close-btn" aria-label="Close form">×</button>
                    </div>

                    <div class="form-body">
                        <!-- Template Selection (only for create mode) -->
                        ${this.options.mode === 'create' && !this.options.templateId ? this.renderTemplateSelector() : ''}

                        <!-- Basic Information -->
                        <fieldset class="form-section">
                            <legend>Basic Information</legend>
                            
                            <div class="form-row">
                                <div class="form-group required">
                                    <label for="project-title">Project Title</label>
                                    <input 
                                        type="text" 
                                        id="project-title" 
                                        name="title" 
                                        value="${this.formData.title || ''}"
                                        required
                                        maxlength="500"
                                        aria-describedby="title-help title-error"
                                    >
                                    <small id="title-help" class="form-help">
                                        Enter a descriptive title for your research project
                                    </small>
                                    <div id="title-error" class="form-error" aria-live="polite"></div>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label for="project-description">Description</label>
                                    <textarea 
                                        id="project-description" 
                                        name="description"
                                        rows="4"
                                        maxlength="2000"
                                        aria-describedby="description-help"
                                        placeholder="Describe your research project, objectives, and scope..."
                                    >${this.formData.description || ''}</textarea>
                                    <small id="description-help" class="form-help">
                                        Provide an overview of your research project (optional)
                                    </small>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group form-group-half required">
                                    <label for="project-author">Author/Researcher</label>
                                    <input 
                                        type="text" 
                                        id="project-author" 
                                        name="author"
                                        value="${this.formData.author || ''}"
                                        required
                                        maxlength="200"
                                        aria-describedby="author-error"
                                    >
                                    <div id="author-error" class="form-error" aria-live="polite"></div>
                                </div>

                                <div class="form-group form-group-half">
                                    <label for="project-tags">Tags</label>
                                    <input 
                                        type="text" 
                                        id="project-tags" 
                                        name="tags"
                                        value="${(this.formData.tags || []).join(', ')}"
                                        placeholder="research, literature, analysis"
                                        aria-describedby="tags-help"
                                    >
                                    <small id="tags-help" class="form-help">
                                        Comma-separated tags for organization
                                    </small>
                                </div>
                            </div>
                        </fieldset>

                        <!-- Project Settings -->
                        <fieldset class="form-section">
                            <legend>Project Settings</legend>
                            
                            <div class="form-row">
                                <div class="form-group form-group-third">
                                    <label for="project-status">Status</label>
                                    <select id="project-status" name="status">
                                        <option value="planning" ${this.formData.status === 'planning' ? 'selected' : ''}>
                                            Planning
                                        </option>
                                        <option value="active" ${this.formData.status === 'active' ? 'selected' : ''}>
                                            Active
                                        </option>
                                        <option value="completed" ${this.formData.status === 'completed' ? 'selected' : ''}>
                                            Completed
                                        </option>
                                        <option value="archived" ${this.formData.status === 'archived' ? 'selected' : ''}>
                                            Archived
                                        </option>
                                    </select>
                                </div>

                                <div class="form-group form-group-third">
                                    <label for="project-priority">Priority</label>
                                    <select id="project-priority" name="priority">
                                        <option value="low" ${this.formData.priority === 'low' ? 'selected' : ''}>
                                            Low
                                        </option>
                                        <option value="medium" ${this.formData.priority === 'medium' ? 'selected' : ''}>
                                            Medium
                                        </option>
                                        <option value="high" ${this.formData.priority === 'high' ? 'selected' : ''}>
                                            High
                                        </option>
                                        <option value="urgent" ${this.formData.priority === 'urgent' ? 'selected' : ''}>
                                            Urgent
                                        </option>
                                    </select>
                                </div>

                                <div class="form-group form-group-third">
                                    <div class="form-info">
                                        <label>Created</label>
                                        <span class="info-value">
                                            ${this.formData.created ? 
                                                new Date(this.formData.created).toLocaleDateString() : 
                                                'New project'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <!-- Template-specific fields -->
                        ${template ? this.renderTemplateFields(template) : ''}

                        <!-- Form Actions -->
                        <div class="form-actions">
                            <div class="form-status">
                                <span class="save-status" aria-live="polite"></span>
                                ${this.options.enableAutoSave && this.options.mode === 'edit' ? 
                                    '<small class="auto-save-info">Auto-save enabled</small>' : ''
                                }
                            </div>
                            
                            <div class="form-buttons">
                                <button type="button" class="btn btn-secondary cancel-btn">
                                    Cancel
                                </button>
                                <button type="submit" class="btn btn-primary save-btn">
                                    ${this.getSubmitButtonText()}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        `;
    }

    renderTemplateSelector() {
        const templates = this.projectManager.getTemplates();
        const categories = this.projectManager.getTemplateCategories();

        return `
            <fieldset class="form-section template-section">
                <legend>Choose Template</legend>
                <div class="template-selector">
                    ${Object.entries(categories).map(([categoryId, category]) => `
                        <div class="template-category">
                            <h4 class="category-title">
                                ${category.icon} ${category.name}
                            </h4>
                            <div class="template-options">
                                ${Object.entries(templates)
                                    .filter(([_, template]) => template.category === categoryId)
                                    .map(([templateId, template]) => `
                                        <label class="template-option">
                                            <input 
                                                type="radio" 
                                                name="template" 
                                                value="${templateId}"
                                                ${this.options.templateId === templateId ? 'checked' : ''}
                                            >
                                            <div class="template-card">
                                                <div class="template-icon">${template.icon}</div>
                                                <div class="template-info">
                                                    <div class="template-name">${template.name}</div>
                                                    <div class="template-description">${template.description}</div>
                                                </div>
                                            </div>
                                        </label>
                                    `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </fieldset>
        `;
    }

    renderTemplateFields(template) {
        if (!template.defaults?.customFields) {
            return '';
        }

        return `
            <fieldset class="form-section template-fields">
                <legend>${template.name} Specific Fields</legend>
                ${Object.entries(template.defaults.customFields).map(([fieldName, fieldValue]) => {
                    return this.renderCustomField(fieldName, fieldValue);
                }).join('')}
            </fieldset>
        `;
    }

    renderCustomField(fieldName, fieldValue) {
        const fieldId = `custom-${fieldName}`;
        const currentValue = this.formData.customFields?.[fieldName] || fieldValue;

        if (Array.isArray(fieldValue)) {
            return `
                <div class="form-group">
                    <label for="${fieldId}">${this.formatFieldName(fieldName)}</label>
                    <input 
                        type="text" 
                        id="${fieldId}" 
                        name="customFields.${fieldName}"
                        value="${Array.isArray(currentValue) ? currentValue.join(', ') : currentValue}"
                        placeholder="Comma-separated values"
                    >
                </div>
            `;
        } else if (typeof fieldValue === 'number') {
            return `
                <div class="form-group">
                    <label for="${fieldId}">${this.formatFieldName(fieldName)}</label>
                    <input 
                        type="number" 
                        id="${fieldId}" 
                        name="customFields.${fieldName}"
                        value="${currentValue}"
                    >
                </div>
            `;
        } else if (typeof fieldValue === 'boolean') {
            return `
                <div class="form-group">
                    <label class="checkbox-label">
                        <input 
                            type="checkbox" 
                            id="${fieldId}" 
                            name="customFields.${fieldName}"
                            ${currentValue ? 'checked' : ''}
                        >
                        ${this.formatFieldName(fieldName)}
                    </label>
                </div>
            `;
        } else if (fieldName.toLowerCase().includes('date') || fieldName.toLowerCase().includes('deadline')) {
            return `
                <div class="form-group">
                    <label for="${fieldId}">${this.formatFieldName(fieldName)}</label>
                    <input 
                        type="date" 
                        id="${fieldId}" 
                        name="customFields.${fieldName}"
                        value="${currentValue}"
                    >
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label for="${fieldId}">${this.formatFieldName(fieldName)}</label>
                    <input 
                        type="text" 
                        id="${fieldId}" 
                        name="customFields.${fieldName}"
                        value="${currentValue}"
                    >
                </div>
            `;
        }
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="project-form-container">
                <div class="form-error-message">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button type="button" class="btn btn-primary" onclick="history.back()">
                        Go Back
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const form = this.container.querySelector('.project-form');
        if (!form) return;

        // Form submission
        form.addEventListener('submit', this.handleSubmit.bind(this));

        // Close/Cancel buttons
        const closeBtn = form.querySelector('.close-btn');
        const cancelBtn = form.querySelector('.cancel-btn');
        
        if (closeBtn) closeBtn.addEventListener('click', this.handleCancel.bind(this));
        if (cancelBtn) cancelBtn.addEventListener('click', this.handleCancel.bind(this));

        // Template selection
        const templateInputs = form.querySelectorAll('input[name="template"]');
        templateInputs.forEach(input => {
            input.addEventListener('change', this.handleTemplateChange.bind(this));
        });

        // Form field changes for validation and auto-save
        form.addEventListener('input', this.handleFieldChange.bind(this));
        form.addEventListener('change', this.handleFieldChange.bind(this));

        // Prevent form submission on Enter in text inputs
        form.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && event.target.type !== 'submit') {
                event.preventDefault();
            }
        });
    }

    getFormTitle() {
        switch (this.options.mode) {
            case 'edit':
                return 'Edit Project';
            case 'clone':
                return 'Clone Project';
            default:
                return 'Create New Project';
        }
    }

    getSubmitButtonText() {
        switch (this.options.mode) {
            case 'edit':
                return 'Update Project';
            case 'clone':
                return 'Clone Project';
            default:
                return 'Create Project';
        }
    }

    setupValidation() {
        if (!this.validator || !this.options.enableRealTimeValidation) return;
        
        const form = this.container.querySelector('.project-form');
        if (form) {
            this.validator.attachToForm(form, ValidationRules.project);
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        try {
            this.updateSaveStatus('Saving...', 'loading');
            
            const formData = this.collectFormData();
            const isValid = await this.validateForm(formData);
            
            if (!isValid) {
                this.updateSaveStatus('Please fix validation errors', 'error');
                return;
            }

            let savedProject;
            if (this.options.mode === 'edit') {
                savedProject = await this.projectManager.updateProject(this.options.projectId, formData);
            } else {
                // Both 'create' and 'clone' modes create new projects
                savedProject = await this.projectManager.createProject(formData, this.options.templateId);
            }

            this.updateSaveStatus('Saved successfully!', 'success');
            this.isDirty = false;

            if (this.options.onSave) {
                this.options.onSave(savedProject);
            }

            setTimeout(() => {
                this.close();
            }, 1500);

        } catch (error) {
            console.error('Error saving project:', error);
            this.updateSaveStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    handleCancel() {
        if (this.isDirty) {
            const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmClose) return;
        }

        if (this.options.onCancel) {
            this.options.onCancel();
        }

        this.close();
    }

    async handleTemplateChange(event) {
        const templateId = event.target.value;
        this.options.templateId = templateId;
        
        // Load template defaults
        const template = this.projectManager.getTemplate(templateId);
        if (template) {
            this.formData = { ...this.formData, ...template.defaults };
        }
        
        this.render();
        this.setupEventListeners();
    }

    handleFieldChange(event) {
        const field = event.target;
        const fieldName = field.name;
        const fieldValue = field.type === 'checkbox' ? field.checked : field.value;

        // Update form data
        if (fieldName.startsWith('customFields.')) {
            const customFieldName = fieldName.replace('customFields.', '');
            if (!this.formData.customFields) this.formData.customFields = {};
            this.formData.customFields[customFieldName] = fieldValue;
        } else if (fieldName === 'tags') {
            this.formData[fieldName] = fieldValue.split(',').map(tag => tag.trim()).filter(tag => tag);
        } else {
            this.formData[fieldName] = fieldValue;
        }

        this.isDirty = true;
        
        // Real-time validation
        this.validateField(field);
        
        // Auto-save (debounced)
        if (this.options.enableAutoSave && this.options.mode === 'edit') {
            this.scheduleAutoSave();
        }
    }

    async validateForm(data = null) {
        const formData = data || this.collectFormData();
        
        if (this.validator) {
            // Use the ValidationEngine for comprehensive validation
            const validationResult = this.validator.validateProject(formData);
            this.validationErrors = validationResult.errors;
            this.displayValidationErrors();
            return validationResult.isValid;
        } else {
            // Fallback to basic validation if validator not available
            this.validationErrors = {};
            let isValid = true;

            // Required field validation
            if (!formData.title?.trim()) {
                this.validationErrors.title = 'Project title is required';
                isValid = false;
            } else if (formData.title.length > 500) {
                this.validationErrors.title = 'Project title must be 500 characters or less';
                isValid = false;
            }

            if (!formData.author?.trim()) {
                this.validationErrors.author = 'Author name is required';
                isValid = false;
            } else if (formData.author.length > 200) {
                this.validationErrors.author = 'Author name must be 200 characters or less';
                isValid = false;
            }

            if (formData.description && formData.description.length > 2000) {
                this.validationErrors.description = 'Description must be 2000 characters or less';
                isValid = false;
            }

            // Display validation errors
            this.displayValidationErrors();
            
            return isValid;
        }
    }

    validateField(field) {
        const fieldName = field.name.split('.')[0]; // Get base field name
        const value = field.type === 'checkbox' ? field.checked : field.value;

        let error = '';

        switch (fieldName) {
            case 'title':
                if (!value.trim()) {
                    error = 'Project title is required';
                } else if (value.length > 500) {
                    error = 'Title must be 500 characters or less';
                }
                break;
            
            case 'author':
                if (!value.trim()) {
                    error = 'Author name is required';
                } else if (value.length > 200) {
                    error = 'Author name must be 200 characters or less';
                }
                break;
                
            case 'description':
                if (value.length > 2000) {
                    error = 'Description must be 2000 characters or less';
                }
                break;
        }

        // Update validation state
        if (error) {
            this.validationErrors[fieldName] = error;
            field.setAttribute('aria-invalid', 'true');
        } else {
            delete this.validationErrors[fieldName];
            field.removeAttribute('aria-invalid');
        }

        // Display field-specific error
        const errorElement = field.parentElement.querySelector('.form-error');
        if (errorElement) {
            errorElement.textContent = error;
            errorElement.style.display = error ? 'block' : 'none';
        }
    }

    displayValidationErrors() {
        Object.entries(this.validationErrors).forEach(([fieldName, errors]) => {
            const field = this.container.querySelector(`[name="${fieldName}"]`);
            if (field) {
                field.setAttribute('aria-invalid', 'true');
                const errorElement = field.parentElement.querySelector('.form-error');
                if (errorElement) {
                    // Handle both string errors and array of errors
                    const errorText = Array.isArray(errors) ? errors[0] : errors;
                    errorElement.textContent = errorText;
                    errorElement.style.display = 'block';
                }
            }
        });
    }

    collectFormData() {
        const form = this.container.querySelector('.project-form');
        const formData = new FormData(form);
        const data = {};

        // Basic fields
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('customFields.')) {
                if (!data.customFields) data.customFields = {};
                const fieldName = key.replace('customFields.', '');
                data.customFields[fieldName] = value;
            } else if (key === 'tags') {
                data[key] = value.split(',').map(tag => tag.trim()).filter(tag => tag);
            } else {
                data[key] = value;
            }
        }

        // Handle checkboxes (not included in FormData if unchecked)
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const name = checkbox.name;
            if (name.startsWith('customFields.')) {
                if (!data.customFields) data.customFields = {};
                const fieldName = name.replace('customFields.', '');
                data.customFields[fieldName] = checkbox.checked;
            } else {
                data[name] = checkbox.checked;
            }
        });

        return data;
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(async () => {
            try {
                if (this.isDirty && !this.isSubmitting) {
                    this.updateSaveStatus('Saving...', 'loading');
                    const formData = this.collectFormData();
                    await this.projectManager.updateProject(this.options.projectId, formData);
                    this.updateSaveStatus('Auto-saved', 'success');
                    this.isDirty = false;
                    
                    setTimeout(() => {
                        this.updateSaveStatus('', '');
                    }, 2000);
                }
            } catch (error) {
                console.error('Auto-save error:', error);
                this.updateSaveStatus('Auto-save failed', 'error');
            }
        }, 5000);
    }

    enableAutoSave() {
        if (this.options.mode !== 'edit') return;
        // Auto-save is handled in handleFieldChange method
    }

    disableAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
    }

    updateSaveStatus(message, type = '') {
        const statusElement = this.container.querySelector('.save-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `save-status ${type}`;
        }
    }

    formatFieldName(fieldName) {
        return fieldName
            .split(/(?=[A-Z])/)
            .join(' ')
            .replace(/^\w/, c => c.toUpperCase());
    }

    close() {
        this.disableAutoSave();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    destroy() {
        this.disableAutoSave();
        
        // Clean up validator
        if (this.validator) {
            const form = this.container?.querySelector('.project-form');
            if (form) {
                this.validator.detachFromForm(form);
            }
            this.validator.clearAllState();
            this.validator = null;
        }
        
        this.container = null;
        this.projectManager = null;
    }
}