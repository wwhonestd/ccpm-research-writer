/**
 * APA Citation Style Implementation
 * Implements APA 7th Edition citation formatting
 */

import { CitationStyle, CitationSource, Author, CitationOptions, CITATION_TYPES } from '../CitationFormatter.js';
import { CitationUtils } from '../CitationFormatter.js';

export class APAStyle extends CitationStyle {
    readonly name = 'American Psychological Association (7th Edition)';
    readonly shortName = 'apa';

    /**
     * Format in-text citation according to APA style
     */
    formatInText(sources: CitationSource[], options?: Partial<CitationOptions>): string {
        if (!sources.length) return '';

        if (sources.length === 1) {
            return this.formatSingleInText(sources[0], options);
        }

        // Multiple sources - sort alphabetically and separate with semicolons
        const formatted = sources
            .sort((a, b) => {
                const aAuthor = a.authors[0]?.lastName || '';
                const bAuthor = b.authors[0]?.lastName || '';
                return aAuthor.localeCompare(bAuthor);
            })
            .map(source => this.formatSingleInText(source, options, false))
            .join('; ');

        return `(${formatted})`;
    }

    /**
     * Format single in-text citation
     */
    private formatSingleInText(source: CitationSource, options?: Partial<CitationOptions>, includeParentheses: boolean = true): string {
        const { maxAuthors = 7, useEtAl = true } = options || {};

        let result = '';

        // Format authors for in-text citation
        if (source.authors.length === 1) {
            result = source.authors[0].lastName;
        } else if (source.authors.length === 2) {
            result = `${source.authors[0].lastName} & ${source.authors[1].lastName}`;
        } else if (source.authors.length >= 3) {
            if (useEtAl && source.authors.length > maxAuthors) {
                result = `${source.authors[0].lastName} et al.`;
            } else if (source.authors.length <= 20) {
                const lastAuthor = source.authors[source.authors.length - 1];
                const otherAuthors = source.authors.slice(0, -1);
                result = `${otherAuthors.map(a => a.lastName).join(', ')}, & ${lastAuthor.lastName}`;
            } else {
                // For 21+ authors, use first 19, then "..." then last author
                const first19 = source.authors.slice(0, 19);
                const lastAuthor = source.authors[source.authors.length - 1];
                result = `${first19.map(a => a.lastName).join(', ')}, ... ${lastAuthor.lastName}`;
            }
        }

        // Add year
        const year = source.year ? source.year.toString() : 'n.d.';
        result += `, ${year}`;

        return includeParentheses ? `(${result})` : result;
    }

    /**
     * Format full reference for bibliography
     */
    formatReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        const { includeUrl = true, includeDoiUrl = true } = options || {};

        let reference = '';

        // Format authors
        reference += this.formatAuthors(source.authors, 20, true);

        // Format year
        const year = source.year ? source.year.toString() : 'n.d.';
        reference += ` (${year}). `;

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
        } else if (includeUrl && source.url && source.type === CITATION_TYPES.WEBSITE) {
            reference += ` ${source.url}`;
        }

        return reference.trim();
    }

    /**
     * Format authors according to APA style
     */
    formatAuthors(authors: Author[], maxAuthors: number = 20, useEtAl: boolean = true): string {
        if (!authors.length) return '';

        if (authors.length === 1) {
            return CitationUtils.formatAuthorName(authors[0], 'last-first-middle');
        }

        if (authors.length >= 2 && authors.length <= 20) {
            const lastAuthor = authors[authors.length - 1];
            const otherAuthors = authors.slice(0, -1);
            const formattedOthers = otherAuthors.map(author =>
                CitationUtils.formatAuthorName(author, 'last-first-middle')
            ).join(', ');
            const formattedLast = CitationUtils.formatAuthorName(lastAuthor, 'last-first-middle');
            return `${formattedOthers}, & ${formattedLast}`;
        }

        if (authors.length >= 21) {
            // For 21+ authors, list first 19, insert ellipsis, then add final author
            const first19 = authors.slice(0, 19);
            const lastAuthor = authors[authors.length - 1];
            const formattedFirst19 = first19.map(author =>
                CitationUtils.formatAuthorName(author, 'last-first-middle')
            ).join(', ');
            const formattedLast = CitationUtils.formatAuthorName(lastAuthor, 'last-first-middle');
            return `${formattedFirst19}, ... ${formattedLast}`;
        }

        return authors.map(author =>
            CitationUtils.formatAuthorName(author, 'last-first-middle')
        ).join(', ');
    }

    /**
     * Format title according to APA style
     */
    formatTitle(title: string, titleCase: 'title' | 'sentence' | 'preserve' = 'sentence'): string {
        return CitationUtils.convertTitleCase(title, titleCase);
    }

    /**
     * Format book reference
     */
    private formatBookReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        if (source.edition && source.edition !== '1st' && source.edition !== '1') {
            ref += ` (${source.edition} ed.)`;
        }

        ref += '. ';

        if (source.publisher) {
            ref += source.publisher;
        }

        return ref;
    }

    /**
     * Format journal article reference
     */
    private formatJournalReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `${this.formatTitle(source.title)}. `;

        if (source.journal) {
            ref += `*${source.journal}*`;

            if (source.volume) {
                ref += `, *${source.volume}*`;

                if (source.issue) {
                    ref += `(${source.issue})`;
                }
            }

            if (source.pages) {
                ref += `, ${CitationUtils.formatPageRange(source.pages)}`;
            }

            ref += '.';
        }

        return ref;
    }

    /**
     * Format conference paper reference
     */
    private formatConferenceReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `${this.formatTitle(source.title)}`;

        if (source.conference) {
            ref += `. Paper presented at ${source.conference}`;

            if (source.conferenceLocation) {
                ref += `, ${source.conferenceLocation}`;
            }
        }

        ref += '.';
        return ref;
    }

    /**
     * Format thesis reference
     */
    private formatThesisReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `*${this.formatTitle(source.title)}*`;

        const degreeType = source.degreeType || 'thesis';
        ref += ` [${degreeType}`;

        if (source.institution) {
            ref += `, ${source.institution}`;
        }

        ref += '].';
        return ref;
    }

    /**
     * Format website reference
     */
    private formatWebsiteReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `${this.formatTitle(source.title)}`;

        if (source.siteName) {
            ref += `. *${source.siteName}*`;
        }

        if (source.accessDate) {
            ref += `. Retrieved ${CitationUtils.formatAccessDate(source.accessDate, 'us')}`;
        }

        ref += '.';
        return ref;
    }

    /**
     * Format chapter reference
     */
    private formatChapterReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        let ref = `${this.formatTitle(source.title)}`;

        if (source.bookTitle) {
            ref += `. In `;

            if (source.editors && source.editors.length > 0) {
                const editorsFormatted = source.editors.map(editor =>
                    CitationUtils.formatAuthorName(editor, 'first-last')
                ).join(', ');
                ref += `${editorsFormatted} (Ed${source.editors.length > 1 ? 's' : ''}.), `;
            }

            ref += `*${source.bookTitle}*`;

            if (source.pages) {
                ref += ` (pp. ${CitationUtils.formatPageRange(source.pages)})`;
            }

            ref += '.';

            if (source.publisher) {
                ref += ` ${source.publisher}`;
            }
        }

        return ref;
    }

    /**
     * Format generic reference for other types
     */
    private formatGenericReference(source: CitationSource, options?: Partial<CitationOptions>): string {
        return `${this.formatTitle(source.title)}.`;
    }

    /**
     * Get APA-specific bibliography configuration
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

export default APAStyle;