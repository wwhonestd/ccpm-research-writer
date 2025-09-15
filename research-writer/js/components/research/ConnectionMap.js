/**
 * ConnectionMap Component - Interactive network visualization for research connections
 * Visualizes relationships between literature, notes, and research themes
 */

import { AnalysisEngine } from '../../modules/research/AnalysisEngine.js';

export class ConnectionMap {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? 
            document.querySelector(container) : container;
        
        if (!this.container) {
            throw new Error('Container element not found');
        }

        this.analysisEngine = new AnalysisEngine();
        this.options = {
            projectId: null,
            width: 800,
            height: 600,
            autoResize: true,
            showLabels: true,
            enableZoom: true,
            enableDrag: true,
            physics: {
                enabled: true,
                repulsion: 500,
                attraction: 0.1,
                damping: 0.1
            },
            layout: 'force', // 'force', 'circular', 'hierarchical'
            colorScheme: {
                citation: '#2196F3',
                note: '#4CAF50',
                cluster: '#FF9800',
                directConnection: '#2196F3',
                semanticConnection: '#FFC107'
            },
            nodeSize: {
                min: 5,
                max: 30,
                scaling: 'connections' // 'connections', 'uniform', 'importance'
            },
            connectionStrength: {
                min: 0.3,
                showWeak: false,
                animate: true
            },
            clustering: {
                enabled: true,
                algorithm: 'modularity', // 'modularity', 'semantic', 'temporal'
                minClusterSize: 3
            },
            ...options
        };

        this.state = {
            loading: false,
            data: null,
            error: null,
            selectedNode: null,
            selectedCluster: null,
            hoveredNode: null,
            filteredNodes: new Set(),
            filteredEdges: new Set(),
            zoomLevel: 1,
            panOffset: { x: 0, y: 0 },
            animating: false,
            searchTerm: '',
            highlightMode: false
        };

        this.network = null;
        this.simulation = null;
        this.nodes = [];
        this.edges = [];
        this.clusters = [];
        
        this.init();
    }

    async init() {
        try {
            this.render();
            this.initializeVisualization();
            await this.loadData();
        } catch (error) {
            console.error('ConnectionMap initialization failed:', error);
            this.handleError(error);
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="connection-map">
                <div class="connection-map__header">
                    <h2>Research Connection Network</h2>
                    <div class="connection-map__controls">
                        <div class="search-controls">
                            <div class="search-input">
                                <input type="text" 
                                       class="network-search" 
                                       placeholder="Search nodes..."
                                       value="${this.state.searchTerm}">
                                <button class="search-clear" style="display: none;">×</button>
                            </div>
                            <div class="search-filters">
                                <label class="filter-label">
                                    <input type="checkbox" class="show-citations" checked>
                                    Citations
                                </label>
                                <label class="filter-label">
                                    <input type="checkbox" class="show-notes" checked>
                                    Notes
                                </label>
                                <label class="filter-label">
                                    <input type="checkbox" class="show-weak-connections">
                                    Weak Links
                                </label>
                            </div>
                        </div>
                        
                        <div class="layout-controls">
                            <label class="control-label">
                                Layout:
                                <select class="layout-selector">
                                    <option value="force" ${this.options.layout === 'force' ? 'selected' : ''}>Force-directed</option>
                                    <option value="circular" ${this.options.layout === 'circular' ? 'selected' : ''}>Circular</option>
                                    <option value="hierarchical" ${this.options.layout === 'hierarchical' ? 'selected' : ''}>Hierarchical</option>
                                </select>
                            </label>
                            
                            <label class="control-label">
                                Node Size:
                                <select class="node-sizing">
                                    <option value="connections" ${this.options.nodeSize.scaling === 'connections' ? 'selected' : ''}>By Connections</option>
                                    <option value="importance" ${this.options.nodeSize.scaling === 'importance' ? 'selected' : ''}>By Importance</option>
                                    <option value="uniform" ${this.options.nodeSize.scaling === 'uniform' ? 'selected' : ''}>Uniform</option>
                                </select>
                            </label>
                        </div>

                        <div class="action-controls">
                            <button class="btn btn--small btn--outline reset-view">
                                <span class="icon">🎯</span>
                                Reset View
                            </button>
                            <button class="btn btn--small btn--outline export-network">
                                <span class="icon">📊</span>
                                Export
                            </button>
                            <button class="btn btn--small btn--primary refresh-network">
                                <span class="icon">🔄</span>
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <div class="connection-map__content">
                    <div class="network-container">
                        <div class="loading-overlay" style="display: none;">
                            <div class="loading-spinner"></div>
                            <p>Building connection network...</p>
                        </div>

                        <div class="error-message" style="display: none;"></div>

                        <div class="network-canvas-container">
                            <svg class="network-canvas" width="${this.options.width}" height="${this.options.height}">
                                <defs>
                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                                            refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                                    </marker>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                        <feMerge> 
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                                <g class="network-zoom-container">
                                    <g class="edges-layer"></g>
                                    <g class="nodes-layer"></g>
                                    <g class="labels-layer"></g>
                                    <g class="clusters-layer"></g>
                                </g>
                            </svg>
                            
                            <div class="network-minimap">
                                <svg class="minimap-svg" width="150" height="100">
                                    <rect class="minimap-viewport" stroke="#2196F3" fill="none" stroke-width="2"></rect>
                                </svg>
                            </div>

                            <div class="network-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Nodes:</span>
                                    <span class="stat-value" data-stat="nodes">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Connections:</span>
                                    <span class="stat-value" data-stat="edges">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Clusters:</span>
                                    <span class="stat-value" data-stat="clusters">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Density:</span>
                                    <span class="stat-value" data-stat="density">0%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="network-sidebar">
                        <div class="node-details" style="display: none;">
                            <h3>Node Details</h3>
                            <div class="node-info">
                                <div class="node-title"></div>
                                <div class="node-type"></div>
                                <div class="node-metrics">
                                    <div class="metric-item">
                                        <span class="metric-label">Connections:</span>
                                        <span class="metric-value" data-metric="connections">0</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Importance:</span>
                                        <span class="metric-value" data-metric="importance">0</span>
                                    </div>
                                </div>
                                <div class="node-connections">
                                    <h4>Connected To:</h4>
                                    <div class="connections-list"></div>
                                </div>
                            </div>
                        </div>

                        <div class="cluster-details" style="display: none;">
                            <h3>Cluster Analysis</h3>
                            <div class="cluster-info">
                                <div class="cluster-title"></div>
                                <div class="cluster-metrics">
                                    <div class="metric-item">
                                        <span class="metric-label">Size:</span>
                                        <span class="metric-value" data-metric="cluster-size">0</span>
                                    </div>
                                    <div class="metric-item">
                                        <span class="metric-label">Density:</span>
                                        <span class="metric-value" data-metric="cluster-density">0%</span>
                                    </div>
                                </div>
                                <div class="cluster-keywords">
                                    <h4>Key Topics:</h4>
                                    <div class="keywords-list"></div>
                                </div>
                                <div class="cluster-items">
                                    <h4>Items in Cluster:</h4>
                                    <div class="items-list"></div>
                                </div>
                            </div>
                        </div>

                        <div class="network-insights">
                            <h3>Network Insights</h3>
                            <div class="insights-list"></div>
                        </div>
                    </div>
                </div>

                <div class="connection-map__legend">
                    <h4>Legend</h4>
                    <div class="legend-items">
                        <div class="legend-item">
                            <div class="legend-node legend-node--citation"></div>
                            <span>Citation</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-node legend-node--note"></div>
                            <span>Note</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-edge legend-edge--direct"></div>
                            <span>Direct Link</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-edge legend-edge--semantic"></div>
                            <span>Semantic Link</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-cluster"></div>
                            <span>Topic Cluster</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const container = this.container;

        // Search functionality
        const searchInput = container.querySelector('.network-search');
        const searchClear = container.querySelector('.search-clear');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchTerm = e.target.value;
                searchClear.style.display = this.state.searchTerm ? 'block' : 'none';
                this.handleSearch();
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                this.state.searchTerm = '';
                searchClear.style.display = 'none';
                this.clearSearch();
            });
        }

        // Filter controls
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('show-citations') ||
                e.target.classList.contains('show-notes') ||
                e.target.classList.contains('show-weak-connections')) {
                this.applyFilters();
            }
            
            if (e.target.classList.contains('layout-selector')) {
                this.options.layout = e.target.value;
                this.applyLayout();
            }
            
            if (e.target.classList.contains('node-sizing')) {
                this.options.nodeSize.scaling = e.target.value;
                this.updateNodeSizes();
            }
        });

        // Action buttons
        const resetBtn = container.querySelector('.reset-view');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        const exportBtn = container.querySelector('.export-network');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportNetwork());
        }

        const refreshBtn = container.querySelector('.refresh-network');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Canvas interactions
        if (this.options.autoResize) {
            window.addEventListener('resize', () => this.handleResize());
        }
    }

    initializeVisualization() {
        const svg = this.container.querySelector('.network-canvas');
        const zoomContainer = svg.querySelector('.network-zoom-container');
        
        // Initialize zoom and pan behavior
        if (this.options.enableZoom) {
            this.initializeZoom(svg, zoomContainer);
        }

        // Initialize minimap
        this.initializeMinimap();
    }

    initializeZoom(svg, container) {
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let initialPan = { x: 0, y: 0 };

        svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = svg.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.state.zoomLevel = Math.max(0.1, Math.min(5, this.state.zoomLevel * zoomFactor));
            
            this.updateZoom();
        });

        svg.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.options.enableDrag) {
                isDragging = true;
                dragStart = { x: e.clientX, y: e.clientY };
                initialPan = { ...this.state.panOffset };
                svg.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                
                this.state.panOffset = {
                    x: initialPan.x + dx,
                    y: initialPan.y + dy
                };
                
                this.updateZoom();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                svg.style.cursor = 'default';
            }
        });
    }

    initializeMinimap() {
        const minimap = this.container.querySelector('.minimap-svg');
        const viewport = minimap.querySelector('.minimap-viewport');
        
        minimap.addEventListener('click', (e) => {
            const rect = minimap.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            // Convert to main canvas coordinates
            const canvasWidth = this.options.width;
            const canvasHeight = this.options.height;
            
            this.state.panOffset = {
                x: -x * canvasWidth * this.state.zoomLevel + canvasWidth / 2,
                y: -y * canvasHeight * this.state.zoomLevel + canvasHeight / 2
            };
            
            this.updateZoom();
        });
    }

    async loadData() {
        try {
            this.setState({ loading: true, error: null });
            
            const data = await this.analysisEngine.analyzeConnections(
                this.options.projectId,
                {
                    maxNodes: 100,
                    minStrength: this.options.connectionStrength.min,
                    includeClusters: this.options.clustering.enabled
                }
            );

            this.setState({ data, loading: false });
            this.processNetworkData(data);
            this.renderNetwork();
            this.updateStats();
            this.generateInsights();
            
        } catch (error) {
            console.error('Failed to load connection data:', error);
            this.setState({ loading: false, error });
            this.handleError(error);
        }
    }

    setState(newState) {
        Object.assign(this.state, newState);
        
        if (newState.loading !== undefined) {
            this.toggleLoading(newState.loading);
        }
    }

    toggleLoading(show) {
        const overlay = this.container.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    handleError(error) {
        const errorElement = this.container.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = `Error: ${error.message}`;
            errorElement.style.display = 'block';
        }
    }

    processNetworkData(data) {
        // Process nodes
        this.nodes = data.visualization.nodes.map(node => ({
            id: node.id,
            type: node.type,
            size: this.calculateNodeSize(node),
            color: this.options.colorScheme[node.type] || '#666',
            connections: node.connections,
            importance: node.importance,
            x: Math.random() * this.options.width,
            y: Math.random() * this.options.height,
            vx: 0,
            vy: 0,
            title: this.getNodeTitle(node.id, node.type),
            visible: true
        }));

        // Process edges
        this.edges = data.visualization.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            strength: edge.strength,
            type: edge.type,
            color: edge.color,
            width: edge.width,
            visible: true
        }));

        // Process clusters
        this.clusters = data.clusters.map((cluster, index) => ({
            id: cluster.id,
            items: cluster.items,
            keywords: cluster.keywords,
            strength: cluster.strength,
            color: this.generateClusterColor(index),
            center: { x: 0, y: 0 },
            radius: this.calculateClusterRadius(cluster.items.length)
        }));

        // Calculate cluster positions
        this.calculateClusterPositions();
    }

    calculateNodeSize(node) {
        const { min, max, scaling } = this.options.nodeSize;
        
        switch (scaling) {
            case 'connections':
                const maxConnections = Math.max(...this.nodes?.map(n => n.connections) || [node.connections]);
                return min + (max - min) * (node.connections / maxConnections);
            
            case 'importance':
                return min + (max - min) * node.importance;
            
            case 'uniform':
            default:
                return (min + max) / 2;
        }
    }

    getNodeTitle(nodeId, nodeType) {
        // This would integrate with the actual note/citation data
        // For now, return a placeholder
        return `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${nodeId}`;
    }

    calculateClusterPositions() {
        // Simple circular layout for clusters
        const centerX = this.options.width / 2;
        const centerY = this.options.height / 2;
        const radius = Math.min(this.options.width, this.options.height) * 0.3;

        this.clusters.forEach((cluster, index) => {
            const angle = (index / this.clusters.length) * 2 * Math.PI;
            cluster.center = {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            };
        });
    }

    calculateClusterRadius(itemCount) {
        return Math.max(30, Math.min(100, itemCount * 10));
    }

    generateClusterColor(index) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        return colors[index % colors.length];
    }

    renderNetwork() {
        this.renderClusters();
        this.renderEdges();
        this.renderNodes();
        
        if (this.options.showLabels) {
            this.renderLabels();
        }

        if (this.options.physics.enabled) {
            this.startSimulation();
        }
    }

    renderClusters() {
        const clustersLayer = this.container.querySelector('.clusters-layer');
        
        const clusterElements = clustersLayer.selectAll ? 
            clustersLayer.selectAll('.cluster') : 
            this.selectAllCustom(clustersLayer, '.cluster');

        // Create cluster backgrounds
        this.clusters.forEach(cluster => {
            const clusterElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            clusterElement.setAttribute('class', 'cluster');
            clusterElement.setAttribute('cx', cluster.center.x);
            clusterElement.setAttribute('cy', cluster.center.y);
            clusterElement.setAttribute('r', cluster.radius);
            clusterElement.setAttribute('fill', cluster.color);
            clusterElement.setAttribute('fill-opacity', '0.1');
            clusterElement.setAttribute('stroke', cluster.color);
            clusterElement.setAttribute('stroke-width', '2');
            clusterElement.setAttribute('stroke-dasharray', '5,5');
            
            clusterElement.addEventListener('click', () => this.selectCluster(cluster));
            
            clustersLayer.appendChild(clusterElement);
        });
    }

    renderEdges() {
        const edgesLayer = this.container.querySelector('.edges-layer');
        edgesLayer.innerHTML = '';

        this.edges.forEach(edge => {
            if (!edge.visible) return;

            const sourceNode = this.nodes.find(n => n.id === edge.source);
            const targetNode = this.nodes.find(n => n.id === edge.target);
            
            if (!sourceNode || !targetNode) return;

            const edgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            edgeElement.setAttribute('class', `edge edge--${edge.type}`);
            edgeElement.setAttribute('x1', sourceNode.x);
            edgeElement.setAttribute('y1', sourceNode.y);
            edgeElement.setAttribute('x2', targetNode.x);
            edgeElement.setAttribute('y2', targetNode.y);
            edgeElement.setAttribute('stroke', edge.color);
            edgeElement.setAttribute('stroke-width', edge.width);
            edgeElement.setAttribute('stroke-opacity', '0.6');
            
            if (edge.type === 'semantic') {
                edgeElement.setAttribute('stroke-dasharray', '3,3');
            }
            
            edgesLayer.appendChild(edgeElement);
        });
    }

    renderNodes() {
        const nodesLayer = this.container.querySelector('.nodes-layer');
        nodesLayer.innerHTML = '';

        this.nodes.forEach(node => {
            if (!node.visible) return;

            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeGroup.setAttribute('class', `node node--${node.type}`);
            nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);

            // Node circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', node.size);
            circle.setAttribute('fill', node.color);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            
            // Node icon (simple approach)
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            icon.setAttribute('text-anchor', 'middle');
            icon.setAttribute('dy', '0.35em');
            icon.setAttribute('fill', 'white');
            icon.setAttribute('font-size', Math.min(node.size / 2, 12));
            icon.textContent = node.type === 'citation' ? '📄' : '📝';

            nodeGroup.appendChild(circle);
            nodeGroup.appendChild(icon);

            // Event listeners
            nodeGroup.addEventListener('click', () => this.selectNode(node));
            nodeGroup.addEventListener('mouseenter', () => this.hoverNode(node));
            nodeGroup.addEventListener('mouseleave', () => this.unhoverNode(node));

            nodesLayer.appendChild(nodeGroup);
        });
    }

    renderLabels() {
        const labelsLayer = this.container.querySelector('.labels-layer');
        labelsLayer.innerHTML = '';

        this.nodes.forEach(node => {
            if (!node.visible || node.size < 10) return; // Only show labels for larger nodes

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('class', 'node-label');
            label.setAttribute('x', node.x);
            label.setAttribute('y', node.y + node.size + 15);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '10px');
            label.setAttribute('fill', '#333');
            
            // Truncate long titles
            const maxLength = 20;
            const title = node.title.length > maxLength ? 
                node.title.substring(0, maxLength) + '...' : node.title;
            label.textContent = title;

            labelsLayer.appendChild(label);
        });
    }

    startSimulation() {
        if (this.simulation) {
            this.simulation.stop();
        }

        // Simple physics simulation
        let iterations = 0;
        const maxIterations = 1000;
        
        this.simulation = setInterval(() => {
            this.updatePhysics();
            this.updatePositions();
            
            iterations++;
            if (iterations >= maxIterations) {
                clearInterval(this.simulation);
                this.simulation = null;
            }
        }, 16); // ~60fps
    }

    updatePhysics() {
        const { repulsion, attraction, damping } = this.options.physics;

        // Apply repulsion between all nodes
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const node1 = this.nodes[i];
                const node2 = this.nodes[j];
                
                const dx = node2.x - node1.x;
                const dy = node2.y - node1.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const force = repulsion / (distance * distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                
                node1.vx -= fx;
                node1.vy -= fy;
                node2.vx += fx;
                node2.vy += fy;
            }
        }

        // Apply attraction along edges
        this.edges.forEach(edge => {
            if (!edge.visible) return;

            const source = this.nodes.find(n => n.id === edge.source);
            const target = this.nodes.find(n => n.id === edge.target);
            
            if (!source || !target) return;

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const force = attraction * edge.strength * distance;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
        });

        // Apply damping and update positions
        this.nodes.forEach(node => {
            node.vx *= damping;
            node.vy *= damping;
            
            node.x += node.vx;
            node.y += node.vy;
            
            // Keep nodes within bounds
            const margin = node.size;
            node.x = Math.max(margin, Math.min(this.options.width - margin, node.x));
            node.y = Math.max(margin, Math.min(this.options.height - margin, node.y));
        });
    }

    updatePositions() {
        // Update rendered elements with new positions
        const nodesLayer = this.container.querySelector('.nodes-layer');
        const nodes = nodesLayer.querySelectorAll('.node');
        
        nodes.forEach((element, index) => {
            const node = this.nodes[index];
            if (node) {
                element.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            }
        });

        const edgesLayer = this.container.querySelector('.edges-layer');
        const edges = edgesLayer.querySelectorAll('.edge');
        
        edges.forEach((element, index) => {
            const edge = this.edges[index];
            if (edge && edge.visible) {
                const sourceNode = this.nodes.find(n => n.id === edge.source);
                const targetNode = this.nodes.find(n => n.id === edge.target);
                
                if (sourceNode && targetNode) {
                    element.setAttribute('x1', sourceNode.x);
                    element.setAttribute('y1', sourceNode.y);
                    element.setAttribute('x2', targetNode.x);
                    element.setAttribute('y2', targetNode.y);
                }
            }
        });

        if (this.options.showLabels) {
            const labelsLayer = this.container.querySelector('.labels-layer');
            const labels = labelsLayer.querySelectorAll('.node-label');
            
            labels.forEach((element, index) => {
                const node = this.nodes[index];
                if (node && node.visible) {
                    element.setAttribute('x', node.x);
                    element.setAttribute('y', node.y + node.size + 15);
                }
            });
        }
    }

    updateZoom() {
        const container = this.container.querySelector('.network-zoom-container');
        container.setAttribute('transform', 
            `translate(${this.state.panOffset.x}, ${this.state.panOffset.y}) scale(${this.state.zoomLevel})`
        );

        this.updateMinimap();
    }

    updateMinimap() {
        const viewport = this.container.querySelector('.minimap-viewport');
        const minimapWidth = 150;
        const minimapHeight = 100;
        
        const viewportWidth = this.options.width / this.state.zoomLevel;
        const viewportHeight = this.options.height / this.state.zoomLevel;
        
        const x = (-this.state.panOffset.x / this.state.zoomLevel) * (minimapWidth / this.options.width);
        const y = (-this.state.panOffset.y / this.state.zoomLevel) * (minimapHeight / this.options.height);
        const width = (viewportWidth / this.options.width) * minimapWidth;
        const height = (viewportHeight / this.options.height) * minimapHeight;
        
        viewport.setAttribute('x', Math.max(0, Math.min(minimapWidth - width, x)));
        viewport.setAttribute('y', Math.max(0, Math.min(minimapHeight - height, y)));
        viewport.setAttribute('width', Math.min(minimapWidth, width));
        viewport.setAttribute('height', Math.min(minimapHeight, height));
    }

    selectNode(node) {
        this.state.selectedNode = node;
        this.updateNodeDetails(node);
        this.highlightConnectedNodes(node);
    }

    selectCluster(cluster) {
        this.state.selectedCluster = cluster;
        this.updateClusterDetails(cluster);
        this.highlightClusterNodes(cluster);
    }

    hoverNode(node) {
        this.state.hoveredNode = node;
        // Add hover effects
    }

    unhoverNode(node) {
        this.state.hoveredNode = null;
        // Remove hover effects
    }

    updateNodeDetails(node) {
        const details = this.container.querySelector('.node-details');
        const title = details.querySelector('.node-title');
        const type = details.querySelector('.node-type');
        const connections = details.querySelector('[data-metric="connections"]');
        const importance = details.querySelector('[data-metric="importance"]');
        const connectionsList = details.querySelector('.connections-list');

        title.textContent = node.title;
        type.textContent = node.type.charAt(0).toUpperCase() + node.type.slice(1);
        connections.textContent = node.connections;
        importance.textContent = (node.importance * 100).toFixed(0) + '%';

        // Show connected nodes
        const connectedEdges = this.edges.filter(e => 
            e.source === node.id || e.target === node.id
        );
        
        connectionsList.innerHTML = connectedEdges.slice(0, 10).map(edge => {
            const connectedNodeId = edge.source === node.id ? edge.target : edge.source;
            const connectedNode = this.nodes.find(n => n.id === connectedNodeId);
            
            return `
                <div class="connection-item">
                    <span class="connection-type">${edge.type}</span>
                    <span class="connection-node">${connectedNode?.title || connectedNodeId}</span>
                    <span class="connection-strength">${(edge.strength * 100).toFixed(0)}%</span>
                </div>
            `;
        }).join('');

        details.style.display = 'block';
        this.container.querySelector('.cluster-details').style.display = 'none';
    }

    updateClusterDetails(cluster) {
        const details = this.container.querySelector('.cluster-details');
        const title = details.querySelector('.cluster-title');
        const size = details.querySelector('[data-metric="cluster-size"]');
        const density = details.querySelector('[data-metric="cluster-density"]');
        const keywordsList = details.querySelector('.keywords-list');
        const itemsList = details.querySelector('.items-list');

        title.textContent = `Cluster ${cluster.id}`;
        size.textContent = cluster.items.length;
        density.textContent = (cluster.strength * 100).toFixed(0) + '%';

        keywordsList.innerHTML = cluster.keywords.slice(0, 10).map(keyword => 
            `<span class="keyword-tag">${keyword}</span>`
        ).join('');

        itemsList.innerHTML = cluster.items.slice(0, 15).map(item => 
            `<div class="cluster-item">${item.title || item.id}</div>`
        ).join('');

        details.style.display = 'block';
        this.container.querySelector('.node-details').style.display = 'none';
    }

    highlightConnectedNodes(node) {
        // Implementation for highlighting connected nodes
        this.state.highlightMode = true;
        // Add visual highlighting logic
    }

    highlightClusterNodes(cluster) {
        // Implementation for highlighting cluster nodes
        this.state.highlightMode = true;
        // Add visual highlighting logic
    }

    handleSearch() {
        if (!this.state.searchTerm) {
            this.clearSearch();
            return;
        }

        const term = this.state.searchTerm.toLowerCase();
        this.nodes.forEach(node => {
            const matches = node.title.toLowerCase().includes(term) ||
                          node.type.toLowerCase().includes(term);
            node.visible = matches;
        });

        this.renderNetwork();
    }

    clearSearch() {
        this.nodes.forEach(node => {
            node.visible = true;
        });
        this.renderNetwork();
    }

    applyFilters() {
        const showCitations = this.container.querySelector('.show-citations').checked;
        const showNotes = this.container.querySelector('.show-notes').checked;
        const showWeak = this.container.querySelector('.show-weak-connections').checked;

        this.nodes.forEach(node => {
            node.visible = (node.type === 'citation' && showCitations) ||
                          (node.type === 'note' && showNotes);
        });

        this.edges.forEach(edge => {
            edge.visible = showWeak || edge.strength > 0.5;
        });

        this.renderNetwork();
    }

    applyLayout() {
        switch (this.options.layout) {
            case 'circular':
                this.applyCircularLayout();
                break;
            case 'hierarchical':
                this.applyHierarchicalLayout();
                break;
            case 'force':
            default:
                this.startSimulation();
                break;
        }
    }

    applyCircularLayout() {
        const centerX = this.options.width / 2;
        const centerY = this.options.height / 2;
        const radius = Math.min(this.options.width, this.options.height) * 0.4;

        this.nodes.forEach((node, index) => {
            const angle = (index / this.nodes.length) * 2 * Math.PI;
            node.x = centerX + Math.cos(angle) * radius;
            node.y = centerY + Math.sin(angle) * radius;
        });

        this.updatePositions();
    }

    applyHierarchicalLayout() {
        // Simple hierarchical layout based on node importance
        const levels = 3;
        const levelHeight = this.options.height / (levels + 1);
        
        const sortedNodes = [...this.nodes].sort((a, b) => b.importance - a.importance);
        const nodesPerLevel = Math.ceil(sortedNodes.length / levels);

        sortedNodes.forEach((node, index) => {
            const level = Math.floor(index / nodesPerLevel);
            const positionInLevel = index % nodesPerLevel;
            const levelWidth = this.options.width / (nodesPerLevel + 1);

            node.x = (positionInLevel + 1) * levelWidth;
            node.y = (level + 1) * levelHeight;
        });

        this.updatePositions();
    }

    updateNodeSizes() {
        this.nodes.forEach(node => {
            node.size = this.calculateNodeSize(node);
        });
        this.renderNodes();
    }

    updateStats() {
        if (!this.state.data) return;

        const container = this.container;
        const visibleNodes = this.nodes.filter(n => n.visible);
        const visibleEdges = this.edges.filter(e => e.visible);
        
        container.querySelector('[data-stat="nodes"]').textContent = visibleNodes.length;
        container.querySelector('[data-stat="edges"]').textContent = visibleEdges.length;
        container.querySelector('[data-stat="clusters"]').textContent = this.clusters.length;
        container.querySelector('[data-stat="density"]').textContent = 
            (this.state.data.metrics.density * 100).toFixed(1) + '%';
    }

    generateInsights() {
        if (!this.state.data || !this.state.data.insights) return;

        const insightsList = this.container.querySelector('.insights-list');
        insightsList.innerHTML = this.state.data.insights.map(insight => `
            <div class="insight-item insight-item--${insight.level}">
                <div class="insight-icon">${this.getInsightIcon(insight.type)}</div>
                <div class="insight-content">
                    <h4>${insight.message}</h4>
                    ${insight.details ? `<p>${insight.details}</p>` : ''}
                    ${insight.recommendation ? `<p class="insight-recommendation">${insight.recommendation}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    getInsightIcon(type) {
        const icons = {
            connectivity: '🔗',
            clustering: '🎯',
            isolation: '⚠️'
        };
        return icons[type] || 'ℹ️';
    }

    resetView() {
        this.state.zoomLevel = 1;
        this.state.panOffset = { x: 0, y: 0 };
        this.updateZoom();
    }

    handleResize() {
        const rect = this.container.getBoundingClientRect();
        this.options.width = rect.width - 40; // Account for padding
        this.options.height = rect.height - 100; // Account for header

        const svg = this.container.querySelector('.network-canvas');
        svg.setAttribute('width', this.options.width);
        svg.setAttribute('height', this.options.height);

        this.renderNetwork();
    }

    async exportNetwork() {
        try {
            const exportData = {
                nodes: this.nodes,
                edges: this.edges,
                clusters: this.clusters,
                metadata: {
                    exported: new Date().toISOString(),
                    projectId: this.options.projectId,
                    layout: this.options.layout,
                    stats: this.state.data?.metrics
                }
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `connection-network-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export network');
        }
    }

    // Utility method for custom element selection (fallback for browsers without d3)
    selectAllCustom(parent, selector) {
        return Array.from(parent.querySelectorAll(selector));
    }

    // Public API methods
    refresh() {
        return this.loadData();
    }

    setProjectId(projectId) {
        this.options.projectId = projectId;
        return this.loadData();
    }

    getNetworkData() {
        return {
            nodes: this.nodes,
            edges: this.edges,
            clusters: this.clusters
        };
    }

    destroy() {
        if (this.simulation) {
            clearInterval(this.simulation);
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}