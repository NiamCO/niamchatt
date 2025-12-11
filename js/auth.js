// auth.js - User Authentication & Management
class AuthManager {
    constructor() {
        this.currentUser = window.currentUser;
        this.supabase = window.supabaseClient;
        this.username = localStorage.getItem('niamchat_username');
        
        if (!this.username) {
            window.location.href = 'index.html';
            return;
        }
        
        this.initializeUser();
    }
    
    async initializeUser() {
        try {
            // Check if user exists in database
            const { data: existingUser, error: fetchError } = await this.supabase
                .from('users')
                .select('*')
                .eq('username', this.username)
                .single();
            
            let userData;
            
            if (fetchError || !existingUser) {
                // Create new user
                userData = await this.createUser();
            } else {
                // Update existing user
                userData = await this.updateUser(existingUser.id);
            }
            
            // Set current user
            this.currentUser.id = userData.id;
            this.currentUser.username = userData.username;
            this.currentUser.displayName = this.getDisplayName(userData.username);
            this.currentUser.role = userData.role;
            this.currentUser.online = true;
            
            // Update UI
            this.updateUserUI();
            
            // Start typing indicator listener
            this.setupTypingListener();
            
            console.log('User initialized:', this.currentUser);
            
        } catch (error) {
            console.error('Error initializing user:', error);
            this.showError('Failed to initialize user. Please refresh the page.');
        }
    }
    
    async createUser() {
        const role = this.username.toLowerCase() === 'main413h' ? 'owner' : 'user';
        
        const { data, error } = await this.supabase
            .from('users')
            .insert([
                {
                    username: this.username,
                    display_name: this.getDisplayName(this.username),
                    role: role,
                    online: true,
                    typing: false,
                    last_seen: new Date().toISOString()
                }
            ])
            .select()
            .single();
        
        if (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
        
        return data;
    }
    
    async updateUser(userId) {
        const { data, error } = await this.supabase
            .from('users')
            .update({
                online: true,
                typing: false,
                last_seen: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
        
        return data;
    }
    
    getDisplayName(username) {
        // Special display name for owner
        if (username.toLowerCase() === 'main413h') {
            return 'Owner - Niam';
        }
        return username;
    }
    
    updateUserUI() {
        // Update avatar
        const avatar = document.getElementById('userAvatar');
        const initials = document.getElementById('userInitials');
        const displayName = document.getElementById('displayUsername');
        const roleBadge = document.getElementById('userRoleBadge');
        const roleText = document.getElementById('userRoleText');
        
        if (avatar && initials) {
            // Generate color based on username
            const colors = [
                'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                'linear-gradient(135deg, #10b981, #059669)',
                'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                'linear-gradient(135deg, #ec4899, #db2777)',
                'linear-gradient(135deg, #f59e0b, #d97706)'
            ];
            
            const colorIndex = this.username.length % colors.length;
            avatar.style.background = colors[colorIndex];
            initials.textContent = this.username.charAt(0).toUpperCase();
        }
        
        if (displayName) {
            displayName.textContent = this.currentUser.displayName;
        }
        
        if (roleBadge) {
            roleBadge.innerHTML = this.getRoleIcon(this.currentUser.role);
        }
        
        if (roleText) {
            roleText.textContent = this.currentUser.role.toUpperCase();
        }
        
        // Show/hide admin controls based on role
        this.toggleAdminControls();
        
        // Enable/disable admin chat
        this.toggleAdminChatAccess();
    }
    
    getRoleIcon(role) {
        switch(role) {
            case 'owner':
                return window.getIcon('ownerBadge');
            case 'admin':
                return window.getIcon('adminBadge');
            default:
                return window.getIcon('user');
        }
    }
    
    toggleAdminControls() {
        const adminControls = document.getElementById('adminControls');
        const adminChatBtn = document.getElementById('adminChatBtn');
        
        if (adminControls) {
            if (this.currentUser.role === 'owner' || this.currentUser.role === 'admin') {
                adminControls.style.display = 'flex';
            } else {
                adminControls.style.display = 'none';
            }
        }
    }
    
    toggleAdminChatAccess() {
        const adminChatBtn = document.getElementById('adminChatBtn');
        const adminBadge = document.getElementById('adminBadge');
        
        if (adminChatBtn) {
            if (this.currentUser.role === 'admin' || this.currentUser.role === 'owner') {
                adminChatBtn.style.opacity = '1';
                adminChatBtn.style.cursor = 'pointer';
                adminChatBtn.title = 'Admin Chat';
            } else {
                adminChatBtn.style.opacity = '0.5';
                adminChatBtn.style.cursor = 'not-allowed';
                adminChatBtn.title = 'Admin access required';
                
                // Remove click event if not admin
                adminChatBtn.onclick = null;
            }
        }
    }
    
    setupTypingListener() {
        const messageInput = document.getElementById('messageInput');
        
        if (messageInput) {
            let typingTimeout;
            
            messageInput.addEventListener('input', async () => {
                // Set typing status
                await this.setTypingStatus(true);
                
                // Clear previous timeout
                clearTimeout(typingTimeout);
                
                // Set timeout to stop typing after 2 seconds of inactivity
                typingTimeout = setTimeout(async () => {
                    await this.setTypingStatus(false);
                }, 2000);
            });
            
            // Also handle focus/blur
            messageInput.addEventListener('blur', async () => {
                await this.setTypingStatus(false);
            });
        }
    }
    
    async setTypingStatus(isTyping) {
        if (this.currentUser.typing === isTyping) return;
        
        this.currentUser.typing = isTyping;
        
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ typing: isTyping })
                .eq('id', this.currentUser.id);
            
            if (error) throw error;
            
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    }
    
    async logout() {
        try {
            // Update user status to offline
            if (this.currentUser.id) {
                await this.supabase
                    .from('users')
                    .update({ 
                        online: false,
                        typing: false 
                    })
                    .eq('id', this.currentUser.id);
            }
            
            // Clear localStorage
            localStorage.removeItem('niamchat_username');
            
            // Redirect to login
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Error during logout:', error);
            // Still redirect even if update fails
            localStorage.removeItem('niamchat_username');
            window.location.href = 'index.html';
        }
    }
    
    async getOnlineUsers() {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('id, username, display_name, role, online, typing')
                .eq('online', true)
                .order('username');
            
            if (error) throw error;
            
            return data || [];
            
        } catch (error) {
            console.error('Error fetching online users:', error);
            return [];
        }
    }
    
    async updateOnlineUsersList() {
        const onlineUsers = await this.getOnlineUsers();
        const container = document.getElementById('onlineUsersList');
        const onlineCount = document.getElementById('onlineCount');
        
        if (!container) return;
        
        // Update count
        if (onlineCount) {
            onlineCount.textContent = onlineUsers.length;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Add each user
        onlineUsers.forEach(user => {
            const userElement = this.createUserElement(user);
            container.appendChild(userElement);
        });
        
        // If no users online, show message
        if (onlineUsers.length === 0) {
            const emptyElement = document.createElement('div');
            emptyElement.className = 'user-item';
            emptyElement.innerHTML = `
                <div class="text-secondary text-sm" style="padding: 20px; text-align: center; width: 100%;">
                    No users online
                </div>
            `;
            container.appendChild(emptyElement);
        }
    }
    
    createUserElement(user) {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        userElement.dataset.userId = user.id;
        userElement.dataset.username = user.username;
        
        // Generate color for avatar
        const colors = [
            'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            'linear-gradient(135deg, #ec4899, #db2777)',
            'linear-gradient(135deg, #f59e0b, #d97706)'
        ];
        
        const colorIndex = user.username.length % colors.length;
        const displayName = this.getDisplayName(user.username);
        
        userElement.innerHTML = `
            <div class="user-item-avatar" style="background: ${colors[colorIndex]}">
                <span>${user.username.charAt(0).toUpperCase()}</span>
                <div class="online-dot"></div>
            </div>
            <div class="user-item-name">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span>${displayName}</span>
                    <div class="icon-small">${this.getRoleIcon(user.role)}</div>
                </div>
                ${user.typing ? '<div class="typing-indicator">typing...</div>' : ''}
            </div>
            <div class="user-item-role">
                ${user.role}
            </div>
        `;
        
        return userElement;
    }
    
    showError(message) {
        // Create error notification
        const notification = document.getElementById('notification');
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationMessage = document.getElementById('notificationMessage');
        
        if (notification && notificationTitle && notificationMessage) {
            notificationTitle.textContent = 'Error';
            notificationMessage.textContent = message;
            notification.classList.add('show');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
            }, 5000);
        } else {
            alert(message); // Fallback
        }
    }
    
    showSuccess(message) {
        const notification = document.getElementById('notification');
        const notificationTitle = document.getElementById('notificationTitle');
        const notificationMessage = document.getElementById('notificationMessage');
        
        if (notification && notificationTitle && notificationMessage) {
            notificationTitle.textContent = 'Success';
            notificationMessage.textContent = message;
            notification.classList.add('show');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }
    
    // Get user by username
    async getUserByUsername(username) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();
            
            if (error) return null;
            return data;
            
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }
    
    // Update user role
    async updateUserRole(username, newRole) {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ role: newRole })
                .eq('username', username);
            
            return { success: !error, error };
            
        } catch (error) {
            console.error('Error updating user role:', error);
            return { success: false, error };
        }
    }
    
    // Kick user (set offline)
    async kickUser(username) {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({ online: false })
                .eq('username', username);
            
            return { success: !error, error };
            
        } catch (error) {
            console.error('Error kicking user:', error);
            return { success: false, error };
        }
    }
}

// Initialize AuthManager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    
    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.authManager.logout();
        });
    }
    
    // Setup reload button
    const reloadBtn = document.getElementById('reloadBtn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    // Setup notification close button
    const notificationClose = document.getElementById('notificationClose');
    if (notificationClose) {
        notificationClose.addEventListener('click', () => {
            const notification = document.getElementById('notification');
            notification.classList.remove('show');
        });
    }
});

// Export for other files
window.AuthManager = AuthManager;
