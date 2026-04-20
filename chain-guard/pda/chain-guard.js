// ==UserScript==
// @name         Torn Chain Guard (PDA)
// @namespace    torn-chain-guard
// @version      2.0.3
// @description  Prevents accidental attacks when within range of a chain bonus threshold (uses shared PDA menu)
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

// Self-initializing shared menu - creates PDAScriptsMenu if not already present
(function() {
    'use strict';

    // Prevent duplicate script execution
    if (window.__chainGuardPDALoaded) {
        console.log('[Chain Guard] Already loaded, skipping');
        return;
    }
    window.__chainGuardPDALoaded = true;

    // ============================================
    // SHARED MENU INITIALIZER (runs once globally)
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
            _toggle() { if (this._dropdown) { this._dropdown.remove(); this._dropdown = null; } else this._show(); },
            _show() {
                const d = document.createElement('div'); d.id = 'pda-shared-menu'; d.className = 'open';
                const r = this._button.getBoundingClientRect(); const W = 320; const H = Math.min(400, window.innerHeight * 0.7);
                const margin = 10;
                
                // Determine position: if button is on right half, menu goes to left
                const buttonCenter = r.left + r.width / 2;
                const screenCenter = window.innerWidth / 2;
                const isRightSide = buttonCenter > screenCenter;
                
                let left, top;
                if (isRightSide) {
                    // Position to left of button
                    left = Math.max(margin, r.left - W - 8);
                } else {
                    // Position to right of button (or aligned with it)
                    left = Math.min(r.left, window.innerWidth - W - margin);
                }
                
                // Vertical position: try below first, if not enough space, go above
                const spaceBelow = window.innerHeight - r.bottom - margin;
                const spaceAbove = r.top - margin;
                if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
                    top = r.bottom + 8;
                } else {
                    top = Math.max(margin, r.top - H - 8);
                }
                
                d.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${W}px;max-height:${H}px;background:${STYLES.bg};border:1px solid ${STYLES.border};border-radius:8px;z-index:99998;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Arial,sans-serif;color:${STYLES.text};`;
                
                // Store current position for drag updates
                this._menuPos = { top, left };
                
                const h = document.createElement('div'); h.style.cssText = `padding:12px 16px;border-bottom:1px solid ${STYLES.border};font-weight:bold;font-size:14px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#3a3a3a 0%,${STYLES.bg} 100%);border-radius:8px 8px 0 0;`; h.innerHTML = `<span>🎮 PDA Scripts</span><span style="color:${STYLES.textMuted};font-size:12px;font-weight:normal">${this._scripts.size} active</span>`; d.appendChild(h);
                if (this._scripts.size === 0) { const e = document.createElement('div'); e.style.cssText = `padding:24px;text-align:center;color:${STYLES.textMuted};`; e.textContent = 'No scripts registered'; d.appendChild(e); }
                else this._scripts.forEach(s => d.appendChild(this._createSection(s)));
                const close = e => { if (!d.contains(e.target) && e.target !== this._button) { d.remove(); this._dropdown = null; document.removeEventListener('click', close); } };
                setTimeout(() => document.addEventListener('click', close), 0); document.body.appendChild(d); this._dropdown = d;
                
                // Start position tracking during drag
                this._startPositionTracking();
            },
            _startPositionTracking() {
                if (this._posTrackingInterval) clearInterval(this._posTrackingInterval);
                this._posTrackingInterval = setInterval(() => {
                    if (!this._dropdown || !this._button) {
                        clearInterval(this._posTrackingInterval);
                        this._posTrackingInterval = null;
                        return;
                    }
                    this._updateMenuPosition();
                }, 50); // Update every 50ms during drag
            },
            _updateMenuPosition() {
                if (!this._dropdown || !this._button) return;
                
                const r = this._button.getBoundingClientRect();
                const W = 320; const H = Math.min(400, window.innerHeight * 0.7);
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
                
                this._dropdown.style.top = top + 'px';
                this._dropdown.style.left = left + 'px';
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
        DEFAULT_THRESHOLD: 15,
        CACHE_KEY: 'chain_guard_data',
        BONUS_THRESHOLDS: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
        DOM_CHAIN_SELECTOR: '.bar-value___uxnah',
        SIDEBAR_CHAIN_FALLBACK_SELECTORS: [
            '[class*="chain-bar"]',
            '.bar-value___uxnah',
            '[class*="bar-value"]',
            '[class*="chain"] [class*="bar"]',
            '[class*="chain"] [class*="value"]',
            '[class*="sidebar"] [class*="chain"]',
            '[class*="chainBar"]',
            '[class*="chain"]'
        ],
        ATTACK_CHAIN_SELECTOR: '.labelTitle___ZtfnD',
        ATTACK_CHAIN_FALLBACK_SELECTORS: [
            '.labelTitle___ZtfnD',
            '[class*="labelTitle"]',
            '[class*="chain"] [class*="title"]',
            '[class*="chain"] [class*="label"]',
            '[class*="attack"] [class*="chain"]',
            '[class*="title"]',
            '[class*="label"]'
        ],
        POLL_INTERVAL_MS: 300,
        STYLE_ID: 'chain-guard-pda-styles'
    };

    const TORN = {
        bg: '#444',
        panel: '#333',
        panelHover: '#555',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        border: '#444'
    };

    let chainState = { amount: 0, max: 1000, bonuses: 1.0, lastUpdate: 0, source: 'cache' };
    let lastDangerZoneState = null;
    let ignoredBonusThreshold = null;
    let blockedAttackButtons = new Set();
    let chainPollInterval = null;
    let guardPollInterval = null;

    function log(...args) { console.log('[Chain Guard]', ...args); }

    function storageGet(key, fallback = '{}') {
        try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch {}
    }

    function getThreshold() {
        if (window.PDAScriptsMenu) {
            return window.PDAScriptsMenu.getSetting('chainGuard', 'threshold', CONFIG.DEFAULT_THRESHOLD);
        }
        try {
            const saved = JSON.parse(storageGet('pda_script_chainGuard_settings', '{}'));
            return saved.threshold ?? CONFIG.DEFAULT_THRESHOLD;
        } catch { return CONFIG.DEFAULT_THRESHOLD; }
    }

    function loadChainCache() {
        try {
            const cached = JSON.parse(storageGet(CONFIG.CACHE_KEY, '{}'));
            if (Date.now() - cached.lastUpdate < 300000) {
                chainState = { ...chainState, ...cached, source: cached.source === 'dom' ? 'dom' : 'cache' };
            }
        } catch {}
    }
    function saveChainCache() {
        chainState.lastUpdate = Date.now();
        storageSet(CONFIG.CACHE_KEY, JSON.stringify(chainState));
    }

    function getNextBonus(amount) {
        return CONFIG.BONUS_THRESHOLDS.find(t => amount < t) || null;
    }
    function getDistanceToBonus() {
        if (!chainState.max) return null;
        return chainState.max - chainState.amount;
    }
    function isInDangerZone() {
        const dist = getDistanceToBonus();
        return dist !== null && dist <= getThreshold();
    }
    function isGuardIgnored() {
        return ignoredBonusThreshold !== null && chainState.amount < ignoredBonusThreshold;
    }

    function parseCompactNumber(value) {
        const normalized = String(value).trim().toLowerCase().replace(/,/g, '');
        const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
        if (!match) return NaN;
        const base = parseFloat(match[1]);
        const mult = match[2] === 'k' ? 1000 : match[2] === 'm' ? 1000000 : match[2] === 'b' ? 1000000000 : 1;
        return Math.round(base * mult);
    }

    function parseChainFromDOM() {
        const isAttack = window.location.href.includes('sid=attack');
        const selectors = isAttack ? CONFIG.ATTACK_CHAIN_FALLBACK_SELECTORS : CONFIG.SIDEBAR_CHAIN_FALLBACK_SELECTORS;

        for (const selector of selectors) {
            for (const el of document.querySelectorAll(selector)) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/(\d+(?:\.\d+)?[kmb]?)\s*\/\s*(\d+(?:\.\d+)?[kmb]?)/i) ||
                             text.match(/chain[:\s]*(\d+(?:\.\d+)?[kmb]?)/i);
                if (match) {
                    const amount = parseCompactNumber(match[1]);
                    const max = parseCompactNumber(match[2]) || getNextBonus(amount) || 1000;
                    if (!isNaN(amount)) {
                        chainState = { amount, max, bonuses: chainState.bonuses, source: 'dom', lastUpdate: Date.now() };
                        saveChainCache();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function ensureStyles() {
        if (document.getElementById(CONFIG.STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = CONFIG.STYLE_ID;
        style.textContent = `
            #chain-guard-warning { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 999999;
                background: ${TORN.red}; color: white; padding: 12px 24px; border-radius: 4px; display: flex;
                align-items: center; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: Arial, sans-serif; }
            #chain-guard-warning strong { color: #ffeb3b; }
            #chain-guard-warning .cg-actions { display: flex; gap: 8px; }
            #chain-guard-warning button { border: 1px solid rgba(255,255,255,0.45); background: rgba(0,0,0,0.25);
                color: white; border-radius: 3px; padding: 8px 12px; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    function createWarningBanner() {
        if (document.getElementById('chain-guard-warning')) return;
        const banner = document.createElement('div');
        banner.id = 'chain-guard-warning';
        banner.innerHTML = `
            <span>⚠️ Chain Guard Active</span>
            <span>Only <strong>${getDistanceToBonus()}</strong> attacks until bonus!</span>
            <div class="cg-actions">
                <button onclick="this.closest('#chain-guard-warning').querySelector('.cg-ignore').click()">Ignore</button>
                <button class="cg-ignore" style="display:none"></button>
            </div>
        `;
        banner.querySelector('.cg-ignore').addEventListener('click', () => {
            ignoredBonusThreshold = chainState.max;
            banner.remove();
        });
        document.body.appendChild(banner);
    }
    function removeWarningBanner() {
        document.getElementById('chain-guard-warning')?.remove();
    }

    function findAttackButtons() {
        return [...document.querySelectorAll('button[type="submit"], button, input[type="submit"]')].filter(el => {
            const text = (el.textContent || el.value || '').trim().toLowerCase();
            return text === 'attack' || text === 'start fight';
        });
    }

    function blockAttackButtons() {
        findAttackButtons().forEach(btn => {
            if (!btn.dataset.chainGuardBlocked) {
                btn.dataset.chainGuardBlocked = 'true';
                btn.dataset.originalText = btn.tagName === 'INPUT' ? btn.value : btn.textContent;
                btn.addEventListener('click', preventAttack, true);
            }
            btn.disabled = true;
            btn.style.opacity = '0.5';
            const label = `Chain Guard: ${getDistanceToBonus()} to bonus`;
            if (btn.tagName === 'INPUT') btn.value = label; else btn.textContent = label;
            blockedAttackButtons.add(btn);
        });
    }

    function unblockAttackButtons() {
        blockedAttackButtons.forEach(btn => {
            if (!document.body.contains(btn)) { blockedAttackButtons.delete(btn); return; }
            btn.disabled = false;
            btn.style.opacity = '';
            if (btn.tagName === 'INPUT') btn.value = btn.dataset.originalText || 'Attack';
            else btn.textContent = btn.dataset.originalText || 'Attack';
            btn.removeEventListener('click', preventAttack, true);
            delete btn.dataset.chainGuardBlocked;
            delete btn.dataset.originalText;
            blockedAttackButtons.delete(btn);
        });
    }

    function preventAttack(e) {
        if (isInDangerZone() && !isGuardIgnored()) {
            e.preventDefault();
            e.stopPropagation();
            alert(`Chain Guard: Only ${getDistanceToBonus()} attacks until bonus!\n\nUse the PDA Scripts menu to adjust threshold.`);
            return false;
        }
    }

    function updateGuard() {
        const inDanger = isInDangerZone();
        if (lastDangerZoneState !== inDanger) {
            lastDangerZoneState = inDanger;
            log(inDanger ? 'Entered danger zone' : 'Exited danger zone');
        }

        if (inDanger && !isGuardIgnored()) {
            createWarningBanner();
            if (window.location.href.includes('sid=attack')) blockAttackButtons();
            else unblockAttackButtons();
        } else {
            removeWarningBanner();
            unblockAttackButtons();
        }
    }

    // Register with shared menu
    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('chainGuard', '🛡️ Chain Guard', {
            fields: [{
                key: 'threshold',
                label: 'Warning Threshold (attacks from bonus)',
                type: 'number',
                default: CONFIG.DEFAULT_THRESHOLD
            }],
            onChange: () => updateGuard()
        });
        log('✓ Registered with shared menu');
    }

    // Init
    function init() {
        log('v2.0.3 initializing...');
        ensureStyles();
        loadChainCache();
        registerWithSharedMenu();

        chainPollInterval = setInterval(() => {
            if (parseChainFromDOM()) updateGuard();
        }, CONFIG.POLL_INTERVAL_MS);

        guardPollInterval = setInterval(updateGuard, CONFIG.POLL_INTERVAL_MS);

        log('Chain polling started');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
