/**
 * ProjectController - Central controller for project CRUD operations and UI coordination
 * Manages the integration between ProjectForm, ProjectList, and ProjectManager components
 * Provides auto-save, undo/redo, and workflow coordination functionality
 */

import { ProjectManager } from '../components/ProjectManager.js';
import { ProjectForm } from '../components/ProjectForm.js';
import { ProjectList } from '../components/ProjectList.js';

export class ProjectController {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            autoSaveEnabled: true,
            autoSaveInterval: 5000, // 5 seconds
            maxUndoHistory: 20,
            enableKeyboardShortcuts: true,
            ...options
        };

        // Core managers
        this.projectManager = null;
        this.currentView = 'list'; // 'list', 'form', 'dashboard'
        this.currentProject = null;
        this.currentForm = null;
        this.currentList = null;

        // Auto-save functionality
        this.autoSaveTimer = null;
        this.pendingChanges = new Map();
        this.autoSaveIndicator = null;

        // Undo/Redo functionality
        this.undoHistory = [];
        this.redoHistory = [];
        this.isPerformingUndoRedo = false;

        // State management
        this.viewState = {
            lastListFilters: {},
            lastListSort: { by: 'updated', order: 'desc' },
            lastFormMode: 'create'
        };

        this.init();
    }

    async init() {
        try {
            // Initialize project manager
            this.projectManager = new ProjectManager();
            await this.projectManager.init();

            // Set up event listeners
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            // Initialize UI
            this.render();
            
            console.log('ProjectController initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ProjectController:', error);
            this.renderError('Failed to initialize application: ' + error.message);
        }
    }

    setupEventListeners() {
        // Project Manager events
        this.projectManager.on('projectCreated', (project) => {
            this.onProjectCreated(project);
        });

        this.projectManager.on('projectUpdated', (project) => {
            this.onProjectUpdated(project);
        });

        this.projectManager.on('projectDeleted', (data) => {
            this.onProjectDeleted(data);
        });

        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.hasPendingChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        // Handle browser navigation
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                this.navigateToState(e.state);
            }
        });
    }

    setupKeyboardShortcuts() {
        if (!this.options.enableKeyboardShortcuts) return;

        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in form inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl/Cmd + key combinations
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.showCreateForm();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveCurrentProject();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                }
            }

            // ESC key - close form or clear search
            if (e.key === 'Escape') {
                if (this.currentView === 'form') {
                    this.closeForm();
                } else {
                    this.clearSearch();
                }
            }
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="project-controller">
                <!-- Auto-save Indicator -->
                <div class="auto-save-indicator" style="display: none;">
                    <span class="indicator-icon">💾</span>
                    <span class="indicator-text">Saving...</span>
                </div>

                <!-- Main Content Area -->
                <div class="main-content">
                    <div class="view-container"></div>
                </div>

                <!-- Undo/Redo Controls -->
                ${this.renderUndoRedoControls()}
            </div>
        `;

        // Initialize auto-save indicator
        this.autoSaveIndicator = this.container.querySelector('.auto-save-indicator');

        // Show initial view
        this.showView('list');
    }

    renderUndoRedoControls() {
        return `
            <div class="undo-redo-controls">
                <button class="undo-btn" title="Undo (Ctrl+Z)" ${this.undoHistory.length === 0 ? 'disabled' : ''}>
                    <span aria-hidden="true">↶</span> Undo
                </button>
                <button class="redo-btn" title="Redo (Ctrl+Shift+Z)" ${this.redoHistory.length === 0 ? 'disabled' : ''}>
                    <span aria-hidden="true">↷</span> Redo
                </button>
            </div>
        `;
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="project-controller error-state">
                <div class="error-message">
                    <h2>Application Error</h2>
                    <p>${message}</p>
                    <button class="btn btn-primary retry-btn">Retry</button>
                </div>
            </div>
        `;

        this.container.querySelector('.retry-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }

    showView(viewType, options = {}) {
        this.currentView = viewType;
        const viewContainer = this.container.querySelector('.view-container');
        
        // Clean up current components
        this.cleanup();

        switch (viewType) {
            case 'list':
                this.showProjectList(options);
                break;
            case 'form':
                this.showProjectForm(options);
                break;
            case 'dashboard':
                this.showDashboard(options);
                break;
            default:
                console.error('Unknown view type:', viewType);
                this.showProjectList();
        }

        // Update URL state
        this.updateUrlState(viewType, options);
        
        // Update undo/redo controls
        this.updateUndoRedoControls();
    }

    showProjectList(options = {}) {
        const viewContainer = this.container.querySelector('.view-container');
        
        this.currentList = new ProjectList(viewContainer, this.projectManager, {
            ...this.viewState.lastListFilters,
            ...options,
            onProjectCreate: () => this.showCreateForm(),
            onProjectEdit: (project) => this.showEditForm(project),
            onProjectSelect: (project) => this.selectProject(project),
            onProjectDelete: (project) => this.recordUndoableAction('delete', project)
        });

        // Store list state
        this.viewState.lastListFilters = options;
    }

    showProjectForm(options = {}) {
        const viewContainer = this.container.querySelector('.view-container');
        const mode = options.mode || 'create';
        
        this.currentForm = new ProjectForm(viewContainer, this.projectManager, {
            ...options,
            enableAutoSave: this.options.autoSaveEnabled && mode === 'edit',
            onSave: (project) => this.onFormSave(project, mode),
            onCancel: () => this.onFormCancel()
        });

        // Set up auto-save for edit mode
        if (mode === 'edit' && this.options.autoSaveEnabled) {
            this.setupFormAutoSave();
        }

        this.viewState.lastFormMode = mode;
    }

    showDashboard(options = {}) {
        const viewContainer = this.container.querySelector('.view-container');
        // Dashboard implementation would go here
        viewContainer.innerHTML = '<div class="dashboard">Dashboard coming soon...</div>';
    }

    showCreateForm(templateId = null) {
        this.showView('form', {
            mode: 'create',
            templateId: templateId
        });
    }

    showEditForm(project) {
        this.showView('form', {
            mode: 'edit',
            projectId: project.id
        });
        this.currentProject = project;
    }

    showCloneForm(project) {
        this.showView('form', {
            mode: 'clone',
            sourceProjectId: project.id
        });
    }

    selectProject(project) {
        this.currentProject = project;
        // Could trigger detail view or other actions
        console.log('Selected project:', project.title);
    }

    closeForm() {
        this.showView('list', this.viewState.lastListFilters);
    }

    // Form Event Handlers
    onFormSave(project, mode) {
        if (mode === 'create' || mode === 'clone') {
            this.recordUndoableAction('create', project);
        } else {
            this.recordUndoableAction('update', project, this.currentProject);
        }
        
        this.clearPendingChanges();
        this.showView('list');
        this.showNotification(`Project ${mode === 'create' ? 'created' : mode === 'clone' ? 'cloned' : 'updated'} successfully`, 'success');
    }

    onFormCancel() {
        this.clearPendingChanges();
        this.showView('list', this.viewState.lastListFilters);
    }

    // Project Manager Event Handlers
    onProjectCreated(project) {
        if (this.currentList) {
            this.currentList.refresh();
        }
    }

    onProjectUpdated(project) {
        if (this.currentList) {
            this.currentList.refresh();
        }
    }

    onProjectDeleted(data) {
        if (this.currentList) {
            this.currentList.refresh();
        }
    }

    // Auto-save functionality
    setupFormAutoSave() {
        if (!this.currentForm || !this.options.autoSaveEnabled) return;

        // Monitor form changes
        const form = this.currentForm.container.querySelector('.project-form');
        if (!form) return;

        form.addEventListener('input', (e) => {
            this.scheduleAutoSave(e.target.name, e.target.value);
        });

        form.addEventListener('change', (e) => {
            this.scheduleAutoSave(e.target.name, e.target.value);
        });
    }

    scheduleAutoSave(fieldName, value) {
        if (this.isPerformingUndoRedo) return;

        // Store pending change
        this.pendingChanges.set(fieldName, value);

        // Clear existing timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Show saving indicator
        this.showAutoSaveIndicator('Saving...');

        // Schedule save
        this.autoSaveTimer = setTimeout(() => {
            this.performAutoSave();
        }, this.options.autoSaveInterval);
    }

    async performAutoSave() {
        if (this.pendingChanges.size === 0 || !this.currentProject) {
            this.hideAutoSaveIndicator();
            return;
        }

        try {
            const updates = Object.fromEntries(this.pendingChanges);
            const oldProject = { ...this.currentProject };
            
            await this.projectManager.updateProject(this.currentProject.id, updates);
            
            // Record for undo
            this.recordUndoableAction('auto-save', this.currentProject, oldProject);
            
            this.pendingChanges.clear();
            this.showAutoSaveIndicator('Saved', 'success');
            
            setTimeout(() => {
                this.hideAutoSaveIndicator();
            }, 2000);

        } catch (error) {
            console.error('Auto-save failed:', error);
            this.showAutoSaveIndicator('Save failed', 'error');
            setTimeout(() => {
                this.hideAutoSaveIndicator();
            }, 3000);
        }
    }

    showAutoSaveIndicator(text, type = 'info') {
        if (this.autoSaveIndicator) {
            this.autoSaveIndicator.querySelector('.indicator-text').textContent = text;
            this.autoSaveIndicator.className = `auto-save-indicator ${type}`;
            this.autoSaveIndicator.style.display = 'flex';
        }
    }

    hideAutoSaveIndicator() {
        if (this.autoSaveIndicator) {
            this.autoSaveIndicator.style.display = 'none';
        }
    }

    hasPendingChanges() {
        return this.pendingChanges.size > 0;
    }

    clearPendingChanges() {
        this.pendingChanges.clear();
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        this.hideAutoSaveIndicator();
    }

    // Undo/Redo functionality
    recordUndoableAction(actionType, newState, oldState = null) {
        if (this.isPerformingUndoRedo) return;

        const undoAction = {
            type: actionType,
            timestamp: Date.now(),
            newState: newState ? { ...newState } : null,
            oldState: oldState ? { ...oldState } : null,
            projectId: newState?.id || oldState?.id
        };

        this.undoHistory.push(undoAction);
        this.redoHistory = []; // Clear redo history

        // Limit undo history size
        if (this.undoHistory.length > this.options.maxUndoHistory) {
            this.undoHistory.shift();
        }

        this.updateUndoRedoControls();
    }

    async undo() {
        if (this.undoHistory.length === 0) return;

        this.isPerformingUndoRedo = true;
        const action = this.undoHistory.pop();
        
        try {
            switch (action.type) {
                case 'create':
                case 'clone':
                    await this.projectManager.deleteProject(action.projectId);
                    break;
                    
                case 'update':
                case 'auto-save':
                    if (action.oldState) {
                        await this.projectManager.updateProject(action.projectId, action.oldState);
                    }
                    break;
                    
                case 'delete':
                    if (action.oldState) {
                        await this.projectManager.createProject(action.oldState);
                    }
                    break;
            }

            this.redoHistory.push(action);
            this.refreshCurrentView();
            this.showNotification('Action undone', 'info');

        } catch (error) {
            console.error('Undo failed:', error);
            this.showNotification('Undo failed: ' + error.message, 'error');
        } finally {
            this.isPerformingUndoRedo = false;
            this.updateUndoRedoControls();
        }
    }

    async redo() {
        if (this.redoHistory.length === 0) return;

        this.isPerformingUndoRedo = true;
        const action = this.redoHistory.pop();
        
        try {
            switch (action.type) {
                case 'create':
                case 'clone':
                    if (action.newState) {
                        await this.projectManager.createProject(action.newState);
                    }
                    break;
                    
                case 'update':
                case 'auto-save':
                    if (action.newState) {
                        await this.projectManager.updateProject(action.projectId, action.newState);
                    }
                    break;
                    
                case 'delete':
                    await this.projectManager.deleteProject(action.projectId);
                    break;
            }

            this.undoHistory.push(action);
            this.refreshCurrentView();
            this.showNotification('Action redone', 'info');

        } catch (error) {
            console.error('Redo failed:', error);
            this.showNotification('Redo failed: ' + error.message, 'error');
        } finally {
            this.isPerformingUndoRedo = false;
            this.updateUndoRedoControls();
        }
    }

    updateUndoRedoControls() {
        const undoBtn = this.container.querySelector('.undo-btn');
        const redoBtn = this.container.querySelector('.redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.undoHistory.length === 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.redoHistory.length === 0;
        }

        // Add event listeners if not already added
        if (undoBtn && !undoBtn.hasAttribute('data-listener')) {
            undoBtn.addEventListener('click', () => this.undo());
            undoBtn.setAttribute('data-listener', 'true');
        }
        
        if (redoBtn && !redoBtn.hasAttribute('data-listener')) {
            redoBtn.addEventListener('click', () => this.redo());
            redoBtn.setAttribute('data-listener', 'true');
        }
    }

    // Utility methods
    async saveCurrentProject() {
        if (this.currentForm && this.currentProject) {
            const formData = this.currentForm.collectFormData();
            await this.projectManager.updateProject(this.currentProject.id, formData);
            this.showNotification('Project saved', 'success');
        }
    }

    focusSearch() {
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }

    clearSearch() {
        const searchInput = this.container.querySelector('.search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    refreshCurrentView() {
        if (this.currentList) {
            this.currentList.refresh();
        } else if (this.currentForm) {
            // Refresh form data if needed
            this.currentForm.render();
        }
    }

    // URL State management
    updateUrlState(viewType, options = {}) {
        const state = { view: viewType, ...options };
        const url = new URL(window.location);
        url.searchParams.set('view', viewType);
        
        if (options.projectId) {
            url.searchParams.set('project', options.projectId);
        } else {
            url.searchParams.delete('project');
        }

        window.history.pushState(state, '', url);
    }

    navigateToState(state) {
        this.showView(state.view || 'list', state);
    }

    // Notification system
    showNotification(message, type = 'info') {
        // Remove existing notification if present
        const existing = document.querySelector('.controller-notification');
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
        notification.className = 'controller-notification';
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
            z-index: 1002;
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
            <span class="notification-icon">${colors.icon}</span>
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
        setTimeout(removeNotification, type === 'error' ? 8000 : 5000);

        // Show notification
        document.body.appendChild(notification);
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Cleanup
    cleanup() {
        if (this.currentForm) {
            this.currentForm.destroy();
            this.currentForm = null;
        }
        
        if (this.currentList) {
            this.currentList.destroy();
            this.currentList = null;
        }

        this.clearPendingChanges();
    }

    destroy() {
        this.cleanup();
        
        if (this.projectManager) {
            this.projectManager.destroy();
        }

        // Clear timers
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('popstate', this.handlePopState);

        console.log('ProjectController destroyed');
    }
}