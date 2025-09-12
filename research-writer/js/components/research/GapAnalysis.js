/**
 * GapAnalysis Component - UI for research gap identification and visualization
 * Integrates with AnalysisEngine for gap analysis data
 */

import { AnalysisEngine } from '../../modules/research/AnalysisEngine.js';

export class GapAnalysis {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('Container element not found');
        }

        this.analysisEngine = new AnalysisEngine();
        this.options = {
            projectId: null,
            autoRefresh: true,
            refreshInterval: 30000, // 30 seconds
            showInsights: true,
            maxGapsPerType: 5,
            chartColors: {
                temporal: '#2196F3',
                topical: '#4CAF50',
                methodological: '#FF9800',
                geographical: '#9C27B0',
                theoretical: '#F44336',
                empirical: '#607D8B'
            },
            ...options
        };

        this.state = {
            loading: false,
            data: null,
            error: null,
            selectedGapType: null,
            expandedCards: new Set(),
            filters: {
                minSeverity: 0.3,
                confidenceThreshold: 0.5,
                showRecommendations: true
            }
        };

        this.charts = new Map();
        this.refreshTimer = null;
        
        this.init();
    }

    async init() {
        try {
            this.render();
            await this.loadData();
            
            if (this.options.autoRefresh) {
                this.startAutoRefresh();
            }
        } catch (error) {
            console.error('GapAnalysis initialization failed:', error);
            this.handleError(error);
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="gap-analysis">
                <div class="gap-analysis__header">
                    <h2>Research Gap Analysis</h2>
                    <div class="gap-analysis__controls">
                        <div class="filter-controls">
                            <label class="filter-label">
                                Min Severity:
                                <input type="range" 
                                       class="severity-filter" 
                                       min="0" 
                                       max="1" 
                                       step="0.1" 
                                       value="${this.state.filters.minSeverity}">
                                <span class="severity-value">${(this.state.filters.minSeverity * 100).toFixed(0)}%</span>
                            </label>
                            <label class="filter-label">
                                <input type="checkbox" 
                                       class="recommendations-toggle"
                                       ${this.state.filters.showRecommendations ? 'checked' : ''}>
                                Show Recommendations
                            </label>
                        </div>
                        <div class="action-controls">
                            <button class="btn btn--primary refresh-btn">
                                <span class="icon">🔄</span>
                                Refresh Analysis
                            </button>
                            <button class="btn btn--secondary export-btn">
                                <span class="icon">📊</span>
                                Export Report
                            </button>
                        </div>
                    </div>
                </div>

                <div class="gap-analysis__content">
                    <div class="loading-overlay" style="display: none;">
                        <div class="loading-spinner"></div>
                        <p>Analyzing research gaps...</p>
                    </div>

                    <div class="error-message" style="display: none;"></div>

                    <div class="gap-analysis__summary">
                        <div class="summary-cards">
                            <div class="summary-card summary-card--total">
                                <div class="summary-card__icon">🔍</div>
                                <div class="summary-card__content">
                                    <h3>Total Gaps</h3>
                                    <div class="summary-card__value" data-metric="totalGaps">0</div>
                                    <div class="summary-card__subtitle">Identified Issues</div>
                                </div>
                            </div>
                            <div class="summary-card summary-card--severity">
                                <div class="summary-card__icon">⚠️</div>
                                <div class="summary-card__content">
                                    <h3>Severity</h3>
                                    <div class="summary-card__value" data-metric="overallSeverity">-</div>
                                    <div class="summary-card__subtitle">Average Level</div>
                                </div>
                            </div>
                            <div class="summary-card summary-card--confidence">
                                <div class="summary-card__icon">📊</div>
                                <div class="summary-card__content">
                                    <h3>Confidence</h3>
                                    <div class="summary-card__value" data-metric="confidence">0%</div>
                                    <div class="summary-card__subtitle">Analysis Quality</div>
                                </div>
                            </div>
                            <div class="summary-card summary-card--recommendations">
                                <div class="summary-card__icon">💡</div>
                                <div class="summary-card__content">
                                    <h3>Recommendations</h3>
                                    <div class="summary-card__value" data-metric="recommendations">0</div>
                                    <div class="summary-card__subtitle">Action Items</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="gap-analysis__tabs">
                        <div class="tab-navigation">
                            <button class="tab-btn tab-btn--active" data-tab="overview">Overview</button>
                            <button class="tab-btn" data-tab="temporal">Temporal</button>
                            <button class="tab-btn" data-tab="topical">Topical</button>
                            <button class="tab-btn" data-tab="methodological">Methodological</button>
                            <button class="tab-btn" data-tab="geographical">Geographical</button>
                            <button class="tab-btn" data-tab="theoretical">Theoretical</button>
                            <button class="tab-btn" data-tab="empirical">Empirical</button>
                        </div>

                        <div class="tab-content">
                            <div class="tab-panel tab-panel--active" data-panel="overview">
                                <div class="overview-content">
                                    <div class="gap-distribution-chart">
                                        <h3>Gap Distribution by Type</h3>
                                        <div class="chart-container" id="gapDistributionChart"></div>
                                    </div>
                                    <div class="severity-breakdown">
                                        <h3>Severity Breakdown</h3>
                                        <div class="severity-bars"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="temporal">
                                <div class="gap-type-content">
                                    <h3>Temporal Research Gaps</h3>
                                    <p class="gap-type-description">
                                        Identifies periods with insufficient research coverage
                                    </p>
                                    <div class="gap-list" data-gap-type="temporal"></div>
                                    <div class="gap-chart" id="temporalChart"></div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="topical">
                                <div class="gap-type-content">
                                    <h3>Topical Research Gaps</h3>
                                    <p class="gap-type-description">
                                        Underrepresented topics and research areas
                                    </p>
                                    <div class="gap-list" data-gap-type="topical"></div>
                                    <div class="gap-chart" id="topicalChart"></div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="methodological">
                                <div class="gap-type-content">
                                    <h3>Methodological Gaps</h3>
                                    <p class="gap-type-description">
                                        Underutilized research methodologies and approaches
                                    </p>
                                    <div class="gap-list" data-gap-type="methodological"></div>
                                    <div class="gap-chart" id="methodologicalChart"></div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="geographical">
                                <div class="gap-type-content">
                                    <h3>Geographical Gaps</h3>
                                    <p class="gap-type-description">
                                        Limited geographical coverage in research
                                    </p>
                                    <div class="gap-list" data-gap-type="geographical"></div>
                                    <div class="gap-chart" id="geographicalChart"></div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="theoretical">
                                <div class="gap-type-content">
                                    <h3>Theoretical Gaps</h3>
                                    <p class="gap-type-description">
                                        Underexplored theoretical concepts and frameworks
                                    </p>
                                    <div class="gap-list" data-gap-type="theoretical"></div>
                                    <div class="gap-chart" id="theoreticalChart"></div>
                                </div>
                            </div>

                            <div class="tab-panel" data-panel="empirical">
                                <div class="gap-type-content">
                                    <h3>Empirical Gaps</h3>
                                    <p class="gap-type-description">
                                        Theoretical claims lacking empirical support
                                    </p>
                                    <div class="gap-list" data-gap-type="empirical"></div>
                                    <div class="gap-chart" id="empiricalChart"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="recommendations-section" style="display: none;">
                        <h3>Research Recommendations</h3>
                        <div class="recommendations-list"></div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const container = this.container;

        // Tab navigation
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // Filter controls
        const severityFilter = container.querySelector('.severity-filter');
        if (severityFilter) {
            severityFilter.addEventListener('input', (e) => {
                this.state.filters.minSeverity = parseFloat(e.target.value);
                container.querySelector('.severity-value').textContent = 
                    `${(this.state.filters.minSeverity * 100).toFixed(0)}%`;
                this.applyFilters();
            });
        }

        const recommendationsToggle = container.querySelector('.recommendations-toggle');
        if (recommendationsToggle) {
            recommendationsToggle.addEventListener('change', (e) => {
                this.state.filters.showRecommendations = e.target.checked;
                this.toggleRecommendations();
            });
        }

        // Action buttons
        const refreshBtn = container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        const exportBtn = container.querySelector('.export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }

        // Gap card interactions
        container.addEventListener('click', (e) => {
            if (e.target.closest('.gap-card__header')) {
                const card = e.target.closest('.gap-card');
                if (card) {
                    this.toggleGapCard(card);
                }
            }
        });
    }

    async loadData() {
        try {
            this.setState({ loading: true, error: null });
            
            const data = await this.analysisEngine.analyzeResearchGaps(
                this.options.projectId,
                {
                    timeframeMonths: 24,
                    includeConfidence: true
                }
            );

            this.setState({ data, loading: false });
            this.updateDisplay();
            
        } catch (error) {
            console.error('Failed to load gap analysis data:', error);
            this.setState({ loading: false, error });
            this.handleError(error);
        }
    }

    setState(newState) {
        Object.assign(this.state, newState);
        
        if (newState.loading !== undefined) {
            this.toggleLoading(newState.loading);
        }
    }

    toggleLoading(show) {
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    handleError(error) {
        const errorElement = this.container.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = `Error: ${error.message}`;
            errorElement.style.display = 'block';
        }
    }

    updateDisplay() {
        if (!this.state.data) return;

        this.updateSummaryCards();
        this.updateOverviewCharts();
        this.updateGapTypeContent();
        
        if (this.state.filters.showRecommendations) {
            this.updateRecommendations();
        }
    }

    updateSummaryCards() {
        const { data } = this.state;
        const container = this.container;

        // Update metrics
        const totalGapsEl = container.querySelector('[data-metric="totalGaps"]');
        if (totalGapsEl) {
            totalGapsEl.textContent = data.summary.totalGaps;
        }

        const severityEl = container.querySelector('[data-metric="overallSeverity"]');
        if (severityEl) {
            severityEl.textContent = data.summary.overallSeverity.toUpperCase();
        }

        const confidenceEl = container.querySelector('[data-metric="confidence"]');
        if (confidenceEl) {
            confidenceEl.textContent = `${(data.metadata.confidence * 100).toFixed(0)}%`;
        }

        const recommendationsEl = container.querySelector('[data-metric="recommendations"]');
        if (recommendationsEl) {
            recommendationsEl.textContent = data.recommendations.length;
        }
    }

    updateOverviewCharts() {
        const { data } = this.state;
        
        // Gap distribution pie chart
        this.renderGapDistributionChart(data);
        
        // Severity breakdown bars
        this.renderSeverityBreakdown(data);
    }

    renderGapDistributionChart(data) {
        const chartContainer = this.container.querySelector('#gapDistributionChart');
        if (!chartContainer) return;

        const gapCounts = Object.entries(data.gaps).map(([type, gapData]) => ({
            type: type.charAt(0).toUpperCase() + type.slice(1),
            count: gapData.gaps ? gapData.gaps.length : 0,
            color: this.options.chartColors[type] || '#666'
        })).filter(item => item.count > 0);

        if (gapCounts.length === 0) {
            chartContainer.innerHTML = '<p class="no-data">No gaps identified</p>';
            return;
        }

        // Create simple donut chart using CSS
        const total = gapCounts.reduce((sum, item) => sum + item.count, 0);
        let cumulativePercentage = 0;

        chartContainer.innerHTML = `
            <div class="donut-chart">
                <div class="donut-segments">
                    ${gapCounts.map(item => {
                        const percentage = (item.count / total) * 100;
                        const startAngle = (cumulativePercentage / 100) * 360;
                        const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                        cumulativePercentage += percentage;
                        
                        return `
                            <div class="donut-segment" 
                                 style="--start-angle: ${startAngle}deg; --end-angle: ${endAngle}deg; --color: ${item.color};"
                                 title="${item.type}: ${item.count} gaps (${percentage.toFixed(1)}%)">
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="donut-center">
                    <div class="donut-total">${total}</div>
                    <div class="donut-label">Total Gaps</div>
                </div>
            </div>
            <div class="chart-legend">
                ${gapCounts.map(item => `
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: ${item.color}"></div>
                        <span class="legend-label">${item.type}</span>
                        <span class="legend-value">${item.count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSeverityBreakdown(data) {
        const container = this.container.querySelector('.severity-bars');
        if (!container) return;

        const severityLevels = { high: 0, medium: 0, low: 0 };

        // Categorize gaps by severity
        Object.values(data.gaps).forEach(gapData => {
            if (gapData.gaps) {
                gapData.gaps.forEach(gap => {
                    const severity = gap.gapSeverity || 0;
                    if (severity > 0.7) severityLevels.high++;
                    else if (severity > 0.4) severityLevels.medium++;
                    else severityLevels.low++;
                });
            }
        });

        const total = Object.values(severityLevels).reduce((sum, count) => sum + count, 0);
        
        if (total === 0) {
            container.innerHTML = '<p class="no-data">No severity data available</p>';
            return;
        }

        container.innerHTML = Object.entries(severityLevels).map(([level, count]) => {
            const percentage = (count / total) * 100;
            const color = {
                high: '#f44336',
                medium: '#ff9800',
                low: '#4caf50'
            }[level];

            return `
                <div class="severity-bar">
                    <div class="severity-label">
                        <span class="severity-level">${level.toUpperCase()}</span>
                        <span class="severity-count">${count}</span>
                    </div>
                    <div class="severity-progress">
                        <div class="severity-fill" 
                             style="width: ${percentage}%; background-color: ${color};">
                        </div>
                    </div>
                    <span class="severity-percentage">${percentage.toFixed(1)}%</span>
                </div>
            `;
        }).join('');
    }

    updateGapTypeContent() {
        const { data } = this.state;
        
        Object.entries(data.gaps).forEach(([type, gapData]) => {
            const container = this.container.querySelector(`[data-gap-type="${type}"]`);
            if (container && gapData.gaps) {
                this.renderGapList(container, gapData.gaps, type);
            }
        });
    }

    renderGapList(container, gaps, type) {
        if (!gaps || gaps.length === 0) {
            container.innerHTML = '<p class="no-gaps">No gaps identified in this category</p>';
            return;
        }

        const filteredGaps = gaps.filter(gap => 
            (gap.gapSeverity || 0) >= this.state.filters.minSeverity
        ).slice(0, this.options.maxGapsPerType);

        if (filteredGaps.length === 0) {
            container.innerHTML = '<p class="no-gaps">No gaps meet the current filter criteria</p>';
            return;
        }

        container.innerHTML = filteredGaps.map((gap, index) => {
            const severity = gap.gapSeverity || 0;
            const severityClass = severity > 0.7 ? 'high' : severity > 0.4 ? 'medium' : 'low';
            const isExpanded = this.state.expandedCards.has(`${type}-${index}`);

            return `
                <div class="gap-card gap-card--${severityClass}" data-gap-id="${type}-${index}">
                    <div class="gap-card__header">
                        <div class="gap-card__title">
                            <h4>${gap.description || gap.topic || gap.methodology || gap.concept || 'Research Gap'}</h4>
                            <div class="gap-card__severity">
                                <span class="severity-badge severity-badge--${severityClass}">
                                    ${severityClass.toUpperCase()}
                                </span>
                                <span class="severity-score">${(severity * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <button class="gap-card__toggle" aria-expanded="${isExpanded}">
                            <span class="icon">${isExpanded ? '▼' : '▶'}</span>
                        </button>
                    </div>
                    
                    <div class="gap-card__content" style="display: ${isExpanded ? 'block' : 'none'};">
                        ${this.renderGapDetails(gap, type)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderGapDetails(gap, type) {
        const details = [];

        // Type-specific details
        switch (type) {
            case 'temporal':
                details.push(`<strong>Year:</strong> ${gap.year}`);
                details.push(`<strong>Current Coverage:</strong> ${gap.count} publications`);
                details.push(`<strong>Expected:</strong> ${gap.expectedCount} publications`);
                break;
            
            case 'topical':
                details.push(`<strong>Topic:</strong> ${gap.topic}`);
                details.push(`<strong>Current Coverage:</strong> ${gap.currentCoverage} mentions`);
                details.push(`<strong>Citations:</strong> ${gap.citationCount}, <strong>Notes:</strong> ${gap.noteCount}`);
                break;
            
            case 'methodological':
                details.push(`<strong>Methodology:</strong> ${gap.methodology}`);
                details.push(`<strong>Current Use:</strong> ${gap.currentUse} times`);
                details.push(`<strong>Expected Use:</strong> ${gap.expectedUse} times`);
                break;
            
            case 'geographical':
                details.push(`<strong>Region:</strong> ${gap.region}`);
                details.push(`<strong>Current Coverage:</strong> ${gap.currentCoverage} studies`);
                break;
            
            case 'theoretical':
                details.push(`<strong>Concept:</strong> ${gap.concept}`);
                details.push(`<strong>Current Use:</strong> ${gap.currentUse} references`);
                break;
            
            case 'empirical':
                details.push(`<strong>Claim:</strong> ${gap.claim}`);
                details.push(`<strong>Supporting Evidence:</strong> ${gap.supportingEvidence} studies`);
                details.push(`<strong>Keywords:</strong> ${gap.keywords?.join(', ') || 'None'}`);
                break;
        }

        return `
            <div class="gap-details">
                ${details.map(detail => `<p>${detail}</p>`).join('')}
                <div class="gap-actions">
                    <button class="btn btn--small btn--outline" onclick="navigator.clipboard.writeText('${gap.description || gap.topic}')">
                        Copy Description
                    </button>
                </div>
            </div>
        `;
    }

    updateRecommendations() {
        const { data } = this.state;
        const section = this.container.querySelector('.recommendations-section');
        const list = this.container.querySelector('.recommendations-list');
        
        if (!section || !list) return;

        if (data.recommendations.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        list.innerHTML = data.recommendations.slice(0, 10).map((rec, index) => `
            <div class="recommendation-card recommendation-card--${rec.priority}">
                <div class="recommendation-header">
                    <span class="recommendation-priority">${rec.priority.toUpperCase()}</span>
                    <span class="recommendation-type">${rec.type}</span>
                    <span class="recommendation-confidence">${(rec.confidence * 100).toFixed(0)}%</span>
                </div>
                <div class="recommendation-content">
                    <h4>${rec.gap}</h4>
                    <p>${rec.action}</p>
                </div>
            </div>
        `).join('');
    }

    switchTab(tabName) {
        // Update tab buttons
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('tab-btn--active', btn.dataset.tab === tabName);
        });

        // Update tab panels
        this.container.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('tab-panel--active', panel.dataset.panel === tabName);
        });

        this.state.selectedGapType = tabName;
    }

    toggleGapCard(card) {
        const gapId = card.dataset.gapId;
        const content = card.querySelector('.gap-card__content');
        const toggle = card.querySelector('.gap-card__toggle');
        
        if (this.state.expandedCards.has(gapId)) {
            this.state.expandedCards.delete(gapId);
            content.style.display = 'none';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.querySelector('.icon').textContent = '▶';
        } else {
            this.state.expandedCards.add(gapId);
            content.style.display = 'block';
            toggle.setAttribute('aria-expanded', 'true');
            toggle.querySelector('.icon').textContent = '▼';
        }
    }

    toggleRecommendations() {
        const section = this.container.querySelector('.recommendations-section');
        if (section) {
            section.style.display = this.state.filters.showRecommendations ? 'block' : 'none';
        }
    }

    applyFilters() {
        if (this.state.data) {
            this.updateGapTypeContent();
        }
    }

    async exportReport() {
        try {
            if (!this.state.data) {
                alert('No data available to export');
                return;
            }

            const report = {
                title: 'Research Gap Analysis Report',
                generated: new Date().toISOString(),
                projectId: this.options.projectId,
                summary: this.state.data.summary,
                gaps: this.state.data.gaps,
                recommendations: this.state.data.recommendations,
                metadata: this.state.data.metadata
            };

            const blob = new Blob([JSON.stringify(report, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `research-gap-analysis-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export report');
        }
    }

    startAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        this.refreshTimer = setInterval(() => {
            if (!this.state.loading) {
                this.loadData();
            }
        }, this.options.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
        this.charts.forEach(chart => {
            if (chart.destroy) {
                chart.destroy();
            }
        });
        this.charts.clear();
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    // Public API methods
    refresh() {
        return this.loadData();
    }

    setProjectId(projectId) {
        this.options.projectId = projectId;
        return this.loadData();
    }

    getAnalysisData() {
        return this.state.data;
    }

    updateOptions(newOptions) {
        Object.assign(this.options, newOptions);
        
        if (newOptions.autoRefresh !== undefined) {
            if (newOptions.autoRefresh) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        }
        
        return this.loadData();
    }
}