// ==================== UTILITY FUNCTIONS ====================

const Utils = {
    // Format currency
    formatCurrency(amount, currency = 'USD') {
        const symbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'INR': '₹',
            'NPR': 'रू'
        };
        
        const symbol = symbols[currency] || '$';
        const formatted = Math.abs(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
        return `${symbol}${formatted}`;
    },

    // Format date
    formatDate(date) {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (d.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    },

    // Format relative time
    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        
        return 'Just now';
    },

    // Generate ID
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Show toast
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Vibrate (if supported)
    vibrate(pattern = 50) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            'Food': '🍔',
            'Transport': '🚗',
            'Shopping': '🛍️',
            'Entertainment': '🎬',
            'Bills': '📄',
            'Health': '⚕️',
            'Education': '📚',
            'Travel': '✈️',
            'Other': '📌',
            'Income': '💰',
            'Salary': '💼',
            'Business': '📈',
            'Investment': '📊'
        };
        return icons[category] || '💰';
    },

    // Get priority color
    getPriorityColor(priority) {
        const colors = {
            'high': 'danger',
            'medium': 'warning',
            'low': 'success'
        };
        return colors[priority] || 'primary';
    },

    // Capitalize first letter
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Calculate percentage
    percentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },

    // Group by date
    groupByDate(items, dateKey = 'date') {
        return items.reduce((groups, item) => {
            const date = item[dateKey].split('T')[0];
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(item);
            return groups;
        }, {});
    },

    // Export to Excel
    exportToExcel(data, filename) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard', 'success');
        } catch (err) {
            this.showToast('Failed to copy', 'error');
        }
    },

    // Share (if supported)
    async share(data) {
        if (navigator.share) {
            try {
                await navigator.share(data);
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            this.copyToClipboard(data.text || data.url);
        }
    }
};