/**
 * Template System Tests
 * Comprehensive tests for academic templates and formatting
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    TemplateEngine,
    createTemplateEngine,
    formatDocument,
    validateDocument,
    getTemplateRecommendations,
    TEMPLATE_TYPES,
    ACADEMIC_STYLES,
    TemplateUtils
} from '../../src/export/templates/index.js';
import { APAAcademicPaper, MLAAcademicPaper } from '../../src/export/templates/academic/index.js';

describe('Template System', () => {
    let engine;
    let sampleDocument;

    beforeEach(() => {
        engine = createTemplateEngine();

        sampleDocument = {
            title: 'The Impact of Technology on Modern Education',
            author: 'John A. Smith',
            date: new Date('2023-05-15'),
            abstract: 'This paper examines the transformative effects of technology on contemporary educational practices and outcomes.',
            keywords: ['technology', 'education', 'digital learning', 'pedagogy'],
            sections: [
                {
                    id: 'introduction',
                    title: 'Introduction',
                    level: 1,
                    content: 'Education has undergone significant transformation in recent decades, largely driven by technological advancement. This paper explores the multifaceted impact of technology on modern educational practices.',
                    subsections: []
                },
                {
                    id: 'methodology',
                    title: 'Methodology',
                    level: 1,
                    content: 'This study employs a mixed-methods approach, combining quantitative analysis of educational outcomes with qualitative interviews of educators and students.',
                    subsections: []
                },
                {
                    id: 'results',
                    title: 'Results',
                    level: 1,
                    content: 'The findings indicate significant improvements in student engagement and learning outcomes when technology is properly integrated into the curriculum.',
                    subsections: []
                },
                {
                    id: 'discussion',
                    title: 'Discussion',
                    level: 1,
                    content: 'These results suggest that technology, when thoughtfully implemented, can enhance educational effectiveness and accessibility.',
                    subsections: []
                }
            ],
            citations: [
                {
                    id: 'doe2022',
                    type: 'journal-article',
                    title: 'Digital Learning Environments',
                    authors: [{ firstName: 'Jane', lastName: 'Doe' }],
                    year: 2022
                }
            ],
            bibliography: 'Doe, J. (2022). Digital Learning Environments. Educational Technology Journal, 15(3), 45-62.',
            metadata: {
                institution: 'University of Technology',
                course: 'EDU 500',
                instructor: 'Dr. Sarah Johnson'
            }
        };
    });

    describe('TemplateEngine', () => {
        test('should create engine and register templates', () => {
            expect(engine).toBeInstanceOf(TemplateEngine);

            const availableTemplates = engine.getAvailableTemplates();
            expect(availableTemplates.length).toBeGreaterThan(0);

            const templateIds = availableTemplates.map(t => t.id);
            expect(templateIds).toContain('apa-academic-paper');
            expect(templateIds).toContain('mla-academic-paper');
        });

        test('should check if template exists', () => {
            expect(engine.hasTemplate('apa-academic-paper')).toBe(true);
            expect(engine.hasTemplate('mla-academic-paper')).toBe(true);
            expect(engine.hasTemplate('unknown-template')).toBe(false);
        });

        test('should get template by ID', () => {
            const apaTemplate = engine.getTemplate('apa-academic-paper');
            expect(apaTemplate).toBeInstanceOf(APAAcademicPaper);

            const mlaTemplate = engine.getTemplate('mla-academic-paper');
            expect(mlaTemplate).toBeInstanceOf(MLAAcademicPaper);

            const unknownTemplate = engine.getTemplate('unknown');
            expect(unknownTemplate).toBeNull();
        });

        test('should get templates by type', () => {
            const academicPapers = engine.getTemplatesByType(TEMPLATE_TYPES.ACADEMIC_PAPER);
            expect(academicPapers.length).toBeGreaterThan(0);
            expect(academicPapers.every(t => t.type === TEMPLATE_TYPES.ACADEMIC_PAPER)).toBe(true);
        });

        test('should get templates by style', () => {
            const apaTemplates = engine.getTemplatesByStyle(ACADEMIC_STYLES.APA);
            expect(apaTemplates.length).toBeGreaterThan(0);
            expect(apaTemplates.every(t => t.style === ACADEMIC_STYLES.APA)).toBe(true);

            const mlaTemplates = engine.getTemplatesByStyle(ACADEMIC_STYLES.MLA);
            expect(mlaTemplates.length).toBeGreaterThan(0);
            expect(mlaTemplates.every(t => t.style === ACADEMIC_STYLES.MLA)).toBe(true);
        });

        test('should set and get default template', () => {
            engine.setDefaultTemplate('mla-academic-paper');
            const defaultTemplate = engine.getDefaultTemplate();
            expect(defaultTemplate).toBeInstanceOf(MLAAcademicPaper);
        });

        test('should process document with template', async () => {
            const result = await engine.processDocument(sampleDocument, 'apa-academic-paper');

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('document');
            expect(result).toHaveProperty('formattedContent');
            expect(result).toHaveProperty('metadata');

            expect(result.success).toBe(true);
            expect(result.document).toBe(sampleDocument);
            expect(typeof result.formattedContent).toBe('string');
            expect(result.formattedContent.length).toBeGreaterThan(0);

            expect(result.metadata).toHaveProperty('templateId');
            expect(result.metadata).toHaveProperty('processingTime');
            expect(result.metadata).toHaveProperty('warnings');
            expect(result.metadata).toHaveProperty('statistics');

            expect(result.metadata.templateId).toBe('apa-academic-paper');
            expect(typeof result.metadata.processingTime).toBe('number');
            expect(Array.isArray(result.metadata.warnings)).toBe(true);
        });

        test('should validate document against template', () => {
            const validation = engine.validateDocument(sampleDocument, 'apa-academic-paper');

            expect(validation).toHaveProperty('valid');
            expect(validation).toHaveProperty('errors');
            expect(validation).toHaveProperty('warnings');
            expect(validation).toHaveProperty('suggestions');

            expect(typeof validation.valid).toBe('boolean');
            expect(Array.isArray(validation.errors)).toBe(true);
            expect(Array.isArray(validation.warnings)).toBe(true);
            expect(Array.isArray(validation.suggestions)).toBe(true);
        });

        test('should get template recommendations', () => {
            const recommendations = engine.getTemplateRecommendations(sampleDocument);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.length).toBeLessThanOrEqual(5);

            recommendations.forEach(template => {
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('name');
                expect(template).toHaveProperty('type');
                expect(template).toHaveProperty('style');
            });
        });

        test('should export template configuration', () => {
            const configJson = engine.exportTemplateConfig('apa-academic-paper');

            expect(typeof configJson).toBe('string');

            const config = JSON.parse(configJson);
            expect(config).toHaveProperty('id');
            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('type');
            expect(config).toHaveProperty('style');
            expect(config.id).toBe('apa-academic-paper');
        });

        test('should import template configuration', () => {
            const originalConfig = engine.exportTemplateConfig('apa-academic-paper');
            const importedConfig = engine.importTemplateConfig(originalConfig);

            expect(importedConfig).toHaveProperty('id');
            expect(importedConfig).toHaveProperty('name');
            expect(importedConfig.id).toBe('apa-academic-paper');
        });

        test('should get engine statistics', () => {
            const stats = engine.getStats();

            expect(stats).toHaveProperty('totalTemplates');
            expect(stats).toHaveProperty('templatesByType');
            expect(stats).toHaveProperty('templatesByStyle');

            expect(typeof stats.totalTemplates).toBe('number');
            expect(stats.totalTemplates).toBeGreaterThan(0);
            expect(typeof stats.templatesByType).toBe('object');
            expect(typeof stats.templatesByStyle).toBe('object');
        });
    });

    describe('APAAcademicPaper Template', () => {
        let apaTemplate;

        beforeEach(() => {
            apaTemplate = new APAAcademicPaper();
        });

        test('should have correct configuration', () => {
            const config = apaTemplate.config;

            expect(config.id).toBe('apa-academic-paper');
            expect(config.name).toBe('APA Academic Paper');
            expect(config.type).toBe(TEMPLATE_TYPES.ACADEMIC_PAPER);
            expect(config.style).toBe(ACADEMIC_STYLES.APA);

            expect(config.pageSize).toBe('Letter');
            expect(config.margins.unit).toBe('in');
            expect(config.font.family).toBe('Times New Roman');
            expect(config.font.size).toBe(12);
            expect(config.spacing.lineSpacing).toBe('double');

            expect(config.citations.style).toBe(ACADEMIC_STYLES.APA);
            expect(config.citations.bibliographyTitle).toBe('References');
            expect(config.titlePage.required).toBe(true);
        });

        test('should validate document correctly', () => {
            const validation = apaTemplate.validate(sampleDocument);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);

            // Test with invalid document
            const invalidDocument = { title: '', sections: [] };
            const invalidValidation = apaTemplate.validate(invalidDocument);

            expect(invalidValidation.valid).toBe(false);
            expect(invalidValidation.errors.length).toBeGreaterThan(0);
        });

        test('should process document successfully', async () => {
            const result = await apaTemplate.process(sampleDocument);

            expect(result.success).toBe(true);
            expect(result.formattedContent).toContain('The Impact of Technology on Modern Education');
            expect(result.formattedContent).toContain('John A. Smith');
            expect(result.formattedContent).toContain('Abstract');
            expect(result.formattedContent).toContain('Introduction');

            expect(result.metadata.statistics.wordCount).toBeGreaterThan(0);
            expect(result.metadata.statistics.pageCount).toBeGreaterThan(0);
        });

        test('should get preview', () => {
            const preview = apaTemplate.getPreview();
            expect(typeof preview).toBe('string');
            expect(preview).toContain('html');
        });

        test('should get export options', () => {
            const options = apaTemplate.getExportOptions();

            expect(options).toHaveProperty('pageSize');
            expect(options).toHaveProperty('margins');
            expect(options).toHaveProperty('font');
            expect(options).toHaveProperty('lineSpacing');
            expect(options.referenceStyle).toBe('apa');
        });
    });

    describe('MLAAcademicPaper Template', () => {
        let mlaTemplate;

        beforeEach(() => {
            mlaTemplate = new MLAAcademicPaper();
        });

        test('should have correct configuration', () => {
            const config = mlaTemplate.config;

            expect(config.id).toBe('mla-academic-paper');
            expect(config.name).toBe('MLA Academic Paper');
            expect(config.type).toBe(TEMPLATE_TYPES.ACADEMIC_PAPER);
            expect(config.style).toBe(ACADEMIC_STYLES.MLA);

            expect(config.pageSize).toBe('Letter');
            expect(config.font.family).toBe('Times New Roman');
            expect(config.font.size).toBe(12);
            expect(config.spacing.lineSpacing).toBe('double');

            expect(config.citations.style).toBe(ACADEMIC_STYLES.MLA);
            expect(config.citations.bibliographyTitle).toBe('Works Cited');
            expect(config.titlePage.required).toBe(false);
        });

        test('should validate document correctly', () => {
            const validation = mlaTemplate.validate(sampleDocument);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should process document successfully', async () => {
            const result = await mlaTemplate.process(sampleDocument);

            expect(result.success).toBe(true);
            expect(result.formattedContent).toContain('The Impact of Technology on Modern Education');
            expect(result.formattedContent).toContain('John A. Smith');
            expect(result.formattedContent).toContain('Dr. Sarah Johnson');
            expect(result.formattedContent).toContain('EDU 500');

            expect(result.metadata.statistics.wordCount).toBeGreaterThan(0);
            expect(result.metadata.statistics.pageCount).toBeGreaterThan(0);
        });

        test('should get export options', () => {
            const options = mlaTemplate.getExportOptions();

            expect(options).toHaveProperty('pageSize');
            expect(options).toHaveProperty('margins');
            expect(options).toHaveProperty('font');
            expect(options.titlePage).toBe(false);
            expect(options.referenceStyle).toBe('mla');
        });
    });

    describe('TemplateUtils', () => {
        test('should convert margins to CSS', () => {
            const margins = { top: 1, bottom: 1, left: 1, right: 1, unit: 'in' };
            const css = TemplateUtils.marginsToCSS(margins);

            expect(css).toBe('1in 1in 1in 1in');
        });

        test('should convert font to CSS', () => {
            const font = { family: 'Times New Roman', size: 12, lineHeight: 2.0, unit: 'pt' };
            const css = TemplateUtils.fontToCSS(font);

            expect(css).toContain('12pt');
            expect(css).toContain('2');
            expect(css).toContain('Times New Roman');
        });

        test('should convert heading to CSS', () => {
            const heading = {
                fontSize: 14,
                fontWeight: 'bold',
                spacing: { before: 12, after: 6 },
                alignment: 'center'
            };
            const css = TemplateUtils.headingToCSS(heading);

            expect(css).toContain('font-size: 14pt');
            expect(css).toContain('font-weight: bold');
            expect(css).toContain('text-align: center');
            expect(css).toContain('margin-top: 12pt');
            expect(css).toContain('margin-bottom: 6pt');
        });

        test('should generate preview HTML', () => {
            const config = {
                name: 'Test Template',
                style: 'apa',
                font: { family: 'Arial', size: 12, lineHeight: 1.5, unit: 'pt' },
                margins: { top: 1, bottom: 1, left: 1, right: 1, unit: 'in' },
                headings: {
                    1: { fontSize: 14, fontWeight: 'bold', spacing: { before: 0, after: 0 }, alignment: 'center' }
                }
            };

            const html = TemplateUtils.generatePreviewHTML(config);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Test Template');
            expect(html).toContain('APA');
            expect(html).toContain('Arial');
        });
    });

    describe('Quick Format Functions', () => {
        test('should format document quickly', async () => {
            const result = await formatDocument(sampleDocument, 'apa-academic-paper');

            expect(result.success).toBe(true);
            expect(result.formattedContent.length).toBeGreaterThan(0);
        });

        test('should validate document quickly', () => {
            const result = validateDocument(sampleDocument, 'mla-academic-paper');

            expect(result).toHaveProperty('valid');
            expect(result).toHaveProperty('errors');
        });

        test('should get recommendations quickly', () => {
            const recommendations = getTemplateRecommendations(sampleDocument);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle unknown template ID', async () => {
            await expect(engine.processDocument(sampleDocument, 'unknown-template')).rejects.toThrow();
        });

        test('should handle invalid template configuration', () => {
            expect(() => {
                engine.importTemplateConfig('invalid json');
            }).toThrow();

            expect(() => {
                engine.importTemplateConfig('{"id": ""}');
            }).toThrow();
        });

        test('should handle document processing errors', async () => {
            const invalidDocument = null;
            const result = await engine.processDocument(invalidDocument, 'apa-academic-paper');

            expect(result.success).toBe(false);
            expect(result.metadata.warnings.length).toBeGreaterThan(0);
        });

        test('should handle setting invalid default template', () => {
            expect(() => {
                engine.setDefaultTemplate('unknown-template');
            }).toThrow();
        });
    });
});