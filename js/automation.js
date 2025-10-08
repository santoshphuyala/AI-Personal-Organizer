// ==================== AUTOMATION & SMART FEATURES ====================

const Automation = {
    // Initialize automation
    init() {
        this.checkRecurring();
        this.detectPatterns();
        this.scheduleReminders();
        
        // Run checks periodically
        setInterval(() => this.checkRecurring(), 1000 * 60 * 60); // Every hour
        setInterval(() => this.detectPatterns(), 1000 * 60 * 60 * 24); // Daily
    },

    // Auto-categorize transaction
    autoCateg(description) {
        const patterns = {
            'Food': ['coffee', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'pizza', 'burger', 'food', 'meal'],
            'Transport': ['uber', 'lyft', 'gas', 'fuel', 'parking', 'taxi', 'bus', 'train', 'metro'],
            'Shopping': ['amazon', 'walmart', 'target', 'mall', 'store', 'shop'],
            'Entertainment': ['netflix', 'spotify', 'movie', 'cinema', 'game', 'concert'],
            'Bills': ['electric', 'water', 'internet', 'phone', 'rent', 'bill', 'utility'],
            'Health': ['pharmacy', 'doctor', 'hospital', 'medicine', 'gym', 'fitness'],
            'Education': ['book', 'course', 'tuition', 'school', 'university']
        };

        const lower = description.toLowerCase();
        
        for (const [category, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => lower.includes(keyword))) {
                return category;
            }
        }
        
        // Check against historical data
        const transactions = DB.getTransactions();
        const similar = transactions.find(t => 
            t.description.toLowerCase().includes(lower) || 
            lower.includes(t.description.toLowerCase())
        );
        
        return similar ? similar.category : 'Other';
    },

    // Detect recurring transactions
    checkRecurring() {
        const transactions = DB.getTransactions();
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Group by description
        const groups = {};
        transactions.forEach(t => {
            const key = `${t.description.toLowerCase()}-${t.amount}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        });

        // Check for recurring patterns
        Object.values(groups).forEach(group => {
            if (group.length < 2) return;
            
            // Sort by date
            group.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Calculate average interval
            const intervals = [];
            for (let i = 1; i < group.length; i++) {
                const days = Math.floor(
                    (new Date(group[i].date) - new Date(group[i-1].date)) / (1000 * 60 * 60 * 24)
                );
                intervals.push(days);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const lastTransaction = group[group.length - 1];
            const daysSinceLast = Math.floor(
                (now - new Date(lastTransaction.date)) / (1000 * 60 * 60 * 24)
            );

            // If it's time for next occurrence
            if (daysSinceLast >= avgInterval * 0.9) {
                const shouldCreate = !transactions.some(t => 
                    t.description === lastTransaction.description &&
                    t.amount === lastTransaction.amount &&
                    t.date === today
                );

                if (shouldCreate) {
                    // Ask user or auto-create
                    this.suggestRecurring(lastTransaction);
                }
            }
        });
    },

    // Suggest recurring transaction
    suggestRecurring(transaction) {
        const message = `Add recurring ${transaction.type}: ${transaction.description} (${Utils.formatCurrency(transaction.amount)})?`;
        
        if (confirm(message)) {
            const newTransaction = {
                ...transaction,
                id: Utils.generateId(),
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                recurring: true
            };
            
            DB.saveTransaction(newTransaction);
            Utils.showToast('Recurring transaction added', 'success');
            
            // Refresh if on expenses tab
            if (document.getElementById('expenses').classList.contains('active')) {
                renderTransactions();
            }
        }
    },

    // Detect spending patterns
    detectPatterns() {
        const transactions = DB.getTransactions();
        const settings = DB.getSettings();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filter current month expenses
        const monthExpenses = transactions.filter(t => {
            const date = new Date(t.date);
            return t.type === 'expense' && 
                   date.getMonth() === currentMonth && 
                   date.getFullYear() === currentYear;
        });

        const total = monthExpenses.reduce((sum, t) => sum + t.amount, 0);

        // Budget warnings
        if (settings.budget > 0) {
            const percentage = (total / settings.budget) * 100;
            
            if (percentage >= 90 && !sessionStorage.getItem('budget90')) {
                Utils.showToast('⚠️ 90% of budget used!', 'warning');
                sessionStorage.setItem('budget90', 'true');
                
                if (settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('Budget Alert', {
                        body: 'You have used 90% of your monthly budget',
                        icon: '/icons/icon-192.png'
                    });
                }
            }
            
            if (percentage >= 100 && !sessionStorage.getItem('budget100')) {
                Utils.showToast('🚨 Budget exceeded!', 'error');
                sessionStorage.setItem('budget100', 'true');
                
                if (settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('Budget Exceeded', {
                        body: 'You have exceeded your monthly budget',
                        icon: '/icons/icon-192.png'
                    });
                }
            }
        }

        // Category insights
        const categoryTotals = {};
        monthExpenses.forEach(t => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        });

        // Find top spending category
        const topCategory = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])[0];

        if (topCategory && topCategory[1] > total * 0.4) {
            console.log(`Insight: ${topCategory[0]} accounts for ${Math.round(topCategory[1]/total*100)}% of spending`);
        }
    },

    // Smart budget suggestions
    suggestBudget() {
        const transactions = DB.getTransactions();
        
        // Get last 3 months average
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        
        const recentExpenses = transactions.filter(t => 
            t.type === 'expense' && new Date(t.date) >= threeMonthsAgo
        );

        if (recentExpenses.length < 10) {
            return null; // Not enough data
        }

        const totalExpenses = recentExpenses.reduce((sum, t) => sum + t.amount, 0);
        const months = Math.ceil((now - threeMonthsAgo) / (1000 * 60 * 60 * 24 * 30));
        const avgMonthly = totalExpenses / months;

        // Add 10% buffer
        return Math.ceil(avgMonthly * 1.1);
    },

    // Schedule task reminders
    scheduleReminders() {
        const todos = DB.getTodos();
        const settings = DB.getSettings();
        
        if (!settings.notifications) return;

        const now = new Date();
        
        todos.forEach(todo => {
            if (todo.completed || !todo.dueDate) return;

            const dueDate = new Date(todo.dueDate);
            const hoursUntil = (dueDate - now) / (1000 * 60 * 60);

            // Notify 24 hours before
            if (hoursUntil <= 24 && hoursUntil > 23 && !sessionStorage.getItem(`remind-${todo.id}-24h`)) {
                this.showTaskReminder(todo, '24 hours');
                sessionStorage.setItem(`remind-${todo.id}-24h`, 'true');
            }

            // Notify 1 hour before
            if (hoursUntil <= 1 && hoursUntil > 0 && !sessionStorage.getItem(`remind-${todo.id}-1h`)) {
                this.showTaskReminder(todo, '1 hour');
                sessionStorage.setItem(`remind-${todo.id}-1h`, 'true');
            }

            // Notify if overdue
            if (hoursUntil < 0 && !sessionStorage.getItem(`remind-${todo.id}-overdue`)) {
                this.showTaskReminder(todo, 'overdue');
                sessionStorage.setItem(`remind-${todo.id}-overdue`, 'true');
            }
        });

        // Check again in 30 minutes
        setTimeout(() => this.scheduleReminders(), 1000 * 60 * 30);
    },

    // Show task reminder
    showTaskReminder(todo, timing) {
        const message = timing === 'overdue' 
            ? `⏰ Task overdue: ${todo.title}`
            : `⏰ Task due in ${timing}: ${todo.title}`;

        Utils.showToast(message, 'warning', 5000);

        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Reminder', {
                body: todo.title,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                tag: todo.id,
                requireInteraction: timing === 'overdue'
            });
        }
    },

    // Convert shopping to expense
    shoppingToExpense(shoppingItem) {
        const settings = DB.getSettings();
        const category = this.autoCateg(shoppingItem.item);

        const expense = {
            id: Utils.generateId(),
            type: 'expense',
            description: shoppingItem.item,
            amount: shoppingItem.price * shoppingItem.quantity,
            category: category,
            date: new Date().toISOString().split('T')[0],
            payment: 'card',
            notes: `Auto-created from shopping list`,
            createdAt: new Date().toISOString(),
            fromShopping: true
        };

        DB.saveTransaction(expense);
        
        Utils.showToast(`Added expense: ${Utils.formatCurrency(expense.amount, settings.currency)}`, 'success');
        Utils.vibrate(50);

        return expense;
    },

    // Smart quick expense suggestions
    suggestQuickExpenses() {
        const transactions = DB.getTransactions();
        const frequency = {};

        // Count transaction descriptions
        transactions.forEach(t => {
            if (t.type === 'expense') {
                const key = `${t.description}-${t.category}`;
                if (!frequency[key]) {
                    frequency[key] = { count: 0, amounts: [], transaction: t };
                }
                frequency[key].count++;
                frequency[key].amounts.push(t.amount);
            }
        });

        // Get top 8 most frequent
        const suggested = Object.values(frequency)
            .filter(f => f.count >= 3) // At least 3 occurrences
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .map(f => {
                const avgAmount = f.amounts.reduce((a, b) => a + b, 0) / f.amounts.length;
                return {
                    id: Utils.generateId(),
                    label: f.transaction.description,
                    amount: Math.round(avgAmount),
                    category: f.transaction.category,
                    icon: Utils.getCategoryIcon(f.transaction.category)
                };
            });

        return suggested;
    }
};