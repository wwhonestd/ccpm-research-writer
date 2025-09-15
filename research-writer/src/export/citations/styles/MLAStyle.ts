/**
 * MLA Citation Style Implementation
 * Implements MLA 9th Edition citation formatting
 */

import { CitationStyle, CitationSource, Author, CitationOptions, CITATION_TYPES } from '../CitationFormatter.js';
import { CitationUtils } from '../CitationFormatter.js';

export class MLAStyle extends CitationStyle {
    readonly name = 'Modern Language Association (9th Edition)';
    readonly shortName = 'mla';

    /**
     * Format in-text citation according to MLA style
     */
    formatInText(sources: CitationSource[], options?: Partial<CitationOptions>): string {
        if (!sources.length) return '';

        if (sources.length === 1) {
            return this.formatSingleInText(sources[0], options);
        }

        // Multiple sources - separate with semicolons
        const formatted = sources
            .map(source => this.formatSingleInText(source, options, false))
            .join('; ');

        return `(${formatted})`;
    }

    /**
     * Format single in-text citation
     */
    private formatSingleInText(source: CitationSource, options?: Partial<CitationOptions>, includeParentheses: boolean = true): string {
        let result = '';

        // Format authors for in-text citation
        if (source.authors.length === 1) {
            result = source.authors[0].lastName;
        } else if (source.authors.length === 2) {
            result = `${source.authors[0].lastName} and ${source.authors[1].lastName}`;
        } else if (source.authors.length >= 3) {
            result = `${source.authors[0].lastName} et al.`;
        }

        // Add page numbers if available
        if (source.pages) {
            result += ` ${source.pages}`;
        }

        return includeParentheses ? `(${result})` : result;
    }

    /**
     * Format full reference for Works Cited
     */
    formatReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        const { includeUrl = true, includeDoiUrl = true } = options || {};

        let reference = '';

        // Format authors
        reference += this.formatAuthors(source.authors);

        // Format based on source type
        switch (source.type) {
            case CITATION_TYPES.BOOK:
                reference += this.formatBookReference(source, options);
                break;
            case CITATION_TYPES.JOURNAL_ARTICLE:
                reference += this.formatJournalReference(source, options);
                break;
            case CITATION_TYPES.CONFERENCE_PAPER:
                reference += this.formatConferenceReference(source, options);
                break;
            case CITATION_TYPES.THESIS:
                reference += this.formatThesisReference(source, options);
                break;
            case CITATION_TYPES.WEBSITE:
                reference += this.formatWebsiteReference(source, options);
                break;
            case CITATION_TYPES.CHAPTER:
                reference += this.formatChapterReference(source, options);
                break;
            default:
                reference += this.formatGenericReference(source, options);
        }

        // Add URL or DOI
        if (includeDoiUrl && source.doi) {
            reference += `, ${CitationUtils.formatDoiUrl(source.doi)}`;
        } else if (includeUrl && source.url) {
            reference += `, ${source.url}`;
        }

        // Add access date for web sources
        if (source.accessDate && (source.type === CITATION_TYPES.WEBSITE || source.url)) {
            reference += `. Accessed ${CitationUtils.formatAccessDate(source.accessDate, 'us')}`;
        }

        reference += '.';
        return reference.trim();
    }

    /**
     * Format authors according to MLA style
     */
    formatAuthors(authors: Author[]): string {
        if (!authors.length) return '';

        if (authors.length === 1) {
            return `${CitationUtils.formatAuthorName(authors[0], 'last-first')}. `;
        }

        if (authors.length === 2) {
            const first = CitationUtils.formatAuthorName(authors[0], 'last-first');
            const second = CitationUtils.formatAuthorName(authors[1], 'first-last');
            return `${first}, and ${second}. `;
        }

        if (authors.length >= 3) {
            const first = CitationUtils.formatAuthorName(authors[0], 'last-first');
            return `${first}, et al. `;
        }

        return '';
    }

    /**
     * Format title according to MLA style
     */
    formatTitle(title: string, titleCase: 'title' | 'sentence' | 'preserve' = 'title'): string {
        return CitationUtils.convertTitleCase(title, titleCase);
    }

    /**
     * Format book reference
     */
    private formatBookReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        if (source.edition && source.edition !== '1st' && source.edition !== '1') {
            ref += `, ${source.edition} ed.`;
        }

        if (source.publisher) {
            ref += `, ${source.publisher}`;
        }

        if (source.year) {
            ref += `, ${source.year}`;
        }

        return ref;
    }

    /**
     * Format journal article reference
     */
    private formatJournalReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.journal) {
            ref += ` *${source.journal}*`;

            if (source.volume) {
                ref += `, vol. ${source.volume}`;
            }

            if (source.issue) {
                ref += `, no. ${source.issue}`;
            }

            if (source.year) {
                ref += `, ${source.year}`;
            }

            if (source.pages) {
                ref += `, pp. ${CitationUtils.formatPageRange(source.pages)}`;
            }
        }

        return ref;
    }

    /**
     * Format conference paper reference
     */
    private formatConferenceReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.conference) {
            ref += ` *${source.conference}*`;

            if (source.conferenceLocation) {
                ref += `, ${source.conferenceLocation}`;
            }

            if (source.year) {
                ref += `, ${source.year}`;
            }
        }

        return ref;
    }

    /**
     * Format thesis reference
     */
    private formatThesisReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        if (source.year) {
            ref += `. ${source.year}`;
        }

        if (source.institution) {
            ref += `. ${source.institution}`;
        }

        const degreeType = source.degreeType || 'thesis';
        ref += `, ${degreeType}`;

        return ref;
    }

    /**
     * Format website reference
     */
    private formatWebsiteReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.siteName) {
            ref += ` *${source.siteName}*`;
        }

        if (source.year) {
            ref += `, ${source.year}`;
        }

        return ref;
    }

    /**
     * Format chapter reference
     */
    private formatChapterReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.bookTitle) {
            ref += ` *${source.bookTitle}*`;

            if (source.editors && source.editors.length > 0) {
                const editorsFormatted = source.editors.map(editor =>
                    CitationUtils.formatAuthorName(editor, 'first-last')
                ).join(' and ');
                ref += `, edited by ${editorsFormatted}`;
            }

            if (source.edition && source.edition !== '1st' && source.edition !== '1') {
                ref += `, ${source.edition} ed.`;
            }

            if (source.publisher) {
                ref += `, ${source.publisher}`;
            }

            if (source.year) {
                ref += `, ${source.year}`;
            }

            if (source.pages) {
                ref += `, pp. ${CitationUtils.formatPageRange(source.pages)}`;
            }
        }

        return ref;
    }

    /**
     * Format generic reference for other types
     */
    private formatGenericReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.year) {
            ref += ` ${source.year}`;
        }

        return ref;
    }

    /**
     * Get MLA-specific bibliography configuration
     */
    getBibliographyDefaults() {
        return {
            sortBy: 'author' as const,
            groupBy: 'none' as const,
            hangingIndent: true,
            spacing: 'double' as const
        };
    }
}

export default MLAStyle;