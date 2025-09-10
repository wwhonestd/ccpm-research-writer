/**
 * Validation utilities for form validation with real-time feedback
 * Provides comprehensive validation rules, error messaging, and accessibility support
 */

import { ProjectSchema } from '../models/Project.js';

export class ValidationEngine {
    constructor(options = {}) {
        this.options = {
            validateOnBlur: true,
            validateOnInput: true,
            showSuccessState: false,
            debounceTime: 300,
            ...options
        };
        
        this.validators = {};
        this.debounceTimers = new Map();
        this.validationState = new Map();
        
        this.initializeBuiltInValidators();
    }

    initializeBuiltInValidators() {
        // Required field validator
        this.addValidator('required', {
            validate: (value, options = {}) => {
                const trimmed = typeof value === 'string' ? value.trim() : value;
                return !!(trimmed && trimmed !== '');
            },
            message: (fieldName) => `${this.formatFieldName(fieldName)} is required`,
            priority: 1
        });

        // String length validators
        this.addValidator('minLength', {
            validate: (value, options = {}) => {
                if (!value) return true; // Skip if empty (handled by required)
                return value.length >= (options.min || 0);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} must be at least ${options.min} characters`,
            priority: 2
        });

        this.addValidator('maxLength', {
            validate: (value, options = {}) => {
                if (!value) return true; // Skip if empty
                return value.length <= (options.max || Infinity);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} must be ${options.max} characters or less`,
            priority: 2
        });

        // Email validator
        this.addValidator('email', {
            validate: (value) => {
                if (!value) return true; // Skip if empty
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
            },
            message: (fieldName) => `${this.formatFieldName(fieldName)} must be a valid email address`,
            priority: 3
        });

        // URL validator
        this.addValidator('url', {
            validate: (value) => {
                if (!value) return true; // Skip if empty
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            message: (fieldName) => `${this.formatFieldName(fieldName)} must be a valid URL`,
            priority: 3
        });

        // Pattern validator
        this.addValidator('pattern', {
            validate: (value, options = {}) => {
                if (!value) return true; // Skip if empty
                const regex = new RegExp(options.pattern);
                return regex.test(value);
            },
            message: (fieldName, options) => 
                options.message || `${this.formatFieldName(fieldName)} format is invalid`,
            priority: 3
        });

        // Number validators
        this.addValidator('min', {
            validate: (value, options = {}) => {
                if (!value && value !== 0) return true; // Skip if empty
                return Number(value) >= (options.min || 0);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} must be at least ${options.min}`,
            priority: 2
        });

        this.addValidator('max', {
            validate: (value, options = {}) => {
                if (!value && value !== 0) return true; // Skip if empty
                return Number(value) <= (options.max || Infinity);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} must be ${options.max} or less`,
            priority: 2
        });

        // Array validators
        this.addValidator('arrayMinLength', {
            validate: (value, options = {}) => {
                if (!Array.isArray(value)) return true;
                return value.length >= (options.min || 0);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} must have at least ${options.min} items`,
            priority: 2
        });

        this.addValidator('arrayMaxLength', {
            validate: (value, options = {}) => {
                if (!Array.isArray(value)) return true;
                return value.length <= (options.max || Infinity);
            },
            message: (fieldName, options) => 
                `${this.formatFieldName(fieldName)} cannot have more than ${options.max} items`,
            priority: 2
        });

        // Custom project-specific validators
        this.addValidator('projectTitle', {
            validate: (value) => {
                if (!value) return false;
                const trimmed = value.trim();
                if (trimmed.length < 3) return false;
                if (trimmed.length > 500) return false;
                // Disallow only special characters or numbers
                if (!/[a-zA-Z]/.test(trimmed)) return false;
                return true;
            },
            message: () => 'Project title must be 3-500 characters and contain letters',
            priority: 1
        });

        this.addValidator('authorName', {
            validate: (value) => {
                if (!value) return false;
                const trimmed = value.trim();
                if (trimmed.length < 2) return false;
                if (trimmed.length > 200) return false;
                // Basic name validation - letters, spaces, hyphens, apostrophes
                if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmed)) return false;
                return true;
            },
            message: () => 'Author name must be 2-200 characters, letters and spaces only',
            priority: 1
        });

        this.addValidator('tags', {
            validate: (value) => {
                if (!Array.isArray(value)) {
                    // Convert comma-separated string to array for validation
                    value = typeof value === 'string' ? 
                        value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
                }
                
                if (value.length > 20) return false; // Max 20 tags
                
                return value.every(tag => {
                    if (typeof tag !== 'string') return false;
                    if (tag.length > 50) return false;
                    if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) return false;
                    return true;
                });
            },
            message: () => 'Tags must be alphanumeric, max 20 tags, 50 characters each',
            priority: 3
        });
    }

    addValidator(name, validator) {
        this.validators[name] = {
            validate: validator.validate,
            message: validator.message,
            priority: validator.priority || 10
        };
    }

    /**
     * Validate a single field with real-time feedback
     */
    async validateField(fieldElement, rules = {}, options = {}) {
        const fieldName = fieldElement.name;
        const value = this.getFieldValue(fieldElement);
        
        // Debounce validation if specified
        if (this.options.debounceTime > 0 && options.debounce !== false) {
            return this.debounceValidation(fieldElement, rules, options);
        }

        const errors = this.runValidation(fieldName, value, rules);
        const isValid = errors.length === 0;
        
        // Update validation state
        this.validationState.set(fieldName, { isValid, errors, value });
        
        // Update UI
        this.updateFieldUI(fieldElement, isValid, errors);
        
        return { isValid, errors };
    }

    debounceValidation(fieldElement, rules, options) {
        const fieldName = fieldElement.name;
        
        // Clear existing timer
        if (this.debounceTimers.has(fieldName)) {
            clearTimeout(this.debounceTimers.get(fieldName));
        }
        
        return new Promise((resolve) => {
            const timer = setTimeout(async () => {
                this.debounceTimers.delete(fieldName);
                const result = await this.validateField(fieldElement, rules, { ...options, debounce: false });
                resolve(result);
            }, this.options.debounceTime);
            
            this.debounceTimers.set(fieldName, timer);
        });
    }

    /**
     * Validate entire form
     */
    validateForm(formData, schema = {}) {
        const results = {};
        let isFormValid = true;
        
        Object.entries(formData).forEach(([fieldName, value]) => {
            const rules = schema[fieldName] || {};
            const errors = this.runValidation(fieldName, value, rules);
            const isValid = errors.length === 0;
            
            results[fieldName] = { isValid, errors, value };
            this.validationState.set(fieldName, results[fieldName]);
            
            if (!isValid) {
                isFormValid = false;
            }
        });
        
        return {
            isValid: isFormValid,
            errors: this.getFormErrors(results),
            fields: results
        };
    }

    /**
     * Validate project data against schema
     */
    validateProject(projectData) {
        const projectRules = {
            title: ['required', 'projectTitle'],
            author: ['required', 'authorName'],
            description: [{ maxLength: { max: 2000 } }],
            status: [{ pattern: { pattern: '^(planning|active|completed|archived)$' } }],
            priority: [{ pattern: { pattern: '^(low|medium|high|urgent)$' } }],
            tags: ['tags'],
            created: ['required'],
            updated: ['required']
        };
        
        return this.validateForm(projectData, projectRules);
    }

    runValidation(fieldName, value, rules) {
        const errors = [];
        const ruleArray = Array.isArray(rules) ? rules : [rules];
        
        ruleArray.forEach(rule => {
            if (typeof rule === 'string') {
                // Simple validator name
                const validator = this.validators[rule];
                if (validator && !validator.validate(value)) {
                    errors.push({
                        rule,
                        message: validator.message(fieldName),
                        priority: validator.priority
                    });
                }
            } else if (typeof rule === 'object') {
                // Validator with options
                Object.entries(rule).forEach(([validatorName, options]) => {
                    const validator = this.validators[validatorName];
                    if (validator && !validator.validate(value, options)) {
                        errors.push({
                            rule: validatorName,
                            message: validator.message(fieldName, options),
                            priority: validator.priority
                        });
                    }
                });
            }
        });
        
        // Sort errors by priority (lower number = higher priority)
        return errors.sort((a, b) => (a.priority || 10) - (b.priority || 10));
    }

    getFieldValue(fieldElement) {
        switch (fieldElement.type) {
            case 'checkbox':
                return fieldElement.checked;
            case 'radio':
                const form = fieldElement.closest('form');
                const radioGroup = form.querySelectorAll(`input[name="${fieldElement.name}"]`);
                const checked = Array.from(radioGroup).find(radio => radio.checked);
                return checked ? checked.value : null;
            case 'number':
                return fieldElement.value ? Number(fieldElement.value) : null;
            default:
                return fieldElement.value;
        }
    }

    updateFieldUI(fieldElement, isValid, errors) {
        const fieldContainer = fieldElement.closest('.form-group');
        if (!fieldContainer) return;

        // Update aria-invalid attribute
        fieldElement.setAttribute('aria-invalid', isValid ? 'false' : 'true');
        
        // Update field container classes
        fieldContainer.classList.remove('field-valid', 'field-invalid');
        if (isValid && this.options.showSuccessState) {
            fieldContainer.classList.add('field-valid');
        } else if (!isValid) {
            fieldContainer.classList.add('field-invalid');
        }
        
        // Update error message
        const errorElement = fieldContainer.querySelector('.form-error');
        if (errorElement) {
            if (errors.length > 0) {
                errorElement.textContent = errors[0].message; // Show first error
                errorElement.style.display = 'block';
                errorElement.setAttribute('role', 'alert');
            } else {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
                errorElement.removeAttribute('role');
            }
        }

        // Update success message (if enabled)
        if (this.options.showSuccessState) {
            const successElement = fieldContainer.querySelector('.form-success');
            if (successElement) {
                if (isValid && fieldElement.value) {
                    successElement.style.display = 'block';
                    successElement.textContent = 'Valid';
                } else {
                    successElement.style.display = 'none';
                }
            }
        }
    }

    getFormErrors(validationResults) {
        const errors = {};
        Object.entries(validationResults).forEach(([fieldName, result]) => {
            if (!result.isValid) {
                errors[fieldName] = result.errors.map(err => err.message);
            }
        });
        return errors;
    }

    getFieldState(fieldName) {
        return this.validationState.get(fieldName) || { isValid: null, errors: [], value: null };
    }

    clearFieldState(fieldName) {
        this.validationState.delete(fieldName);
        
        // Clear debounce timer
        if (this.debounceTimers.has(fieldName)) {
            clearTimeout(this.debounceTimers.get(fieldName));
            this.debounceTimers.delete(fieldName);
        }
    }

    clearAllState() {
        this.validationState.clear();
        
        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
    }

    formatFieldName(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Attach validation to form elements
     */
    attachToForm(formElement, schema = {}) {
        const inputs = formElement.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            const fieldName = input.name;
            const rules = schema[fieldName] || [];
            
            // Validate on blur if enabled
            if (this.options.validateOnBlur) {
                input.addEventListener('blur', () => {
                    this.validateField(input, rules);
                });
            }
            
            // Validate on input if enabled
            if (this.options.validateOnInput) {
                input.addEventListener('input', () => {
                    this.validateField(input, rules);
                });
            }
        });
        
        return this;
    }

    /**
     * Remove validation from form
     */
    detachFromForm(formElement) {
        const inputs = formElement.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            // Remove validation state
            this.clearFieldState(input.name);
            
            // Remove visual indicators
            input.removeAttribute('aria-invalid');
            const fieldContainer = input.closest('.form-group');
            if (fieldContainer) {
                fieldContainer.classList.remove('field-valid', 'field-invalid');
                const errorElement = fieldContainer.querySelector('.form-error');
                if (errorElement) {
                    errorElement.textContent = '';
                    errorElement.style.display = 'none';
                }
            }
        });
        
        return this;
    }
}

/**
 * Validation rule presets for common use cases
 */
export const ValidationRules = {
    // Project-specific rules
    project: {
        title: ['required', 'projectTitle'],
        author: ['required', 'authorName'],
        description: [{ maxLength: { max: 2000 } }],
        status: [{ pattern: { pattern: '^(planning|active|completed|archived)$' } }],
        priority: [{ pattern: { pattern: '^(low|medium|high|urgent)$' } }],
        tags: ['tags']
    },
    
    // Citation rules
    citation: {
        title: ['required', { minLength: { min: 3 } }, { maxLength: { max: 500 } }],
        authors: ['required'],
        year: ['required', { min: { min: 1900 } }, { max: { max: new Date().getFullYear() + 1 } }],
        source: [{ maxLength: { max: 200 } }],
        url: ['url'],
        doi: [{ pattern: { pattern: '^10\\.\\d{4,}\\/.+' } }]
    },
    
    // Note rules  
    note: {
        title: ['required', { minLength: { min: 2 } }, { maxLength: { max: 200 } }],
        content: ['required', { minLength: { min: 10 } }],
        tags: ['tags']
    },
    
    // Draft rules
    draft: {
        title: ['required', { minLength: { min: 3 } }, { maxLength: { max: 500 } }],
        content: ['required', { minLength: { min: 50 } }],
        version: ['required']
    }
};

/**
 * Utility functions for common validation tasks
 */
export const ValidationUtils = {
    /**
     * Quick validation for single values
     */
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    isValidUrl: (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    /**
     * Sanitize user input
     */
    sanitizeString: (str) => {
        if (typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, '');
    },
    
    sanitizeTags: (tags) => {
        if (typeof tags === 'string') {
            tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
        if (!Array.isArray(tags)) return [];
        
        return tags
            .map(tag => ValidationUtils.sanitizeString(tag))
            .filter(tag => tag.length > 0 && tag.length <= 50)
            .slice(0, 20); // Max 20 tags
    },
    
    /**
     * Format validation error messages for display
     */
    formatErrors: (errors) => {
        if (Array.isArray(errors)) {
            return errors.join(', ');
        }
        if (typeof errors === 'object') {
            return Object.values(errors).flat().join(', ');
        }
        return String(errors);
    }
};

// Export default instance for convenience
export default new ValidationEngine();