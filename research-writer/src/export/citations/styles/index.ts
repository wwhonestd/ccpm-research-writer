/**
 * Citation Styles Index
 * Exports all available citation styles
 */

import APAStyle from './APAStyle.js';
import MLAStyle from './MLAStyle.js';
import ChicagoStyle from './ChicagoStyle.js';

export { APAStyle, MLAStyle, ChicagoStyle };

/**
 * Registry of all available citation styles
 */
export const CITATION_STYLE_REGISTRY = {
    apa: APAStyle,
    mla: MLAStyle,
    chicago: ChicagoStyle
};

/**
 * Get a citation style instance by name
 */
export function getCitationStyle(styleName: string) {
    const StyleClass = CITATION_STYLE_REGISTRY[styleName.toLowerCase()];
    if (!StyleClass) {
        throw new Error(`Citation style '${styleName}' is not available. Available styles: ${Object.keys(CITATION_STYLE_REGISTRY).join(', ')}`);
    }
    return new StyleClass();
}

/**
 * Get all available style names
 */
export function getAvailableStyles(): string[] {
    return Object.keys(CITATION_STYLE_REGISTRY);
}

export default {
    APAStyle,
    MLAStyle,
    ChicagoStyle,
    CITATION_STYLE_REGISTRY,
    getCitationStyle,
    getAvailableStyles
};