/**
 * ExportPanel - Main export interface with performance optimization
 * Provides comprehensive export controls with real-time performance monitoring
 */

import { designSystem } from '../../design-system/index.js';
import { usePerformanceMonitoring, useDebounce, useMemoryMonitoring } from '../../hooks/usePerformance.js';
import { performanceMonitor, recordMetric } from '../../../performance/monitor.js';
import { performanceOptimizer, debounce, throttle } from '../../../performance/optimizer.js';

export class ExportPanel {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            enablePreview: true,
            enableBatchExport: true,
            defaultFormat: 'pdf',
            supportedFormats: ['pdf', 'docx', 'latex', 'html'],
            maxFileSize: 50 * 1024 * 1024, // 50MB
            previewDebounce: 500,
            validationDelay: 300,
            trackPerformance: true,
            ...options
        };

        this.state = {
            selectedFormat: this.options.defaultFormat,
            selectedTemplate: 'apa',
            exportSettings: {
                includeReferences: true,
                includeImages: true,
                includeMetadata: true,
                quality: 'high',
                pageSize: 'a4',
                orientation: 'portrait'
            },
            isExporting: false,
            previewVisible: false,
            validationErrors: []
        };

        this.eventListeners = new Map();
        this.previewCache = new Map();
        this.performance = null;

        this.init();
    }

    init() {
        if (this.options.trackPerformance) {
            this.performance = usePerformanceMonitoring('ExportPanel');
            this.memoryMonitor = useMemoryMonitoring('ExportPanel');
        }

        this.render();
        this.setupEventListeners();
        this.setupPerformanceOptimizations();
    }

    render() {
        this.performance?.startMonitoring();

        const panel = this.createPanelStructure();
        this.container.innerHTML = '';
        this.container.appendChild(panel);

        this.performance?.endMonitoring();
        this.performance?.trackInteraction('render');
    }

    createPanelStructure() {
        const panel = designSystem.createElement('div', 'card',
            { padding: 'md', elevation: 'medium' },
            [],
            []
        );
        panel.className += ' export-panel';

        // Header
        const header = this.createHeader();
        panel.appendChild(header);

        // Format Selection
        const formatSection = this.createFormatSection();
        panel.appendChild(formatSection);

        // Template Selection
        const templateSection = this.createTemplateSection();
        panel.appendChild(templateSection);

        // Export Settings
        const settingsSection = this.createSettingsSection();
        panel.appendChild(settingsSection);

        // Action Buttons
        const actionsSection = this.createActionsSection();
        panel.appendChild(actionsSection);

        // Progress indicator (initially hidden)
        const progressSection = this.createProgressSection();
        panel.appendChild(progressSection);

        return panel;
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'export-panel-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${designSystem.getSpacing(6)};
            padding-bottom: ${designSystem.getSpacing(4)};
            border-bottom: 1px solid ${designSystem.getColor('neutral.200')};
        `;

        const title = document.createElement('h2');
        title.textContent = 'Export Document';
        title.style.cssText = `
            margin: 0;
            font-size: ${designSystem.getFontSize('xl')};
            font-weight: var(--font-weight-semibold);
            color: ${designSystem.getColor('neutral.900')};
        `;

        const performanceIndicator = this.createPerformanceIndicator();

        header.appendChild(title);
        header.appendChild(performanceIndicator);

        return header;
    }

    createPerformanceIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'performance-indicator';
        indicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: ${designSystem.getSpacing(2)};
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.600')};
        `;

        const statusDot = document.createElement('div');
        statusDot.className = 'status-dot';
        statusDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${designSystem.getColor('semantic.success')};
        `;

        const statusText = document.createElement('span');
        statusText.textContent = 'Ready';

        indicator.appendChild(statusDot);
        indicator.appendChild(statusText);

        return indicator;
    }

    createFormatSection() {
        const section = document.createElement('div');
        section.className = 'format-section';
        section.style.cssText = `
            margin-bottom: ${designSystem.getSpacing(6)};
        `;

        const label = document.createElement('label');
        label.textContent = 'Export Format';
        label.style.cssText = `
            display: block;
            font-weight: var(--font-weight-medium);
            margin-bottom: ${designSystem.getSpacing(3)};
            color: ${designSystem.getColor('neutral.700')};
        `;

        const formatGrid = document.createElement('div');
        formatGrid.className = 'format-grid';
        formatGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: ${designSystem.getSpacing(3)};
        `;

        this.options.supportedFormats.forEach(format => {
            const formatButton = this.createFormatButton(format);
            formatGrid.appendChild(formatButton);
        });

        section.appendChild(label);
        section.appendChild(formatGrid);

        return section;
    }

    createFormatButton(format) {
        const button = designSystem.createElement('button', 'button',
            {
                size: 'md',
                variant: this.state.selectedFormat === format ? 'primary' : 'secondary'
            },
            []
        );

        const formatInfo = this.getFormatInfo(format);

        button.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <div style="font-size: 18px;">${formatInfo.icon}</div>
                <span style="font-weight: var(--font-weight-medium);">${formatInfo.label}</span>
                <span style="font-size: ${designSystem.getFontSize('xs')}; opacity: 0.7;">${formatInfo.description}</span>
            </div>
        `;

        button.addEventListener('click', () => {
            this.selectFormat(format);
        });

        return button;
    }

    getFormatInfo(format) {
        const formatMap = {
            pdf: { icon: '📄', label: 'PDF', description: 'Portable document' },
            docx: { icon: '📝', label: 'Word', description: 'Microsoft Word' },
            latex: { icon: '📑', label: 'LaTeX', description: 'Academic typesetting' },
            html: { icon: '🌐', label: 'HTML', description: 'Web document' }
        };

        return formatMap[format] || { icon: '📄', label: format.toUpperCase(), description: 'Document' };
    }

    createTemplateSection() {
        const section = document.createElement('div');
        section.className = 'template-section';
        section.style.cssText = `
            margin-bottom: ${designSystem.getSpacing(6)};
        `;

        const label = document.createElement('label');
        label.textContent = 'Citation Style';
        label.style.cssText = `
            display: block;
            font-weight: var(--font-weight-medium);
            margin-bottom: ${designSystem.getSpacing(3)};
            color: ${designSystem.getColor('neutral.700')};
        `;

        const select = this.createTemplateSelect();

        section.appendChild(label);
        section.appendChild(select);

        return section;
    }

    createTemplateSelect() {
        const select = document.createElement('select');
        select.style.cssText = `
            width: 100%;
            padding: ${designSystem.getSpacing(3)} ${designSystem.getSpacing(4)};
            border: 1px solid ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-md);
            font-size: ${designSystem.getFontSize('base')};
            background-color: white;
        `;

        const templates = [
            { value: 'apa', label: 'APA 7th Edition' },
            { value: 'mla', label: 'MLA 9th Edition' },
            { value: 'chicago', label: 'Chicago 17th Edition' },
            { value: 'ieee', label: 'IEEE Style' },
            { value: 'harvard', label: 'Harvard Style' }
        ];

        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.value;
            option.textContent = template.label;
            if (template.value === this.state.selectedTemplate) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            this.state.selectedTemplate = e.target.value;
            this.validateSettings();
        });

        return select;
    }

    createSettingsSection() {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.style.cssText = `
            margin-bottom: ${designSystem.getSpacing(6)};
        `;

        const label = document.createElement('h3');
        label.textContent = 'Export Settings';
        label.style.cssText = `
            margin: 0 0 ${designSystem.getSpacing(4)} 0;
            font-size: ${designSystem.getFontSize('lg')};
            font-weight: var(--font-weight-medium);
            color: ${designSystem.getColor('neutral.700')};
        `;

        const settingsGrid = document.createElement('div');
        settingsGrid.className = 'settings-grid';
        settingsGrid.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${designSystem.getSpacing(4)};
        `;

        // Create setting controls
        settingsGrid.appendChild(this.createCheckboxSetting('includeReferences', 'Include References'));
        settingsGrid.appendChild(this.createCheckboxSetting('includeImages', 'Include Images'));
        settingsGrid.appendChild(this.createCheckboxSetting('includeMetadata', 'Include Metadata'));
        settingsGrid.appendChild(this.createSelectSetting('quality', 'Quality', [
            { value: 'draft', label: 'Draft' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' }
        ]));

        section.appendChild(label);
        section.appendChild(settingsGrid);

        return section;
    }

    createCheckboxSetting(key, label) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: ${designSystem.getSpacing(2)};
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `setting-${key}`;
        checkbox.checked = this.state.exportSettings[key];
        checkbox.addEventListener('change', (e) => {
            this.state.exportSettings[key] = e.target.checked;
            this.validateSettings();
        });

        const labelEl = document.createElement('label');
        labelEl.htmlFor = `setting-${key}`;
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.700')};
        `;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(labelEl);

        return wrapper;
    }

    createSelectSetting(key, label, options) {
        const wrapper = document.createElement('div');

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            display: block;
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.700')};
            margin-bottom: ${designSystem.getSpacing(1)};
        `;

        const select = document.createElement('select');
        select.style.cssText = `
            width: 100%;
            padding: ${designSystem.getSpacing(2)} ${designSystem.getSpacing(3)};
            border: 1px solid ${designSystem.getColor('neutral.300')};
            border-radius: var(--radius-md);
            font-size: ${designSystem.getFontSize('sm')};
            background-color: white;
        `;

        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            if (option.value === this.state.exportSettings[key]) {
                optionEl.selected = true;
            }
            select.appendChild(optionEl);
        });

        select.addEventListener('change', (e) => {
            this.state.exportSettings[key] = e.target.value;
            this.validateSettings();
        });

        wrapper.appendChild(labelEl);
        wrapper.appendChild(select);

        return wrapper;
    }

    createActionsSection() {
        const section = document.createElement('div');
        section.className = 'actions-section';
        section.style.cssText = `
            display: flex;
            gap: ${designSystem.getSpacing(3)};
            align-items: center;
            margin-bottom: ${designSystem.getSpacing(6)};
        `;

        // Preview button
        const previewButton = designSystem.createElement('button', 'button',
            { size: 'md', variant: 'secondary' },
            []
        );
        previewButton.textContent = 'Preview';
        previewButton.addEventListener('click', () => {
            this.showPreview();
        });

        // Export button
        const exportButton = designSystem.createElement('button', 'button',
            { size: 'md', variant: 'primary' },
            []
        );
        exportButton.textContent = 'Export';
        exportButton.addEventListener('click', () => {
            this.startExport();
        });

        // Batch export button (if enabled)
        if (this.options.enableBatchExport) {
            const batchButton = designSystem.createElement('button', 'button',
                { size: 'md', variant: 'ghost' },
                []
            );
            batchButton.textContent = 'Batch Export';
            batchButton.addEventListener('click', () => {
                this.showBatchExport();
            });
            section.appendChild(batchButton);
        }

        section.appendChild(previewButton);
        section.appendChild(exportButton);

        return section;
    }

    createProgressSection() {
        const section = document.createElement('div');
        section.className = 'progress-section';
        section.style.cssText = `
            display: none;
            margin-top: ${designSystem.getSpacing(4)};
            padding: ${designSystem.getSpacing(4)};
            background-color: ${designSystem.getColor('neutral.50')};
            border-radius: var(--radius-md);
        `;

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.cssText = `
            width: 100%;
            height: 8px;
            background-color: ${designSystem.getColor('neutral.200')};
            border-radius: var(--radius-full);
            overflow: hidden;
            margin-bottom: ${designSystem.getSpacing(2)};
        `;

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            background-color: ${designSystem.getColor('primary.500')};
            width: 0%;
            transition: width var(--animation-duration-normal) var(--animation-easing-ease);
        `;

        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = 'Preparing export...';
        progressText.style.cssText = `
            font-size: ${designSystem.getFontSize('sm')};
            color: ${designSystem.getColor('neutral.600')};
        `;

        progressBar.appendChild(progressFill);
        section.appendChild(progressBar);
        section.appendChild(progressText);

        return section;
    }

    setupEventListeners() {
        // Debounced validation
        this.debouncedValidation = debounce(() => {
            this.validateSettings();
        }, this.options.validationDelay);

        // Performance monitoring
        if (this.options.trackPerformance) {
            this.setupPerformanceTracking();
        }
    }

    setupPerformanceOptimizations() {
        // Enable virtual scrolling for large lists
        this.optimizeRenderingPerformance();

        // Setup memory monitoring
        this.memoryCleanupInterval = setInterval(() => {
            this.cleanupMemory();
        }, 30000);
    }

    setupPerformanceTracking() {
        // Track user interactions
        this.container.addEventListener('click', throttle(() => {
            recordMetric('export_panel_interaction', 1, 'interaction');
        }, 1000));

        // Monitor memory usage
        this.memoryMonitor.startMemoryMonitoring(10000); // Every 10 seconds
    }

    optimizeRenderingPerformance() {
        // Use intersection observer for lazy loading of complex elements
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.lazyLoadSection(entry.target);
                    }
                });
            });

            // Observe complex sections
            const sections = this.container.querySelectorAll('.settings-section, .template-section');
            sections.forEach(section => observer.observe(section));
        }
    }

    lazyLoadSection(section) {
        // Add GPU acceleration for smooth animations
        section.style.willChange = 'transform';
        section.classList.add('gpu-accelerated');
    }

    // Event handlers
    selectFormat(format) {
        this.performance?.trackInteraction('format_select');

        this.state.selectedFormat = format;

        // Update UI
        const formatButtons = this.container.querySelectorAll('.format-grid button');
        formatButtons.forEach((button, index) => {
            const isSelected = this.options.supportedFormats[index] === format;
            button.className = button.className.replace(/ds-button-variant-\w+/, `ds-button-variant-${isSelected ? 'primary' : 'secondary'}`);
        });

        this.debouncedValidation();
        this.updatePerformanceIndicator();
    }

    validateSettings() {
        const errors = [];

        // Validate format-specific requirements
        if (this.state.selectedFormat === 'latex' && !this.state.exportSettings.includeReferences) {
            errors.push('LaTeX exports typically require references');
        }

        if (this.state.selectedFormat === 'pdf' && this.state.exportSettings.quality === 'draft') {
            errors.push('PDF exports with draft quality may have layout issues');
        }

        this.state.validationErrors = errors;
        this.updateValidationDisplay();
    }

    updateValidationDisplay() {
        // Remove existing validation messages
        const existingMessages = this.container.querySelectorAll('.validation-message');
        existingMessages.forEach(msg => msg.remove());

        // Add new validation messages
        if (this.state.validationErrors.length > 0) {
            const validationContainer = document.createElement('div');
            validationContainer.className = 'validation-messages';
            validationContainer.style.cssText = `
                margin-top: ${designSystem.getSpacing(4)};
                padding: ${designSystem.getSpacing(3)};
                background-color: ${designSystem.getColor('semantic.warning')};
                border-radius: var(--radius-md);
                color: white;
                font-size: ${designSystem.getFontSize('sm')};
            `;

            this.state.validationErrors.forEach(error => {
                const errorItem = document.createElement('div');
                errorItem.className = 'validation-message';
                errorItem.textContent = `⚠️ ${error}`;
                validationContainer.appendChild(errorItem);
            });

            this.container.querySelector('.actions-section').appendChild(validationContainer);
        }
    }

    updatePerformanceIndicator() {
        const indicator = this.container.querySelector('.performance-indicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('span');

        if (this.state.isExporting) {
            dot.style.backgroundColor = designSystem.getColor('semantic.warning');
            text.textContent = 'Exporting...';
        } else if (this.state.validationErrors.length > 0) {
            dot.style.backgroundColor = designSystem.getColor('semantic.error');
            text.textContent = 'Issues detected';
        } else {
            dot.style.backgroundColor = designSystem.getColor('semantic.success');
            text.textContent = 'Ready';
        }
    }

    async showPreview() {
        this.performance?.trackInteraction('preview');

        const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        previewWindow.document.write('<html><head><title>Export Preview</title></head><body>');
        previewWindow.document.write('<h1>Preview Loading...</h1>');
        previewWindow.document.write('<p>Generating preview for ' + this.state.selectedFormat.toUpperCase() + ' export...</p>');
        previewWindow.document.write('</body></html>');

        // Simulate preview generation
        setTimeout(() => {
            previewWindow.document.body.innerHTML = `
                <h1>Export Preview</h1>
                <p><strong>Format:</strong> ${this.state.selectedFormat.toUpperCase()}</p>
                <p><strong>Template:</strong> ${this.state.selectedTemplate.toUpperCase()}</p>
                <p><strong>Settings:</strong></p>
                <ul>
                    ${Object.entries(this.state.exportSettings)
                        .map(([key, value]) => `<li>${key}: ${value}</li>`)
                        .join('')}
                </ul>
                <p><em>This is a preview. Actual export may differ slightly.</em></p>
            `;
        }, 1500);
    }

    async startExport() {
        this.performance?.trackInteraction('export_start');

        if (this.state.validationErrors.length > 0) {
            alert('Please resolve validation errors before exporting.');
            return;
        }

        this.state.isExporting = true;
        this.updatePerformanceIndicator();

        const progressSection = this.container.querySelector('.progress-section');
        const progressFill = progressSection.querySelector('.progress-fill');
        const progressText = progressSection.querySelector('.progress-text');

        progressSection.style.display = 'block';

        // Simulate export progress
        const steps = [
            'Preparing document...',
            'Processing content...',
            'Formatting citations...',
            'Generating export...',
            'Finalizing...'
        ];

        for (let i = 0; i < steps.length; i++) {
            progressText.textContent = steps[i];
            progressFill.style.width = `${((i + 1) / steps.length) * 100}%`;

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        // Complete export
        this.completeExport();
    }

    completeExport() {
        this.performance?.trackInteraction('export_complete');

        this.state.isExporting = false;
        this.updatePerformanceIndicator();

        const progressSection = this.container.querySelector('.progress-section');
        progressSection.style.display = 'none';

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.style.cssText = `
            margin-top: ${designSystem.getSpacing(4)};
            padding: ${designSystem.getSpacing(3)};
            background-color: ${designSystem.getColor('semantic.success')};
            color: white;
            border-radius: var(--radius-md);
            text-align: center;
        `;
        successMessage.innerHTML = `
            ✅ Export completed successfully!<br>
            <small>Your ${this.state.selectedFormat.toUpperCase()} file is ready for download.</small>
        `;

        this.container.appendChild(successMessage);

        // Auto-remove success message after 5 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 5000);
    }

    showBatchExport() {
        this.performance?.trackInteraction('batch_export');

        // Placeholder for batch export functionality
        alert('Batch export functionality will be implemented by the batch export component.');
    }

    cleanupMemory() {
        // Clear old preview cache entries
        if (this.previewCache.size > 10) {
            const oldestKeys = Array.from(this.previewCache.keys()).slice(0, 5);
            oldestKeys.forEach(key => this.previewCache.delete(key));
        }

        // Force garbage collection hint
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
    }

    destroy() {
        // Clear intervals
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
        }

        // Clear event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();

        // Clear caches
        this.previewCache.clear();

        // Performance cleanup
        if (this.performance && this.performance.destroy) {
            this.performance.destroy();
        }
    }
}