// ==UserScript==
// @name         Torn Mission Tracker (PDA)
// @namespace    torn-mission-tracker
// @version      4.0.14
// @description  Track Torn missions with alerts. Uses PDA-APIKEY placeholder for automatic API access.
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

// Self-initializing shared menu - creates PDAScriptsMenu if not already present
(function() {
    'use strict';

    // Prevent duplicate script execution
    if (window.__missionTrackerPDALoaded) {
        console.log('[Mission Tracker] Already loaded, skipping');
        return;
    }
    window.__missionTrackerPDALoaded = true;

    // ============================================
    // SHARED MENU INITIALIZER (runs once globally)
    // ============================================
    
    function getPdaApiKey() {
        // PDA replaces ###PDA-APIKEY### at runtime
        // Use a function to read it fresh each time (in case PDA replaces it after initial parse)
        const key = "###PDA-APIKEY###";
        return key;
    }
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
                // Prevent duplicate registrations
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
                // Check for orphaned dropdown (DOM element exists but reference lost)
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
                // Remove any orphaned dropdown first
                const orphaned = document.getElementById('pda-shared-menu');
                if (orphaned) orphaned.remove();
                
                const d = document.createElement('div'); 
                d.id = 'pda-shared-menu'; 
                d.className = 'open';
                this._dropdown = d; // Set reference immediately
                
                // Calculate and set position
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
                
                // Close handler that also clears tracking
                const close = e => { 
                    if (!d.contains(e.target) && e.target !== this._button) { 
                        d.remove(); 
                        this._dropdown = null; 
                        this._stopPositionTracking();
                        document.removeEventListener('click', close); 
                    } 
                };
                
                document.body.appendChild(d);
                // Delay adding close listener to avoid immediate close
                setTimeout(() => document.addEventListener('click', close), 100);
                
                // Start position tracking
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
                this._stopPositionTracking(); // Clear any existing
                this._posTrackingInterval = setInterval(() => {
                    if (!this._button) {
                        this._stopPositionTracking();
                        return;
                    }
                    // Update position if dropdown exists
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
                const h = document.createElement('div'); h.style.cssText = `padding:10px 16px;background:${STYLES.panel};font-weight:bold;font-size:13px;`; h.textContent = s.name; sec.appendChild(h);
                const b = document.createElement('div'); b.style.cssText = 'padding:12px 16px;';
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

    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000,
        cacheTtlMinutes: 5,
        get urgentHours() { return window.PDAScriptsMenu?.getSetting('missionTracker', 'urgentHours', 24) ?? 24; },
        get warningHours() { return window.PDAScriptsMenu?.getSetting('missionTracker', 'warningHours', 48) ?? 48; }
    };

    const TORN = {
        bg: '#444',
        panel: '#333',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        border: '#444'
    };

    let badgeElement = null;
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
        // Get fresh value from function (PDA replaces ###PDA-APIKEY### at runtime)
        const pdaKey = getPdaApiKey();
        const placeholder = '###PDA-APIKEY###';
        const isPlaceholder = pdaKey === placeholder;
        
        log('getApiKey check - isPlaceholder:', isPlaceholder, '| value length:', pdaKey?.length);
        
        // PDA replaces ###PDA-APIKEY### at runtime - check if it's been replaced
        if (pdaKey && !isPlaceholder && pdaKey.length > 10) {
            log('Using PDA-provided API key');
            return pdaKey;
        }
        // Fallback to manual setting if PDA key not available
        if (window.PDAScriptsMenu) {
            const manualKey = window.PDAScriptsMenu.getSetting('missionTracker', 'apiKey', '');
            if (manualKey) log('Using manual API key from settings');
            return manualKey;
        }
        const storageKey = storageGet('mt_api_key');
        if (storageKey) log('Using API key from localStorage');
        return storageKey;
    }

    async function apiRequest(path) {
        const key = getApiKey();
        if (!key) throw new Error('No API key');

        const url = `${CONFIG.apiBaseUrl}${path}?key=${encodeURIComponent(key)}&comment=mission-tracker-pda`;

        // Use PDA_httpGet if available, otherwise fetch
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

    function processMissions(payload) {
        const givers = payload?.givers;
        if (!Array.isArray(givers)) return { count: 0, urgent: false, warning: false };

        const now = Date.now() / 1000;
        let count = 0, urgent = false, warning = false;

        for (const giver of givers) {
            for (const mission of (giver?.contracts || [])) {
                if (mission.status !== 'Accepted' && mission.status !== 'Available') continue;
                count++;
                if (mission.status === 'Accepted' && mission.expires_at) {
                    const hours = (mission.expires_at - now) / 3600;
                    if (hours > 0 && hours <= CONFIG.urgentHours) urgent = true;
                    else if (hours > 0 && hours <= CONFIG.warningHours) warning = true;
                }
            }
        }
        return { count, urgent, warning: warning && !urgent };
    }

    function ensureStyles() {
        if (document.getElementById('mt-pda-styles')) return;
        const style = document.createElement('style');
        style.id = 'mt-pda-styles';
        style.textContent = `
            #mt-mission-badge {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
                height: 18px;
                padding: 0 4px;
                background: ${TORN.panel};
                color: ${TORN.text};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                font-size: 11px;
                font-weight: 700;
                font-family: Arial, sans-serif;
            }
            #mt-mission-badge.urgent {
                background: ${TORN.red};
                color: #fff;
                box-shadow: 0 0 8px rgba(229,76,25,0.6);
            }
            #mt-mission-badge.warning {
                background: ${TORN.yellow};
                color: #000;
            }
            @media (max-width: 768px) {
                #mt-mission-badge { right: 4px; top: 4px; transform: none; min-width: 14px; height: 14px; font-size: 9px; }
            }
        `;
        document.head.appendChild(style);
    }

    function findMissionsContainer() {
        // First try to find #nav-missions (like Tampermonkey)
        const navMissions = document.getElementById('nav-missions');
        if (navMissions) {
            // Look for .area-row___iBD8N inside it (Torn's nav structure)
            const areaRow = navMissions.querySelector('.area-row___iBD8N, [class*="area-row"]');
            if (areaRow) return areaRow;
            return navMissions;
        }

        // Fallback: try to find missions link directly
        const selectors = [
            'a[href*="sid=missions"]',
            'a[href*="/missions.php"]',
            '[class*="nav"] a[href*="mission"]',
            '[class*="sidebar"] a[href*="mission"]',
            'a[title*="Missions" i]',
            'a[title*="Contract" i]',
            '[class*="dashboard"] [class*="status"]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                // If it's a link, return its parent for positioning
                if (el.tagName === 'A') {
                    return el.parentElement || el;
                }
                return el;
            }
        }
        return null;
    }

    function createBadge(container) {
        if (!container) return null;

        // Remove existing badge if present
        const existing = document.getElementById('mt-mission-badge');
        if (existing) existing.remove();

        const badge = document.createElement('span');
        badge.id = 'mt-mission-badge';

        // Make container relative for absolute positioning
        if (container.style.position !== 'relative' && container.style.position !== 'absolute') {
            container.style.position = 'relative';
        }

        container.appendChild(badge);
        return badge;
    }

    function updateBadge(status) {
        ensureStyles();

        if (!badgeElement || !document.body.contains(badgeElement)) {
            const container = findMissionsContainer();
            if (!container) {
                log('Missions container not found, will retry');
                return;
            }
            badgeElement = createBadge(container);
        }

        if (!badgeElement) return;

        if (status.count === 0) {
            badgeElement.style.display = 'none';
            return;
        }

        badgeElement.style.display = 'inline-flex';
        badgeElement.textContent = status.count;
        badgeElement.className = status.urgent ? 'urgent' : status.warning ? 'warning' : '';
    }

    async function refresh(force = false) {
        if (!getApiKey()) {
            log('No API key configured');
            return;
        }
        try {
            if (force) setCache('missions', null);
            let missions = getCache('missions');
            if (!missions) {
                missions = await apiRequest('/user/missions');
                setCache('missions', missions);
            }
            const status = processMissions(missions);
            updateBadge(status);
            log('Updated:', status);
        } catch (err) {
            log('Error:', err.message);
        }
    }

    // Register with shared menu
    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('missionTracker', '📋 Mission Tracker', {
            fields: [
                {
                    key: 'urgentHours',
                    label: 'Urgent Alert Threshold (hours)',
                    type: 'number',
                    default: 24
                },
                {
                    key: 'warningHours',
                    label: 'Warning Alert Threshold (hours)',
                    type: 'number',
                    default: 48
                }
            ],
            onChange: (key) => {
                log('Setting changed:', key);
                // Update config from settings
                CONFIG.urgentHours = window.PDAScriptsMenu.getSetting('missionTracker', 'urgentHours', 24);
                CONFIG.warningHours = window.PDAScriptsMenu.getSetting('missionTracker', 'warningHours', 48);
                refresh(true);
            }
        });
        log('✓ Registered with shared menu');
    }

    function init() {
        try {
            log('v4.0.14 initializing...');
            registerWithSharedMenu();

            // Initial refresh with error handling
            refresh().catch(err => log('Initial refresh error:', err.message));

            if (updateTimer) clearInterval(updateTimer);
            updateTimer = setInterval(() => {
                refresh().catch(err => log('Interval refresh error:', err.message));
            }, CONFIG.updateInterval);

            // Re-attach badge if nav changes
            new MutationObserver(() => {
                try {
                    if (!document.getElementById('mt-mission-badge')) {
                        badgeElement = null;
                        const cached = getCache('missions');
                        if (cached) updateBadge(processMissions(cached));
                    }
                } catch (e) {
                    log('Observer error:', e.message);
                }
            }).observe(document.body, { childList: true, subtree: true });

            log('Mission polling started');
        } catch (err) {
            log('Init error:', err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
