/**
 * OrganizeController - Main controller for the organize module
 * Coordinates note-taking, tagging, and analytics functionality
 */

import { NoteManager } from '../modules/research/NoteManager.js';
import { NoteEditor } from '../components/research/NoteEditor.js';
import { TagManager } from '../components/research/TagManager.js';

export class OrganizeController {
    constructor() {
        this.noteManager = null;
        this.tagManager = null;
        this.noteEditor = null;
        
        this.currentTab = 'notes';
        this.currentNote = null;
        this.notes = [];
        this.selectedNotes = new Set();
        
        // DOM elements
        this.elements = {};
        
        // Pagination
        this.currentPage = 1;
        this.notesPerPage = 20;
        
        // Search and filters
        this.searchQuery = '';
        this.activeFilters = {
            type: '',
            category: '',
            tags: []
        };
        this.sortBy = 'updated';
        this.sortOrder = 'desc';
        
        this.init();
    }

    /**
     * Initialize the organize controller
     */
    async init() {
        try {
            // Initialize managers
            this.noteManager = new NoteManager();
            this.tagManager = new TagManager(this.noteManager);
            
            // Cache DOM elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize the interface
            await this.loadInitialData();
            
            console.log('OrganizeController initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OrganizeController:', error);
            this.showError('Failed to initialize the organize module');
        }
    }

    /**
     * Cache DOM elements for performance
     */
    cacheElements() {
        const organizeModule = document.getElementById('organize-module');
        if (!organizeModule) return;

        this.elements = {
            // Tab system
            tabButtons: organizeModule.querySelectorAll('.tab-btn'),
            tabPanels: organizeModule.querySelectorAll('.tab-panel'),
            
            // Notes elements
            searchInput: organizeModule.querySelector('.search-input'),
            searchBtn: organizeModule.querySelector('.search-btn'),
            newNoteBtn: organizeModule.querySelector('.new-note-btn'),
            createFirstNoteBtn: organizeModule.querySelector('.create-first-note-btn'),
            typeFilter: organizeModule.querySelector('select[aria-label="Filter by type"]'),
            categoryFilter: organizeModule.querySelector('select[aria-label="Filter by category"]'),
            sortSelect: organizeModule.querySelector('select[aria-label="Sort notes"]'),
            notesList: organizeModule.querySelector('.notes-list'),
            noteEditorContainer: organizeModule.querySelector('.note-editor-container'),
            editorPlaceholder: organizeModule.querySelector('.editor-placeholder'),
            
            // Pagination
            prevBtn: organizeModule.querySelector('.prev-btn'),
            nextBtn: organizeModule.querySelector('.next-btn'),
            paginationInfo: organizeModule.querySelector('.pagination-info'),
            paginationContainer: organizeModule.querySelector('.notes-pagination'),
            
            // Tags elements
            tagSearchInput: organizeModule.querySelector('.tag-search-input'),
            tagsList: organizeModule.querySelector('.tag-list'),
            newTagBtn: organizeModule.querySelector('.new-tag-btn'),
            importTagsBtn: organizeModule.querySelector('.import-tags-btn'),
            exportTagsBtn: organizeModule.querySelector('.export-tags-btn'),
            
            // Analytics elements
            totalNotesSpan: organizeModule.querySelector('#total-notes'),
            totalWordsSpan: organizeModule.querySelector('#total-words'),
            avgWordsSpan: organizeModule.querySelector('#avg-words'),
            noteTypesSpan: organizeModule.querySelector('#note-types'),
            totalTagsSpan: organizeModule.querySelector('#total-tags'),
            tagsUsageSpan: organizeModule.querySelector('#tags-usage'),
            avgUsageSpan: organizeModule.querySelector('#avg-usage')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tab navigation
        this.elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTabClick(e));
        });

        // Notes functionality
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                this.debounce(() => this.handleSearch(), 300)
            );
        }

        if (this.elements.searchBtn) {
            this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
        }

        if (this.elements.newNoteBtn) {
            this.elements.newNoteBtn.addEventListener('click', () => this.createNewNote());
        }

        if (this.elements.createFirstNoteBtn) {
            this.elements.createFirstNoteBtn.addEventListener('click', () => this.createNewNote());
        }

        // Filters
        if (this.elements.typeFilter) {
            this.elements.typeFilter.addEventListener('change', () => this.applyFilters());
        }

        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.addEventListener('change', () => this.applyFilters());
        }

        if (this.elements.sortSelect) {
            this.elements.sortSelect.addEventListener('change', (e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                this.sortBy = sortBy;
                this.sortOrder = sortOrder;
                this.loadNotes();
            });
        }

        // Pagination
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.goToPrevPage());
        }

        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.goToNextPage());
        }

        // Tag management
        if (this.elements.tagSearchInput) {
            this.elements.tagSearchInput.addEventListener('input',
                this.debounce(() => this.searchTags(), 300)
            );
        }

        if (this.elements.newTagBtn) {
            this.elements.newTagBtn.addEventListener('click', () => this.createNewTag());
        }

        if (this.elements.importTagsBtn) {
            this.elements.importTagsBtn.addEventListener('click', () => this.importTags());
        }

        if (this.elements.exportTagsBtn) {
            this.elements.exportTagsBtn.addEventListener('click', () => this.exportTags());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        await this.loadNotes();
        await this.loadTags();
        await this.loadAnalytics();
        await this.populateFilters();
    }

    /**
     * Handle tab clicks
     */
    handleTabClick(e) {
        const tabId = e.target.dataset.tab;
        if (!tabId) return;

        this.switchTab(tabId);
    }

    /**
     * Switch between tabs
     */
    async switchTab(tabId) {
        if (this.currentTab === tabId) return;

        // Update tab buttons
        this.elements.tabButtons.forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        // Update tab panels
        this.elements.tabPanels.forEach(panel => {
            const isActive = panel.id === `${tabId}-panel`;
            panel.classList.toggle('active', isActive);
        });

        this.currentTab = tabId;

        // Load data for the active tab
        switch (tabId) {
            case 'notes':
                await this.loadNotes();
                break;
            case 'tags':
                await this.loadTags();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
        }
    }

    /**
     * Load and display notes
     */
    async loadNotes() {
        try {
            const searchResults = await this.noteManager.searchNotes(this.searchQuery, {
                type: this.activeFilters.type,
                categories: this.activeFilters.category ? [this.activeFilters.category] : [],
                tags: this.activeFilters.tags,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                limit: this.notesPerPage,
                offset: (this.currentPage - 1) * this.notesPerPage
            });

            this.notes = searchResults.notes;
            this.renderNotesList();
            this.updatePagination(searchResults.total);

        } catch (error) {
            console.error('Failed to load notes:', error);
            this.showError('Failed to load notes');
        }
    }

    /**
     * Render the notes list
     */
    renderNotesList() {
        if (!this.elements.notesList) return;

        if (this.notes.length === 0) {
            this.elements.notesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>No notes found</h3>
                    <p>Try adjusting your search or create a new note.</p>
                    <button class="btn btn-primary create-first-note-btn">Create Note</button>
                </div>
            `;
            
            // Re-attach event listener for the new button
            const createBtn = this.elements.notesList.querySelector('.create-first-note-btn');
            if (createBtn) {
                createBtn.addEventListener('click', () => this.createNewNote());
            }
            return;
        }

        this.elements.notesList.innerHTML = this.notes.map(note => this.renderNoteItem(note)).join('');
        
        // Add event listeners to note items
        this.elements.notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.selectNote(noteId);
            });
            
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const noteId = item.dataset.noteId;
                    this.selectNote(noteId);
                }
            });
        });
    }

    /**
     * Render a single note item
     */
    renderNoteItem(note) {
        const isSelected = this.currentNote && this.currentNote.id === note.id;
        const preview = note.content ? note.content.substring(0, 150) + '...' : 'No content';
        const formattedDate = new Date(note.updated).toLocaleDateString();
        
        return `
            <div class="note-item ${isSelected ? 'selected' : ''}" 
                 data-note-id="${note.id}" 
                 role="listitem"
                 tabindex="0"
                 aria-label="Note: ${note.title}">
                <div class="note-header">
                    <h4 class="note-title">${this.escapeHtml(note.title)}</h4>
                    <span class="note-type-badge ${note.type}">${note.type}</span>
                </div>
                <div class="note-content-preview">${this.escapeHtml(preview)}</div>
                <div class="note-meta">
                    <div class="note-tags">
                        ${note.tags.slice(0, 3).map(tag => 
                            `<span class="note-tag">${this.escapeHtml(tag)}</span>`
                        ).join('')}
                        ${note.tags.length > 3 ? `<span class="note-tag">+${note.tags.length - 3}</span>` : ''}
                    </div>
                    <div class="note-stats">
                        <span class="word-count">${note.wordCount || 0} words</span>
                        <span class="note-date">${formattedDate}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Select and load a note for editing
     */
    async selectNote(noteId) {
        try {
            const note = await this.noteManager.getNote(noteId);
            if (!note) {
                this.showError('Note not found');
                return;
            }

            this.currentNote = note;
            this.showNoteEditor(note);
            this.updateSelectedNoteVisual();

        } catch (error) {
            console.error('Failed to select note:', error);
            this.showError('Failed to load note');
        }
    }

    /**
     * Show the note editor
     */
    showNoteEditor(note = null) {
        if (!this.elements.noteEditorContainer) return;

        // Hide placeholder
        if (this.elements.editorPlaceholder) {
            this.elements.editorPlaceholder.style.display = 'none';
        }

        // Clear container
        this.elements.noteEditorContainer.innerHTML = '';

        // Create and show editor
        this.noteEditor = new NoteEditor(this.elements.noteEditorContainer, this.noteManager, {
            note: note,
            autosave: true,
            showPreview: false,
            onSave: (savedNote) => this.handleNoteSave(savedNote),
            onCancel: () => this.hideNoteEditor(),
            onChange: (noteData) => this.handleNoteChange(noteData)
        });

        // Store reference for cleanup
        this.elements.noteEditorContainer.noteEditor = this.noteEditor;

        if (note) {
            this.noteEditor.loadNote(note);
        } else {
            this.noteEditor.newNote();
        }
    }

    /**
     * Hide the note editor
     */
    hideNoteEditor() {
        if (this.noteEditor) {
            this.noteEditor.destroy();
            this.noteEditor = null;
        }

        if (this.elements.noteEditorContainer) {
            this.elements.noteEditorContainer.innerHTML = '';
        }

        if (this.elements.editorPlaceholder) {
            this.elements.editorPlaceholder.style.display = 'flex';
        }

        this.currentNote = null;
        this.updateSelectedNoteVisual();
    }

    /**
     * Handle note save
     */
    async handleNoteSave(savedNote) {
        this.currentNote = savedNote;
        await this.loadNotes(); // Refresh the list
        await this.loadAnalytics(); // Update analytics
        this.updateSelectedNoteVisual();
    }

    /**
     * Handle note change
     */
    handleNoteChange(noteData) {
        // Real-time updates could go here
    }

    /**
     * Create a new note
     */
    createNewNote() {
        this.currentNote = null;
        this.showNoteEditor();
        this.updateSelectedNoteVisual();
    }

    /**
     * Update visual indication of selected note
     */
    updateSelectedNoteVisual() {
        if (!this.elements.notesList) return;

        this.elements.notesList.querySelectorAll('.note-item').forEach(item => {
            const isSelected = this.currentNote && item.dataset.noteId === this.currentNote.id;
            item.classList.toggle('selected', isSelected);
        });
    }

    /**
     * Handle search
     */
    async handleSearch() {
        this.searchQuery = this.elements.searchInput ? this.elements.searchInput.value.trim() : '';
        this.currentPage = 1;
        await this.loadNotes();
    }

    /**
     * Apply filters
     */
    async applyFilters() {
        this.activeFilters.type = this.elements.typeFilter ? this.elements.typeFilter.value : '';
        this.activeFilters.category = this.elements.categoryFilter ? this.elements.categoryFilter.value : '';
        
        this.currentPage = 1;
        await this.loadNotes();
    }

    /**
     * Populate filter options
     */
    async populateFilters() {
        try {
            // Populate category filter
            if (this.elements.categoryFilter) {
                const categories = this.noteManager.getAllCategories();
                const currentValue = this.elements.categoryFilter.value;
                
                this.elements.categoryFilter.innerHTML = `
                    <option value="">All Categories</option>
                    ${categories.map(category => 
                        `<option value="${category}" ${category === currentValue ? 'selected' : ''}>${this.escapeHtml(category)}</option>`
                    ).join('')}
                `;
            }
        } catch (error) {
            console.error('Failed to populate filters:', error);
        }
    }

    /**
     * Update pagination
     */
    updatePagination(totalNotes) {
        if (!this.elements.paginationContainer) return;

        const totalPages = Math.ceil(totalNotes / this.notesPerPage);
        const showPagination = totalPages > 1;

        this.elements.paginationContainer.classList.toggle('hidden', !showPagination);

        if (showPagination) {
            if (this.elements.prevBtn) {
                this.elements.prevBtn.disabled = this.currentPage <= 1;
            }
            
            if (this.elements.nextBtn) {
                this.elements.nextBtn.disabled = this.currentPage >= totalPages;
            }
            
            if (this.elements.paginationInfo) {
                this.elements.paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
            }
        }
    }

    /**
     * Go to previous page
     */
    async goToPrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.loadNotes();
        }
    }

    /**
     * Go to next page
     */
    async goToNextPage() {
        this.currentPage++;
        await this.loadNotes();
    }

    /**
     * Load and display tags
     */
    async loadTags() {
        try {
            await this.tagManager.refreshTagCache();
            this.renderTagsList();
            this.updateTagsAnalytics();
        } catch (error) {
            console.error('Failed to load tags:', error);
            this.showError('Failed to load tags');
        }
    }

    /**
     * Render tags list
     */
    renderTagsList() {
        if (!this.elements.tagsList) return;

        const tags = this.tagManager.getAllTags();
        
        if (tags.length === 0) {
            this.elements.tagsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🏷️</div>
                    <h3>No tags yet</h3>
                    <p>Tags will appear here as you add them to your notes.</p>
                </div>
            `;
            return;
        }

        this.elements.tagsList.innerHTML = tags.map(tagName => {
            const tagDetails = this.tagManager.getTagDetails(tagName);
            return `
                <div class="tag-item" data-tag="${tagName}">
                    <div class="tag-info">
                        <span class="tag-name">${this.escapeHtml(tagName)}</span>
                        <span class="tag-count">${tagDetails.count}</span>
                    </div>
                    <div class="tag-item-actions">
                        <button class="tag-action-btn rename-tag-btn" 
                                title="Rename tag"
                                aria-label="Rename ${tagName}">✏️</button>
                        <button class="tag-action-btn delete-tag-btn" 
                                title="Delete tag"
                                aria-label="Delete ${tagName}">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        this.elements.tagsList.querySelectorAll('.rename-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagName = e.target.closest('.tag-item').dataset.tag;
                this.renameTag(tagName);
            });
        });

        this.elements.tagsList.querySelectorAll('.delete-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tagName = e.target.closest('.tag-item').dataset.tag;
                this.deleteTag(tagName);
            });
        });
    }

    /**
     * Update tags analytics
     */
    updateTagsAnalytics() {
        const analytics = this.tagManager.getAnalytics();
        
        if (this.elements.totalTagsSpan) {
            this.elements.totalTagsSpan.textContent = analytics.totalTags || 0;
        }
        
        if (this.elements.tagsUsageSpan) {
            this.elements.tagsUsageSpan.textContent = analytics.totalUsage || 0;
        }
        
        if (this.elements.avgUsageSpan) {
            this.elements.avgUsageSpan.textContent = (analytics.averageUsage || 0).toFixed(1);
        }
    }

    /**
     * Search tags
     */
    searchTags() {
        // Implementation for tag search
        const query = this.elements.tagSearchInput ? this.elements.tagSearchInput.value.trim() : '';
        // Filter tags and re-render
    }

    /**
     * Create new tag
     */
    async createNewTag() {
        const tagName = prompt('Enter tag name:');
        if (tagName && tagName.trim()) {
            try {
                await this.tagManager.createTag(tagName.trim());
                await this.loadTags();
            } catch (error) {
                this.showError('Failed to create tag: ' + error.message);
            }
        }
    }

    /**
     * Rename tag
     */
    async renameTag(oldTagName) {
        const newTagName = prompt('Enter new tag name:', oldTagName);
        if (newTagName && newTagName.trim() && newTagName !== oldTagName) {
            try {
                await this.tagManager.renameTag(oldTagName, newTagName.trim());
                await this.loadTags();
                await this.loadNotes(); // Refresh notes to show updated tags
            } catch (error) {
                this.showError('Failed to rename tag: ' + error.message);
            }
        }
    }

    /**
     * Delete tag
     */
    async deleteTag(tagName) {
        if (confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all notes.`)) {
            try {
                await this.tagManager.deleteTag(tagName);
                await this.loadTags();
                await this.loadNotes(); // Refresh notes to show updated tags
            } catch (error) {
                this.showError('Failed to delete tag: ' + error.message);
            }
        }
    }

    /**
     * Import tags
     */
    importTags() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const format = file.name.endsWith('.csv') ? 'csv' : 'json';
                    const result = await this.tagManager.importTags(text, format);
                    
                    alert(`Import completed:\n- Imported: ${result.imported}\n- Skipped: ${result.skipped}\n- Errors: ${result.errors.length}`);
                    
                    if (result.imported > 0) {
                        await this.loadTags();
                    }
                } catch (error) {
                    this.showError('Failed to import tags: ' + error.message);
                }
            }
        };
        input.click();
    }

    /**
     * Export tags
     */
    async exportTags() {
        try {
            const format = prompt('Export format (json or csv):', 'json');
            if (!format || !['json', 'csv'].includes(format)) return;
            
            const data = await this.tagManager.exportTags(format);
            const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `tags_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            this.showError('Failed to export tags: ' + error.message);
        }
    }

    /**
     * Load and display analytics
     */
    async loadAnalytics() {
        try {
            const stats = await this.noteManager.getStatistics();
            this.updateAnalyticsDisplay(stats);
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showError('Failed to load analytics');
        }
    }

    /**
     * Update analytics display
     */
    updateAnalyticsDisplay(stats) {
        if (this.elements.totalNotesSpan) {
            this.elements.totalNotesSpan.textContent = stats.totalNotes || 0;
        }
        
        if (this.elements.totalWordsSpan) {
            this.elements.totalWordsSpan.textContent = (stats.totalWords || 0).toLocaleString();
        }
        
        if (this.elements.avgWordsSpan) {
            this.elements.avgWordsSpan.textContent = stats.averageWordsPerNote || 0;
        }
        
        if (this.elements.noteTypesSpan) {
            this.elements.noteTypesSpan.textContent = Object.keys(stats.typeDistribution || {}).length;
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when organize module is active
        const organizeModule = document.getElementById('organize-module');
        if (!organizeModule || organizeModule.classList.contains('hidden')) return;

        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    this.createNewNote();
                    break;
                case 'f':
                    e.preventDefault();
                    if (this.elements.searchInput) {
                        this.elements.searchInput.focus();
                    }
                    break;
                case 's':
                    e.preventDefault();
                    if (this.noteEditor) {
                        this.noteEditor.saveNote();
                    }
                    break;
            }
        } else if (e.key === 'Escape') {
            if (this.noteEditor && !this.currentNote) {
                this.hideNoteEditor();
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create a simple error toast
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 5000);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Debounce function for performance
     */
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

    /**
     * Cleanup when module is destroyed
     */
    destroy() {
        if (this.noteEditor) {
            this.noteEditor.destroy();
        }
        
        // Remove event listeners if needed
        // Clear timers/intervals if any
        
        console.log('OrganizeController destroyed');
    }
}