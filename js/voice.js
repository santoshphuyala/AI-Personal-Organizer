// ==================== VOICE RECOGNITION ====================

const Voice = {
    recognition: null,
    isListening: false,

    // Initialize
    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            document.getElementById('voiceIndicator').classList.remove('hidden');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            document.getElementById('voiceIndicator').classList.add('hidden');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log('Voice input:', transcript);
            this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            document.getElementById('voiceIndicator').classList.add('hidden');
            
            if (event.error !== 'no-speech') {
                Utils.showToast('Voice recognition error', 'error');
            }
        };

        return true;
    },

    // Start listening
    start() {
        const settings = DB.getSettings();
        
        if (!settings.voice) {
            Utils.showToast('Voice input is disabled in settings', 'warning');
            return;
        }

        if (!this.recognition) {
            if (!this.init()) {
                Utils.showToast('Voice input not supported', 'error');
                return;
            }
        }

        try {
            this.recognition.start();
        } catch (err) {
            console.error('Failed to start recognition:', err);
        }
    },

    // Process voice command
    processCommand(text) {
        // Add expense: "add coffee 5 dollars" or "expense lunch 15"
        const expenseMatch = text.match(/(?:add|expense|spent?)\s+(.+?)\s+(\d+(?:\.\d{2})?)\s*(?:dollars?|bucks?|rupees?)?/i);
        if (expenseMatch) {
            const description = expenseMatch[1].trim();
            const amount = parseFloat(expenseMatch[2]);
            this.createExpense(description, amount);
            return;
        }

        // Add income: "income salary 1000"
        const incomeMatch = text.match(/income\s+(.+?)\s+(\d+(?:\.\d{2})?)/i);
        if (incomeMatch) {
            const description = incomeMatch[1].trim();
            const amount = parseFloat(incomeMatch[2]);
            this.createIncome(description, amount);
            return;
        }

        // Add to shopping: "add milk to shopping" or "shopping bread"
        const shoppingMatch = text.match(/(?:add|shopping)\s+(.+?)\s+(?:to\s+)?(?:shopping|list)?/i);
        if (shoppingMatch) {
            const item = shoppingMatch[1].trim();
            this.createShopping(item);
            return;
        }

        // Add task: "task call doctor" or "remind me to call doctor"
        const taskMatch = text.match(/(?:task|todo|remind\s+me\s+to)\s+(.+)/i);
        if (taskMatch) {
            const task = taskMatch[1].trim();
            this.createTask(task);
            return;
        }

        // Show budget
        if (text.includes('budget') || text.includes('spending')) {
            switchTab('analytics');
            Utils.showToast('Showing budget info', 'info');
            return;
        }

        Utils.showToast('Command not recognized. Try: "add coffee 5 dollars"', 'warning');
    },

    // Create expense from voice
    createExpense(description, amount) {
        const settings = DB.getSettings();
        const category = Automation.autoCateg(description);

        const expense = {
            id: Utils.generateId(),
            type: 'expense',
            description: Utils.capitalize(description),
            amount: amount,
            category: category,
            date: new Date().toISOString().split('T')[0],
            payment: 'card',
            notes: 'Added via voice',
            createdAt: new Date().toISOString()
        };

        DB.saveTransaction(expense);
        
        Utils.showToast(
            `Added expense: ${expense.description} - ${Utils.formatCurrency(amount, settings.currency)}`,
            'success',
            3000
        );
        
        Utils.vibrate([50, 100, 50]);

        // Refresh UI
        updateDashboard();
        if (document.getElementById('expenses').classList.contains('active')) {
            renderTransactions();
        }
    },

    // Create income from voice
    createIncome(description, amount) {
        const settings = DB.getSettings();

        const income = {
            id: Utils.generateId(),
            type: 'income',
            description: Utils.capitalize(description),
            amount: amount,
            category: 'Income',
            date: new Date().toISOString().split('T')[0],
            notes: 'Added via voice',
            createdAt: new Date().toISOString()
        };

        DB.saveTransaction(income);
        
        Utils.showToast(
            `Added income: ${income.description} - ${Utils.formatCurrency(amount, settings.currency)}`,
            'success',
            3000
        );
        
        Utils.vibrate([50, 100, 50]);

        // Refresh UI
        updateDashboard();
        if (document.getElementById('expenses').classList.contains('active')) {
            renderTransactions();
        }
    },

    // Create shopping item from voice
    createShopping(item) {
        const shopping = {
            id: Utils.generateId(),
            item: Utils.capitalize(item),
            quantity: 1,
            price: 0,
            category: 'Other',
            purchased: false,
            createdAt: new Date().toISOString()
        };

        DB.saveShopping(shopping);
        
        Utils.showToast(`Added to shopping: ${shopping.item}`, 'success');
        Utils.vibrate(50);

        // Refresh UI
        updateDashboard();
        if (document.getElementById('shopping').classList.contains('active')) {
            renderShopping();
        }
    },

    // Create task from voice
    createTask(title) {
        const todo = {
            id: Utils.generateId(),
            title: Utils.capitalize(title),
            priority: 'medium',
            category: 'personal',
            completed: false,
            createdAt: new Date().toISOString()
        };

        DB.saveTodo(todo);
        
        Utils.showToast(`Added task: ${todo.title}`, 'success');
        Utils.vibrate(50);

        // Refresh UI
        updateDashboard();
        if (document.getElementById('todo').classList.contains('active')) {
            renderTodos();
        }
    }
};