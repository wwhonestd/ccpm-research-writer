/**
 * Citations Module Index
 * Main export for the citation formatting system
 */

export {
    CitationFormatter,
    CitationStyle,
    CitationUtils,
    CITATION_TYPES,
    type CitationSource,
    type Author,
    type CitationOptions,
    type BibliographyConfig,
    type FormattedCitation,
    type BibliographyEntry
} from './CitationFormatter.js';

export {
    APAStyle,
    MLAStyle,
    ChicagoStyle,
    CITATION_STYLE_REGISTRY,
    getCitationStyle,
    getAvailableStyles
} from './styles/index.js';

import { CitationFormatter } from './CitationFormatter.js';
import { getCitationStyle, getAvailableStyles } from './styles/index.js';

/**
 * Create a pre-configured citation formatter with all styles registered
 */
export function createCitationFormatter(): CitationFormatter {
    const formatter = new CitationFormatter();

    // Register all available styles
    const availableStyles = getAvailableStyles();
    availableStyles.forEach(styleName => {
        const style = getCitationStyle(styleName);
        formatter.registerStyle(style);
    });

    return formatter;
}

/**
 * Quick format function for single citations
 */
export function formatCitation(source: any, style: string = 'apa', options?: any) {
    const formatter = createCitationFormatter();
    return formatter.formatCitation(source, { style, ...options });
}

/**
 * Quick format function for bibliography
 */
export function formatBibliography(sources: any[], style: string = 'apa', config?: any) {
    const formatter = createCitationFormatter();
    return formatter.generateBibliographyText(sources, { style, ...config });
}

export default {
    CitationFormatter,
    createCitationFormatter,
    formatCitation,
    formatBibliography,
    getCitationStyle,
    getAvailableStyles
};