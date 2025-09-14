/**
 * Design System Core
 * Centralized design system for consistent UI components
 */

import { performanceMonitor } from '../../performance/monitor.js';

export class DesignSystem {
    constructor() {
        this.tokens = this.loadDesignTokens();
        this.components = new Map();
        this.themes = new Map();
        this.breakpoints = this.tokens.breakpoints;

        this.init();
    }

    init() {
        this.setupCSS();
        this.setupGlobalStyles();
        this.registerBaseComponents();
    }

    loadDesignTokens() {
        return {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a'
                },
                neutral: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    200: '#e5e7eb',
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827'
                },
                semantic: {
                    success: '#10b981',
                    warning: '#f59e0b',
                    error: '#ef4444',
                    info: '#3b82f6'
                }
            },
            typography: {
                fontFamily: {
                    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
                },
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    base: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem',
                    '2xl': '1.5rem',
                    '3xl': '1.875rem',
                    '4xl': '2.25rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                },
                lineHeight: {
                    none: '1',
                    tight: '1.25',
                    normal: '1.5',
                    relaxed: '1.75'
                }
            },
            spacing: {
                0: '0',
                1: '0.25rem',
                2: '0.5rem',
                3: '0.75rem',
                4: '1rem',
                5: '1.25rem',
                6: '1.5rem',
                8: '2rem',
                10: '2.5rem',
                12: '3rem',
                16: '4rem',
                20: '5rem',
                24: '6rem'
            },
            borderRadius: {
                none: '0',
                sm: '0.125rem',
                base: '0.25rem',
                md: '0.375rem',
                lg: '0.5rem',
                xl: '0.75rem',
                full: '9999px'
            },
            shadows: {
                sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
            },
            breakpoints: {
                sm: '640px',
                md: '768px',
                lg: '1024px',
                xl: '1280px',
                '2xl': '1536px'
            },
            animation: {
                durations: {
                    fast: '150ms',
                    normal: '250ms',
                    slow: '350ms'
                },
                easings: {
                    ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
                    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
                    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
                    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
                }
            }
        };
    }

    setupCSS() {
        if (!document.getElementById('design-system-vars')) {
            const style = document.createElement('style');
            style.id = 'design-system-vars';
            style.textContent = this.generateCSSVariables();
            document.head.appendChild(style);
        }
    }

    generateCSSVariables() {
        let css = ':root {\n';

        // Colors
        Object.entries(this.tokens.colors).forEach(([category, colors]) => {
            if (typeof colors === 'object') {
                Object.entries(colors).forEach(([shade, value]) => {
                    css += `  --color-${category}-${shade}: ${value};\n`;
                });
            } else {
                css += `  --color-${category}: ${colors};\n`;
            }
        });

        // Typography
        Object.entries(this.tokens.typography).forEach(([property, values]) => {
            Object.entries(values).forEach(([key, value]) => {
                css += `  --${property.replace(/([A-Z])/g, '-$1').toLowerCase()}-${key}: ${value};\n`;
            });
        });

        // Spacing
        Object.entries(this.tokens.spacing).forEach(([key, value]) => {
            css += `  --spacing-${key}: ${value};\n`;
        });

        // Border radius
        Object.entries(this.tokens.borderRadius).forEach(([key, value]) => {
            css += `  --radius-${key}: ${value};\n`;
        });

        // Shadows
        Object.entries(this.tokens.shadows).forEach(([key, value]) => {
            css += `  --shadow-${key}: ${value};\n`;
        });

        // Animation
        Object.entries(this.tokens.animation).forEach(([category, values]) => {
            Object.entries(values).forEach(([key, value]) => {
                css += `  --animation-${category.slice(0, -1)}-${key}: ${value};\n`;
            });
        });

        css += '}\n';
        return css;
    }

    setupGlobalStyles() {
        if (!document.getElementById('design-system-global')) {
            const style = document.createElement('style');
            style.id = 'design-system-global';
            style.textContent = `
                /* Global Reset and Base Styles */
                *, *::before, *::after {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--font-family-sans);
                    font-size: var(--font-size-base);
                    line-height: var(--line-height-normal);
                    color: var(--color-neutral-800);
                    background-color: var(--color-neutral-50);
                    margin: 0;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }

                /* Focus styles */
                :focus {
                    outline: 2px solid var(--color-primary-500);
                    outline-offset: 2px;
                }

                :focus:not(:focus-visible) {
                    outline: none;
                }

                /* Reduced motion preferences */
                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }

                /* High contrast mode support */
                @media (prefers-contrast: high) {
                    :root {
                        --color-neutral-50: #ffffff;
                        --color-neutral-900: #000000;
                    }
                }

                /* Dark mode support */
                @media (prefers-color-scheme: dark) {
                    :root {
                        --color-neutral-50: #111827;
                        --color-neutral-100: #1f2937;
                        --color-neutral-200: #374151;
                        --color-neutral-800: #f3f4f6;
                        --color-neutral-900: #f9fafb;
                    }

                    body {
                        color: var(--color-neutral-800);
                        background-color: var(--color-neutral-50);
                    }
                }

                /* Performance optimizations */
                .will-change-transform {
                    will-change: transform;
                }

                .will-change-opacity {
                    will-change: opacity;
                }

                .gpu-accelerated {
                    transform: translate3d(0, 0, 0);
                }
            `;
            document.head.appendChild(style);
        }
    }

    registerBaseComponents() {
        // Button component
        this.registerComponent('button', {
            base: `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: var(--radius-md);
                font-family: var(--font-family-sans);
                font-weight: var(--font-weight-medium);
                text-decoration: none;
                cursor: pointer;
                transition: all var(--animation-duration-normal) var(--animation-easing-ease);
                user-select: none;
            `,
            variants: {
                size: {
                    sm: `
                        padding: var(--spacing-2) var(--spacing-3);
                        font-size: var(--font-size-sm);
                    `,
                    md: `
                        padding: var(--spacing-3) var(--spacing-4);
                        font-size: var(--font-size-base);
                    `,
                    lg: `
                        padding: var(--spacing-4) var(--spacing-6);
                        font-size: var(--font-size-lg);
                    `
                },
                variant: {
                    primary: `
                        background-color: var(--color-primary-600);
                        color: white;
                    `,
                    secondary: `
                        background-color: var(--color-neutral-100);
                        color: var(--color-neutral-900);
                        border: 1px solid var(--color-neutral-300);
                    `,
                    ghost: `
                        background-color: transparent;
                        color: var(--color-primary-600);
                    `
                }
            },
            states: {
                hover: {
                    primary: 'background-color: var(--color-primary-700);',
                    secondary: 'background-color: var(--color-neutral-200);',
                    ghost: 'background-color: var(--color-primary-50);'
                },
                active: {
                    primary: 'background-color: var(--color-primary-800);',
                    secondary: 'background-color: var(--color-neutral-300);',
                    ghost: 'background-color: var(--color-primary-100);'
                },
                disabled: `
                    opacity: 0.5;
                    cursor: not-allowed;
                    pointer-events: none;
                `
            }
        });

        // Input component
        this.registerComponent('input', {
            base: `
                width: 100%;
                border: 1px solid var(--color-neutral-300);
                border-radius: var(--radius-md);
                padding: var(--spacing-3) var(--spacing-4);
                font-family: var(--font-family-sans);
                font-size: var(--font-size-base);
                background-color: white;
                transition: border-color var(--animation-duration-normal) var(--animation-easing-ease);
            `,
            states: {
                focus: `
                    border-color: var(--color-primary-500);
                    box-shadow: 0 0 0 1px var(--color-primary-500);
                `,
                error: `
                    border-color: var(--color-semantic-error);
                `,
                disabled: `
                    background-color: var(--color-neutral-100);
                    cursor: not-allowed;
                `
            }
        });

        // Card component
        this.registerComponent('card', {
            base: `
                background-color: white;
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-base);
                overflow: hidden;
            `,
            variants: {
                padding: {
                    none: 'padding: 0;',
                    sm: 'padding: var(--spacing-4);',
                    md: 'padding: var(--spacing-6);',
                    lg: 'padding: var(--spacing-8);'
                },
                elevation: {
                    low: 'box-shadow: var(--shadow-sm);',
                    medium: 'box-shadow: var(--shadow-base);',
                    high: 'box-shadow: var(--shadow-lg);'
                }
            }
        });
    }

    registerComponent(name, definition) {
        this.components.set(name, definition);
    }

    getComponent(name) {
        return this.components.get(name);
    }

    generateComponentCSS(componentName, variants = {}, states = []) {
        const component = this.getComponent(componentName);
        if (!component) {
            console.warn(`Component "${componentName}" not found in design system`);
            return '';
        }

        let css = component.base;

        // Apply variants
        if (component.variants) {
            Object.entries(variants).forEach(([variantType, variantValue]) => {
                if (component.variants[variantType] && component.variants[variantType][variantValue]) {
                    css += component.variants[variantType][variantValue];
                }
            });
        }

        // Apply states
        if (component.states) {
            states.forEach(state => {
                if (component.states[state]) {
                    if (typeof component.states[state] === 'string') {
                        css += component.states[state];
                    } else {
                        // State depends on variant
                        const currentVariant = variants.variant;
                        if (currentVariant && component.states[state][currentVariant]) {
                            css += component.states[state][currentVariant];
                        }
                    }
                }
            });
        }

        return css;
    }

    createElement(tagName, componentName, variants = {}, states = [], children = []) {
        performanceMonitor.startTimer('design-system-create-element');

        const element = document.createElement(tagName);

        // Add CSS class for the component
        const className = this.generateClassName(componentName, variants, states);
        element.className = className;

        // Apply inline styles (for dynamic styling)
        const css = this.generateComponentCSS(componentName, variants, states);
        if (css) {
            element.style.cssText += css;
        }

        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });

        performanceMonitor.endTimer('design-system-create-element');
        return element;
    }

    generateClassName(componentName, variants, states) {
        let className = `ds-${componentName}`;

        // Add variant classes
        Object.entries(variants).forEach(([variantType, variantValue]) => {
            className += ` ds-${componentName}-${variantType}-${variantValue}`;
        });

        // Add state classes
        states.forEach(state => {
            className += ` ds-${componentName}-${state}`;
        });

        return className;
    }

    // Utility methods
    getColor(path) {
        return this.getTokenValue('colors', path);
    }

    getSpacing(value) {
        return this.tokens.spacing[value] || value;
    }

    getFontSize(size) {
        return this.tokens.typography.fontSize[size] || size;
    }

    getTokenValue(category, path) {
        const keys = path.split('.');
        let value = this.tokens[category];

        for (const key of keys) {
            value = value[key];
            if (value === undefined) break;
        }

        return value;
    }

    // Theme management
    setTheme(themeName, themeTokens) {
        this.themes.set(themeName, themeTokens);
    }

    applyTheme(themeName) {
        const theme = this.themes.get(themeName);
        if (!theme) {
            console.warn(`Theme "${themeName}" not found`);
            return;
        }

        // Generate CSS variables for the theme
        let css = ':root {\n';
        this.flattenObject(theme).forEach(([key, value]) => {
            css += `  --${key}: ${value};\n`;
        });
        css += '}\n';

        // Apply theme styles
        let themeStyle = document.getElementById(`theme-${themeName}`);
        if (!themeStyle) {
            themeStyle = document.createElement('style');
            themeStyle.id = `theme-${themeName}`;
            document.head.appendChild(themeStyle);
        }
        themeStyle.textContent = css;
    }

    flattenObject(obj, prefix = '') {
        const flattened = [];

        Object.entries(obj).forEach(([key, value]) => {
            const newKey = prefix ? `${prefix}-${key}` : key;

            if (typeof value === 'object' && value !== null) {
                flattened.push(...this.flattenObject(value, newKey));
            } else {
                flattened.push([newKey.replace(/([A-Z])/g, '-$1').toLowerCase(), value]);
            }
        });

        return flattened;
    }

    // Performance optimizations
    preloadComponents(componentNames) {
        componentNames.forEach(name => {
            const component = this.getComponent(name);
            if (component) {
                // Pre-generate common CSS combinations
                const commonVariants = this.getCommonVariants(name);
                commonVariants.forEach(variants => {
                    this.generateComponentCSS(name, variants);
                });
            }
        });
    }

    getCommonVariants(componentName) {
        // Define common variant combinations for each component
        const commonVariants = {
            button: [
                { size: 'md', variant: 'primary' },
                { size: 'md', variant: 'secondary' },
                { size: 'sm', variant: 'ghost' }
            ],
            card: [
                { padding: 'md', elevation: 'medium' },
                { padding: 'lg', elevation: 'high' }
            ]
        };

        return commonVariants[componentName] || [{}];
    }
}

// Create and export singleton instance
export const designSystem = new DesignSystem();

// Export convenience functions
export const createButton = (variants, states, children) =>
    designSystem.createElement('button', 'button', variants, states, children);

export const createInput = (variants, states, attributes = {}) => {
    const input = designSystem.createElement('input', 'input', variants, states);
    Object.entries(attributes).forEach(([key, value]) => {
        input.setAttribute(key, value);
    });
    return input;
};

export const createCard = (variants, states, children) =>
    designSystem.createElement('div', 'card', variants, states, children);

export const getColor = (path) => designSystem.getColor(path);
export const getSpacing = (value) => designSystem.getSpacing(value);
export const getFontSize = (size) => designSystem.getFontSize(size);