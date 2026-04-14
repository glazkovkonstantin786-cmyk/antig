/**
 * ANTIGRAVITY v4.0 — App Logic
 * ============================================================
 * MODULE 1: Config & Constants
 * MODULE 2: Store (localStorage)
 * MODULE 3: Router (screen navigation)
 * MODULE 4: Auth (PIN)
 * MODULE 5: AI Engine (OpenRouter streaming SSE)
 * MODULE 6: TTS (Text-to-Speech)
 * MODULE 7: Voice (Speech-to-Text)
 * MODULE 8: Camera (photo → AI vision)
 * MODULE 9: Renderer (messages → DOM)
 * MODULE 10: Actions (copy, share, reactions)
 * MODULE 11: Brain (system prompt)
 * MODULE 12: History (sessions)
 * MODULE 13: Settings
 * MODULE 14: Boot
 * ============================================================
 */

'use strict';

/* ============================================================
   MODULE 1: CONFIG & CONSTANTS
   ============================================================ */
const CFG = {
  PIN: '2526',
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  APP_TITLE: 'Antigravity Terminal',
  APP_URL: 'https://antigravity.app',
  DEFAULT_MODEL: 'meta-llama/llama-3.1-8b-instruct:free',
  DEFAULT_BRAIN: {
    persona: 'Константин — предприниматель, создатель контента',
    project: 'Сеть коротких видео: YouTube Shorts, TikTok, Instagram Reels. Ниша: саморазвитие, дисциплина, мотивация.',
    goal: 'Цель: 500 000 рублей к 31 августа через монетизацию контента и Telegram-канал.',
    directives: 'Будь жёстким, конкретным ментором. Давай только практичные советы. Используй Markdown. Называй пользователя по имени.'
  },
  MODELS: [
    { id: 'meta-llama/llama-3.1-8b-instruct:free',       name: 'Llama 3.1 8B',     emoji: '🦙', desc: 'Meta · Быстрый и стабильный',   badge: 'free' },
    { id: 'deepseek/deepseek-chat-v3-0324:free',          name: 'DeepSeek V3',      emoji: '🔥', desc: 'DeepSeek · Очень мощный Free', badge: 'free' },
    { id: 'qwen/qwen3-8b:free',                           name: 'Qwen3 8B',         emoji: '🐉', desc: 'Alibaba · Новая версия',       badge: 'free' },
    { id: 'mistralai/mistral-7b-instruct:free',           name: 'Mistral 7B',       emoji: '🌬', desc: 'Mistral · Лёгкая',            badge: 'free' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free',      name: 'Llama 3.3 70B',   emoji: '💪', desc: 'Meta · Мощная (busy)',       badge: 'free' },
    { id: 'anthropic/claude-sonnet-4-5',                  name: 'Claude 4.5',       emoji: '🟣', desc: 'Anthropic · Лучший текст', badge: 'paid' },
    { id: 'openai/gpt-4o-mini',                           name: 'GPT-4o Mini',      emoji: '🔵', desc: 'OpenAI · Быстрый',         badge: 'paid' },
  ],
  SUGGESTIONS: [
    { label: '💡 Идея для Shorts', text: 'Придумай 5 идей для вирусного YouTube Shorts видео о дисциплине и саморазвитии' },
    { label: '🎯 Путь к 500к',    text: 'Создай конкретный план достижения 500 000 рублей за 3 месяца на контент-бизнесе' },
    { label: '📝 Сценарий 60 сек',text: 'Напиши захватывающий сценарий мотивационного видео на 60 секунд' },
    { label: '📊 Анализ',         text: 'Как маленький канал (0-1000 подписчиков) может выйти на монетизацию быстрее всего?' },
  ]
};

/* ============================================================
   MODULE 2: STORE
   ============================================================ */
const Store = {
  _get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  _set: (k, v)   => localStorage.setItem(k, JSON.stringify(v)),

  getApiKey:    ()     => localStorage.getItem('ag4_apikey') || '',
  setApiKey:    (v)    => localStorage.setItem('ag4_apikey', v),
  getPin:       ()     => localStorage.getItem('ag4_pin') || CFG.PIN,
  setPin:       (v)    => localStorage.setItem('ag4_pin', v),
  getModel:     ()     => localStorage.getItem('ag4_model') || CFG.DEFAULT_MODEL,
  setModel:     (v)    => localStorage.setItem('ag4_model', v),
  getTtsLang:   ()     => localStorage.getItem('ag4_ttslang') || 'ru-RU',
  setTtsLang:   (v)    => localStorage.setItem('ag4_ttslang', v),

  getBrain:   ()     => Store._get('ag4_brain', CFG.DEFAULT_BRAIN),
  setBrain:   (v)    => Store._set('ag4_brain', v),

  getSessions:     ()  => Store._get('ag4_sessions', []),
  setSessions:     (v) => Store._set('ag4_sessions', v),
  getCurrentId:    ()  => localStorage.getItem('ag4_current') || null,
  setCurrentId:    (v) => localStorage.setItem('ag4_current', v),

  getReactions:    ()  => Store._get('ag4_reactions', {}),
  setReaction:     (id, val) => {
    const r = Store.getReactions();
    if (r[id] === val) { delete r[id]; }
    else r[id] = val;
    Store._set('ag4_reactions', r);
    return r[id] || null;
  },

  clearAll: () => {
    ['ag4_apikey','ag4_pin','ag4_model','ag4_ttslang','ag4_brain',
     'ag4_sessions','ag4_current','ag4_reactions'].forEach(k => localStorage.removeItem(k));
  }
};

/* ============================================================
   MODULE 3: ROUTER
   ============================================================ */
const Router = {
  current: 'chat',

  go(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const screen = document.getElementById(`screen-${screenId}`);
    const navBtn = document.querySelector(`.nav-btn[data-screen="${screenId}"]`);
    if (screen) screen.classList.add('active');
    if (navBtn) navBtn.classList.add('active');

    this.current = screenId;

    if (screenId === 'history') History.render();
    if (screenId === 'brain')   Brain.load();
    if (screenId === 'settings') Settings.load();
    if (screenId === 'chat')    setTimeout(() => Renderer.scrollToBottom(), 50);
  },

  init() {
    document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => this.go(btn.dataset.screen));
    });
  }
};

/* ============================================================
   MODULE 4: AUTH
   ============================================================ */
const Auth = {
  entered: '',
  attempts: 0,

  init() {
    if (sessionStorage.getItem('ag4_auth') === '1') {
      this.unlock();
      return;
    }
    this._bindKeypad();
  },

  _bindKeypad() {
    document.querySelectorAll('.pin-key[data-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.entered.length >= 4) return;
        this.entered += btn.dataset.val;
        this._updateDots();
        if (this.entered.length === 4) setTimeout(() => this._check(), 120);
      });
    });
    document.getElementById('pin-del').addEventListener('click', () => {
      this.entered = this.entered.slice(0, -1);
      this._updateDots();
    });
  },

  _updateDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`dot-${i}`);
      dot.classList.toggle('filled', i < this.entered.length);
      dot.classList.remove('error');
    }
  },

  _check() {
    const pin = Store.getPin();
    if (this.entered === pin) {
      this.unlock();
    } else {
      this.attempts++;
      this.entered = '';
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        dot.classList.remove('filled');
        dot.classList.add('error');
      }
      const err = document.getElementById('auth-error');
      err.textContent = this.attempts >= 3 ? `Неверный PIN (${this.attempts} попытки)` : 'Неверный PIN';
      err.classList.add('visible');
      setTimeout(() => { err.classList.remove('visible'); this._updateDots(); }, 1800);
      if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
    }
  },

  unlock() {
    sessionStorage.setItem('ag4_auth', '1');
    const overlay = document.getElementById('auth-overlay');
    const app = document.getElementById('app');
    overlay.classList.add('hidden');
    app.classList.remove('locked');
    if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]);
  }
};

/* ============================================================
   MODULE 5: AI ENGINE — OpenRouter Streaming SSE
   ============================================================ */
const AI = {
  abortCtrl: null,
  isStreaming: false,
  pendingImage: null, // base64 image for vision

  getSystemPrompt() {
    const b = Store.getBrain();
    return `Ты — ANTIGRAVITY (v4.0), персональный AI-агент.

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- Личность: ${b.persona}
- Проект: ${b.project}
- Цель (KPI): ${b.goal}

ДИРЕКТИВЫ ПОВЕДЕНИЯ:
${b.directives}

Текущая дата: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.
Используй Markdown для форматирования. Будь конкретен и полезен.`;
  },

  buildMessages(history, userText, imageBase64 = null) {
    const msgs = [{ role: 'system', content: this.getSystemPrompt() }];

    // Previous messages (last 12 for context)
    history.slice(-12).forEach(m => {
      msgs.push({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content });
    });

    // Current user message
    if (imageBase64) {
      msgs.push({
        role: 'user',
        content: [
          { type: 'text', text: userText || 'Что на этом изображении? Проанализируй детально.' },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      });
    } else {
      msgs.push({ role: 'user', content: userText });
    }

    return msgs;
  },

  async send(userText, imageBase64 = null, onChunk, onDone, onError) {
    const apiKey = Store.getApiKey();
    if (!apiKey) {
      onError('API ключ не задан. Перейди в **Настройки** и введи ключ с openrouter.ai');
      return;
    }

    if (this.isStreaming) this.abort();
    this.isStreaming = true;
    this.abortCtrl = new AbortController();

    const session = History.getCurrent();
    if (!session) return;

    const messages = this.buildMessages(session.messages, userText, imageBase64);
    const model = Store.getModel();

    // Vision models — auto-switch if image present
    const visionModel = imageBase64
      ? 'google/gemini-2.0-flash-exp:free'
      : model;

    try {
      const res = await fetch(CFG.API_URL, {
        method: 'POST',
        signal: this.abortCtrl.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': CFG.APP_URL,
          'X-Title': CFG.APP_TITLE
        },
        body: JSON.stringify({
          model: visionModel,
          messages,
          stream: true,
          max_tokens: 2048,
          temperature: 0.75
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const apiErr = err.error?.message || `HTTP ${res.status}`;
        // Friendly hints for common errors
        if (res.status === 401) throw new Error('Неверный API ключ. Проверь в Настройках.');
        if (res.status === 402) throw new Error('Нет кредитов на аккаунте OpenRouter.');
        if (res.status === 429) throw new Error('Слишком много запросов. Подожди минуту.');
        if (apiErr.toLowerCase().includes('provider')) throw new Error('Провайдер перегружен — смени модель (нажми на пилюлю вверху).');
        throw new Error(apiErr);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const json = JSON.parse(raw);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) { full += delta; onChunk(delta, full); }
          } catch { /* ignore malformed SSE */ }
        }
      }

      this.isStreaming = false;
      onDone(full);
    } catch (err) {
      this.isStreaming = false;
      if (err.name === 'AbortError') return;
      onError(err.message || 'Ошибка соединения');
    }
  },

  abort() {
    if (this.abortCtrl) this.abortCtrl.abort();
    this.isStreaming = false;
  }
};

/* ============================================================
   MODULE 6: TTS (Text-to-Speech)
   ============================================================ */
const TTS = {
  synth: window.speechSynthesis || null,
  voices: [],
  activeTtsBtn: null,

  init() {
    if (!this.synth) return;
    const load = () => { this.voices = this.synth.getVoices(); };
    load();
    if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = load;
  },

  getVoice(lang) {
    return this.voices.find(v => v.lang === lang && v.localService)
        || this.voices.find(v => v.lang.startsWith(lang.split('-')[0]) && v.localService)
        || this.voices.find(v => v.lang.startsWith(lang.split('-')[0]))
        || this.voices[0]
        || null;
  },

  speak(text, btn) {
    if (!this.synth) { Toast.show('TTS не поддерживается'); return; }

    if (this.synth.speaking && this.activeTtsBtn === btn) {
      this.stop(); return;
    }
    this.stop();

    // Strip markdown
    const clean = text
      .replace(/```[\s\S]*?```/g, 'блок кода')
      .replace(/`[^`]+`/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    const lang = Store.getTtsLang();
    const utt = new SpeechSynthesisUtterance(clean);
    const voice = this.getVoice(lang);
    if (voice) utt.voice = voice;
    utt.lang = lang;
    utt.rate = 0.97;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    utt.onstart = () => {
      this.activeTtsBtn = btn;
      btn?.classList.add('tts-speaking');
      if ('vibrate' in navigator) navigator.vibrate(8);
    };
    utt.onend  = () => this._clear();
    utt.onerror = () => this._clear();

    this.synth.speak(utt);
  },

  stop() { if (this.synth) this.synth.cancel(); this._clear(); },

  _clear() {
    this.activeTtsBtn?.classList.remove('tts-speaking');
    this.activeTtsBtn = null;
  }
};

/* ============================================================
   MODULE 7: VOICE INPUT (STT)
   ============================================================ */
const Voice = {
  recognition: null,
  isListening: false,

  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = Store.getTtsLang();

    this.recognition.onstart = () => {
      this.isListening = true;
      document.getElementById('voice-btn').classList.add('recording');
      if ('vibrate' in navigator) navigator.vibrate(15);
    };
    this.recognition.onend = () => {
      this.isListening = false;
      document.getElementById('voice-btn').classList.remove('recording');
    };
    this.recognition.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      const inp = document.getElementById('chat-input');
      inp.value += (inp.value ? ' ' : '') + txt;
      UI.adjustTextarea(inp);
      UI.updateSendBtn();
    };
    this.recognition.onerror = () => {
      this.isListening = false;
      document.getElementById('voice-btn').classList.remove('recording');
    };
  },

  toggle() {
    if (!this.recognition) { Toast.show('Голосовой ввод не поддерживается'); return; }
    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.recognition.lang = Store.getTtsLang();
      this.recognition.start();
    }
  }
};

/* ============================================================
   MODULE 8: CAMERA
   ============================================================ */
const Camera = {
  pendingBase64: null,

  init() {
    const input = document.getElementById('camera-input');
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.pendingBase64 = ev.target.result;
        this._showPreview(ev.target.result);
      };
      reader.readAsDataURL(file);
      input.value = ''; // reset so same file can be selected again
    });

    document.getElementById('camera-btn').addEventListener('click', () => {
      document.getElementById('camera-input').click();
    });

    document.getElementById('img-preview-remove').addEventListener('click', () => {
      this.clear();
    });
  },

  _showPreview(src) {
    document.getElementById('img-preview-img').src = src;
    document.getElementById('img-preview').classList.add('visible');
    document.getElementById('img-preview').style.display = 'block';
  },

  clear() {
    this.pendingBase64 = null;
    document.getElementById('img-preview-img').src = '';
    document.getElementById('img-preview').classList.remove('visible');
    document.getElementById('img-preview').style.display = 'none';
  }
};

/* ============================================================
   MODULE 9: RENDERER
   ============================================================ */
const Renderer = {
  _streamEl: null,  // The current streaming bubble

  renderAll(messages) {
    const area = document.getElementById('messages-area');
    const empty = document.getElementById('chat-empty');
    area.innerHTML = '';

    if (!messages || messages.length === 0) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    messages.forEach(m => {
      const row = this._buildRow(m.role, m.content, m.id, m.imageUrl);
      area.appendChild(row);
    });
    this.scrollToBottom();
  },

  addUserMessage(text, imageUrl = null) {
    document.getElementById('chat-empty').style.display = 'none';
    const row = this._buildRow('user', text, null, imageUrl);
    document.getElementById('messages-area').appendChild(row);
    this.scrollToBottom();
  },

  startAgentStream() {
    document.getElementById('chat-empty').style.display = 'none';
    const area = document.getElementById('messages-area');

    // Build row with typing indicator first
    const row = document.createElement('div');
    row.className = 'msg-row agent';
    row.innerHTML = `
      <div class="agent-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2"/>
        </svg>
      </div>
      <div class="agent-msg-col">
        <div class="msg-bubble" id="stream-bubble">
          <div class="typing-bubble">
            <div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div>
          </div>
        </div>
      </div>`;
    area.appendChild(row);
    this._streamEl = row.querySelector('#stream-bubble');
    this.scrollToBottom();
  },

  appendChunk(fullText) {
    if (!this._streamEl) return;
    this._streamEl.innerHTML = marked.parse(fullText) + '<span class="stream-cursor"></span>';
    this.scrollToBottom();
  },

  finalizeStream(fullText, msgId, savedReaction = null) {
    if (!this._streamEl) return;
    const el = this._streamEl;
    el.removeAttribute('id');
    el.innerHTML = marked.parse(fullText);

    // Append action bar
    const actions = this._buildActionBar(msgId, fullText, savedReaction);
    el.appendChild(actions);

    const col = el.parentElement;
    if (col && col.classList.contains('agent-msg-col')) {
      col.appendChild(this._buildActionBar(msgId, fullText, savedReaction));
      el.replaceWith(el); // re-trigger in case
    }

    this._streamEl = null;
    this.scrollToBottom();
    if ('vibrate' in navigator) navigator.vibrate(8);
  },

  _buildRow(role, content, msgId = null, imageUrl = null) {
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    if (role === 'user') {
      let inner = '';
      if (imageUrl) inner += `<img class="msg-img" src="${imageUrl}" alt="image">`;
      inner += content ? `<span>${this._escHtml(content)}</span>` : '';
      row.innerHTML = `<div class="msg-bubble">${inner}</div>`;
    } else {
      const savedReaction = msgId ? (Store.getReactions()[msgId] || null) : null;
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.innerHTML = marked.parse(content);

      const col = document.createElement('div');
      col.className = 'agent-msg-col';

      const avatar = document.createElement('div');
      avatar.className = 'agent-avatar';
      avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2"/></svg>`;

      if (msgId) {
        const actions = this._buildActionBar(msgId, content, savedReaction);
        col.appendChild(bubble);
        col.appendChild(actions);
      } else {
        col.appendChild(bubble);
      }

      row.appendChild(avatar);
      row.appendChild(col);
    }
    return row;
  },

  _buildActionBar(msgId, rawText, savedReaction = null) {
    const bar = document.createElement('div');
    bar.className = 'msg-actions';

    // TTS button
    const ttsBtn = this._mkActBtn('tts', `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>`, 'Озвучить');
    ttsBtn.addEventListener('click', () => TTS.speak(rawText, ttsBtn));

    // Copy button
    const copyBtn = this._mkActBtn('copy', `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>`, 'Копировать');
    copyBtn.addEventListener('click', () => Actions.copy(rawText, copyBtn));

    // Share button
    const shareBtn = this._mkActBtn('share', `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>`, 'Поделиться');
    shareBtn.addEventListener('click', () => Actions.share(rawText));

    // Reactions
    const likeBtn = this._mkActBtn('like reaction-btn' + (savedReaction === 'like' ? ' liked' : ''), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
      </svg>`, 'Нравится');
    const dislikeBtn = this._mkActBtn('dislike reaction-btn' + (savedReaction === 'dislike' ? ' disliked' : ''), `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
        <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
      </svg>`, 'Не нравится');

    likeBtn.addEventListener('click', () => {
      const r = Store.setReaction(msgId, 'like');
      likeBtn.classList.toggle('liked', r === 'like');
      dislikeBtn.classList.remove('disliked');
      if ('vibrate' in navigator) navigator.vibrate(12);
    });
    dislikeBtn.addEventListener('click', () => {
      const r = Store.setReaction(msgId, 'dislike');
      dislikeBtn.classList.toggle('disliked', r === 'dislike');
      likeBtn.classList.remove('liked');
      if ('vibrate' in navigator) navigator.vibrate(12);
    });

    bar.appendChild(ttsBtn);
    bar.appendChild(copyBtn);
    bar.appendChild(shareBtn);
    bar.appendChild(likeBtn);
    bar.appendChild(dislikeBtn);
    return bar;
  },

  _mkActBtn(cls, svgHtml, title) {
    const btn = document.createElement('button');
    btn.className = `act-btn ${cls}`;
    btn.title = title;
    btn.innerHTML = svgHtml;
    return btn;
  },

  _escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  scrollToBottom() {
    const area = document.getElementById('messages-area');
    requestAnimationFrame(() => {
      area.scrollTop = area.scrollHeight;
    });
  }
};

/* ============================================================
   MODULE 10: ACTIONS (copy, share)
   ============================================================ */
const Actions = {
  async copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.show('Скопировано ✓');
      btn.style.color = 'var(--green)';
      setTimeout(() => btn.style.color = '', 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      Toast.show('Скопировано ✓');
    }
  },

  async share(text) {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Antigravity', text: text.slice(0, 500) });
      } catch { /* user cancelled */ }
    } else {
      this.copy(text, document.createElement('button'));
      Toast.show('Ссылка скопирована');
    }
  }
};

/* ============================================================
   MODULE 11: BRAIN
   ============================================================ */
const Brain = {
  load() {
    const b = Store.getBrain();
    document.getElementById('brain-persona').value     = b.persona || '';
    document.getElementById('brain-project').value     = b.project || '';
    document.getElementById('brain-goal').value        = b.goal || '';
    document.getElementById('brain-directives').value  = b.directives || '';
  },

  save() {
    Store.setBrain({
      persona:    document.getElementById('brain-persona').value.trim(),
      project:    document.getElementById('brain-project').value.trim(),
      goal:       document.getElementById('brain-goal').value.trim(),
      directives: document.getElementById('brain-directives').value.trim(),
    });
    const btn = document.getElementById('brain-save-btn');
    btn.classList.add('saved');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Синхронизировано!`;
    if ('vibrate' in navigator) navigator.vibrate([10, 20, 10]);
    setTimeout(() => {
      btn.classList.remove('saved');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Синхронизировать Brain`;
    }, 2000);
  },

  init() {
    document.getElementById('brain-save-btn').addEventListener('click', () => this.save());
  }
};

/* ============================================================
   MODULE 12: HISTORY (sessions)
   ============================================================ */
const History = {
  getCurrent() {
    const id = Store.getCurrentId();
    return Store.getSessions().find(s => s.id === id) || null;
  },

  createNew() {
    const session = {
      id: `s_${Date.now()}`,
      title: 'Новая беседа',
      createdAt: Date.now(),
      messages: []
    };
    const sessions = Store.getSessions();
    sessions.unshift(session);
    Store.setSessions(sessions);
    Store.setCurrentId(session.id);
    Renderer.renderAll([]);
    UI.updateHeader();
    return session;
  },

  saveMessage(role, content, imgUrl = null) {
    const sessions = Store.getSessions();
    const session = sessions.find(s => s.id === Store.getCurrentId());
    if (!session) return null;

    const msgId = `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    session.messages.push({ id: msgId, role, content, imageUrl: imgUrl || undefined });

    // Auto-title from first user message
    if (role === 'user' && session.title === 'Новая беседа') {
      session.title = content.slice(0, 42) + (content.length > 42 ? '…' : '');
    }

    Store.setSessions(sessions);
    UI.updateHeader();
    return msgId;
  },

  load(id) {
    Store.setCurrentId(id);
    const session = this.getCurrent();
    if (session) {
      Renderer.renderAll(session.messages);
    }
    Router.go('chat');
    UI.updateHeader();
  },

  delete(id) {
    let sessions = Store.getSessions().filter(s => s.id !== id);
    Store.setSessions(sessions);
    if (Store.getCurrentId() === id) {
      if (sessions.length) this.load(sessions[0].id);
      else this.createNew();
    }
    this.render();
  },

  render() {
    const list = document.getElementById('sessions-list');
    const sessions = Store.getSessions();
    const currentId = Store.getCurrentId();

    if (!sessions.length) {
      list.innerHTML = `<div class="history-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <p>Нет сохранённых бесед</p>
      </div>`;
      return;
    }

    list.innerHTML = '';
    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = `session-item${s.id === currentId ? ' current' : ''}`;
      const date = new Date(s.createdAt);
      const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      item.innerHTML = `
        <div class="session-info">
          <div class="session-title">${s.title || 'Беседа'}</div>
          <div class="session-meta">${s.messages.length} сообщ. · ${dateStr}</div>
        </div>
        <button class="session-del-btn" title="Удалить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>`;
      item.querySelector('.session-info').addEventListener('click', () => this.load(s.id));
      item.querySelector('.session-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.delete(s.id);
      });
      list.appendChild(item);
    });
  },

  init() {
    document.getElementById('new-chat-btn').addEventListener('click', () => {
      this.createNew();
      Router.go('chat');
    });
    document.getElementById('new-chat-header-btn').addEventListener('click', () => {
      this.createNew();
    });
  }
};

/* ============================================================
   MODULE 13: SETTINGS
   ============================================================ */
const Settings = {
  load() {
    document.getElementById('api-key-input').value = Store.getApiKey();
    document.getElementById('model-select-settings').value = Store.getModel();
    document.getElementById('tts-lang-select').value = Store.getTtsLang();
    const pin = Store.getPin();
    document.querySelector('.settings-row-info p') && null; // placeholder
  },

  save() {
    const apiKey = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('model-select-settings').value;
    const lang = document.getElementById('tts-lang-select').value;
    const newPin = document.getElementById('new-pin-input').value.trim();

    Store.setApiKey(apiKey);
    Store.setModel(model);
    Store.setTtsLang(lang);
    if (newPin.length === 4 && /^\d{4}$/.test(newPin)) {
      Store.setPin(newPin);
      document.getElementById('new-pin-input').value = '';
      Toast.show('PIN изменён');
    }
    ModelPicker.updatePill();
    Toast.show('Настройки сохранены ✓');
    if ('vibrate' in navigator) navigator.vibrate([10, 20, 10]);
  },

  init() {
    document.getElementById('save-settings-btn').addEventListener('click', () => this.save());
    document.getElementById('clear-data-btn').addEventListener('click', () => {
      if (confirm('Удалить все данные? Это необратимо.')) {
        Store.clearAll();
        location.reload();
      }
    });
  }
};

/* ============================================================
   MODEL PICKER - Dynamic (loads real models from OpenRouter)
   ============================================================ */
const ModelPicker = {
  _loaded: false,
  _liveModels: [],

  _fallback: [
    { id: 'openai/gpt-4o-mini',                 name: 'GPT-4o Mini', emoji: '\u{1F535}', desc: 'OpenAI · Работает', free: false },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B',  emoji: '\u{1F32C}', desc: 'Free · Лёгкий',   free: true  },
  ],

  async fetchModels() {
    const key = Store.getApiKey();
    if (!key) return;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': 'Bearer ' + key }
      });
      if (!res.ok) return;
      const data = await res.json();
      const all = data.data || [];

      const free = all
        .filter(m => m.id.endsWith(':free'))
        .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
        .slice(0, 12)
        .map(m => ({
          id:   m.id,
          name: (m.name || m.id.split('/')[1]).replace(/\s*\(.*?\)/g,'').slice(0,30),
          emoji: this._emoji(m.id),
          desc: 'Free · ' + Math.round((m.context_length||4096)/1000) + 'k ctx',
          free: true
        }));

      const paid = all
        .filter(m => !m.id.endsWith(':free') &&
          (m.id.includes('gpt-4o') || m.id.includes('claude') || m.id.includes('gemini-pro')))
        .sort((a, b) => (b.context_length||0)-(a.context_length||0))
        .slice(0, 5)
        .map(m => ({
          id:   m.id,
          name: (m.name || m.id.split('/')[1]).replace(/\s*\(.*?\)/g,'').slice(0,30),
          emoji: this._emoji(m.id),
          desc: 'Pro · ' + (m.pricing?.prompt ? '$'+(parseFloat(m.pricing.prompt)*1e6).toFixed(3)+'/1M' : 'кредиты'),
          free: false
        }));

      this._liveModels = [...free, ...paid];
      this._loaded = true;

      const cur = Store.getModel();
      if (!this._liveModels.find(m => m.id === cur) && free.length) {
        Store.setModel(free[0].id);
      }
      this.updatePill();
    } catch(e) { console.warn('Model fetch failed:', e.message); }
  },

  _emoji(id) {
    if (id.includes('llama'))    return '\u{1F999}';
    if (id.includes('deepseek')) return '\u{1F525}';
    if (id.includes('gemini'))   return '\u2728';
    if (id.includes('claude'))   return '\u{1F7E3}';
    if (id.includes('gpt'))      return '\u{1F535}';
    if (id.includes('mistral'))  return '\u{1F32C}';
    if (id.includes('qwen'))     return '\u{1F409}';
    if (id.includes('phi'))      return '\u26A1';
    return '\u{1F916}';
  },

  _getModels() {
    return this._liveModels.length ? this._liveModels : this._fallback;
  },

  init() {
    const modal = document.getElementById('model-modal');
    const pill  = document.getElementById('model-pill');

    pill.addEventListener('click', () => {
      this._renderOptions();
      modal.classList.add('open');
      if (!this._loaded) this.fetchModels().then(() => this._renderOptions());
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    if (Store.getApiKey()) this.fetchModels();
    this._renderOptions();
    this.updatePill();
  },

  _renderOptions() {
    const list    = document.getElementById('model-options-list');
    const current = Store.getModel();
    const models  = this._getModels();
    list.innerHTML = '';

    if (!this._loaded && Store.getApiKey()) {
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:0.8rem">⏳ Загружаю доступные модели...</div>';
      return;
    }

    const renderGroup = (label, items) => {
      if (!items.length) return;
      const hdr = document.createElement('div');
      hdr.style.cssText = 'padding:0.4rem 1.25rem;font-size:0.62rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.15em;font-family:var(--font-mono);background:var(--bg-1);border-bottom:1px solid var(--border)';
      hdr.textContent = label;
      list.appendChild(hdr);
      items.forEach(m => {
        const opt = document.createElement('div');
        opt.className = 'model-option' + (m.id === current ? ' selected' : '');
        const badge = m.free ? '<span class="model-badge free">FREE</span>' : '<span class="model-badge">PRO</span>';
        opt.innerHTML = '<div class="model-icon">' + m.emoji + '</div>' +
          '<div class="model-info"><div class="model-name">' + m.name + '</div>' +
          '<div class="model-desc">' + m.desc + '</div></div>' + badge;
        opt.addEventListener('click', () => {
          Store.setModel(m.id);
          this.updatePill();
          modal.classList.remove('open');
          this._renderOptions();
          Toast.show('\u2713 ' + m.name);
          if ('vibrate' in navigator) navigator.vibrate(8);
        });
        list.appendChild(opt);
      });
    };

    renderGroup('Бесплатные', models.filter(m => m.free));
    renderGroup('Платные (твои кредиты)', models.filter(m => !m.free));

    if (!models.length) {
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:0.8rem">Введи API ключ в Настройках</div>';
    }
  },

  updatePill() {
    const id     = Store.getModel();
    const models = this._getModels();
    const m      = models.find(x => x.id === id);
    const name   = (m?.name || id.split('/')[1]?.split(':')[0] || 'AI').split(' ').slice(0,3).join(' ');
    document.getElementById('model-pill-text').textContent = name;
  }
}
};

/* ============================================================
   TOAST
   ============================================================ */
const Toast = {
  _timer: null,
  show(msg, duration = 2200) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.remove('show'), duration);
  }
};

/* ============================================================
   UI HELPERS
   ============================================================ */
const UI = {
  adjustTextarea(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  },
  updateSendBtn() {
    const inp = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    btn.disabled = !inp.value.trim() && !Camera.pendingBase64;
  },
  updateHeader() {
    const session = History.getCurrent();
    const sub = document.getElementById('header-sub');
    if (session && session.title !== 'Новая беседа') {
      sub.textContent = session.title.slice(0, 30);
    } else {
      sub.textContent = 'v4.0 · Ready';
    }
  }
};

/* ============================================================
   MAIN CHAT SEND
   ============================================================ */
async function sendMessage() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  const img = Camera.pendingBase64;
  if (!text && !img) return;
  if (AI.isStreaming) return;

  // Reset input
  inp.value = '';
  UI.adjustTextarea(inp);
  UI.updateSendBtn();
  const imgCopy = img;
  Camera.clear();

  // Disable send
  document.getElementById('send-btn').disabled = true;

  // Save & render user message
  History.saveMessage('user', text || '', imgCopy);
  Renderer.addUserMessage(text, imgCopy);

  // Start stream
  Renderer.startAgentStream();

  let agentMsgId = null;

  await AI.send(
    text,
    imgCopy,
    // onChunk
    (delta, full) => {
      Renderer.appendChunk(full);
    },
    // onDone
    (full) => {
      agentMsgId = History.saveMessage('agent', full);
      Renderer.finalizeStream(full, agentMsgId);
      document.getElementById('send-btn').disabled = false;
      inp.focus();
    },
    // onError
    (errMsg) => {
      History.saveMessage('agent', `**⚠️ Ошибка:** ${errMsg}`);
      Renderer.finalizeStream(`**⚠️ Ошибка:** ${errMsg}`, `err_${Date.now()}`);
      document.getElementById('send-btn').disabled = false;
    }
  );
}

/* ============================================================
   MODULE 14: BOOT
   ============================================================ */
function boot() {
  // Init modules
  TTS.init();
  Voice.init();
  Camera.init();
  Router.init();
  Brain.init();
  History.init();
  Settings.init();
  ModelPicker.init();
  Auth.init();

  // Chat input
  const inp = document.getElementById('chat-input');
  inp.addEventListener('input', () => { UI.adjustTextarea(inp); UI.updateSendBtn(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('voice-btn').addEventListener('click', () => Voice.toggle());

  // Suggestion chips
  document.querySelectorAll('.chip[data-text]').forEach(chip => {
    chip.addEventListener('click', () => {
      inp.value = chip.dataset.text;
      UI.adjustTextarea(inp);
      UI.updateSendBtn();
      inp.focus();
    });
  });

  // Ensure a session exists
  const sessions = Store.getSessions();
  if (!sessions.length || !Store.getCurrentId()) {
    if (sessions.length) Store.setCurrentId(sessions[0].id);
    else History.createNew();
  }

  // Render current session
  const session = History.getCurrent();
  if (session) Renderer.renderAll(session.messages);
  UI.updateHeader();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
