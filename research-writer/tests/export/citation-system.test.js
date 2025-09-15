/**
 * Citation System Tests
 * Comprehensive tests for citation formatting and bibliography generation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    CitationFormatter,
    createCitationFormatter,
    formatCitation,
    formatBibliography,
    CITATION_TYPES,
    CitationUtils
} from '../../src/export/citations/index.js';
import { APAStyle, MLAStyle, ChicagoStyle } from '../../src/export/citations/styles/index.js';

describe('Citation System', () => {
    let formatter;
    let sampleSources;

    beforeEach(() => {
        formatter = createCitationFormatter();

        sampleSources = [
            {
                id: 'smith2023',
                type: CITATION_TYPES.JOURNAL_ARTICLE,
                title: 'The Impact of Technology on Modern Education',
                authors: [
                    { firstName: 'John', lastName: 'Smith', middleName: 'A.' }
                ],
                year: 2023,
                journal: 'Educational Technology Review',
                volume: '45',
                issue: '2',
                pages: '123-145',
                doi: '10.1234/etr.2023.45.2.123'
            },
            {
                id: 'johnson2022',
                type: CITATION_TYPES.BOOK,
                title: 'Research Methods in Social Sciences',
                authors: [
                    { firstName: 'Mary', lastName: 'Johnson' },
                    { firstName: 'Robert', lastName: 'Brown' }
                ],
                year: 2022,
                publisher: 'Academic Press',
                publisherLocation: 'New York',
                edition: '3rd'
            },
            {
                id: 'wilson2021',
                type: CITATION_TYPES.WEBSITE,
                title: 'Understanding Data Analysis',
                authors: [
                    { firstName: 'Sarah', lastName: 'Wilson' }
                ],
                year: 2021,
                url: 'https://example.com/data-analysis',
                siteName: 'Data Science Hub',
                accessDate: new Date('2023-05-15')
            }
        ];
    });

    describe('CitationFormatter', () => {
        test('should create formatter and register styles', () => {
            expect(formatter).toBeInstanceOf(CitationFormatter);
            expect(formatter.getAvailableStyles()).toContain('apa');
            expect(formatter.getAvailableStyles()).toContain('mla');
            expect(formatter.getAvailableStyles()).toContain('chicago');
        });

        test('should check if style is supported', () => {
            expect(formatter.isStyleSupported('apa')).toBe(true);
            expect(formatter.isStyleSupported('mla')).toBe(true);
            expect(formatter.isStyleSupported('unknown')).toBe(false);
        });

        test('should format single citation', () => {
            const result = formatter.formatCitation(sampleSources[0], { style: 'apa' });

            expect(result).toHaveProperty('inText');
            expect(result).toHaveProperty('fullReference');
            expect(result).toHaveProperty('source');
            expect(result).toHaveProperty('style');
            expect(result.style).toBe('apa');
            expect(result.source).toBe(sampleSources[0]);
        });

        test('should format multiple in-text citations', () => {
            const result = formatter.formatInTextCitations(sampleSources, { style: 'apa' });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        test('should generate bibliography', () => {
            const bibliography = formatter.generateBibliography(sampleSources, { style: 'apa' });

            expect(Array.isArray(bibliography)).toBe(true);
            expect(bibliography).toHaveLength(3);

            bibliography.forEach(entry => {
                expect(entry).toHaveProperty('id');
                expect(entry).toHaveProperty('reference');
                expect(entry).toHaveProperty('source');
                expect(entry).toHaveProperty('sortKey');
            });
        });

        test('should generate bibliography text', () => {
            const bibliographyText = formatter.generateBibliographyText(sampleSources, { style: 'apa' });

            expect(typeof bibliographyText).toBe('string');
            expect(bibliographyText.length).toBeGreaterThan(0);
            expect(bibliographyText).toContain('Smith');
            expect(bibliographyText).toContain('Johnson');
            expect(bibliographyText).toContain('Wilson');
        });

        test('should validate citation sources', () => {
            const validSource = sampleSources[0];
            const invalidSource = { id: '', title: '', authors: [] };

            const validResult = formatter.validateSource(validSource);
            const invalidResult = formatter.validateSource(invalidSource);

            expect(validResult.valid).toBe(true);
            expect(validResult.errors).toHaveLength(0);

            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);
        });
    });

    describe('APA Style', () => {
        test('should format APA in-text citation', () => {
            const apaStyle = new APAStyle();
            const inText = apaStyle.formatInText([sampleSources[0]]);

            expect(inText).toContain('Smith');
            expect(inText).toContain('2023');
            expect(inText).toMatch(/\(.*\)/); // Should be in parentheses
        });

        test('should format APA reference', () => {
            const apaStyle = new APAStyle();
            const reference = apaStyle.formatReference(sampleSources[0]);

            expect(reference).toContain('Smith, J. A.');
            expect(reference).toContain('(2023)');
            expect(reference).toContain('The Impact of Technology on Modern Education');
            expect(reference).toContain('Educational Technology Review');
        });

        test('should format APA authors correctly', () => {
            const apaStyle = new APAStyle();

            // Single author
            const singleAuthor = apaStyle.formatAuthors([sampleSources[0].authors[0]]);
            expect(singleAuthor).toBe('Smith, J. A.');

            // Multiple authors
            const multipleAuthors = apaStyle.formatAuthors(sampleSources[1].authors);
            expect(multipleAuthors).toContain('Johnson, M.');
            expect(multipleAuthors).toContain('Brown, R.');
            expect(multipleAuthors).toContain('&');
        });
    });

    describe('MLA Style', () => {
        test('should format MLA in-text citation', () => {
            const mlaStyle = new MLAStyle();
            const inText = mlaStyle.formatInText([sampleSources[0]]);

            expect(inText).toContain('Smith');
            expect(inText).toMatch(/\(.*\)/); // Should be in parentheses
        });

        test('should format MLA reference', () => {
            const mlaStyle = new MLAStyle();
            const reference = mlaStyle.formatReference(sampleSources[0]);

            expect(reference).toContain('Smith, John A.');
            expect(reference).toContain('"The Impact of Technology on Modern Education."');
            expect(reference).toContain('Educational Technology Review');
        });

        test('should format MLA authors correctly', () => {
            const mlaStyle = new MLAStyle();

            // Single author
            const singleAuthor = mlaStyle.formatAuthors([sampleSources[0].authors[0]]);
            expect(singleAuthor).toContain('Smith, John A.');

            // Multiple authors
            const multipleAuthors = mlaStyle.formatAuthors(sampleSources[1].authors);
            expect(multipleAuthors).toContain('Johnson, Mary');
            expect(multipleAuthors).toContain('and Robert Brown');
        });
    });

    describe('Chicago Style', () => {
        test('should format Chicago footnote citation', () => {
            const chicagoStyle = new ChicagoStyle();
            const footnote = chicagoStyle.formatFootnoteReference(sampleSources[0]);

            expect(footnote).toContain('John A. Smith');
            expect(footnote).toContain('"The Impact of Technology on Modern Education,"');
        });

        test('should format Chicago bibliography reference', () => {
            const chicagoStyle = new ChicagoStyle();
            const reference = chicagoStyle.formatReference(sampleSources[0]);

            expect(reference).toContain('Smith, John A.');
            expect(reference).toContain('"The Impact of Technology on Modern Education."');
            expect(reference).toContain('Educational Technology Review');
        });

        test('should format Chicago authors correctly', () => {
            const chicagoStyle = new ChicagoStyle();

            // Single author
            const singleAuthor = chicagoStyle.formatAuthors([sampleSources[0].authors[0]]);
            expect(singleAuthor).toContain('Smith, John A.');

            // Multiple authors
            const multipleAuthors = chicagoStyle.formatAuthors(sampleSources[1].authors);
            expect(multipleAuthors).toContain('Johnson, Mary');
            expect(multipleAuthors).toContain('and Robert Brown');
        });
    });

    describe('CitationUtils', () => {
        test('should format author names correctly', () => {
            const author = { firstName: 'John', lastName: 'Smith', middleName: 'A.' };

            expect(CitationUtils.formatAuthorName(author, 'first-last')).toBe('John A. Smith');
            expect(CitationUtils.formatAuthorName(author, 'last-first')).toBe('Smith, John A.');
            expect(CitationUtils.formatAuthorName(author, 'initials')).toBe('Smith, J. A.');
        });

        test('should convert title case correctly', () => {
            const title = 'the impact of technology on modern education';

            expect(CitationUtils.convertTitleCase(title, 'title')).toBe('The Impact Of Technology On Modern Education');
            expect(CitationUtils.convertTitleCase(title, 'sentence')).toBe('The impact of technology on modern education');
            expect(CitationUtils.convertTitleCase(title, 'preserve')).toBe(title);
        });

        test('should format page ranges correctly', () => {
            expect(CitationUtils.formatPageRange('123-145')).toBe('123-145');
            expect(CitationUtils.formatPageRange('123–145')).toBe('123–145');
            expect(CitationUtils.formatPageRange('123')).toBe('123');
        });

        test('should format DOI URLs correctly', () => {
            expect(CitationUtils.formatDoiUrl('10.1234/example')).toBe('https://doi.org/10.1234/example');
            expect(CitationUtils.formatDoiUrl('https://doi.org/10.1234/example')).toBe('https://doi.org/10.1234/example');
        });

        test('should format access dates correctly', () => {
            const date = new Date('2023-05-15');

            expect(CitationUtils.formatAccessDate(date, 'iso')).toBe('2023-05-15');
            expect(CitationUtils.formatAccessDate(date, 'us')).toContain('May');
            expect(CitationUtils.formatAccessDate(date, 'uk')).toContain('May');
        });

        test('should truncate authors correctly', () => {
            const authors = [
                { firstName: 'John', lastName: 'Smith' },
                { firstName: 'Jane', lastName: 'Doe' },
                { firstName: 'Bob', lastName: 'Johnson' },
                { firstName: 'Alice', lastName: 'Brown' }
            ];

            const result = CitationUtils.truncateAuthors(authors, 2, true);
            expect(result.authors).toHaveLength(2);
            expect(result.hasMore).toBe(true);

            const noTruncate = CitationUtils.truncateAuthors(authors, 5, true);
            expect(noTruncate.authors).toHaveLength(4);
            expect(noTruncate.hasMore).toBe(false);
        });
    });

    describe('Quick Format Functions', () => {
        test('should format citation quickly', () => {
            const result = formatCitation(sampleSources[0], 'apa');

            expect(result).toHaveProperty('inText');
            expect(result).toHaveProperty('fullReference');
            expect(result.style).toBe('apa');
        });

        test('should format bibliography quickly', () => {
            const result = formatBibliography(sampleSources, 'mla');

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle unknown citation style', () => {
            expect(() => {
                formatter.formatCitation(sampleSources[0], { style: 'unknown' });
            }).toThrow();
        });

        test('should handle empty sources array', () => {
            const bibliography = formatter.generateBibliography([]);
            expect(bibliography).toHaveLength(0);

            const bibliographyText = formatter.generateBibliographyText([]);
            expect(bibliographyText).toBe('');
        });

        test('should handle invalid source data', () => {
            const invalidSource = { id: 'invalid' };
            const validation = formatter.validateSource(invalidSource);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });
});