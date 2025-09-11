/**
 * DragDropManager - Handles drag and drop functionality for outline nodes
 */
export class DragDropManager {
    constructor(outlineBuilder) {
        this.outlineBuilder = outlineBuilder;
        this.dragState = {
            isDragging: false,
            draggedNode: null,
            draggedElement: null,
            dropTarget: null,
            dropPosition: null, // 'before', 'after', 'inside'
            ghostElement: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 }
        };
        
        this.dropIndicator = null;
        this.bindEvents();
        this.createDropIndicator();
    }

    bindEvents() {
        // Use event delegation for dynamic content
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
        document.addEventListener('dragenter', this.handleDragEnter.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
        
        // Mouse events for better UX
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    createDropIndicator() {
        this.dropIndicator = document.createElement('div');
        this.dropIndicator.className = 'outline-drop-indicator';
        this.dropIndicator.style.position = 'absolute';
        this.dropIndicator.style.zIndex = '1001';
        document.body.appendChild(this.dropIndicator);
    }

    // Drag start handlers
    handleDragStart(e) {
        const nodeElement = e.target.closest('.outline-node__content');
        if (!nodeElement) return;

        const nodeId = nodeElement.dataset.nodeId;
        if (!nodeId) return;

        this.dragState.isDragging = true;
        this.dragState.draggedNode = this.outlineBuilder.findNode(nodeId);
        this.dragState.draggedElement = nodeElement;
        this.dragState.startPosition = { x: e.clientX, y: e.clientY };

        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', nodeId);
        e.dataTransfer.setData('application/outline-node', JSON.stringify({
            nodeId: nodeId,
            title: this.dragState.draggedNode.title,
            level: this.dragState.draggedNode.level
        }));

        // Create ghost element
        this.createGhostElement(nodeElement);

        // Add dragging class
        nodeElement.classList.add('outline-node__content--dragging');
        
        // Dispatch event
        this.outlineBuilder.emit('dragStart', {
            node: this.dragState.draggedNode,
            element: nodeElement
        });
    }

    createGhostElement(originalElement) {
        const ghost = originalElement.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.opacity = '0.8';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '1000';
        ghost.classList.add('outline-node__ghost');
        
        document.body.appendChild(ghost);
        this.dragState.ghostElement = ghost;
    }

    handleMouseDown(e) {
        const nodeElement = e.target.closest('.outline-node__content');
        if (!nodeElement) return;

        // Enable draggable
        nodeElement.draggable = true;
    }

    handleMouseMove(e) {
        if (this.dragState.isDragging && this.dragState.ghostElement) {
            this.dragState.currentPosition = { x: e.clientX, y: e.clientY };
            
            const ghost = this.dragState.ghostElement;
            ghost.style.left = (e.clientX + 10) + 'px';
            ghost.style.top = (e.clientY - 10) + 'px';
            ghost.style.transform = 'none';
        }
    }

    handleMouseUp(e) {
        const nodeElement = e.target.closest('.outline-node__content');
        if (nodeElement) {
            nodeElement.draggable = false;
        }
    }

    // Drag over handlers
    handleDragOver(e) {
        if (!this.dragState.isDragging) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetElement = this.findValidDropTarget(e.target);
        if (!targetElement) {
            this.hideDropIndicator();
            return;
        }

        const dropInfo = this.calculateDropPosition(targetElement, e.clientY);
        this.updateDropIndicator(targetElement, dropInfo);
        
        this.dragState.dropTarget = targetElement;
        this.dragState.dropPosition = dropInfo.position;
    }

    findValidDropTarget(element) {
        const nodeElement = element.closest('.outline-node__content');
        if (!nodeElement) {
            // Check if we're over a drop zone
            const dropZone = element.closest('.outline-drop-zone');
            return dropZone;
        }

        // Don't allow dropping on self or descendants
        const nodeId = nodeElement.dataset.nodeId;
        if (this.dragState.draggedNode && 
            (nodeId === this.dragState.draggedNode.id || 
             this.dragState.draggedNode.findNode(nodeId))) {
            return null;
        }

        return nodeElement;
    }

    calculateDropPosition(targetElement, clientY) {
        const rect = targetElement.getBoundingClientRect();
        const middleY = rect.top + (rect.height / 2);
        const quarterHeight = rect.height / 4;

        if (clientY < rect.top + quarterHeight) {
            return { position: 'before', rect };
        } else if (clientY > rect.bottom - quarterHeight) {
            return { position: 'after', rect };
        } else {
            return { position: 'inside', rect };
        }
    }

    updateDropIndicator(targetElement, dropInfo) {
        if (!this.dropIndicator) return;

        const rect = dropInfo.rect;
        let indicatorTop;
        let indicatorLeft = rect.left;
        let indicatorWidth = rect.width;

        switch (dropInfo.position) {
            case 'before':
                indicatorTop = rect.top - 1;
                break;
            case 'after':
                indicatorTop = rect.bottom + 1;
                break;
            case 'inside':
                indicatorTop = rect.top + rect.height - 2;
                indicatorLeft += 20; // Indent to show nesting
                indicatorWidth -= 20;
                break;
        }

        this.dropIndicator.style.top = indicatorTop + 'px';
        this.dropIndicator.style.left = indicatorLeft + 'px';
        this.dropIndicator.style.width = indicatorWidth + 'px';
        this.dropIndicator.classList.add('outline-drop-indicator--active');

        // Add visual feedback to target
        targetElement.classList.add('outline-node__content--drag-over');
    }

    hideDropIndicator() {
        if (this.dropIndicator) {
            this.dropIndicator.classList.remove('outline-drop-indicator--active');
        }

        // Remove drag-over class from all elements
        document.querySelectorAll('.outline-node__content--drag-over').forEach(el => {
            el.classList.remove('outline-node__content--drag-over');
        });
    }

    handleDragEnter(e) {
        if (!this.dragState.isDragging) return;
        e.preventDefault();
    }

    handleDragLeave(e) {
        if (!this.dragState.isDragging) return;
        
        // Only hide indicator if we're actually leaving the drop area
        const targetElement = this.findValidDropTarget(e.target);
        if (!targetElement) {
            this.hideDropIndicator();
        }
    }

    // Drop handler
    handleDrop(e) {
        if (!this.dragState.isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        const nodeId = e.dataTransfer.getData('text/plain');
        if (!nodeId || nodeId !== this.dragState.draggedNode.id) {
            return;
        }

        const targetElement = this.findValidDropTarget(e.target);
        if (!targetElement) {
            this.handleDragEnd();
            return;
        }

        const success = this.performDrop(targetElement);
        
        if (success) {
            this.outlineBuilder.emit('nodeMove', {
                node: this.dragState.draggedNode,
                target: targetElement,
                position: this.dragState.dropPosition
            });
        }

        this.handleDragEnd();
    }

    performDrop(targetElement) {
        const targetNodeId = targetElement.dataset.nodeId;
        const draggedNode = this.dragState.draggedNode;
        const position = this.dragState.dropPosition;

        try {
            if (targetElement.classList.contains('outline-drop-zone')) {
                // Dropping into empty area - make it a top-level node
                return this.outlineBuilder.moveNodeToRoot(draggedNode.id);
            }

            const targetNode = this.outlineBuilder.findNode(targetNodeId);
            if (!targetNode) return false;

            switch (position) {
                case 'before':
                    return this.outlineBuilder.moveNodeBefore(draggedNode.id, targetNode.id);
                case 'after':
                    return this.outlineBuilder.moveNodeAfter(draggedNode.id, targetNode.id);
                case 'inside':
                    return this.outlineBuilder.moveNodeInside(draggedNode.id, targetNode.id);
                default:
                    return false;
            }
        } catch (error) {
            console.error('Drop operation failed:', error);
            this.outlineBuilder.emit('error', {
                type: 'drop-failed',
                message: error.message,
                node: draggedNode
            });
            return false;
        }
    }

    // Drag end handler
    handleDragEnd(e) {
        if (!this.dragState.isDragging) return;

        // Clean up visual feedback
        this.hideDropIndicator();
        
        if (this.dragState.draggedElement) {
            this.dragState.draggedElement.classList.remove('outline-node__content--dragging');
            this.dragState.draggedElement.draggable = false;
        }

        // Remove ghost element
        if (this.dragState.ghostElement) {
            document.body.removeChild(this.dragState.ghostElement);
        }

        // Dispatch event
        this.outlineBuilder.emit('dragEnd', {
            node: this.dragState.draggedNode,
            success: this.dragState.dropTarget !== null
        });

        // Reset state
        this.resetDragState();
    }

    resetDragState() {
        this.dragState = {
            isDragging: false,
            draggedNode: null,
            draggedElement: null,
            dropTarget: null,
            dropPosition: null,
            ghostElement: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 }
        };
    }

    // Public API
    enableDragDrop() {
        this.enabled = true;
        document.querySelectorAll('.outline-node__content').forEach(element => {
            element.addEventListener('mousedown', this.enableDraggable.bind(this));
        });
    }

    disableDragDrop() {
        this.enabled = false;
        document.querySelectorAll('.outline-node__content').forEach(element => {
            element.draggable = false;
            element.removeEventListener('mousedown', this.enableDraggable.bind(this));
        });
    }

    enableDraggable(e) {
        if (!this.enabled) return;
        e.target.closest('.outline-node__content').draggable = true;
    }

    // Keyboard shortcuts for drag operations
    handleKeyboardShortcuts(e) {
        if (!this.outlineBuilder.selectedNode) return;

        const node = this.outlineBuilder.selectedNode;
        
        switch (e.code) {
            case 'ArrowUp':
                if (e.altKey) {
                    e.preventDefault();
                    this.outlineBuilder.moveNodeUp(node.id);
                }
                break;
            case 'ArrowDown':
                if (e.altKey) {
                    e.preventDefault();
                    this.outlineBuilder.moveNodeDown(node.id);
                }
                break;
            case 'ArrowLeft':
                if (e.altKey) {
                    e.preventDefault();
                    this.outlineBuilder.promoteNode(node.id);
                }
                break;
            case 'ArrowRight':
                if (e.altKey) {
                    e.preventDefault();
                    this.outlineBuilder.demoteNode(node.id);
                }
                break;
        }
    }

    // Touch support for mobile devices
    handleTouchStart(e) {
        if (e.touches.length !== 1) return;
        
        const nodeElement = e.target.closest('.outline-node__content');
        if (!nodeElement) return;

        this.touchState = {
            startTime: Date.now(),
            startTouch: {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            },
            element: nodeElement
        };
    }

    handleTouchMove(e) {
        if (!this.touchState) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchState.startTouch.x);
        const deltaY = Math.abs(touch.clientY - this.touchState.startTouch.y);
        
        // If moved significantly, start drag operation
        if (deltaX > 10 || deltaY > 10) {
            this.startTouchDrag(e);
        }
    }

    handleTouchEnd(e) {
        if (this.touchState) {
            const duration = Date.now() - this.touchState.startTime;
            
            // Short tap - select node
            if (duration < 200) {
                this.outlineBuilder.selectNode(this.touchState.element.dataset.nodeId);
            }
        }
        
        this.touchState = null;
    }

    startTouchDrag(e) {
        // Convert touch to drag event
        const nodeElement = this.touchState.element;
        const nodeId = nodeElement.dataset.nodeId;
        
        // Simulate drag start
        this.dragState.isDragging = true;
        this.dragState.draggedNode = this.outlineBuilder.findNode(nodeId);
        this.dragState.draggedElement = nodeElement;
        
        nodeElement.classList.add('outline-node__content--dragging');
    }

    // Cleanup
    destroy() {
        document.removeEventListener('dragstart', this.handleDragStart.bind(this));
        document.removeEventListener('dragend', this.handleDragEnd.bind(this));
        document.removeEventListener('dragover', this.handleDragOver.bind(this));
        document.removeEventListener('drop', this.handleDrop.bind(this));
        document.removeEventListener('dragenter', this.handleDragEnter.bind(this));
        document.removeEventListener('dragleave', this.handleDragLeave.bind(this));
        document.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));

        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }

        this.resetDragState();
    }
}