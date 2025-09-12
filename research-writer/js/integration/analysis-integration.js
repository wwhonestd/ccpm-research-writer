/**
 * Analysis Integration - Initializes Stream C analysis components
 * Integrates gap analysis and connection mapping with the main application
 */

import { GapAnalysis } from '../components/research/GapAnalysis.js';
import { ConnectionMap } from '../components/research/ConnectionMap.js';

export class AnalysisIntegration {
    constructor() {
        this.gapAnalysis = null;
        this.connectionMap = null;
        this.currentProject = null;
        this.initialized = false;
        
        this.init();
    }

    async init() {
        try {
            this.bindEvents();
            this.initializeTabSwitching();
            console.log('Analysis integration initialized');
            this.initialized = true;
        } catch (error) {
            console.error('Analysis integration initialization failed:', error);
        }
    }

    bindEvents() {
        // Listen for analysis tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('analysis-tab-btn')) {
                this.handleAnalysisTabSwitch(e.target.dataset.analysis);
            }
        });

        // Listen for project changes
        document.addEventListener('project-changed', (e) => {
            this.currentProject = e.detail.projectId;
            this.refreshAnalysis();
        });

        // Listen for data updates
        document.addEventListener('notes-updated', () => {
            this.refreshAnalysis();
        });

        document.addEventListener('citations-updated', () => {
            this.refreshAnalysis();
        });
    }

    initializeTabSwitching() {
        const tabs = document.querySelectorAll('.analysis-tab-btn');
        const panels = document.querySelectorAll('.analysis-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update tab states
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                const targetPanel = document.getElementById(`${tab.dataset.analysis}-analysis`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    async handleAnalysisTabSwitch(analysisType) {
        try {
            switch (analysisType) {
                case 'gaps':
                    await this.initializeGapAnalysis();
                    break;
                case 'connections':
                    await this.initializeConnectionMap();
                    break;
                case 'overview':
                    // Overview is handled by existing code
                    break;
                default:
                    console.warn(`Unknown analysis type: ${analysisType}`);
            }
        } catch (error) {
            console.error(`Failed to switch to ${analysisType} analysis:`, error);
            this.showError(`Failed to load ${analysisType} analysis`);
        }
    }

    async initializeGapAnalysis() {
        if (this.gapAnalysis) {
            await this.gapAnalysis.refresh();
            return;
        }

        const container = document.getElementById('gap-analysis-container');
        if (!container) {
            console.error('Gap analysis container not found');
            return;
        }

        try {
            this.gapAnalysis = new GapAnalysis(container, {
                projectId: this.currentProject,
                autoRefresh: true,
                refreshInterval: 60000, // 1 minute
                showInsights: true,
                maxGapsPerType: 10
            });

            console.log('Gap analysis component initialized');
        } catch (error) {
            console.error('Failed to initialize gap analysis:', error);
            this.showError('Failed to initialize gap analysis component');
        }
    }

    async initializeConnectionMap() {
        if (this.connectionMap) {
            await this.connectionMap.refresh();
            return;
        }

        const container = document.getElementById('connection-map-container');
        if (!container) {
            console.error('Connection map container not found');
            return;
        }

        try {
            this.connectionMap = new ConnectionMap(container, {
                projectId: this.currentProject,
                width: container.clientWidth || 800,
                height: 600,
                autoResize: true,
                showLabels: true,
                enableZoom: true,
                enableDrag: true,
                layout: 'force',
                clustering: {
                    enabled: true,
                    minClusterSize: 3
                }
            });

            console.log('Connection map component initialized');
        } catch (error) {
            console.error('Failed to initialize connection map:', error);
            this.showError('Failed to initialize connection map component');
        }
    }

    async refreshAnalysis() {
        if (!this.initialized) return;

        try {
            // Refresh active components
            if (this.gapAnalysis) {
                await this.gapAnalysis.refresh();
            }

            if (this.connectionMap) {
                await this.connectionMap.refresh();
            }

            console.log('Analysis components refreshed');
        } catch (error) {
            console.error('Failed to refresh analysis components:', error);
        }
    }

    setProjectId(projectId) {
        this.currentProject = projectId;
        
        if (this.gapAnalysis) {
            this.gapAnalysis.setProjectId(projectId);
        }
        
        if (this.connectionMap) {
            this.connectionMap.setProjectId(projectId);
        }
    }

    showError(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'analysis-error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${message}</span>
                <button class="error-dismiss" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to page
        const container = document.querySelector('.analytics-container');
        if (container) {
            container.insertBefore(notification, container.firstChild);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    // Public API methods
    getGapAnalysisData() {
        return this.gapAnalysis?.getAnalysisData() || null;
    }

    getConnectionMapData() {
        return this.connectionMap?.getNetworkData() || null;
    }

    exportAnalysis() {
        const data = {
            timestamp: new Date().toISOString(),
            projectId: this.currentProject,
            gapAnalysis: this.getGapAnalysisData(),
            connectionMap: this.getConnectionMapData()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `research-analysis-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    destroy() {
        if (this.gapAnalysis) {
            this.gapAnalysis.destroy();
        }
        
        if (this.connectionMap) {
            this.connectionMap.destroy();
        }
        
        this.initialized = false;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.analysisIntegration = new AnalysisIntegration();
    });
} else {
    window.analysisIntegration = new AnalysisIntegration();
}