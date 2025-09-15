/**
 * Templates Module Index
 * Main export for the template system
 */

export {
    TemplateEngine,
    AcademicTemplate,
    TemplateUtils,
    TEMPLATE_TYPES,
    ACADEMIC_STYLES,
    type TemplateConfig,
    type TemplateResult,
    type TemplateValidation
} from './TemplateEngine.js';

export {
    APAAcademicPaper,
    MLAAcademicPaper,
    ACADEMIC_TEMPLATE_REGISTRY,
    getAcademicTemplate,
    getAvailableAcademicTemplates,
    getAcademicTemplatesByStyle,
    getAcademicTemplatesByType
} from './academic/index.js';

import { TemplateEngine } from './TemplateEngine.js';
import { getAcademicTemplate, getAvailableAcademicTemplates } from './academic/index.js';

/**
 * Create a pre-configured template engine with all templates registered
 */
export function createTemplateEngine(): TemplateEngine {
    const engine = new TemplateEngine();

    // Register all available academic templates
    const availableTemplates = getAvailableAcademicTemplates();
    availableTemplates.forEach(templateId => {
        const template = getAcademicTemplate(templateId);
        engine.registerTemplate(template);
    });

    // Set APA as default
    if (availableTemplates.includes('apa-academic-paper')) {
        engine.setDefaultTemplate('apa-academic-paper');
    }

    return engine;
}

/**
 * Quick format function for documents
 */
export function formatDocument(document: any, templateId?: string, options?: any) {
    const engine = createTemplateEngine();
    return engine.processDocument(document, templateId, options);
}

/**
 * Quick validation function for documents
 */
export function validateDocument(document: any, templateId?: string) {
    const engine = createTemplateEngine();
    return engine.validateDocument(document, templateId);
}

/**
 * Get template recommendations for a document
 */
export function getTemplateRecommendations(document: any) {
    const engine = createTemplateEngine();
    return engine.getTemplateRecommendations(document);
}

export default {
    TemplateEngine,
    createTemplateEngine,
    formatDocument,
    validateDocument,
    getTemplateRecommendations,
    getAcademicTemplate,
    getAvailableAcademicTemplates
};