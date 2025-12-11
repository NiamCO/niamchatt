// chat-core.js - Main Chat Functionality
class ChatCore {
    constructor() {
        this.supabase = window.supabaseClient;
        this.currentUser = window.currentUser;
        this.currentRoom = 'public';
        this.messages = [];
        this.replyingTo = null;
        this.uploading = false;
        
        this.initializeChat();
    }
    
    async initializeChat() {
        try {
            // Load previous messages
            await this.loadMessages();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup realtime listeners (will be in realtime.js)
            // For now, we'll poll for updates
            this.startMessagePolling();
            
            console.log('Chat initialized in room:', this.currentRoom);
            
        } catch (error) {
            console.error('Error initializing chat:', error);
            this.showError('Failed to initialize chat. Please refresh the page.');
        }
    }
    
    async loadMessages() {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('room', this.currentRoom)
                .eq('deleted', false)
                .order('timestamp', { ascending: true })
                .limit(100);
            
            if (error) throw error;
            
            this.messages = data || [];
            this.renderMessages();
            
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }
    
    renderMessages() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Show empty state if no messages
        if (this.messages.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-icon">${window.getIcon('publicChat')}</div>
                <h3>No messages yet</h3>
                <p class="text-secondary">Be the first to send a message!</p>
            `;
            container.appendChild(emptyState);
            return;
        }
        
        // Group messages by date
        const groupedMessages = this.groupMessagesByDate(this.messages);
        
        // Render each group
        Object.keys(groupedMessages).forEach(date => {
            // Add date separator
            if (Object.keys(groupedMessages).length > 1) {
                const dateSeparator = document.createElement('div');
                dateSeparator.className = 'date-separator';
                dateSeparator.innerHTML = `
                    <div class="date-line"></div>
                    <div class="date-text">${this.formatDate(date)}</div>
                    <div class="date-line"></div>
                `;
                container.appendChild(dateSeparator);
            }
            
            // Render messages for this date
            groupedMessages[date].forEach(message => {
                const messageElement = this.createMessageElement(message);
                container.appendChild(messageElement);
            });
        });
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    groupMessagesByDate(messages) {
        const groups = {};
        
        messages.forEach(message => {
            const date = new Date(message.timestamp).toDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
        });
        
        return groups;
    }
    
    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.dataset.messageId = message.id;
        
        // Add classes based on sender role
        if (message.sender_name === 'Owner - Niam') {
            messageElement.classList.add('owner');
        } else if (message.sender_name.includes('[Admin]') || 
                   (window.authManager && 
                    window.authManager.getUserByUsername && 
                    (async () => {
                        const user = await window.authManager.getUserByUsername(message.sender_name);
                        return user && user.role === 'admin';
                    })())) {
            messageElement.classList.add('admin');
        }
        
        // Check if current user liked/disliked this message
        const hasLiked = message.likes && message.likes.includes(this.currentUser.id);
        const hasDisliked = message.dislikes && message.dislikes.includes(this.currentUser.id);
        
        // Format timestamp
        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Check if message is a reply
        let replySection = '';
        if (message.reply_to) {
            const repliedMessage = this.messages.find(m => m.id === message.reply_to);
            if (repliedMessage) {
                replySection = `
                    <div class="reply-preview">
                        <div class="reply-icon">${window.getIcon('reply')}</div>
                        <div class="reply-content">
                            <strong>${repliedMessage.sender_name}:</strong>
                            ${repliedMessage.text.length > 50 ? repliedMessage.text.substring(0, 50) + '...' : repliedMessage.text}
                        </div>
                    </div>
                `;
            }
        }
        
        // Image section
        let imageSection = '';
        if (message.image_url) {
            imageSection = `
                <img src="${message.image_url}" 
                     alt="Uploaded image" 
                     class="message-image"
                     onclick="window.chatCore.previewImage('${message.image_url}')">
            `;
        }
        
        messageElement.innerHTML = `
            <div class="message-sender">
                <div class="message-avatar">
                    ${message.sender_name ? message.sender_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div class="message-user-info">
                    <div class="message-username">
                        ${message.sender_name || 'Unknown User'}
                        ${message.sender_name === 'Owner - Niam' ? 
                            `<span class="role-badge owner">OWNER</span>` : 
                            message.sender_name.includes('[Admin]') ? 
                            `<span class="role-badge admin">ADMIN</span>` : 
                            ''}
                    </div>
                    <div class="message-time">${timeString}</div>
                </div>
            </div>
            
            ${replySection}
            
            <div class="message-content">
                ${this.escapeHtml(message.text || '')}
            </div>
            
            ${imageSection}
            
            <div class="message-actions">
                <button class="action-btn-small like-btn ${hasLiked ? 'liked' : ''}" 
                        onclick="window.chatCore.toggleLike('${message.id}')">
                    <div class="icon-small">${hasLiked ? window.getIcon('likeFilled') : window.getIcon('like')}</div>
                    <span class="like-count">${message.likes ? message.likes.length : 0}</span>
                </button>
                
                <button class="action-btn-small dislike-btn ${hasDisliked ? 'disliked' : ''}"
                        onclick="window.chatCore.toggleDislike('${message.id}')">
                    <div class="icon-small">${hasDisliked ? window.getIcon('dislikeFilled') : window.getIcon('dislike')}</div>
                    <span class="dislike-count">${message.dislikes ? message.dislikes.length : 0}</span>
                </button>
                
                <button class="action-btn-small reply-btn"
                        onclick="window.chatCore.startReply('${message.id}')">
                    <div class="icon-small">${window.getIcon('reply')}</div>
                    Reply
                </button>
                
                ${this.canDeleteMessage(message) ? `
                    <button class="action-btn-small delete-btn"
                            onclick="window.chatCore.deleteMessage('${message.id}')">
                        <div class="icon-small">${window.getIcon('delete')}</div>
                        Delete
                    </button>
                ` : ''}
            </div>
        `;
        
        return messageElement;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    canDeleteMessage(message) {
        // Owner can delete any message
        if (this.currentUser.role === 'owner') return true;
        
        // Admins can delete any message except owner's
        if (this.currentUser.role === 'admin' && message.sender_name !== 'Owner - Niam') return true;
        
        // Users can delete their own messages
        if (message.sender_id === this.currentUser.id) return true;
        
        return false;
    }
    
    async sendMessage(text, imageUrl = null) {
        if (!text.trim() && !imageUrl) return;
        
        try {
            // Play message sound
            if (window.MESSAGE_SOUND) {
                window.MESSAGE_SOUND.currentTime = 0;
                window.MESSAGE_SOUND.play().catch(e => console.log('Audio play failed:', e));
            }
            
            const messageData = {
                text: text.trim(),
                sender_id: this.currentUser.id,
                sender_name: this.currentUser.displayName,
                room: this.currentRoom,
                timestamp: new Date().toISOString(),
                likes: [],
                dislikes: [],
                reply_to: this.replyingTo,
                image_url: imageUrl,
                deleted: false
            };
            
            const { data, error } = await this.supabase
                .from('messages')
                .insert([messageData])
                .select()
                .single();
            
            if (error) throw error;
            
            // Clear reply if any
            this.clearReply();
            
            // Clear input
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value = '';
                messageInput.style.height = 'auto';
                this.updateCharCount();
            }
            
            // Add message to local array and render
            this.messages.push(data);
            this.renderMessages();
            
            // Update message count badge
            this.updateMessageBadge();
            
            console.log('Message sent:', data);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }
    
    async toggleLike(messageId) {
        try {
            const message = this.messages.find(m => m.id === messageId);
            if (!message) return;
            
            const likes = message.likes || [];
            const dislikes = message.dislikes || [];
            
            let newLikes = [...likes];
            let newDislikes = [...dislikes];
            
            // Remove from dislikes if present
            if (newDislikes.includes(this.currentUser.id)) {
                newDislikes = newDislikes.filter(id => id !== this.currentUser.id);
            }
            
            // Toggle like
            if (newLikes.includes(this.currentUser.id)) {
                newLikes = newLikes.filter(id => id !== this.currentUser.id);
            } else {
                newLikes.push(this.currentUser.id);
            }
            
            // Update in database
            const { error } = await this.supabase
                .from('messages')
                .update({
                    likes: newLikes,
                    dislikes: newDislikes
                })
                .eq('id', messageId);
            
            if (error) throw error;
            
            // Update local message
            message.likes = newLikes;
            message.dislikes = newDislikes;
            
            // Re-render the message
            this.rerenderMessage(messageId);
            
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }
    
    async toggleDislike(messageId) {
        try {
            const message = this.messages.find(m => m.id === messageId);
            if (!message) return;
            
            const likes = message.likes || [];
            const dislikes = message.dislikes || [];
            
            let newLikes = [...likes];
            let newDislikes = [...dislikes];
            
            // Remove from likes if present
            if (newLikes.includes(this.currentUser.id)) {
                newLikes = newLikes.filter(id => id !== this.currentUser.id);
            }
            
            // Toggle dislike
            if (newDislikes.includes(this.currentUser.id)) {
                newDislikes = newDislikes.filter(id => id !== this.currentUser.id);
            } else {
                newDislikes.push(this.currentUser.id);
            }
            
            // Update in database
            const { error } = await this.supabase
                .from('messages')
                .update({
                    likes: newLikes,
                    dislikes: newDislikes
                })
                .eq('id', messageId);
            
            if (error) throw error;
            
            // Update local message
            message.likes = newLikes;
            message.dislikes = newDislikes;
            
            // Re-render the message
            this.rerenderMessage(messageId);
            
        } catch (error) {
            console.error('Error toggling dislike:', error);
        }
    }
    
    startReply(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;
        
        this.replyingTo = messageId;
        
        // Update UI to show reply
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.placeholder = `Replying to ${message.sender_name}...`;
            messageInput.focus();
        }
        
        // Show reply indicator
        this.showReplyIndicator(message);
    }
    
    showReplyIndicator(message) {
        // Remove existing reply indicator
        const existingIndicator = document.querySelector('.reply-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'reply-indicator';
        indicator.innerHTML = `
            <div class="reply-indicator-content">
                <div class="reply-icon">${window.getIcon('reply')}</div>
                <div class="reply-details">
                    <div class="reply-to">Replying to ${message.sender_name}</div>
                    <div class="reply-text">${message.text.length > 100 ? message.text.substring(0, 100) + '...' : message.text}</div>
                </div>
                <button class="reply-cancel-btn" onclick="window.chatCore.clearReply()">
                    <div class="icon-small">${window.getIcon('close')}</div>
                </button>
            </div>
        `;
        
        // Insert before message input
        const inputContainer = document.querySelector('.message-input-container');
        if (inputContainer) {
            inputContainer.insertBefore(indicator, inputContainer.firstChild);
        }
    }
    
    clearReply() {
        this.replyingTo = null;
        
        // Clear reply indicator
        const indicator = document.querySelector('.reply-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // Reset input placeholder
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.placeholder = 'Type your message here (emojis disabled)...';
        }
    }
    
    async deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message?')) return;
        
        try {
            // Soft delete (mark as deleted)
            const { error } = await this.supabase
                .from('messages')
                .update({ deleted: true })
                .eq('id', messageId);
            
            if (error) throw error;
            
            // Remove from local array
            this.messages = this.messages.filter(m => m.id !== messageId);
            
            // Re-render messages
            this.renderMessages();
            
            this.showSuccess('Message deleted successfully.');
            
        } catch (error) {
            console.error('Error deleting message:', error);
            this.showError('Failed to delete message.');
        }
    }
    
    async switchRoom(room) {
        if (this.currentRoom === room) return;
        
        // Check if user has access to admin room
        if (room === 'admin' && 
            this.currentUser.role !== 'admin' && 
            this.currentUser.role !== 'owner') {
            this.showError('Admin access required for admin chat.');
            return;
        }
        
        this.currentRoom = room;
        
        // Update UI
        this.updateRoomUI();
        
        // Load messages for new room
        await this.loadMessages();
        
        // Clear any existing reply
        this.clearReply();
        
        console.log('Switched to room:', room);
    }
    
    updateRoomUI() {
        // Update room buttons
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.toggle('active', item.dataset.room === this.currentRoom);
        });
        
        // Update chat title
        const chatTitle = document.getElementById('currentChatTitle');
        const chatIcon = document.getElementById('currentChatIcon');
        
        if (chatTitle) {
            chatTitle.textContent = this.currentRoom === 'admin' ? 'Admin Chat' : 'Public Chat';
        }
        
        if (chatIcon) {
            chatIcon.innerHTML = this.currentRoom === 'admin' ? 
                window.getIcon('adminChat') : 
                window.getIcon('publicChat');
        }
        
        // Update message badge counts
        this.updateMessageBadge();
    }
    
    updateMessageBadge() {
        // This will be implemented in realtime.js
        // For now, just update counts based on current messages
        const publicBadge = document.getElementById('publicBadge');
        const adminBadge = document.getElementById('adminBadge');
        
        if (publicBadge) {
            const publicCount = this.messages.filter(m => m.room === 'public').length;
            publicBadge.textContent = publicCount > 99 ? '99+' : publicCount;
        }
        
        if (adminBadge) {
            const adminCount = this.messages.filter(m => m.room === 'admin').length;
            adminBadge.textContent = adminCount > 99 ? '99+' : adminCount;
        }
    }
    
    rerenderMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;
        
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        const newElement = this.createMessageElement(message);
        messageElement.replaceWith(newElement);
    }
    
    setupEventListeners() {
        // Send message button
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.handleSendMessage();
            });
        }
        
        // Message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            // Enter to send, Shift+Enter for new line
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
                
                // Update character count
                setTimeout(() => this.updateCharCount(), 0);
            });
            
            // Auto-resize textarea
            messageInput.addEventListener('input', () => {
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
                this.updateCharCount();
            });
        }
        
        // Room switching
        const publicChatBtn = document.getElementById('publicChatBtn');
        const adminChatBtn = document.getElementById('adminChatBtn');
        
        if (publicChatBtn) {
            publicChatBtn.addEventListener('click', () => {
                this.switchRoom('public');
            });
        }
        
        if (adminChatBtn) {
            adminChatBtn.addEventListener('click', () => {
                this.switchRoom('admin');
            });
        }
        
        // Toggle sidebar
        const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
        const menuToggleBtn = document.getElementById('menuToggleBtn');
        
        if (toggleSidebarBtn) {
            toggleSidebarBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
        
        if (menuToggleBtn) {
            menuToggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
        
        // Image preview close
        const previewClose = document.getElementById('previewClose');
        if (previewClose) {
            previewClose.addEventListener('click', () => {
                this.closeImagePreview();
            });
        }
        
        // Mark read button
        const markReadBtn = document.getElementById('markReadBtn');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
    }
    
    handleSendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
        
        const text = messageInput.value.trim();
        
        // Check for emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u;
        if (emojiRegex.test(text)) {
            this.showError('Emojis are not allowed in messages.');
            return;
        }
        
        // Check message length
        if (text.length > 1000) {
            this.showError('Message too long (max 1000 characters).');
            return;
        }
        
        if (text || this.uploading) {
            this.sendMessage(text);
        }
    }
    
    updateCharCount() {
        const messageInput = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
        
        if (messageInput && charCount) {
            const length = messageInput.value.length;
            charCount.textContent = `${length}/1000`;
            
            // Change color if near limit
            if (length > 900) {
                charCount.style.color = 'var(--warning-color)';
            } else if (length > 1000) {
                charCount.style.color = 'var(--danger-color)';
            } else {
                charCount.style.color = 'var(--text-secondary)';
            }
        }
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('closed');
        }
    }
    
    previewImage(imageUrl) {
        const preview = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        
        if (preview && previewImage) {
            previewImage.src = imageUrl;
            preview.classList.add('show');
        }
    }
    
    closeImagePreview() {
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.classList.remove('show');
        }
    }
    
    markAllAsRead() {
        // This will be implemented in announcements.js
        this.showSuccess('All messages marked as read.');
    }
    
    startMessagePolling() {
        // Poll for new messages every 2 seconds
        setInterval(async () => {
            await this.checkForNewMessages();
        }, 2000);
    }
    
    async checkForNewMessages() {
        try {
            const { data, error } = await this.supabase
                .from('messages')
                .select('*')
                .eq('room', this.currentRoom)
                .eq('deleted', false)
                .order('timestamp', { ascending: false })
                .limit(1);
            
            if (error || !data || data.length === 0) return;
            
            const latestMessage = data[0];
            const hasNewMessage = !this.messages.some(m => m.id === latestMessage.id);
            
            if (hasNewMessage) {
                await this.loadMessages();
            }
            
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }
    
    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }
    
    showError(message) {
        if (window.authManager && window.authManager.showError) {
            window.authManager.showError(message);
        } else {
            alert(message);
        }
    }
    
    showSuccess(message) {
        if (window.authManager && window.authManager.showSuccess) {
            window.authManager.showSuccess(message);
        } else {
            alert(message);
        }
    }
}

// Initialize ChatCore when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatCore = new ChatCore();
});

// Export for other files
window.ChatCore = ChatCore;
