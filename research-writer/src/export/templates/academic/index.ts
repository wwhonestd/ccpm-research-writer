/**
 * Academic Templates Index
 * Exports all available academic templates
 */

import APAAcademicPaper from './APAAcademicPaper.js';
import MLAAcademicPaper from './MLAAcademicPaper.js';

export { APAAcademicPaper, MLAAcademicPaper };

/**
 * Registry of all available academic templates
 */
export const ACADEMIC_TEMPLATE_REGISTRY = {
    'apa-academic-paper': APAAcademicPaper,
    'mla-academic-paper': MLAAcademicPaper
};

/**
 * Get an academic template instance by ID
 */
export function getAcademicTemplate(templateId: string) {
    const TemplateClass = ACADEMIC_TEMPLATE_REGISTRY[templateId];
    if (!TemplateClass) {
        throw new Error(`Academic template '${templateId}' is not available. Available templates: ${Object.keys(ACADEMIC_TEMPLATE_REGISTRY).join(', ')}`);
    }
    return new TemplateClass();
}

/**
 * Get all available academic template IDs
 */
export function getAvailableAcademicTemplates(): string[] {
    return Object.keys(ACADEMIC_TEMPLATE_REGISTRY);
}

/**
 * Get academic templates by style
 */
export function getAcademicTemplatesByStyle(style: string): string[] {
    return Object.keys(ACADEMIC_TEMPLATE_REGISTRY).filter(templateId => {
        const template = new ACADEMIC_TEMPLATE_REGISTRY[templateId]();
        return template.config.style === style;
    });
}

/**
 * Get academic templates by type
 */
export function getAcademicTemplatesByType(type: string): string[] {
    return Object.keys(ACADEMIC_TEMPLATE_REGISTRY).filter(templateId => {
        const template = new ACADEMIC_TEMPLATE_REGISTRY[templateId]();
        return template.config.type === type;
    });
}

export default {
    APAAcademicPaper,
    MLAAcademicPaper,
    ACADEMIC_TEMPLATE_REGISTRY,
    getAcademicTemplate,
    getAvailableAcademicTemplates,
    getAcademicTemplatesByStyle,
    getAcademicTemplatesByType
};