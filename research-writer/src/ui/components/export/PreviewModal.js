/**
 * PreviewModal - Export preview and customization modal
 * High-performance modal with lazy rendering and virtual scrolling for large documents
 */

import { designSystem } from '../../design-system/index.js';
import { usePerformanceMonitoring, useVirtualScroll, useMemoizedComputation } from '../../hooks/usePerformance.js';
import { performanceOptimizer, debounce } from '../../../performance/optimizer.js';

export class PreviewModal {
    constructor(options = {}) {
        this.options = {
            maxPreviewPages: 10,
            enableInteractiveCustomization: true,
            enableRealTimePreview: true,
            previewQuality: 'medium', // low, medium, high
            supportZoom: true,
            enableAnnotations: false,
            lazyLoadThreshold: 3, // Load 3 pages ahead
            virtualScrolling: true,
            ...options
        };

        this.state = {
            isOpen: false,
            currentDocument: null,
            previewFormat: 'pdf',
            currentPage: 1,
            totalPages: 0,
            zoom: 1.0,
            isLoading: false,
            customizations: {
                pageSize: 'a4',
                orientation: 'portrait',
                margins: 'normal',
                fontSize: 'normal',
                lineSpacing: 'normal'
            },
            renderedPages: new Map(),
            visiblePages: new Set()
        };

        this.callbacks = {
            onExport: options.onExport || (() => {}),
            onCustomizationChange: options.onCustomizationChange || (() => {}),
            onClose: options.onClose || (() => {})
        };

        this.modal = null;
        this.previewContainer = null;
        this.virtualScroller = null;
        this.performance = usePerformanceMonitoring('PreviewModal');

        this.debouncedPreviewUpdate = debounce(this.updatePreview.bind(this), 300);
        this.debouncedCustomizationUpdate = debounce(this.applyCustomizations.bind(this), 500);
    }

    open(document, format = 'pdf') {
        this.performance.startMonitoring();

        this.state.currentDocument = document;
        this.state.previewFormat = format;
        this.state.isOpen = true;

        this.createModal();
        this.loadPreview();

        this.performance.endMonitoring();
        this.performance.trackInteraction('modal_open');
    }

    createModal() {
        // Create modal backdrop
        this.modal = document.createElement('div');
        this.modal.className = 'preview-modal-backdrop';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: ${designSystem.getSpacing(4)};
            opacity: 0;
            transition: opacity var(--animation-duration-normal) var(--animation-easing-ease);
        `;

        // Create modal content
        const modalContent = this.createModalContent();
        this.modal.appendChild(modalContent);

        // Add to DOM
        document.body.appendChild(this.modal);
        document.body.style.overflow = 'hidden'; // Prevent body scrolling

        // Animate in
        requestAnimationFrame(() => {
            this.modal.style.opacity = '1';
        });

        // Setup event listeners
        this.setupModalEventListeners();
    }

    createModalContent() {
        const content = document.createElement('div');
        content.className = 'preview-modal-content';
        content.style.cssText = `
            background: white;
            border-radius: var(--radius-lg);
            width: 95vw;
            height: 90vh;
            max-width: 1400px;
            max-height: 900px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: ${designSystem.getTokenValue('shadows', 'xl')};
            transform: translateY(20px);
            transition: transform var(--animation-duration-normal) var(--animation-easing-ease);
        `;

        // Animate in
        requestAnimationFrame(() => {
            content.style.transform = 'translateY(0)';
        });

        // Header
        const header = this.createModalHeader();
        content.appendChild(header);

        // Main content area
        const mainArea = document.createElement('div');
        mainArea.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;

        // Customization sidebar
        if (this.options.enableInteractiveCustomization) {
            const sidebar = this.createCustomizationSidebar();
            mainArea.appendChild(sidebar);
        }

        // Preview area
        const previewArea = this.createPreviewArea();
        mainArea.appendChild(previewArea);

        content.appendChild(mainArea);

        // Footer
        const footer = this.createModalFooter();
        content.appendChild(footer);

        return content;
    }

    createModalHeader() {
        const header = document.createElement('div');
        header.className = 'preview-modal-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${designSystem.getSpacing(4)} ${designSystem.getSpacing(6)};
            border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
            background-color: ${designSystem.getColor('neutral.50')};
        `;

        // Title and format info
        const titleArea = document.createElement('div');
        titleArea.innerHTML = `
            <h2 style="
                margin: 0 0 ${designSystem.getSpacing(1)} 0;
                font-size: ${designSystem.getFontSize('xl')};
                font-weight: var(--font-weight-semibold);
                color: ${designSystem.getColor('neutral.800')};
            ">Export Preview</h2>
            <p style="
                margin: 0;
                font-size: ${designSystem.getFontSize('sm')};
                color: ${designSystem.getColor('neutral.600')};
            ">
                Format: ${this.state.previewFormat.toUpperCase()} •
                <span id="page-info">Loading...</span>
            </p>
        `;

        // Controls
        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: ${designSystem.getSpacing(3)};
        `;

        // Zoom controls
        if (this.options.supportZoom) {
            const zoomControls = this.createZoomControls();
            controls.appendChild(zoomControls);
        }

        // Close button
        const closeButton = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        closeButton.innerHTML = '✕';
        closeButton.title = 'Close preview';
        closeButton.addEventListener('click', () => this.close());

        controls.appendChild(closeButton);

        header.appendChild(titleArea);
        header.appendChild(controls);

        return header;
    }

    createZoomControls() {
        const zoomContainer = document.createElement('div');
        zoomContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: ${designSystem.getSpacing(2)};
            background-color: white;
            border: 1px solid ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-md);
            padding: ${designSystem.getSpacing(1)};
        `;

        // Zoom out button
        const zoomOutBtn = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        zoomOutBtn.innerHTML = '−';
        zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.1));

        // Zoom display
        const zoomDisplay = document.createElement('span');
        zoomDisplay.id = 'zoom-display';
        zoomDisplay.style.cssText = `
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.700')};
            min-width: 60px;
            text-align: center;
        `;
        zoomDisplay.textContent = '100%';

        // Zoom in button
        const zoomInBtn = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        zoomInBtn.innerHTML = '+';
        zoomInBtn.addEventListener('click', () => this.adjustZoom(0.1));

        // Reset zoom button
        const resetZoomBtn = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        resetZoomBtn.innerHTML = '⊡';
        resetZoomBtn.title = 'Fit to width';
        resetZoomBtn.addEventListener('click', () => this.resetZoom());

        zoomContainer.appendChild(zoomOutBtn);
        zoomContainer.appendChild(zoomDisplay);
        zoomContainer.appendChild(zoomInBtn);
        zoomContainer.appendChild(resetZoomBtn);

        return zoomContainer;
    }

    createCustomizationSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'customization-sidebar';
        sidebar.style.cssText = `
            width: 280px;
            border-right: 1px solid ${designSystem.getColor('neutral.200')};
            background-color: ${designSystem.getColor('neutral.50')};
            padding: ${designSystem.getSpacing(4)};
            overflow-y: auto;
        `;

        sidebar.innerHTML = `
            <h3 style="
                margin: 0 0 ${designSystem.getSpacing(4)} 0;
                font-size: ${designSystem.getFontSize('lg')};
                font-weight: var(--font-weight-medium);
                color: ${designSystem.getColor('neutral.800')};
            ">Customization</h3>

            <div class="customization-sections">
                ${this.createCustomizationSection('Page Setup', [
                    { type: 'select', key: 'pageSize', label: 'Page Size', options: [
                        { value: 'a4', label: 'A4' },
                        { value: 'letter', label: 'Letter' },
                        { value: 'legal', label: 'Legal' }
                    ]},
                    { type: 'select', key: 'orientation', label: 'Orientation', options: [
                        { value: 'portrait', label: 'Portrait' },
                        { value: 'landscape', label: 'Landscape' }
                    ]},
                    { type: 'select', key: 'margins', label: 'Margins', options: [
                        { value: 'narrow', label: 'Narrow' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'wide', label: 'Wide' }
                    ]}
                ])}

                ${this.createCustomizationSection('Typography', [
                    { type: 'select', key: 'fontSize', label: 'Font Size', options: [
                        { value: 'small', label: 'Small' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'large', label: 'Large' }
                    ]},
                    { type: 'select', key: 'lineSpacing', label: 'Line Spacing', options: [
                        { value: 'single', label: 'Single' },
                        { value: 'normal', label: '1.5' },
                        { value: 'double', label: 'Double' }
                    ]}
                ])}
            </div>

            <div style="margin-top: ${designSystem.getSpacing(6)};">
                <button id="apply-customizations" class="ds-button ds-button-size-sm ds-button-variant-primary" style="
                    width: 100%;
                    margin-bottom: ${designSystem.getSpacing(2)};
                ">Apply Changes</button>
                <button id="reset-customizations" class="ds-button ds-button-size-sm ds-button-variant-ghost" style="
                    width: 100%;
                ">Reset to Default</button>
            </div>
        `;

        this.setupCustomizationEvents(sidebar);

        return sidebar;
    }

    createCustomizationSection(title, controls) {
        let sectionHTML = `
            <div class="customization-section" style="margin-bottom: ${designSystem.getSpacing(6)};">
                <h4 style="
                    margin: 0 0 ${designSystem.getSpacing(3)} 0;
                    font-size: ${designSystem.getFontSize('base')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                ">${title}</h4>
                <div class="controls" style="display: flex; flex-direction: column; gap: ${designSystem.getSpacing(3)};">
        `;

        controls.forEach(control => {
            sectionHTML += `
                <div class="control-group">
                    <label style="
                        display: block;
                        font-size: ${designSystem.getFontSize('sm')};
                        color: ${designSystem.getColor('neutral.700')};
                        margin-bottom: ${designSystem.getSpacing(1)};
                    ">${control.label}</label>
                    <select data-key="${control.key}" style="
                        width: 100%;
                        padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                        border: 1px solid ${designSystem.getColor('neutral.300')};
                        border-radius: var(--radius-md);
                        background: white;
                        font-size: ${designSystem.getFontSize('sm')};
                    ">
                        ${control.options.map(option => `
                            <option value="${option.value}" ${this.state.customizations[control.key] === option.value ? 'selected' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        });

        sectionHTML += '</div></div>';
        return sectionHTML;
    }

    setupCustomizationEvents(sidebar) {
        // Listen for select changes
        sidebar.querySelectorAll('select[data-key]').forEach(select => {
            select.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                const value = e.target.value;
                this.state.customizations[key] = value;

                if (this.options.enableRealTimePreview) {
                    this.debouncedPreviewUpdate();
                }

                this.callbacks.onCustomizationChange(key, value, this.state.customizations);
            });
        });

        // Apply button
        sidebar.querySelector('#apply-customizations').addEventListener('click', () => {
            this.applyCustomizations();
        });

        // Reset button
        sidebar.querySelector('#reset-customizations').addEventListener('click', () => {
            this.resetCustomizations();
        });
    }

    createPreviewArea() {
        const previewArea = document.createElement('div');
        previewArea.className = 'preview-area';
        previewArea.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background-color: ${designSystem.getColor('neutral.100')};
        `;

        // Toolbar
        const toolbar = this.createPreviewToolbar();
        previewArea.appendChild(toolbar);

        // Preview container
        this.previewContainer = document.createElement('div');
        this.previewContainer.className = 'preview-container';
        this.previewContainer.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: ${designSystem.getSpacing(4)};
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: ${designSystem.getSpacing(4)};
        `;

        previewArea.appendChild(this.previewContainer);

        return previewArea;
    }

    createPreviewToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'preview-toolbar';
        toolbar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(4)};
            border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
            background: white;
        `;

        // Page navigation
        const pageNav = document.createElement('div');
        pageNav.style.cssText = `
            display: flex;
            align-items: center;
            gap: ${designSystem.getSpacing(2)};
        `;

        pageNav.innerHTML = `
            <button id="prev-page" class="ds-button ds-button-size-sm ds-button-variant-ghost" disabled>‹ Prev</button>
            <span id="page-indicator" style="
                font-size: ${designSystem.getFontSize('sm')};
                color: ${designSystem.getColor('neutral.600')};
                min-width: 100px;
                text-align: center;
            ">Page 1 of 1</span>
            <button id="next-page" class="ds-button ds-button-size-sm ds-button-variant-ghost" disabled>Next ›</button>
        `;

        // Quality selector
        const qualitySelector = document.createElement('select');
        qualitySelector.id = 'preview-quality';
        qualitySelector.style.cssText = `
            padding: ${designSystem.getSpacing(1)} ${designSystem.getSpacing(2)};
            border: 1px solid ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-sm);
            font-size: ${designSystem.getFontSize('sm')};
        `;

        qualitySelector.innerHTML = `
            <option value="low" ${this.options.previewQuality === 'low' ? 'selected' : ''}>Draft Quality</option>
            <option value="medium" ${this.options.previewQuality === 'medium' ? 'selected' : ''}>Normal Quality</option>
            <option value="high" ${this.options.previewQuality === 'high' ? 'selected' : ''}>High Quality</option>
        `;

        qualitySelector.addEventListener('change', (e) => {
            this.options.previewQuality = e.target.value;
            this.debouncedPreviewUpdate();
        });

        toolbar.appendChild(pageNav);
        toolbar.appendChild(qualitySelector);

        this.setupPreviewToolbarEvents(toolbar);

        return toolbar;
    }

    setupPreviewToolbarEvents(toolbar) {
        toolbar.querySelector('#prev-page').addEventListener('click', () => {
            this.previousPage();
        });

        toolbar.querySelector('#next-page').addEventListener('click', () => {
            this.nextPage();
        });
    }

    createModalFooter() {
        const footer = document.createElement('div');
        footer.className = 'preview-modal-footer';
        footer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${designSystem.getSpacing(4)} ${designSystem.getSpacing(6)};
            border-top: 1px solid ${designSystem.getColor('neutral.200')};
            background-color: ${designSystem.getColor('neutral.50')};
        `;

        // Export info
        const exportInfo = document.createElement('div');
        exportInfo.style.cssText = `
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.600')};
        `;
        exportInfo.innerHTML = `
            <span>📊 Estimated file size: <span id="estimated-size">Calculating...</span></span><br>
            <span>⏱️ Estimated generation time: <span id="estimated-time">Calculating...</span></span>
        `;

        // Action buttons
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: ${designSystem.getSpacing(3)};
        `;

        const cancelButton = designSystem.createElement('button', 'button',
            { size: 'md', variant: 'ghost' },
            []
        );
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => this.close());

        const exportButton = designSystem.createElement('button', 'button',
            { size: 'md', variant: 'primary' },
            []
        );
        exportButton.textContent = `Export ${this.state.previewFormat.toUpperCase()}`;
        exportButton.addEventListener('click', () => this.exportDocument());

        actions.appendChild(cancelButton);
        actions.appendChild(exportButton);

        footer.appendChild(exportInfo);
        footer.appendChild(actions);

        return footer;
    }

    setupModalEventListeners() {
        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Page navigation with arrow keys
        const navigationHandler = (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.previousPage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.nextPage();
            }
        };
        document.addEventListener('keydown', navigationHandler);

        // Store handler for cleanup
        this.keyHandlers = [escapeHandler, navigationHandler];
    }

    async loadPreview() {
        this.performance.trackInteraction('preview_load_start');

        this.state.isLoading = true;
        this.updateLoadingState();

        try {
            // Simulate document analysis
            await this.analyzeDocument();

            // Generate preview pages
            await this.generatePreview();

            // Setup virtual scrolling if enabled
            if (this.options.virtualScrolling && this.state.totalPages > 10) {
                this.setupVirtualScrolling();
            } else {
                this.renderAllPages();
            }

            this.updateEstimates();

        } catch (error) {
            console.error('Failed to load preview:', error);
            this.showPreviewError(error);
        } finally {
            this.state.isLoading = false;
            this.updateLoadingState();
            this.performance.trackInteraction('preview_load_complete');
        }
    }

    async analyzeDocument() {
        // Simulate document analysis
        await new Promise(resolve => setTimeout(resolve, 800));

        // Mock analysis results
        this.state.totalPages = Math.min(
            Math.floor(Math.random() * 20) + 5,
            this.options.maxPreviewPages
        );

        // Update page info
        const pageInfo = this.modal.querySelector('#page-info');
        if (pageInfo) {
            pageInfo.textContent = `${this.state.totalPages} pages`;
        }
    }

    async generatePreview() {
        this.performance.startTimer('preview_generation');

        const chunkSize = 3; // Generate 3 pages at a time
        const chunks = Math.ceil(this.state.totalPages / chunkSize);

        for (let chunk = 0; chunk < chunks; chunk++) {
            const startPage = chunk * chunkSize + 1;
            const endPage = Math.min(startPage + chunkSize - 1, this.state.totalPages);

            await this.generatePageChunk(startPage, endPage);

            // Yield to main thread
            await performanceOptimizer.yieldToMain(5);
        }

        this.performance.endTimer('preview_generation');
    }

    async generatePageChunk(startPage, endPage) {
        const pages = [];

        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            const pageData = await this.generatePage(pageNum);
            pages.push({ pageNum, data: pageData });
            this.state.renderedPages.set(pageNum, pageData);
        }

        return pages;
    }

    async generatePage(pageNum) {
        // Simulate page generation
        await new Promise(resolve => setTimeout(resolve, 200));

        return {
            pageNumber: pageNum,
            content: this.generatePageContent(pageNum),
            thumbnail: this.generatePageThumbnail(pageNum),
            size: { width: 595, height: 842 }, // A4 dimensions in points
            quality: this.options.previewQuality
        };
    }

    generatePageContent(pageNum) {
        // Simulate page content based on document
        const sections = [
            'Introduction',
            'Literature Review',
            'Methodology',
            'Results',
            'Discussion',
            'Conclusion',
            'References',
            'Appendices'
        ];

        const sectionIndex = Math.floor((pageNum - 1) / 3);
        const currentSection = sections[sectionIndex] || 'Content';

        return `
            <div class="preview-page" style="
                width: 100%;
                aspect-ratio: 0.707; /* A4 ratio */
                background: white;
                border: 1px solid ${designSystem.getColor('neutral.300')};
                border-radius: var(--radius-sm);
                padding: 40px;
                font-family: var(--font-family-sans);
                font-size: 12px;
                line-height: 1.5;
                color: ${designSystem.getColor('neutral.800')};
                box-shadow: ${designSystem.getTokenValue('shadows', 'sm')};
                margin-bottom: ${designSystem.getSpacing(4)};
                overflow: hidden;
            ">
                <div class="page-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
                    font-size: 10px;
                    color: ${designSystem.getColor('neutral.500')};
                ">
                    <span>Research Document</span>
                    <span>Page ${pageNum}</span>
                </div>

                <h2 style="
                    margin: 0 0 20px 0;
                    font-size: 16px;
                    font-weight: var(--font-weight-semibold);
                    color: ${designSystem.getColor('neutral.800')};
                ">${currentSection}</h2>

                <p style="margin: 0 0 15px 0;">
                    This is a preview of how your document will appear when exported as ${this.state.previewFormat.toUpperCase()}.
                    The actual export will include all your content with proper formatting, citations, and references.
                </p>

                <p style="margin: 0 0 15px 0;">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore
                    et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                    aliquip ex ea commodo consequat.
                </p>

                ${pageNum % 3 === 0 ? `
                    <div class="citation-example" style="
                        margin: 20px 0;
                        padding: 15px;
                        background-color: ${designSystem.getColor('neutral.50')};
                        border-left: 3px solid ${designSystem.getColor('primary.500')};
                        font-size: 11px;
                        font-style: italic;
                    ">
                        Example citation: Smith, J. (2023). Research Methods in Academic Writing.
                        <em>Journal of Academic Publishing</em>, 15(3), 123-145.
                    </div>
                ` : ''}

                <div class="page-footer" style="
                    position: absolute;
                    bottom: 20px;
                    left: 40px;
                    right: 40px;
                    text-align: center;
                    font-size: 10px;
                    color: ${designSystem.getColor('neutral.400')};
                    border-top: 1px solid ${designSystem.getColor('neutral.200')};
                    padding-top: 10px;
                ">
                    Generated with Research Writer • ${new Date().toLocaleDateString()}
                </div>
            </div>
        `;
    }

    generatePageThumbnail(pageNum) {
        // Generate a simple thumbnail representation
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="100" height="141" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="141" fill="white" stroke="#e5e7eb"/>
                <rect x="10" y="10" width="80" height="4" fill="#d1d5db"/>
                <rect x="10" y="20" width="70" height="2" fill="#e5e7eb"/>
                <rect x="10" y="25" width="75" height="2" fill="#e5e7eb"/>
                <rect x="10" y="30" width="60" height="2" fill="#e5e7eb"/>
                <text x="50" y="70" text-anchor="middle" font-size="8" fill="#9ca3af">${pageNum}</text>
            </svg>
        `)}`;
    }

    setupVirtualScrolling() {
        // Use the virtual scrolling utility for better performance with many pages
        this.virtualScroller = performanceOptimizer.createVirtualScroller(
            this.previewContainer,
            Array.from({ length: this.state.totalPages }, (_, i) => i + 1),
            (pageNum) => this.renderPageElement(pageNum),
            600 // Approximate height per page
        );
    }

    renderAllPages() {
        this.previewContainer.innerHTML = '';

        for (let pageNum = 1; pageNum <= Math.min(this.state.totalPages, 5); pageNum++) {
            const pageElement = this.renderPageElement(pageNum);
            this.previewContainer.appendChild(pageElement);
            this.state.visiblePages.add(pageNum);
        }

        // Lazy load remaining pages
        if (this.state.totalPages > 5) {
            this.setupLazyLoading();
        }
    }

    renderPageElement(pageNum) {
        const pageData = this.state.renderedPages.get(pageNum);
        if (!pageData) {
            return this.createPagePlaceholder(pageNum);
        }

        const pageElement = document.createElement('div');
        pageElement.innerHTML = pageData.content;
        pageElement.style.transform = `scale(${this.state.zoom})`;
        pageElement.style.transformOrigin = 'top center';

        return pageElement.firstElementChild;
    }

    createPagePlaceholder(pageNum) {
        const placeholder = document.createElement('div');
        placeholder.className = 'page-placeholder';
        placeholder.style.cssText = `
            width: 100%;
            aspect-ratio: 0.707;
            background: ${designSystem.getColor('neutral.100')};
            border: 2px dashed ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${designSystem.getColor('neutral.500')};
            font-size: ${designSystem.getFontSize('sm')};
            margin-bottom: ${designSystem.getSpacing(4)};
        `;
        placeholder.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">📄</div>
                <div>Loading page ${pageNum}...</div>
            </div>
        `;

        // Load page content when placeholder becomes visible
        performanceOptimizer.observeForLazyLoad(placeholder, async () => {
            if (!this.state.renderedPages.has(pageNum)) {
                const pageData = await this.generatePage(pageNum);
                this.state.renderedPages.set(pageNum, pageData);

                const pageElement = this.renderPageElement(pageNum);
                placeholder.replaceWith(pageElement);
                this.state.visiblePages.add(pageNum);
            }
        });

        return placeholder;
    }

    setupLazyLoading() {
        // Load pages as they come into view
        const loadMorePages = debounce(() => {
            const scrollTop = this.previewContainer.scrollTop;
            const containerHeight = this.previewContainer.clientHeight;
            const scrollBottom = scrollTop + containerHeight;

            // Determine which pages should be visible
            const pageHeight = 600; // Approximate
            const startPage = Math.floor(scrollTop / pageHeight) + 1;
            const endPage = Math.ceil(scrollBottom / pageHeight);

            for (let pageNum = startPage; pageNum <= endPage && pageNum <= this.state.totalPages; pageNum++) {
                if (!this.state.visiblePages.has(pageNum)) {
                    const pageElement = this.renderPageElement(pageNum);
                    this.previewContainer.appendChild(pageElement);
                    this.state.visiblePages.add(pageNum);
                }
            }
        }, 100);

        this.previewContainer.addEventListener('scroll', loadMorePages);
    }

    updateLoadingState() {
        const loadingIndicator = this.modal?.querySelector('.loading-indicator');

        if (this.state.isLoading) {
            if (!loadingIndicator) {
                const loading = document.createElement('div');
                loading.className = 'loading-indicator';
                loading.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: ${designSystem.getSpacing(6)};
                    border-radius: var(--radius-lg);
                    box-shadow: ${designSystem.getTokenValue('shadows', 'lg')};
                    text-align: center;
                    z-index: 10;
                `;
                loading.innerHTML = `
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 3px solid ${designSystem.getColor('neutral.200')};
                        border-top: 3px solid ${designSystem.getColor('primary.500')};
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto ${designSystem.getSpacing(3)} auto;
                    "></div>
                    <div style="color: ${designSystem.getColor('neutral.700')};">
                        Generating preview...
                    </div>
                `;

                // Add CSS for spinner animation
                if (!document.querySelector('#spinner-styles')) {
                    const style = document.createElement('style');
                    style.id = 'spinner-styles';
                    style.textContent = `
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }

                this.previewContainer.appendChild(loading);
            }
        } else if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    updateEstimates() {
        const sizeElement = this.modal?.querySelector('#estimated-size');
        const timeElement = this.modal?.querySelector('#estimated-time');

        if (sizeElement && timeElement) {
            // Calculate estimates based on pages and quality
            const baseSize = this.state.totalPages * 50; // 50KB per page base
            const qualityMultiplier = { low: 0.5, medium: 1.0, high: 2.0 };
            const estimatedSize = Math.round(baseSize * qualityMultiplier[this.options.previewQuality]);

            const baseTime = this.state.totalPages * 0.5; // 0.5 seconds per page
            const estimatedTime = Math.max(Math.round(baseTime), 1);

            sizeElement.textContent = `${estimatedSize} KB`;
            timeElement.textContent = `${estimatedTime} seconds`;
        }
    }

    adjustZoom(delta) {
        const newZoom = Math.max(0.25, Math.min(3.0, this.state.zoom + delta));
        this.setZoom(newZoom);
    }

    setZoom(zoom) {
        this.state.zoom = zoom;

        const zoomDisplay = this.modal?.querySelector('#zoom-display');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
        }

        // Apply zoom to all visible pages
        const pages = this.previewContainer.querySelectorAll('.preview-page');
        pages.forEach(page => {
            page.style.transform = `scale(${zoom})`;
        });

        this.performance.trackInteraction('zoom_change');
    }

    resetZoom() {
        this.setZoom(1.0);
    }

    previousPage() {
        if (this.state.currentPage > 1) {
            this.state.currentPage--;
            this.scrollToPage(this.state.currentPage);
            this.updatePageNavigation();
        }
    }

    nextPage() {
        if (this.state.currentPage < this.state.totalPages) {
            this.state.currentPage++;
            this.scrollToPage(this.state.currentPage);
            this.updatePageNavigation();
        }
    }

    scrollToPage(pageNum) {
        const pageHeight = 600; // Approximate height
        const targetScroll = (pageNum - 1) * pageHeight;

        this.previewContainer.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }

    updatePageNavigation() {
        const prevBtn = this.modal?.querySelector('#prev-page');
        const nextBtn = this.modal?.querySelector('#next-page');
        const indicator = this.modal?.querySelector('#page-indicator');

        if (prevBtn && nextBtn && indicator) {
            prevBtn.disabled = this.state.currentPage <= 1;
            nextBtn.disabled = this.state.currentPage >= this.state.totalPages;
            indicator.textContent = `Page ${this.state.currentPage} of ${this.state.totalPages}`;
        }
    }

    updatePreview() {
        this.performance.trackInteraction('preview_update');

        // Clear existing pages and regenerate with new customizations
        this.state.renderedPages.clear();
        this.loadPreview();
    }

    applyCustomizations() {
        this.performance.trackInteraction('customizations_apply');
        this.debouncedCustomizationUpdate();
    }

    resetCustomizations() {
        this.state.customizations = {
            pageSize: 'a4',
            orientation: 'portrait',
            margins: 'normal',
            fontSize: 'normal',
            lineSpacing: 'normal'
        };

        // Update UI
        this.modal.querySelectorAll('select[data-key]').forEach(select => {
            const key = select.dataset.key;
            select.value = this.state.customizations[key];
        });

        this.updatePreview();
    }

    showPreviewError(error) {
        this.previewContainer.innerHTML = `
            <div style="
                text-align: center;
                padding: ${designSystem.getSpacing(8)};
                color: ${designSystem.getColor('semantic.error')};
            ">
                <div style="font-size: 48px; margin-bottom: ${designSystem.getSpacing(4)};">⚠️</div>
                <h3 style="margin: 0 0 ${designSystem.getSpacing(2)} 0;">Preview Error</h3>
                <p style="margin: 0; color: ${designSystem.getColor('neutral.600')};">
                    ${error.message || 'Unable to generate preview'}
                </p>
                <button onclick="this.parentElement.style.display='none'" style="
                    margin-top: ${designSystem.getSpacing(4)};
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(4)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    background: white;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                ">Dismiss</button>
            </div>
        `;
    }

    exportDocument() {
        this.performance.trackInteraction('export_start');

        this.callbacks.onExport({
            document: this.state.currentDocument,
            format: this.state.previewFormat,
            customizations: this.state.customizations
        });

        this.close();
    }

    close() {
        this.performance.trackInteraction('modal_close');

        if (!this.modal) return;

        // Animate out
        this.modal.style.opacity = '0';
        const content = this.modal.querySelector('.preview-modal-content');
        if (content) {
            content.style.transform = 'translateY(20px)';
        }

        setTimeout(() => {
            // Cleanup
            if (this.modal && this.modal.parentNode) {
                document.body.removeChild(this.modal);
            }

            document.body.style.overflow = ''; // Restore body scrolling

            // Remove event listeners
            if (this.keyHandlers) {
                this.keyHandlers.forEach(handler => {
                    document.removeEventListener('keydown', handler);
                });
            }

            // Clean up virtual scroller
            if (this.virtualScroller && this.virtualScroller.destroy) {
                this.virtualScroller.destroy();
            }

            // Clear state
            this.state.isOpen = false;
            this.state.renderedPages.clear();
            this.state.visiblePages.clear();
            this.modal = null;
            this.previewContainer = null;

            // Notify callback
            this.callbacks.onClose();

        }, 200);
    }

    destroy() {
        this.close();

        if (this.performance && this.performance.destroy) {
            this.performance.destroy();
        }
    }
}