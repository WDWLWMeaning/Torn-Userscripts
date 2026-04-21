// ==UserScript==
// @name         Torn Script Boilerplate (PDA + Tampermonkey)
// @namespace    torn-boilerplate
// @version      1.0.0
// @description  Starter template for Torn userscripts with shared PDA menu support
// @author       Your Name
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    // PDA replaces this with the actual API key at runtime
    let PDA_API_KEY = '###PDA-APIKEY###';

    // Prevent duplicate script execution
    if (window.__myScriptPDALoaded) return;
    window.__myScriptPDALoaded = true;

    // ============================================
    // SHARED MENU INITIALIZER (copy this block to all PDA scripts)
    // ============================================
    if (!window.PDAScriptsMenu) {
        const STYLES = { bg: '#2a2a2a', panel: '#333', panelHover: '#444', text: '#ddd', textMuted: '#999', border: '#555', accent: '#82c91e' };
        const POS_KEY = 'pda_shared_menu_position';
        function sGet(k, d = '{}') { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
        function sSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
        function loadPos() { try { const p = JSON.parse(sGet(POS_KEY)); return { top: p.top ?? 100, left: p.left ?? 10 }; } catch { return { top: 100, left: 10 }; } }
        function clamp(t, l, w = 44, h = 44) { const m = 5; return { top: Math.max(m, Math.min(t, window.innerHeight - h - m)), left: Math.max(m, Math.min(l, window.innerWidth - w - m)) }; }

        window.PDAScriptsMenu = {
            _scripts: new Map(), _button: null, _dropdown: null, _isDragging: false,
            register(id, name, cfg) {
                if (this._scripts.has(id)) {
                    console.log('[PDA Menu] Script already registered:', id);
                    return;
                }
                this._scripts.set(id, { id, name, config: cfg, values: this._load(id) });
                this._saveReg(id, name);
                this._updateUI();
            },
            unregister(id) { this._scripts.delete(id); this._updateUI(); },
            getSetting(id, k, d) { const s = this._scripts.get(id); return s ? (s.values[k] ?? d) : d; },
            setSetting(id, k, v) { const s = this._scripts.get(id); if (s) { s.values[k] = v; this._save(id, s.values); if (s.config.onChange) s.config.onChange(k, v); } },
            _load(id) { try { return JSON.parse(sGet(`pda_script_${id}_settings`, '{}')); } catch { return {}; } },
            _save(id, v) { sSet(`pda_script_${id}_settings`, JSON.stringify(v)); },
            _saveReg(id, n) { const r = JSON.parse(sGet('pda_registered_scripts', '[]')); if (!r.find(x => x.id === id)) { r.push({ id, name: n, at: Date.now() }); sSet('pda_registered_scripts', JSON.stringify(r)); } },
            _ensureBtn() {
                if (this._button) return this._button;
                if (document.getElementById('pda-shared-settings-btn')) { this._button = document.getElementById('pda-shared-settings-btn'); return this._button; }
                const b = document.createElement('button'); b.id = 'pda-shared-settings-btn'; b.type = 'button'; b.title = 'PDA Scripts (hold to drag)'; b.innerHTML = '⚙️';
                const p = clamp(...Object.values(loadPos()));
                b.style.cssText = `position:fixed;top:${p.top}px;left:${p.left}px;z-index:99999;width:44px;height:44px;background:${STYLES.bg};border:2px solid ${STYLES.border};border-radius:8px;color:${STYLES.text};font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.4);transition:transform .15s,box-shadow .15s,border-color .15s;touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;`;
                let dragStart = 0, sx, sy, st, sl; const TH = 300;
                const startDrag = (cx, cy) => { this._isDragging = true; b.style.cursor = 'grabbing'; b.style.transition = 'none'; b.style.boxShadow = `0 5px 20px rgba(130,201,30,0.5)`; b.style.borderColor = STYLES.accent; sx = cx; sy = cy; st = parseInt(b.style.top); sl = parseInt(b.style.left); };
                const moveDrag = (cx, cy) => { if (!this._isDragging) return; const c = clamp(st + cy - sy, sl + cx - sx); b.style.top = c.top + 'px'; b.style.left = c.left + 'px'; };
                const endDrag = () => { if (!this._isDragging) return; this._isDragging = false; b.style.cursor = 'pointer'; b.style.transition = 'transform .15s,box-shadow .15s,border-color .15s'; b.style.boxShadow = '0 3px 12px rgba(0,0,0,0.4)'; b.style.borderColor = STYLES.border; sSet(POS_KEY, JSON.stringify({ top: parseInt(b.style.top), left: parseInt(b.style.left) })); };
                b.addEventListener('mousedown', e => { dragStart = Date.now(); const tm = setTimeout(() => { if (Date.now() - dragStart >= TH - 50) startDrag(e.clientX, e.clientY); }, TH); const onMove = e => moveDrag(e.clientX, e.clientY); const onUp = () => { clearTimeout(tm); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); endDrag(); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
                b.addEventListener('touchstart', e => { dragStart = Date.now(); const t = e.touches[0]; const tm = setTimeout(() => { if (Date.now() - dragStart >= TH - 50) startDrag(t.clientX, t.clientY); }, TH); const onMove = e => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }; const onEnd = () => { clearTimeout(tm); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); endDrag(); }; document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('touchend', onEnd); }, { passive: true });
                b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (Date.now() - dragStart < TH && !this._isDragging) this._toggle(); });
                b.addEventListener('mouseenter', () => { if (!this._isDragging) { b.style.transform = 'scale(1.05)'; b.style.borderColor = STYLES.accent; } });
                b.addEventListener('mouseleave', () => { b.style.transform = 'scale(1)'; if (!this._dropdown?.classList.contains('open')) b.style.borderColor = STYLES.border; });
                document.body.appendChild(b); this._button = b; return b;
            },
            _toggle() {
                const existing = document.getElementById('pda-shared-menu');
                if (existing) {
                    existing.remove();
                    this._dropdown = null;
                    return;
                }
                if (this._dropdown) {
                    this._dropdown.remove();
                    this._dropdown = null;
                } else {
                    this._show();
                }
            },
            _show() {
                const orphaned = document.getElementById('pda-shared-menu');
                if (orphaned) orphaned.remove();

                const d = document.createElement('div');
                d.id = 'pda-shared-menu';
                d.className = 'open';
                this._dropdown = d;

                this._calcMenuPosition(d);

                const h = document.createElement('div');
                h.style.cssText = `padding:12px 16px;border-bottom:1px solid ${STYLES.border};font-weight:bold;font-size:14px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#3a3a3a 0%,${STYLES.bg} 100%);border-radius:8px 8px 0 0;`;
                h.innerHTML = `<span>🎮 PDA Scripts</span><span style="color:${STYLES.textMuted};font-size:12px;font-weight:normal">${this._scripts.size} active</span>`;
                d.appendChild(h);

                if (this._scripts.size === 0) {
                    const e = document.createElement('div');
                    e.style.cssText = `padding:24px;text-align:center;color:${STYLES.textMuted};`;
                    e.textContent = 'No scripts registered';
                    d.appendChild(e);
                } else {
                    this._scripts.forEach(s => d.appendChild(this._createSection(s)));
                }

                const close = e => {
                    if (!d.contains(e.target) && e.target !== this._button) {
                        d.remove();
                        this._dropdown = null;
                        this._stopPositionTracking();
                        document.removeEventListener('click', close);
                    }
                };

                document.body.appendChild(d);
                setTimeout(() => document.addEventListener('click', close), 100);
                this._startPositionTracking();
            },
            _calcMenuPosition(d) {
                if (!this._button) return;
                const r = this._button.getBoundingClientRect();
                const W = 320;
                const H = Math.min(400, window.innerHeight * 0.7);
                const margin = 10;

                const buttonCenter = r.left + r.width / 2;
                const screenCenter = window.innerWidth / 2;
                const isRightSide = buttonCenter > screenCenter;

                let left, top;
                if (isRightSide) {
                    left = Math.max(margin, r.left - W - 8);
                } else {
                    left = Math.min(r.left, window.innerWidth - W - margin);
                }

                const spaceBelow = window.innerHeight - r.bottom - margin;
                const spaceAbove = r.top - margin;
                if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
                    top = r.bottom + 8;
                } else {
                    top = Math.max(margin, r.top - H - 8);
                }

                d.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${W}px;max-height:${H}px;background:${STYLES.bg};border:1px solid ${STYLES.border};border-radius:8px;z-index:99998;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:${STYLES.text};`;
            },
            _startPositionTracking() {
                this._stopPositionTracking();
                this._posTrackingInterval = setInterval(() => {
                    if (!this._button) {
                        this._stopPositionTracking();
                        return;
                    }
                    if (this._dropdown && document.body.contains(this._dropdown)) {
                        this._calcMenuPosition(this._dropdown);
                    }
                }, 50);
            },
            _stopPositionTracking() {
                if (this._posTrackingInterval) {
                    clearInterval(this._posTrackingInterval);
                    this._posTrackingInterval = null;
                }
            },
            _updateMenuPosition() {
                if (this._dropdown && document.body.contains(this._dropdown)) {
                    this._calcMenuPosition(this._dropdown);
                }
            },
            _createSection(s) {
                const sec = document.createElement('div'); sec.style.cssText = `border-bottom:1px solid ${STYLES.border};`;
                const h = document.createElement('div'); h.style.cssText = `padding:10px 16px;background:${STYLES.panel};font-weight:bold;font-size:13px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;`; h.innerHTML = `<span>${s.name}</span><span style="color:${STYLES.textMuted};font-size:12px;">▸</span>`; sec.appendChild(h);
                const b = document.createElement('div'); b.style.cssText = 'padding:12px 16px;display:none;';
                let collapsed = true;
                h.addEventListener('click', () => {
                    collapsed = !collapsed;
                    b.style.display = collapsed ? 'none' : 'block';
                    h.lastChild.textContent = collapsed ? '▸' : '▾';
                });
                if (s.config.fields) s.config.fields.forEach(f => b.appendChild(this._createField(s, f)));
                sec.appendChild(b); return sec;
            },
            _createField(s, f) {
                const w = document.createElement('div'); w.style.cssText = 'margin-bottom:12px;';
                const lbl = document.createElement('label'); lbl.style.cssText = `display:block;font-size:12px;color:${STYLES.textMuted};margin-bottom:4px;`; lbl.textContent = f.label; w.appendChild(lbl);
                const cur = this.getSetting(s.id, f.key, f.default);
                if (f.type === 'number' || f.type === 'text') { const inp = document.createElement('input'); inp.type = f.type === 'number' ? 'number' : 'text'; inp.value = cur; inp.style.cssText = `width:100%;padding:8px 10px;background:${STYLES.panel};border:1px solid ${STYLES.border};border-radius:4px;color:${STYLES.text};font-size:13px;box-sizing:border-box;`; inp.addEventListener('change', () => this.setSetting(s.id, f.key, f.type === 'number' ? (parseInt(inp.value) || f.default) : inp.value)); w.appendChild(inp); }
                else if (f.type === 'toggle') { const btn = document.createElement('button'); btn.textContent = cur ? '✅ Enabled' : '❌ Disabled'; btn.style.cssText = `padding:6px 12px;background:${cur ? STYLES.accent : STYLES.panel};border:1px solid ${STYLES.border};border-radius:4px;color:${STYLES.text};cursor:pointer;font-size:12px;`; btn.addEventListener('click', () => { const nv = !this.getSetting(s.id, f.key, f.default); this.setSetting(s.id, f.key, nv); btn.textContent = nv ? '✅ Enabled' : '❌ Disabled'; btn.style.background = nv ? STYLES.accent : STYLES.panel; }); w.appendChild(btn); }
                else if (f.type === 'select') { const sel = document.createElement('select'); sel.style.cssText = `width:100%;padding:8px 10px;background:${STYLES.panel};border:1px solid ${STYLES.border};border-radius:4px;color:${STYLES.text};font-size:13px;`; f.options.forEach(o => { const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label; opt.selected = o.value === cur; sel.appendChild(opt); }); sel.addEventListener('change', () => this.setSetting(s.id, f.key, sel.value)); w.appendChild(sel); }
                return w;
            },
            _updateUI() { if (this._dropdown) { this._dropdown.remove(); this._dropdown = null; this._show(); } }
        };
        function initBtn() { if (window.PDAScriptsMenu._button) return; window.PDAScriptsMenu._ensureBtn(); console.log('[PDA Menu] Initialized'); }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBtn); else initBtn();
    }

    // ============================================
    // YOUR SCRIPT CODE STARTS HERE
    // ============================================
    
    const CONFIG = {
        updateInterval: 60000,
        mySetting: 10
    };

    function log(...args) { console.log('[My Script]', ...args); }

    function getApiKey() {
        // Build placeholder dynamically so PDA doesn't replace it
        const placeholder = '#' + '##PDA-APIKEY###';
        if (PDA_API_KEY && PDA_API_KEY !== placeholder && PDA_API_KEY.length > 10) {
            return PDA_API_KEY;  // Use PDA-provided key
        }
        // Fallback: get from shared menu settings
        if (window.PDAScriptsMenu) {
            return window.PDAScriptsMenu.getSetting('myScript', 'apiKey', '');
        }
        return '';
    }

    async function apiRequest(path) {
        const key = getApiKey();
        if (!key) throw new Error('No API key');
        
        const url = `https://api.torn.com/v2${path}?key=${encodeURIComponent(key)}`;
        
        // Use PDA's native HTTP function if available, otherwise fetch
        if (typeof PDA_httpGet === 'function') {
            const resp = await PDA_httpGet(url);
            const data = JSON.parse(resp.responseText);
            if (data.error) throw new Error(data.error.error);
            return data;
        } else {
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.error) throw new Error(data.error.error);
            return data;
        }
    }

    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('myScript', '📋 My Script', {
            fields: [
                { 
                    key: 'mySetting', 
                    label: 'My Setting', 
                    type: 'number', 
                    default: 10 
                },
                { 
                    key: 'enabled', 
                    label: 'Enabled', 
                    type: 'toggle', 
                    default: true 
                }
            ],
            onChange: (key, value) => {
                log('Setting changed:', key, value);
                // Update your CONFIG or re-run logic here
                CONFIG.mySetting = window.PDAScriptsMenu.getSetting('myScript', 'mySetting', 10);
            }
        });
        log('✓ Registered with shared menu');
    }

    async function init() {
        log('Initializing...');
        registerWithSharedMenu();

        // Example: fetch data
        try {
            if (getApiKey()) {
                const data = await apiRequest('/user');
                log('API data:', data);
            }
        } catch (err) {
            log('API error:', err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
