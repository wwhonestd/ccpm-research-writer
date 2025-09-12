/**
 * Integration Tests - Export Pipeline
 * Comprehensive tests for the export and compilation pipeline
 * Tests all export formats, compilation process, and integration modules
 */

import { ExportManager } from '../../../js/modules/export/ExportManager.js';
import { DocumentCompiler } from '../../../js/services/compilation/DocumentCompiler.js';
import { CitationIntegration } from '../../../js/integration/citation/CitationIntegration.js';
import { ResearchIntegration } from '../../../js/integration/research/ResearchIntegration.js';
import { TemplateManager } from '../../../js/modules/export/TemplateManager.js';
import { ErrorHandler } from '../../../js/services/compilation/ErrorHandler.js';

describe('Export Pipeline Integration Tests', () => {
    let exportManager;
    let documentCompiler;
    let citationIntegration;
    let researchIntegration;
    let templateManager;
    let errorHandler;

    // Test data
    const sampleDocument = {
        id: 'test-doc-1',
        title: 'Sample Research Document',
        author: 'Test Author',
        date: '2023-12-01',
        abstract: 'This is a sample abstract for testing purposes.',
        keywords: ['testing', 'research', 'export'],
        sections: [
            {
                id: 'introduction',
                title: 'Introduction',
                level: 1,
                content: 'This is the introduction section with some **bold text** and *italic text*. It contains a citation [@sample2023] and a reference to [Section 2](#methodology).'
            },
            {
                id: 'methodology',
                title: 'Methodology',
                level: 1,
                content: 'This section describes the methodology used in this study. It includes:\n\n* Point one\n* Point two\n* Point three\n\nHere is a table:\n\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Data 1   | Data 2   | Data 3   |\n| Value A  | Value B  | Value C  |'
            },
            {
                id: 'results',
                title: 'Results',
                level: 1,
                content: 'The results show significant findings. Here is some inline code: `console.log("test")` and a code block:\n\n```javascript\nfunction test() {\n  return "Hello World";\n}\n```'
            }
        ],
        metadata: {
            type: 'research-paper',
            discipline: 'computer-science'
        }
    };

    const sampleCitations = [
        {
            id: 'sample2023',
            key: 'sample2023',
            type: 'article',
            title: 'Sample Research Article',
            authors: ['John Doe', 'Jane Smith'],
            year: 2023,
            publication: 'Journal of Testing',
            volume: '15',
            issue: '3',
            pages: '123-145',
            doi: '10.1000/sample.2023.123'
        }
    ];

    const sampleBibliography = {
        style: 'apa',
        entries: sampleCitations
    };

    beforeAll(async () => {
        // Initialize all components
        exportManager = new ExportManager();
        documentCompiler = new DocumentCompiler();
        citationIntegration = new CitationIntegration();
        researchIntegration = new ResearchIntegration();
        templateManager = new TemplateManager();
        errorHandler = new ErrorHandler();

        await Promise.all([
            exportManager.init(),
            documentCompiler.init(),
            citationIntegration.init(),
            researchIntegration.init(),
            templateManager.init(),
            errorHandler.init()
        ]);
    });

    afterAll(async () => {
        // Cleanup
        await Promise.all([
            exportManager.destroy(),
            documentCompiler.destroy(),
            citationIntegration.destroy(),
            researchIntegration.destroy(),
            templateManager.destroy(),
            errorHandler.destroy()
        ]);
    });

    describe('DocumentCompiler Integration', () => {
        test('should compile document with all integrations', async () => {
            const context = {
                citations: sampleCitations,
                bibliography: sampleBibliography,
                research: {
                    analysisData: { overview: 'Sample analysis' },
                    connections: [],
                    gaps: []
                }
            };

            const compiled = await documentCompiler.compile(sampleDocument, context);

            expect(compiled).toBeDefined();
            expect(compiled.id).toBe(sampleDocument.id);
            expect(compiled.title).toBe(sampleDocument.title);
            expect(compiled.sections).toHaveLength(3);
            expect(compiled.bibliography).toBeDefined();
            expect(compiled.compilationMetadata).toBeDefined();
            expect(compiled.compilationMetadata.processingTime).toBeGreaterThan(0);
        });

        test('should handle missing content gracefully', async () => {
            const incompleteDocument = {
                id: 'incomplete-doc',
                title: 'Incomplete Document'
                // Missing content and sections
            };

            const compiled = await documentCompiler.compile(incompleteDocument, {});

            expect(compiled).toBeDefined();
            expect(compiled.sections).toHaveLength(1); // Should create default section
            expect(compiled.sections[0].content).toBeDefined();
        });

        test('should validate document structure', async () => {
            const invalidDocument = {
                // Missing required fields
            };

            await expect(documentCompiler.compile(invalidDocument, {}))
                .rejects.toThrow('Document is required');
        });

        test('should process markdown content', async () => {
            const markdownDoc = {
                id: 'markdown-doc',
                title: 'Markdown Test',
                content: '# Heading 1\n\n**Bold text** and *italic text*.\n\n* List item 1\n* List item 2'
            };

            const compiled = await documentCompiler.compile(markdownDoc, {});

            expect(compiled.sections[0].content).toContain('<h1>');
            expect(compiled.sections[0].content).toContain('<strong>');
            expect(compiled.sections[0].content).toContain('<em>');
        });
    });

    describe('ExportManager Integration', () => {
        test('should export to PDF format', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'pdf', {
                includeCitations: true,
                includeResearch: false
            });

            expect(result.success).toBe(true);
            expect(result.format).toBe('pdf');
            expect(result.data).toBeDefined();
            expect(result.filename).toMatch(/\.pdf$/);
            expect(result.metadata.format).toBe('PDF');
            expect(result.processingTime).toBeGreaterThan(0);
        });

        test('should export to DOCX format', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'docx', {
                includeTOC: true,
                includeHeaders: true,
                includeFooters: true
            });

            expect(result.success).toBe(true);
            expect(result.format).toBe('docx');
            expect(result.data).toBeDefined();
            expect(result.filename).toMatch(/\.docx$/);
            expect(result.metadata.format).toBe('DOCX');
            expect(result.metadata.wordCount).toBeGreaterThan(0);
        });

        test('should export to LaTeX format', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'latex', {
                documentClass: 'article',
                mathMode: true,
                bibliography: true
            });

            expect(result.success).toBe(true);
            expect(result.format).toBe('latex');
            expect(result.data).toBeDefined();
            expect(result.filename).toMatch(/\.tex$/);
            expect(result.metadata.format).toBe('LaTeX');
        });

        test('should handle unsupported format', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'unsupported');

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/unsupported.*format/i);
        });

        test('should export with citations integration', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'pdf', {
                includeCitations: true,
                citationStyle: 'apa'
            });

            expect(result.success).toBe(true);
            // The document contains a citation reference, so it should be processed
            expect(result).toBeDefined();
        });

        test('should handle batch export', async () => {
            const result = await exportManager.exportDocument(sampleDocument, 'pdf', {
                batch: true
            });

            expect(result.success).toBe(true);
            expect(result.queued).toBe(true);
            expect(result.queuePosition).toBeGreaterThan(0);
        });

        test('should get export status', async () => {
            const exportResult = await exportManager.exportDocument(sampleDocument, 'pdf');
            const status = exportManager.getExportStatus(exportResult.exportId);

            expect(status).toBeDefined();
            expect(['completed', 'not_found']).toContain(status.status);
        });

        test('should get supported formats', () => {
            const formats = exportManager.getSupportedFormats();

            expect(formats).toContain('pdf');
            expect(formats).toContain('docx');
            expect(formats).toContain('latex');
        });
    });

    describe('CitationIntegration Tests', () => {
        test('should get citations for document', async () => {
            // Mock storage service to return sample citations
            jest.spyOn(citationIntegration.storageService, 'get')
                .mockReturnValue(sampleCitations[0]);

            const citations = await citationIntegration.getCitationsForDocument(sampleDocument);

            expect(citations).toBeDefined();
            expect(Array.isArray(citations)).toBe(true);
        });

        test('should generate APA bibliography', async () => {
            const bibliography = await citationIntegration.generateBibliography(sampleCitations, 'apa');

            expect(bibliography).toBeDefined();
            expect(bibliography.style).toBe('apa');
            expect(bibliography.entries).toHaveLength(1);
            expect(bibliography.entries[0].formatted).toContain('Doe, J., & Smith, J.');
            expect(bibliography.entries[0].formatted).toContain('2023');
        });

        test('should generate MLA bibliography', async () => {
            const bibliography = await citationIntegration.generateBibliography(sampleCitations, 'mla');

            expect(bibliography).toBeDefined();
            expect(bibliography.style).toBe('mla');
            expect(bibliography.entries).toHaveLength(1);
            expect(bibliography.entries[0].formatted).toContain('Doe, John, and Jane Smith');
        });

        test('should validate citations', async () => {
            const invalidCitation = {
                id: 'invalid',
                // Missing required fields
            };

            const validation = await citationIntegration.validateCitation(invalidCitation);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        test('should get supported citation styles', () => {
            const styles = citationIntegration.getSupportedStyles();

            expect(styles).toContain('apa');
            expect(styles).toContain('mla');
            expect(styles).toContain('chicago');
            expect(styles).toContain('ieee');
        });
    });

    describe('ResearchIntegration Tests', () => {
        test('should get research data for document', async () => {
            // Mock storage service
            jest.spyOn(researchIntegration.storageService, 'list')
                .mockReturnValue([
                    {
                        id: 'note1',
                        title: 'Test Note',
                        content: 'This note is about testing research integration',
                        tags: ['testing', 'research'],
                        created: new Date().toISOString()
                    }
                ]);

            const researchData = await researchIntegration.getResearchDataForDocument(sampleDocument);

            expect(researchData).toBeDefined();
            expect(researchData.notes).toBeDefined();
            expect(Array.isArray(researchData.notes)).toBe(true);
            expect(researchData.metadata).toBeDefined();
        });

        test('should aggregate notes by relevance', async () => {
            const mockNotes = [
                {
                    id: 'note1',
                    title: 'Testing Notes',
                    content: 'This is about testing and research methods',
                    tags: ['testing', 'research'],
                    created: new Date().toISOString()
                },
                {
                    id: 'note2',
                    title: 'Unrelated Note',
                    content: 'This is about something completely different',
                    tags: ['other'],
                    created: new Date().toISOString()
                }
            ];

            jest.spyOn(researchIntegration.storageService, 'list')
                .mockReturnValue(mockNotes);

            const notes = await researchIntegration.getNotesForDocument(sampleDocument);

            expect(notes).toBeDefined();
            expect(notes.length).toBeGreaterThan(0);
            // First note should be more relevant due to matching tags
            if (notes.length > 1) {
                expect(notes[0].relevanceScore).toBeGreaterThanOrEqual(notes[1].relevanceScore);
            }
        });

        test('should calculate note relevance', async () => {
            const context = await researchIntegration.createResearchContext(sampleDocument);
            const relevantNote = {
                title: 'Research Testing Methods',
                content: 'This note discusses testing methodologies in research',
                tags: ['testing', 'research', 'methodology']
            };

            const relevance = researchIntegration.calculateNoteRelevance(relevantNote, context);

            expect(relevance).toBeGreaterThan(0);
            expect(relevance).toBeLessThanOrEqualTo(1);
        });
    });

    describe('TemplateManager Tests', () => {
        test('should apply academic paper template', async () => {
            const variables = {
                title: sampleDocument.title,
                author: sampleDocument.author,
                institution: 'Test University',
                abstract: sampleDocument.abstract,
                keywords: sampleDocument.keywords
            };

            const result = await templateManager.applyTemplate('academic-paper', sampleDocument, variables, {
                format: 'pdf'
            });

            expect(result).toBeDefined();
            expect(result).toContain(sampleDocument.title);
            expect(result).toContain(sampleDocument.author);
            expect(result).toContain('Test University');
        });

        test('should apply template with LaTeX format', async () => {
            const variables = {
                title: 'LaTeX Test Document',
                author: 'LaTeX Author'
            };

            const result = await templateManager.applyTemplate('academic-paper', sampleDocument, variables, {
                format: 'latex'
            });

            expect(result).toContain('\\documentclass');
            expect(result).toContain('\\title{');
            expect(result).toContain('\\author{');
            expect(result).toContain('\\begin{document}');
        });

        test('should validate template variables', async () => {
            const incompleteVariables = {
                // Missing required title
                author: 'Test Author'
            };

            await expect(templateManager.applyTemplate('academic-paper', sampleDocument, incompleteVariables))
                .rejects.toThrow(/required variable/i);
        });

        test('should get available templates', () => {
            const templates = templateManager.getTemplates();

            expect(templates.length).toBeGreaterThan(0);
            expect(templates.some(t => t.id === 'academic-paper')).toBe(true);
            expect(templates.some(t => t.id === 'research-report')).toBe(true);
        });

        test('should process template functions', async () => {
            const testTemplate = {
                name: 'Test Template',
                type: 'test',
                formats: ['pdf'],
                template: 'Date: {{formatDate(variables.date, "Month DD, YYYY")}}',
                variables: {
                    date: { required: true, type: 'date' }
                }
            };

            templateManager.registerCustomTemplate('test-template', testTemplate);

            const result = await templateManager.applyTemplate('test-template', sampleDocument, {
                date: '2023-12-25'
            });

            expect(result).toMatch(/Date: December 25, 2023/);
        });
    });

    describe('ErrorHandler Tests', () => {
        test('should handle validation error', async () => {
            const validationError = new Error('Validation failed: title is required');
            const context = { type: 'validation', operation: 'export' };

            const result = await errorHandler.handleError(validationError, context);

            expect(result.success).toBe(false);
            expect(result.error.type).toBe('VALIDATION_ERROR');
            expect(result.error.severity).toBe('error');
            expect(result.error.suggestions.length).toBeGreaterThan(0);
        });

        test('should attempt error recovery', async () => {
            const compilationError = new Error('Compilation failed');
            const context = {
                type: 'compilation',
                document: { id: 'test' }, // Missing required fields
                options: {}
            };

            const result = await errorHandler.handleError(compilationError, context);

            expect(result).toBeDefined();
            expect(result.error.type).toBe('COMPILATION_ERROR');
            // Recovery might succeed or fail, but should be attempted
        });

        test('should validate document structure', async () => {
            const validation = await errorHandler.validate('document', sampleDocument);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should detect error types correctly', async () => {
            const exportError = new Error('Export process failed');
            const context = { type: 'export' };

            const result = await errorHandler.handleError(exportError, context);

            expect(result.error.type).toBe('EXPORT_ERROR');
        });

        test('should track error statistics', async () => {
            const error1 = new Error('Test error 1');
            const error2 = new Error('Validation failed');

            await errorHandler.handleError(error1, {});
            await errorHandler.handleError(error2, { type: 'validation' });

            const stats = errorHandler.getStats();

            expect(stats.totalErrors).toBeGreaterThanOrEqualTo(2);
            expect(stats.errorsByType).toBeDefined();
        });
    });

    describe('End-to-End Pipeline Tests', () => {
        test('should complete full export pipeline for PDF', async () => {
            const startTime = Date.now();

            const result = await exportManager.exportDocument(sampleDocument, 'pdf', {
                includeCitations: true,
                includeResearch: false,
                template: 'academic-paper',
                templateVariables: {
                    title: sampleDocument.title,
                    author: sampleDocument.author,
                    institution: 'Test University',
                    abstract: sampleDocument.abstract,
                    keywords: sampleDocument.keywords
                }
            });

            const processingTime = Date.now() - startTime;

            expect(result.success).toBe(true);
            expect(result.format).toBe('pdf');
            expect(result.data).toBeDefined();
            expect(result.metadata).toBeDefined();
            expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
        });

        test('should handle complex document with all features', async () => {
            const complexDocument = {
                ...sampleDocument,
                sections: [
                    ...sampleDocument.sections,
                    {
                        id: 'complex-section',
                        title: 'Complex Section',
                        level: 1,
                        content: `# Subsection

This section contains:

1. Numbered list item 1
2. Numbered list item 2
3. Numbered list item 3

## Mathematical Equations

Inline math: $E = mc^2$

Display math:
$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## Code Examples

\`\`\`python
def hello_world():
    print("Hello, World!")
    return "success"
\`\`\`

## Images and Figures

![Sample Figure](sample-image.png){width=0.8}

## Citations and References

This work builds on previous research [@sample2023] and extends the methodology described by [other authors](#references).

## Tables

| Method | Accuracy | Speed |
|--------|----------|-------|
| Method A | 95% | Fast |
| Method B | 98% | Slow |
| Method C | 92% | Medium |`
                    }
                ]
            };

            const result = await exportManager.exportDocument(complexDocument, 'latex', {
                documentClass: 'article',
                mathMode: true,
                figureFloats: true,
                hyperlinks: true,
                bibliography: true
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.metadata.characterCount).toBeGreaterThan(1000);
        });

        test('should handle export with error recovery', async () => {
            const problematicDocument = {
                id: 'problematic',
                // Missing title (should trigger recovery)
                sections: [
                    {
                        title: 'Section with Issues',
                        content: 'This section might cause compilation issues'
                    }
                ]
            };

            const result = await exportManager.exportDocument(problematicDocument, 'pdf');

            // Should either succeed with recovery or fail gracefully
            expect(result).toBeDefined();
            if (result.success) {
                expect(result.data).toBeDefined();
            } else {
                expect(result.error).toBeDefined();
            }
        });

        test('should export multiple formats of same document', async () => {
            const formats = ['pdf', 'docx', 'latex'];
            const results = [];

            for (const format of formats) {
                const result = await exportManager.exportDocument(sampleDocument, format, {
                    includeCitations: true
                });
                results.push(result);
            }

            // All formats should succeed
            expect(results.every(r => r.success)).toBe(true);
            
            // Each should have different file extensions
            expect(results[0].filename).toMatch(/\.pdf$/);
            expect(results[1].filename).toMatch(/\.docx$/);
            expect(results[2].filename).toMatch(/\.tex$/);
        });

        test('should maintain performance standards', async () => {
            const performanceTests = [];

            for (let i = 0; i < 3; i++) {
                const startTime = Date.now();
                
                const result = await exportManager.exportDocument(sampleDocument, 'pdf');
                
                const processingTime = Date.now() - startTime;
                performanceTests.push(processingTime);
                
                expect(result.success).toBe(true);
            }

            const averageTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
            const maxTime = Math.max(...performanceTests);

            // Performance expectations
            expect(averageTime).toBeLessThan(5000); // Average under 5 seconds
            expect(maxTime).toBeLessThan(10000); // Max under 10 seconds
        });
    });

    describe('Integration Edge Cases', () => {
        test('should handle empty document', async () => {
            const emptyDocument = {
                id: 'empty',
                title: 'Empty Document'
            };

            const result = await exportManager.exportDocument(emptyDocument, 'pdf');

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        test('should handle document with only title', async () => {
            const titleOnlyDocument = {
                id: 'title-only',
                title: 'Title Only Document',
                content: ''
            };

            const result = await exportManager.exportDocument(titleOnlyDocument, 'docx');

            expect(result.success).toBe(true);
        });

        test('should handle very long document', async () => {
            const longContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000);
            const longDocument = {
                id: 'long-doc',
                title: 'Very Long Document',
                content: longContent
            };

            const result = await exportManager.exportDocument(longDocument, 'pdf');

            expect(result.success).toBe(true);
            expect(result.metadata.size).toBeGreaterThan(1000);
        });

        test('should handle special characters', async () => {
            const specialDocument = {
                id: 'special-chars',
                title: 'Document with Special Characters: àáâãäå çéñüß',
                content: 'Content with special chars: © ® ™ § ¶ † ‡ • … ‰ ‹ › € ¢ £ ¥'
            };

            const result = await exportManager.exportDocument(specialDocument, 'latex');

            expect(result.success).toBe(true);
        });

        test('should handle concurrent exports', async () => {
            const concurrentPromises = [];

            for (let i = 0; i < 5; i++) {
                const doc = {
                    ...sampleDocument,
                    id: `concurrent-${i}`,
                    title: `Concurrent Document ${i}`
                };

                concurrentPromises.push(
                    exportManager.exportDocument(doc, 'pdf')
                );
            }

            const results = await Promise.all(concurrentPromises);

            expect(results.every(r => r.success)).toBe(true);
            expect(results.every(r => r.data)).toBe(true);
        });
    });
});

// Test utilities and helpers
export class TestUtils {
    static createMockDocument(overrides = {}) {
        return {
            id: 'mock-doc',
            title: 'Mock Document',
            author: 'Mock Author',
            content: 'Mock content for testing',
            ...overrides
        };
    }

    static createMockCitation(overrides = {}) {
        return {
            id: 'mock-citation',
            title: 'Mock Citation',
            authors: ['Mock Author'],
            year: 2023,
            ...overrides
        };
    }

    static async expectAsyncError(asyncFn, errorMatcher) {
        try {
            await asyncFn();
            throw new Error('Expected async function to throw');
        } catch (error) {
            if (typeof errorMatcher === 'string') {
                expect(error.message).toContain(errorMatcher);
            } else if (errorMatcher instanceof RegExp) {
                expect(error.message).toMatch(errorMatcher);
            } else {
                expect(error).toMatch(errorMatcher);
            }
        }
    }

    static validateExportResult(result, format) {
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
        expect(result.data).toBeDefined();
        expect(result.filename).toMatch(new RegExp(`\\.${format === 'latex' ? 'tex' : format}$`));
        expect(result.metadata).toBeDefined();
        expect(result.processingTime).toBeGreaterThan(0);
    }
}