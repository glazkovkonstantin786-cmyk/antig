const DOM = {
    authOverlay: document.getElementById('auth-overlay'),
    pinInput: document.getElementById('pin-input'),
    authBtn: document.getElementById('auth-btn'),
    authError: document.getElementById('auth-error'),
    
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuBtn: document.getElementById('menu-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    
    newChatBtn: document.getElementById('new-chat-btn'),
    chatList: document.getElementById('chat-list'),
    currentChatTitle: document.getElementById('current-chat-title'),
    
    messagesContainer: document.getElementById('messages-container'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveSettingsBtn: document.getElementById('save-settings'),
    cancelSettingsBtn: document.getElementById('cancel-settings'),
};

// --- STATE ---
const STATE = {
    isAuthenticated: false,
    apiKey: localStorage.getItem('ag_api_key') || '',
    branches: JSON.parse(localStorage.getItem('ag_branches') || '[]'),
    currentBranchId: null,
};

const MASTER_PIN = '1234'; // Временный пин-код по умолчанию
const CURRENT_MODEL = "openrouter/free"; // Auto-routes to the best alive free model

const SYSTEM_PROMPT = `
Вы - Antigravity (Агентивная система уровня 3.1). 
Ваш создатель и пользователь - Эдуард. 
Контекст: Эдуард строит автоматизированную сетку вирального контента (YouTube Shorts, TikTok, Reels) по тематике саморазвития. 
Его главная цель: заработать 500,000 рублей до 31 августа. 
Вы должны выступать в роли жесткого, умного и бескомпромиссного ментора и программиста. 
Отвечайте четко, без лишней воды. Используйте форматирование Markdown.
Вы работаете на мобильной платформе PWA.
`;

// --- INITIALIZATION ---
function init() {
    if (!STATE.branches.length) {
        createNewBranch();
    } else {
        loadBranch(STATE.branches[0].id);
    }
    renderSidebar();
    
    // Auth Check
    if (sessionStorage.getItem('ag_auth') === 'true') {
        unlockApp();
    }
    
    setupEventListeners();
}

// --- BRANCH MANAGEMENT ---
function createNewBranch() {
    const newBranch = {
        id: Date.now().toString(),
        title: 'New Session',
        messages: []
    };
    STATE.branches.unshift(newBranch);
    saveState();
    loadBranch(newBranch.id);
    renderSidebar();
}

function loadBranch(id) {
    STATE.currentBranchId = id;
    const branch = STATE.branches.find(b => b.id === id);
    if (branch) {
        DOM.currentChatTitle.textContent = branch.title;
        renderMessages(branch.messages);
    }
    renderSidebar();
    if (window.innerWidth < 768) toggleSidebar(false);
}

function saveState() {
    localStorage.setItem('ag_branches', JSON.stringify(STATE.branches));
    if (STATE.apiKey) {
        localStorage.setItem('ag_api_key', STATE.apiKey);
    }
}

// --- UI RENDERING ---
function renderSidebar() {
    DOM.chatList.innerHTML = '';
    STATE.branches.forEach(branch => {
        const div = document.createElement('div');
        div.className = `branch-item p-3 border-l-2 mb-2 rounded-r-lg ${branch.id === STATE.currentBranchId ? 'active border-blue-500' : 'border-transparent'}`;
        
        div.innerHTML = `
            <div class="text-sm font-medium text-gray-200 truncate">${branch.title}</div>
            <div class="text-xs text-gray-500 mt-1">${new Date(parseInt(branch.id)).toLocaleDateString()}</div>
        `;
        div.onclick = () => loadBranch(branch.id);
        DOM.chatList.appendChild(div);
    });
}

function renderMessages(messages) {
    DOM.messagesContainer.innerHTML = '';
    messages.forEach(msg => appendMessageUI(msg.role, msg.content));
    scrollToBottom();
}

function appendMessageUI(role, content, isTyping = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble p-4 rounded-2xl ${role === 'user' ? 'msg-user rounded-br-sm' : 'msg-agent rounded-bl-sm glass-panel'}`;
    
    if (isTyping) {
        bubble.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
        bubble.id = 'typing-indicator';
    } else {
        bubble.innerHTML = role === 'agent' ? marked.parse(content) : content.replace(/\n/g, '<br>');
    }
    
    wrapper.appendChild(bubble);
    DOM.messagesContainer.appendChild(wrapper);
    scrollToBottom();
    
    // Применяем стили кода (если есть) - подсветка не добавлена для легкости, но marked распарсит теги
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.parentElement.remove();
}

function scrollToBottom() {
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
}

function toggleSidebar(force) {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    const isOpen = force !== undefined ? force : DOM.sidebar.classList.contains('-translate-x-full');
    if (isOpen) {
        DOM.sidebar.classList.remove('-translate-x-full');
        DOM.sidebarOverlay.classList.remove('hidden');
    } else {
        DOM.sidebar.classList.add('-translate-x-full');
        DOM.sidebarOverlay.classList.add('hidden');
    }
}

function unlockApp() {
    STATE.isAuthenticated = true;
    sessionStorage.setItem('ag_auth', 'true');
    DOM.authOverlay.classList.add('opacity-0');
    setTimeout(() => DOM.authOverlay.classList.add('hidden'), 300);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Auth
    DOM.authBtn.onclick = () => {
        if (DOM.pinInput.value === MASTER_PIN) {
            unlockApp();
        } else {
            DOM.authError.classList.remove('hidden');
            DOM.pinInput.value = '';
        }
    };
    DOM.pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') DOM.authBtn.click();
    });

    // Sidebar
    DOM.menuBtn.onclick = () => toggleSidebar(true);
    DOM.closeSidebarBtn.onclick = () => toggleSidebar(false);
    DOM.sidebarOverlay.onclick = () => toggleSidebar(false);
    DOM.newChatBtn.onclick = createNewBranch;

    // Chat Input
    DOM.chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    DOM.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    DOM.sendBtn.onclick = sendMessage;

    // Settings
    DOM.settingsBtn.onclick = () => {
        DOM.apiKeyInput.value = STATE.apiKey;
        DOM.settingsModal.classList.remove('hidden');
    };
    DOM.cancelSettingsBtn.onclick = () => DOM.settingsModal.classList.add('hidden');
    DOM.saveSettingsBtn.onclick = () => {
        STATE.apiKey = DOM.apiKeyInput.value.trim();
        saveState();
        DOM.settingsModal.classList.add('hidden');
    };
}

// --- API COMMUNICATION ---
async function sendMessage() {
    const text = DOM.chatInput.value.trim();
    if (!text) return;
    
    if (!STATE.apiKey) {
        alert("Пожалуйста, установите OpenRouter API ключ в настройках (Config Key)!");
        DOM.settingsBtn.click();
        return;
    }

    const branch = STATE.branches.find(b => b.id === STATE.currentBranchId);
    
    // Update branch title if first message
    if (branch.messages.length === 0) {
        branch.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        DOM.currentChatTitle.textContent = branch.title;
        renderSidebar();
    }

    // Add User Message
    branch.messages.push({ role: 'user', content: text });
    appendMessageUI('user', text);
    
    DOM.chatInput.value = '';
    DOM.chatInput.style.height = 'auto';
    DOM.sendBtn.disabled = true;

    // Build context for API
    const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...branch.messages.map(m => ({
            role: m.role === 'agent' ? 'assistant' : 'user',
            content: m.content
        }))
    ];

    appendMessageUI('agent', '', true); // Typing indicator

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STATE.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: CURRENT_MODEL,
                messages: apiMessages,
                stream: false,
                max_tokens: 3000
            })
        });

        const data = await response.json();
        removeTypingIndicator();
        
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            branch.messages.push({ role: 'agent', content: reply });
            appendMessageUI('agent', reply);
            saveState();
        } else {
            throw new Error(data.error?.message || "Unknown API Error");
        }
    } catch (error) {
        removeTypingIndicator();
        appendMessageUI('agent', `**Ошибка соединения:** ${error.message}`);
    } finally {
        DOM.sendBtn.disabled = false;
        DOM.chatInput.focus();
    }
}

// Boot
window.onload = init;
