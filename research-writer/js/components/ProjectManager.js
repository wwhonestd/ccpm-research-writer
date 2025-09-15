/**
 * ProjectManager - Main business logic for project CRUD operations
 * Handles project lifecycle, templates, validation, and data operations
 */

import { Project } from '../models/Project.js';
import { StorageService } from '../services/StorageService.js';
import { DataValidator } from '../services/DataValidator.js';

export class ProjectManager {
    constructor() {
        this.storage = new StorageService();
        this.validator = new DataValidator();
        this.collection = 'projects';
        this.templates = null;
        this.listeners = new Map();
        this.autoSaveInterval = null;
        this.autoSaveDelay = 5000; // 5 seconds
        
        this.init();
    }

    async init() {
        try {
            await this.loadTemplates();
            console.log('ProjectManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ProjectManager:', error);
            throw error;
        }
    }

    /**
     * Load project templates from JSON file
     */
    async loadTemplates() {
        try {
            const response = await fetch('./templates/project-templates.json');
            if (!response.ok) {
                throw new Error(`Failed to load templates: ${response.status}`);
            }
            this.templates = await response.json();
        } catch (error) {
            console.error('Error loading project templates:', error);
            // Provide fallback minimal templates
            this.templates = {
                templates: {
                    basic: {
                        name: "Basic Project",
                        description: "Simple research project",
                        icon: "📝",
                        category: "general",
                        defaults: {
                            title: "",
                            description: "",
                            author: "",
                            status: "planning",
                            priority: "medium",
                            tags: []
                        }
                    }
                },
                categories: {
                    general: {
                        name: "General",
                        description: "General research projects",
                        icon: "📁"
                    }
                }
            };
        }
    }

    /**
     * Get all available project templates
     */
    getTemplates() {
        return this.templates?.templates || {};
    }

    /**
     * Get template categories
     */
    getTemplateCategories() {
        return this.templates?.categories || {};
    }

    /**
     * Get a specific template by ID
     */
    getTemplate(templateId) {
        return this.templates?.templates?.[templateId] || null;
    }

    /**
     * Create a new project from template or blank
     */
    async createProject(data, templateId = null) {
        try {
            let projectData = { ...data };
            
            // Apply template defaults if specified
            if (templateId && this.templates?.templates?.[templateId]) {
                const template = this.templates.templates[templateId];
                projectData = {
                    ...template.defaults,
                    ...projectData,
                    templateId: templateId,
                    templateName: template.name
                };
            }

            // Create Project instance and validate
            const project = new Project(projectData);
            
            if (!project.isValid()) {
                throw new Error('Project data is invalid. Title and author are required.');
            }

            // Validate with DataValidator
            const validationResult = this.validator.validate('projects', project.toJSON());
            if (!validationResult.valid) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Store in database
            const savedProject = this.storage.create(this.collection, project.toJSON());
            
            this.emit('projectCreated', savedProject);
            return savedProject;

        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    /**
     * Get a project by ID
     */
    getProject(id) {
        try {
            const project = this.storage.read(this.collection, id);
            return project ? Project.fromJSON(project) : null;
        } catch (error) {
            console.error('Error getting project:', error);
            return null;
        }
    }

    /**
     * Update an existing project
     */
    async updateProject(id, data) {
        try {
            const existingProject = this.getProject(id);
            if (!existingProject) {
                throw new Error(`Project with ID ${id} not found`);
            }

            // Update project data
            const updatedProject = existingProject.update(data);
            
            // Validate
            const validationResult = this.validator.validate('projects', updatedProject.toJSON());
            if (!validationResult.valid) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Save to storage
            const savedProject = this.storage.update(this.collection, id, updatedProject.toJSON());
            
            this.emit('projectUpdated', savedProject);
            return savedProject;

        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(id) {
        try {
            const project = this.getProject(id);
            if (!project) {
                throw new Error(`Project with ID ${id} not found`);
            }

            const success = this.storage.delete(this.collection, id);
            
            if (success) {
                this.emit('projectDeleted', { id, project });
                return true;
            }
            return false;

        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    /**
     * Duplicate/clone a project
     */
    async duplicateProject(id, newTitle = null) {
        try {
            const originalProject = this.getProject(id);
            if (!originalProject) {
                throw new Error(`Project with ID ${id} not found`);
            }

            const duplicateData = originalProject.toJSON();
            delete duplicateData.id;
            delete duplicateData.created;
            delete duplicateData.updated;
            
            duplicateData.title = newTitle || `${duplicateData.title} (Copy)`;
            duplicateData.status = 'planning';

            return await this.createProject(duplicateData, originalProject.templateId);

        } catch (error) {
            console.error('Error duplicating project:', error);
            throw error;
        }
    }

    /**
     * Archive a project
     */
    async archiveProject(id) {
        try {
            return await this.updateProject(id, { status: 'archived' });
        } catch (error) {
            console.error('Error archiving project:', error);
            throw error;
        }
    }

    /**
     * Restore an archived project
     */
    async restoreProject(id) {
        try {
            return await this.updateProject(id, { status: 'active' });
        } catch (error) {
            console.error('Error restoring project:', error);
            throw error;
        }
    }

    /**
     * Get all projects with optional filtering and sorting
     */
    getProjects(options = {}) {
        try {
            const projects = this.storage.list(this.collection, options);
            return projects.map(project => Project.fromJSON(project));
        } catch (error) {
            console.error('Error getting projects:', error);
            return [];
        }
    }

    /**
     * Search projects by query
     */
    searchProjects(query, fields = ['title', 'description', 'author', 'tags']) {
        try {
            const projects = this.storage.search(this.collection, query, fields);
            return projects.map(project => Project.fromJSON(project));
        } catch (error) {
            console.error('Error searching projects:', error);
            return [];
        }
    }

    /**
     * Get projects count with optional filtering
     */
    getProjectsCount(filter = null) {
        try {
            return this.storage.count(this.collection, filter);
        } catch (error) {
            console.error('Error getting projects count:', error);
            return 0;
        }
    }

    /**
     * Get projects by status
     */
    getProjectsByStatus(status) {
        return this.getProjects({
            filter: project => project.status === status
        });
    }

    /**
     * Get projects by priority
     */
    getProjectsByPriority(priority) {
        return this.getProjects({
            filter: project => project.priority === priority
        });
    }

    /**
     * Get projects by tag
     */
    getProjectsByTag(tag) {
        return this.getProjects({
            filter: project => project.tags && project.tags.includes(tag)
        });
    }

    /**
     * Get project statistics
     */
    getStatistics() {
        try {
            const allProjects = this.getProjects();
            const stats = {
                total: allProjects.length,
                byStatus: {
                    planning: 0,
                    active: 0,
                    completed: 0,
                    archived: 0
                },
                byPriority: {
                    low: 0,
                    medium: 0,
                    high: 0,
                    urgent: 0
                },
                averageCompletion: 0,
                totalCitations: 0,
                totalNotes: 0,
                totalDrafts: 0
            };

            let totalCompletion = 0;

            allProjects.forEach(project => {
                // Status counts
                stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;
                
                // Priority counts
                stats.byPriority[project.priority] = (stats.byPriority[project.priority] || 0) + 1;
                
                // Completion tracking
                const projectStats = project.getStats();
                totalCompletion += projectStats.completionScore;
                stats.totalCitations += projectStats.totalCitations;
                stats.totalNotes += projectStats.totalNotes;
                stats.totalDrafts += projectStats.totalDrafts;
            });

            stats.averageCompletion = allProjects.length > 0 ? Math.round(totalCompletion / allProjects.length) : 0;

            return stats;
        } catch (error) {
            console.error('Error getting statistics:', error);
            return {
                total: 0,
                byStatus: { planning: 0, active: 0, completed: 0, archived: 0 },
                byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
                averageCompletion: 0,
                totalCitations: 0,
                totalNotes: 0,
                totalDrafts: 0
            };
        }
    }

    /**
     * Enable auto-save for a project
     */
    enableAutoSave(projectId, updateCallback) {
        this.disableAutoSave(); // Clear any existing interval
        
        this.autoSaveInterval = setInterval(async () => {
            try {
                if (typeof updateCallback === 'function') {
                    const updates = updateCallback();
                    if (updates && Object.keys(updates).length > 0) {
                        await this.updateProject(projectId, updates);
                        console.log('Auto-saved project:', projectId);
                    }
                }
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        }, this.autoSaveDelay);
    }

    /**
     * Disable auto-save
     */
    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    /**
     * Import projects from data
     */
    async importProjects(data) {
        try {
            const results = { imported: 0, skipped: 0, errors: [] };
            
            if (!Array.isArray(data)) {
                data = [data];
            }

            for (const projectData of data) {
                try {
                    // Check if project already exists
                    if (projectData.id && this.getProject(projectData.id)) {
                        results.skipped++;
                        continue;
                    }

                    await this.createProject(projectData);
                    results.imported++;
                } catch (error) {
                    results.errors.push({
                        project: projectData.title || 'Unknown',
                        error: error.message
                    });
                }
            }

            this.emit('projectsImported', results);
            return results;
        } catch (error) {
            console.error('Error importing projects:', error);
            throw error;
        }
    }

    /**
     * Export projects to different formats
     */
    exportProjects(projects = null, format = 'json') {
        try {
            const projectsToExport = projects || this.getProjects();
            
            switch (format.toLowerCase()) {
                case 'json':
                    return {
                        format: 'json',
                        data: projectsToExport.map(project => project.toExportFormat('json')),
                        filename: `research_projects_${new Date().toISOString().split('T')[0]}.json`
                    };
                    
                case 'csv':
                    const csvData = projectsToExport.map(project => project.toExportFormat('csv'));
                    const headers = Object.keys(csvData[0] || {});
                    const csvContent = [
                        headers.join(','),
                        ...csvData.map(row => 
                            headers.map(header => 
                                typeof row[header] === 'string' ? `"${row[header]}"` : row[header]
                            ).join(',')
                        )
                    ].join('\n');
                    
                    return {
                        format: 'csv',
                        data: csvContent,
                        filename: `research_projects_${new Date().toISOString().split('T')[0]}.csv`
                    };
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Error exporting projects:', error);
            throw error;
        }
    }

    /**
     * Event system for project management
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.disableAutoSave();
        this.listeners.clear();
        console.log('ProjectManager destroyed');
    }
}