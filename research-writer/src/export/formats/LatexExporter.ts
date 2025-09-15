/**
 * LatexExporter - Academic LaTeX export processor
 * Generates professionally formatted LaTeX documents for academic use with package management
 */

import { FormatExporter, type DocumentStructure, type Section, type Figure, type Table, type ValidationResult } from './base/FormatExporter.js';
import { EXPORT_FORMATS, CITATION_STYLES } from '../types/index.js';
import { AcademicUtils, CitationUtils, MathUtils, MediaUtils, ReferenceUtils } from './utils/index.js';

export interface LatexOptions {
    documentClass: 'article' | 'report' | 'book' | 'memoir' | 'scrartcl' | 'scrreprt' | 'scrbook';
    fontSize: '10pt' | '11pt' | '12pt';
    paperSize: 'a4paper' | 'letterpaper' | 'a3paper' | 'legalpaper';
    twoSide: boolean;
    openRight: boolean;
    template: 'standard' | 'thesis' | 'journal' | 'conference' | 'book';
    encoding: 'utf8' | 'latin1';
    language: string;
    bibliography: 'biblatex' | 'natbib' | 'bibtex';
    mathPackage: 'amsmath' | 'mathtools' | 'none';
    figurePackage: 'graphicx' | 'graphics';
    tablePackage: 'array' | 'longtable' | 'booktabs';
    customPackages: string[];
    classOptions: string[];
}

export interface LatexPackage {
    name: string;
    options?: string[];
    required: boolean;
    description: string;
    category: 'core' | 'math' | 'graphics' | 'tables' | 'bibliography' | 'formatting' | 'typography' | 'custom';
}

export interface LatexEnvironment {
    name: string;
    begin: string;
    end: string;
    options?: string;
    content?: string;
}

export interface LatexCommand {
    name: string;
    syntax: string;
    arguments: number;
    optionalArgs?: number;
    description: string;
}

export interface LatexStructure {
    documentClass: string;
    packages: LatexPackage[];
    preamble: string[];
    frontMatter: string[];
    mainMatter: string[];
    backMatter: string[];
    bibliography?: string[];
}

export interface LatexProcessingResult {
    success: boolean;
    data: Uint8Array | null;
    filename: string;
    mimeType: string;
    metadata: {
        documentClass: string;
        packages: number;
        fileSize: number;
        template: string;
        [key: string]: any;
    };
    error?: string;
}

export interface CrossReferenceLabels {
    sections: Map<string, string>;
    figures: Map<string, number>;
    tables: Map<string, number>;
    equations: Map<string, number>;
}

export class LatexExporter extends FormatExporter {
    protected latexOptions: LatexOptions;
    protected packages: LatexPackage[];
    protected commands: LatexCommand[];

    constructor(options: any = {}) {
        super(EXPORT_FORMATS.LATEX, options);

        // LaTeX-specific options
        this.latexOptions = {
            documentClass: options.documentClass || 'article',
            fontSize: options.fontSize || '12pt',
            paperSize: options.paperSize || 'a4paper',
            twoSide: options.twoSide || false,
            openRight: options.openRight || false,
            template: options.template || 'standard',
            encoding: options.encoding || 'utf8',
            language: options.language || 'english',
            bibliography: options.bibliography || 'biblatex',
            mathPackage: options.mathPackage || 'amsmath',
            figurePackage: options.figurePackage || 'graphicx',
            tablePackage: options.tablePackage || 'booktabs',
            customPackages: options.customPackages || [],
            classOptions: options.classOptions || [],
            ...options.latex || {}
        };

        // Apply template-specific settings
        this.applyTemplate(this.latexOptions.template);

        // Initialize package management
        this.packages = [];
        this.commands = [];
        this.initializePackages();

        // LaTeX capabilities
        this.capabilities = {
            ...this.capabilities,
            format: EXPORT_FORMATS.LATEX,
            supportedFeatures: [
                'figures', 'tables', 'citations', 'bibliography', 'toc',
                'math', 'cross-references', 'appendices', 'index',
                'glossary', 'custom-commands', 'package-management'
            ],
            outputType: 'text',
            mimeType: 'text/x-latex',
            fileExtension: 'tex',
            supportedDocumentClasses: ['article', 'report', 'book', 'memoir', 'scrartcl', 'scrreprt', 'scrbook'],
            supportedBibliographyStyles: ['biblatex', 'natbib', 'bibtex']
        };
    }

    /**
     * Apply template-specific LaTeX settings
     */
    protected applyTemplate(template: string): void {
        switch (template.toLowerCase()) {
            case 'thesis':
                this.latexOptions.documentClass = 'report';
                this.latexOptions.twoSide = true;
                this.latexOptions.openRight = true;
                this.latexOptions.bibliography = 'biblatex';
                this.academicOptions.includeTOC = true;
                this.latexOptions.classOptions.push('openright', 'twoside');
                break;
            case 'journal':
                this.latexOptions.documentClass = 'article';
                this.latexOptions.fontSize = '11pt';
                this.latexOptions.bibliography = 'natbib';
                this.latexOptions.classOptions.push('twocolumn');
                break;
            case 'conference':
                this.latexOptions.documentClass = 'article';
                this.latexOptions.fontSize = '10pt';
                this.latexOptions.bibliography = 'natbib';
                this.latexOptions.classOptions.push('twocolumn');
                break;
            case 'book':
                this.latexOptions.documentClass = 'book';
                this.latexOptions.twoSide = true;
                this.latexOptions.openRight = true;
                this.latexOptions.bibliography = 'biblatex';
                break;
        }
    }

    /**
     * Initialize package management system
     */
    protected initializePackages(): void {
        // Core packages
        this.addPackage({
            name: 'inputenc',
            options: [this.latexOptions.encoding],
            required: true,
            description: 'Input encoding',
            category: 'core'
        });

        this.addPackage({
            name: 'fontenc',
            options: ['T1'],
            required: true,
            description: 'Font encoding',
            category: 'core'
        });

        this.addPackage({
            name: 'babel',
            options: [this.latexOptions.language],
            required: true,
            description: 'Language support',
            category: 'core'
        });

        // Math packages
        if (this.latexOptions.mathPackage !== 'none') {
            this.addPackage({
                name: this.latexOptions.mathPackage,
                required: true,
                description: 'Mathematical typesetting',
                category: 'math'
            });

            if (this.latexOptions.mathPackage === 'amsmath') {
                this.addPackage({
                    name: 'amssymb',
                    required: true,
                    description: 'AMS mathematical symbols',
                    category: 'math'
                });

                this.addPackage({
                    name: 'amsfonts',
                    required: true,
                    description: 'AMS mathematical fonts',
                    category: 'math'
                });
            }
        }

        // Graphics packages
        this.addPackage({
            name: this.latexOptions.figurePackage,
            required: true,
            description: 'Include graphics',
            category: 'graphics'
        });

        // Table packages
        this.addPackage({
            name: this.latexOptions.tablePackage,
            required: true,
            description: 'Enhanced table formatting',
            category: 'tables'
        });

        this.addPackage({
            name: 'array',
            required: true,
            description: 'Extended array and tabular',
            category: 'tables'
        });

        // Bibliography packages
        if (this.latexOptions.bibliography === 'biblatex') {
            this.addPackage({
                name: 'biblatex',
                options: ['style=authoryear', 'backend=biber'],
                required: true,
                description: 'Bibliography processing',
                category: 'bibliography'
            });
        } else if (this.latexOptions.bibliography === 'natbib') {
            this.addPackage({
                name: 'natbib',
                options: ['authoryear'],
                required: true,
                description: 'Natural sciences bibliography',
                category: 'bibliography'
            });
        }

        // Formatting packages
        this.addPackage({
            name: 'geometry',
            options: ['margin=1in'],
            required: true,
            description: 'Page layout customization',
            category: 'formatting'
        });

        this.addPackage({
            name: 'setspace',
            required: true,
            description: 'Line spacing control',
            category: 'formatting'
        });

        this.addPackage({
            name: 'fancyhdr',
            required: false,
            description: 'Fancy headers and footers',
            category: 'formatting'
        });

        // Typography packages
        this.addPackage({
            name: 'microtype',
            required: false,
            description: 'Micro-typography improvements',
            category: 'typography'
        });

        this.addPackage({
            name: 'hyperref',
            options: ['colorlinks=true', 'linkcolor=black', 'citecolor=black', 'urlcolor=blue'],
            required: false,
            description: 'Hyperlinks and PDF features',
            category: 'typography'
        });

        // Add custom packages
        for (const packageName of this.latexOptions.customPackages) {
            this.addPackage({
                name: packageName,
                required: false,
                description: 'Custom package',
                category: 'custom'
            });
        }
    }

    /**
     * Add package to the package list
     */
    protected addPackage(package_: LatexPackage): void {
        // Check if package already exists
        const existingIndex = this.packages.findIndex(p => p.name === package_.name);
        if (existingIndex >= 0) {
            // Update existing package
            this.packages[existingIndex] = { ...this.packages[existingIndex], ...package_ };
        } else {
            // Add new package
            this.packages.push(package_);
        }
    }

    /**
     * Get LaTeX-specific capabilities
     */
    protected getFormatSpecificCapabilities(): any {
        return {
            supportedDocumentClasses: ['article', 'report', 'book', 'memoir', 'scrartcl', 'scrreprt', 'scrbook'],
            supportedTemplates: ['standard', 'thesis', 'journal', 'conference', 'book'],
            supportedBibliographyStyles: ['biblatex', 'natbib', 'bibtex'],
            packageManagement: true,
            customCommands: true
        };
    }

    /**
     * Initialize LaTeX processor
     */
    async initializeProcessor(): Promise<void> {
        console.log('Initializing LaTeX processor...');

        // Validate LaTeX capabilities
        this.validateLatexCapabilities();

        console.log('LaTeX processor initialized with template:', this.latexOptions.template);
        console.log(`Loaded ${this.packages.length} packages`);
    }

    /**
     * Validate LaTeX capabilities
     */
    protected validateLatexCapabilities(): void {
        console.log('LaTeX generation capabilities validated');
    }

    /**
     * Process document for LaTeX export
     */
    async processDocument(document: DocumentStructure, options: any): Promise<LatexProcessingResult> {
        console.log('Processing document for LaTeX export...');

        try {
            // Generate cross-reference labels
            const labels = ReferenceUtils.generateLabels(document);

            // Create LaTeX document structure
            const latexStructure = await this.createLatexStructure(document, options, labels);

            // Generate LaTeX source code
            const latexSource = await this.generateLatexSource(latexStructure);

            // Create text data
            const latexData = new TextEncoder().encode(latexSource);

            return {
                success: true,
                data: latexData,
                filename: this.generateFilename(document),
                mimeType: 'text/x-latex',
                metadata: {
                    documentClass: this.latexOptions.documentClass,
                    packages: this.packages.length,
                    fileSize: latexData.length,
                    template: this.latexOptions.template,
                    ...this.extractLatexMetadata(document)
                }
            };

        } catch (error: any) {
            console.error('LaTeX processing failed:', error);
            return {
                success: false,
                error: `LaTeX generation failed: ${error.message}`,
                data: null,
                filename: '',
                mimeType: '',
                metadata: { documentClass: '', packages: 0, fileSize: 0, template: '' }
            };
        }
    }

    /**
     * Create LaTeX document structure
     */
    protected async createLatexStructure(document: DocumentStructure, options: any, labels: CrossReferenceLabels): Promise<LatexStructure> {
        const structure: LatexStructure = {
            documentClass: this.generateDocumentClass(),
            packages: this.packages,
            preamble: [],
            frontMatter: [],
            mainMatter: [],
            backMatter: []
        };

        // Add preamble commands
        structure.preamble.push(...this.generatePreamble(document));

        // Title and front matter
        if (this.shouldIncludeTitlePage(document)) {
            structure.frontMatter.push(...this.generateTitlePage(document));
        }

        // Abstract
        if (document.abstract && this.academicOptions.includeAbstract) {
            structure.frontMatter.push(...this.generateAbstract(document));
        }

        // Table of contents
        if (this.academicOptions.includeTOC) {
            structure.frontMatter.push('\\tableofcontents');
            structure.frontMatter.push('\\newpage');
        }

        // Main content
        for (const section of document.sections) {
            const latexSection = await this.processSectionForLatex(section, labels);
            structure.mainMatter.push(...latexSection);
        }

        // Bibliography
        if (document.bibliography && this.academicOptions.includeBibliography) {
            structure.backMatter.push(...this.generateBibliography(document.bibliography));
        }

        return structure;
    }

    /**
     * Generate document class declaration
     */
    protected generateDocumentClass(): string {
        const options = [
            this.latexOptions.fontSize,
            this.latexOptions.paperSize,
            ...this.latexOptions.classOptions
        ];

        if (this.latexOptions.twoSide) {
            options.push('twoside');
        }

        if (this.latexOptions.openRight && this.latexOptions.documentClass !== 'article') {
            options.push('openright');
        }

        return `\\documentclass[${options.join(',')}]{${this.latexOptions.documentClass}}`;
    }

    /**
     * Generate preamble
     */
    protected generatePreamble(document: DocumentStructure): string[] {
        const preamble: string[] = [];

        // Add package declarations
        for (const pkg of this.packages) {
            if (pkg.options && pkg.options.length > 0) {
                preamble.push(`\\usepackage[${pkg.options.join(',')}]{${pkg.name}}`);
            } else {
                preamble.push(`\\usepackage{${pkg.name}}`);
            }
        }

        // Document metadata
        if (document.title) {
            preamble.push(`\\title{${this.escapeLatex(document.title)}}`);
        }

        if (document.author) {
            preamble.push(`\\author{${this.escapeLatex(document.author)}}`);
        }

        if (document.date) {
            const formattedDate = this.formatDate(document.date);
            preamble.push(`\\date{${this.escapeLatex(formattedDate)}}`);
        } else {
            preamble.push('\\date{\\today}');
        }

        // Custom commands
        preamble.push(...this.generateCustomCommands());

        // Bibliography setup
        if (this.latexOptions.bibliography === 'biblatex') {
            preamble.push('\\addbibresource{references.bib}');
        }

        return preamble;
    }

    /**
     * Generate custom LaTeX commands
     */
    protected generateCustomCommands(): string[] {
        const commands: string[] = [];

        // Common academic commands
        commands.push('% Custom commands for academic writing');
        commands.push('\\newcommand{\\ie}{i.e.,\\xspace}');
        commands.push('\\newcommand{\\eg}{e.g.,\\xspace}');
        commands.push('\\newcommand{\\etc}{etc.\\xspace}');
        commands.push('\\newcommand{\\vs}{vs.\\xspace}');

        // Math commands
        if (this.latexOptions.mathPackage !== 'none') {
            commands.push('% Mathematical commands');
            commands.push('\\newcommand{\\R}{\\mathbb{R}}');
            commands.push('\\newcommand{\\N}{\\mathbb{N}}');
            commands.push('\\newcommand{\\Z}{\\mathbb{Z}}');
            commands.push('\\newcommand{\\Q}{\\mathbb{Q}}');
            commands.push('\\newcommand{\\C}{\\mathbb{C}}');
        }

        return commands;
    }

    /**
     * Check if title page should be included
     */
    protected shouldIncludeTitlePage(document: DocumentStructure): boolean {
        return !!(document.title || document.author);
    }

    /**
     * Generate title page
     */
    protected generateTitlePage(document: DocumentStructure): string[] {
        const titlePage: string[] = [];

        titlePage.push('\\maketitle');

        if (this.latexOptions.template === 'thesis' || this.latexOptions.template === 'book') {
            titlePage.push('\\newpage');
        }

        return titlePage;
    }

    /**
     * Generate abstract
     */
    protected generateAbstract(document: DocumentStructure): string[] {
        const abstract: string[] = [];

        if (document.abstract) {
            abstract.push('\\begin{abstract}');
            abstract.push(this.escapeLatex(document.abstract));

            // Add keywords if available
            if (document.keywords && document.keywords.length > 0) {
                abstract.push('');
                abstract.push(`\\textbf{Keywords:} ${document.keywords.map(k => this.escapeLatex(k)).join(', ')}`);
            }

            abstract.push('\\end{abstract}');
            abstract.push('\\newpage');
        }

        return abstract;
    }

    /**
     * Process section for LaTeX
     */
    protected async processSectionForLatex(section: Section, labels: CrossReferenceLabels): Promise<string[]> {
        const latexSection: string[] = [];

        // Section heading
        const sectionCommand = this.getSectionCommand(section.level);
        const title = this.escapeLatex(section.title);

        if (section.pageBreakBefore) {
            latexSection.push('\\newpage');
        }

        latexSection.push(`\\${sectionCommand}{${title}}\\label{sec:${section.id}}`);

        // Section content
        if (section.content) {
            const processedContent = this.processContentForLatex(section.content, labels);
            latexSection.push('');
            latexSection.push(processedContent);
        }

        // Figures
        if (section.figures && section.figures.length > 0) {
            for (const figure of section.figures) {
                latexSection.push('');
                latexSection.push(...this.generateFigure(figure));
            }
        }

        // Tables
        if (section.tables && section.tables.length > 0) {
            for (const table of section.tables) {
                latexSection.push('');
                latexSection.push(...this.generateTable(table));
            }
        }

        if (section.pageBreakAfter) {
            latexSection.push('\\newpage');
        }

        // Process subsections
        if (section.subsections && section.subsections.length > 0) {
            for (const subsection of section.subsections) {
                const subLatex = await this.processSectionForLatex(subsection, labels);
                latexSection.push('');
                latexSection.push(...subLatex);
            }
        }

        return latexSection;
    }

    /**
     * Get appropriate section command for level
     */
    protected getSectionCommand(level: number): string {
        if (this.latexOptions.documentClass === 'book' || this.latexOptions.documentClass === 'report') {
            switch (level) {
                case 1: return 'chapter';
                case 2: return 'section';
                case 3: return 'subsection';
                case 4: return 'subsubsection';
                case 5: return 'paragraph';
                case 6: return 'subparagraph';
                default: return 'section';
            }
        } else {
            switch (level) {
                case 1: return 'section';
                case 2: return 'subsection';
                case 3: return 'subsubsection';
                case 4: return 'paragraph';
                case 5: return 'subparagraph';
                default: return 'section';
            }
        }
    }

    /**
     * Process content for LaTeX format
     */
    protected processContentForLatex(content: string, labels: CrossReferenceLabels): string {
        if (!content) return '';

        // Resolve cross-references
        let processedContent = ReferenceUtils.resolveCrossReferences(content, labels);

        // Convert to LaTeX cross-references
        processedContent = this.convertCrossReferences(processedContent);

        // Process mathematical expressions
        processedContent = this.processMathForLatex(processedContent);

        // Process basic formatting
        processedContent = this.processBasicFormatting(processedContent);

        // Escape LaTeX special characters
        processedContent = this.escapeLatex(processedContent);

        return processedContent;
    }

    /**
     * Convert cross-references to LaTeX format
     */
    protected convertCrossReferences(content: string): string {
        let converted = content;

        // Convert resolved references back to LaTeX format
        converted = converted.replace(/Section (\d+(?:\.\d+)*)/g, '\\ref{sec:$1}');
        converted = converted.replace(/Figure (\d+)/g, '\\ref{fig:$1}');
        converted = converted.replace(/Table (\d+)/g, '\\ref{tab:$1}');
        converted = converted.replace(/Equation \((\d+)\)/g, '\\eqref{eq:$1}');

        return converted;
    }

    /**
     * Process mathematical expressions for LaTeX
     */
    protected processMathForLatex(content: string): string {
        if (!content) return content;

        // LaTeX math expressions are already in the correct format
        // Just ensure they are properly formatted

        let processed = content;

        // Convert simple math markers to LaTeX format if needed
        processed = processed.replace(/<math-inline>(.*?)<\/math-inline>/g, '$$$1$$');
        processed = processed.replace(/<math-block>(.*?)<\/math-block>/g, '\\begin{equation}\n$1\n\\end{equation}');

        return processed;
    }

    /**
     * Process basic text formatting for LaTeX
     */
    protected processBasicFormatting(content: string): string {
        let formatted = content;

        // Bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');

        // Italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '\\textit{$1}');

        // Code text
        formatted = formatted.replace(/`(.*?)`/g, '\\texttt{$1}');

        // Line breaks
        formatted = formatted.replace(/\n\s*\n/g, '\n\n');

        return formatted;
    }

    /**
     * Generate LaTeX figure environment
     */
    protected generateFigure(figure: Figure): string[] {
        const figureLatex: string[] = [];

        figureLatex.push('\\begin{figure}[htbp]');
        figureLatex.push('\\centering');

        if (figure.src) {
            const includegraphics = figure.width && figure.height ?
                `\\includegraphics[width=${figure.width}pt,height=${figure.height}pt]{${figure.src}}` :
                `\\includegraphics[width=0.8\\textwidth]{${figure.src}}`;
            figureLatex.push(includegraphics);
        }

        if (figure.caption) {
            figureLatex.push(`\\caption{${this.escapeLatex(figure.caption)}}\\label{fig:${figure.id}}`);
        }

        figureLatex.push('\\end{figure}');

        return figureLatex;
    }

    /**
     * Generate LaTeX table environment
     */
    protected generateTable(table: Table): string[] {
        const tableLatex: string[] = [];
        const processedTable = MediaUtils.processTableData(table);

        tableLatex.push('\\begin{table}[htbp]');
        tableLatex.push('\\centering');

        if (table.caption) {
            tableLatex.push(`\\caption{${this.escapeLatex(table.caption)}}\\label{tab:${table.id}}`);
        }

        // Generate column specification
        const colSpec = 'l'.repeat(processedTable.columnCount);
        tableLatex.push(`\\begin{tabular}{${colSpec}}`);

        if (this.latexOptions.tablePackage === 'booktabs') {
            tableLatex.push('\\toprule');
        } else {
            tableLatex.push('\\hline');
        }

        // Table headers
        if (processedTable.headers && processedTable.headers.length > 0) {
            const headers = processedTable.headers.map(h => this.escapeLatex(h)).join(' & ');
            tableLatex.push(`${headers} \\\\`);

            if (this.latexOptions.tablePackage === 'booktabs') {
                tableLatex.push('\\midrule');
            } else {
                tableLatex.push('\\hline');
            }
        }

        // Table rows
        if (processedTable.rows) {
            for (const row of processedTable.rows) {
                const rowData = row.map(cell => this.escapeLatex(cell)).join(' & ');
                tableLatex.push(`${rowData} \\\\`);
            }
        }

        if (this.latexOptions.tablePackage === 'booktabs') {
            tableLatex.push('\\bottomrule');
        } else {
            tableLatex.push('\\hline');
        }

        tableLatex.push('\\end{tabular}');
        tableLatex.push('\\end{table}');

        return tableLatex;
    }

    /**
     * Generate bibliography
     */
    protected generateBibliography(bibliography: any): string[] {
        const bibLatex: string[] = [];

        if (this.latexOptions.bibliography === 'biblatex') {
            bibLatex.push('\\printbibliography');
        } else if (this.latexOptions.bibliography === 'natbib') {
            bibLatex.push('\\bibliography{references}');
            bibLatex.push('\\bibliographystyle{plainnat}');
        } else {
            // Basic bibliography
            bibLatex.push('\\begin{thebibliography}{99}');

            const sortedEntries = CitationUtils.sortBibliography(bibliography.entries, bibliography.style);
            for (const entry of sortedEntries) {
                const key = entry.id || entry.key || 'unknown';
                const text = entry.formatted || entry.text || 'Unknown reference';
                bibLatex.push(`\\bibitem{${key}} ${this.escapeLatex(text)}`);
            }

            bibLatex.push('\\end{thebibliography}');
        }

        return bibLatex;
    }

    /**
     * Generate complete LaTeX source code
     */
    protected async generateLatexSource(structure: LatexStructure): Promise<string> {
        const source: string[] = [];

        // Document class
        source.push(structure.documentClass);
        source.push('');

        // Package declarations
        source.push('% Package declarations');
        for (const pkg of structure.packages) {
            if (pkg.options && pkg.options.length > 0) {
                source.push(`\\usepackage[${pkg.options.join(',')}]{${pkg.name}}`);
            } else {
                source.push(`\\usepackage{${pkg.name}}`);
            }
        }
        source.push('');

        // Preamble
        if (structure.preamble.length > 0) {
            source.push('% Document preamble');
            source.push(...structure.preamble);
            source.push('');
        }

        // Begin document
        source.push('\\begin{document}');
        source.push('');

        // Front matter
        if (structure.frontMatter.length > 0) {
            source.push('% Front matter');
            source.push(...structure.frontMatter);
            source.push('');
        }

        // Main matter
        if (structure.mainMatter.length > 0) {
            source.push('% Main content');
            source.push(...structure.mainMatter);
            source.push('');
        }

        // Back matter
        if (structure.backMatter.length > 0) {
            source.push('% Back matter');
            source.push(...structure.backMatter);
            source.push('');
        }

        // End document
        source.push('\\end{document}');

        return source.join('\n');
    }

    /**
     * Escape LaTeX special characters
     */
    protected escapeLatex(text: string): string {
        if (!text) return '';

        return text
            .replace(/\\/g, '\\textbackslash{}')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/\$/g, '\\$')
            .replace(/&/g, '\\&')
            .replace(/%/g, '\\%')
            .replace(/#/g, '\\#')
            .replace(/\^/g, '\\textasciicircum{}')
            .replace(/_/g, '\\_')
            .replace(/~/g, '\\textasciitilde{}');
    }

    /**
     * Extract LaTeX-specific metadata
     */
    protected extractLatexMetadata(document: DocumentStructure): any {
        const stats = this.getAcademicStats(document);

        return {
            documentStats: stats,
            latexOptions: this.latexOptions,
            academicOptions: this.academicOptions,
            packages: this.packages.map(p => ({
                name: p.name,
                category: p.category,
                required: p.required
            })),
            processingInfo: {
                template: this.latexOptions.template,
                documentClass: this.latexOptions.documentClass,
                bibliography: this.latexOptions.bibliography,
                mathPackage: this.latexOptions.mathPackage
            }
        };
    }

    /**
     * Generate filename for LaTeX document
     */
    protected generateFilename(document: DocumentStructure): string {
        const title = (document.title || 'document')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);

        const timestamp = new Date().toISOString().split('T')[0];
        return `${title}-${timestamp}.tex`;
    }

    /**
     * Format date for LaTeX
     */
    protected formatDate(date?: string | Date): string {
        if (!date) return new Date().toLocaleDateString();

        if (typeof date === 'string') {
            return new Date(date).toLocaleDateString();
        }

        if (date instanceof Date) {
            return date.toLocaleDateString();
        }

        return date.toString();
    }

    /**
     * Validate LaTeX-specific options
     */
    validateOptions(options: any): ValidationResult {
        const baseValidation = super.validateOptions(options);

        if (!baseValidation.valid) {
            return baseValidation;
        }

        const latexErrors: string[] = [];

        if (options.documentClass && !['article', 'report', 'book', 'memoir', 'scrartcl', 'scrreprt', 'scrbook'].includes(options.documentClass)) {
            latexErrors.push(`Invalid document class: ${options.documentClass}`);
        }

        if (options.fontSize && !['10pt', '11pt', '12pt'].includes(options.fontSize)) {
            latexErrors.push(`Invalid font size: ${options.fontSize}`);
        }

        if (options.paperSize && !['a4paper', 'letterpaper', 'a3paper', 'legalpaper'].includes(options.paperSize)) {
            latexErrors.push(`Invalid paper size: ${options.paperSize}`);
        }

        if (options.bibliography && !['biblatex', 'natbib', 'bibtex'].includes(options.bibliography)) {
            latexErrors.push(`Invalid bibliography style: ${options.bibliography}`);
        }

        return {
            valid: latexErrors.length === 0,
            errors: [...baseValidation.errors, ...latexErrors]
        };
    }

    /**
     * LaTeX-specific cleanup
     */
    async cleanupProcessor(): Promise<void> {
        console.log('Cleaning up LaTeX processor resources...');
        // Clean up any LaTeX generation resources
    }
}

export default LatexExporter;