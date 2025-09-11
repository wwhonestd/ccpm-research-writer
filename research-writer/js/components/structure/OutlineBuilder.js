/**
 * OutlineBuilder - Interactive outline editor with drag-and-drop functionality
 */
import { OutlineNode, OutlineUtils } from './OutlineNode.js';
import { DragDropManager } from './DragDropManager.js';
import { StorageService } from '../../services/StorageService.js';

export class OutlineBuilder {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        if (!this.container) {
            throw new Error('OutlineBuilder: Container element not found');
        }

        this.options = {
            autoSave: true,
            autoSaveDelay: 2000,
            maxDepth: 6,
            enableDragDrop: true,
            showWordCounts: true,
            showValidation: true,
            projectId: null,
            ...options
        };

        // Initialize data
        this.outline = new OutlineNode({
            id: 'root',
            title: 'Document Outline',
            level: 0
        });

        this.selectedNode = null;
        this.editingNode = null;
        this.clipboard = null;
        
        // Auto-save state
        this.saveStatus = 'saved'; // 'saving', 'saved', 'error'
        this.autoSaveTimeout = null;
        this.hasUnsavedChanges = false;

        // Event system
        this.eventListeners = {};
        
        // Initialize components
        this.storage = new StorageService();
        this.dragDropManager = null;

        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
        
        if (this.options.enableDragDrop) {
            this.dragDropManager = new DragDropManager(this);
        }

        this.loadOutline();
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

    // Rendering methods
    render() {
        this.container.className = 'outline-builder';
        this.container.innerHTML = this.getHTML();
        
        // Cache DOM elements
        this.elements = {
            header: this.container.querySelector('.outline-builder__header'),
            tree: this.container.querySelector('.outline-tree'),
            stats: this.container.querySelector('.outline-stats'),
            saveStatus: this.container.querySelector('.outline-save-status'),
            validation: this.container.querySelector('.outline-validation')
        };

        this.updateStats();
        this.updateSaveStatus();
    }

    getHTML() {
        return `
            <div class="outline-builder__header">
                <h3 class="outline-builder__title">Document Outline</h3>
                <div class="outline-builder__actions">
                    <button class="outline-builder__btn" data-action="add-root">
                        Add Section
                    </button>
                    <button class="outline-builder__btn outline-builder__btn--secondary" data-action="import">
                        Import
                    </button>
                    <button class="outline-builder__btn outline-builder__btn--secondary" data-action="export">
                        Export
                    </button>
                    <button class="outline-builder__btn outline-builder__btn--secondary" data-action="validate">
                        Validate
                    </button>
                </div>
            </div>
            
            <div class="outline-save-status">Saved</div>
            
            <div class="outline-tree">
                ${this.renderOutlineTree()}
            </div>
            
            <div class="outline-stats">
                <div class="outline-stats__item">
                    <span>Sections:</span>
                    <span class="outline-stats__value" data-stat="sections">0</span>
                </div>
                <div class="outline-stats__item">
                    <span>Depth:</span>
                    <span class="outline-stats__value" data-stat="depth">0</span>
                </div>
                <div class="outline-stats__item">
                    <span>Words:</span>
                    <span class="outline-stats__value" data-stat="words">0</span>
                </div>
                <div class="outline-stats__item">
                    <span>Allocated:</span>
                    <span class="outline-stats__value" data-stat="allocated">0</span>
                </div>
            </div>
            
            <div class="outline-validation"></div>
        `;
    }

    renderOutlineTree() {
        if (this.outline.children.length === 0) {
            return `
                <div class="outline-tree--empty">
                    <div class="outline-drop-zone" data-level="1">
                        Click "Add Section" or drag content here to start building your outline
                    </div>
                </div>
            `;
        }

        return this.outline.children.map(node => this.renderNode(node)).join('');
    }

    renderNode(node) {
        const hasChildren = node.children.length > 0;
        const isSelected = this.selectedNode && this.selectedNode.id === node.id;
        const isEditing = this.editingNode && this.editingNode.id === node.id;
        const wordCountStatus = node.getWordCountStatus();
        
        const nodeClasses = [
            'outline-node__content',
            isSelected ? 'outline-node__content--selected' : '',
            isEditing ? 'outline-node__content--editing' : ''
        ].filter(Boolean).join(' ');

        const childrenHTML = hasChildren && !node.collapsed 
            ? `<div class="outline-node__children${hasChildren ? '' : ' outline-node__children--empty'}">
                ${node.children.map(child => this.renderNode(child)).join('')}
               </div>`
            : '';

        return `
            <div class="outline-node" data-node-id="${node.id}" data-level="${node.level}">
                <div class="${nodeClasses}" data-node-id="${node.id}">
                    ${'.'.repeat(node.getIndentLevel())}
                    
                    <button class="outline-node__toggle ${hasChildren 
                        ? (node.collapsed ? 'outline-node__toggle--collapsed' : 'outline-node__toggle--expanded')
                        : 'outline-node__toggle--leaf'
                    }" 
                    data-action="toggle" data-node-id="${node.id}">
                    </button>
                    
                    <span class="outline-node__level">${node.level}</span>
                    
                    <div class="outline-node__title" 
                         contenteditable="${isEditing}" 
                         data-node-id="${node.id}"
                         data-action="edit-title">
                        ${node.getDisplayTitle()}
                    </div>
                    
                    ${this.options.showWordCounts ? `
                        <div class="outline-node__word-count outline-node__word-count--${wordCountStatus}">
                            ${node.wordCount}/${node.allocatedWords}
                        </div>
                    ` : ''}
                    
                    <div class="outline-node__actions">
                        <button class="outline-node__action outline-node__action--add" 
                                data-action="add-child" 
                                data-node-id="${node.id}" 
                                title="Add child section">+</button>
                        <button class="outline-node__action" 
                                data-action="remove" 
                                data-node-id="${node.id}" 
                                title="Remove section">×</button>
                    </div>
                </div>
                
                ${childrenHTML}
            </div>
        `;
    }

    // Event handling
    bindEvents() {
        // Action button events
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const nodeId = e.target.dataset.nodeId;
            
            switch (action) {
                case 'add-root':
                    this.addRootNode();
                    break;
                case 'add-child':
                    this.addChildNode(nodeId);
                    break;
                case 'remove':
                    this.removeNode(nodeId);
                    break;
                case 'toggle':
                    this.toggleNode(nodeId);
                    break;
                case 'import':
                    this.showImportDialog();
                    break;
                case 'export':
                    this.showExportDialog();
                    break;
                case 'validate':
                    this.validateOutline();
                    break;
            }
        });

        // Double-click to edit
        this.container.addEventListener('dblclick', (e) => {
            const nodeElement = e.target.closest('.outline-node__content');
            if (nodeElement) {
                const nodeId = nodeElement.dataset.nodeId;
                this.startEditing(nodeId);
            }
        });

        // Click to select
        this.container.addEventListener('click', (e) => {
            const nodeElement = e.target.closest('.outline-node__content');
            if (nodeElement && !e.target.dataset.action) {
                const nodeId = nodeElement.dataset.nodeId;
                this.selectNode(nodeId);
            }
        });

        // Title editing events
        this.container.addEventListener('blur', (e) => {
            if (e.target.classList.contains('outline-node__title') && 
                e.target.contentEditable === 'true') {
                this.finishEditing(e.target.dataset.nodeId, e.target.textContent.trim());
            }
        }, true);

        this.container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('outline-node__title') && 
                e.target.contentEditable === 'true') {
                this.handleEditingKeydown(e);
            } else {
                this.handleKeyboardShortcuts(e);
            }
        });

        // Auto-save on changes
        this.on('change', () => {
            this.markAsChanged();
            this.scheduleAutoSave();
        });
    }

    handleEditingKeydown(e) {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.finishEditing(e.target.dataset.nodeId, e.target.textContent.trim());
                break;
            case 'Escape':
                e.preventDefault();
                this.cancelEditing();
                break;
        }
    }

    handleKeyboardShortcuts(e) {
        if (!this.selectedNode) return;

        // Ctrl/Cmd combinations
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'c':
                    e.preventDefault();
                    this.copyNode();
                    break;
                case 'x':
                    e.preventDefault();
                    this.cutNode();
                    break;
                case 'v':
                    e.preventDefault();
                    this.pasteNode();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveOutline();
                    break;
            }
        }

        // Regular keys
        switch (e.key) {
            case 'Delete':
                e.preventDefault();
                this.removeNode(this.selectedNode.id);
                break;
            case 'F2':
                e.preventDefault();
                this.startEditing(this.selectedNode.id);
                break;
            case 'Tab':
                e.preventDefault();
                if (e.shiftKey) {
                    this.promoteNode(this.selectedNode.id);
                } else {
                    this.demoteNode(this.selectedNode.id);
                }
                break;
        }
    }

    // Node operations
    addRootNode() {
        const node = this.outline.addChild({
            title: 'New Section',
            level: 1
        });
        
        this.refresh();
        this.selectNode(node.id);
        this.startEditing(node.id);
        this.emit('change', { type: 'add', node });
        
        return node;
    }

    addChildNode(parentId) {
        const parent = this.findNode(parentId);
        if (!parent) return null;

        const node = parent.addChild({
            title: 'New Subsection',
            level: parent.level + 1
        });
        
        // Expand parent if collapsed
        if (parent.collapsed) {
            parent.collapsed = false;
        }
        
        this.refresh();
        this.selectNode(node.id);
        this.startEditing(node.id);
        this.emit('change', { type: 'add', node, parent });
        
        return node;
    }

    removeNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node === this.outline) return false;

        const parent = this.outline.findParent(nodeId);
        if (!parent) return false;

        // Confirm deletion if node has children
        if (node.children.length > 0) {
            const message = `Delete "${node.title}" and all ${node.children.length} subsections?`;
            if (!confirm(message)) return false;
        }

        const removed = parent.removeChild(nodeId);
        if (removed) {
            // Clear selection if removed node was selected
            if (this.selectedNode && this.selectedNode.id === nodeId) {
                this.selectedNode = null;
            }
            
            this.refresh();
            this.emit('change', { type: 'remove', node: removed, parent });
        }
        
        return removed;
    }

    toggleNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node.children.length === 0) return;

        node.collapsed = !node.collapsed;
        this.refresh();
        this.emit('change', { type: 'toggle', node });
    }

    // Node editing
    selectNode(nodeId) {
        this.selectedNode = this.findNode(nodeId);
        this.refresh();
        this.emit('nodeSelect', { node: this.selectedNode });
    }

    startEditing(nodeId) {
        this.finishEditing(); // Finish any current editing
        
        this.editingNode = this.findNode(nodeId);
        this.refresh();
        
        // Focus the title element
        setTimeout(() => {
            const titleElement = this.container.querySelector(
                `.outline-node__title[data-node-id="${nodeId}"]`
            );
            if (titleElement) {
                titleElement.focus();
                this.selectAllText(titleElement);
            }
        }, 0);
    }

    finishEditing(nodeId, newTitle) {
        if (!this.editingNode || this.editingNode.id !== nodeId) return;

        if (newTitle && newTitle !== this.editingNode.title) {
            this.editingNode.title = newTitle;
            this.editingNode.updated = new Date().toISOString();
            this.emit('change', { type: 'edit', node: this.editingNode });
        }

        this.editingNode = null;
        this.refresh();
    }

    cancelEditing() {
        this.editingNode = null;
        this.refresh();
    }

    selectAllText(element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Node movement methods
    moveNodeBefore(nodeId, targetId) {
        const node = this.findNode(nodeId);
        const target = this.findNode(targetId);
        if (!node || !target || node === target) return false;

        const nodeParent = this.outline.findParent(nodeId);
        const targetParent = this.outline.findParent(targetId);
        if (!nodeParent || !targetParent) return false;

        // Remove from current parent
        const removed = nodeParent.removeChild(nodeId);
        if (!removed) return false;

        // Insert before target
        const targetIndex = targetParent.children.findIndex(child => child.id === targetId);
        targetParent.children.splice(targetIndex, 0, removed);
        
        // Update relationships
        removed.parentId = targetParent.id;
        removed.level = targetParent.level + 1;
        targetParent.reorderChildren();

        this.refresh();
        this.emit('change', { type: 'move', node: removed, target });
        return true;
    }

    moveNodeAfter(nodeId, targetId) {
        const node = this.findNode(nodeId);
        const target = this.findNode(targetId);
        if (!node || !target || node === target) return false;

        const nodeParent = this.outline.findParent(nodeId);
        const targetParent = this.outline.findParent(targetId);
        if (!nodeParent || !targetParent) return false;

        // Remove from current parent
        const removed = nodeParent.removeChild(nodeId);
        if (!removed) return false;

        // Insert after target
        const targetIndex = targetParent.children.findIndex(child => child.id === targetId);
        targetParent.children.splice(targetIndex + 1, 0, removed);
        
        // Update relationships
        removed.parentId = targetParent.id;
        removed.level = targetParent.level + 1;
        targetParent.reorderChildren();

        this.refresh();
        this.emit('change', { type: 'move', node: removed, target });
        return true;
    }

    moveNodeInside(nodeId, targetId) {
        const node = this.findNode(nodeId);
        const target = this.findNode(targetId);
        if (!node || !target || node === target) return false;

        const nodeParent = this.outline.findParent(nodeId);
        if (!nodeParent) return false;

        // Remove from current parent
        const removed = nodeParent.removeChild(nodeId);
        if (!removed) return false;

        // Add as child of target
        const child = target.addChild(removed.toJSON());
        
        this.refresh();
        this.emit('change', { type: 'move', node: child, target });
        return true;
    }

    moveNodeUp(nodeId) {
        const node = this.findNode(nodeId);
        const parent = this.outline.findParent(nodeId);
        if (!node || !parent) return false;

        const currentIndex = parent.children.findIndex(child => child.id === nodeId);
        if (currentIndex <= 0) return false;

        return parent.moveChild(nodeId, currentIndex - 1);
    }

    moveNodeDown(nodeId) {
        const node = this.findNode(nodeId);
        const parent = this.outline.findParent(nodeId);
        if (!node || !parent) return false;

        const currentIndex = parent.children.findIndex(child => child.id === nodeId);
        if (currentIndex >= parent.children.length - 1) return false;

        return parent.moveChild(nodeId, currentIndex + 1);
    }

    promoteNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node.level <= 1) return false;

        node.promote();
        this.refresh();
        this.emit('change', { type: 'promote', node });
        return true;
    }

    demoteNode(nodeId) {
        const node = this.findNode(nodeId);
        if (!node || node.level >= this.options.maxDepth) return false;

        node.demote();
        this.refresh();
        this.emit('change', { type: 'demote', node });
        return true;
    }

    // Clipboard operations
    copyNode() {
        if (!this.selectedNode) return;
        this.clipboard = this.selectedNode.clone(true);
        this.emit('copy', { node: this.clipboard });
    }

    cutNode() {
        if (!this.selectedNode) return;
        this.clipboard = this.selectedNode.clone(true);
        this.removeNode(this.selectedNode.id);
        this.emit('cut', { node: this.clipboard });
    }

    pasteNode() {
        if (!this.clipboard || !this.selectedNode) return;
        
        const cloned = this.clipboard.clone(true);
        this.selectedNode.addChild(cloned);
        this.refresh();
        this.emit('change', { type: 'paste', node: cloned, parent: this.selectedNode });
        return cloned;
    }

    // Utility methods
    findNode(nodeId) {
        return this.outline.findNode(nodeId);
    }

    refresh() {
        const tree = this.container.querySelector('.outline-tree');
        tree.innerHTML = this.renderOutlineTree();
        this.updateStats();
        this.updateValidation();
    }

    updateStats() {
        const stats = this.outline.getStats();
        const statsElements = this.container.querySelectorAll('[data-stat]');
        
        statsElements.forEach(element => {
            const stat = element.dataset.stat;
            switch (stat) {
                case 'sections':
                    element.textContent = stats.totalNodes - 1; // Exclude root
                    break;
                case 'depth':
                    element.textContent = Math.max(0, stats.depth - 1);
                    break;
                case 'words':
                    element.textContent = stats.totalWords;
                    break;
                case 'allocated':
                    element.textContent = stats.totalAllocated;
                    break;
            }
        });
    }

    updateValidation() {
        if (!this.options.showValidation) return;

        const validation = OutlineUtils.validateStructure(this.outline);
        const validationElement = this.elements.validation;
        
        if (validation.errors.length > 0 || validation.structureWarnings.length > 0) {
            const messages = [...validation.errors, ...validation.structureWarnings];
            validationElement.innerHTML = messages.map(msg => 
                `<div class="outline-validation--${validation.errors.includes(msg) ? 'error' : 'warning'}">${msg}</div>`
            ).join('');
        } else {
            validationElement.innerHTML = '';
        }
    }

    validateOutline() {
        this.updateValidation();
        const validation = OutlineUtils.validateStructure(this.outline);
        
        this.emit('validate', validation);
        
        if (validation.isValid) {
            this.showMessage('Outline structure is valid!', 'success');
        } else {
            this.showMessage(`Found ${validation.errors.length} errors and ${validation.structureWarnings.length} warnings`, 'warning');
        }
    }

    showMessage(message, type = 'info') {
        // Simple message display - could be enhanced with a toast system
        const messageDiv = document.createElement('div');
        messageDiv.className = `outline-validation outline-validation--${type}`;
        messageDiv.textContent = message;
        
        this.elements.validation.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    // Auto-save functionality
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.saveStatus = 'unsaved';
        this.updateSaveStatus();
    }

    scheduleAutoSave() {
        if (!this.options.autoSave) return;
        
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveOutline();
        }, this.options.autoSaveDelay);
    }

    updateSaveStatus() {
        const statusElement = this.elements.saveStatus;
        if (!statusElement) return;

        statusElement.className = `outline-save-status outline-save-status--${this.saveStatus}`;
        
        switch (this.saveStatus) {
            case 'saving':
                statusElement.textContent = 'Saving...';
                break;
            case 'saved':
                statusElement.textContent = 'Saved';
                break;
            case 'error':
                statusElement.textContent = 'Save failed';
                break;
            case 'unsaved':
                statusElement.textContent = 'Unsaved changes';
                break;
        }
    }

    // Data persistence
    saveOutline() {
        if (!this.hasUnsavedChanges) return Promise.resolve();
        
        this.saveStatus = 'saving';
        this.updateSaveStatus();

        const outlineData = {
            id: this.options.projectId || 'default_outline',
            outline: this.outline.toJSON(),
            created: this.outline.created,
            updated: new Date().toISOString(),
            metadata: {
                version: '1.0.0',
                builder: 'OutlineBuilder'
            }
        };

        try {
            this.storage.update('outlines', outlineData.id, outlineData);
            this.saveStatus = 'saved';
            this.hasUnsavedChanges = false;
            this.emit('save', { outline: outlineData });
        } catch (error) {
            this.saveStatus = 'error';
            console.error('Failed to save outline:', error);
            this.emit('saveError', { error });
        }

        this.updateSaveStatus();
        return Promise.resolve();
    }

    loadOutline(outlineId = null) {
        const id = outlineId || this.options.projectId || 'default_outline';
        
        try {
            const outlineData = this.storage.read('outlines', id);
            if (outlineData && outlineData.outline) {
                this.outline = OutlineNode.fromJSON(outlineData.outline);
                this.hasUnsavedChanges = false;
                this.saveStatus = 'saved';
                this.refresh();
                this.emit('load', { outline: outlineData });
            }
        } catch (error) {
            console.error('Failed to load outline:', error);
            this.emit('loadError', { error });
        }
    }

    // Import/Export functionality
    showImportDialog() {
        const input = document.createElement('textarea');
        input.placeholder = 'Paste your outline text here (markdown format supported)...';
        input.style.width = '100%';
        input.style.height = '200px';
        input.style.margin = '10px 0';

        const dialog = this.createDialog('Import Outline', [
            { type: 'element', element: input },
            { type: 'button', text: 'Import', primary: true, action: () => {
                this.importOutline(input.value);
                this.closeDialog(dialog);
            }},
            { type: 'button', text: 'Cancel', action: () => this.closeDialog(dialog) }
        ]);
    }

    importOutline(text) {
        try {
            const imported = OutlineUtils.generateOutlineFromText(text);
            if (imported.children.length > 0) {
                // Replace current outline
                this.outline = imported;
                this.refresh();
                this.emit('change', { type: 'import', outline: imported });
                this.showMessage('Outline imported successfully!', 'success');
            } else {
                this.showMessage('No valid outline structure found in the text', 'warning');
            }
        } catch (error) {
            console.error('Import failed:', error);
            this.showMessage('Failed to import outline: ' + error.message, 'error');
        }
    }

    showExportDialog() {
        const formats = ['markdown', 'json', 'text'];
        const select = document.createElement('select');
        formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            select.appendChild(option);
        });

        const output = document.createElement('textarea');
        output.style.width = '100%';
        output.style.height = '300px';
        output.style.margin = '10px 0';
        output.readOnly = true;

        select.addEventListener('change', () => {
            output.value = this.exportOutline(select.value);
        });

        // Initial export
        output.value = this.exportOutline('markdown');

        const dialog = this.createDialog('Export Outline', [
            { type: 'label', text: 'Format:' },
            { type: 'element', element: select },
            { type: 'element', element: output },
            { type: 'button', text: 'Copy to Clipboard', primary: true, action: () => {
                output.select();
                document.execCommand('copy');
                this.showMessage('Copied to clipboard!', 'success');
            }},
            { type: 'button', text: 'Close', action: () => this.closeDialog(dialog) }
        ]);
    }

    exportOutline(format = 'markdown') {
        switch (format) {
            case 'markdown':
                return OutlineUtils.exportToMarkdown(this.outline);
            case 'json':
                return JSON.stringify(this.outline.toJSON(), null, 2);
            case 'text':
                return this.exportToText(this.outline);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    exportToText(node, indent = '') {
        let text = '';
        if (node.level > 0) {
            text += `${indent}${node.title}\n`;
        }
        
        node.children.forEach(child => {
            text += this.exportToText(child, indent + '  ');
        });
        
        return text;
    }

    // Dialog helpers
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
                button.className = element.primary ? 'outline-builder__btn' : 'outline-builder__btn outline-builder__btn--secondary';
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

    // Public API for external integration (Stream C will use these)
    getOutlineData() {
        return this.outline.toJSON();
    }

    setOutlineData(data) {
        this.outline = OutlineNode.fromJSON(data);
        this.refresh();
        this.emit('change', { type: 'load', outline: this.outline });
    }

    getNodeById(nodeId) {
        return this.findNode(nodeId);
    }

    updateNodeWordCount(nodeId, wordCount) {
        const node = this.findNode(nodeId);
        if (node) {
            node.updateWordCount(wordCount);
            this.refresh();
            this.emit('change', { type: 'wordCount', node, wordCount });
        }
    }

    allocateWordsToNode(nodeId, allocatedWords) {
        const node = this.findNode(nodeId);
        if (node) {
            node.allocateWords(allocatedWords);
            this.refresh();
            this.emit('change', { type: 'allocateWords', node, allocatedWords });
        }
    }

    getOutlineStats() {
        return this.outline.getStats();
    }

    // Cleanup
    destroy() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        if (this.dragDropManager) {
            this.dragDropManager.destroy();
        }

        // Save before destroying
        if (this.hasUnsavedChanges) {
            this.saveOutline();
        }

        this.eventListeners = {};
        this.container.innerHTML = '';
    }
}