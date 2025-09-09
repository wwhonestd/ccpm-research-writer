/**
 * Research Writer - Utility Helper Functions
 * Common utility functions for the application
 */

const ResearchWriterUtils = {
    
    /**
     * DOM manipulation utilities
     */
    dom: {
        /**
         * Find element with better error handling
         */
        find(selector, context = document) {
            try {
                return context.querySelector(selector);
            } catch (error) {
                console.warn(`Invalid selector: ${selector}`, error);
                return null;
            }
        },
        
        /**
         * Find all elements with better error handling
         */
        findAll(selector, context = document) {
            try {
                return Array.from(context.querySelectorAll(selector));
            } catch (error) {
                console.warn(`Invalid selector: ${selector}`, error);
                return [];
            }
        },
        
        /**
         * Add class with existence check
         */
        addClass(element, className) {
            if (element && typeof className === 'string') {
                element.classList.add(className);
            }
        },
        
        /**
         * Remove class with existence check
         */
        removeClass(element, className) {
            if (element && typeof className === 'string') {
                element.classList.remove(className);
            }
        },
        
        /**
         * Toggle class with existence check
         */
        toggleClass(element, className, force) {
            if (element && typeof className === 'string') {
                return element.classList.toggle(className, force);
            }
            return false;
        },
        
        /**
         * Set multiple attributes at once
         */
        setAttributes(element, attributes) {
            if (!element || !attributes) return;
            
            Object.keys(attributes).forEach(key => {
                element.setAttribute(key, attributes[key]);
            });
        },
        
        /**
         * Create element with attributes and content
         */
        createElement(tag, attributes = {}, content = '') {
            const element = document.createElement(tag);
            
            this.setAttributes(element, attributes);
            
            if (content) {
                if (typeof content === 'string') {
                    element.textContent = content;
                } else if (content instanceof Node) {
                    element.appendChild(content);
                }
            }
            
            return element;
        },
        
        /**
         * Check if element is visible
         */
        isVisible(element) {
            if (!element) return false;
            
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        }
    },
    
    /**
     * Event handling utilities
     */
    events: {
        /**
         * Add event listener with options
         */
        on(element, event, handler, options = {}) {
            if (element && typeof handler === 'function') {
                element.addEventListener(event, handler, options);
            }
        },
        
        /**
         * Remove event listener
         */
        off(element, event, handler, options = {}) {
            if (element && typeof handler === 'function') {
                element.removeEventListener(event, handler, options);
            }
        },
        
        /**
         * Add event listener that fires once
         */
        once(element, event, handler) {
            this.on(element, event, handler, { once: true });
        },
        
        /**
         * Debounce function execution
         */
        debounce(func, wait, immediate = false) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    timeout = null;
                    if (!immediate) func.apply(this, args);
                };
                const callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(this, args);
            };
        },
        
        /**
         * Throttle function execution
         */
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        /**
         * Emit custom event
         */
        emit(element, eventName, detail = {}) {
            if (!element) return false;
            
            const event = new CustomEvent(eventName, {
                detail,
                bubbles: true,
                cancelable: true
            });
            
            return element.dispatchEvent(event);
        }
    },
    
    /**
     * Validation utilities
     */
    validation: {
        /**
         * Check if value is empty
         */
        isEmpty(value) {
            return value == null || 
                   value === '' || 
                   (Array.isArray(value) && value.length === 0) ||
                   (typeof value === 'object' && Object.keys(value).length === 0);
        },
        
        /**
         * Check if string is valid email
         */
        isEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        
        /**
         * Check if string is valid URL
         */
        isUrl(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        },
        
        /**
         * Sanitize HTML string
         */
        sanitizeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    },
    
    /**
     * String utilities
     */
    string: {
        /**
         * Convert string to kebab-case
         */
        kebabCase(str) {
            return str
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/\s+/g, '-')
                .toLowerCase();
        },
        
        /**
         * Convert string to camelCase
         */
        camelCase(str) {
            return str
                .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
        },
        
        /**
         * Capitalize first letter
         */
        capitalize(str) {
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },
        
        /**
         * Truncate string with ellipsis
         */
        truncate(str, length, suffix = '...') {
            if (str.length <= length) return str;
            return str.substring(0, length - suffix.length) + suffix;
        },
        
        /**
         * Generate random string
         */
        random(length = 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    },
    
    /**
     * Array utilities
     */
    array: {
        /**
         * Remove item from array
         */
        remove(array, item) {
            const index = array.indexOf(item);
            if (index > -1) {
                array.splice(index, 1);
            }
            return array;
        },
        
        /**
         * Get unique values from array
         */
        unique(array) {
            return [...new Set(array)];
        },
        
        /**
         * Shuffle array
         */
        shuffle(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        },
        
        /**
         * Chunk array into smaller arrays
         */
        chunk(array, size) {
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        }
    },
    
    /**
     * Storage utilities
     */
    storage: {
        /**
         * Set item in localStorage with error handling
         */
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn('Failed to save to localStorage:', error);
                return false;
            }
        },
        
        /**
         * Get item from localStorage with error handling
         */
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('Failed to read from localStorage:', error);
                return defaultValue;
            }
        },
        
        /**
         * Remove item from localStorage
         */
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('Failed to remove from localStorage:', error);
                return false;
            }
        },
        
        /**
         * Clear all localStorage
         */
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
                return false;
            }
        }
    },
    
    /**
     * Accessibility utilities
     */
    a11y: {
        /**
         * Announce message to screen readers
         */
        announce(message, priority = 'polite') {
            const announcer = this.getAnnouncer(priority);
            if (announcer) {
                announcer.textContent = message;
                
                // Clear after delay to allow re-announcement
                setTimeout(() => {
                    announcer.textContent = '';
                }, 1000);
            }
        },
        
        /**
         * Get or create screen reader announcer
         */
        getAnnouncer(priority = 'polite') {
            const id = `announcer-${priority}`;
            let announcer = document.getElementById(id);
            
            if (!announcer) {
                announcer = document.createElement('div');
                announcer.id = id;
                announcer.className = 'sr-only';
                announcer.setAttribute('aria-live', priority);
                announcer.setAttribute('aria-atomic', 'true');
                document.body.appendChild(announcer);
            }
            
            return announcer;
        },
        
        /**
         * Get focusable elements within container
         */
        getFocusableElements(container = document) {
            const selector = [
                'a[href]',
                'button:not([disabled])',
                'input:not([disabled])',
                'textarea:not([disabled])',
                'select:not([disabled])',
                'details',
                '[tabindex]:not([tabindex="-1"])'
            ].join(', ');
            
            return Array.from(container.querySelectorAll(selector))
                .filter(el => this.isVisible(el));
        },
        
        /**
         * Check if element is visible for screen readers
         */
        isVisible(element) {
            return !!(
                element.offsetWidth ||
                element.offsetHeight ||
                element.getClientRects().length
            );
        },
        
        /**
         * Trap focus within container
         */
        trapFocus(container, firstFocusable, lastFocusable) {
            const focusableElements = this.getFocusableElements(container);
            if (focusableElements.length === 0) return;
            
            const first = firstFocusable || focusableElements[0];
            const last = lastFocusable || focusableElements[focusableElements.length - 1];
            
            function handleTabKey(event) {
                if (event.key !== 'Tab') return;
                
                if (event.shiftKey) {
                    if (document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            }
            
            container.addEventListener('keydown', handleTabKey);
            
            // Return function to remove trap
            return () => {
                container.removeEventListener('keydown', handleTabKey);
            };
        }
    },
    
    /**
     * Animation utilities
     */
    animation: {
        /**
         * Check if user prefers reduced motion
         */
        prefersReducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        },
        
        /**
         * Fade in element
         */
        fadeIn(element, duration = 300) {
            if (this.prefersReducedMotion()) {
                element.style.opacity = '1';
                return Promise.resolve();
            }
            
            element.style.opacity = '0';
            element.style.transition = `opacity ${duration}ms ease-in-out`;
            
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    element.style.opacity = '1';
                    setTimeout(resolve, duration);
                });
            });
        },
        
        /**
         * Fade out element
         */
        fadeOut(element, duration = 300) {
            if (this.prefersReducedMotion()) {
                element.style.opacity = '0';
                return Promise.resolve();
            }
            
            element.style.transition = `opacity ${duration}ms ease-in-out`;
            
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    element.style.opacity = '0';
                    setTimeout(resolve, duration);
                });
            });
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ResearchWriterUtils = ResearchWriterUtils;
}

// CommonJS export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResearchWriterUtils;
}