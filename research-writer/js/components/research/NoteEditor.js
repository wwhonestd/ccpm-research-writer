/**
 * NoteEditor - Rich text editor component for note creation and editing
 * Features: markdown support, real-time preview, autosave, accessibility
 */

import { Note } from '../../models/Note.js';

export class NoteEditor {
    constructor(container, noteManager, options = {}) {
        this.container = container;
        this.noteManager = noteManager;
        this.options = {
            autosave: true,
            autosaveDelay: 2000,
            showPreview: false,
            showWordCount: true,
            maxLength: 50000,
            placeholder: 'Start writing your note...',
            ...options
        };
        
        this.currentNote = null;
        this.isEditing = false;
        this.isDirty = false;
        this.autosaveTimer = null;
        this.lastSaved = null;
        
        // Editor elements
        this.elements = {};
        
        // Event callbacks
        this.onSave = options.onSave || (() => {});
        this.onCancel = options.onCancel || (() => {});
        this.onChange = options.onChange || (() => {});
        
        this.init();
    }

    /**
     * Initialize the editor UI
     */
    init() {
        this.render();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupAccessibility();
        
        if (this.options.note) {
            this.loadNote(this.options.note);
        }
    }

    /**
     * Render the editor interface
     */
    render() {
        this.container.innerHTML = `
            <div class="note-editor" role="region" aria-label="Note Editor">
                <div class="editor-header">
                    <div class="editor-title-section">
                        <input type="text" 
                               class="note-title-input" 
                               placeholder="Note title..." 
                               maxlength="500"
                               aria-label="Note title">
                    </div>
                    
                    <div class="editor-toolbar">
                        <div class="toolbar-group">
                            <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)" aria-label="Bold text">
                                <strong>B</strong>
                            </button>
                            <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)" aria-label="Italic text">
                                <em>I</em>
                            </button>
                            <button class="toolbar-btn" data-action="link" title="Insert Link (Ctrl+K)" aria-label="Insert link">
                                🔗
                            </button>
                            <button class="toolbar-btn" data-action="quote" title="Quote (Ctrl+Q)" aria-label="Block quote">
                                "
                            </button>
                            <button class="toolbar-btn" data-action="list" title="Bullet List" aria-label="Bullet list">
                                •
                            </button>
                            <button class="toolbar-btn" data-action="numbered-list" title="Numbered List" aria-label="Numbered list">
                                1.
                            </button>
                        </div>
                        
                        <div class="toolbar-group">
                            <button class="toolbar-btn toggle-btn ${this.options.showPreview ? 'active' : ''}" 
                                    data-action="toggle-preview" 
                                    title="Toggle Preview" 
                                    aria-label="Toggle markdown preview"
                                    aria-pressed="${this.options.showPreview}">
                                👁️
                            </button>
                            <button class="toolbar-btn" data-action="fullscreen" title="Fullscreen (F11)" aria-label="Fullscreen mode">
                                ⛶
                            </button>
                        </div>
                    </div>
                </div>

                <div class="editor-content">
                    <div class="editor-main ${this.options.showPreview ? 'split-view' : ''}">
                        <div class="editor-pane">
                            <textarea class="note-content-editor" 
                                      placeholder="${this.options.placeholder}"
                                      maxlength="${this.options.maxLength}"
                                      aria-label="Note content"
                                      spellcheck="true"></textarea>
                        </div>
                        
                        ${this.options.showPreview ? `
                        <div class="preview-pane">
                            <div class="preview-content" aria-label="Markdown preview"></div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="editor-metadata">
                    <div class="metadata-section">
                        <label class="metadata-label">
                            Type:
                            <select class="note-type-select" aria-label="Note type">
                                <option value="general">General</option>
                                <option value="quote">Quote</option>
                                <option value="summary">Summary</option>
                                <option value="analysis">Analysis</option>
                                <option value="idea">Idea</option>
                                <option value="todo">To-Do</option>
                                <option value="question">Question</option>
                            </select>
                        </label>
                        
                        <label class="metadata-label">
                            Category:
                            <input type="text" 
                                   class="note-category-input" 
                                   placeholder="Category..."
                                   list="category-suggestions"
                                   aria-label="Note category">
                            <datalist id="category-suggestions"></datalist>
                        </label>
                    </div>
                    
                    <div class="metadata-section">
                        <label class="metadata-label">
                            Tags:
                            <div class="tag-input-container">
                                <input type="text" 
                                       class="tag-input" 
                                       placeholder="Add tags..."
                                       aria-label="Add tags">
                                <div class="current-tags" aria-label="Current tags"></div>
                            </div>
                        </label>
                    </div>
                    
                    <div class="metadata-section">
                        <label class="metadata-label">
                            Source Quote:
                            <textarea class="source-quote-input" 
                                      placeholder="Quote from source material..."
                                      maxlength="2000"
                                      rows="2"
                                      aria-label="Source quote"></textarea>
                        </label>
                    </div>
                </div>

                <div class="editor-footer">
                    <div class="editor-stats">
                        ${this.options.showWordCount ? `
                        <span class="word-count" aria-label="Word count">0 words</span>
                        <span class="char-count" aria-label="Character count">0 characters</span>
                        ` : ''}
                        <span class="save-status" aria-live="polite"></span>
                    </div>
                    
                    <div class="editor-actions">
                        <button class="btn btn-secondary cancel-btn" aria-label="Cancel editing">
                            Cancel
                        </button>
                        <button class="btn btn-primary save-btn" aria-label="Save note">
                            Save Note
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Store element references
        this.elements = {
            titleInput: this.container.querySelector('.note-title-input'),
            contentEditor: this.container.querySelector('.note-content-editor'),
            typeSelect: this.container.querySelector('.note-type-select'),
            categoryInput: this.container.querySelector('.note-category-input'),
            tagInput: this.container.querySelector('.tag-input'),
            currentTags: this.container.querySelector('.current-tags'),
            sourceQuoteInput: this.container.querySelector('.source-quote-input'),
            previewContent: this.container.querySelector('.preview-content'),
            wordCount: this.container.querySelector('.word-count'),
            charCount: this.container.querySelector('.char-count'),
            saveStatus: this.container.querySelector('.save-status'),
            saveBtn: this.container.querySelector('.save-btn'),
            cancelBtn: this.container.querySelector('.cancel-btn'),
            toolbar: this.container.querySelector('.editor-toolbar'),
            editorMain: this.container.querySelector('.editor-main')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Content change events
        this.elements.titleInput.addEventListener('input', () => this.handleContentChange());
        this.elements.contentEditor.addEventListener('input', () => this.handleContentChange());
        this.elements.typeSelect.addEventListener('change', () => this.handleContentChange());
        this.elements.categoryInput.addEventListener('input', () => this.handleContentChange());
        this.elements.sourceQuoteInput.addEventListener('input', () => this.handleContentChange());

        // Tag input handling
        this.elements.tagInput.addEventListener('keydown', (e) => this.handleTagInput(e));

        // Toolbar actions
        this.elements.toolbar.addEventListener('click', (e) => {
            const action = e.target.closest('.toolbar-btn')?.dataset.action;
            if (action) {
                this.handleToolbarAction(action, e.target);
            }
        });

        // Action buttons
        this.elements.saveBtn.addEventListener('click', () => this.saveNote());
        this.elements.cancelBtn.addEventListener('click', () => this.cancelEditing());

        // Auto-resize textarea
        this.elements.contentEditor.addEventListener('input', () => {
            this.autoResize(this.elements.contentEditor);
        });

        // Category suggestions
        this.setupCategorySuggestions();
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this.container.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.handleToolbarAction('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.handleToolbarAction('italic');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.handleToolbarAction('link');
                        break;
                    case 'q':
                        e.preventDefault();
                        this.handleToolbarAction('quote');
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveNote();
                        break;
                }
            } else if (e.key === 'F11') {
                e.preventDefault();
                this.handleToolbarAction('fullscreen');
            } else if (e.key === 'Escape' && this.isFullscreen()) {
                this.exitFullscreen();
            }
        });
    }

    /**
     * Set up accessibility features
     */
    setupAccessibility() {
        // Add ARIA live region for editor status
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.id = 'editor-live-region';
        this.container.appendChild(liveRegion);

        // Announce editor state changes
        this.announceToScreenReader('Note editor loaded and ready');
    }

    /**
     * Handle content changes
     */
    handleContentChange() {
        this.isDirty = true;
        this.updateStats();
        this.updatePreview();
        this.updateSaveStatus();
        
        if (this.options.autosave) {
            this.scheduleAutosave();
        }

        // Notify callback
        this.onChange(this.getCurrentNoteData());
    }

    /**
     * Handle tag input
     */
    handleTagInput(e) {
        if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
            e.preventDefault();
            this.addTag(this.elements.tagInput.value.trim());
        } else if (e.key === 'Backspace' && !this.elements.tagInput.value) {
            this.removeLastTag();
        }
    }

    /**
     * Add a tag
     */
    addTag(tagValue) {
        if (!tagValue || tagValue.length > 50) return;

        const currentTags = this.getCurrentTags();
        if (!currentTags.includes(tagValue)) {
            currentTags.push(tagValue);
            this.renderTags(currentTags);
            this.elements.tagInput.value = '';
            this.handleContentChange();
        }
    }

    /**
     * Remove a tag
     */
    removeTag(tagToRemove) {
        const currentTags = this.getCurrentTags().filter(tag => tag !== tagToRemove);
        this.renderTags(currentTags);
        this.handleContentChange();
    }

    /**
     * Remove the last tag
     */
    removeLastTag() {
        const currentTags = this.getCurrentTags();
        if (currentTags.length > 0) {
            currentTags.pop();
            this.renderTags(currentTags);
            this.handleContentChange();
        }
    }

    /**
     * Get current tags
     */
    getCurrentTags() {
        const tagElements = this.elements.currentTags.querySelectorAll('.tag');
        return Array.from(tagElements).map(el => el.textContent.replace('×', '').trim());
    }

    /**
     * Render tags
     */
    renderTags(tags) {
        this.elements.currentTags.innerHTML = tags.map(tag => `
            <span class="tag" role="button" tabindex="0" aria-label="Remove ${tag} tag">
                ${tag}
                <button class="tag-remove" onclick="this.closest('.note-editor').noteEditor.removeTag('${tag}')" aria-label="Remove">×</button>
            </span>
        `).join('');
    }

    /**
     * Handle toolbar actions
     */
    handleToolbarAction(action, button = null) {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);

        let replacement = '';
        let cursorOffset = 0;

        switch (action) {
            case 'bold':
                replacement = `**${selectedText || 'bold text'}**`;
                cursorOffset = selectedText ? 0 : -11;
                break;
            case 'italic':
                replacement = `*${selectedText || 'italic text'}*`;
                cursorOffset = selectedText ? 0 : -12;
                break;
            case 'link':
                const url = selectedText.startsWith('http') ? selectedText : 'https://example.com';
                const linkText = selectedText.startsWith('http') ? 'link text' : selectedText || 'link text';
                replacement = `[${linkText}](${url})`;
                cursorOffset = selectedText ? 0 : -13;
                break;
            case 'quote':
                replacement = `> ${selectedText || 'quoted text'}`;
                cursorOffset = selectedText ? 0 : -12;
                break;
            case 'list':
                replacement = `- ${selectedText || 'list item'}`;
                cursorOffset = selectedText ? 0 : -10;
                break;
            case 'numbered-list':
                replacement = `1. ${selectedText || 'list item'}`;
                cursorOffset = selectedText ? 0 : -10;
                break;
            case 'toggle-preview':
                this.togglePreview(button);
                return;
            case 'fullscreen':
                this.toggleFullscreen();
                return;
        }

        if (replacement) {
            const newValue = editor.value.substring(0, start) + replacement + editor.value.substring(end);
            editor.value = newValue;
            
            const newPosition = start + replacement.length + cursorOffset;
            editor.setSelectionRange(newPosition, newPosition);
            editor.focus();
            
            this.handleContentChange();
        }
    }

    /**
     * Toggle preview mode
     */
    togglePreview(button) {
        this.options.showPreview = !this.options.showPreview;
        
        if (this.options.showPreview) {
            this.elements.editorMain.classList.add('split-view');
            this.elements.editorMain.innerHTML += `
                <div class="preview-pane">
                    <div class="preview-content" aria-label="Markdown preview"></div>
                </div>
            `;
            this.elements.previewContent = this.container.querySelector('.preview-content');
            this.updatePreview();
        } else {
            this.elements.editorMain.classList.remove('split-view');
            const previewPane = this.elements.editorMain.querySelector('.preview-pane');
            if (previewPane) {
                previewPane.remove();
            }
        }

        if (button) {
            button.classList.toggle('active', this.options.showPreview);
            button.setAttribute('aria-pressed', this.options.showPreview);
        }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const editor = this.container.querySelector('.note-editor');
        
        if (this.isFullscreen()) {
            this.exitFullscreen();
        } else {
            editor.classList.add('fullscreen');
            this.announceToScreenReader('Entered fullscreen mode. Press Escape to exit.');
        }
    }

    /**
     * Check if in fullscreen mode
     */
    isFullscreen() {
        return this.container.querySelector('.note-editor').classList.contains('fullscreen');
    }

    /**
     * Exit fullscreen mode
     */
    exitFullscreen() {
        const editor = this.container.querySelector('.note-editor');
        editor.classList.remove('fullscreen');
        this.announceToScreenReader('Exited fullscreen mode.');
    }

    /**
     * Update word and character count
     */
    updateStats() {
        if (!this.options.showWordCount) return;

        const content = this.elements.contentEditor.value;
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        const charCount = content.length;

        if (this.elements.wordCount) {
            this.elements.wordCount.textContent = `${wordCount} words`;
        }
        if (this.elements.charCount) {
            this.elements.charCount.textContent = `${charCount} characters`;
        }
    }

    /**
     * Update markdown preview
     */
    updatePreview() {
        if (!this.options.showPreview || !this.elements.previewContent) return;

        const content = this.elements.contentEditor.value;
        const htmlContent = this.markdownToHtml(content);
        this.elements.previewContent.innerHTML = htmlContent;
    }

    /**
     * Simple markdown to HTML conversion
     */
    markdownToHtml(markdown) {
        return markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            // Block quotes
            .replace(/^> (.*)$/gim, '<blockquote>$1</blockquote>')
            // Lists
            .replace(/^\- (.*)$/gim, '<li>$1</li>')
            .replace(/^(\d+)\. (.*)$/gim, '<li>$2</li>')
            // Line breaks
            .replace(/\n/gim, '<br>');
    }

    /**
     * Auto-resize textarea
     */
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 500) + 'px';
    }

    /**
     * Set up category suggestions
     */
    async setupCategorySuggestions() {
        try {
            const categories = this.noteManager.getAllCategories();
            const datalist = this.container.querySelector('#category-suggestions');
            datalist.innerHTML = categories.map(cat => `<option value="${cat}">`).join('');
        } catch (error) {
            console.error('Failed to setup category suggestions:', error);
        }
    }

    /**
     * Schedule autosave
     */
    scheduleAutosave() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }

        this.autosaveTimer = setTimeout(() => {
            this.autosave();
        }, this.options.autosaveDelay);
    }

    /**
     * Autosave the note
     */
    async autosave() {
        if (!this.isDirty || !this.currentNote) return;

        try {
            const noteData = this.getCurrentNoteData();
            await this.noteManager.updateNote(this.currentNote.id, noteData);
            this.lastSaved = new Date();
            this.isDirty = false;
            this.updateSaveStatus('autosaved');
        } catch (error) {
            console.error('Autosave failed:', error);
            this.updateSaveStatus('error');
        }
    }

    /**
     * Update save status display
     */
    updateSaveStatus(status = null) {
        if (!this.elements.saveStatus) return;

        if (status === 'autosaved') {
            this.elements.saveStatus.textContent = `Autosaved at ${this.lastSaved.toLocaleTimeString()}`;
            this.elements.saveStatus.className = 'save-status saved';
        } else if (status === 'saved') {
            this.elements.saveStatus.textContent = 'Saved';
            this.elements.saveStatus.className = 'save-status saved';
        } else if (status === 'error') {
            this.elements.saveStatus.textContent = 'Save failed';
            this.elements.saveStatus.className = 'save-status error';
        } else if (this.isDirty) {
            this.elements.saveStatus.textContent = 'Unsaved changes';
            this.elements.saveStatus.className = 'save-status unsaved';
        }
    }

    /**
     * Get current note data from form
     */
    getCurrentNoteData() {
        return {
            title: this.elements.titleInput.value.trim(),
            content: this.elements.contentEditor.value,
            type: this.elements.typeSelect.value,
            category: this.elements.categoryInput.value.trim() || 'uncategorized',
            tags: this.getCurrentTags(),
            sourceQuote: this.elements.sourceQuoteInput.value.trim()
        };
    }

    /**
     * Load a note for editing
     */
    loadNote(note) {
        this.currentNote = note;
        this.isEditing = true;

        this.elements.titleInput.value = note.title || '';
        this.elements.contentEditor.value = note.content || '';
        this.elements.typeSelect.value = note.type || 'general';
        this.elements.categoryInput.value = note.category || 'uncategorized';
        this.elements.sourceQuoteInput.value = note.sourceQuote || '';

        this.renderTags(note.tags || []);
        this.updateStats();
        this.updatePreview();
        this.autoResize(this.elements.contentEditor);

        this.isDirty = false;
        this.updateSaveStatus();
        
        // Focus on title if empty, otherwise content
        if (!note.title) {
            this.elements.titleInput.focus();
        } else {
            this.elements.contentEditor.focus();
        }
    }

    /**
     * Create a new note
     */
    newNote() {
        this.currentNote = null;
        this.isEditing = false;

        // Clear form
        this.elements.titleInput.value = '';
        this.elements.contentEditor.value = '';
        this.elements.typeSelect.value = 'general';
        this.elements.categoryInput.value = '';
        this.elements.sourceQuoteInput.value = '';
        this.renderTags([]);

        this.updateStats();
        this.updatePreview();
        this.autoResize(this.elements.contentEditor);

        this.isDirty = false;
        this.updateSaveStatus();
        
        this.elements.titleInput.focus();
    }

    /**
     * Save the current note
     */
    async saveNote() {
        try {
            const noteData = this.getCurrentNoteData();
            
            if (!noteData.title.trim()) {
                this.announceToScreenReader('Please enter a note title');
                this.elements.titleInput.focus();
                return;
            }

            this.elements.saveBtn.disabled = true;
            this.elements.saveBtn.textContent = 'Saving...';

            let savedNote;
            if (this.isEditing && this.currentNote) {
                savedNote = await this.noteManager.updateNote(this.currentNote.id, noteData);
            } else {
                savedNote = await this.noteManager.createNote(noteData);
                this.currentNote = savedNote;
                this.isEditing = true;
            }

            this.isDirty = false;
            this.lastSaved = new Date();
            this.updateSaveStatus('saved');
            
            this.announceToScreenReader('Note saved successfully');
            this.onSave(savedNote);

        } catch (error) {
            console.error('Failed to save note:', error);
            this.updateSaveStatus('error');
            this.announceToScreenReader('Failed to save note: ' + error.message);
        } finally {
            this.elements.saveBtn.disabled = false;
            this.elements.saveBtn.textContent = 'Save Note';
        }
    }

    /**
     * Cancel editing
     */
    cancelEditing() {
        if (this.isDirty) {
            const confirmCancel = confirm('You have unsaved changes. Are you sure you want to cancel?');
            if (!confirmCancel) return;
        }

        this.isDirty = false;
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }

        this.onCancel();
    }

    /**
     * Announce to screen readers
     */
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('editor-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Destroy the editor
     */
    destroy() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        
        this.container.innerHTML = '';
    }
}

// Make the editor available on the container element for tag removal
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-remove')) {
            const editor = e.target.closest('.note-editor');
            if (editor && editor.noteEditor) {
                const tag = e.target.closest('.tag').textContent.replace('×', '').trim();
                editor.noteEditor.removeTag(tag);
            }
        }
    });
});