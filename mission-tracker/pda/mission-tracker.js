// ==UserScript==
// @name         Torn Mission Tracker (PDA)
// @namespace    torn-mission-tracker
// @version      5.0.0
// @description  Shows red/yellow badge on Missions button based on mission status. Red = unaccepted Available missions. Yellow = active Accepted missions. Uses PDA-APIKEY for automatic API access.
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    // PDA replaces this with the actual API key at runtime
    let PDA_API_KEY = '###PDA-APIKEY###';

    // Prevent duplicate script execution
    if (window.__missionTrackerPDALoaded) return;
    window.__missionTrackerPDALoaded = true;

    // ============================================
    // SHARED MENU INITIALIZER
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
                    }
                    b.appendChild(row);
                });
                sec.appendChild(b); return sec;
            },
            _updateUI() { this._ensureBtn(); }
        };
    }

    // ============================================
    // MISSION TRACKER CODE
    // ============================================
    const CONFIG = {
        updateInterval: 30000,
        cacheTtlMinutes: 5
    };

    let updateTimer = null;

    function log(...args) { console.log('[Mission Tracker]', ...args); }

    function storageGet(key, fallback = '') {
        try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch {}
    }
    function getCache(key) {
        try {
            const data = storageGet(`mt_cache_${key}`);
            const time = parseInt(storageGet(`mt_cache_${key}_time`, '0'));
            if (!data || (Date.now() - time) > CONFIG.cacheTtlMinutes * 60000) return null;
            return JSON.parse(data);
        } catch { return null; }
    }
    function setCache(key, data) {
        storageSet(`mt_cache_${key}`, JSON.stringify(data));
        storageSet(`mt_cache_${key}_time`, Date.now().toString());
    }

    function getApiKey() {
        const placeholder = '#' + '##PDA-APIKEY###';
        if (PDA_API_KEY && PDA_API_KEY !== placeholder && PDA_API_KEY.length > 10) {
            return PDA_API_KEY;
        }
        if (window.PDAScriptsMenu) {
            return window.PDAScriptsMenu.getSetting('missionTracker', 'apiKey', '');
        }
        return '';
    }

    async function apiRequest(path) {
        const key = getApiKey();
        if (!key) throw new Error('No API key');
        const url = `https://api.torn.com/v2${path}?key=${encodeURIComponent(key)}`;
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

    function countMissions(data) {
        const givers = data?.missions?.givers || data?.givers || [];
        let available = 0, accepted = 0;
        for (const giver of givers) {
            for (const contract of giver.contracts || []) {
                if (contract.status === 'Available') available++;
                if (contract.status === 'Accepted') accepted++;
            }
        }
        return { available, accepted };
    }

    function ensureStyles() {
        if (document.getElementById('mt-pda-styles')) return;
        const style = document.createElement('style');
        style.id = 'mt-pda-styles';
        style.textContent = `
            #mt-mission-badge {
                position: absolute;
                top: 4px;
                right: 4px;
                min-width: 14px;
                height: 14px;
                padding: 0 3px;
                border-radius: 7px;
                font-size: 10px;
                font-weight: 700;
                line-height: 14px;
                text-align: center;
                color: #fff;
                pointer-events: none;
                z-index: 100;
                box-sizing: border-box;
            }
            #mt-mission-badge.red { background: #e23d3d; }
            #mt-mission-badge.yellow { background: #e0a800; color: #000; }
            #nav-missions.mission-tint-yellow { background: rgba(224,168,0,0.15) !important; border-radius: 5px; }
            #nav-missions.mission-tint-red { background: rgba(226,61,61,0.15) !important; border-radius: 5px; }
        `;
        document.head.appendChild(style);
    }

    function getMissionLinks() {
        return document.querySelectorAll('#nav-missions a');
    }

    function ensureBadge(link, className, count) {
        ensureStyles();
        let badge = link.querySelector('#mt-mission-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'mt-mission-badge';
            link.style.position = 'relative';
            link.appendChild(badge);
        }
        badge.textContent = count;
        badge.className = '';
        badge.classList.add(className);
        badge.style.display = '';
    }

    function removeBadge(link) {
        const badge = link.querySelector('#mt-mission-badge');
        if (badge) badge.style.display = 'none';
    }

    function setTint(tintClass) {
        const nav = document.getElementById('nav-missions');
        if (!nav) return;
        nav.classList.remove('mission-tint-yellow', 'mission-tint-red');
        if (tintClass) nav.classList.add(tintClass);
    }

    async function update() {
        if (!getApiKey()) {
            log('No API key configured');
            return;
        }
        try {
            let data = getCache('missions');
            if (!data) {
                data = await apiRequest('/user/missions');
                setCache('missions', data);
            }
            const { available, accepted } = countMissions(data);

            getMissionLinks().forEach(link => {
                if (available > 0) ensureBadge(link, 'red', available);
                else if (accepted > 0) ensureBadge(link, 'yellow', accepted);
                else removeBadge(link);
            });

            if (accepted >= 3) setTint('mission-tint-red');
            else if (accepted >= 1) setTint('mission-tint-yellow');
            else setTint(null);

        } catch (err) {
            log('Error:', err.message);
        }
    }

    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('missionTracker', '📋 Mission Tracker', {
            fields: [{ key: 'apiKey', label: 'API Key (optional - PDA auto-fills)', type: 'number' }]
        });
        log('✓ Registered with shared menu');
    }

    function init() {
        log('v5.0.0 initializing...');
        registerWithSharedMenu();

        // Wait for nav to exist
        const waitForNav = setInterval(() => {
            if (document.getElementById('nav-missions')) {
                clearInterval(waitForNav);
                update();
                updateTimer = setInterval(update, CONFIG.updateInterval);
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
