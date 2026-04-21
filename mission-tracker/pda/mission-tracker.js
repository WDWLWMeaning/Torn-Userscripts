// ==UserScript==
// @name         Torn Mission Tracker (PDA)
// @namespace    torn-mission-tracker
// @version      5.1.2
// @description  Track Torn missions with time-based alerts. Red = urgent (<24h), Yellow = warning (<48h). Uses PDA-APIKEY for automatic API access.
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
    // MISSION TRACKER CODE (Original Tampermonkey logic)
    // ============================================
    const CONFIG = {
        updateInterval: 60000,
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48
    };

    let updateTimer = null;
    let badgeElement = null;

    const TORN = {
        red: '#E54C19',
        yellow: '#F08C00',
        panel: '#333',
        border: '#555',
        text: '#ddd'
    };

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

    function processMissions(payload) {
        const givers = payload?.missions?.givers || payload?.givers || [];
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
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                background: ${TORN.panel};
                color: ${TORN.text};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                font-size: 11px;
                font-weight: 700;
                font-family: Arial, sans-serif;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                box-shadow: 0 1px 2px rgba(0,0,0,0.5);
                pointer-events: none;
                user-select: none;
            }
            #mt-mission-badge.urgent {
                color: #fff;
                border-color: ${TORN.red};
                background: ${TORN.red};
                box-shadow: 0 0 8px rgba(229, 76, 25, 0.6);
            }
            #mt-mission-badge.warning {
                color: #000;
                border-color: ${TORN.yellow};
                background: ${TORN.yellow};
                box-shadow: 0 0 6px rgba(240, 140, 0, 0.5);
            }
            @media (max-width: 768px) {
                #mt-mission-badge {
                    right: 6px;
                    top: 6px;
                    transform: none;
                    width: 14px;
                    height: 14px;
                    font-size: 8px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getMissionLink() {
        // Try to find the missions link
        const nav = document.getElementById('nav-missions');
        if (nav) {
            const link = nav.querySelector('a');
            if (link) return link;
        }
        // Fallback selectors
        const selectors = [
            'a[href*="sid=missions"]',
            'a[href*="/missions.php"]',
            '[class*="nav"] a[href*="mission"]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function createBadge(link) {
        if (!link) return null;
        ensureStyles();

        // Remove existing
        const existing = link.querySelector('#mt-mission-badge');
        if (existing) existing.remove();

        const badge = document.createElement('span');
        badge.id = 'mt-mission-badge';

        // Ensure relative positioning on link
        if (link.style.position !== 'relative' && link.style.position !== 'absolute') {
            link.style.position = 'relative';
        }

        link.appendChild(badge);
        return badge;
    }

    function updateBadge(status) {
        const link = getMissionLink();
        if (!link) {
            log('Missions link not found');
            return;
        }

        if (!badgeElement || !link.contains(badgeElement)) {
            badgeElement = createBadge(link);
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

    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('missionTracker', '📋 Mission Tracker', {
            fields: [
                { key: 'urgentHours', label: 'Urgent Alert Threshold (hours)', type: 'number', default: 24 },
                { key: 'warningHours', label: 'Warning Alert Threshold (hours)', type: 'number', default: 48 }
            ],
            onChange: (key) => {
                CONFIG.urgentHours = window.PDAScriptsMenu.getSetting('missionTracker', 'urgentHours', 24);
                CONFIG.warningHours = window.PDAScriptsMenu.getSetting('missionTracker', 'warningHours', 48);
                refresh(true);
            }
        });
        log('✓ Registered with shared menu');
    }

    function init() {
        log('v5.1.1 initializing...');
        registerWithSharedMenu();

        // Wait for nav to exist
        const waitForNav = setInterval(() => {
            if (getMissionLink()) {
                clearInterval(waitForNav);
                refresh();
                updateTimer = setInterval(refresh, CONFIG.updateInterval);

                // Re-attach badge if nav changes
                new MutationObserver(() => {
                    const link = getMissionLink();
                    if (link && !link.querySelector('#mt-mission-badge')) {
                        badgeElement = null;
                        const cached = getCache('missions');
                        if (cached) updateBadge(processMissions(cached));
                    }
                }).observe(document.body, { childList: true, subtree: true });
            }
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
