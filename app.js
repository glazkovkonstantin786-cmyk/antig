// Antigravity Terminal App Logic V3.1

const DOM = {
    authOverlay: document.getElementById('auth-overlay'),
    pinInput: document.getElementById('pin-input'),
    authBtn: document.getElementById('auth-btn'),
    authError: document.getElementById('auth-error'),
    
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuBtn: document.getElementById('menu-btn'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    
    chatList: document.getElementById('chat-list'),
    currentChatTitle: document.getElementById('current-chat-title'),
    
    messagesContainer: document.getElementById('messages-container'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    voiceBtn: document.getElementById('voice-btn'),
    recordingActive: document.getElementById('recording-active'),
    modelSelect: document.getElementById('model-select'),
    
    brainBtn: document.getElementById('brain-btn'),
    brainModal: document.getElementById('brain-modal'),
    closeBrainBtn: document.getElementById('close-brain-btn'),
    saveBrainBtn: document.getElementById('save-brain-btn'),
    
    brainPersona: document.getElementById('brain-persona'),
    brainProject: document.getElementById('brain-project'),
    brainGoal: document.getElementById('brain-goal'),
    brainDirectives: document.getElementById('brain-directives'),
    
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
    currentModel: localStorage.getItem('ag_model') || 'openrouter/auto',
    // Neural Context (The Brain)
    brain: JSON.parse(localStorage.getItem('ag_brain') || JSON.stringify({
        persona: 'User: Konstantin',
        project: 'Content generation network (Shorts, Reels, TikTok)',
        goal: 'Generate 500,000 RUB revenue target by August 31st',
        directives: 'Act as a ruthless, expert AI mentor and strategist. Be crisp and high-value.'
    }))
};

const MASTER_PIN = '1234'; 

// --- INITIALIZATION ---
function init() {
    // Load Brain into UI
    DOM.brainPersona.value = STATE.brain.persona;
    DOM.brainProject.value = STATE.brain.project;
    DOM.brainGoal.value = STATE.brain.goal;
    DOM.brainDirectives.value = STATE.brain.directives;
    
    // Load Model into UI
    DOM.modelSelect.value = STATE.currentModel;

    if (!STATE.branches.length) {
        createNewBranch();
    } else {
        loadBranch(STATE.branches[0].id);
    }
    renderSidebar();
    
    if (sessionStorage.getItem('ag_auth') === 'true') {
        unlockApp();
    }
    
    setupEventListeners();
}

function getSystemPrompt() {
    return `
You are ANTIGRAVITY (Version 3.1), a state-of-the-art agentic AI terminal.
Current User Context:
- USER IDENTITY: ${STATE.brain.persona}
- PROJECT PARAMETERS: ${STATE.brain.project}
- STRATEGIC GOAL (KPI): ${STATE.brain.goal}
- OPERATIONAL DIRECTIVES: ${STATE.brain.directives}

STRICT RULE: Always call the user by their name if mentioned in the persona (Konstantin). 
Be sharp, tactical, and provide high-end content strategies. Use Markdown for all technical specifications.
`;
}

// --- BRANCH MANAGEMENT ---
function createNewBranch() {
    const newBranch = {
        id: Date.now().toString(),
        title: 'Empty Node',
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
        DOM.currentChatTitle.textContent = branch.title === 'Empty Node' ? 'New Transaction' : branch.title;
        renderMessages(branch.messages);
    }
    renderSidebar();
    if (window.innerWidth < 768) toggleSidebar(false);
}

function saveState() {
    localStorage.setItem('ag_branches', JSON.stringify(STATE.branches));
    localStorage.setItem('ag_api_key', STATE.apiKey);
    localStorage.setItem('ag_brain', JSON.stringify(STATE.brain));
    localStorage.setItem('ag_model', STATE.currentModel);
}

// --- UI RENDERING ---
function renderSidebar() {
    DOM.chatList.innerHTML = '';
    STATE.branches.forEach(branch => {
        const div = document.createElement('div');
        div.className = `branch-item p-4 cursor-pointer transition-all border border-transparent ${branch.id === STATE.currentBranchId ? 'active' : ''} group`;
        
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1 overflow-hidden">
                    <div class="text-[10px] text-cyan-500/50 jetbrains uppercase mb-1">Node #${branch.id.slice(-4)}</div>
                    <div class="text-sm font-semibold truncate ${branch.id === STATE.currentBranchId ? 'text-cyan-400' : 'text-gray-400'}">${branch.title}</div>
                </div>
                <button class="delete-branch opacity-0 group-hover:opacity-100 p-1 text-red-500/50 hover:text-red-400 transition-opacity" onclick="event.stopPropagation(); deleteBranch('${branch.id}')">
                   <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `;
        div.onclick = () => loadBranch(branch.id);
        DOM.chatList.appendChild(div);
        lucide.createIcons();
    });
}

function deleteBranch(id) {
    STATE.branches = STATE.branches.filter(b => b.id !== id);
    if (STATE.currentBranchId === id) {
        if (STATE.branches.length) loadBranch(STATE.branches[0].id);
        else createNewBranch();
    }
    saveState();
    renderSidebar();
}

function renderMessages(messages) {
    DOM.messagesContainer.innerHTML = '';
    messages.forEach(msg => appendMessageUI(msg.role, msg.content));
    scrollToBottom();
}

function appendMessageUI(role, content, isTyping = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`;
    
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${role === 'user' ? 'msg-user' : 'msg-agent'}`;
    
    if (isTyping) {
        bubble.innerHTML = `<span class="typing-indicator-dot"></span><span class="typing-indicator-dot"></span><span class="typing-indicator-dot"></span>`;
        bubble.id = 'typing-indicator';
    } else {
        bubble.innerHTML = role === 'agent' ? marked.parse(content) : content;
    }
    
    wrapper.appendChild(bubble);
    DOM.messagesContainer.appendChild(wrapper);
    scrollToBottom();
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.parentElement.remove();
}

function scrollToBottom() {
    DOM.messagesContainer.scrollTo({
        top: DOM.messagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function toggleSidebar(force) {
    const isMobile = window.innerWidth < 768;
    if (!isMobile && force === undefined) return;
    
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
    setTimeout(() => {
        DOM.authOverlay.classList.add('hidden');
        if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]);
    }, 500);
}

// --- VOICE (STT) ---
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ru-RU';

    recognition.onstart = () => {
        DOM.recordingActive.classList.remove('hidden');
        DOM.voiceBtn.classList.add('text-red-500');
    };
    recognition.onend = () => {
        DOM.recordingActive.classList.add('hidden');
        DOM.voiceBtn.classList.remove('text-red-500');
    };
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        DOM.chatInput.value += text;
        DOM.chatInput.style.height = DOM.chatInput.scrollHeight + 'px';
    };
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    DOM.authBtn.onclick = () => {
        if (DOM.pinInput.value === MASTER_PIN) unlockApp();
        else {
            DOM.authError.classList.remove('hidden');
            DOM.pinInput.value = '';
            setTimeout(() => DOM.authError.classList.add('hidden'), 2000);
        }
    };
    DOM.pinInput.onkeydown = (e) => e.key === 'Enter' && DOM.authBtn.click();

    DOM.menuBtn.onclick = () => toggleSidebar(true);
    DOM.closeSidebarBtn.onclick = () => toggleSidebar(false);
    DOM.sidebarOverlay.onclick = () => toggleSidebar(false);

    DOM.chatInput.oninput = function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    };
    
    DOM.chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    DOM.sendBtn.onclick = sendMessage;
    
    DOM.voiceBtn.onclick = () => {
        if (recognition) recognition.start();
        else alert("Speech Recognition not supported on this device.");
    };

    // Brain Logic
    DOM.brainBtn.onclick = () => DOM.brainModal.classList.remove('hidden');
    DOM.closeBrainBtn.onclick = () => DOM.brainModal.classList.add('hidden');
    DOM.saveBrainBtn.onclick = () => {
        STATE.brain = {
            persona: DOM.brainPersona.value.trim(),
            project: DOM.brainProject.value.trim(),
            goal: DOM.brainGoal.value.trim(),
            directives: DOM.brainDirectives.value.trim()
        };
        saveState();
        DOM.brainModal.classList.add('hidden');
        if ('vibrate' in navigator) navigator.vibrate(20);
    };

    // Settings & Model Selection
    DOM.modelSelect.onchange = (e) => {
        STATE.currentModel = e.target.value;
        saveState();
    };
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
        alert("CRITICAL: API Key Missing.");
        DOM.settingsBtn.click();
        return;
    }

    const branch = STATE.branches.find(b => b.id === STATE.currentBranchId);
    if (!branch) return;

    if (branch.messages.length === 0) {
        branch.title = text.substring(0, 30);
        DOM.currentChatTitle.textContent = branch.title;
        renderSidebar();
    }

    branch.messages.push({ role: 'user', content: text });
    appendMessageUI('user', text);
    
    DOM.chatInput.value = '';
    DOM.chatInput.style.height = 'auto';
    DOM.sendBtn.disabled = true;

    appendMessageUI('agent', '', true);

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STATE.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://antigravity.mobile",
                "X-Title": "Antigravity Terminal"
            },
            body: JSON.stringify({
                model: STATE.currentModel === 'openrouter/auto' ? 'meta-llama/llama-3.3-70b-instruct' : STATE.currentModel,
                messages: [
                    { role: 'system', content: getSystemPrompt() },
                    ...branch.messages.map(m => ({
                        role: m.role === 'agent' ? 'assistant' : 'user',
                        content: m.content
                    }))
                ],
                stream: false
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
            throw new Error(data.error?.message || "Sync Error");
        }
    } catch (error) {
        removeTypingIndicator();
        appendMessageUI('agent', `**SYSTEM ERROR:** ${error.message}`);
    } finally {
        DOM.sendBtn.disabled = false;
        DOM.chatInput.focus();
    }
}

// Boot
window.onload = init;
