/**
 * FormatSelector - Advanced format selection component with preview capabilities
 * Optimized for performance with lazy loading and smart caching
 */

import { designSystem } from '../../design-system/index.js';
import { usePerformanceMonitoring, useMemoizedComputation } from '../../hooks/usePerformance.js';
import { performanceOptimizer, memoize } from '../../../performance/optimizer.js';

export class FormatSelector {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            supportedFormats: ['pdf', 'docx', 'latex', 'html', 'markdown', 'rtf'],
            enablePreview: true,
            enableFormatComparison: true,
            defaultFormat: 'pdf',
            showFormatDetails: true,
            enableQuickAccess: true,
            trackUsageStatistics: true,
            ...options
        };

        this.state = {
            selectedFormat: this.options.defaultFormat,
            hoveredFormat: null,
            comparisonMode: false,
            comparisonFormats: [],
            usageStats: new Map(),
            previewCache: new Map()
        };

        this.callbacks = {
            onFormatChange: options.onFormatChange || (() => {}),
            onPreview: options.onPreview || (() => {}),
            onComparison: options.onComparison || (() => {})
        };

        this.performance = usePerformanceMonitoring('FormatSelector');
        this.memoizedFormatInfo = memoize(this.getFormatInfo.bind(this));

        this.init();
    }

    init() {
        this.performance.startMonitoring();

        this.loadUsageStatistics();
        this.render();
        this.setupEventListeners();
        this.setupPerformanceOptimizations();

        this.performance.endMonitoring();
    }

    render() {
        const selector = this.createSelectorStructure();
        this.container.innerHTML = '';
        this.container.appendChild(selector);
    }

    createSelectorStructure() {
        const wrapper = document.createElement('div');
        wrapper.className = 'format-selector';
        wrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: ${designSystem.getSpacing(4)};
        `;

        // Header with controls
        const header = this.createHeader();
        wrapper.appendChild(header);

        // Format grid
        const formatGrid = this.createFormatGrid();
        wrapper.appendChild(formatGrid);

        // Format details panel
        if (this.options.showFormatDetails) {
            const detailsPanel = this.createDetailsPanel();
            wrapper.appendChild(detailsPanel);
        }

        // Comparison panel (initially hidden)
        if (this.options.enableFormatComparison) {
            const comparisonPanel = this.createComparisonPanel();
            wrapper.appendChild(comparisonPanel);
        }

        return wrapper;
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'format-selector-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${designSystem.getSpacing(2)};
        `;

        const title = document.createElement('h3');
        title.textContent = 'Export Format';
        title.style.cssText = `
            margin: 0;
            font-size: ${designSystem.getFontSize('lg')};
            font-weight: var(--font-weight-medium);
            color: ${designSystem.getColor('neutral.800')};
        `;

        const controls = document.createElement('div');
        controls.className = 'format-controls';
        controls.style.cssText = `
            display: flex;
            gap: ${designSystem.getSpacing(2)};
        `;

        // Quick access to recent formats
        if (this.options.enableQuickAccess) {
            const quickAccessButton = this.createQuickAccessButton();
            controls.appendChild(quickAccessButton);
        }

        // Comparison toggle
        if (this.options.enableFormatComparison) {
            const comparisonButton = this.createComparisonButton();
            controls.appendChild(comparisonButton);
        }

        header.appendChild(title);
        header.appendChild(controls);

        return header;
    }

    createQuickAccessButton() {
        const button = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        button.innerHTML = '⚡ Quick Access';
        button.title = 'Access recently used formats';

        button.addEventListener('click', () => {
            this.showQuickAccess();
        });

        return button;
    }

    createComparisonButton() {
        const button = designSystem.createElement('button', 'button',
            { size: 'sm', variant: 'ghost' },
            []
        );
        button.innerHTML = '⚖️ Compare';
        button.title = 'Compare multiple formats';

        button.addEventListener('click', () => {
            this.toggleComparisonMode();
        });

        return button;
    }

    createFormatGrid() {
        const grid = document.createElement('div');
        grid.className = 'format-grid';
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: ${designSystem.getSpacing(3)};
        `;

        this.options.supportedFormats.forEach(format => {
            const formatCard = this.createFormatCard(format);
            grid.appendChild(formatCard);
        });

        return grid;
    }

    createFormatCard(format) {
        const formatInfo = this.memoizedFormatInfo(format);
        const isSelected = this.state.selectedFormat === format;
        const usageCount = this.state.usageStats.get(format) || 0;

        const card = designSystem.createElement('div', 'card',
            { padding: 'sm', elevation: isSelected ? 'high' : 'medium' },
            isSelected ? ['selected'] : []
        );

        card.className += ' format-card';
        card.dataset.format = format;

        if (isSelected) {
            card.style.borderColor = designSystem.getColor('primary.500');
            card.style.borderWidth = '2px';
        }

        card.innerHTML = `
            <div class="format-card-content" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: ${designSystem.getSpacing(2)};
                position: relative;
            ">
                <div class="format-icon" style="font-size: 2rem;">${formatInfo.icon}</div>
                <div class="format-info">
                    <div class="format-name" style="
                        font-weight: var(--font-weight-semibold);
                        font-size: ${designSystem.getFontSize('base')};
                        color: ${designSystem.getColor('neutral.800')};
                        margin-bottom: ${designSystem.getSpacing(1)};
                    ">${formatInfo.name}</div>
                    <div class="format-description" style="
                        font-size: ${designSystem.getFontSize('sm')};
                        color: ${designSystem.getColor('neutral.600')};
                        line-height: var(--line-height-tight);
                    ">${formatInfo.description}</div>
                </div>

                ${this.createFormatFeatures(formatInfo.features)}

                ${usageCount > 0 ? `
                    <div class="usage-indicator" style="
                        position: absolute;
                        top: ${designSystem.getSpacing(1)};
                        right: ${designSystem.getSpacing(1)};
                        background-color: ${designSystem.getColor('primary.100')};
                        color: ${designSystem.getColor('primary.700')};
                        font-size: ${designSystem.getFontSize('xs')};
                        padding: 2px 6px;
                        border-radius: var(--radius-full);
                    ">${usageCount}</div>
                ` : ''}

                ${this.options.enablePreview ? `
                    <button class="preview-button" style="
                        margin-top: ${designSystem.getSpacing(2)};
                        padding: ${designSystem.getSpacing(1)} ${designSystem.getSpacing(2)};
                        border: 1px solid ${designSystem.getColor('neutral.300')};
                        background: white;
                        border-radius: var(--radius-sm);
                        font-size: ${designSystem.getFontSize('xs')};
                        cursor: pointer;
                        transition: all var(--animation-duration-fast) var(--animation-easing-ease);
                    " onmouseover="this.style.backgroundColor='${designSystem.getColor('neutral.50')}'"
                       onmouseout="this.style.backgroundColor='white'">
                        👁️ Preview
                    </button>
                ` : ''}
            </div>
        `;

        // Add event listeners
        this.setupFormatCardEvents(card, format);

        return card;
    }

    createFormatFeatures(features) {
        if (!features || features.length === 0) return '';

        const featuresHtml = features.slice(0, 3).map(feature =>
            `<span style="
                display: inline-block;
                background-color: ${designSystem.getColor('neutral.100')};
                color: ${designSystem.getColor('neutral.700')};
                font-size: ${designSystem.getFontSize('xs')};
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                margin: 1px;
            ">${feature}</span>`
        ).join('');

        return `
            <div class="format-features" style="
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 2px;
                margin-top: ${designSystem.getSpacing(1)};
            ">
                ${featuresHtml}
            </div>
        `;
    }

    setupFormatCardEvents(card, format) {
        // Click to select
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('preview-button')) {
                this.selectFormat(format);
            }
        });

        // Hover effects
        card.addEventListener('mouseenter', () => {
            this.state.hoveredFormat = format;
            this.updateFormatDetails(format);

            if (!this.isSelected(format)) {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = designSystem.getTokenValue('shadows', 'lg');
            }
        });

        card.addEventListener('mouseleave', () => {
            this.state.hoveredFormat = null;

            if (!this.isSelected(format)) {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = designSystem.getTokenValue('shadows', 'base');
            }
        });

        // Preview button
        const previewButton = card.querySelector('.preview-button');
        if (previewButton) {
            previewButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.previewFormat(format);
            });
        }
    }

    createDetailsPanel() {
        const panel = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'low' },
            []
        );

        panel.className = 'format-details-panel';
        panel.style.cssText += `
            min-height: 120px;
            transition: all var(--animation-duration-normal) var(--animation-easing-ease);
        `;

        // Initial content for selected format
        this.updateDetailsPanel(panel, this.state.selectedFormat);

        return panel;
    }

    updateDetailsPanel(panel, format) {
        const formatInfo = this.memoizedFormatInfo(format);

        panel.innerHTML = `
            <div class="format-details-content">
                <div class="format-details-header" style="
                    display: flex;
                    align-items: center;
                    gap: ${designSystem.getSpacing(3)};
                    margin-bottom: ${designSystem.getSpacing(4)};
                ">
                    <div style="font-size: 1.5rem;">${formatInfo.icon}</div>
                    <div>
                        <h4 style="
                            margin: 0;
                            font-size: ${designSystem.getFontSize('lg')};
                            color: ${designSystem.getColor('neutral.800')};
                        ">${formatInfo.name}</h4>
                        <p style="
                            margin: 0;
                            font-size: ${designSystem.getFontSize('sm')};
                            color: ${designSystem.getColor('neutral.600')};
                        ">${formatInfo.longDescription}</p>
                    </div>
                </div>

                <div class="format-details-specs" style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: ${designSystem.getSpacing(4)};
                ">
                    <div class="spec-column">
                        <h5 style="
                            margin: 0 0 ${designSystem.getSpacing(2)} 0;
                            font-size: ${designSystem.getFontSize('sm')};
                            font-weight: var(--font-weight-semibold);
                            color: ${designSystem.getColor('neutral.700')};
                        ">Features</h5>
                        <ul style="
                            margin: 0;
                            padding-left: ${designSystem.getSpacing(4)};
                            font-size: ${designSystem.getFontSize('sm')};
                            color: ${designSystem.getColor('neutral.600')};
                            line-height: var(--line-height-relaxed);
                        ">
                            ${formatInfo.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="spec-column">
                        <h5 style="
                            margin: 0 0 ${designSystem.getSpacing(2)} 0;
                            font-size: ${designSystem.getFontSize('sm')};
                            font-weight: var(--font-weight-semibold);
                            color: ${designSystem.getColor('neutral.700')};
                        ">Best For</h5>
                        <ul style="
                            margin: 0;
                            padding-left: ${designSystem.getSpacing(4)};
                            font-size: ${designSystem.getFontSize('sm')};
                            color: ${designSystem.getColor('neutral.600')};
                            line-height: var(--line-height-relaxed);
                        ">
                            ${formatInfo.useCases.map(useCase => `<li>${useCase}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                ${formatInfo.limitations ? `
                    <div class="format-limitations" style="
                        margin-top: ${designSystem.getSpacing(4)};
                        padding: ${designSystem.getSpacing(3)};
                        background-color: ${designSystem.getColor('neutral.50')};
                        border-radius: var(--radius-md);
                        border-left: 3px solid ${designSystem.getColor('semantic.warning')};
                    ">
                        <h5 style="
                            margin: 0 0 ${designSystem.getSpacing(1)} 0;
                            font-size: ${designSystem.getFontSize('sm')};
                            color: ${designSystem.getColor('neutral.700')};
                        ">⚠️ Limitations</h5>
                        <p style="
                            margin: 0;
                            font-size: ${designSystem.getFontSize('sm')};
                            color: ${designSystem.getColor('neutral.600')};
                        ">${formatInfo.limitations}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createComparisonPanel() {
        const panel = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'medium' },
            []
        );

        panel.className = 'format-comparison-panel';
        panel.style.cssText += `
            display: none;
            margin-top: ${designSystem.getSpacing(4)};
        `;

        panel.innerHTML = `
            <div class="comparison-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: ${designSystem.getSpacing(4)};
            ">
                <h4 style="margin: 0; font-size: ${designSystem.getFontSize('lg')};">
                    Format Comparison
                </h4>
                <button class="close-comparison" style="
                    background: none;
                    border: none;
                    font-size: ${designSystem.getFontSize('lg')};
                    cursor: pointer;
                    color: ${designSystem.getColor('neutral.500')};
                ">×</button>
            </div>
            <div class="comparison-content">
                <p style="
                    color: ${designSystem.getColor('neutral.600')};
                    font-size: ${designSystem.getFontSize('sm')};
                    text-align: center;
                    margin: ${designSystem.getSpacing(8)} 0;
                ">Select formats to compare by clicking on their cards while in comparison mode.</p>
            </div>
        `;

        // Setup close button
        panel.querySelector('.close-comparison').addEventListener('click', () => {
            this.toggleComparisonMode();
        });

        return panel;
    }

    getFormatInfo(format) {
        const formatDatabase = {
            pdf: {
                name: 'PDF',
                icon: '📄',
                description: 'Portable document',
                longDescription: 'Portable Document Format - universal document format with consistent layout across all devices and platforms.',
                features: ['Fixed layout', 'Print-ready', 'Universal compatibility', 'Embedded fonts'],
                useCases: ['Final publications', 'Professional documents', 'Academic papers', 'Print materials'],
                limitations: 'Cannot be easily edited after generation.'
            },
            docx: {
                name: 'Word',
                icon: '📝',
                description: 'Microsoft Word',
                longDescription: 'Microsoft Word document format - widely used for collaborative editing and document workflows.',
                features: ['Editable text', 'Track changes', 'Comments', 'Collaborative editing'],
                useCases: ['Collaborative writing', 'Draft documents', 'Review workflows', 'Further editing'],
                limitations: 'May have formatting inconsistencies across different versions of Word.'
            },
            latex: {
                name: 'LaTeX',
                icon: '📑',
                description: 'Academic typesetting',
                longDescription: 'LaTeX typesetting system - professional document preparation system optimized for academic and scientific documents.',
                features: ['Professional typography', 'Mathematical formulas', 'Bibliography management', 'Cross-references'],
                useCases: ['Academic papers', 'Scientific documents', 'Theses', 'Books with complex layouts'],
                limitations: 'Requires LaTeX knowledge to modify and compile.'
            },
            html: {
                name: 'HTML',
                icon: '🌐',
                description: 'Web document',
                longDescription: 'HyperText Markup Language - web-native format perfect for online publishing and interactive content.',
                features: ['Web compatibility', 'Interactive elements', 'Responsive design', 'Search engine friendly'],
                useCases: ['Web publishing', 'Online documentation', 'Interactive reports', 'Blog posts'],
                limitations: 'Appearance may vary across browsers and devices.'
            },
            markdown: {
                name: 'Markdown',
                icon: '📋',
                description: 'Lightweight markup',
                longDescription: 'Markdown format - lightweight markup language that converts to HTML and other formats.',
                features: ['Simple syntax', 'Version control friendly', 'Platform independent', 'Quick writing'],
                useCases: ['Documentation', 'README files', 'Blog writing', 'Quick notes'],
                limitations: 'Limited formatting options compared to rich text formats.'
            },
            rtf: {
                name: 'RTF',
                icon: '📄',
                description: 'Rich text format',
                longDescription: 'Rich Text Format - cross-platform document format supported by most word processors.',
                features: ['Cross-platform', 'Basic formatting', 'Embedded objects', 'Wide compatibility'],
                useCases: ['Cross-platform sharing', 'Legacy system support', 'Simple documents', 'Email attachments'],
                limitations: 'Limited advanced formatting compared to modern formats.'
            }
        };

        return formatDatabase[format] || {
            name: format.toUpperCase(),
            icon: '📄',
            description: 'Document format',
            longDescription: `${format.toUpperCase()} document format.`,
            features: ['Standard formatting'],
            useCases: ['General documents'],
            limitations: null
        };
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                const numberKeys = ['1', '2', '3', '4', '5', '6'];
                const keyIndex = numberKeys.indexOf(e.key);

                if (keyIndex !== -1 && keyIndex < this.options.supportedFormats.length) {
                    e.preventDefault();
                    this.selectFormat(this.options.supportedFormats[keyIndex]);
                }
            }
        });
    }

    setupPerformanceOptimizations() {
        // Lazy load format previews
        performanceOptimizer.observeForLazyLoad(this.container, () => {
            this.preloadCommonFormats();
        });

        // Setup memory cleanup
        this.memoryCleanupInterval = setInterval(() => {
            this.cleanupPreviewCache();
        }, 60000); // Every minute
    }

    preloadCommonFormats() {
        const commonFormats = ['pdf', 'docx', 'html'];
        commonFormats.forEach(format => {
            if (this.options.supportedFormats.includes(format)) {
                this.memoizedFormatInfo(format);
            }
        });
    }

    cleanupPreviewCache() {
        if (this.state.previewCache.size > 20) {
            const entries = Array.from(this.state.previewCache.entries());
            const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            const toRemove = sorted.slice(0, 10);

            toRemove.forEach(([key]) => {
                this.state.previewCache.delete(key);
            });
        }
    }

    // Public methods
    selectFormat(format) {
        this.performance.trackInteraction('format_select');

        if (this.state.comparisonMode) {
            this.toggleFormatComparison(format);
            return;
        }

        const previousFormat = this.state.selectedFormat;
        this.state.selectedFormat = format;

        // Update usage statistics
        this.updateUsageStatistics(format);

        // Update UI
        this.updateFormatSelection(previousFormat, format);
        this.updateFormatDetails(format);

        // Notify callback
        this.callbacks.onFormatChange(format, previousFormat);
    }

    updateFormatSelection(previousFormat, newFormat) {
        // Update previous format card
        if (previousFormat) {
            const previousCard = this.container.querySelector(`[data-format="${previousFormat}"]`);
            if (previousCard) {
                previousCard.style.borderColor = '';
                previousCard.style.borderWidth = '';
                previousCard.style.transform = '';
                previousCard.classList.remove('selected');
            }
        }

        // Update new format card
        const newCard = this.container.querySelector(`[data-format="${newFormat}"]`);
        if (newCard) {
            newCard.style.borderColor = designSystem.getColor('primary.500');
            newCard.style.borderWidth = '2px';
            newCard.style.transform = 'translateY(-2px)';
            newCard.classList.add('selected');
        }
    }

    updateFormatDetails(format) {
        const detailsPanel = this.container.querySelector('.format-details-panel');
        if (detailsPanel) {
            this.updateDetailsPanel(detailsPanel, format);
        }
    }

    updateUsageStatistics(format) {
        if (!this.options.trackUsageStatistics) return;

        const currentCount = this.state.usageStats.get(format) || 0;
        this.state.usageStats.set(format, currentCount + 1);

        // Update usage indicator
        const card = this.container.querySelector(`[data-format="${format}"]`);
        const indicator = card?.querySelector('.usage-indicator');
        if (indicator) {
            indicator.textContent = currentCount + 1;
        }

        // Save to localStorage
        this.saveUsageStatistics();
    }

    loadUsageStatistics() {
        try {
            const saved = localStorage.getItem('format-selector-usage');
            if (saved) {
                const data = JSON.parse(saved);
                this.state.usageStats = new Map(Object.entries(data));
            }
        } catch (error) {
            console.warn('Failed to load usage statistics:', error);
        }
    }

    saveUsageStatistics() {
        try {
            const data = Object.fromEntries(this.state.usageStats);
            localStorage.setItem('format-selector-usage', JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save usage statistics:', error);
        }
    }

    previewFormat(format) {
        this.performance.trackInteraction('format_preview');

        // Check cache first
        const cacheKey = `preview-${format}`;
        if (this.state.previewCache.has(cacheKey)) {
            const cached = this.state.previewCache.get(cacheKey);
            cached.lastAccessed = Date.now();
            this.callbacks.onPreview(format, cached.data);
            return;
        }

        // Generate preview
        const previewData = this.generateFormatPreview(format);
        this.state.previewCache.set(cacheKey, {
            data: previewData,
            lastAccessed: Date.now()
        });

        this.callbacks.onPreview(format, previewData);
    }

    generateFormatPreview(format) {
        // Simulate preview generation
        return {
            format,
            timestamp: Date.now(),
            sampleContent: `This is a preview of how your document will look when exported as ${format.toUpperCase()}.`,
            estimatedSize: Math.floor(Math.random() * 1000) + 100 + ' KB',
            processingTime: Math.floor(Math.random() * 5) + 1 + ' seconds'
        };
    }

    toggleComparisonMode() {
        this.state.comparisonMode = !this.state.comparisonMode;
        this.state.comparisonFormats = [];

        const comparisonPanel = this.container.querySelector('.format-comparison-panel');
        const comparisonButton = this.container.querySelector('.format-controls button[title*="Compare"]');

        if (this.state.comparisonMode) {
            comparisonPanel.style.display = 'block';
            comparisonButton.style.backgroundColor = designSystem.getColor('primary.100');
            this.container.classList.add('comparison-mode');
        } else {
            comparisonPanel.style.display = 'none';
            comparisonButton.style.backgroundColor = '';
            this.container.classList.remove('comparison-mode');
        }
    }

    toggleFormatComparison(format) {
        const index = this.state.comparisonFormats.indexOf(format);

        if (index > -1) {
            this.state.comparisonFormats.splice(index, 1);
        } else if (this.state.comparisonFormats.length < 3) {
            this.state.comparisonFormats.push(format);
        }

        this.updateComparisonDisplay();
    }

    updateComparisonDisplay() {
        const comparisonPanel = this.container.querySelector('.format-comparison-panel');
        const content = comparisonPanel.querySelector('.comparison-content');

        if (this.state.comparisonFormats.length === 0) {
            content.innerHTML = `
                <p style="
                    color: ${designSystem.getColor('neutral.600')};
                    font-size: ${designSystem.getFontSize('sm')};
                    text-align: center;
                    margin: ${designSystem.getSpacing(8)} 0;
                ">Select formats to compare by clicking on their cards.</p>
            `;
            return;
        }

        const comparisonTable = this.generateComparisonTable(this.state.comparisonFormats);
        content.innerHTML = comparisonTable;
    }

    generateComparisonTable(formats) {
        const formatInfos = formats.map(format => this.memoizedFormatInfo(format));

        const attributes = ['Features', 'Best For', 'Limitations'];

        let tableHTML = `
            <table style="
                width: 100%;
                border-collapse: collapse;
                font-size: ${designSystem.getFontSize('sm')};
            ">
                <thead>
                    <tr style="border-bottom: 2px solid ${designSystem.getColor('neutral.200')};">
                        <th style="padding: ${designSystem.getSpacing(2)}; text-align: left;">Attribute</th>
        `;

        formats.forEach(format => {
            const info = this.memoizedFormatInfo(format);
            tableHTML += `
                <th style="
                    padding: ${designSystem.getSpacing(2)};
                    text-align: center;
                    background-color: ${designSystem.getColor('neutral.50')};
                ">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span style="font-size: 1.2rem;">${info.icon}</span>
                        <span>${info.name}</span>
                    </div>
                </th>
            `;
        });

        tableHTML += '</tr></thead><tbody>';

        attributes.forEach((attr, index) => {
            tableHTML += `
                <tr style="
                    border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
                    ${index % 2 === 0 ? `background-color: ${designSystem.getColor('neutral.25')};` : ''}
                ">
                    <td style="
                        padding: ${designSystem.getSpacing(3)};
                        font-weight: var(--font-weight-medium);
                        color: ${designSystem.getColor('neutral.700')};
                    ">${attr}</td>
            `;

            formats.forEach(format => {
                const info = this.memoizedFormatInfo(format);
                let cellContent = '';

                switch (attr) {
                    case 'Features':
                        cellContent = info.features.slice(0, 3).join(', ');
                        break;
                    case 'Best For':
                        cellContent = info.useCases.slice(0, 2).join(', ');
                        break;
                    case 'Limitations':
                        cellContent = info.limitations || 'None specified';
                        break;
                }

                tableHTML += `
                    <td style="
                        padding: ${designSystem.getSpacing(3)};
                        color: ${designSystem.getColor('neutral.600')};
                        line-height: var(--line-height-relaxed);
                    ">${cellContent}</td>
                `;
            });

            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';

        return tableHTML;
    }

    showQuickAccess() {
        // Get most used formats
        const sortedFormats = Array.from(this.state.usageStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([format]) => format);

        if (sortedFormats.length === 0) {
            alert('No usage history available yet.');
            return;
        }

        const quickAccessPanel = document.createElement('div');
        quickAccessPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: ${designSystem.getSpacing(6)};
            border-radius: var(--radius-lg);
            box-shadow: ${designSystem.getTokenValue('shadows', 'xl')};
            z-index: 1000;
            min-width: 300px;
        `;

        quickAccessPanel.innerHTML = `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: ${designSystem.getSpacing(4)};
            ">
                <h4 style="margin: 0;">Quick Access</h4>
                <button class="close-quick-access" style="
                    background: none;
                    border: none;
                    font-size: ${designSystem.getFontSize('lg')};
                    cursor: pointer;
                ">×</button>
            </div>
            <div class="quick-access-formats" style="
                display: flex;
                flex-direction: column;
                gap: ${designSystem.getSpacing(2)};
            ">
                ${sortedFormats.map(format => {
                    const info = this.memoizedFormatInfo(format);
                    return `
                        <button class="quick-format" data-format="${format}" style="
                            display: flex;
                            align-items: center;
                            gap: ${designSystem.getSpacing(3)};
                            padding: ${designSystem.getSpacing(3)};
                            border: 1px solid ${designSystem.getColor('neutral.200')};
                            border-radius: var(--radius-md);
                            background: white;
                            cursor: pointer;
                            transition: all var(--animation-duration-fast) var(--animation-easing-ease);
                        ">
                            <span style="font-size: 1.2rem;">${info.icon}</span>
                            <span style="font-weight: var(--font-weight-medium);">${info.name}</span>
                            <span style="
                                margin-left: auto;
                                background: ${designSystem.getColor('primary.100')};
                                color: ${designSystem.getColor('primary.700')};
                                font-size: ${designSystem.getFontSize('xs')};
                                padding: 2px 6px;
                                border-radius: var(--radius-full);
                            ">${this.state.usageStats.get(format)}</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        document.body.appendChild(quickAccessPanel);

        // Setup event listeners
        quickAccessPanel.querySelector('.close-quick-access').addEventListener('click', () => {
            document.body.removeChild(quickAccessPanel);
        });

        quickAccessPanel.querySelectorAll('.quick-format').forEach(button => {
            button.addEventListener('click', () => {
                this.selectFormat(button.dataset.format);
                document.body.removeChild(quickAccessPanel);
            });
        });

        // Close on outside click
        setTimeout(() => {
            const closeOnOutside = (e) => {
                if (!quickAccessPanel.contains(e.target)) {
                    document.body.removeChild(quickAccessPanel);
                    document.removeEventListener('click', closeOnOutside);
                }
            };
            document.addEventListener('click', closeOnOutside);
        }, 100);
    }

    isSelected(format) {
        return this.state.selectedFormat === format;
    }

    getSelectedFormat() {
        return this.state.selectedFormat;
    }

    setSelectedFormat(format) {
        if (this.options.supportedFormats.includes(format)) {
            this.selectFormat(format);
        }
    }

    destroy() {
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
        }

        this.state.previewCache.clear();
        this.state.usageStats.clear();

        if (this.performance && this.performance.destroy) {
            this.performance.destroy();
        }
    }
}