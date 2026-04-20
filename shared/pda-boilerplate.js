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
        const STYLES = { bg: '#2a2a2a', panel: '#333', text: '#ddd', textMuted: '#999', border: '#555', accent: '#82c91e' };
        const POS_KEY = 'pda_shared_menu_position';
        function sGet(k, d = '{}') { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
        function sSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
        function loadPos() { try { const p = JSON.parse(sGet(POS_KEY)); return { top: p.top ?? 100, left: p.left ?? 10 }; } catch { return { top: 100, left: 10 }; } }
        function clamp(t, l, w = 44, h = 44) { const m = 5; return { top: Math.max(m, Math.min(t, window.innerHeight - h - m)), left: Math.max(m, Math.min(l, window.innerWidth - w - m)) }; }

        window.PDAScriptsMenu = {
            _scripts: new Map(), _button: null, _dropdown: null, _isDragging: false,
            register(id, name, cfg) {
                if (this._scripts.has(id)) return;
                this._scripts.set(id, { id, name, config: cfg, values: this._load(id) });
                this._updateUI();
            },
            getSetting(id, k, d) { const s = this._scripts.get(id); return s ? (s.values[k] ?? d) : d; },
            setSetting(id, k, v) { const s = this._scripts.get(id); if (s) { s.values[k] = v; this._save(id, s.values); if (s.config.onChange) s.config.onChange(k, v); } },
            _load(id) { try { return JSON.parse(sGet(`pda_script_${id}_settings`, '{}')); } catch { return {}; } },
            _save(id, v) { sSet(`pda_script_${id}_settings`, JSON.stringify(v)); },
            _ensureBtn() {
                if (this._button) return this._button;
                const b = document.createElement('button');
                b.id = 'pda-shared-settings-btn';
                b.innerHTML = '⚙️';
                const p = clamp(...Object.values(loadPos()));
                b.style.cssText = `position:fixed;top:${p.top}px;left:${p.left}px;z-index:99999;width:44px;height:44px;background:${STYLES.bg};border:2px solid ${STYLES.border};border-radius:8px;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,0.4);touch-action:none;user-select:none;`;
                let dragStart = 0, sx, sy, st, sl;
                const startDrag = (cx, cy) => { this._isDragging = true; sx = cx; sy = cy; st = parseInt(b.style.top); sl = parseInt(b.style.left); };
                const moveDrag = (cx, cy) => { if (!this._isDragging) return; const c = clamp(st + cy - sy, sl + cx - sx); b.style.top = c.top + 'px'; b.style.left = c.left + 'px'; };
                const endDrag = () => { if (!this._isDragging) return; this._isDragging = false; sSet(POS_KEY, JSON.stringify({ top: parseInt(b.style.top), left: parseInt(b.style.left) })); };
                b.addEventListener('mousedown', e => { dragStart = Date.now(); const tm = setTimeout(() => startDrag(e.clientX, e.clientY), 300); const onMove = e => moveDrag(e.clientX, e.clientY); const onUp = () => { clearTimeout(tm); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); endDrag(); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
                b.addEventListener('touchstart', e => { dragStart = Date.now(); const t = e.touches[0]; const tm = setTimeout(() => startDrag(t.clientX, t.clientY), 300); const onMove = e => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }; const onEnd = () => { clearTimeout(tm); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); endDrag(); }; document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('touchend', onEnd); }, { passive: true });
                b.addEventListener('click', e => { e.stopPropagation(); if (Date.now() - dragStart < 300 && !this._isDragging) this._toggle(); });
                document.body.appendChild(b); this._button = b; return b;
            },
            _toggle() { if (this._dropdown) { this._dropdown.remove(); this._dropdown = null; } else this._show(); },
            _show() {
                const d = document.createElement('div');
                d.style.cssText = `position:fixed;top:100px;left:10px;width:320px;max-height:400px;background:${STYLES.bg};border:1px solid ${STYLES.border};border-radius:8px;z-index:99998;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);color:${STYLES.text};font-family:Arial,sans-serif;`;
                const h = document.createElement('div');
                h.style.cssText = `padding:12px 16px;border-bottom:1px solid ${STYLES.border};font-weight:bold;font-size:14px;background:linear-gradient(180deg,#3a3a3a,${STYLES.bg});border-radius:8px 8px 0 0;`;
                h.textContent = '🎮 PDA Scripts';
                d.appendChild(h);
                this._scripts.forEach(s => d.appendChild(this._createSection(s)));
                const close = e => { if (!d.contains(e.target) && e.target !== this._button) { d.remove(); this._dropdown = null; document.removeEventListener('click', close); } };
                setTimeout(() => document.addEventListener('click', close), 100);
                document.body.appendChild(d); this._dropdown = d;
            },
            _createSection(s) {
                const sec = document.createElement('div'); sec.style.cssText = 'border-bottom:1px solid ' + STYLES.border;
                const h = document.createElement('div'); h.style.cssText = `padding:10px 16px;background:${STYLES.panel};font-weight:bold;font-size:13px;`; h.textContent = s.name; sec.appendChild(h);
                const b = document.createElement('div'); b.style.cssText = 'padding:12px 16px;';
                if (s.config.fields) s.config.fields.forEach(f => {
                    const row = document.createElement('div'); row.style.cssText = 'margin-bottom:12px;';
                    const lbl = document.createElement('label'); lbl.style.cssText = `display:block;color:${STYLES.textMuted};font-size:11px;margin-bottom:4px;text-transform:uppercase;`; lbl.textContent = f.label; row.appendChild(lbl);
                    if (f.type === 'number') {
                        const inp = document.createElement('input'); inp.type = 'number'; inp.value = this.getSetting(s.id, f.key, f.default); inp.style.cssText = `width:100%;padding:8px 12px;background:${STYLES.bg};border:1px solid ${STYLES.border};border-radius:4px;color:${STYLES.text};font-size:13px;box-sizing:border-box;`; inp.addEventListener('change', () => this.setSetting(s.id, f.key, parseFloat(inp.value))); row.appendChild(inp);
                    } else if (f.type === 'toggle') {
                        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
                        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = this.getSetting(s.id, f.key, f.default); inp.addEventListener('change', () => this.setSetting(s.id, f.key, inp.checked)); wrap.appendChild(inp);
                        const span = document.createElement('span'); span.style.cssText = `color:${STYLES.text};font-size:13px;`; span.textContent = inp.checked ? 'On' : 'Off'; inp.addEventListener('change', () => span.textContent = inp.checked ? 'On' : 'Off'); wrap.appendChild(span);
                        row.appendChild(wrap);
                    }
                    b.appendChild(row);
                });
                sec.appendChild(b); return sec;
            },
            _updateUI() { this._ensureBtn(); }
        };
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
