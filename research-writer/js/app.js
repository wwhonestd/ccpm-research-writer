/**
 * Research Writer - Main Application Controller
 * Handles navigation, module management, and accessibility features
 */

class ResearchWriterApp {
    constructor() {
        this.currentModule = 'welcome';
        this.modules = ['welcome', 'search', 'collect', 'organize', 'write', 'export'];
        this.isInitialized = false;
        
        // Bind methods to preserve context
        this.handleNavigation = this.handleNavigation.bind(this);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.handleWorkflowStep = this.handleWorkflowStep.bind(this);
        
        this.init();
    }
    
    /**
     * Initialize the application
     */
    init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Research Writer App...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    /**
     * Set up the application after DOM is ready
     */
    setup() {
        try {
            this.setupEventListeners();
            this.setupAccessibility();
            this.setupResponsiveFeatures();
            this.loadInitialModule();
            
            this.isInitialized = true;
            console.log('Research Writer App initialized successfully');
            
            // Announce app readiness to screen readers
            this.announceToScreenReader('Research Writer application is ready');
            
        } catch (error) {
            console.error('Error initializing Research Writer App:', error);
            this.handleError('Failed to initialize application', error);
        }
    }
    
    /**
     * Set up event listeners for navigation and interaction
     */
    setupEventListeners() {
        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', this.handleNavigation);
        });
        
        // Workflow step buttons
        const stepButtons = document.querySelectorAll('.step-btn');
        stepButtons.forEach(button => {
            button.addEventListener('click', this.handleWorkflowStep);
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboard);
        
        // Tool buttons (settings, help)
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(button => {
            button.addEventListener('click', this.handleToolButton);
        });
        
        // Handle browser back/forward navigation
        window.addEventListener('popstate', this.handlePopState.bind(this));
    }
    
    /**
     * Set up accessibility features
     */
    setupAccessibility() {
        // Create announcements container if it doesn't exist
        if (!document.getElementById('announcements')) {
            const announcements = document.createElement('div');
            announcements.id = 'announcements';
            announcements.className = 'sr-only';
            announcements.setAttribute('aria-live', 'polite');
            announcements.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcements);
        }
        
        // Set up focus management
        this.setupFocusManagement();
        
        // Add ARIA labels where needed
        this.enhanceAriaLabels();
    }
    
    /**
     * Set up responsive features and viewport handling
     */
    setupResponsiveFeatures() {
        // Handle viewport changes
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (!viewportMeta) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0';
            document.head.appendChild(meta);
        }
        
        // Handle orientation changes on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResponsiveLayout();
            }, 100);
        });
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResponsiveLayout();
            }, 150);
        });
    }
    
    /**
     * Handle navigation between modules
     */
    handleNavigation(event) {
        event.preventDefault();
        
        const target = event.currentTarget;
        const moduleId = target.getAttribute('data-module');
        
        if (moduleId && this.modules.includes(moduleId)) {
            this.switchToModule(moduleId);
            
            // Update URL without page refresh
            const url = moduleId === 'welcome' ? './' : `./#${moduleId}`;
            history.pushState({ module: moduleId }, '', url);
        }
    }
    
    /**
     * Handle workflow step button clicks
     */
    handleWorkflowStep(event) {
        const target = event.currentTarget;
        const moduleId = target.getAttribute('data-target');
        
        if (moduleId && this.modules.includes(moduleId)) {
            this.switchToModule(moduleId);
            
            // Update URL
            const url = `./#${moduleId}`;
            history.pushState({ module: moduleId }, '', url);
            
            // Announce transition
            this.announceToScreenReader(`Switched to ${moduleId} module`);
        }
    }
    
    /**
     * Handle tool button clicks (settings, help)
     */
    handleToolButton(event) {
        const button = event.currentTarget;
        const label = button.getAttribute('aria-label');
        
        console.log(`Tool button clicked: ${label}`);
        
        // Placeholder for future implementation
        if (label === 'Settings') {
            this.announceToScreenReader('Settings panel not yet implemented');
        } else if (label === 'Help') {
            this.announceToScreenReader('Help documentation not yet implemented');
        }
    }
    
    /**
     * Switch to a specific module
     */
    switchToModule(moduleId) {
        if (!this.modules.includes(moduleId)) {
            console.warn(`Invalid module: ${moduleId}`);
            return;
        }
        
        if (this.currentModule === moduleId) return;
        
        const previousModule = this.currentModule;
        this.currentModule = moduleId;
        
        // Hide all modules
        const allModules = document.querySelectorAll('.module');
        allModules.forEach(module => {
            module.classList.add('hidden');
            module.setAttribute('aria-hidden', 'true');
        });
        
        // Show target module
        const targetModule = document.getElementById(`${moduleId}-module`);
        if (targetModule) {
            targetModule.classList.remove('hidden');
            targetModule.removeAttribute('aria-hidden');
            
            // Update page title
            const moduleTitle = targetModule.querySelector('h2');
            if (moduleTitle) {
                document.title = `${moduleTitle.textContent} - Research Writer`;
            }
            
            // Focus management
            this.manageFocus(targetModule);
        }
        
        // Update navigation active states
        this.updateNavigationStates(moduleId);
        
        console.log(`Switched from ${previousModule} to ${moduleId} module`);
    }
    
    /**
     * Update navigation link active states
     */
    updateNavigationStates(activeModule) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const moduleId = link.getAttribute('data-module');
            if (moduleId === activeModule) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    }
    
    /**
     * Manage focus when switching modules
     */
    manageFocus(targetModule) {
        // Find the first focusable element in the module
        const focusableElements = targetModule.querySelectorAll(
            'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            // Focus on the module header first
            const header = targetModule.querySelector('h2');
            if (header) {
                header.focus();
            } else {
                focusableElements[0].focus();
            }
        }
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeyboard(event) {
        // Handle Escape key to return to welcome
        if (event.key === 'Escape' && this.currentModule !== 'welcome') {
            this.switchToModule('welcome');
            history.pushState({ module: 'welcome' }, '', './');
        }
        
        // Handle arrow keys for module navigation
        if (event.altKey) {
            const currentIndex = this.modules.indexOf(this.currentModule);
            let newIndex = currentIndex;
            
            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                newIndex = currentIndex - 1;
                event.preventDefault();
            } else if (event.key === 'ArrowRight' && currentIndex < this.modules.length - 1) {
                newIndex = currentIndex + 1;
                event.preventDefault();
            }
            
            if (newIndex !== currentIndex) {
                const newModule = this.modules[newIndex];
                this.switchToModule(newModule);
                
                const url = newModule === 'welcome' ? './' : `./#${newModule}`;
                history.pushState({ module: newModule }, '', url);
            }
        }
    }
    
    /**
     * Handle browser back/forward navigation
     */
    handlePopState(event) {
        const state = event.state;
        if (state && state.module) {
            this.switchToModule(state.module);
        } else {
            // Handle direct URL navigation
            const hash = window.location.hash.slice(1);
            const moduleId = hash || 'welcome';
            if (this.modules.includes(moduleId)) {
                this.switchToModule(moduleId);
            }
        }
    }
    
    /**
     * Load initial module based on URL
     */
    loadInitialModule() {
        const hash = window.location.hash.slice(1);
        const initialModule = hash && this.modules.includes(hash) ? hash : 'welcome';
        
        this.switchToModule(initialModule);
        
        // Set initial history state
        const url = initialModule === 'welcome' ? './' : `./#${initialModule}`;
        history.replaceState({ module: initialModule }, '', url);
    }
    
    /**
     * Set up focus management system
     */
    setupFocusManagement() {
        // Store the last focused element before module switch
        this.lastFocusedElement = null;
        
        document.addEventListener('focusin', (event) => {
            this.lastFocusedElement = event.target;
        });
        
        // Handle focus trapping in modals (future enhancement)
        this.setupFocusTrapping();
    }
    
    /**
     * Set up focus trapping for modal dialogs
     */
    setupFocusTrapping() {
        // This will be used for future modal implementations
        this.focusTrap = {
            active: false,
            container: null,
            firstFocusable: null,
            lastFocusable: null
        };
    }
    
    /**
     * Enhance ARIA labels for better accessibility
     */
    enhanceAriaLabels() {
        // Add role descriptions where helpful
        const workflowSteps = document.querySelectorAll('.workflow-step');
        workflowSteps.forEach((step, index) => {
            step.setAttribute('role', 'article');
            step.setAttribute('aria-label', `Step ${index + 1}: ${step.querySelector('h3').textContent}`);
        });
        
        // Enhance navigation
        const moduleContainer = document.querySelector('.module-container');
        if (moduleContainer) {
            moduleContainer.setAttribute('role', 'main');
            moduleContainer.setAttribute('aria-label', 'Module content');
        }
    }
    
    /**
     * Handle responsive layout changes
     */
    handleResponsiveLayout() {
        const isMobile = window.innerWidth < 768;
        
        // Adjust navigation for mobile
        const navList = document.querySelector('.nav-list');
        if (navList) {
            if (isMobile) {
                navList.setAttribute('role', 'tablist');
            } else {
                navList.setAttribute('role', 'menubar');
            }
        }
        
        console.log(`Layout adjusted for ${isMobile ? 'mobile' : 'desktop'} view`);
    }
    
    /**
     * Announce messages to screen readers
     */
    announceToScreenReader(message) {
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = message;
            
            // Clear after a delay to allow re-announcement of same message
            setTimeout(() => {
                announcements.textContent = '';
            }, 1000);
        }
    }
    
    /**
     * Handle application errors gracefully
     */
    handleError(message, error) {
        console.error(message, error);
        
        // Announce error to screen readers
        this.announceToScreenReader(`Error: ${message}`);
        
        // Could implement error reporting or user feedback here
        // For now, we'll just log and continue
    }
    
    /**
     * Get current application state
     */
    getState() {
        return {
            currentModule: this.currentModule,
            isInitialized: this.isInitialized,
            availableModules: this.modules
        };
    }
    
    /**
     * Cleanup method for destroying the app instance
     */
    destroy() {
        // Remove event listeners
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.removeEventListener('click', this.handleNavigation);
        });
        
        const stepButtons = document.querySelectorAll('.step-btn');
        stepButtons.forEach(button => {
            button.removeEventListener('click', this.handleWorkflowStep);
        });
        
        document.removeEventListener('keydown', this.handleKeyboard);
        window.removeEventListener('popstate', this.handlePopState);
        
        this.isInitialized = false;
        console.log('Research Writer App destroyed');
    }
}

// Initialize the application when script loads
const app = new ResearchWriterApp();

// Export for potential use in other modules
window.ResearchWriterApp = ResearchWriterApp;
window.app = app;

// Development helpers
if (typeof window !== 'undefined' && window.console) {
    window.console.log('Research Writer App loaded. Use window.app to access the application instance.');
}