// ==================== MAIN APPLICATION ====================

let currentMonth = new Date();
let deferredPrompt = null;
let charts = {};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadSettings();
    renderDashboard();
    Voice.init();
    Automation.init();
});

function initializeApp() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.error('SW registration failed:', err));
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('installBanner').classList.remove('hidden');
    });

    // Apply theme
    const settings = DB.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme);
    
    // Update theme icon
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = settings.theme === 'dark' ? '☀️' : '🌙';
}

function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Install button
    document.getElementById('installBtn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            document.getElementById('installBanner').classList.add('hidden');
        }
    });

    document.getElementById('dismissInstall').addEventListener('click', () => {
        document.getElementById('installBanner').classList.add('hidden');
    });

    // Settings inputs
    document.getElementById('currencySelect').addEventListener('change', saveSettings);
    document.getElementById('monthlyBudget').addEventListener('change', saveSettings);
    document.getElementById('notificationsToggle').addEventListener('change', saveSettings);
    document.getElementById('voiceToggle').addEventListener('change', saveSettings);
    document.getElementById('autoCategToggle').addEventListener('change', saveSettings);

    // Swipe handling for list items
    setupSwipeHandlers();
}

// ==================== TAB SWITCHING ====================
function switchTab(tabName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Load tab-specific content
    switch(tabName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'expenses':
            renderTransactions();
            break;
        case 'todo':
            renderTodos();
            break;
        case 'shopping':
            renderShopping();
            break;
        case 'analytics':
            renderAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// ==================== THEME ====================
function toggleTheme() {
    const settings = DB.getSettings();
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    DB.saveSettings(settings);
    
    document.documentElement.setAttribute('data-theme', settings.theme);
    
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = settings.theme === 'dark' ? '☀️' : '🌙';

    // Redraw charts if on analytics
    if (document.getElementById('analytics').classList.contains('active')) {
        renderAnalytics();
    }
}

// ==================== DASHBOARD ====================
function renderDashboard() {
    renderQuickExpenses();
    renderRecentActivity();
    renderTodayTasks();
    renderShoppingSummary();
    updateQuickStats();
}

function renderQuickExpenses() {
    const quickExpenses = DB.getQuickExpenses();
    const settings = DB.getSettings();
    const container = document.getElementById('quickExpenses');

    container.innerHTML = quickExpenses.map(exp => `
        <button class="quick-btn" onclick="addQuickExpense('${exp.id}')">
            <span class="quick-icon">${exp.icon}</span>
            <span class="quick-label">${exp.label}</span>
            <span class="quick-amount">${Utils.formatCurrency(exp.amount, settings.currency)}</span>
        </button>
    `).join('');
}

function addQuickExpense(id) {
    const quickExpense = DB.getQuickExpenses().find(e => e.id === id);
    if (!quickExpense) return;

    const settings = DB.getSettings();

    const expense = {
        id: Utils.generateId(),
        type: 'expense',
        description: quickExpense.label,
        amount: quickExpense.amount,
        category: quickExpense.category,
        date: new Date().toISOString().split('T')[0],
        payment: 'card',
        notes: 'Quick add',
        createdAt: new Date().toISOString()
    };

    DB.saveTransaction(expense);
    
    Utils.showToast(`Added ${quickExpense.label} - ${Utils.formatCurrency(quickExpense.amount, settings.currency)}`, 'success');
    Utils.vibrate(50);

    updateDashboard();
}

function renderRecentActivity() {
    const transactions = DB.getTransactions();
    const settings = DB.getSettings();
    const container = document.getElementById('recentActivity');

    const recent = transactions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">No transactions yet</p>';
        return;
    }

    container.innerHTML = recent.map(t => `
        <div class="list-item">
            <span class="item-icon">${Utils.getCategoryIcon(t.category)}</span>
            <div class="item-content">
                <div class="item-title">${t.description}</div>
                <div class="item-meta">
                    <span class="badge badge-primary">${t.category}</span>
                    <span>${Utils.formatDate(t.date)}</span>
                </div>
            </div>
            <div class="item-amount ${t.type === 'income' ? 'amount-positive' : 'amount-negative'}">
                ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount, settings.currency)}
            </div>
        </div>
    `).join('');
}

function renderTodayTasks() {
    const todos = DB.getTodos();
    const container = document.getElementById('todayTasks');

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = todos.filter(t => 
        !t.completed && (!t.dueDate || t.dueDate >= today)
    ).slice(0, 3);

    if (todayTasks.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">No pending tasks</p>';
        return;
    }

    container.innerHTML = todayTasks.map(t => `
        <div class="list-item" onclick="toggleTodo('${t.id}')">
            <input type="checkbox" class="checkbox" ${t.completed ? 'checked' : ''}>
            <div class="item-content">
                <div class="item-title">${t.title}</div>
                <div class="item-meta">
                    <span class="badge badge-${Utils.getPriorityColor(t.priority)}">${t.priority}</span>
                    ${t.dueDate ? `<span>📅 ${Utils.formatDate(t.dueDate)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function renderShoppingSummary() {
    const shopping = DB.getShopping();
    const settings = DB.getSettings();
    const container = document.getElementById('shoppingSummary');

    const pending = shopping.filter(s => !s.purchased);

    if (pending.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Shopping list empty</p>';
        return;
    }

    const total = pending.reduce((sum, s) => sum + (s.price * s.quantity), 0);

    container.innerHTML = `
        <div class="card">
            <div class="flex-between mb-2">
                <span>${pending.length} items</span>
                <span style="font-weight:700">${Utils.formatCurrency(total, settings.currency)}</span>
            </div>
            ${pending.slice(0, 3).map(s => `
                <div style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
                    ${s.item} ${s.quantity > 1 ? `(${s.quantity})` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function updateQuickStats() {
    const transactions = DB.getTransactions();
    const todos = DB.getTodos();
    const settings = DB.getSettings();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const income = monthTransactions.filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTransactions.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expenses;

    document.getElementById('quickBalance').textContent = Utils.formatCurrency(balance, settings.currency);
    
    if (settings.budget > 0) {
        const percentage = Math.round((expenses / settings.budget) * 100);
        document.getElementById('quickBudget').textContent = `${percentage}%`;
    } else {
        document.getElementById('quickBudget').textContent = 'Not set';
    }

    const pendingTasks = todos.filter(t => !t.completed).length;
    document.getElementById('quickTasks').textContent = pendingTasks;
}

function updateDashboard() {
    renderDashboard();
}

// ==================== TRANSACTIONS ====================
function renderTransactions() {
    const transactions = DB.getTransactions();
    const settings = DB.getSettings();
    const container = document.getElementById('transactionsList');

    // Update month label
    document.getElementById('currentMonth').textContent = currentMonth.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });

    // Filter by current month
    const monthTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth.getMonth() && 
               date.getFullYear() === currentMonth.getFullYear();
    });

    // Calculate totals
    const income = monthTransactions.filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTransactions.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('monthIncome').textContent = Utils.formatCurrency(income, settings.currency);
    document.getElementById('monthExpense').textContent = Utils.formatCurrency(expenses, settings.currency);

    // Render category filters
    const categories = [...new Set(transactions.map(t => t.category))];
    const filterContainer = document.getElementById('categoryFilters');
    filterContainer.innerHTML = `
        <button class="btn-chip active" onclick="filterByCategory('all')">All</button>
        ${categories.map(cat => `
            <button class="btn-chip" onclick="filterByCategory('${cat}')">${cat}</button>
        `).join('')}
    `;

    // Render transactions
    if (monthTransactions.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:3rem;">No transactions this month</p>';
        return;
    }

    const sorted = monthTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(t => `
        <div class="list-item swipeable" data-id="${t.id}">
            <span class="item-icon">${Utils.getCategoryIcon(t.category)}</span>
            <div class="item-content">
                <div class="item-title">${t.description}</div>
                <div class="item-meta">
                    <span class="badge badge-primary">${t.category}</span>
                    <span>${Utils.formatDate(t.date)}</span>
                    ${t.payment ? `<span>💳 ${t.payment}</span>` : ''}
                </div>
            </div>
            <div class="item-amount ${t.type === 'income' ? 'amount-positive' : 'amount-negative'}">
                ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount, settings.currency)}
            </div>
            <div class="swipe-actions">
                <button class="swipe-btn delete" onclick="deleteTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');

    setupSwipeHandlers();
}

function changeMonth(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    renderTransactions();
}

function filterByCategory(category) {
    const buttons = document.querySelectorAll('#categoryFilters .btn-chip');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const items = document.querySelectorAll('#transactionsList .list-item');
    items.forEach(item => {
        const categoryBadge = item.querySelector('.badge-primary');
        if (category === 'all' || categoryBadge.textContent === category) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function deleteTransaction(id) {
    if (confirm('Delete this transaction?')) {
        DB.deleteTransaction(id);
        Utils.showToast('Transaction deleted', 'success');
        Utils.vibrate(50);
        renderTransactions();
        updateDashboard();
    }
}

// ==================== TODOS ====================
function renderTodos(filter = 'all') {
    const todos = DB.getTodos();
    const container = document.getElementById('tasksList');

    let filtered = todos;
    if (filter === 'pending') filtered = todos.filter(t => !t.completed);
    if (filter === 'completed') filtered = todos.filter(t => t.completed);

    const sorted = filtered.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    if (sorted.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:3rem;">No tasks found</p>';
        return;
    }

    container.innerHTML = sorted.map(t => `
        <div class="list-item swipeable" data-id="${t.id}" style="${t.completed ? 'opacity:0.6' : ''}">
            <input type="checkbox" class="checkbox" ${t.completed ? 'checked' : ''} 
                   onclick="toggleTodo('${t.id}')">
            <div class="item-content">
                <div class="item-title" style="${t.completed ? 'text-decoration:line-through' : ''}">${t.title}</div>
                <div class="item-meta">
                    <span class="badge badge-${Utils.getPriorityColor(t.priority)}">${t.priority}</span>
                    ${t.category ? `<span class="badge badge-primary">${t.category}</span>` : ''}
                    ${t.dueDate ? `<span>📅 ${Utils.formatDate(t.dueDate)}</span>` : ''}
                </div>
            </div>
            <div class="swipe-actions">
                <button class="swipe-btn complete" onclick="toggleTodo('${t.id}')">✓</button>
                <button class="swipe-btn delete" onclick="deleteTodo('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');

    setupSwipeHandlers();
}

function filterTodos(filter) {
    const buttons = document.querySelectorAll('[data-filter]');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderTodos(filter);
}

function toggleTodo(id) {
    const todo = DB.getTodos().find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        DB.saveTodo(todo);
        Utils.vibrate(50);
        renderTodos();
        updateDashboard();
    }
}

function deleteTodo(id) {
    if (confirm('Delete this task?')) {
        DB.deleteTodo(id);
        Utils.showToast('Task deleted', 'success');
        Utils.vibrate(50);
        renderTodos();
        updateDashboard();
    }
}

// ==================== SHOPPING ====================
function renderShopping() {
    const shopping = DB.getShopping();
    const settings = DB.getSettings();
    const container = document.getElementById('shoppingList');

    const sorted = shopping.sort((a, b) => {
        if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Update stats
    const total = shopping.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    document.getElementById('totalItems').textContent = shopping.length;
    document.getElementById('totalCost').textContent = Utils.formatCurrency(total, settings.currency);

    if (sorted.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:3rem;">No shopping items</p>';
        return;
    }

    container.innerHTML = sorted.map(s => `
        <div class="list-item swipeable" data-id="${s.id}" style="${s.purchased ? 'opacity:0.6' : ''}">
            <input type="checkbox" class="checkbox" ${s.purchased ? 'checked' : ''} 
                   onclick="toggleShopping('${s.id}')">
            <div class="item-content">
                <div class="item-title" style="${s.purchased ? 'text-decoration:line-through' : ''}">
                    ${s.item} ${s.quantity > 1 ? `(${s.quantity})` : ''}
                </div>
                <div class="item-meta">
                    <span class="badge badge-primary">${s.category}</span>
                    ${s.price > 0 ? `<span>${Utils.formatCurrency(s.price * s.quantity, settings.currency)}</span>` : ''}
                </div>
            </div>
            <div class="swipe-actions">
                <button class="swipe-btn complete" onclick="toggleShopping('${s.id}')">✓</button>
                <button class="swipe-btn delete" onclick="deleteShopping('${s.id}')">🗑️</button>
            </div>
        </div>
    `).join('');

    setupSwipeHandlers();
}

function toggleShopping(id) {
    const item = DB.getShopping().find(s => s.id === id);
    if (!item) return;

    item.purchased = !item.purchased;
    DB.saveShopping(item);
    Utils.vibrate(50);

    // Auto-create expense if purchased and has price
    if (item.purchased && item.price > 0) {
        Automation.shoppingToExpense(item);
        updateDashboard();
    }

    renderShopping();
}

function deleteShopping(id) {
    if (confirm('Delete this item?')) {
        DB.deleteShopping(id);
        Utils.showToast('Item deleted', 'success');
        Utils.vibrate(50);
        renderShopping();
        updateDashboard();
    }
}

// ==================== ANALYTICS ====================
function renderAnalytics() {
    renderCategoryChart();
    renderTrendChart();
    renderInsights();
}

function renderCategoryChart() {
    const transactions = DB.getTransactions();
    const ctx = document.getElementById('categoryChart');
    
    const now = new Date();
    const monthExpenses = transactions.filter(t => {
        const date = new Date(t.date);
        return t.type === 'expense' && 
               date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
    });

    const categoryTotals = {};
    monthExpenses.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    if (charts.category) charts.category.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#6366f1', '#ec4899', '#10b981', '#f59e0b',
                    '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: isDark ? '#cbd5e1' : '#6b7280'
                    }
                }
            }
        }
    });
}

function renderTrendChart() {
    const transactions = DB.getTransactions();
    const ctx = document.getElementById('trendChart');

    const now = new Date();
    const months = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(date.toLocaleDateString('en-US', { month: 'short' }));

        const monthTrans = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === date.getMonth() && 
                   tDate.getFullYear() === date.getFullYear();
        });

        incomeData.push(monthTrans.filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0));
        expenseData.push(monthTrans.filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0));
    }

    if (charts.trend) charts.trend.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Income',
                data: incomeData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }, {
                label: 'Expenses',
                data: expenseData,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: isDark ? '#cbd5e1' : '#6b7280'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: isDark ? '#cbd5e1' : '#6b7280'
                    },
                    grid: {
                        color: isDark ? '#334155' : '#e5e7eb'
                    }
                },
                x: {
                    ticks: {
                        color: isDark ? '#cbd5e1' : '#6b7280'
                    },
                    grid: {
                        color: isDark ? '#334155' : '#e5e7eb'
                    }
                }
            }
        }
    });
}

function renderInsights() {
    const container = document.getElementById('insightsList');
    const transactions = DB.getTransactions();
    const settings = DB.getSettings();
    
    const now = new Date();
    const monthExpenses = transactions.filter(t => {
        const date = new Date(t.date);
        return t.type === 'expense' && 
               date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
    });

    const total = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const avgDaily = total / now.getDate();

    const categoryTotals = {};
    monthExpenses.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const topCategory = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])[0];

    const insights = [
        {
            icon: '📊',
            text: `Daily average spending: ${Utils.formatCurrency(avgDaily, settings.currency)}`
        },
        {
            icon: '🎯',
            text: topCategory ? 
                `Top category: ${topCategory[0]} (${Utils.percentage(topCategory[1], total)}%)` :
                'No expenses yet this month'
        }
    ];

    if (settings.budget > 0) {
        const remaining = settings.budget - total;
        const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
        const dailyBudget = remaining / daysLeft;
        
        insights.push({
            icon: '💰',
            text: `Daily budget remaining: ${Utils.formatCurrency(Math.max(0, dailyBudget), settings.currency)}`
        });
    }

    container.innerHTML = insights.map(insight => `
        <div class="card">
            <span style="font-size:2rem;margin-right:1rem;">${insight.icon}</span>
            <span>${insight.text}</span>
        </div>
    `).join('');
}

// ==================== FAB MENU ====================
function toggleFabMenu() {
    const fab = document.getElementById('mainFab');
    const menu = document.getElementById('fabMenu');
    
    fab.classList.toggle('open');
    menu.classList.toggle('open');
}

function closeFabMenu() {
    document.getElementById('mainFab').classList.remove('open');
    document.getElementById('fabMenu').classList.remove('open');
}

function quickAddExpense() {
    closeFabMenu();
    const description = prompt('Expense description:');
    if (!description) return;
    
    const amount = parseFloat(prompt('Amount:'));
    if (!amount || amount <= 0) return;

    Voice.createExpense(description, amount);
}

function quickAddIncome() {
    closeFabMenu();
    const description = prompt('Income description:');
    if (!description) return;
    
    const amount = parseFloat(prompt('Amount:'));
    if (!amount || amount <= 0) return;

    Voice.createIncome(description, amount);
}

function quickAddTask() {
    closeFabMenu();
    const title = prompt('Task:');
    if (!title) return;

    Voice.createTask(title);
}

function quickAddShopping() {
    closeFabMenu();
    const item = prompt('Shopping item:');
    if (!item) return;

    Voice.createShopping(item);
}

function startVoiceInput() {
    closeFabMenu();
    Voice.start();
}

// ==================== SETTINGS ====================
function loadSettings() {
    const settings = DB.getSettings();
    
    document.getElementById('currencySelect').value = settings.currency;
    document.getElementById('monthlyBudget').value = settings.budget || '';
    document.getElementById('notificationsToggle').checked = settings.notifications;
    document.getElementById('voiceToggle').checked = settings.voice;
    document.getElementById('autoCategToggle').checked = settings.autoCateg;

    renderQuickExpenseSettings();
}

function saveSettings() {
    const settings = {
        currency: document.getElementById('currencySelect').value,
        budget: parseFloat(document.getElementById('monthlyBudget').value) || 0,
        notifications: document.getElementById('notificationsToggle').checked,
        voice: document.getElementById('voiceToggle').checked,
        autoCateg: document.getElementById('autoCategToggle').checked,
        theme: DB.getSettings().theme
    };

    DB.saveSettings(settings);
    Utils.showToast('Settings saved', 'success');
    
    updateDashboard();
}

function renderQuickExpenseSettings() {
    const quickExpenses = DB.getQuickExpenses();
    const container = document.getElementById('quickExpenseSettings');

    container.innerHTML = quickExpenses.map(exp => `
        <div class="card flex-between">
            <div>
                <span style="font-size:1.5rem;margin-right:0.5rem;">${exp.icon}</span>
                <strong>${exp.label}</strong> - ${exp.amount}
            </div>
            <button class="btn-text" style="color:var(--danger)" onclick="deleteQuickExpense('${exp.id}')">
                Delete
            </button>
        </div>
    `).join('');
}

function deleteQuickExpense(id) {
    if (confirm('Delete this quick expense?')) {
        DB.deleteQuickExpense(id);
        renderQuickExpenseSettings();
        renderQuickExpenses();
        Utils.showToast('Quick expense deleted', 'success');
    }
}

// ==================== DATA EXPORT/IMPORT ====================
function exportAllData() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organizer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    Utils.showToast('Data exported', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm('This will replace all current data. Continue?')) {
                DB.importAll(data);
                Utils.showToast('Data imported successfully', 'success');
                location.reload();
            }
        } catch (err) {
            Utils.showToast('Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Delete ALL data? This cannot be undone!')) {
        if (confirm('Are you absolutely sure?')) {
            DB.clearAll();
            Utils.showToast('All data cleared', 'success');
            setTimeout(() => location.reload(), 1000);
        }
    }
}

// ==================== SWIPE HANDLERS ====================
function setupSwipeHandlers() {
    const swipeables = document.querySelectorAll('.swipeable');
    
    swipeables.forEach(item => {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
        });

        item.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            
            if (diff > 0 && diff < 100) {
                item.style.transform = `translateX(-${diff}px)`;
            }
        });

        item.addEventListener('touchend', () => {
            const diff = startX - currentX;
            
            if (diff > 50) {
                item.classList.add('swiped');
                item.style.transform = 'translateX(-140px)';
            } else {
                item.classList.remove('swiped');
                item.style.transform = 'translateX(0)';
            }
            
            isSwiping = false;
        });
    });
}