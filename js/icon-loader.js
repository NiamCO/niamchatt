// icon-loader.js - Simple icon loader utility
class IconLoader {
    constructor() {
        this.loaded = false;
        this.attempts = 0;
        this.maxAttempts = 10;
        
        this.startLoading();
    }
    
    startLoading() {
        this.attempts++;
        
        if (window.getIcon && typeof window.getIcon === 'function') {
            this.loaded = true;
            this.loadAllIcons();
        } else if (this.attempts < this.maxAttempts) {
            // Try again in 100ms
            setTimeout(() => this.startLoading(), 100);
        } else {
            console.error('Failed to load icons: getIcon function not available');
        }
    }
    
    loadAllIcons() {
        // This will be called from chat.html
        if (typeof window.loadAllIcons === 'function') {
            window.loadAllIcons();
        }
        
        // Also load dynamic icons that might be created later
        this.setupMutationObserver();
    }
    
    setupMutationObserver() {
        // Watch for new elements that might need icons
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    // Check if any new elements need icons
                    this.checkNewElements(mutation.addedNodes);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    checkNewElements(nodes) {
        nodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
                // Check if this element or its children need icons
                if (node.classList && (
                    node.classList.contains('icon-small') ||
                    node.classList.contains('input-btn-icon') ||
                    node.classList.contains('send-btn-icon') ||
                    node.classList.contains('sidebar-btn-icon') ||
                    node.classList.contains('room-icon') ||
                    node.classList.contains('theme-icon') ||
                    node.classList.contains('theme-icon-small') ||
                    node.classList.contains('notification-icon')
                )) {
                    // This element might need an icon
                    this.tryLoadIcon(node);
                }
                
                // Check children
                if (node.querySelectorAll) {
                    const iconElements = node.querySelectorAll('.icon-small, .input-btn-icon, .send-btn-icon, .sidebar-btn-icon, .room-icon, .theme-icon, .theme-icon-small, .notification-icon');
                    iconElements.forEach(el => this.tryLoadIcon(el));
                }
            }
        });
    }
    
    tryLoadIcon(element) {
        // Try to guess icon name from class or parent
        if (!element.innerHTML || element.innerHTML.trim() === '') {
            const classList = Array.from(element.classList);
            const parentClass = element.parentElement ? Array.from(element.parentElement.classList) : [];
            
            // Look for icon name in classes
            const allClasses = [...classList, ...parentClass];
            const iconClass = allClasses.find(cls => cls.includes('icon-'));
            
            if (iconClass) {
                const iconName = iconClass.replace('icon-', '');
                if (window.getIcon && window.getIcon(iconName)) {
                    element.innerHTML = window.getIcon(iconName);
                }
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.iconLoader = new IconLoader();
});
