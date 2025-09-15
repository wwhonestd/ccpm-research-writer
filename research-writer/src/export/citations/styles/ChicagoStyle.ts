/**
 * Chicago Citation Style Implementation
 * Implements Chicago Manual of Style (17th Edition) - Notes-Bibliography style
 */

import { CitationStyle, CitationSource, Author, CitationOptions, CITATION_TYPES } from '../CitationFormatter.js';
import { CitationUtils } from '../CitationFormatter.js';

export class ChicagoStyle extends CitationStyle {
    readonly name = 'Chicago Manual of Style (17th Edition)';
    readonly shortName = 'chicago';

    /**
     * Format in-text citation according to Chicago style (footnote format)
     */
    formatInText(sources: CitationSource[], options?: Partial<CitationOptions>): string {
        if (!sources.length) return '';

        // Chicago uses footnotes, so we return a superscript number reference
        // The actual formatting would be in footnotes
        return this.formatFootnoteReference(sources[0], options);
    }

    /**
     * Format footnote reference
     */
    formatFootnoteReference(source: CitationSource, options?: Partial<CitationOptions>, shortForm: boolean = false): string {
        const { includeUrl = true, includeDoiUrl = true } = options || {};

        let reference = '';

        if (shortForm) {
            // Short form for subsequent citations
            if (source.authors.length > 0) {
                reference += source.authors[0].lastName;
                if (source.authors.length > 1) {
                    reference += ' et al.';
                }
                reference += ', ';
            }

            reference += `"${this.formatTitle(source.title, 'title')}"`;

            if (source.pages) {
                reference += `, ${source.pages}`;
            }

            return reference;
        }

        // Full form for first citation
        reference += this.formatAuthorsForFootnote(source.authors);

        // Format based on source type
        switch (source.type) {
            case CITATION_TYPES.BOOK:
                reference += this.formatBookFootnote(source, options);
                break;
            case CITATION_TYPES.JOURNAL_ARTICLE:
                reference += this.formatJournalFootnote(source, options);
                break;
            case CITATION_TYPES.CONFERENCE_PAPER:
                reference += this.formatConferenceFootnote(source, options);
                break;
            case CITATION_TYPES.THESIS:
                reference += this.formatThesisFootnote(source, options);
                break;
            case CITATION_TYPES.WEBSITE:
                reference += this.formatWebsiteFootnote(source, options);
                break;
            case CITATION_TYPES.CHAPTER:
                reference += this.formatChapterFootnote(source, options);
                break;
            default:
                reference += this.formatGenericFootnote(source, options);
        }

        // Add DOI or URL
        if (includeDoiUrl && source.doi) {
            reference += `, ${CitationUtils.formatDoiUrl(source.doi)}`;
        } else if (includeUrl && source.url) {
            reference += `, ${source.url}`;
        }

        return reference.trim();
    }

    /**
     * Format full reference for bibliography
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

        // Add DOI or URL
        if (includeDoiUrl && source.doi) {
            reference += ` ${CitationUtils.formatDoiUrl(source.doi)}`;
        } else if (includeUrl && source.url) {
            reference += ` ${source.url}`;
        }

        // Add access date for web sources
        if (source.accessDate && (source.type === CITATION_TYPES.WEBSITE || source.url)) {
            reference += `. Accessed ${CitationUtils.formatAccessDate(source.accessDate, 'us')}`;
        }

        reference += '.';
        return reference.trim();
    }

    /**
     * Format authors according to Chicago style (bibliography)
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

        if (authors.length >= 3 && authors.length <= 10) {
            const lastAuthor = authors[authors.length - 1];
            const otherAuthors = authors.slice(0, -1);
            const formattedOthers = otherAuthors.map((author, index) =>
                index === 0
                    ? CitationUtils.formatAuthorName(author, 'last-first')
                    : CitationUtils.formatAuthorName(author, 'first-last')
            ).join(', ');
            const formattedLast = CitationUtils.formatAuthorName(lastAuthor, 'first-last');
            return `${formattedOthers}, and ${formattedLast}. `;
        }

        if (authors.length > 10) {
            const first = CitationUtils.formatAuthorName(authors[0], 'last-first');
            return `${first} et al. `;
        }

        return '';
    }

    /**
     * Format authors for footnotes (first name first)
     */
    private formatAuthorsForFootnote(authors: Author[]): string {
        if (!authors.length) return '';

        if (authors.length === 1) {
            return `${CitationUtils.formatAuthorName(authors[0], 'first-last')}, `;
        }

        if (authors.length === 2) {
            const first = CitationUtils.formatAuthorName(authors[0], 'first-last');
            const second = CitationUtils.formatAuthorName(authors[1], 'first-last');
            return `${first} and ${second}, `;
        }

        if (authors.length >= 3) {
            const first = CitationUtils.formatAuthorName(authors[0], 'first-last');
            return `${first} et al., `;
        }

        return '';
    }

    /**
     * Format title according to Chicago style
     */
    formatTitle(title: string, titleCase: 'title' | 'sentence' | 'preserve' = 'title'): string {
        return CitationUtils.convertTitleCase(title, titleCase);
    }

    /**
     * Format book reference for bibliography
     */
    private formatBookReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        if (source.edition && source.edition !== '1st' && source.edition !== '1') {
            ref += `. ${source.edition} ed.`;
        }

        if (source.publisherLocation && source.publisher) {
            ref += `. ${source.publisherLocation}: ${source.publisher}`;
        } else if (source.publisher) {
            ref += `. ${source.publisher}`;
        }

        if (source.year) {
            ref += `, ${source.year}`;
        }

        return ref;
    }

    /**
     * Format book footnote
     */
    private formatBookFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        if (source.edition && source.edition !== '1st' && source.edition !== '1') {
            ref += `, ${source.edition} ed.`;
        }

        if (source.publisherLocation && source.publisher) {
            ref += ` (${source.publisherLocation}: ${source.publisher}`;
        } else if (source.publisher) {
            ref += ` (${source.publisher}`;
        }

        if (source.year) {
            ref += `, ${source.year})`;
        } else {
            ref += ')';
        }

        if (source.pages) {
            ref += `, ${source.pages}`;
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
                ref += ` ${source.volume}`;
            }

            if (source.issue) {
                ref += `, no. ${source.issue}`;
            }

            if (source.year) {
                ref += ` (${source.year})`;
            }

            if (source.pages) {
                ref += `: ${CitationUtils.formatPageRange(source.pages)}`;
            }
        }

        return ref;
    }

    /**
     * Format journal footnote
     */
    private formatJournalFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)},"`;

        if (source.journal) {
            ref += ` *${source.journal}*`;

            if (source.volume) {
                ref += ` ${source.volume}`;
            }

            if (source.issue) {
                ref += `, no. ${source.issue}`;
            }

            if (source.year) {
                ref += ` (${source.year})`;
            }

            if (source.pages) {
                ref += `: ${CitationUtils.formatPageRange(source.pages)}`;
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
            ref += ` Paper presented at ${source.conference}`;

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
     * Format conference footnote
     */
    private formatConferenceFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        return this.formatConferenceReference(source, options);
    }

    /**
     * Format thesis reference
     */
    private formatThesisReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        const degreeType = source.degreeType || 'thesis';
        ref += ` ${degreeType}`;

        if (source.institution) {
            ref += `, ${source.institution}`;
        }

        if (source.year) {
            ref += `, ${source.year}`;
        }

        return ref;
    }

    /**
     * Format thesis footnote
     */
    private formatThesisFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        return this.formatThesisReference(source, options);
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
     * Format website footnote
     */
    private formatWebsiteFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        return this.formatWebsiteReference(source, options);
    }

    /**
     * Format chapter reference
     */
    private formatChapterReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)}."`;

        if (source.bookTitle) {
            ref += ` In *${source.bookTitle}*`;

            if (source.editors && source.editors.length > 0) {
                const editorsFormatted = source.editors.map(editor =>
                    CitationUtils.formatAuthorName(editor, 'first-last')
                ).join(' and ');
                ref += `, edited by ${editorsFormatted}`;
            }

            if (source.edition && source.edition !== '1st' && source.edition !== '1') {
                ref += `, ${source.edition} ed.`;
            }

            if (source.pages) {
                ref += `, ${CitationUtils.formatPageRange(source.pages)}`;
            }

            if (source.publisherLocation && source.publisher) {
                ref += `. ${source.publisherLocation}: ${source.publisher}`;
            } else if (source.publisher) {
                ref += `. ${source.publisher}`;
            }

            if (source.year) {
                ref += `, ${source.year}`;
            }
        }

        return ref;
    }

    /**
     * Format chapter footnote
     */
    private formatChapterFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `"${this.formatTitle(source.title)},"`;

        if (source.bookTitle) {
            ref += ` in *${source.bookTitle}*`;

            if (source.editors && source.editors.length > 0) {
                const editorsFormatted = source.editors.map(editor =>
                    CitationUtils.formatAuthorName(editor, 'first-last')
                ).join(' and ');
                ref += `, ed. ${editorsFormatted}`;
            }

            if (source.publisherLocation && source.publisher) {
                ref += ` (${source.publisherLocation}: ${source.publisher}`;
            } else if (source.publisher) {
                ref += ` (${source.publisher}`;
            }

            if (source.year) {
                ref += `, ${source.year})`;
            } else {
                ref += ')';
            }

            if (source.pages) {
                ref += `, ${source.pages}`;
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
     * Format generic footnote for other types
     */
    private formatGenericFootnote(source: CitationSource, options?: Partial<CitationOptions>): string {
        return this.formatGenericReference(source, options);
    }

    /**
     * Get Chicago-specific bibliography configuration
     */
    getBibliographyDefaults() {
        return {
            sortBy: 'author' as const,
            groupBy: 'none' as const,
            hangingIndent: true,
            spacing: 'single' as const
        };
    }
}

export default ChicagoStyle;