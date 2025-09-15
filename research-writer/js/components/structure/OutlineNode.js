/**
 * OutlineNode - Hierarchical node structure for document outlines
 */
export class OutlineNode {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || 'Untitled Section';
        this.level = data.level || 1;
        this.parentId = data.parentId || null;
        this.children = (data.children || []).map(child => 
            child instanceof OutlineNode ? child : new OutlineNode(child)
        );
        this.collapsed = data.collapsed || false;
        this.wordCount = data.wordCount || 0;
        this.allocatedWords = data.allocatedWords || 0;
        this.created = data.created || new Date().toISOString();
        this.updated = data.updated || new Date().toISOString();
        this.notes = data.notes || '';
        this.tags = data.tags || [];
        this.status = data.status || 'draft'; // draft, in-progress, completed
        this.order = data.order || 0;
        this.metadata = data.metadata || {};
    }

    generateId() {
        return 'outline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Node manipulation methods
    addChild(nodeData = {}) {
        const childNode = nodeData instanceof OutlineNode ? nodeData : new OutlineNode({
            ...nodeData,
            level: this.level + 1,
            parentId: this.id,
            order: this.children.length
        });
        
        this.children.push(childNode);
        this.updated = new Date().toISOString();
        return childNode;
    }

    removeChild(childId) {
        const childIndex = this.children.findIndex(child => child.id === childId);
        if (childIndex === -1) {
            return false;
        }

        const removedChild = this.children.splice(childIndex, 1)[0];
        this.reorderChildren();
        this.updated = new Date().toISOString();
        return removedChild;
    }

    moveChild(childId, newIndex) {
        const childIndex = this.children.findIndex(child => child.id === childId);
        if (childIndex === -1 || newIndex < 0 || newIndex >= this.children.length) {
            return false;
        }

        const [child] = this.children.splice(childIndex, 1);
        this.children.splice(newIndex, 0, child);
        this.reorderChildren();
        this.updated = new Date().toISOString();
        return true;
    }

    reorderChildren() {
        this.children.forEach((child, index) => {
            child.order = index;
        });
    }

    // Tree traversal methods
    findNode(nodeId) {
        if (this.id === nodeId) {
            return this;
        }

        for (const child of this.children) {
            const found = child.findNode(nodeId);
            if (found) {
                return found;
            }
        }

        return null;
    }

    findParent(nodeId, root = this) {
        for (const child of this.children) {
            if (child.id === nodeId) {
                return this;
            }
            
            const found = child.findParent(nodeId, root);
            if (found) {
                return found;
            }
        }

        return null;
    }

    getAllNodes() {
        const nodes = [this];
        for (const child of this.children) {
            nodes.push(...child.getAllNodes());
        }
        return nodes;
    }

    getPath() {
        const path = [];
        let current = this;
        while (current) {
            path.unshift(current.title);
            current = current.parentId ? this.findNode(current.parentId) : null;
        }
        return path;
    }

    // Hierarchy management
    canMoveToLevel(newLevel) {
        return newLevel >= 1 && newLevel <= 6; // Support up to 6 levels
    }

    moveToLevel(newLevel) {
        if (!this.canMoveToLevel(newLevel)) {
            throw new Error(`Invalid level: ${newLevel}. Must be between 1 and 6.`);
        }

        const levelDifference = newLevel - this.level;
        this.level = newLevel;

        // Recursively update children levels
        this.children.forEach(child => {
            child.moveToLevel(child.level + levelDifference);
        });

        this.updated = new Date().toISOString();
        return this;
    }

    promote() {
        if (this.level > 1) {
            return this.moveToLevel(this.level - 1);
        }
        return this;
    }

    demote() {
        if (this.level < 6) {
            return this.moveToLevel(this.level + 1);
        }
        return this;
    }

    // Word count management
    updateWordCount(count) {
        this.wordCount = Math.max(0, count);
        this.updated = new Date().toISOString();
        return this;
    }

    allocateWords(count) {
        this.allocatedWords = Math.max(0, count);
        this.updated = new Date().toISOString();
        return this;
    }

    getTotalWordCount() {
        return this.wordCount + this.children.reduce((total, child) => {
            return total + child.getTotalWordCount();
        }, 0);
    }

    getTotalAllocatedWords() {
        return this.allocatedWords + this.children.reduce((total, child) => {
            return total + child.getTotalAllocatedWords();
        }, 0);
    }

    getWordCountStatus() {
        const allocated = this.allocatedWords;
        const actual = this.wordCount;
        
        if (allocated === 0) return 'unallocated';
        if (actual === 0) return 'empty';
        if (actual <= allocated) return 'within-limit';
        return 'exceeded';
    }

    // Validation methods
    validate() {
        const errors = [];
        const warnings = [];

        // Title validation
        if (!this.title || this.title.trim().length === 0) {
            errors.push('Node title cannot be empty');
        }

        if (this.title.length > 200) {
            warnings.push('Node title is very long (>200 characters)');
        }

        // Level validation
        if (this.level < 1 || this.level > 6) {
            errors.push(`Invalid level: ${this.level}. Must be between 1 and 6.`);
        }

        // Word count validation
        if (this.wordCount < 0) {
            errors.push('Word count cannot be negative');
        }

        if (this.allocatedWords < 0) {
            errors.push('Allocated word count cannot be negative');
        }

        // Children validation
        for (const child of this.children) {
            if (child.level !== this.level + 1) {
                errors.push(`Child node level mismatch: expected ${this.level + 1}, got ${child.level}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Export/Import methods
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            level: this.level,
            parentId: this.parentId,
            children: this.children.map(child => child.toJSON()),
            collapsed: this.collapsed,
            wordCount: this.wordCount,
            allocatedWords: this.allocatedWords,
            created: this.created,
            updated: this.updated,
            notes: this.notes,
            tags: this.tags,
            status: this.status,
            order: this.order,
            metadata: this.metadata
        };
    }

    static fromJSON(data) {
        return new OutlineNode(data);
    }

    // Clone methods
    clone(includeChildren = true) {
        const clonedData = {
            ...this.toJSON(),
            id: this.generateId(),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        if (!includeChildren) {
            clonedData.children = [];
        }

        return new OutlineNode(clonedData);
    }

    // Statistics methods
    getStats() {
        const allNodes = this.getAllNodes();
        const levels = {};
        let totalWords = 0;
        let totalAllocated = 0;

        allNodes.forEach(node => {
            levels[node.level] = (levels[node.level] || 0) + 1;
            totalWords += node.wordCount;
            totalAllocated += node.allocatedWords;
        });

        return {
            totalNodes: allNodes.length,
            depth: Math.max(...Object.keys(levels).map(Number)),
            levelDistribution: levels,
            totalWords,
            totalAllocated,
            avgWordsPerNode: totalWords / allNodes.length,
            completionRate: totalWords / (totalAllocated || 1)
        };
    }

    // Search methods
    search(query, fields = ['title', 'notes']) {
        const results = [];
        const searchTerm = query.toLowerCase();

        const searchNode = (node) => {
            const matches = fields.some(field => {
                const value = node[field];
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(searchTerm);
                } else if (Array.isArray(value)) {
                    return value.some(item => 
                        typeof item === 'string' && item.toLowerCase().includes(searchTerm)
                    );
                }
                return false;
            });

            if (matches) {
                results.push(node);
            }

            node.children.forEach(searchNode);
        };

        searchNode(this);
        return results;
    }

    // Display helpers
    getDisplayTitle() {
        return this.title || 'Untitled Section';
    }

    getIndentLevel() {
        return Math.max(0, this.level - 1);
    }

    hasChildren() {
        return this.children.length > 0;
    }

    isLeaf() {
        return this.children.length === 0;
    }

    // Event system for UI integration
    static createEventHandlers() {
        return {
            onTitleChange: (nodeId, newTitle) => {},
            onNodeAdd: (parentId, nodeData) => {},
            onNodeRemove: (nodeId) => {},
            onNodeMove: (nodeId, newParentId, newIndex) => {},
            onWordCountChange: (nodeId, newCount) => {},
            onCollapse: (nodeId, collapsed) => {},
            onValidation: (nodeId, validation) => {}
        };
    }
}

// Utility functions for outline management
export class OutlineUtils {
    static generateOutlineFromText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const root = new OutlineNode({ title: 'Document Outline', level: 0 });
        const stack = [root];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Detect heading level based on markdown-style markers
            let level = 1;
            let title = trimmed;

            if (trimmed.startsWith('#')) {
                const hashCount = trimmed.match(/^#+/)[0].length;
                level = Math.min(hashCount, 6);
                title = trimmed.substring(hashCount).trim();
            } else if (trimmed.match(/^\d+\./)) {
                level = 1;
                title = trimmed.replace(/^\d+\./, '').trim();
            }

            // Find appropriate parent
            while (stack.length > level) {
                stack.pop();
            }

            const parent = stack[stack.length - 1];
            const node = parent.addChild({ title, level: parent.level + 1 });
            stack.push(node);
        });

        return root;
    }

    static exportToMarkdown(node, depth = 0) {
        let markdown = '';
        const indent = '  '.repeat(depth);
        const heading = '#'.repeat(Math.max(1, node.level));

        if (node.level > 0) {
            markdown += `${heading} ${node.title}\n`;
            if (node.notes) {
                markdown += `\n${node.notes}\n`;
            }
            markdown += '\n';
        }

        node.children.forEach(child => {
            markdown += OutlineUtils.exportToMarkdown(child, depth);
        });

        return markdown;
    }

    static validateStructure(root) {
        const validation = root.validate();
        const allNodes = root.getAllNodes();
        
        // Additional structure validation
        const structureWarnings = [];
        
        // Check for very deep nesting
        const maxDepth = Math.max(...allNodes.map(node => node.level));
        if (maxDepth > 5) {
            structureWarnings.push(`Very deep nesting detected (${maxDepth} levels). Consider restructuring.`);
        }

        // Check for nodes with too many children
        allNodes.forEach(node => {
            if (node.children.length > 10) {
                structureWarnings.push(`Node "${node.title}" has many children (${node.children.length}). Consider grouping.`);
            }
        });

        return {
            ...validation,
            structureWarnings
        };
    }
}