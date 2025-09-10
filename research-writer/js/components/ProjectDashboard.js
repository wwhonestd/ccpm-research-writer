/**
 * ProjectDashboard - Progress tracking and statistics for projects
 * Displays project analytics, charts, and progress indicators
 */

export class ProjectDashboard {
    constructor(container, projectManager, options = {}) {
        this.container = container;
        this.projectManager = projectManager;
        this.options = {
            showOverview: true,
            showCharts: true,
            showRecentProjects: true,
            showQuickActions: true,
            recentProjectsLimit: 5,
            refreshInterval: 30000, // 30 seconds
            ...options
        };

        this.stats = null;
        this.projects = [];
        this.refreshTimer = null;

        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.render();
            this.setupEventListeners();
            
            if (this.options.refreshInterval > 0) {
                this.startAutoRefresh();
            }
        } catch (error) {
            console.error('Error initializing ProjectDashboard:', error);
            this.renderError(error.message);
        }
    }

    async loadData() {
        try {
            this.stats = this.projectManager.getStatistics();
            this.projects = this.projectManager.getProjects({
                sortBy: 'updated',
                sortOrder: 'desc',
                limit: this.options.recentProjectsLimit
            });
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="dashboard-container">
                <!-- Dashboard Header -->
                <div class="dashboard-header">
                    <h2 class="dashboard-title">Project Dashboard</h2>
                    <div class="dashboard-actions">
                        <button class="btn btn-primary new-project-btn">
                            <span aria-hidden="true">➕</span> New Project
                        </button>
                        <button class="btn btn-secondary refresh-btn" title="Refresh dashboard">
                            <span aria-hidden="true">🔄</span> Refresh
                        </button>
                    </div>
                </div>

                ${this.options.showOverview ? this.renderOverview() : ''}
                
                <div class="dashboard-content">
                    ${this.options.showCharts ? this.renderCharts() : ''}
                    ${this.options.showRecentProjects ? this.renderRecentProjects() : ''}
                </div>

                ${this.options.showQuickActions ? this.renderQuickActions() : ''}
            </div>
        `;

        // Initialize charts after DOM is rendered
        setTimeout(() => this.initializeCharts(), 100);
    }

    renderOverview() {
        return `
            <div class="dashboard-overview">
                <div class="overview-cards">
                    <div class="overview-card total-projects">
                        <div class="card-icon" aria-hidden="true">📚</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.total}</div>
                            <div class="card-label">Total Projects</div>
                        </div>
                    </div>

                    <div class="overview-card active-projects">
                        <div class="card-icon" aria-hidden="true">🚀</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.byStatus.active || 0}</div>
                            <div class="card-label">Active Projects</div>
                        </div>
                    </div>

                    <div class="overview-card completed-projects">
                        <div class="card-icon" aria-hidden="true">✅</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.byStatus.completed || 0}</div>
                            <div class="card-label">Completed Projects</div>
                        </div>
                    </div>

                    <div class="overview-card avg-completion">
                        <div class="card-icon" aria-hidden="true">📊</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.averageCompletion}%</div>
                            <div class="card-label">Avg. Completion</div>
                        </div>
                    </div>

                    <div class="overview-card total-citations">
                        <div class="card-icon" aria-hidden="true">📖</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.totalCitations}</div>
                            <div class="card-label">Total Citations</div>
                        </div>
                    </div>

                    <div class="overview-card urgent-projects">
                        <div class="card-icon" aria-hidden="true">⚠️</div>
                        <div class="card-content">
                            <div class="card-value">${this.stats.byPriority.urgent || 0}</div>
                            <div class="card-label">Urgent Projects</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCharts() {
        return `
            <div class="dashboard-charts">
                <div class="chart-section">
                    <h3>Project Status Distribution</h3>
                    <div class="chart-container">
                        <canvas id="status-chart" class="status-chart" width="300" height="200"></canvas>
                        <div class="chart-legend status-legend">
                            <div class="legend-item">
                                <span class="legend-color status-planning"></span>
                                <span class="legend-label">Planning (${this.stats.byStatus.planning || 0})</span>
                            </div>
                            <div class="legend-item">
                                <span class="legend-color status-active"></span>
                                <span class="legend-label">Active (${this.stats.byStatus.active || 0})</span>
                            </div>
                            <div class="legend-item">
                                <span class="legend-color status-completed"></span>
                                <span class="legend-label">Completed (${this.stats.byStatus.completed || 0})</span>
                            </div>
                            <div class="legend-item">
                                <span class="legend-color status-archived"></span>
                                <span class="legend-label">Archived (${this.stats.byStatus.archived || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="chart-section">
                    <h3>Priority Distribution</h3>
                    <div class="chart-container">
                        <div class="priority-chart">
                            ${this.renderPriorityBars()}
                        </div>
                    </div>
                </div>

                <div class="chart-section">
                    <h3>Project Activity</h3>
                    <div class="chart-container">
                        <div class="activity-chart">
                            ${this.renderActivityChart()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPriorityBars() {
        const priorities = ['urgent', 'high', 'medium', 'low'];
        const maxCount = Math.max(...priorities.map(p => this.stats.byPriority[p] || 0));
        
        return priorities.map(priority => {
            const count = this.stats.byPriority[priority] || 0;
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            
            return `
                <div class="priority-bar-item">
                    <div class="priority-label">${this.formatPriority(priority)}</div>
                    <div class="priority-bar">
                        <div class="priority-fill priority-${priority}" style="width: ${percentage}%"></div>
                    </div>
                    <div class="priority-count">${count}</div>
                </div>
            `;
        }).join('');
    }

    renderActivityChart() {
        const recentDays = this.getRecentActivityData();
        
        return `
            <div class="activity-timeline">
                ${recentDays.map(day => `
                    <div class="activity-day">
                        <div class="day-label">${day.label}</div>
                        <div class="day-activity">
                            <div class="activity-bar" style="height: ${day.activity * 100}%"></div>
                        </div>
                        <div class="day-count">${day.count}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderRecentProjects() {
        return `
            <div class="recent-projects-section">
                <div class="section-header">
                    <h3>Recent Projects</h3>
                    <a href="#organize" class="view-all-link">View All Projects →</a>
                </div>
                
                <div class="recent-projects-list">
                    ${this.projects.length > 0 ? this.projects.map(project => this.renderRecentProjectCard(project)).join('') : `
                        <div class="empty-recent">
                            <p>No projects yet. <a href="#" class="new-project-link">Create your first project</a></p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderRecentProjectCard(project) {
        const stats = project.getStats();
        const updatedDate = new Date(project.updated).toLocaleDateString();
        const template = project.templateId ? this.projectManager.getTemplate(project.templateId) : null;

        return `
            <div class="recent-project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-info">
                        <h4 class="project-title">${this.escapeHtml(project.title)}</h4>
                        ${template ? `<span class="template-badge">${template.icon}</span>` : ''}
                    </div>
                    <div class="project-meta">
                        <span class="status-badge status-${project.status}">${this.formatStatus(project.status)}</span>
                        <span class="updated-date">${updatedDate}</span>
                    </div>
                </div>
                
                <div class="project-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.completionScore}%"></div>
                    </div>
                    <span class="progress-text">${stats.completionScore}% complete</span>
                </div>

                <div class="project-quick-stats">
                    <span class="quick-stat">📚 ${stats.totalCitations}</span>
                    <span class="quick-stat">📝 ${stats.totalNotes}</span>
                    <span class="quick-stat">📄 ${stats.totalDrafts}</span>
                </div>

                <div class="project-actions">
                    <button class="btn-link open-project-btn">Open</button>
                    <button class="btn-link edit-project-btn">Edit</button>
                </div>
            </div>
        `;
    }

    renderQuickActions() {
        const templates = this.projectManager.getTemplates();
        const popularTemplates = Object.entries(templates)
            .slice(0, 4)
            .map(([id, template]) => ({ id, ...template }));

        return `
            <div class="quick-actions-section">
                <h3>Quick Actions</h3>
                
                <div class="quick-actions-grid">
                    <div class="quick-action-card">
                        <div class="action-icon" aria-hidden="true">➕</div>
                        <h4>New Project</h4>
                        <p>Start a new research project</p>
                        <button class="btn btn-primary new-project-btn">Create</button>
                    </div>

                    <div class="quick-action-card">
                        <div class="action-icon" aria-hidden="true">📁</div>
                        <h4>Import Projects</h4>
                        <p>Import existing project data</p>
                        <button class="btn btn-secondary import-projects-btn">Import</button>
                    </div>

                    <div class="quick-action-card">
                        <div class="action-icon" aria-hidden="true">📊</div>
                        <h4>Export Data</h4>
                        <p>Export all project data</p>
                        <button class="btn btn-secondary export-projects-btn">Export</button>
                    </div>

                    <div class="quick-action-card">
                        <div class="action-icon" aria-hidden="true">🗂️</div>
                        <h4>Organize</h4>
                        <p>Manage and organize projects</p>
                        <button class="btn btn-secondary organize-projects-btn">Organize</button>
                    </div>
                </div>

                <div class="template-shortcuts">
                    <h4>Popular Templates</h4>
                    <div class="template-buttons">
                        ${popularTemplates.map(template => `
                            <button class="template-btn" data-template-id="${template.id}">
                                <span class="template-icon">${template.icon}</span>
                                <span class="template-name">${template.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderError(message) {
        this.container.innerHTML = `
            <div class="dashboard-container">
                <div class="dashboard-error">
                    <h3>Error Loading Dashboard</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary refresh-btn">
                        Retry
                    </button>
                </div>
            </div>
        `;
    }

    initializeCharts() {
        // Initialize status pie chart
        this.initializeStatusChart();
    }

    initializeStatusChart() {
        const canvas = this.container.querySelector('#status-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const statusData = [
            { label: 'Planning', value: this.stats.byStatus.planning || 0, color: '#fbbf24' },
            { label: 'Active', value: this.stats.byStatus.active || 0, color: '#10b981' },
            { label: 'Completed', value: this.stats.byStatus.completed || 0, color: '#3b82f6' },
            { label: 'Archived', value: this.stats.byStatus.archived || 0, color: '#6b7280' }
        ];

        const total = statusData.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) {
            // Draw empty state
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath();
            ctx.arc(150, 100, 80, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#6b7280';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No projects yet', 150, 105);
            return;
        }

        // Draw pie chart
        let currentAngle = -Math.PI / 2; // Start at top
        const centerX = 150;
        const centerY = 100;
        const radius = 80;

        statusData.forEach(item => {
            if (item.value > 0) {
                const sliceAngle = (item.value / total) * 2 * Math.PI;
                
                // Draw slice
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.closePath();
                ctx.fill();

                // Draw label if slice is large enough
                if (item.value / total > 0.05) {
                    const labelAngle = currentAngle + sliceAngle / 2;
                    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(item.value.toString(), labelX, labelY);
                }

                currentAngle += sliceAngle;
            }
        });
    }

    getRecentActivityData() {
        // Generate last 7 days of activity data
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const dayProjects = this.projects.filter(project => {
                const updatedDate = new Date(project.updated);
                return updatedDate.toDateString() === date.toDateString();
            });

            days.push({
                label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short' }),
                count: dayProjects.length,
                activity: dayProjects.length / Math.max(this.projects.length / 7, 1) // Normalize to 0-1
            });
        }
        
        return days;
    }

    setupEventListeners() {
        // New project buttons
        const newProjectBtns = this.container.querySelectorAll('.new-project-btn, .new-project-link');
        newProjectBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNewProject();
            });
        });

        // Template shortcut buttons
        const templateBtns = this.container.querySelectorAll('.template-btn');
        templateBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const templateId = btn.dataset.templateId;
                this.handleNewProjectFromTemplate(templateId);
            });
        });

        // Recent project cards
        const projectCards = this.container.querySelectorAll('.recent-project-card');
        projectCards.forEach(card => {
            const projectId = card.dataset.projectId;
            const project = this.projects.find(p => p.id === projectId);

            // Open project button
            const openBtn = card.querySelector('.open-project-btn');
            if (openBtn) {
                openBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleOpenProject(project);
                });
            }

            // Edit project button
            const editBtn = card.querySelector('.edit-project-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleEditProject(project);
                });
            }

            // Click on card to open project
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button') && !e.target.closest('a')) {
                    this.handleOpenProject(project);
                }
            });
        });

        // Action buttons
        const refreshBtn = this.container.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }

        const importBtn = this.container.querySelector('.import-projects-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.handleImport();
            });
        }

        const exportBtn = this.container.querySelector('.export-projects-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.handleExport();
            });
        }

        const organizeBtn = this.container.querySelector('.organize-projects-btn');
        if (organizeBtn) {
            organizeBtn.addEventListener('click', () => {
                this.handleOrganize();
            });
        }

        // View all projects link
        const viewAllLink = this.container.querySelector('.view-all-link');
        if (viewAllLink) {
            viewAllLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleOrganize();
            });
        }
    }

    handleNewProject() {
        if (this.options.onCreateProject) {
            this.options.onCreateProject();
        }
    }

    handleNewProjectFromTemplate(templateId) {
        if (this.options.onCreateProject) {
            this.options.onCreateProject(templateId);
        }
    }

    handleOpenProject(project) {
        if (this.options.onOpenProject) {
            this.options.onOpenProject(project);
        }
    }

    handleEditProject(project) {
        if (this.options.onEditProject) {
            this.options.onEditProject(project);
        }
    }

    handleImport() {
        if (this.options.onImportProjects) {
            this.options.onImportProjects();
        }
    }

    handleExport() {
        if (this.options.onExportProjects) {
            this.options.onExportProjects();
        }
    }

    handleOrganize() {
        if (this.options.onOrganizeProjects) {
            this.options.onOrganizeProjects();
        }
    }

    startAutoRefresh() {
        this.refreshTimer = setInterval(() => {
            this.refresh();
        }, this.options.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    async refresh() {
        try {
            await this.loadData();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
        }
    }

    formatStatus(status) {
        const statusMap = {
            planning: 'Planning',
            active: 'Active',
            completed: 'Completed',
            archived: 'Archived'
        };
        return statusMap[status] || status;
    }

    formatPriority(priority) {
        const priorityMap = {
            low: 'Low',
            medium: 'Medium',
            high: 'High',
            urgent: 'Urgent'
        };
        return priorityMap[priority] || priority;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        this.stopAutoRefresh();
        this.container = null;
        this.projectManager = null;
    }
}