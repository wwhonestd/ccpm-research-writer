/**
 * DataValidator Service
 * Provides comprehensive data validation and integrity checks for all data models
 */

import { ProjectSchema } from '../models/Project.js';
import { CitationSchema } from '../models/Citation.js';
import { NoteSchema } from '../models/Note.js';
import { DraftSchema } from '../models/Draft.js';

export class DataValidator {
    constructor() {
        this.schemas = {
            projects: ProjectSchema,
            citations: CitationSchema,
            notes: NoteSchema,
            drafts: DraftSchema
        };
        
        this.validationRules = this.initializeValidationRules();
    }

    initializeValidationRules() {
        return {
            // Common validation rules
            common: {
                maxStringLength: 50000,
                maxArrayLength: 1000,
                maxNestingDepth: 10,
                allowedHtmlTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
            },
            
            // Project-specific rules
            projects: {
                title: { minLength: 1, maxLength: 500 },
                description: { maxLength: 2000 },
                author: { minLength: 1, maxLength: 200 },
                tags: { maxItems: 20, maxItemLength: 50 },
                collaborators: { maxItems: 10, maxItemLength: 200 },
                deadlineRange: { minDays: -365, maxDays: 3650 } // 1 year past to 10 years future
            },
            
            // Citation-specific rules
            citations: {
                title: { minLength: 1, maxLength: 1000 },
                authors: { minItems: 1, maxItems: 20, maxItemLength: 200 },
                year: { min: 1000, max: new Date().getFullYear() + 5 },
                pages: { pattern: /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/ },
                doi: { pattern: /^10\.\d{4,}\/[-._;()\/:A-Za-z0-9]+$/ },
                isbn: { pattern: /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/ }
            },
            
            // Note-specific rules
            notes: {
                title: { minLength: 1, maxLength: 500 },
                content: { maxLength: 50000 },
                tags: { maxItems: 30, maxItemLength: 50 },
                sourceQuote: { maxLength: 2000 },
                analysis: { maxLength: 10000 }
            },
            
            // Draft-specific rules
            drafts: {
                title: { minLength: 1, maxLength: 500 },
                content: { maxLength: 1000000 }, // 1MB of text
                abstract: { maxLength: 5000 },
                outline: { maxItems: 50, maxItemLength: 200 },
                wordCountTarget: { min: 0, max: 1000000 },
                pageCountTarget: { min: 0, max: 10000 }
            }
        };
    }

    // Main validation methods
    validate(collection, data) {
        if (!data || typeof data !== 'object') {
            return {
                valid: false,
                errors: ['Data must be a valid object']
            };
        }

        const errors = [];
        
        // Schema validation
        const schemaErrors = this.validateSchema(collection, data);
        errors.push(...schemaErrors);
        
        // Business logic validation
        const businessErrors = this.validateBusinessLogic(collection, data);
        errors.push(...businessErrors);
        
        // Security validation
        const securityErrors = this.validateSecurity(data);
        errors.push(...securityErrors);
        
        // Data integrity validation
        const integrityErrors = this.validateDataIntegrity(collection, data);
        errors.push(...integrityErrors);

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: this.generateWarnings(collection, data)
        };
    }

    validateSchema(collection, data) {
        const schema = this.schemas[collection];
        if (!schema) {
            return [`Unknown collection: ${collection}`];
        }

        return this.validateAgainstSchema(data, schema, '');
    }

    validateAgainstSchema(data, schema, path = '') {
        const errors = [];

        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in data) || data[field] === null || data[field] === undefined) {
                    errors.push(`Missing required field: ${path}${field}`);
                }
            }
        }

        // Check properties
        if (schema.properties) {
            for (const [field, fieldSchema] of Object.entries(schema.properties)) {
                if (field in data) {
                    const fieldPath = path ? `${path}.${field}` : field;
                    const fieldErrors = this.validateField(data[field], fieldSchema, fieldPath);
                    errors.push(...fieldErrors);
                }
            }
        }

        // Check for unexpected fields
        if (schema.additionalProperties === false && schema.properties) {
            const allowedFields = Object.keys(schema.properties);
            for (const field of Object.keys(data)) {
                if (!allowedFields.includes(field)) {
                    errors.push(`Unexpected field: ${path}${field}`);
                }
            }
        }

        return errors;
    }

    validateField(value, schema, path) {
        const errors = [];

        // Type validation
        if (schema.type) {
            const types = Array.isArray(schema.type) ? schema.type : [schema.type];
            let typeValid = false;
            
            for (const type of types) {
                if (this.validateType(value, type)) {
                    typeValid = true;
                    break;
                }
            }
            
            if (!typeValid) {
                errors.push(`Invalid type for ${path}: expected ${types.join(' or ')}, got ${typeof value}`);
                return errors; // Don't continue validation if type is wrong
            }
        }

        // String validation
        if (typeof value === 'string') {
            if (schema.minLength && value.length < schema.minLength) {
                errors.push(`${path} is too short (minimum ${schema.minLength} characters)`);
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                errors.push(`${path} is too long (maximum ${schema.maxLength} characters)`);
            }
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push(`${path} does not match required pattern`);
            }
            if (schema.format) {
                const formatErrors = this.validateFormat(value, schema.format, path);
                errors.push(...formatErrors);
            }
            if (schema.enum && !schema.enum.includes(value)) {
                errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
            }
        }

        // Number validation
        if (typeof value === 'number') {
            if (schema.minimum && value < schema.minimum) {
                errors.push(`${path} is below minimum value ${schema.minimum}`);
            }
            if (schema.maximum && value > schema.maximum) {
                errors.push(`${path} is above maximum value ${schema.maximum}`);
            }
            if (schema.multipleOf && value % schema.multipleOf !== 0) {
                errors.push(`${path} must be a multiple of ${schema.multipleOf}`);
            }
        }

        // Array validation
        if (Array.isArray(value)) {
            if (schema.minItems && value.length < schema.minItems) {
                errors.push(`${path} must have at least ${schema.minItems} items`);
            }
            if (schema.maxItems && value.length > schema.maxItems) {
                errors.push(`${path} must have at most ${schema.maxItems} items`);
            }
            if (schema.items) {
                value.forEach((item, index) => {
                    const itemErrors = this.validateField(item, schema.items, `${path}[${index}]`);
                    errors.push(...itemErrors);
                });
            }
            if (schema.uniqueItems && this.hasDuplicates(value)) {
                errors.push(`${path} must contain unique items`);
            }
        }

        // Object validation
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (schema.properties) {
                const objectErrors = this.validateAgainstSchema(value, schema, `${path}.`);
                errors.push(...objectErrors);
            }
        }

        return errors;
    }

    validateType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'integer':
                return typeof value === 'number' && Number.isInteger(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'null':
                return value === null;
            default:
                return false;
        }
    }

    validateFormat(value, format, path) {
        const errors = [];
        
        switch (format) {
            case 'date-time':
                if (!this.isValidDateTime(value)) {
                    errors.push(`${path} is not a valid ISO 8601 date-time`);
                }
                break;
            case 'email':
                if (!this.isValidEmail(value)) {
                    errors.push(`${path} is not a valid email address`);
                }
                break;
            case 'uri':
                if (!this.isValidURI(value)) {
                    errors.push(`${path} is not a valid URI`);
                }
                break;
            default:
                // Unknown format, skip validation
                break;
        }
        
        return errors;
    }

    // Business logic validation
    validateBusinessLogic(collection, data) {
        const errors = [];
        const rules = this.validationRules[collection] || {};

        switch (collection) {
            case 'projects':
                errors.push(...this.validateProjectLogic(data, rules));
                break;
            case 'citations':
                errors.push(...this.validateCitationLogic(data, rules));
                break;
            case 'notes':
                errors.push(...this.validateNoteLogic(data, rules));
                break;
            case 'drafts':
                errors.push(...this.validateDraftLogic(data, rules));
                break;
        }

        return errors;
    }

    validateProjectLogic(data, rules) {
        const errors = [];

        // Deadline validation
        if (data.deadline) {
            const deadline = new Date(data.deadline);
            const now = new Date();
            const daysDiff = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < rules.deadlineRange.minDays) {
                errors.push('Project deadline is too far in the past');
            }
            if (daysDiff > rules.deadlineRange.maxDays) {
                errors.push('Project deadline is too far in the future');
            }
        }

        // Status transitions validation
        if (data.status === 'completed' && (!data.drafts || data.drafts.length === 0)) {
            errors.push('Completed projects should have at least one draft');
        }

        // Collaboration validation
        if (data.collaborators && data.collaborators.includes(data.author)) {
            errors.push('Author cannot be listed as a collaborator');
        }

        return errors;
    }

    validateCitationLogic(data, rules) {
        const errors = [];

        // Year validation
        if (data.year && data.year > new Date().getFullYear() + 5) {
            errors.push('Publication year cannot be more than 5 years in the future');
        }

        // DOI and URL validation
        if (data.doi && data.url && !data.url.includes('doi.org')) {
            errors.push('When DOI is provided, URL should typically point to DOI resolver');
        }

        // Publication type specific validation
        if (data.type === 'article' && !data.publication) {
            errors.push('Articles must specify a publication/journal');
        }
        
        if (data.type === 'book' && !data.publisher) {
            errors.push('Books must specify a publisher');
        }

        // Authors validation
        if (data.authors) {
            const duplicateAuthors = this.findDuplicates(data.authors.map(a => a.toLowerCase().trim()));
            if (duplicateAuthors.length > 0) {
                errors.push('Citation contains duplicate authors');
            }
        }

        return errors;
    }

    validateNoteLogic(data, rules) {
        const errors = [];

        // Source reference validation
        if (data.sourceQuote && !data.sourceId) {
            errors.push('Notes with source quotes should reference a citation');
        }

        // Type-specific validation
        if (data.type === 'question' && !data.content.includes('?')) {
            errors.push('Question-type notes should contain question marks');
        }

        // Linked content validation
        if (data.linkedCitations && data.linkedCitations.includes(data.sourceId)) {
            errors.push('Source citation is already in linked citations');
        }

        return errors;
    }

    validateDraftLogic(data, rules) {
        const errors = [];

        // Target validation
        if (data.wordCountTarget > 0 && data.pageCountTarget > 0) {
            const estimatedPages = Math.ceil(data.wordCount / 250);
            const targetRatio = data.pageCountTarget / (data.wordCountTarget / 250);
            
            if (targetRatio < 0.5 || targetRatio > 2.0) {
                errors.push('Word count and page count targets seem inconsistent');
            }
        }

        // Status validation
        if (data.status === 'published' && !data.publicationDate) {
            errors.push('Published drafts must have a publication date');
        }

        if (data.status === 'final' && data.wordCount < 100) {
            errors.push('Final drafts should have substantial content');
        }

        // Version validation
        if (data.versionHistory && data.versionHistory.length > 0) {
            const versions = data.versionHistory.map(v => v.version).concat(data.version);
            const sortedVersions = [...versions].sort(this.compareVersions);
            
            if (sortedVersions[sortedVersions.length - 1] !== data.version) {
                errors.push('Current version should be the latest version');
            }
        }

        return errors;
    }

    // Security validation
    validateSecurity(data) {
        const errors = [];

        // Check for potentially malicious content
        const maliciousPatterns = [
            /<script/gi,
            /javascript:/gi,
            /onload=/gi,
            /onerror=/gi,
            /eval\(/gi,
            /data:text\/html/gi
        ];

        const checkContent = (obj, path = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (typeof value === 'string') {
                    for (const pattern of maliciousPatterns) {
                        if (pattern.test(value)) {
                            errors.push(`Potentially malicious content detected in ${currentPath}`);
                            break;
                        }
                    }
                    
                    // Check for excessively long strings
                    if (value.length > this.validationRules.common.maxStringLength) {
                        errors.push(`Excessively long string in ${currentPath} (${value.length} characters)`);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        if (value.length > this.validationRules.common.maxArrayLength) {
                            errors.push(`Excessively long array in ${currentPath} (${value.length} items)`);
                        }
                        value.forEach((item, index) => {
                            if (typeof item === 'object') {
                                checkContent(item, `${currentPath}[${index}]`);
                            }
                        });
                    } else {
                        checkContent(value, currentPath);
                    }
                }
            }
        };

        checkContent(data);

        return errors;
    }

    // Data integrity validation
    validateDataIntegrity(collection, data) {
        const errors = [];

        // Check data consistency
        if (data.created && data.updated) {
            const created = new Date(data.created);
            const updated = new Date(data.updated);
            
            if (updated < created) {
                errors.push('Updated timestamp cannot be before created timestamp');
            }
        }

        // Check ID format
        if (data.id && !this.validateIdFormat(collection, data.id)) {
            errors.push(`Invalid ID format for ${collection}: ${data.id}`);
        }

        // Check relationships
        if (data.projectId && !this.isValidId('proj', data.projectId)) {
            errors.push('Invalid project ID format');
        }

        // Collection-specific integrity checks
        switch (collection) {
            case 'notes':
                if (data.parentNote && data.parentNote === data.id) {
                    errors.push('Note cannot be its own parent');
                }
                if (data.linkedNotes && data.linkedNotes.includes(data.id)) {
                    errors.push('Note cannot link to itself');
                }
                break;
                
            case 'drafts':
                if (data.parentVersion && data.parentVersion === data.version) {
                    errors.push('Draft version cannot be its own parent');
                }
                break;
        }

        return errors;
    }

    // Warning generation
    generateWarnings(collection, data) {
        const warnings = [];

        // Performance warnings
        if (collection === 'drafts' && data.content && data.content.length > 100000) {
            warnings.push('Large draft content may impact performance');
        }

        if (collection === 'notes' && data.linkedNotes && data.linkedNotes.length > 50) {
            warnings.push('Large number of linked notes may impact performance');
        }

        // Data quality warnings
        if (data.tags && this.hasDuplicates(data.tags.map(t => t.toLowerCase()))) {
            warnings.push('Duplicate tags detected (case-insensitive)');
        }

        if (collection === 'citations' && data.year && data.year < 1900) {
            warnings.push('Very old publication year - please verify');
        }

        // Completeness warnings
        if (collection === 'projects' && (!data.description || data.description.length < 50)) {
            warnings.push('Project description is very short');
        }

        if (collection === 'citations' && data.type === 'article' && !data.doi && !data.url) {
            warnings.push('Article citation missing both DOI and URL');
        }

        return warnings;
    }

    // Utility methods
    validateIdFormat(collection, id) {
        const patterns = {
            projects: /^proj_\d+_[a-zA-Z0-9]{9}$/,
            citations: /^cite_\d+_[a-zA-Z0-9]{9}$/,
            notes: /^note_\d+_[a-zA-Z0-9]{9}$/,
            drafts: /^draft_\d+_[a-zA-Z0-9]{9}$/
        };
        
        const pattern = patterns[collection];
        return pattern ? pattern.test(id) : false;
    }

    isValidId(prefix, id) {
        const pattern = new RegExp(`^${prefix}_\\d+_[a-zA-Z0-9]{9}$`);
        return pattern.test(id);
    }

    isValidDateTime(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && dateString === date.toISOString();
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidURI(uri) {
        try {
            new URL(uri);
            return true;
        } catch {
            return false;
        }
    }

    hasDuplicates(array) {
        return new Set(array).size !== array.length;
    }

    findDuplicates(array) {
        const seen = new Set();
        const duplicates = new Set();
        
        for (const item of array) {
            if (seen.has(item)) {
                duplicates.add(item);
            } else {
                seen.add(item);
            }
        }
        
        return Array.from(duplicates);
    }

    compareVersions(a, b) {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            
            if (aPart > bPart) return 1;
            if (aPart < bPart) return -1;
        }
        
        return 0;
    }

    // Batch validation
    validateBatch(collection, dataArray) {
        return dataArray.map((data, index) => ({
            index,
            id: data.id,
            ...this.validate(collection, data)
        }));
    }

    // Cross-reference validation
    validateReferences(storageService, collection, data) {
        const errors = [];
        
        // Validate project references
        if (data.projectId && !storageService.exists('projects', data.projectId)) {
            errors.push(`Referenced project ${data.projectId} does not exist`);
        }
        
        // Validate citation references
        if (data.sourceId && !storageService.exists('citations', data.sourceId)) {
            errors.push(`Referenced citation ${data.sourceId} does not exist`);
        }
        
        if (data.linkedCitations) {
            for (const citationId of data.linkedCitations) {
                if (!storageService.exists('citations', citationId)) {
                    errors.push(`Linked citation ${citationId} does not exist`);
                }
            }
        }
        
        // Validate note references
        if (data.linkedNotes) {
            for (const noteId of data.linkedNotes) {
                if (!storageService.exists('notes', noteId)) {
                    errors.push(`Linked note ${noteId} does not exist`);
                }
            }
        }
        
        // Validate draft references
        if (data.linkedDrafts) {
            for (const draftId of data.linkedDrafts) {
                if (!storageService.exists('drafts', draftId)) {
                    errors.push(`Linked draft ${draftId} does not exist`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Repair suggestions
    generateRepairSuggestions(collection, data, validationResult) {
        const suggestions = [];
        
        for (const error of validationResult.errors) {
            if (error.includes('Missing required field')) {
                const field = error.split(': ')[1];
                suggestions.push({
                    type: 'add_field',
                    field,
                    suggestedValue: this.getDefaultValueForField(collection, field)
                });
            } else if (error.includes('Invalid type')) {
                const field = error.split(' for ')[1].split(':')[0];
                suggestions.push({
                    type: 'fix_type',
                    field,
                    suggestedAction: 'Convert to correct type'
                });
            } else if (error.includes('too long')) {
                const field = error.split(' ')[0];
                suggestions.push({
                    type: 'truncate',
                    field,
                    suggestedAction: 'Truncate to maximum length'
                });
            }
        }
        
        return suggestions;
    }

    getDefaultValueForField(collection, field) {
        const defaults = {
            id: () => `${collection.slice(0, -1)}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: '',
            content: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            status: 'active',
            tags: [],
            author: '',
            type: collection === 'citations' ? 'article' : 'general'
        };
        
        const defaultValue = defaults[field];
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
}