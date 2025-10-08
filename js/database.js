// ==================== DATABASE MANAGEMENT ====================

const DB = {
    // Keys
    KEYS: {
        TRANSACTIONS: 'transactions',
        TODOS: 'todos',
        SHOPPING: 'shopping',
        SETTINGS: 'settings',
        QUICK_EXPENSES: 'quickExpenses',
        CATEGORIES: 'categories'
    },

    // Default data
    defaults: {
        settings: {
            currency: 'USD',
            theme: 'light',
            notifications: true,
            voice: true,
            autoCateg: true,
            budget: 0
        },
        quickExpenses: [
            { id: '1', label: 'Coffee', amount: 5, category: 'Food', icon: '☕' },
            { id: '2', label: 'Lunch', amount: 15, category: 'Food', icon: '🍽️' },
            { id: '3', label: 'Gas', amount: 50, category: 'Transport', icon: '⛽' },
            { id: '4', label: 'Groceries', amount: 100, category: 'Shopping', icon: '🛒' }
        ],
        categories: ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Education', 'Other']
    },

    // Get item
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : (this.defaults[key] || null);
        } catch (err) {
            console.error('Error reading from storage:', err);
            return this.defaults[key] || null;
        }
    },

    // Set item
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.error('Error writing to storage:', err);
            Utils.showToast('Storage error', 'error');
            return false;
        }
    },

    // Get all transactions
    getTransactions() {
        return this.get(this.KEYS.TRANSACTIONS) || [];
    },

    // Save transaction
    saveTransaction(transaction) {
        const transactions = this.getTransactions();
        const existingIndex = transactions.findIndex(t => t.id === transaction.id);
        
        if (existingIndex >= 0) {
            transactions[existingIndex] = transaction;
        } else {
            transactions.push(transaction);
        }
        
        this.set(this.KEYS.TRANSACTIONS, transactions);
        return transaction;
    },

    // Delete transaction
    deleteTransaction(id) {
        const transactions = this.getTransactions();
        const filtered = transactions.filter(t => t.id !== id);
        this.set(this.KEYS.TRANSACTIONS, filtered);
    },

    // Get todos
    getTodos() {
        return this.get(this.KEYS.TODOS) || [];
    },

    // Save todo
    saveTodo(todo) {
        const todos = this.getTodos();
        const existingIndex = todos.findIndex(t => t.id === todo.id);
        
        if (existingIndex >= 0) {
            todos[existingIndex] = todo;
        } else {
            todos.push(todo);
        }
        
        this.set(this.KEYS.TODOS, todos);
        return todo;
    },

    // Delete todo
    deleteTodo(id) {
        const todos = this.getTodos();
        const filtered = todos.filter(t => t.id !== id);
        this.set(this.KEYS.TODOS, filtered);
    },

    // Get shopping items
    getShopping() {
        return this.get(this.KEYS.SHOPPING) || [];
    },

    // Save shopping item
    saveShopping(item) {
        const shopping = this.getShopping();
        const existingIndex = shopping.findIndex(s => s.id === item.id);
        
        if (existingIndex >= 0) {
            shopping[existingIndex] = item;
        } else {
            shopping.push(item);
        }
        
        this.set(this.KEYS.SHOPPING, shopping);
        return item;
    },

    // Delete shopping item
    deleteShopping(id) {
        const shopping = this.getShopping();
        const filtered = shopping.filter(s => s.id !== id);
        this.set(this.KEYS.SHOPPING, filtered);
    },

    // Get settings
    getSettings() {
        return { ...this.defaults.settings, ...this.get(this.KEYS.SETTINGS) };
    },

    // Save settings
    saveSettings(settings) {
        this.set(this.KEYS.SETTINGS, settings);
    },

    // Get quick expenses
    getQuickExpenses() {
        return this.get(this.KEYS.QUICK_EXPENSES) || this.defaults.quickExpenses;
    },

    // Save quick expense
    saveQuickExpense(expense) {
        const expenses = this.getQuickExpenses();
        const existingIndex = expenses.findIndex(e => e.id === expense.id);
        
        if (existingIndex >= 0) {
            expenses[existingIndex] = expense;
        } else {
            expenses.push(expense);
        }
        
        this.set(this.KEYS.QUICK_EXPENSES, expenses);
    },

    // Delete quick expense
    deleteQuickExpense(id) {
        const expenses = this.getQuickExpenses();
        const filtered = expenses.filter(e => e.id !== id);
        this.set(this.KEYS.QUICK_EXPENSES, filtered);
    },

    // Get categories
    getCategories() {
        return this.get(this.KEYS.CATEGORIES) || this.defaults.categories;
    },

    // Export all data
    exportAll() {
        return {
            transactions: this.getTransactions(),
            todos: this.getTodos(),
            shopping: this.getShopping(),
            settings: this.getSettings(),
            quickExpenses: this.getQuickExpenses(),
            categories: this.getCategories(),
            exportDate: new Date().toISOString()
        };
    },

    // Import all data
    importAll(data) {
        try {
            if (data.transactions) this.set(this.KEYS.TRANSACTIONS, data.transactions);
            if (data.todos) this.set(this.KEYS.TODOS, data.todos);
            if (data.shopping) this.set(this.KEYS.SHOPPING, data.shopping);
            if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
            if (data.quickExpenses) this.set(this.KEYS.QUICK_EXPENSES, data.quickExpenses);
            if (data.categories) this.set(this.KEYS.CATEGORIES, data.categories);
            return true;
        } catch (err) {
            console.error('Import error:', err);
            return false;
        }
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
};