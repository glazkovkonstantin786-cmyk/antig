import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

src = pathlib.Path('app.js').read_text(encoding='utf-8')

OLD_START = '/* ============================================================\n   MODEL PICKER\n   ============================================================ */\nconst ModelPicker = {'
OLD_END_MARKER = '\n};\n\n/* ============================================================\n   TOAST'

NEW_PICKER = '''/* ============================================================
   MODEL PICKER - Dynamic (loads real models from OpenRouter)
   ============================================================ */
const ModelPicker = {
  _loaded: false,
  _liveModels: [],

  _fallback: [
    { id: 'openai/gpt-4o-mini',                 name: 'GPT-4o Mini', emoji: '\\u{1F535}', desc: 'OpenAI \xb7 \u0420\u0430\u0431\u043e\u0442\u0430\u0435\u0442', free: false },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B',  emoji: '\\u{1F32C}', desc: 'Free \xb7 \u041b\u0451\u0433\u043a\u0438\u0439',   free: true  },
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
          name: (m.name || m.id.split('/')[1]).replace(/\\s*\\(.*?\\)/g,'').slice(0,30),
          emoji: this._emoji(m.id),
          desc: 'Free \xb7 ' + Math.round((m.context_length||4096)/1000) + 'k ctx',
          free: true
        }));

      const paid = all
        .filter(m => !m.id.endsWith(':free') &&
          (m.id.includes('gpt-4o') || m.id.includes('claude') || m.id.includes('gemini-pro')))
        .sort((a, b) => (b.context_length||0)-(a.context_length||0))
        .slice(0, 5)
        .map(m => ({
          id:   m.id,
          name: (m.name || m.id.split('/')[1]).replace(/\\s*\\(.*?\\)/g,'').slice(0,30),
          emoji: this._emoji(m.id),
          desc: 'Pro \xb7 ' + (m.pricing?.prompt ? '$'+(parseFloat(m.pricing.prompt)*1e6).toFixed(3)+'/1M' : '\u043a\u0440\u0435\u0434\u0438\u0442\u044b'),
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
    if (id.includes('llama'))    return '\\u{1F999}';
    if (id.includes('deepseek')) return '\\u{1F525}';
    if (id.includes('gemini'))   return '\\u2728';
    if (id.includes('claude'))   return '\\u{1F7E3}';
    if (id.includes('gpt'))      return '\\u{1F535}';
    if (id.includes('mistral'))  return '\\u{1F32C}';
    if (id.includes('qwen'))     return '\\u{1F409}';
    if (id.includes('phi'))      return '\\u26A1';
    return '\\u{1F916}';
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
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:0.8rem">\u23f3 \u0417\u0430\u0433\u0440\u0443\u0436\u0430\u044e \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u043c\u043e\u0434\u0435\u043b\u0438...</div>';
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
          Toast.show('\\u2713 ' + m.name);
          if ('vibrate' in navigator) navigator.vibrate(8);
        });
        list.appendChild(opt);
      });
    };

    renderGroup('\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0435', models.filter(m => m.free));
    renderGroup('\u041f\u043b\u0430\u0442\u043d\u044b\u0435 (\u0442\u0432\u043e\u0438 \u043a\u0440\u0435\u0434\u0438\u0442\u044b)', models.filter(m => !m.free));

    if (!models.length) {
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-3);font-size:0.8rem">\u0412\u0432\u0435\u0434\u0438 API \u043a\u043b\u044e\u0447 \u0432 \u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445</div>';
    }
  },

  updatePill() {
    const id     = Store.getModel();
    const models = this._getModels();
    const m      = models.find(x => x.id === id);
    const name   = (m?.name || id.split('/')[1]?.split(':')[0] || 'AI').split(' ').slice(0,3).join(' ');
    document.getElementById('model-pill-text').textContent = name;
  }
}'''

start_idx = src.find(OLD_START)
end_idx   = src.find(OLD_END_MARKER, start_idx)
if start_idx == -1 or end_idx == -1:
    print('ERROR: markers not found', start_idx, end_idx)
    sys.exit(1)

result = src[:start_idx] + NEW_PICKER + src[end_idx:]
pathlib.Path('app.js').write_text(result, encoding='utf-8')
print('OK: replaced', len(src), '->', len(result), 'bytes')
