/**
 * RichTextEditorExtensions - Additional functionality for RichTextEditor
 * This module extends the base RichTextEditor with advanced features
 */

import { RichTextEditor } from './RichTextEditor.js';

// Extend the RichTextEditor prototype with additional methods
Object.assign(RichTextEditor.prototype, {

    /**
     * Handle toolbar actions
     */
    handleToolbarAction(action, element = null) {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);

        switch (action) {
            case 'bold':
                this.wrapText('**', '**', 'bold text');
                break;
            case 'italic':
                this.wrapText('*', '*', 'italic text');
                break;
            case 'underline':
                this.wrapText('<u>', '</u>', 'underlined text');
                break;
            case 'strikethrough':
                this.wrapText('~~', '~~', 'strikethrough text');
                break;
            case 'heading':
                this.insertHeading(element.value);
                break;
            case 'bullet-list':
                this.insertList('bullet');
                break;
            case 'numbered-list':
                this.insertList('numbered');
                break;
            case 'checklist':
                this.insertList('checklist');
                break;
            case 'link':
                this.showLinkDialog(selectedText);
                break;
            case 'image':
                this.insertImage();
                break;
            case 'table':
                this.insertTable();
                break;
            case 'citation':
                this.insertCitation();
                break;
            case 'footnote':
                this.insertFootnote();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'toggle-outline':
                this.toggleOutline(element);
                break;
            case 'toggle-preview':
                this.togglePreview(element);
                break;
            case 'fullscreen':
                this.toggleFullscreen();
                break;
            case 'save-version':
                this.createSnapshot('manual');
                break;
            case 'show-versions':
                this.showVersionHistory();
                break;
            case 'font-size':
                this.changeFontSize(element.value);
                break;
            case 'document-settings':
                this.showDocumentSettings();
                break;
        }
    },

    /**
     * Wrap selected text with formatting
     */
    wrapText(startTag, endTag, placeholder) {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        const replacement = selectedText ? 
            `${startTag}${selectedText}${endTag}` : 
            `${startTag}${placeholder}${endTag}`;
            
        editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
        
        if (!selectedText) {
            const newStart = start + startTag.length;
            const newEnd = newStart + placeholder.length;
            editor.setSelectionRange(newStart, newEnd);
        } else {
            editor.setSelectionRange(start + replacement.length, start + replacement.length);
        }
        
        editor.focus();
        this.handleContentChange();
    },

    /**
     * Insert heading
     */
    insertHeading(level) {
        if (!level) return;
        
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        const prefix = level === 'h1' ? '# ' :
                      level === 'h2' ? '## ' :
                      level === 'h3' ? '### ' :
                      level === 'h4' ? '#### ' :
                      level === 'h5' ? '##### ' :
                      level === 'h6' ? '###### ' : '';
        
        const headingText = selectedText || `Heading ${level.charAt(1)}`;
        const replacement = `${prefix}${headingText}`;
        
        // Insert at beginning of line
        const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
        editor.value = editor.value.substring(0, lineStart) + replacement + 
                      editor.value.substring(lineStart + (end - lineStart));
        
        const newPosition = lineStart + replacement.length;
        editor.setSelectionRange(newPosition, newPosition);
        editor.focus();
        this.handleContentChange();
    },

    /**
     * Insert list
     */
    insertList(type) {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const selectedText = editor.value.substring(start, editor.selectionEnd);
        
        let listItem = '';
        switch (type) {
            case 'bullet':
                listItem = '- ';
                break;
            case 'numbered':
                listItem = '1. ';
                break;
            case 'checklist':
                listItem = '- [ ] ';
                break;
        }
        
        const itemText = selectedText || 'List item';
        const replacement = `${listItem}${itemText}`;
        
        // Insert at beginning of line
        const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
        editor.value = editor.value.substring(0, lineStart) + replacement + 
                      editor.value.substring(editor.selectionEnd);
        
        const newPosition = lineStart + replacement.length;
        editor.setSelectionRange(newPosition, newPosition);
        editor.focus();
        this.handleContentChange();
    },

    /**
     * Show link dialog
     */
    showLinkDialog(selectedText = '') {
        const modal = this.elements.linkModal;
        const textInput = modal.querySelector('.link-text-input');
        const urlInput = modal.querySelector('.link-url-input');
        const newTabCheckbox = modal.querySelector('.link-new-tab');
        
        textInput.value = selectedText || '';
        urlInput.value = selectedText.startsWith('http') ? selectedText : '';
        newTabCheckbox.checked = true;
        
        this.showModal('link');
        textInput.focus();
        
        // Handle confirm
        const confirmBtn = modal.querySelector('.modal-confirm');
        const cancelBtn = modal.querySelector('.modal-cancel');
        
        const handleConfirm = () => {
            const linkText = textInput.value || urlInput.value;
            const linkUrl = urlInput.value;
            
            if (linkUrl) {
                const linkMarkdown = `[${linkText}](${linkUrl})`;
                this.insertAtCursor(linkMarkdown);
            }
            
            this.closeModal();
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        const handleCancel = () => {
            this.closeModal();
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    },

    /**
     * Insert text at cursor position
     */
    insertAtCursor(text) {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
        
        const newPosition = start + text.length;
        editor.setSelectionRange(newPosition, newPosition);
        editor.focus();
        this.handleContentChange();
    },

    /**
     * Insert image
     */
    insertImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // In a real implementation, you'd upload the file and get a URL
                const altText = file.name.replace(/\.[^/.]+$/, '');
                const imageMd = `![${altText}](./images/${file.name})`;
                this.insertAtCursor(imageMd);
                
                this.announceToScreenReader(`Image "${altText}" inserted`);
            }
        };
        
        input.click();
    },

    /**
     * Insert table
     */
    insertTable() {
        const tableMarkdown = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
        
        this.insertAtCursor('\n' + tableMarkdown + '\n');
        this.announceToScreenReader('Table inserted');
    },

    /**
     * Insert citation
     */
    insertCitation() {
        // This would integrate with the citation system
        const citation = `[@author2023]`;
        this.insertAtCursor(citation);
        this.announceToScreenReader('Citation placeholder inserted');
    },

    /**
     * Insert footnote
     */
    insertFootnote() {
        const footnoteId = Date.now();
        const footnote = `[^${footnoteId}]`;
        this.insertAtCursor(footnote);
        
        // Add footnote definition at end
        const definition = `\n\n[^${footnoteId}]: Footnote text here`;
        this.insertAtCursor(definition);
        
        this.announceToScreenReader('Footnote inserted');
    },

    /**
     * Toggle outline panel
     */
    toggleOutline(button) {
        this.options.showOutline = !this.options.showOutline;
        
        const layout = this.container.querySelector('.editor-layout');
        
        if (this.options.showOutline) {
            layout.classList.add('with-outline');
            if (!this.elements.outlinePanel) {
                this.renderOutlinePanel();
            }
            this.updateOutline();
        } else {
            layout.classList.remove('with-outline');
        }
        
        if (button) {
            button.classList.toggle('active', this.options.showOutline);
            button.setAttribute('aria-pressed', this.options.showOutline);
        }
    },

    /**
     * Render outline panel
     */
    renderOutlinePanel() {
        const layout = this.container.querySelector('.editor-layout');
        const outlineHtml = `
            <div class="outline-panel" role="complementary" aria-label="Document outline">
                <h3>Outline</h3>
                <nav class="outline-nav" aria-label="Document navigation">
                    <ul class="outline-list"></ul>
                </nav>
            </div>
        `;
        
        layout.insertAdjacentHTML('afterbegin', outlineHtml);
        this.elements.outlinePanel = this.container.querySelector('.outline-panel');
        this.elements.outlineList = this.container.querySelector('.outline-list');
    },

    /**
     * Update document outline
     */
    updateOutline() {
        if (!this.options.showOutline || !this.elements.outlineList) return;
        
        const content = this.elements.contentEditor.value;
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const headings = [];
        let match;
        
        while ((match = headingRegex.exec(content)) !== null) {
            const level = match[1].length;
            const text = match[2];
            const id = text.toLowerCase().replace(/\s+/g, '-');
            
            headings.push({
                level: level,
                text: text,
                id: id,
                position: match.index
            });
        }
        
        const outlineHtml = headings.map(heading => {
            const indent = 'margin-left: ' + ((heading.level - 1) * 1) + 'em';
            return `
                <li style="${indent}">
                    <a href="#${heading.id}" class="outline-link" data-position="${heading.position}">
                        ${heading.text}
                    </a>
                </li>
            `;
        }).join('');
        
        this.elements.outlineList.innerHTML = outlineHtml;
        
        // Add click handlers for outline links
        this.elements.outlineList.addEventListener('click', (e) => {
            if (e.target.classList.contains('outline-link')) {
                e.preventDefault();
                const position = parseInt(e.target.dataset.position);
                this.elements.contentEditor.focus();
                this.elements.contentEditor.setSelectionRange(position, position);
                this.elements.contentEditor.scrollTop = 
                    this.elements.contentEditor.scrollHeight * position / this.elements.contentEditor.value.length;
            }
        });
    },

    /**
     * Toggle preview panel
     */
    togglePreview(button) {
        this.options.showPreview = !this.options.showPreview;
        
        const layout = this.container.querySelector('.editor-layout');
        
        if (this.options.showPreview) {
            layout.classList.add('with-preview');
            if (!this.elements.previewPanel) {
                this.renderPreviewPanel();
            }
            this.updatePreview();
        } else {
            layout.classList.remove('with-preview');
        }
        
        if (button) {
            button.classList.toggle('active', this.options.showPreview);
            button.setAttribute('aria-pressed', this.options.showPreview);
        }
    },

    /**
     * Render preview panel
     */
    renderPreviewPanel() {
        const layout = this.container.querySelector('.editor-layout');
        const previewHtml = `
            <div class="preview-panel" role="complementary" aria-label="Document preview">
                <div class="preview-header">
                    <h3>Preview</h3>
                    <div class="preview-controls">
                        <button class="preview-btn" data-action="sync-scroll" title="Sync scroll with editor" aria-label="Sync scroll">🔗</button>
                        <button class="preview-btn" data-action="print-preview" title="Print preview" aria-label="Print preview">🖨️</button>
                    </div>
                </div>
                <div class="preview-content" aria-label="Rendered preview"></div>
            </div>
        `;
        
        layout.insertAdjacentHTML('beforeend', previewHtml);
        this.elements.previewPanel = this.container.querySelector('.preview-panel');
        this.elements.previewContent = this.container.querySelector('.preview-content');
    },

    /**
     * Update preview content
     */
    updatePreview() {
        if (!this.options.showPreview || !this.elements.previewContent) return;
        
        const content = this.elements.contentEditor.value;
        const htmlContent = this.markdownToHtml(content);
        this.elements.previewContent.innerHTML = htmlContent;
    },

    /**
     * Convert markdown to HTML
     */
    markdownToHtml(markdown) {
        return markdown
            // Headers
            .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
            .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
            .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
            // Bold and italic
            .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Underline and strikethrough
            .replace(/<u>([^<]+)<\/u>/g, '<u>$1</u>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            // Links
            .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<img src="$2" alt="$1" />')
            // Lists
            .replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\s*\-\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\s*\-\s+\[\s*\]\s+(.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
            .replace(/^\s*\-\s+\[x\]\s+(.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>')
            // Block quotes
            .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
            // Code blocks
            .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Tables (basic)
            .replace(/\|(.+)\|/g, (match, content) => {
                const cells = content.split('|').map(cell => `<td>${cell.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            })
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            // Wrap in paragraphs
            .replace(/^(.)/gm, '<p>$1')
            .replace(/(.+)$/gm, '$1</p>')
            // Clean up empty paragraphs
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<h[1-6]>)/g, '$1')
            .replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    },

    /**
     * Sync preview scroll with editor
     */
    syncPreviewScroll() {
        if (!this.elements.previewContent) return;
        
        const editor = this.elements.contentEditor;
        const preview = this.elements.previewContent;
        
        const scrollPercent = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = scrollPercent * (preview.scrollHeight - preview.clientHeight);
    },

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const editor = this.container.querySelector('.rich-text-editor');
        
        if (this.isFullscreen()) {
            this.exitFullscreen();
        } else {
            editor.classList.add('fullscreen');
            this.announceToScreenReader('Entered fullscreen mode. Press Escape to exit.');
        }
    },

    /**
     * Check if in fullscreen mode
     */
    isFullscreen() {
        return this.container.querySelector('.rich-text-editor').classList.contains('fullscreen');
    },

    /**
     * Exit fullscreen mode
     */
    exitFullscreen() {
        const editor = this.container.querySelector('.rich-text-editor');
        editor.classList.remove('fullscreen');
        this.announceToScreenReader('Exited fullscreen mode.');
    },

    /**
     * Create version snapshot
     */
    createSnapshot(type = 'manual') {
        if (!this.options.enableVersionControl) return;
        
        const snapshot = {
            id: Date.now(),
            type: type,
            title: this.elements.titleInput.value,
            content: this.elements.contentEditor.value,
            timestamp: new Date().toISOString(),
            wordCount: this.getWordCount(),
            characterCount: this.getCharacterCount()
        };
        
        this.versionHistory.push(snapshot);
        this.lastVersionTime = Date.now();
        
        this.announceToScreenReader(`Version saved (${type})`);
        
        if (this.onVersionCreated) {
            this.onVersionCreated(snapshot);
        }
    },

    /**
     * Show version history modal
     */
    showVersionHistory() {
        if (!this.options.enableVersionControl) return;
        
        const versionList = this.elements.versionList;
        const versionsHtml = this.versionHistory.map(version => `
            <div class="version-item" data-version-id="${version.id}">
                <div class="version-header">
                    <strong>${new Date(version.timestamp).toLocaleString()}</strong>
                    <span class="version-type">${version.type}</span>
                </div>
                <div class="version-meta">
                    ${version.wordCount} words • ${version.characterCount} characters
                </div>
                <div class="version-title">${version.title || 'Untitled'}</div>
                <div class="version-actions">
                    <button class="btn btn-small" data-action="restore-version" data-version-id="${version.id}">
                        Restore
                    </button>
                    <button class="btn btn-small" data-action="compare-version" data-version-id="${version.id}">
                        Compare
                    </button>
                </div>
            </div>
        `).join('');
        
        versionList.innerHTML = versionsHtml || '<p>No versions saved yet.</p>';
        
        this.showModal('version');
        
        // Handle version actions
        versionList.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            const versionId = parseInt(e.target.dataset.versionId);
            
            if (action === 'restore-version') {
                this.restoreVersion(versionId);
            } else if (action === 'compare-version') {
                this.compareVersion(versionId);
            }
        });
    },

    /**
     * Restore a version
     */
    restoreVersion(versionId) {
        const version = this.versionHistory.find(v => v.id === versionId);
        if (!version) return;
        
        const confirmRestore = confirm('This will replace the current content. Continue?');
        if (!confirmRestore) return;
        
        this.elements.titleInput.value = version.title;
        this.elements.contentEditor.value = version.content;
        
        this.updateStats();
        this.updateOutline();
        this.updatePreview();
        this.isDirty = true;
        this.updateSaveStatus();
        
        this.closeModal();
        this.announceToScreenReader('Version restored');
    },

    /**
     * Change font size
     */
    changeFontSize(size) {
        this.elements.contentEditor.style.fontSize = size;
        this.announceToScreenReader(`Font size changed to ${size}`);
    },

    /**
     * Auto-resize textarea
     */
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 800) + 'px';
    },

    /**
     * Indent text
     */
    indentText() {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        if (selectedText.includes('\n')) {
            // Multi-line selection
            const lines = selectedText.split('\n');
            const indentedLines = lines.map(line => '    ' + line);
            const replacement = indentedLines.join('\n');
            
            editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
            editor.setSelectionRange(start, start + replacement.length);
        } else {
            // Single line or cursor position
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(start);
            editor.setSelectionRange(start + 4, start + 4);
        }
        
        this.handleContentChange();
    },

    /**
     * Outdent text
     */
    outdentText() {
        const editor = this.elements.contentEditor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        if (selectedText.includes('\n')) {
            // Multi-line selection
            const lines = selectedText.split('\n');
            const outdentedLines = lines.map(line => line.replace(/^    /, ''));
            const replacement = outdentedLines.join('\n');
            
            editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
            editor.setSelectionRange(start, start + replacement.length);
        } else {
            // Single line - find line start and remove leading spaces
            const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = editor.value.indexOf('\n', start);
            const lineContent = editor.value.substring(lineStart, lineEnd === -1 ? editor.value.length : lineEnd);
            
            if (lineContent.startsWith('    ')) {
                const newLineContent = lineContent.substring(4);
                editor.value = editor.value.substring(0, lineStart) + newLineContent + 
                              editor.value.substring(lineEnd === -1 ? editor.value.length : lineEnd);
                editor.setSelectionRange(Math.max(start - 4, lineStart), Math.max(start - 4, lineStart));
            }
        }
        
        this.handleContentChange();
    },

    /**
     * Show modal dialog
     */
    showModal(type) {
        const overlay = this.elements.modalOverlay;
        const modal = overlay.querySelector(`.${type}-modal`);
        
        overlay.style.display = 'flex';
        modal.style.display = 'block';
        
        // Focus first input in modal
        const firstInput = modal.querySelector('input, textarea, select, button');
        if (firstInput) {
            firstInput.focus();
        }
    },

    /**
     * Close modal dialog
     */
    closeModal() {
        this.elements.modalOverlay.style.display = 'none';
        
        // Hide all modals
        this.elements.modalOverlay.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        // Return focus to editor
        this.elements.contentEditor.focus();
    },

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
    },

    /**
     * Autosave the document
     */
    async autosave() {
        if (!this.isDirty || !this.currentDocument) return;

        try {
            const documentData = this.getCurrentDocumentData();
            await this.documentManager.updateDocument(this.currentDocument.id, documentData);
            this.lastSaved = new Date();
            this.isDirty = false;
            this.updateSaveStatus('autosaved');
        } catch (error) {
            console.error('Autosave failed:', error);
            this.updateSaveStatus('error');
        }
    },

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

        // Update last saved display
        if (this.lastSaved && this.elements.lastSaved) {
            this.elements.lastSaved.textContent = `Last saved: ${this.lastSaved.toLocaleString()}`;
        }
    },

    /**
     * Set up live region for announcements
     */
    setupLiveRegion() {
        if (!document.getElementById('rich-editor-live-region')) {
            const liveRegion = document.createElement('div');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            liveRegion.id = 'rich-editor-live-region';
            document.body.appendChild(liveRegion);
        }
    }
});

export { RichTextEditor };