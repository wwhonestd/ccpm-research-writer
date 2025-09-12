/**
 * LaTeXExportProcessor - LaTeX document generation and export
 * Handles conversion of compiled documents to LaTeX format with advanced formatting,
 * mathematical equations, academic styling, and professional typesetting
 */

export class LaTeXExportProcessor {
    constructor(options = {}) {
        this.options = {
            documentClass: options.documentClass || 'article',
            fontSize: options.fontSize || '12pt',
            paperSize: options.paperSize || 'letterpaper',
            twoSide: options.twoSide || false,
            titlePage: options.titlePage !== false,
            tableOfContents: options.tableOfContents !== false,
            listOfFigures: options.listOfFigures || false,
            listOfTables: options.listOfTables || false,
            bibliography: options.bibliography !== false,
            bibStyle: options.bibStyle || 'plain',
            packages: options.packages || [],
            customCommands: options.customCommands || [],
            mathMode: options.mathMode !== false,
            figureFloats: options.figureFloats !== false,
            hyperlinks: options.hyperlinks !== false,
            colors: options.colors || false,
            geometry: options.geometry || { margin: '1in' },
            ...options
        };

        this.isInitialized = false;
        this.packageRegistry = new Map();
        this.commandRegistry = new Map();
        this.citationCounter = 0;
        this.figureCounter = 0;
        this.tableCounter = 0;
        this.equationCounter = 0;
    }

    async init() {
        try {
            await this.initializePackages();
            await this.initializeCommands();
            this.isInitialized = true;
            console.log('LaTeX processor initialized');
        } catch (error) {
            console.error('LaTeX processor initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize standard LaTeX packages
     */
    async initializePackages() {
        // Essential packages
        this.packageRegistry.set('inputenc', { name: 'inputenc', options: ['utf8'] });
        this.packageRegistry.set('fontenc', { name: 'fontenc', options: ['T1'] });
        this.packageRegistry.set('babel', { name: 'babel', options: ['english'] });
        
        // Mathematical packages
        if (this.options.mathMode) {
            this.packageRegistry.set('amsmath', { name: 'amsmath' });
            this.packageRegistry.set('amsfonts', { name: 'amsfonts' });
            this.packageRegistry.set('amssymb', { name: 'amssymb' });
            this.packageRegistry.set('amsthm', { name: 'amsthm' });
        }

        // Graphics and figures
        if (this.options.figureFloats) {
            this.packageRegistry.set('graphicx', { name: 'graphicx' });
            this.packageRegistry.set('float', { name: 'float' });
            this.packageRegistry.set('subcaption', { name: 'subcaption' });
        }

        // Tables
        this.packageRegistry.set('array', { name: 'array' });
        this.packageRegistry.set('tabularx', { name: 'tabularx' });
        this.packageRegistry.set('booktabs', { name: 'booktabs' });

        // Hyperlinks
        if (this.options.hyperlinks) {
            this.packageRegistry.set('hyperref', { 
                name: 'hyperref',
                options: ['colorlinks=true', 'linkcolor=blue', 'citecolor=blue', 'urlcolor=blue']
            });
            this.packageRegistry.set('url', { name: 'url' });
        }

        // Colors
        if (this.options.colors) {
            this.packageRegistry.set('xcolor', { name: 'xcolor' });
        }

        // Geometry
        this.packageRegistry.set('geometry', { 
            name: 'geometry',
            options: this.formatGeometryOptions(this.options.geometry)
        });

        // Bibliography
        if (this.options.bibliography) {
            this.packageRegistry.set('natbib', { name: 'natbib' });
        }

        // Custom packages
        for (const pkg of this.options.packages) {
            if (typeof pkg === 'string') {
                this.packageRegistry.set(pkg, { name: pkg });
            } else {
                this.packageRegistry.set(pkg.name, pkg);
            }
        }

        console.log(`Initialized ${this.packageRegistry.size} LaTeX packages`);
    }

    /**
     * Initialize custom commands
     */
    async initializeCommands() {
        // Standard theorem environments
        if (this.options.mathMode) {
            this.commandRegistry.set('theoremstyle', '\\theoremstyle{plain}');
            this.commandRegistry.set('theorem', '\\newtheorem{theorem}{Theorem}');
            this.commandRegistry.set('lemma', '\\newtheorem{lemma}{Lemma}');
            this.commandRegistry.set('proposition', '\\newtheorem{proposition}{Proposition}');
            this.commandRegistry.set('corollary', '\\newtheorem{corollary}{Corollary}');
            this.commandRegistry.set('definition', '\\newtheorem{definition}{Definition}');
        }

        // Custom commands from options
        for (const command of this.options.customCommands) {
            if (typeof command === 'string') {
                this.commandRegistry.set(`custom_${Date.now()}`, command);
            } else {
                this.commandRegistry.set(command.name, command.definition);
            }
        }

        console.log(`Initialized ${this.commandRegistry.size} LaTeX commands`);
    }

    /**
     * Process compiled document to LaTeX
     */
    async process(compiledDocument, options = {}) {
        if (!this.isInitialized) {
            await this.init();
        }

        const processingOptions = { ...this.options, ...options };

        try {
            console.log('Starting LaTeX generation');

            // Reset counters
            this.resetCounters();

            // Step 1: Generate document preamble
            let latexContent = this.generatePreamble(compiledDocument, processingOptions);

            // Step 2: Begin document
            latexContent += '\\begin{document}\n\n';

            // Step 3: Add front matter
            latexContent += this.generateFrontMatter(compiledDocument, processingOptions);

            // Step 4: Add table of contents
            if (processingOptions.tableOfContents) {
                latexContent += this.generateTableOfContents(processingOptions);
            }

            // Step 5: Add lists of figures/tables
            if (processingOptions.listOfFigures) {
                latexContent += '\\listoffigures\n\\clearpage\n\n';
            }
            if (processingOptions.listOfTables) {
                latexContent += '\\listoftables\n\\clearpage\n\n';
            }

            // Step 6: Add main content
            latexContent += this.generateMainContent(compiledDocument, processingOptions);

            // Step 7: Add bibliography
            if (compiledDocument.bibliography && processingOptions.bibliography) {
                latexContent += this.generateBibliography(compiledDocument.bibliography, processingOptions);
            }

            // Step 8: End document
            latexContent += '\\end{document}\n';

            // Step 9: Post-process content
            latexContent = this.postProcessContent(latexContent, processingOptions);

            const latexBytes = Buffer.from(latexContent, 'utf8');

            return {
                data: latexBytes,
                mimeType: 'text/x-latex',
                filename: this.generateFilename(compiledDocument, 'tex'),
                metadata: {
                    characterCount: latexContent.length,
                    wordCount: this.estimateWordCount(latexContent),
                    size: latexBytes.length,
                    format: 'LaTeX',
                    documentClass: processingOptions.documentClass,
                    packages: Array.from(this.packageRegistry.keys()),
                    generator: 'Research Writer LaTeX Processor'
                }
            };

        } catch (error) {
            console.error('LaTeX generation failed:', error);
            throw new Error(`LaTeX generation failed: ${error.message}`);
        }
    }

    /**
     * Generate LaTeX preamble
     */
    generatePreamble(document, options) {
        let preamble = '';

        // Document class
        const classOptions = [options.fontSize, options.paperSize];
        if (options.twoSide) classOptions.push('twoside');
        if (options.titlePage) classOptions.push('titlepage');
        
        preamble += `\\documentclass[${classOptions.join(',')}]{${options.documentClass}}\n\n`;

        // Packages
        for (const pkg of this.packageRegistry.values()) {
            if (pkg.options && pkg.options.length > 0) {
                preamble += `\\usepackage[${pkg.options.join(',')}]{${pkg.name}}\n`;
            } else {
                preamble += `\\usepackage{${pkg.name}}\n`;
            }
        }
        preamble += '\n';

        // Custom commands
        for (const command of this.commandRegistry.values()) {
            preamble += command + '\n';
        }
        if (this.commandRegistry.size > 0) {
            preamble += '\n';
        }

        // Document metadata
        if (document.title) {
            preamble += `\\title{${this.escapeLatex(document.title)}}\n`;
        }
        if (document.author) {
            preamble += `\\author{${this.escapeLatex(document.author)}}\n`;
        }
        if (document.date) {
            const date = new Date(document.date).toLocaleDateString();
            preamble += `\\date{${this.escapeLatex(date)}}\n`;
        }
        preamble += '\n';

        return preamble;
    }

    /**
     * Generate front matter
     */
    generateFrontMatter(document, options) {
        let frontMatter = '';

        // Title page
        if (options.titlePage && document.title) {
            frontMatter += '\\maketitle\n';
            if (options.documentClass === 'article') {
                frontMatter += '\\thispagestyle{empty}\n';
            }
            frontMatter += '\\clearpage\n\n';
        }

        // Abstract
        if (document.abstract) {
            frontMatter += '\\begin{abstract}\n';
            frontMatter += this.processContentForLatex(document.abstract) + '\n';
            frontMatter += '\\end{abstract}\n';
            
            // Keywords
            if (document.keywords && document.keywords.length > 0) {
                frontMatter += '\\vspace{0.5cm}\n';
                frontMatter += '\\noindent\\textbf{Keywords:} ';
                frontMatter += document.keywords.map(k => this.escapeLatex(k)).join(', ') + '\n';
            }
            
            frontMatter += '\\clearpage\n\n';
        }

        return frontMatter;
    }

    /**
     * Generate table of contents
     */
    generateTableOfContents(options) {
        let toc = '\\tableofcontents\n\\clearpage\n\n';
        return toc;
    }

    /**
     * Generate main content
     */
    generateMainContent(document, options) {
        let content = '';

        if (document.sections && document.sections.length > 0) {
            for (const section of document.sections) {
                content += this.generateSection(section, options);
            }
        } else if (document.content) {
            content += this.processContentForLatex(document.content) + '\n\n';
        }

        return content;
    }

    /**
     * Generate section
     */
    generateSection(section, options) {
        let sectionContent = '';

        // Section heading
        const level = Math.min(section.level || 1, 3); // LaTeX supports up to subsubsection
        const commands = ['section', 'subsection', 'subsubsection'];
        const command = commands[level - 1] || 'subsubsection';

        if (section.title) {
            sectionContent += `\\${command}{${this.escapeLatex(section.title)}}\n`;
            if (section.label) {
                sectionContent += `\\label{${section.label}}\n`;
            }
            sectionContent += '\n';
        }

        // Section content
        if (section.content) {
            sectionContent += this.processContentForLatex(section.content) + '\n\n';
        }

        // Page break if specified
        if (section.pageBreakAfter) {
            sectionContent += '\\clearpage\n\n';
        }

        return sectionContent;
    }

    /**
     * Process content for LaTeX
     */
    processContentForLatex(content) {
        if (!content) return '';

        let processed = content;

        // Split into paragraphs
        const paragraphs = processed.split('\n\n');
        const latexParagraphs = [];

        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;

            const trimmed = paragraph.trim();

            // Handle different paragraph types
            if (trimmed.startsWith('#')) {
                // Inline heading (shouldn't happen in sections, but handle it)
                const level = (trimmed.match(/^#+/) || [''])[0].length;
                const text = trimmed.replace(/^#+\s*/, '');
                const commands = ['section', 'subsection', 'subsubsection'];
                const command = commands[Math.min(level, 3) - 1] || 'subsubsection';
                latexParagraphs.push(`\\${command}{${this.escapeLatex(text)}}`);
            } else if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
                // Display math
                const math = trimmed.slice(2, -2).trim();
                latexParagraphs.push(`\\begin{equation}\n${math}\n\\end{equation}`);
                this.equationCounter++;
            } else if (trimmed.startsWith('```')) {
                // Code block
                const lines = trimmed.split('\n');
                const language = lines[0].substring(3).trim();
                const code = lines.slice(1, -1).join('\n');
                latexParagraphs.push(`\\begin{verbatim}\n${code}\n\\end{verbatim}`);
            } else if (trimmed.includes('|') && trimmed.includes('\n')) {
                // Table
                const table = this.processTable(trimmed);
                if (table) {
                    latexParagraphs.push(table);
                }
            } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                // Bullet list
                const items = this.parseListItems(trimmed, /^[*-]\s+/);
                latexParagraphs.push(`\\begin{itemize}\n${items}\n\\end{itemize}`);
            } else if (/^\d+\.\s/.test(trimmed)) {
                // Numbered list
                const items = this.parseListItems(trimmed, /^\d+\.\s+/);
                latexParagraphs.push(`\\begin{enumerate}\n${items}\n\\end{enumerate}`);
            } else if (trimmed.startsWith('>')) {
                // Quote
                const quote = trimmed.replace(/^>\s*/gm, '');
                latexParagraphs.push(`\\begin{quote}\n${this.processInlineLatex(quote)}\n\\end{quote}`);
            } else {
                // Regular paragraph
                latexParagraphs.push(this.processInlineLatex(trimmed));
            }
        }

        return latexParagraphs.join('\n\n');
    }

    /**
     * Process inline LaTeX formatting
     */
    processInlineLatex(text) {
        let processed = text;

        // Math expressions
        processed = processed.replace(/\$([^$]+)\$/g, '$$$1$$');

        // Bold text
        processed = processed.replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}');

        // Italic text
        processed = processed.replace(/\*(.*?)\*/g, '\\textit{$1}');

        // Underlined text
        processed = processed.replace(/__(.+?)__/g, '\\underline{$1}');

        // Inline code
        processed = processed.replace(/`([^`]+)`/g, '\\texttt{$1}');

        // Citations
        processed = processed.replace(/\[@?([^\]]+)\]/g, (match, citation) => {
            this.citationCounter++;
            return `\\cite{${citation}}`;
        });

        // URLs
        processed = processed.replace(/https?:\/\/[^\s]+/g, (url) => {
            if (this.options.hyperlinks) {
                return `\\url{${url}}`;
            }
            return this.escapeLatex(url);
        });

        // Images
        processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]+)\})?/g, (match, caption, src, options) => {
            this.figureCounter++;
            let figure = '\\begin{figure}[htbp]\n\\centering\n';
            
            // Parse options for width, height, etc.
            const figOptions = options ? this.parseImageOptions(options) : {};
            const width = figOptions.width || '0.8\\textwidth';
            
            figure += `\\includegraphics[width=${width}]{${src}}\n`;
            if (caption) {
                figure += `\\caption{${this.escapeLatex(caption)}}\n`;
            }
            figure += '\\end{figure}';
            
            return figure;
        });

        // Escape remaining LaTeX special characters
        return this.escapeLatex(processed, true);
    }

    /**
     * Parse list items
     */
    parseListItems(listText, pattern) {
        const lines = listText.split('\n');
        const items = [];
        
        for (const line of lines) {
            if (pattern.test(line)) {
                const content = line.replace(pattern, '').trim();
                items.push(`\\item ${this.processInlineLatex(content)}`);
            }
        }
        
        return items.join('\n');
    }

    /**
     * Process table for LaTeX
     */
    processTable(tableText) {
        const lines = tableText.trim().split('\n');
        if (lines.length < 3) return null;

        const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
        const separator = lines[1];
        const dataLines = lines.slice(2);

        const rows = dataLines.map(line => 
            line.split('|').map(cell => cell.trim()).filter(cell => cell)
        );

        this.tableCounter++;

        let table = '\\begin{table}[htbp]\n\\centering\n';
        table += `\\begin{tabular}{${'c'.repeat(headers.length)}}\n`;
        table += '\\toprule\n';
        
        // Headers
        table += headers.map(h => this.escapeLatex(h)).join(' & ') + ' \\\\\n';
        table += '\\midrule\n';
        
        // Data rows
        for (const row of rows) {
            if (row.length > 0) {
                table += row.map(cell => this.processInlineLatex(cell)).join(' & ') + ' \\\\\n';
            }
        }
        
        table += '\\bottomrule\n';
        table += '\\end{tabular}\n';
        table += `\\caption{Table ${this.tableCounter}}\n`;
        table += '\\end{table}';

        return table;
    }

    /**
     * Parse image options
     */
    parseImageOptions(optionsStr) {
        const options = {};
        const pairs = optionsStr.split(',');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            if (key && value) {
                options[key] = value.replace(/['"]/g, '');
            }
        }
        
        return options;
    }

    /**
     * Generate bibliography
     */
    generateBibliography(bibliography, options) {
        let bib = '';

        if (bibliography.entries && bibliography.entries.length > 0) {
            bib += '\\clearpage\n';
            bib += `\\bibliographystyle{${options.bibStyle}}\n`;
            
            // If using external .bib file
            if (bibliography.bibFile) {
                bib += `\\bibliography{${bibliography.bibFile}}\n`;
            } else {
                // Inline bibliography
                bib += '\\begin{thebibliography}{99}\n';
                for (const entry of bibliography.entries) {
                    const key = entry.key || entry.id || `ref${Date.now()}`;
                    const formatted = entry.formatted || this.formatBibEntry(entry);
                    bib += `\\bibitem{${key}} ${formatted}\n\n`;
                }
                bib += '\\end{thebibliography}\n';
            }
        }

        return bib;
    }

    /**
     * Format bibliography entry
     */
    formatBibEntry(entry) {
        let formatted = '';
        
        if (entry.authors && entry.authors.length > 0) {
            formatted += entry.authors.join(', ') + '. ';
        }
        
        if (entry.title) {
            formatted += `\\textit{${this.escapeLatex(entry.title)}}. `;
        }
        
        if (entry.publication) {
            formatted += entry.publication + '. ';
        }
        
        if (entry.year) {
            formatted += entry.year + '.';
        }

        return formatted;
    }

    /**
     * Format geometry options
     */
    formatGeometryOptions(geometry) {
        if (typeof geometry === 'string') {
            return [geometry];
        }
        
        const options = [];
        for (const [key, value] of Object.entries(geometry)) {
            options.push(`${key}=${value}`);
        }
        return options;
    }

    /**
     * Post-process LaTeX content
     */
    postProcessContent(content, options) {
        let processed = content;

        // Clean up extra whitespace
        processed = processed.replace(/\n{3,}/g, '\n\n');
        
        // Ensure proper spacing around environments
        processed = processed.replace(/(\\begin\{[^}]+\})\n+/g, '$1\n');
        processed = processed.replace(/\n+(\\end\{[^}]+\})/g, '\n$1');

        return processed;
    }

    /**
     * Escape LaTeX special characters
     */
    escapeLatex(text, preserveFormatting = false) {
        if (typeof text !== 'string') return text;

        let escaped = text;

        if (preserveFormatting) {
            // Don't escape characters that are part of LaTeX commands
            escaped = escaped.replace(/([\\{}$&%#^_~])/g, (match, char) => {
                // Check if this character is part of a LaTeX command
                if (char === '\\' && /\\[a-zA-Z]+/.test(escaped.substr(escaped.indexOf(match)))) {
                    return char;
                }
                return this.getLatexEscape(char);
            });
        } else {
            // Escape all special characters
            const replacements = {
                '\\': '\\textbackslash{}',
                '{': '\\{',
                '}': '\\}',
                '$': '\\$',
                '&': '\\&',
                '%': '\\%',
                '#': '\\#',
                '^': '\\textasciicircum{}',
                '_': '\\_',
                '~': '\\textasciitilde{}'
            };
            
            escaped = escaped.replace(/[\\{}$&%#^_~]/g, match => replacements[match]);
        }

        return escaped;
    }

    /**
     * Get LaTeX escape for character
     */
    getLatexEscape(char) {
        const replacements = {
            '\\': '\\textbackslash{}',
            '{': '\\{',
            '}': '\\}',
            '$': '\\$',
            '&': '\\&',
            '%': '\\%',
            '#': '\\#',
            '^': '\\textasciicircum{}',
            '_': '\\_',
            '~': '\\textasciitilde{}'
        };
        return replacements[char] || char;
    }

    /**
     * Reset counters
     */
    resetCounters() {
        this.citationCounter = 0;
        this.figureCounter = 0;
        this.tableCounter = 0;
        this.equationCounter = 0;
    }

    /**
     * Estimate word count from LaTeX
     */
    estimateWordCount(latexContent) {
        // Remove LaTeX commands and count remaining words
        let textContent = latexContent
            .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})*\*?/g, '') // Remove commands
            .replace(/\{[^}]*\}/g, '') // Remove braces
            .replace(/\[[^\]]*\]/g, '') // Remove brackets
            .replace(/[%].*$/gm, '') // Remove comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        return textContent.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Generate filename
     */
    generateFilename(document, format) {
        const title = (document.title || 'document')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        const timestamp = new Date().toISOString().split('T')[0];
        return `${title}-${timestamp}.${format}`;
    }

    /**
     * Get context requirements
     */
    async getContextRequirements(options) {
        return {
            requiredFields: ['title', 'content'],
            optionalFields: ['author', 'abstract', 'keywords', 'sections', 'bibliography'],
            supportedOptions: [
                'documentClass', 'fontSize', 'paperSize', 'twoSide',
                'titlePage', 'tableOfContents', 'listOfFigures', 'listOfTables',
                'bibliography', 'bibStyle', 'mathMode', 'hyperlinks'
            ],
            outputFormat: 'text',
            maxContentLength: 5000000 // 5MB of text content
        };
    }

    /**
     * Cancel export
     */
    async cancelExport(exportId) {
        console.log(`LaTeX export cancellation requested for ${exportId}`);
        return false; // Not implemented in this simulation
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        this.packageRegistry.clear();
        this.commandRegistry.clear();
        this.resetCounters();
        this.isInitialized = false;
        console.log('LaTeX processor destroyed');
    }
}