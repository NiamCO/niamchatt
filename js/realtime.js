// realtime.js - Realtime Updates with Supabase
class RealtimeManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.currentUser = window.currentUser;
        this.subscriptions = {};
        this.typingUsers = new Map();
        this.onlineUsers = new Map();
        
        this.initializeRealtime();
    }
    
    async initializeRealtime() {
        // Wait for user to be initialized
        if (!this.currentUser.id) {
            setTimeout(() => this.initializeRealtime(), 100);
            return;
        }
        
        // Setup all realtime subscriptions
        await this.setupSubscriptions();
        
        // Start heartbeat to keep user online
        this.startHeartbeat();
        
        console.log('Realtime manager initialized');
    }
    
    async setupSubscriptions() {
        // Subscribe to messages
        await this.subscribeToMessages();
        
        // Subscribe to users (for online status and typing)
        await this.subscribeToUsers();
        
        // Subscribe to announcements
        await this.subscribeToAnnouncements();
    }
    
    async subscribeToMessages() {
        try {
            const subscription = this.supabase
                .channel('messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `room=eq.${window.chatCore?.currentRoom || 'public'}`
                    },
                    (payload) => {
                        this.handleNewMessage(payload.new);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'messages'
                    },
                    (payload) => {
                        this.handleMessageUpdate(payload.new);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'messages',
                        filter: 'deleted=eq.true'
                    },
                    (payload) => {
                        this.handleMessageDelete(payload.old.id);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to messages');
                    }
                });
            
            this.subscriptions.messages = subscription;
            
        } catch (error) {
            console.error('Error subscribing to messages:', error);
            // Fallback to polling
            this.startMessagePolling();
        }
    }
    
    async subscribeToUsers() {
        try {
            const subscription = this.supabase
                .channel('users')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'users'
                    },
                    (payload) => {
                        this.handleUserUpdate(payload.new);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to users');
                    }
                });
            
            this.subscriptions.users = subscription;
            
        } catch (error) {
            console.error('Error subscribing to users:', error);
            // Fallback to polling
            this.startUserPolling();
        }
    }
    
    async subscribeToAnnouncements() {
        try {
            const subscription = this.supabase
                .channel('announcements-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'announcements'
                    },
                    (payload) => {
                        // Let announcement manager handle this
                        if (window.announcementManager) {
                            window.announcementManager.handleNewAnnouncement(payload.new);
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Subscribed to announcements');
                    }
                });
            
            this.subscriptions.announcements = subscription;
            
        } catch (error) {
            console.error('Error subscribing to announcements:', error);
        }
    }
    
    handleNewMessage(message) {
        // Ignore if message is deleted
        if (message.deleted) return;
        
        // Ignore if message is from current room and not already in messages
        const chatCore = window.chatCore;
        if (!chatCore) return;
        
        // Check if message is already in local array
        const existingMessage = chatCore.messages.find(m => m.id === message.id);
        if (existingMessage) return;
        
        // Add message to local array
        chatCore.messages.push(message);
        
        // Render messages if in correct room
        if (message.room === chatCore.currentRoom) {
            chatCore.renderMessages();
            
            // Play message sound if not from current user
            if (message.sender_id !== this.currentUser.id && window.MESSAGE_SOUND) {
                window.MESSAGE_SOUND.currentTime = 0;
                window.MESSAGE_SOUND.play().catch(e => console.log('Audio play failed:', e));
            }
            
            // Update message badge
            this.updateMessageBadge(message.room);
        }
        
        console.log('New message received:', message);
    }
    
    handleMessageUpdate(updatedMessage) {
        const chatCore = window.chatCore;
        if (!chatCore) return;
        
        // Find and update message in local array
        const index = chatCore.messages.findIndex(m => m.id === updatedMessage.id);
        if (index !== -1) {
            chatCore.messages[index] = updatedMessage;
            
            // Re-render if in current room
            if (updatedMessage.room === chatCore.currentRoom) {
                chatCore.rerenderMessage(updatedMessage.id);
            }
        }
    }
    
    handleMessageDelete(messageId) {
        const chatCore = window.chatCore;
        if (!chatCore) return;
        
        // Remove message from local array
        chatCore.messages = chatCore.messages.filter(m => m.id !== messageId);
        
        // Re-render messages
        chatCore.renderMessages();
        
        // Update badge
        this.updateMessageBadge(chatCore.currentRoom);
    }
    
    handleUserUpdate(user) {
        // Update online users map
        if (user.online) {
            this.onlineUsers.set(user.id, user);
        } else {
            this.onlineUsers.delete(user.id);
        }
        
        // Update typing users map
        if (user.typing) {
            this.typingUsers.set(user.id, user);
        } else {
            this.typingUsers.delete(user.id);
        }
        
        // Update online users list in UI
        this.updateOnlineUsersUI();
        
        // Update typing indicators
        this.updateTypingIndicators();
        
        console.log('User update:', user.username, 'online:', user.online, 'typing:', user.typing);
    }
    
    updateOnlineUsersUI() {
        const authManager = window.authManager;
        if (authManager && authManager.updateOnlineUsersList) {
            authManager.updateOnlineUsersList();
        }
        
        // Update online count
        const onlineCount = document.getElementById('onlineCount');
        if (onlineCount) {
            onlineCount.textContent = this.onlineUsers.size;
        }
    }
    
    updateTypingIndicators() {
        const typingContainer = document.getElementById('typingContainer');
        const typingText = document.getElementById('typingText');
        
        if (!typingContainer || !typingText) return;
        
        // Filter out current user
        const typingUsers = Array.from(this.typingUsers.values())
            .filter(user => user.id !== this.currentUser.id);
        
        if (typingUsers.length > 0) {
            // Show typing indicator
            typingContainer.style.display = 'flex';
            
            // Update text based on number of typing users
            if (typingUsers.length === 1) {
                typingText.textContent = `${typingUsers[0].display_name || typingUsers[0].username} is typing...`;
            } else if (typingUsers.length === 2) {
                typingText.textContent = `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
            } else {
                typingText.textContent = `${typingUsers.length} people are typing...`;
            }
        } else {
            // Hide typing indicator
            typingContainer.style.display = 'none';
        }
    }
    
    updateMessageBadge(room) {
        const chatCore = window.chatCore;
        if (!chatCore) return;
        
        // Count messages in each room
        const publicCount = chatCore.messages.filter(m => m.room === 'public' && !m.deleted).length;
        const adminCount = chatCore.messages.filter(m => m.room === 'admin' && !m.deleted).length;
        
        // Update badges
        const publicBadge = document.getElementById('publicBadge');
        const adminBadge = document.getElementById('adminBadge');
        
        if (publicBadge) {
            publicBadge.textContent = publicCount > 99 ? '99+' : publicCount;
        }
        
        if (adminBadge) {
            adminBadge.textContent = adminCount > 99 ? '99+' : adminCount;
        }
    }
    
    startHeartbeat() {
        // Update user's last_seen every 30 seconds
        setInterval(async () => {
            if (this.currentUser.id) {
                try {
                    await this.supabase
                        .from('users')
                        .update({ 
                            last_seen: new Date().toISOString(),
                            online: true 
                        })
                        .eq('id', this.currentUser.id);
                } catch (error) {
                    console.error('Error updating heartbeat:', error);
                }
            }
        }, 30000);
        
        // Also update on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser.id) {
                this.updateUserPresence(true);
            }
        });
        
        // Update on page unload
        window.addEventListener('beforeunload', () => {
            this.updateUserPresence(false);
        });
    }
    
    async updateUserPresence(online) {
        if (!this.currentUser.id) return;
        
        try {
            await this.supabase
                .from('users')
                .update({ 
                    online: online,
                    typing: false,
                    last_seen: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);
        } catch (error) {
            console.error('Error updating user presence:', error);
        }
    }
    
    startMessagePolling() {
        // Fallback polling for messages every 3 seconds
        console.log('Starting message polling (fallback)');
        
        setInterval(async () => {
            const chatCore = window.chatCore;
            if (!chatCore) return;
            
            try {
                const { data, error } = await this.supabase
                    .from('messages')
                    .select('*')
                    .eq('room', chatCore.currentRoom)
                    .eq('deleted', false)
                    .order('timestamp', { ascending: false })
                    .limit(10);
                
                if (error) throw error;
                
                // Check for new messages
                data.reverse().forEach(message => {
                    const existing = chatCore.messages.find(m => m.id === message.id);
                    if (!existing) {
                        this.handleNewMessage(message);
                    }
                });
                
            } catch (error) {
                console.error('Error polling messages:', error);
            }
        }, 3000);
    }
    
    startUserPolling() {
        // Fallback polling for users every 5 seconds
        console.log('Starting user polling (fallback)');
        
        setInterval(async () => {
            try {
                const { data, error } = await this.supabase
                    .from('users')
                    .select('*')
                    .eq('online', true);
                
                if (error) throw error;
                
                // Update online users
                this.onlineUsers.clear();
                data.forEach(user => {
                    this.onlineUsers.set(user.id, user);
                });
                
                this.updateOnlineUsersUI();
                
            } catch (error) {
                console.error('Error polling users:', error);
            }
        }, 5000);
    }
    
    // Cleanup on page unload
    cleanup() {
        // Unsubscribe from all channels
        Object.values(this.subscriptions).forEach(subscription => {
            if (subscription && subscription.unsubscribe) {
                subscription.unsubscribe();
            }
        });
        
        // Update user as offline
        this.updateUserPresence(false);
    }
    
    // Switch room subscription
    async switchRoom(room) {
        // Unsubscribe from current room messages
        if (this.subscriptions.messages) {
            this.supabase.removeChannel(this.subscriptions.messages);
        }
        
        // Subscribe to new room
        await this.subscribeToMessages();
    }
}

// Initialize RealtimeManager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.realtimeManager = new RealtimeManager();
    }, 2000); // Wait for everything to initialize
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.realtimeManager && window.realtimeManager.cleanup) {
        window.realtimeManager.cleanup();
    }
});

// Export for other files
window.RealtimeManager = RealtimeManager;
