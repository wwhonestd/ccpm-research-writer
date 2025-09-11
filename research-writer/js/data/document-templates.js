/**
 * Document Templates Database
 * Predefined document structures for academic papers, reports, proposals, theses
 * Templates work with OutlineBuilder and provide structured starting points
 */

// Template categories
export const TEMPLATE_CATEGORIES = {
    ACADEMIC: 'academic',
    BUSINESS: 'business',
    TECHNICAL: 'technical',
    CREATIVE: 'creative',
    CUSTOM: 'custom'
};

// Template types
export const TEMPLATE_TYPES = {
    RESEARCH_PAPER: 'research-paper',
    THESIS: 'thesis',
    DISSERTATION: 'dissertation',
    CONFERENCE_PAPER: 'conference-paper',
    JOURNAL_ARTICLE: 'journal-article',
    BOOK_CHAPTER: 'book-chapter',
    BUSINESS_REPORT: 'business-report',
    PROJECT_PROPOSAL: 'project-proposal',
    GRANT_PROPOSAL: 'grant-proposal',
    WHITE_PAPER: 'white-paper',
    TECHNICAL_SPEC: 'technical-spec',
    USER_GUIDE: 'user-guide',
    BLOG_POST: 'blog-post',
    NEWSLETTER: 'newsletter',
    CUSTOM: 'custom'
};

// Base template class
export class DocumentTemplate {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name;
        this.description = data.description;
        this.category = data.category;
        this.type = data.type;
        this.tags = data.tags || [];
        this.author = data.author || 'System';
        this.version = data.version || '1.0.0';
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.isSystem = data.isSystem || false;
        this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
        
        // Structure definition - compatible with OutlineBuilder
        this.structure = data.structure || [];
        
        // Template configuration
        this.config = {
            defaultWordCount: data.config?.defaultWordCount || 5000,
            suggestedLength: data.config?.suggestedLength || 'medium',
            estimatedTime: data.config?.estimatedTime || '2-4 hours',
            complexity: data.config?.complexity || 'intermediate',
            citationStyle: data.config?.citationStyle || 'apa',
            requiredSections: data.config?.requiredSections || [],
            optionalSections: data.config?.optionalSections || [],
            ...data.config
        };
        
        // Usage statistics
        this.stats = {
            usageCount: data.stats?.usageCount || 0,
            averageRating: data.stats?.averageRating || 0,
            totalRatings: data.stats?.totalRatings || 0,
            ...data.stats
        };
    }

    generateId() {
        return 'template_' + Math.random().toString(36).substr(2, 9);
    }

    // Convert template to OutlineBuilder format
    toOutlineStructure() {
        return {
            id: 'root',
            title: this.name,
            level: 0,
            children: this.convertStructureNodes(this.structure, 1),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
    }

    convertStructureNodes(nodes, level) {
        return nodes.map((node, index) => ({
            id: `section_${level}_${index}`,
            title: node.title,
            level: level,
            description: node.description || '',
            wordCount: 0,
            allocatedWords: node.wordAllocation || Math.floor(this.config.defaultWordCount / nodes.length),
            children: node.children ? this.convertStructureNodes(node.children, level + 1) : [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            collapsed: false,
            parentId: level === 1 ? 'root' : null,
            order: index,
            metadata: {
                isRequired: node.required || false,
                estimatedTime: node.estimatedTime || '30-60 minutes',
                difficulty: node.difficulty || 'medium',
                tips: node.tips || []
            }
        }));
    }

    // Create a copy of the template for customization
    clone(newName = null) {
        const clonedData = JSON.parse(JSON.stringify(this));
        clonedData.id = this.generateId();
        clonedData.name = newName || `${this.name} (Copy)`;
        clonedData.isSystem = false;
        clonedData.author = 'User';
        clonedData.created = new Date().toISOString();
        clonedData.updated = new Date().toISOString();
        clonedData.stats = { usageCount: 0, averageRating: 0, totalRatings: 0 };
        
        return new DocumentTemplate(clonedData);
    }

    // Validation
    validate() {
        const errors = [];
        
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Template name is required');
        }
        
        if (!this.category || !Object.values(TEMPLATE_CATEGORIES).includes(this.category)) {
            errors.push('Valid category is required');
        }
        
        if (!this.type || !Object.values(TEMPLATE_TYPES).includes(this.type)) {
            errors.push('Valid type is required');
        }
        
        if (!Array.isArray(this.structure) || this.structure.length === 0) {
            errors.push('Template must have at least one section');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Export to JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            category: this.category,
            type: this.type,
            tags: this.tags,
            author: this.author,
            version: this.version,
            created: this.created,
            updated: this.updated,
            isSystem: this.isSystem,
            isPublic: this.isPublic,
            structure: this.structure,
            config: this.config,
            stats: this.stats
        };
    }

    // Create from JSON
    static fromJSON(data) {
        return new DocumentTemplate(data);
    }
}

// Predefined system templates
export const SYSTEM_TEMPLATES = [
    // Academic Templates
    new DocumentTemplate({
        id: 'academic-research-paper',
        name: 'Academic Research Paper',
        description: 'Standard academic research paper structure with methodology, results, and discussion sections',
        category: TEMPLATE_CATEGORIES.ACADEMIC,
        type: TEMPLATE_TYPES.RESEARCH_PAPER,
        tags: ['research', 'academic', 'peer-review', 'methodology'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 8000,
            suggestedLength: 'long',
            estimatedTime: '6-10 hours',
            complexity: 'advanced',
            citationStyle: 'apa',
            requiredSections: ['abstract', 'introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references']
        },
        structure: [
            {
                title: 'Abstract',
                description: 'Concise summary of the research (150-250 words)',
                wordAllocation: 250,
                required: true,
                estimatedTime: '30-45 minutes',
                tips: ['State the problem clearly', 'Summarize methodology', 'Highlight key findings']
            },
            {
                title: 'Introduction',
                description: 'Background, problem statement, and research objectives',
                wordAllocation: 1200,
                required: true,
                estimatedTime: '1-2 hours',
                children: [
                    {
                        title: 'Background and Context',
                        description: 'Literature review and theoretical framework',
                        wordAllocation: 600
                    },
                    {
                        title: 'Problem Statement',
                        description: 'Clear articulation of the research problem',
                        wordAllocation: 300
                    },
                    {
                        title: 'Research Questions and Objectives',
                        description: 'Specific research questions and hypotheses',
                        wordAllocation: 300
                    }
                ]
            },
            {
                title: 'Literature Review',
                description: 'Comprehensive review of relevant literature',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Theoretical Framework',
                        description: 'Theoretical foundations of the research',
                        wordAllocation: 750
                    },
                    {
                        title: 'Related Work',
                        description: 'Review of directly related studies',
                        wordAllocation: 750
                    }
                ]
            },
            {
                title: 'Methodology',
                description: 'Research design, data collection, and analysis methods',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '1-2 hours',
                children: [
                    {
                        title: 'Research Design',
                        description: 'Overall approach and justification',
                        wordAllocation: 400
                    },
                    {
                        title: 'Data Collection',
                        description: 'Methods and procedures for data collection',
                        wordAllocation: 550
                    },
                    {
                        title: 'Data Analysis',
                        description: 'Analytical methods and tools',
                        wordAllocation: 550
                    }
                ]
            },
            {
                title: 'Results',
                description: 'Presentation of findings with tables and figures',
                wordAllocation: 2000,
                required: true,
                estimatedTime: '2-3 hours',
                tips: ['Present data objectively', 'Use clear visualizations', 'Organize by research questions']
            },
            {
                title: 'Discussion',
                description: 'Interpretation of results and implications',
                wordAllocation: 1300,
                required: true,
                estimatedTime: '1-2 hours',
                children: [
                    {
                        title: 'Interpretation of Findings',
                        description: 'What the results mean in context',
                        wordAllocation: 650
                    },
                    {
                        title: 'Limitations',
                        description: 'Acknowledgment of study limitations',
                        wordAllocation: 325
                    },
                    {
                        title: 'Implications',
                        description: 'Theoretical and practical implications',
                        wordAllocation: 325
                    }
                ]
            },
            {
                title: 'Conclusion',
                description: 'Summary of findings and future research directions',
                wordAllocation: 250,
                required: true,
                estimatedTime: '30 minutes',
                tips: ['Restate main findings', 'Suggest future research', 'End with strong statement']
            }
        ]
    }),

    new DocumentTemplate({
        id: 'master-thesis',
        name: 'Master\'s Thesis',
        description: 'Comprehensive thesis structure for master\'s degree research',
        category: TEMPLATE_CATEGORIES.ACADEMIC,
        type: TEMPLATE_TYPES.THESIS,
        tags: ['thesis', 'master', 'graduate', 'research'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 20000,
            suggestedLength: 'very-long',
            estimatedTime: '20-40 hours',
            complexity: 'advanced',
            citationStyle: 'chicago',
            requiredSections: ['abstract', 'introduction', 'literature-review', 'methodology', 'results', 'discussion', 'conclusion', 'references']
        },
        structure: [
            {
                title: 'Title Page',
                description: 'Thesis title, author, institution, and date',
                wordAllocation: 100,
                required: true,
                estimatedTime: '15 minutes'
            },
            {
                title: 'Abstract',
                description: 'Comprehensive summary of the thesis (300-500 words)',
                wordAllocation: 400,
                required: true,
                estimatedTime: '1-2 hours'
            },
            {
                title: 'Table of Contents',
                description: 'Detailed outline of thesis sections',
                wordAllocation: 200,
                required: true,
                estimatedTime: '30 minutes'
            },
            {
                title: 'Introduction',
                description: 'Research context, objectives, and thesis structure',
                wordAllocation: 2500,
                required: true,
                estimatedTime: '3-4 hours',
                children: [
                    {
                        title: 'Research Context',
                        description: 'Background and motivation for the research',
                        wordAllocation: 1000
                    },
                    {
                        title: 'Research Problem and Questions',
                        description: 'Problem definition and research questions',
                        wordAllocation: 750
                    },
                    {
                        title: 'Research Objectives',
                        description: 'Specific objectives and expected contributions',
                        wordAllocation: 500
                    },
                    {
                        title: 'Thesis Structure',
                        description: 'Overview of thesis organization',
                        wordAllocation: 250
                    }
                ]
            },
            {
                title: 'Literature Review',
                description: 'Comprehensive review of relevant literature',
                wordAllocation: 4000,
                required: true,
                estimatedTime: '6-8 hours',
                children: [
                    {
                        title: 'Theoretical Framework',
                        description: 'Theoretical foundations and conceptual models',
                        wordAllocation: 2000
                    },
                    {
                        title: 'Related Research',
                        description: 'Review of empirical studies and findings',
                        wordAllocation: 1500
                    },
                    {
                        title: 'Research Gaps',
                        description: 'Identification of gaps and research opportunities',
                        wordAllocation: 500
                    }
                ]
            },
            {
                title: 'Methodology',
                description: 'Detailed research methodology and procedures',
                wordAllocation: 3000,
                required: true,
                estimatedTime: '4-5 hours',
                children: [
                    {
                        title: 'Research Philosophy and Approach',
                        description: 'Philosophical foundations and research approach',
                        wordAllocation: 800
                    },
                    {
                        title: 'Research Design',
                        description: 'Overall research design and justification',
                        wordAllocation: 800
                    },
                    {
                        title: 'Data Collection Methods',
                        description: 'Detailed data collection procedures',
                        wordAllocation: 700
                    },
                    {
                        title: 'Data Analysis Methods',
                        description: 'Analytical frameworks and tools',
                        wordAllocation: 700
                    }
                ]
            },
            {
                title: 'Results and Analysis',
                description: 'Presentation and analysis of research findings',
                wordAllocation: 6000,
                required: true,
                estimatedTime: '8-10 hours',
                children: [
                    {
                        title: 'Data Presentation',
                        description: 'Systematic presentation of collected data',
                        wordAllocation: 2500
                    },
                    {
                        title: 'Quantitative Analysis',
                        description: 'Statistical analysis and interpretation',
                        wordAllocation: 2000
                    },
                    {
                        title: 'Qualitative Analysis',
                        description: 'Thematic analysis and interpretation',
                        wordAllocation: 1500
                    }
                ]
            },
            {
                title: 'Discussion',
                description: 'Interpretation, implications, and theoretical contributions',
                wordAllocation: 3000,
                required: true,
                estimatedTime: '4-5 hours',
                children: [
                    {
                        title: 'Interpretation of Findings',
                        description: 'Detailed interpretation in theoretical context',
                        wordAllocation: 1500
                    },
                    {
                        title: 'Theoretical Contributions',
                        description: 'Contributions to theory and knowledge',
                        wordAllocation: 750
                    },
                    {
                        title: 'Practical Implications',
                        description: 'Practical applications and implications',
                        wordAllocation: 750
                    }
                ]
            },
            {
                title: 'Conclusion',
                description: 'Summary, limitations, and future research',
                wordAllocation: 1000,
                required: true,
                estimatedTime: '1-2 hours',
                children: [
                    {
                        title: 'Summary of Findings',
                        description: 'Key findings and contributions',
                        wordAllocation: 400
                    },
                    {
                        title: 'Limitations',
                        description: 'Research limitations and constraints',
                        wordAllocation: 300
                    },
                    {
                        title: 'Future Research',
                        description: 'Recommendations for future research',
                        wordAllocation: 300
                    }
                ]
            }
        ]
    }),

    // Business Templates
    new DocumentTemplate({
        id: 'business-report',
        name: 'Business Report',
        description: 'Professional business report structure with executive summary and recommendations',
        category: TEMPLATE_CATEGORIES.BUSINESS,
        type: TEMPLATE_TYPES.BUSINESS_REPORT,
        tags: ['business', 'report', 'professional', 'analysis'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 5000,
            suggestedLength: 'medium',
            estimatedTime: '4-6 hours',
            complexity: 'intermediate',
            citationStyle: 'chicago',
            requiredSections: ['executive-summary', 'introduction', 'analysis', 'recommendations', 'conclusion']
        },
        structure: [
            {
                title: 'Executive Summary',
                description: 'High-level overview of key findings and recommendations',
                wordAllocation: 500,
                required: true,
                estimatedTime: '45 minutes',
                tips: ['Write this section last', 'Focus on key decisions needed', 'Keep it concise and actionable']
            },
            {
                title: 'Introduction',
                description: 'Background, scope, and objectives of the report',
                wordAllocation: 600,
                required: true,
                estimatedTime: '45 minutes',
                children: [
                    {
                        title: 'Background',
                        description: 'Context and motivation for the report',
                        wordAllocation: 300
                    },
                    {
                        title: 'Scope and Objectives',
                        description: 'What the report covers and aims to achieve',
                        wordAllocation: 300
                    }
                ]
            },
            {
                title: 'Current Situation Analysis',
                description: 'Analysis of the current state and key issues',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Market Overview',
                        description: 'Current market conditions and trends',
                        wordAllocation: 500
                    },
                    {
                        title: 'Performance Analysis',
                        description: 'Analysis of current performance metrics',
                        wordAllocation: 500
                    },
                    {
                        title: 'Key Challenges',
                        description: 'Identification of main challenges and obstacles',
                        wordAllocation: 500
                    }
                ]
            },
            {
                title: 'Options and Analysis',
                description: 'Evaluation of different options and alternatives',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Option Assessment',
                        description: 'Detailed evaluation of available options',
                        wordAllocation: 1000
                    },
                    {
                        title: 'Risk Analysis',
                        description: 'Assessment of risks and mitigation strategies',
                        wordAllocation: 500
                    }
                ]
            },
            {
                title: 'Recommendations',
                description: 'Specific recommendations with implementation guidance',
                wordAllocation: 700,
                required: true,
                estimatedTime: '1 hour',
                tips: ['Make recommendations specific and actionable', 'Prioritize recommendations', 'Include implementation timeline']
            },
            {
                title: 'Implementation Plan',
                description: 'Detailed plan for implementing recommendations',
                wordAllocation: 500,
                required: false,
                estimatedTime: '45 minutes'
            },
            {
                title: 'Conclusion',
                description: 'Summary and next steps',
                wordAllocation: 200,
                required: true,
                estimatedTime: '15 minutes'
            }
        ]
    }),

    new DocumentTemplate({
        id: 'project-proposal',
        name: 'Project Proposal',
        description: 'Comprehensive project proposal with objectives, methodology, and budget',
        category: TEMPLATE_CATEGORIES.BUSINESS,
        type: TEMPLATE_TYPES.PROJECT_PROPOSAL,
        tags: ['proposal', 'project', 'planning', 'funding'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 4000,
            suggestedLength: 'medium',
            estimatedTime: '5-7 hours',
            complexity: 'intermediate',
            citationStyle: 'apa',
            requiredSections: ['executive-summary', 'project-description', 'objectives', 'methodology', 'timeline', 'budget']
        },
        structure: [
            {
                title: 'Executive Summary',
                description: 'Project overview and key benefits',
                wordAllocation: 400,
                required: true,
                estimatedTime: '30 minutes'
            },
            {
                title: 'Project Description',
                description: 'Detailed description of the proposed project',
                wordAllocation: 800,
                required: true,
                estimatedTime: '1 hour',
                children: [
                    {
                        title: 'Project Background',
                        description: 'Context and rationale for the project',
                        wordAllocation: 400
                    },
                    {
                        title: 'Project Scope',
                        description: 'What the project will and will not include',
                        wordAllocation: 400
                    }
                ]
            },
            {
                title: 'Objectives and Goals',
                description: 'Specific, measurable objectives',
                wordAllocation: 600,
                required: true,
                estimatedTime: '45 minutes',
                children: [
                    {
                        title: 'Primary Objectives',
                        description: 'Main goals to be achieved',
                        wordAllocation: 400
                    },
                    {
                        title: 'Success Metrics',
                        description: 'How success will be measured',
                        wordAllocation: 200
                    }
                ]
            },
            {
                title: 'Methodology and Approach',
                description: 'How the project will be executed',
                wordAllocation: 1000,
                required: true,
                estimatedTime: '1-2 hours',
                children: [
                    {
                        title: 'Project Approach',
                        description: 'Overall methodology and framework',
                        wordAllocation: 500
                    },
                    {
                        title: 'Work Packages',
                        description: 'Breakdown of major work components',
                        wordAllocation: 500
                    }
                ]
            },
            {
                title: 'Timeline and Milestones',
                description: 'Project schedule with key milestones',
                wordAllocation: 500,
                required: true,
                estimatedTime: '45 minutes'
            },
            {
                title: 'Resources and Budget',
                description: 'Required resources and cost breakdown',
                wordAllocation: 600,
                required: true,
                estimatedTime: '1 hour',
                children: [
                    {
                        title: 'Resource Requirements',
                        description: 'Human resources, equipment, and materials needed',
                        wordAllocation: 300
                    },
                    {
                        title: 'Budget Breakdown',
                        description: 'Detailed cost analysis',
                        wordAllocation: 300
                    }
                ]
            },
            {
                title: 'Risk Management',
                description: 'Potential risks and mitigation strategies',
                wordAllocation: 400,
                required: false,
                estimatedTime: '30 minutes'
            }
        ]
    }),

    // Technical Templates
    new DocumentTemplate({
        id: 'technical-specification',
        name: 'Technical Specification',
        description: 'Detailed technical specification document for software or systems',
        category: TEMPLATE_CATEGORIES.TECHNICAL,
        type: TEMPLATE_TYPES.TECHNICAL_SPEC,
        tags: ['technical', 'specification', 'software', 'architecture'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 6000,
            suggestedLength: 'long',
            estimatedTime: '6-8 hours',
            complexity: 'advanced',
            citationStyle: 'ieee',
            requiredSections: ['overview', 'requirements', 'architecture', 'implementation', 'testing']
        },
        structure: [
            {
                title: 'Overview',
                description: 'System overview and purpose',
                wordAllocation: 600,
                required: true,
                estimatedTime: '45 minutes',
                children: [
                    {
                        title: 'System Purpose',
                        description: 'What the system is designed to accomplish',
                        wordAllocation: 300
                    },
                    {
                        title: 'Scope and Boundaries',
                        description: 'What is and is not included in the system',
                        wordAllocation: 300
                    }
                ]
            },
            {
                title: 'Requirements',
                description: 'Functional and non-functional requirements',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Functional Requirements',
                        description: 'What the system must do',
                        wordAllocation: 800
                    },
                    {
                        title: 'Non-Functional Requirements',
                        description: 'Performance, security, and quality requirements',
                        wordAllocation: 500
                    },
                    {
                        title: 'Constraints',
                        description: 'Technical and business constraints',
                        wordAllocation: 200
                    }
                ]
            },
            {
                title: 'System Architecture',
                description: 'High-level system design and components',
                wordAllocation: 1800,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Architecture Overview',
                        description: 'Overall system architecture pattern',
                        wordAllocation: 600
                    },
                    {
                        title: 'Component Design',
                        description: 'Detailed component specifications',
                        wordAllocation: 800
                    },
                    {
                        title: 'Data Architecture',
                        description: 'Data models and storage design',
                        wordAllocation: 400
                    }
                ]
            },
            {
                title: 'Detailed Design',
                description: 'Detailed implementation specifications',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Interface Specifications',
                        description: 'API and interface definitions',
                        wordAllocation: 500
                    },
                    {
                        title: 'Algorithm Specifications',
                        description: 'Core algorithms and logic',
                        wordAllocation: 500
                    },
                    {
                        title: 'Security Considerations',
                        description: 'Security measures and protocols',
                        wordAllocation: 500
                    }
                ]
            },
            {
                title: 'Testing Strategy',
                description: 'Testing approach and verification methods',
                wordAllocation: 600,
                required: true,
                estimatedTime: '1 hour',
                children: [
                    {
                        title: 'Testing Approach',
                        description: 'Overall testing methodology',
                        wordAllocation: 300
                    },
                    {
                        title: 'Test Cases',
                        description: 'Key test scenarios and acceptance criteria',
                        wordAllocation: 300
                    }
                ]
            }
        ]
    }),

    // Simple templates for quick start
    new DocumentTemplate({
        id: 'blog-post',
        name: 'Blog Post',
        description: 'Simple blog post structure with engaging introduction and conclusion',
        category: TEMPLATE_CATEGORIES.CREATIVE,
        type: TEMPLATE_TYPES.BLOG_POST,
        tags: ['blog', 'writing', 'content', 'web'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 1500,
            suggestedLength: 'short',
            estimatedTime: '2-3 hours',
            complexity: 'beginner',
            citationStyle: 'informal',
            requiredSections: ['introduction', 'body', 'conclusion']
        },
        structure: [
            {
                title: 'Hook and Introduction',
                description: 'Engaging opening that draws readers in',
                wordAllocation: 200,
                required: true,
                estimatedTime: '20 minutes',
                tips: ['Start with a question or surprising fact', 'Clearly state what the post covers', 'Make it personal when appropriate']
            },
            {
                title: 'Main Content',
                description: 'Core content organized in digestible sections',
                wordAllocation: 1000,
                required: true,
                estimatedTime: '1.5-2 hours',
                children: [
                    {
                        title: 'Key Point 1',
                        description: 'First main point or section',
                        wordAllocation: 350
                    },
                    {
                        title: 'Key Point 2',
                        description: 'Second main point or section',
                        wordAllocation: 350
                    },
                    {
                        title: 'Key Point 3',
                        description: 'Third main point or section',
                        wordAllocation: 300
                    }
                ]
            },
            {
                title: 'Conclusion and Call to Action',
                description: 'Wrap up with key takeaways and next steps',
                wordAllocation: 300,
                required: true,
                estimatedTime: '30 minutes',
                tips: ['Summarize key points', 'Include a clear call to action', 'Encourage engagement']
            }
        ]
    }),

    new DocumentTemplate({
        id: 'user-guide',
        name: 'User Guide',
        description: 'Comprehensive user guide with step-by-step instructions',
        category: TEMPLATE_CATEGORIES.TECHNICAL,
        type: TEMPLATE_TYPES.USER_GUIDE,
        tags: ['documentation', 'guide', 'instructions', 'help'],
        author: 'System',
        isSystem: true,
        config: {
            defaultWordCount: 3000,
            suggestedLength: 'medium',
            estimatedTime: '4-5 hours',
            complexity: 'intermediate',
            citationStyle: 'technical',
            requiredSections: ['overview', 'getting-started', 'features', 'troubleshooting']
        },
        structure: [
            {
                title: 'Introduction',
                description: 'Product overview and guide purpose',
                wordAllocation: 300,
                required: true,
                estimatedTime: '20 minutes'
            },
            {
                title: 'Getting Started',
                description: 'Setup and basic configuration',
                wordAllocation: 600,
                required: true,
                estimatedTime: '45 minutes',
                children: [
                    {
                        title: 'System Requirements',
                        description: 'Prerequisites and compatibility',
                        wordAllocation: 200
                    },
                    {
                        title: 'Installation',
                        description: 'Step-by-step installation guide',
                        wordAllocation: 200
                    },
                    {
                        title: 'Initial Setup',
                        description: 'First-time configuration',
                        wordAllocation: 200
                    }
                ]
            },
            {
                title: 'Features and Functions',
                description: 'Detailed feature explanations with examples',
                wordAllocation: 1500,
                required: true,
                estimatedTime: '2-3 hours',
                children: [
                    {
                        title: 'Core Features',
                        description: 'Main functionality overview',
                        wordAllocation: 750
                    },
                    {
                        title: 'Advanced Features',
                        description: 'Power user capabilities',
                        wordAllocation: 750
                    }
                ]
            },
            {
                title: 'Troubleshooting',
                description: 'Common problems and solutions',
                wordAllocation: 400,
                required: true,
                estimatedTime: '30 minutes'
            },
            {
                title: 'FAQ',
                description: 'Frequently asked questions',
                wordAllocation: 200,
                required: false,
                estimatedTime: '15 minutes'
            }
        ]
    })
];

// Template utility functions
export class TemplateUtils {
    static getTemplatesByCategory(category) {
        return SYSTEM_TEMPLATES.filter(template => template.category === category);
    }

    static getTemplatesByType(type) {
        return SYSTEM_TEMPLATES.filter(template => template.type === type);
    }

    static searchTemplates(query) {
        const lowerQuery = query.toLowerCase();
        return SYSTEM_TEMPLATES.filter(template => 
            template.name.toLowerCase().includes(lowerQuery) ||
            template.description.toLowerCase().includes(lowerQuery) ||
            template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    static getTemplateById(id) {
        return SYSTEM_TEMPLATES.find(template => template.id === id);
    }

    static validateTemplate(template) {
        if (!(template instanceof DocumentTemplate)) {
            return { isValid: false, errors: ['Template must be an instance of DocumentTemplate'] };
        }
        
        return template.validate();
    }

    static estimateReadingTime(wordCount) {
        // Average reading speed: 200-250 words per minute
        const wordsPerMinute = 225;
        const minutes = Math.ceil(wordCount / wordsPerMinute);
        
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
    }

    static getComplexityColor(complexity) {
        const colors = {
            beginner: '#4CAF50',
            intermediate: '#FF9800',
            advanced: '#F44336',
            expert: '#9C27B0'
        };
        return colors[complexity] || colors.intermediate;
    }

    static getCategoryIcon(category) {
        const icons = {
            [TEMPLATE_CATEGORIES.ACADEMIC]: '🎓',
            [TEMPLATE_CATEGORIES.BUSINESS]: '💼',
            [TEMPLATE_CATEGORIES.TECHNICAL]: '⚙️',
            [TEMPLATE_CATEGORIES.CREATIVE]: '🎨',
            [TEMPLATE_CATEGORIES.CUSTOM]: '📝'
        };
        return icons[category] || '📄';
    }
}

export default {
    DocumentTemplate,
    TEMPLATE_CATEGORIES,
    TEMPLATE_TYPES,
    SYSTEM_TEMPLATES,
    TemplateUtils
};