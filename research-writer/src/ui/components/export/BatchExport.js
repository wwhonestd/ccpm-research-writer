/**
 * BatchExport - Batch export interface for multiple documents
 * High-performance batch processing with queue management and progress tracking
 */

import { designSystem } from '../../design-system/index.js';
import { usePerformanceMonitoring, useRequestQueue, useChunkedProcessing } from '../../hooks/usePerformance.js';
import { performanceOptimizer, processInChunks } from '../../../performance/optimizer.js';

export class BatchExport {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            maxConcurrentExports: 3,
            enableFormatMixing: true,
            enableBulkCustomization: true,
            enableProgressTracking: true,
            enableErrorRecovery: true,
            supportedFormats: ['pdf', 'docx', 'latex', 'html'],
            maxBatchSize: 50,
            queueStrategy: 'priority', // 'priority', 'fifo', 'size-optimized'
            ...options
        };

        this.state = {
            selectedDocuments: new Map(),
            exportQueue: [],
            activeExports: new Map(),
            completedExports: new Map(),
            failedExports: new Map(),
            totalProgress: 0,
            isExporting: false,
            bulkSettings: {
                format: 'pdf',
                template: 'apa',
                quality: 'high',
                applyToAll: true
            },
            filters: {
                format: 'all',
                status: 'all',
                size: 'all'
            }
        };

        this.callbacks = {
            onDocumentSelect: options.onDocumentSelect || (() => {}),
            onBatchStart: options.onBatchStart || (() => {}),
            onBatchProgress: options.onBatchProgress || (() => {}),
            onBatchComplete: options.onBatchComplete || (() => {}),
            onExportComplete: options.onExportComplete || (() => {})
        };

        this.performance = usePerformanceMonitoring('BatchExport');
        this.requestQueue = useRequestQueue({ maxConcurrent: this.options.maxConcurrentExports });
        this.chunkedProcessor = useChunkedProcessing(this.processExportChunk.bind(this));

        this.init();
    }

    init() {
        this.performance.startMonitoring();

        this.render();
        this.setupEventListeners();
        this.loadAvailableDocuments();

        this.performance.endMonitoring();
    }

    render() {
        const batchInterface = this.createBatchInterface();
        this.container.innerHTML = '';
        this.container.appendChild(batchInterface);
    }

    createBatchInterface() {
        const wrapper = document.createElement('div');
        wrapper.className = 'batch-export-interface';
        wrapper.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: ${designSystem.getSpacing(6)};
            height: 100%;
        `;

        // Main content area
        const mainContent = this.createMainContent();
        wrapper.appendChild(mainContent);

        // Sidebar with controls and progress
        const sidebar = this.createSidebar();
        wrapper.appendChild(sidebar);

        return wrapper;
    }

    createMainContent() {
        const mainContent = document.createElement('div');
        mainContent.className = 'batch-main-content';
        mainContent.style.cssText = `
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // Header with filters and bulk actions
        const header = this.createMainHeader();
        mainContent.appendChild(header);

        // Document list
        const documentList = this.createDocumentList();
        mainContent.appendChild(documentList);

        return mainContent;
    }

    createMainHeader() {
        const header = document.createElement('div');
        header.className = 'batch-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: ${designSystem.getSpacing(4)} 0;
            border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
            margin-bottom: ${designSystem.getSpacing(4)};
        `;

        // Title and selection info
        const titleArea = document.createElement('div');
        titleArea.innerHTML = `
            <h2 style="
                margin: 0 0 ${designSystem.getSpacing(1)} 0;
                font-size: ${designSystem.getFontSize('xl')};
                font-weight: var(--font-weight-semibold);
                color: ${designSystem.getColor('neutral.800')};
            ">Batch Export</h2>
            <p style="
                margin: 0;
                font-size: ${designSystem.getFontSize('sm')};
                color: ${designSystem.getColor('neutral.600')};
            ">
                <span id="selection-count">0</span> documents selected for export
            </p>
        `;

        // Filters and bulk actions
        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            gap: ${designSystem.getSpacing(3)};
            align-items: center;
        `;

        // Filters dropdown
        const filtersDropdown = this.createFiltersDropdown();
        controls.appendChild(filtersDropdown);

        // Bulk selection actions
        const bulkActions = this.createBulkActions();
        controls.appendChild(bulkActions);

        header.appendChild(titleArea);
        header.appendChild(controls);

        return header;
    }

    createFiltersDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'filters-dropdown';
        dropdown.style.cssText = `
            position: relative;
            display: inline-block;
        `;

        const filterButton = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        filterButton.innerHTML = '🔍 Filters';

        const filterPanel = document.createElement('div');
        filterPanel.className = 'filter-panel';
        filterPanel.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            background: white;
            border: 1px solid ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-lg);
            box-shadow: ${designSystem.getTokenValue('shadows', 'lg')};
            padding: ${designSystem.getSpacing(4)};
            min-width: 250px;
            display: none;
            z-index: 10;
        `;

        filterPanel.innerHTML = `
            <div style="margin-bottom: ${designSystem.getSpacing(3)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Document Type</label>
                <select id="format-filter" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="all">All Types</option>
                    <option value="research">Research Papers</option>
                    <option value="notes">Notes</option>
                    <option value="drafts">Drafts</option>
                </select>
            </div>

            <div style="margin-bottom: ${designSystem.getSpacing(3)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Status</label>
                <select id="status-filter" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="all">All Documents</option>
                    <option value="ready">Ready to Export</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Exported</option>
                </select>
            </div>

            <div style="margin-bottom: ${designSystem.getSpacing(4)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Size</label>
                <select id="size-filter" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="all">All Sizes</option>
                    <option value="small">Small (&lt; 10 pages)</option>
                    <option value="medium">Medium (10-50 pages)</option>
                    <option value="large">Large (&gt; 50 pages)</option>
                </select>
            </div>

            <div style="display: flex; gap: ${designSystem.getSpacing(2)};">
                <button id="apply-filters" style="
                    flex: 1;
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                    background: ${designSystem.getColor('primary.600')};
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                    cursor: pointer;
                ">Apply</button>
                <button id="clear-filters" style="
                    flex: 1;
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                    background: ${designSystem.getColor('neutral.100')};
                    color: ${designSystem.getColor('neutral.700')};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                    cursor: pointer;
                ">Clear</button>
            </div>
        `;

        // Toggle dropdown
        filterButton.addEventListener('click', () => {
            const isVisible = filterPanel.style.display !== 'none';
            filterPanel.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                filterPanel.style.display = 'none';
            }
        });

        this.setupFilterEvents(filterPanel);

        dropdown.appendChild(filterButton);
        dropdown.appendChild(filterPanel);

        return dropdown;
    }

    createBulkActions() {
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            gap: ${designSystem.getSpacing(2)};
        `;

        // Select all button
        const selectAllBtn = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.addEventListener('click', () => this.selectAll());

        // Clear selection button
        const clearSelectionBtn = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        clearSelectionBtn.textContent = 'Clear';
        clearSelectionBtn.addEventListener('click', () => this.clearSelection());

        actions.appendChild(selectAllBtn);
        actions.appendChild(clearSelectionBtn);

        return actions;
    }

    createDocumentList() {
        const listContainer = document.createElement('div');
        listContainer.className = 'document-list-container';
        listContainer.style.cssText = `
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // List header
        const listHeader = document.createElement('div');
        listHeader.className = 'document-list-header';
        listHeader.style.cssText = `
            display: grid;
            grid-template-columns: 40px 1fr 120px 100px 120px;
            gap: ${designSystem.getSpacing(3)};
            padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
            background-color: ${designSystem.getColor('neutral.50')};
            border-radius: var(--radius-md);
            font-size: ${designSystem.getFontSize('sm')};
            font-weight: var(--font-weight-medium);
            color: ${designSystem.getColor('neutral.700')};
            margin-bottom: ${designSystem.getSpacing(3)};
        `;

        listHeader.innerHTML = `
            <div></div>
            <div>Document</div>
            <div>Type</div>
            <div>Size</div>
            <div>Status</div>
        `;

        // Scrollable list
        const scrollableList = document.createElement('div');
        scrollableList.className = 'document-list-scroll';
        scrollableList.id = 'document-list';
        scrollableList.style.cssText = `
            flex: 1;
            overflow-y: auto;
            border: 1px solid ${designSystem.getColor('neutral.200')};
            border-radius: var(--radius-lg);
        `;

        listContainer.appendChild(listHeader);
        listContainer.appendChild(scrollableList);

        return listContainer;
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'batch-sidebar';
        sidebar.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: ${designSystem.getSpacing(4)};
        `;

        // Bulk settings card
        const settingsCard = this.createBulkSettingsCard();
        sidebar.appendChild(settingsCard);

        // Export queue card
        const queueCard = this.createQueueCard();
        sidebar.appendChild(queueCard);

        // Progress card
        const progressCard = this.createProgressCard();
        sidebar.appendChild(progressCard);

        return sidebar;
    }

    createBulkSettingsCard() {
        const card = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'medium' },
            []
        );

        card.innerHTML = `
            <h3 style="
                margin: 0 0 ${designSystem.getSpacing(4)} 0;
                font-size: ${designSystem.getFontSize('lg')};
                font-weight: var(--font-weight-medium);
                color: ${designSystem.getColor('neutral.800')};
            ">Bulk Settings</h3>

            <div class="setting-group" style="margin-bottom: ${designSystem.getSpacing(4)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Export Format</label>
                <select id="bulk-format" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="pdf">PDF</option>
                    <option value="docx">Word Document</option>
                    <option value="latex">LaTeX</option>
                    <option value="html">HTML</option>
                </select>
            </div>

            <div class="setting-group" style="margin-bottom: ${designSystem.getSpacing(4)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Citation Style</label>
                <select id="bulk-template" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="apa">APA 7th</option>
                    <option value="mla">MLA 9th</option>
                    <option value="chicago">Chicago 17th</option>
                    <option value="ieee">IEEE</option>
                </select>
            </div>

            <div class="setting-group" style="margin-bottom: ${designSystem.getSpacing(4)};">
                <label style="
                    display: block;
                    font-size: ${designSystem.getFontSize('sm')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.700')};
                    margin-bottom: ${designSystem.getSpacing(1)};
                ">Quality</label>
                <select id="bulk-quality" style="
                    width: 100%;
                    padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
                    border: 1px solid ${designSystem.getColor('neutral.300')};
                    border-radius: var(--radius-md);
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <option value="draft">Draft</option>
                    <option value="normal">Normal</option>
                    <option value="high">High Quality</option>
                </select>
            </div>

            <div class="setting-group" style="margin-bottom: ${designSystem.getSpacing(4)};">
                <label style="
                    display: flex;
                    align-items: center;
                    gap: ${designSystem.getSpacing(2)};
                    font-size: ${designSystem.getFontSize('sm')};
                    color: ${designSystem.getColor('neutral.700')};
                ">
                    <input type="checkbox" id="apply-to-all" checked>
                    Apply settings to all selected documents
                </label>
            </div>

            <button id="start-batch-export" class="ds-button ds-button-size-md ds-button-variant-primary" style="
                width: 100%;
                margin-top: ${designSystem.getSpacing(2)};
            " disabled>
                Start Batch Export
            </button>
        `;

        this.setupBulkSettingsEvents(card);

        return card;
    }

    createQueueCard() {
        const card = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'medium' },
            []
        );

        card.innerHTML = `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: ${designSystem.getSpacing(3)};
            ">
                <h3 style="
                    margin: 0;
                    font-size: ${designSystem.getFontSize('lg')};
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.800')};
                ">Export Queue</h3>
                <span id="queue-count" style="
                    background-color: ${designSystem.getColor('primary.100')};
                    color: ${designSystem.getColor('primary.700')};
                    font-size: ${designSystem.getFontSize('xs')};
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                ">0</span>
            </div>

            <div id="queue-list" style="
                max-height: 200px;
                overflow-y: auto;
            ">
                <div class="empty-queue" style="
                    text-align: center;
                    padding: ${designSystem.getSpacing(6)};
                    color: ${designSystem.getColor('neutral.500')};
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <div style="font-size: 24px; margin-bottom: ${designSystem.getSpacing(2)};">📋</div>
                    No documents in queue
                </div>
            </div>

            <div style="
                display: flex;
                gap: ${designSystem.getSpacing(2)};
                margin-top: ${designSystem.getSpacing(3)};
            ">
                <button id="pause-queue" class="ds-button ds-button-size-sm ds-button-variant-ghost" style="flex: 1;" disabled>
                    ⏸️ Pause
                </button>
                <button id="clear-queue" class="ds-button ds-button-size-sm ds-button-variant-ghost" style="flex: 1;" disabled>
                    🗑️ Clear
                </button>
            </div>
        `;

        return card;
    }

    createProgressCard() {
        const card = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'medium' },
            []
        );

        card.innerHTML = `
            <h3 style="
                margin: 0 0 ${designSystem.getSpacing(4)} 0;
                font-size: ${designSystem.getFontSize('lg')};
                font-weight: var(--font-weight-medium);
                color: ${designSystem.getColor('neutral.800')};
            ">Progress</h3>

            <div class="progress-stats" style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: ${designSystem.getSpacing(3)};
                margin-bottom: ${designSystem.getSpacing(4)};
            ">
                <div class="stat-item" style="text-align: center;">
                    <div id="completed-count" style="
                        font-size: ${designSystem.getFontSize('xl')};
                        font-weight: var(--font-weight-semibold);
                        color: ${designSystem.getColor('semantic.success')};
                    ">0</div>
                    <div style="
                        font-size: ${designSystem.getFontSize('xs')};
                        color: ${designSystem.getColor('neutral.600')};
                    ">Completed</div>
                </div>

                <div class="stat-item" style="text-align: center;">
                    <div id="failed-count" style="
                        font-size: ${designSystem.getFontSize('xl')};
                        font-weight: var(--font-weight-semibold);
                        color: ${designSystem.getColor('semantic.error')};
                    ">0</div>
                    <div style="
                        font-size: ${designSystem.getFontSize('xs')};
                        color: ${designSystem.getColor('neutral.600')};
                    ">Failed</div>
                </div>
            </div>

            <div class="overall-progress" style="margin-bottom: ${designSystem.getSpacing(4)};">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: ${designSystem.getSpacing(2)};
                ">
                    <span style="
                        font-size: ${designSystem.getFontSize('sm')};
                        color: ${designSystem.getColor('neutral.700')};
                    ">Overall Progress</span>
                    <span id="progress-percentage" style="
                        font-size: ${designSystem.getFontSize('sm')};
                        font-weight: var(--font-weight-medium);
                        color: ${designSystem.getColor('neutral.800')};
                    ">0%</span>
                </div>

                <div class="progress-bar" style="
                    width: 100%;
                    height: 8px;
                    background-color: ${designSystem.getColor('neutral.200')};
                    border-radius: var(--radius-full);
                    overflow: hidden;
                ">
                    <div id="progress-fill" style="
                        height: 100%;
                        background-color: ${designSystem.getColor('primary.500')};
                        width: 0%;
                        transition: width var(--animation-duration-normal) var(--animation-easing-ease);
                    "></div>
                </div>
            </div>

            <div id="current-export" style="
                font-size: ${designSystem.getFontSize('sm')};
                color: ${designSystem.getColor('neutral.600')};
                font-style: italic;
                display: none;
            ">
                Currently exporting: <span id="current-export-name">Document Name</span>
            </div>
        `;

        return card;
    }

    async loadAvailableDocuments() {
        this.performance.trackInteraction('documents_load_start');

        // Simulate loading documents from API
        const documents = await this.fetchDocuments();

        // Use virtual scrolling for large document lists
        const documentList = this.container.querySelector('#document-list');

        if (documents.length > 100) {
            this.setupVirtualDocumentList(documentList, documents);
        } else {
            this.renderDocumentList(documentList, documents);
        }

        this.performance.trackInteraction('documents_load_complete');
    }

    async fetchDocuments() {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate mock documents
        const documentTypes = ['research', 'notes', 'drafts'];
        const statuses = ['ready', 'pending', 'completed'];
        const sizes = ['small', 'medium', 'large'];

        return Array.from({ length: 150 }, (_, index) => ({
            id: `doc-${index + 1}`,
            title: `Research Document ${index + 1}`,
            type: documentTypes[index % documentTypes.length],
            status: statuses[index % statuses.length],
            size: sizes[index % sizes.length],
            pageCount: Math.floor(Math.random() * 100) + 5,
            fileSize: Math.floor(Math.random() * 5000) + 100, // KB
            lastModified: new Date(Date.now() - Math.random() * 7776000000), // Random within 90 days
            author: 'Author Name',
            format: 'markdown'
        }));
    }

    setupVirtualDocumentList(container, documents) {
        this.virtualScroller = performanceOptimizer.createVirtualScroller(
            container,
            documents,
            (doc, index) => this.renderDocumentItem(doc, index),
            60 // Item height
        );
    }

    renderDocumentList(container, documents) {
        container.innerHTML = '';

        documents.forEach((doc, index) => {
            const item = this.renderDocumentItem(doc, index);
            container.appendChild(item);
        });
    }

    renderDocumentItem(document, index) {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.dataset.documentId = document.id;
        item.style.cssText = `
            display: grid;
            grid-template-columns: 40px 1fr 120px 100px 120px;
            gap: ${designSystem.getSpacing(3)};
            padding: ${designSystem.getSpacing(3)};
            border-bottom: 1px solid ${designSystem.getColor('neutral.100')};
            transition: background-color var(--animation-duration-fast) var(--animation-easing-ease);
            cursor: pointer;
            align-items: center;
        `;

        // Hover effect
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = designSystem.getColor('neutral.50');
        });

        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = this.state.selectedDocuments.has(document.id)
                ? designSystem.getColor('primary.50')
                : '';
        });

        const isSelected = this.state.selectedDocuments.has(document.id);

        item.innerHTML = `
            <div class="select-checkbox">
                <input type="checkbox" ${isSelected ? 'checked' : ''}
                       data-document-id="${document.id}"
                       style="
                           width: 16px;
                           height: 16px;
                           cursor: pointer;
                       ">
            </div>

            <div class="document-info">
                <div style="
                    font-weight: var(--font-weight-medium);
                    color: ${designSystem.getColor('neutral.800')};
                    margin-bottom: 2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                ">${document.title}</div>
                <div style="
                    font-size: ${designSystem.getFontSize('xs')};
                    color: ${designSystem.getColor('neutral.500')};
                ">${document.pageCount} pages • ${Math.round(document.fileSize)} KB</div>
            </div>

            <div class="document-type">
                <span class="type-badge" style="
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-size: ${designSystem.getFontSize('xs')};
                    font-weight: var(--font-weight-medium);
                    ${this.getTypeBadgeStyles(document.type)}
                ">${this.formatDocumentType(document.type)}</span>
            </div>

            <div class="document-size" style="
                font-size: ${designSystem.getFontSize('sm')};
                color: ${designSystem.getColor('neutral.600')};
            ">${this.formatSize(document.size)}</div>

            <div class="document-status">
                <span class="status-badge" style="
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-size: ${designSystem.getFontSize('xs')};
                    font-weight: var(--font-weight-medium);
                    ${this.getStatusBadgeStyles(document.status)}
                ">${this.formatStatus(document.status)}</span>
            </div>
        `;

        if (isSelected) {
            item.style.backgroundColor = designSystem.getColor('primary.50');
        }

        // Setup selection handling
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleDocumentSelection(document, e.target.checked);
        });

        // Click anywhere on item to select
        item.addEventListener('click', () => {
            const isCurrentlySelected = this.state.selectedDocuments.has(document.id);
            checkbox.checked = !isCurrentlySelected;
            this.toggleDocumentSelection(document, !isCurrentlySelected);
        });

        return item;
    }

    getTypeBadgeStyles(type) {
        const styles = {
            research: `background-color: ${designSystem.getColor('primary.100')}; color: ${designSystem.getColor('primary.700')};`,
            notes: `background-color: ${designSystem.getColor('semantic.warning')}20; color: ${designSystem.getColor('semantic.warning')};`,
            drafts: `background-color: ${designSystem.getColor('neutral.200')}; color: ${designSystem.getColor('neutral.700')};`
        };
        return styles[type] || styles.drafts;
    }

    getStatusBadgeStyles(status) {
        const styles = {
            ready: `background-color: ${designSystem.getColor('semantic.success')}20; color: ${designSystem.getColor('semantic.success')};`,
            pending: `background-color: ${designSystem.getColor('semantic.warning')}20; color: ${designSystem.getColor('semantic.warning')};`,
            completed: `background-color: ${designSystem.getColor('primary.100')}; color: ${designSystem.getColor('primary.700')};`
        };
        return styles[status] || styles.ready;
    }

    formatDocumentType(type) {
        const typeMap = {
            research: 'Research',
            notes: 'Notes',
            drafts: 'Draft'
        };
        return typeMap[type] || type;
    }

    formatSize(size) {
        const sizeMap = {
            small: 'Small',
            medium: 'Medium',
            large: 'Large'
        };
        return sizeMap[size] || size;
    }

    formatStatus(status) {
        const statusMap = {
            ready: 'Ready',
            pending: 'Pending',
            completed: 'Done'
        };
        return statusMap[status] || status;
    }

    setupEventListeners() {
        // Bulk settings events are handled in setupBulkSettingsEvents
    }

    setupFilterEvents(filterPanel) {
        const applyBtn = filterPanel.querySelector('#apply-filters');
        const clearBtn = filterPanel.querySelector('#clear-filters');

        applyBtn.addEventListener('click', () => {
            this.applyFilters();
            filterPanel.style.display = 'none';
        });

        clearBtn.addEventListener('click', () => {
            this.clearFilters();
            filterPanel.style.display = 'none';
        });
    }

    setupBulkSettingsEvents(card) {
        const formatSelect = card.querySelector('#bulk-format');
        const templateSelect = card.querySelector('#bulk-template');
        const qualitySelect = card.querySelector('#bulk-quality');
        const applyToAllCheckbox = card.querySelector('#apply-to-all');
        const startButton = card.querySelector('#start-batch-export');

        // Update bulk settings when changed
        [formatSelect, templateSelect, qualitySelect].forEach(select => {
            select.addEventListener('change', () => {
                this.updateBulkSettings();
            });
        });

        applyToAllCheckbox.addEventListener('change', () => {
            this.state.bulkSettings.applyToAll = applyToAllCheckbox.checked;
        });

        startButton.addEventListener('click', () => {
            this.startBatchExport();
        });
    }

    toggleDocumentSelection(document, selected) {
        if (selected) {
            this.state.selectedDocuments.set(document.id, document);
        } else {
            this.state.selectedDocuments.delete(document.id);
        }

        this.updateSelectionUI();
        this.callbacks.onDocumentSelect(document, selected, this.state.selectedDocuments);
    }

    updateSelectionUI() {
        const count = this.state.selectedDocuments.size;

        // Update selection count
        const countElement = this.container.querySelector('#selection-count');
        if (countElement) {
            countElement.textContent = count;
        }

        // Enable/disable start button
        const startButton = this.container.querySelector('#start-batch-export');
        if (startButton) {
            startButton.disabled = count === 0 || this.state.isExporting;
        }

        // Update document item styles
        const items = this.container.querySelectorAll('.document-item');
        items.forEach(item => {
            const documentId = item.dataset.documentId;
            const isSelected = this.state.selectedDocuments.has(documentId);

            item.style.backgroundColor = isSelected
                ? designSystem.getColor('primary.50')
                : '';

            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = isSelected;
            }
        });
    }

    selectAll() {
        const items = this.container.querySelectorAll('.document-item');
        items.forEach(item => {
            const documentId = item.dataset.documentId;
            const checkbox = item.querySelector('input[type="checkbox"]');

            if (!this.state.selectedDocuments.has(documentId)) {
                checkbox.checked = true;
                // Note: This is simplified - in a real implementation we'd need the full document object
                this.state.selectedDocuments.set(documentId, { id: documentId });
            }
        });

        this.updateSelectionUI();
    }

    clearSelection() {
        this.state.selectedDocuments.clear();
        this.updateSelectionUI();
    }

    updateBulkSettings() {
        const formatSelect = this.container.querySelector('#bulk-format');
        const templateSelect = this.container.querySelector('#bulk-template');
        const qualitySelect = this.container.querySelector('#bulk-quality');

        this.state.bulkSettings.format = formatSelect.value;
        this.state.bulkSettings.template = templateSelect.value;
        this.state.bulkSettings.quality = qualitySelect.value;
    }

    applyFilters() {
        const formatFilter = this.container.querySelector('#format-filter').value;
        const statusFilter = this.container.querySelector('#status-filter').value;
        const sizeFilter = this.container.querySelector('#size-filter').value;

        this.state.filters = {
            format: formatFilter,
            status: statusFilter,
            size: sizeFilter
        };

        // Reload document list with filters
        this.loadAvailableDocuments();
    }

    clearFilters() {
        this.state.filters = {
            format: 'all',
            status: 'all',
            size: 'all'
        };

        // Reset filter UI
        this.container.querySelector('#format-filter').value = 'all';
        this.container.querySelector('#status-filter').value = 'all';
        this.container.querySelector('#size-filter').value = 'all';

        // Reload document list
        this.loadAvailableDocuments();
    }

    async startBatchExport() {
        this.performance.trackInteraction('batch_export_start');

        if (this.state.selectedDocuments.size === 0) {
            alert('Please select documents to export');
            return;
        }

        this.state.isExporting = true;
        this.updateExportingState();

        // Prepare export queue
        this.prepareExportQueue();

        this.callbacks.onBatchStart({
            documentCount: this.state.selectedDocuments.size,
            settings: this.state.bulkSettings
        });

        try {
            // Process exports in chunks for better performance
            await this.chunkedProcessor.processInChunks(
                Array.from(this.state.selectedDocuments.values())
            );

            this.completeBatchExport();

        } catch (error) {
            console.error('Batch export failed:', error);
            this.handleBatchExportError(error);
        } finally {
            this.state.isExporting = false;
            this.updateExportingState();
        }
    }

    prepareExportQueue() {
        this.state.exportQueue = Array.from(this.state.selectedDocuments.values()).map(doc => ({
            document: doc,
            settings: { ...this.state.bulkSettings },
            status: 'pending',
            priority: this.calculatePriority(doc),
            estimatedTime: this.estimateExportTime(doc)
        }));

        // Sort queue by priority if using priority strategy
        if (this.options.queueStrategy === 'priority') {
            this.state.exportQueue.sort((a, b) => b.priority - a.priority);
        } else if (this.options.queueStrategy === 'size-optimized') {
            this.state.exportQueue.sort((a, b) => a.document.pageCount - b.document.pageCount);
        }

        this.updateQueueUI();
    }

    calculatePriority(document) {
        let priority = 0;

        // Smaller documents get higher priority for quick wins
        if (document.size === 'small') priority += 30;
        else if (document.size === 'medium') priority += 20;
        else priority += 10;

        // Ready documents get higher priority
        if (document.status === 'ready') priority += 20;

        // Research papers get higher priority
        if (document.type === 'research') priority += 10;

        return priority;
    }

    estimateExportTime(document) {
        const baseTime = 2; // 2 seconds base
        const pageMultiplier = document.pageCount * 0.1;
        const qualityMultiplier = {
            draft: 0.5,
            normal: 1.0,
            high: 2.0
        };

        return Math.round(baseTime + pageMultiplier) * qualityMultiplier[this.state.bulkSettings.quality];
    }

    async processExportChunk(documents) {
        const results = [];

        for (const document of documents) {
            try {
                const result = await this.processExportOperation(document);
                results.push(result);
            } catch (error) {
                console.error(`Failed to export ${document.title}:`, error);
                this.state.failedExports.set(document.id, { document, error });
                this.updateProgressUI();
            }
        }

        return results;
    }

    async processExportOperation(document) {
        this.performance.trackInteraction('document_export_start');

        const exportJob = {
            document,
            settings: this.state.bulkSettings,
            startTime: Date.now()
        };

        this.state.activeExports.set(document.id, exportJob);
        this.updateCurrentExportUI(document.title);

        // Queue the actual export operation
        const result = await this.requestQueue.queueRequest(async () => {
            return this.performExport(document, this.state.bulkSettings);
        });

        this.state.activeExports.delete(document.id);
        this.state.completedExports.set(document.id, {
            document,
            result,
            duration: Date.now() - exportJob.startTime
        });

        this.updateProgressUI();
        this.callbacks.onExportComplete(document, result);

        this.performance.trackInteraction('document_export_complete');

        return result;
    }

    async performExport(document, settings) {
        // Simulate export process
        const estimatedTime = this.estimateExportTime(document);
        await new Promise(resolve => setTimeout(resolve, estimatedTime * 100)); // Scaled down for demo

        return {
            success: true,
            format: settings.format,
            fileSize: Math.round(document.fileSize * 1.2), // Slightly larger than original
            downloadUrl: `exports/${document.id}.${settings.format}`
        };
    }

    updateExportingState() {
        const startButton = this.container.querySelector('#start-batch-export');
        const pauseButton = this.container.querySelector('#pause-queue');
        const clearButton = this.container.querySelector('#clear-queue');

        if (this.state.isExporting) {
            startButton.textContent = 'Exporting...';
            startButton.disabled = true;
            pauseButton.disabled = false;
            clearButton.disabled = false;
        } else {
            startButton.textContent = 'Start Batch Export';
            startButton.disabled = this.state.selectedDocuments.size === 0;
            pauseButton.disabled = true;
            clearButton.disabled = true;
        }
    }

    updateQueueUI() {
        const queueList = this.container.querySelector('#queue-list');
        const queueCount = this.container.querySelector('#queue-count');

        queueCount.textContent = this.state.exportQueue.length;

        if (this.state.exportQueue.length === 0) {
            queueList.innerHTML = `
                <div class="empty-queue" style="
                    text-align: center;
                    padding: ${designSystem.getSpacing(6)};
                    color: ${designSystem.getColor('neutral.500')};
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <div style="font-size: 24px; margin-bottom: ${designSystem.getSpacing(2)};">📋</div>
                    No documents in queue
                </div>
            `;
        } else {
            queueList.innerHTML = this.state.exportQueue.map(item => `
                <div class="queue-item" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: ${designSystem.getSpacing(2)};
                    border-bottom: 1px solid ${designSystem.getColor('neutral.100')};
                    font-size: ${designSystem.getFontSize('sm')};
                ">
                    <div style="flex: 1; overflow: hidden;">
                        <div style="
                            font-weight: var(--font-weight-medium);
                            color: ${designSystem.getColor('neutral.800')};
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        ">${item.document.title}</div>
                        <div style="
                            font-size: ${designSystem.getFontSize('xs')};
                            color: ${designSystem.getColor('neutral.500')};
                        ">${item.settings.format.toUpperCase()} • ~${item.estimatedTime}s</div>
                    </div>
                    <span class="queue-status" style="
                        font-size: ${designSystem.getFontSize('xs')};
                        color: ${item.status === 'active' ? designSystem.getColor('primary.600') : designSystem.getColor('neutral.500')};
                    ">${item.status}</span>
                </div>
            `).join('');
        }
    }

    updateCurrentExportUI(documentTitle) {
        const currentExport = this.container.querySelector('#current-export');
        const currentExportName = this.container.querySelector('#current-export-name');

        if (currentExport && currentExportName) {
            currentExport.style.display = 'block';
            currentExportName.textContent = documentTitle;
        }
    }

    updateProgressUI() {
        const totalDocuments = this.state.selectedDocuments.size;
        const completedCount = this.state.completedExports.size;
        const failedCount = this.state.failedExports.size;
        const progressPercentage = totalDocuments > 0 ? ((completedCount + failedCount) / totalDocuments) * 100 : 0;

        // Update counts
        const completedElement = this.container.querySelector('#completed-count');
        const failedElement = this.container.querySelector('#failed-count');
        const progressElement = this.container.querySelector('#progress-percentage');
        const progressFill = this.container.querySelector('#progress-fill');

        if (completedElement) completedElement.textContent = completedCount;
        if (failedElement) failedElement.textContent = failedCount;
        if (progressElement) progressElement.textContent = `${Math.round(progressPercentage)}%`;
        if (progressFill) progressFill.style.width = `${progressPercentage}%`;

        // Update overall state
        this.state.totalProgress = progressPercentage;

        // Notify callback
        this.callbacks.onBatchProgress({
            totalDocuments,
            completed: completedCount,
            failed: failedCount,
            percentage: progressPercentage
        });
    }

    completeBatchExport() {
        this.performance.trackInteraction('batch_export_complete');

        // Hide current export indicator
        const currentExport = this.container.querySelector('#current-export');
        if (currentExport) {
            currentExport.style.display = 'none';
        }

        // Show completion notification
        this.showBatchCompleteNotification();

        this.callbacks.onBatchComplete({
            totalDocuments: this.state.selectedDocuments.size,
            completedExports: this.state.completedExports,
            failedExports: this.state.failedExports,
            totalTime: 0 // Calculate total time if needed
        });
    }

    showBatchCompleteNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${designSystem.getSpacing(4)};
            right: ${designSystem.getSpacing(4)};
            background: white;
            border: 1px solid ${designSystem.getColor('semantic.success')};
            border-radius: var(--radius-lg);
            padding: ${designSystem.getSpacing(4)};
            box-shadow: ${designSystem.getTokenValue('shadows', 'lg')};
            z-index: 1000;
            max-width: 400px;
        `;

        const completedCount = this.state.completedExports.size;
        const failedCount = this.state.failedExports.size;

        notification.innerHTML = `
            <div style="
                display: flex;
                align-items: flex-start;
                gap: ${designSystem.getSpacing(3)};
            ">
                <div style="color: ${designSystem.getColor('semantic.success')}; font-size: 20px;">✅</div>
                <div>
                    <h4 style="
                        margin: 0 0 ${designSystem.getSpacing(1)} 0;
                        color: ${designSystem.getColor('neutral.800')};
                    ">Batch Export Complete</h4>
                    <p style="
                        margin: 0 0 ${designSystem.getSpacing(2)} 0;
                        font-size: ${designSystem.getFontSize('sm')};
                        color: ${designSystem.getColor('neutral.600')};
                    ">
                        ${completedCount} documents exported successfully
                        ${failedCount > 0 ? `, ${failedCount} failed` : ''}
                    </p>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: none;
                        border: none;
                        color: ${designSystem.getColor('primary.600')};
                        font-size: ${designSystem.getFontSize('sm')};
                        cursor: pointer;
                        text-decoration: underline;
                    ">Dismiss</button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
    }

    handleBatchExportError(error) {
        console.error('Batch export error:', error);

        // Show error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: ${designSystem.getSpacing(4)};
            right: ${designSystem.getSpacing(4)};
            background: white;
            border: 1px solid ${designSystem.getColor('semantic.error')};
            border-radius: var(--radius-lg);
            padding: ${designSystem.getSpacing(4)};
            box-shadow: ${designSystem.getTokenValue('shadows', 'lg')};
            z-index: 1000;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="
                display: flex;
                align-items: flex-start;
                gap: ${designSystem.getSpacing(3)};
            ">
                <div style="color: ${designSystem.getColor('semantic.error')}; font-size: 20px;">❌</div>
                <div>
                    <h4 style="
                        margin: 0 0 ${designSystem.getSpacing(1)} 0;
                        color: ${designSystem.getColor('neutral.800')};
                    ">Batch Export Error</h4>
                    <p style="
                        margin: 0 0 ${designSystem.getSpacing(2)} 0;
                        font-size: ${designSystem.getFontSize('sm')};
                        color: ${designSystem.getColor('neutral.600')};
                    ">${error.message || 'An unexpected error occurred during batch export'}</p>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        background: none;
                        border: none;
                        color: ${designSystem.getColor('primary.600')};
                        font-size: ${designSystem.getFontSize('sm')};
                        cursor: pointer;
                        text-decoration: underline;
                    ">Dismiss</button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
    }

    pause() {
        // Implementation for pausing batch export
    }

    resume() {
        // Implementation for resuming batch export
    }

    clearQueue() {
        this.state.exportQueue = [];
        this.updateQueueUI();
    }

    destroy() {
        if (this.virtualScroller && this.virtualScroller.destroy) {
            this.virtualScroller.destroy();
        }

        if (this.performance && this.performance.destroy) {
            this.performance.destroy();
        }
    }
}