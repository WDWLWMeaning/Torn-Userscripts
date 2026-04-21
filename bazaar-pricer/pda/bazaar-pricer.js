// ==UserScript==
// @name         Torn Bazaar Pricer (PDA)
// @namespace    torn-bazaar-pricer-pda
// @version      1.0.0
// @description  PDA companion for Bazaar Pricer with inline Weav3r listing picker beside bazaar price inputs.
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    'use strict';

    if (window.__bazaarPricerPDALoaded) return;
    window.__bazaarPricerPDALoaded = true;

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

    const SCRIPT = {
        id: 'bazaar-pricer-pda',
        name: 'Bazaar Pricer (PDA)',
        version: '1.0.0'
    };

    const CONFIG = {
        weav3rBaseUrl: 'https://weav3r.dev/api',
        cacheTtlMs: 60 * 1000,
        observerDebounceMs: 250,
        settingsKey: 'bazaar_pricer_pda_settings'
    };

    const TORN = {
        panel: '#333',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        border: '#444',
        borderLight: '#555',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
    };

    const DEFAULT_SETTINGS = {
        undercutAmount: 1
    };

    let observer = null;
    let refreshTimer = null;

    function storageGet(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {}
    }

    function loadSettings() {
        return { ...DEFAULT_SETTINGS, ...storageGet(CONFIG.settingsKey, {}) };
    }

    function saveSettings(settings) {
        storageSet(CONFIG.settingsKey, settings);
    }

    function getCacheKey(itemId) {
        return `${SCRIPT.id}:item:${itemId}`;
    }

    function buildWeav3rUrl(path, query = {}) {
        const url = new URL(`${CONFIG.weav3rBaseUrl}${path}`);
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null || value === '') continue;
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }

    async function weav3rRequest(path, query = {}) {
        const url = buildWeav3rUrl(path, query);
        if (typeof PDA_httpGet === 'function') {
            const response = await PDA_httpGet(url, { Accept: 'application/json' });
            return JSON.parse(response.responseText || '{}');
        }
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    async function getMarketplaceItem(itemId) {
        const cacheKey = getCacheKey(itemId);
        const cached = storageGet(cacheKey, null);
        if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheTtlMs) return cached.data;
        const data = await weav3rRequest(`/marketplace/${itemId}`);
        storageSet(cacheKey, { timestamp: Date.now(), data });
        return data;
    }

    function injectStyles() {
        if (document.getElementById(`${SCRIPT.id}-styles`)) return;
        const style = document.createElement('style');
        style.id = `${SCRIPT.id}-styles`;
        style.textContent = `
            #${SCRIPT.id}-modal {
                position: fixed;
                inset: 0;
                z-index: 999999;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 90px;
                background: rgba(0, 0, 0, 0.82);
                font-family: Arial, sans-serif;
            }
            #${SCRIPT.id}-modal .bp-panel {
                width: 520px;
                max-width: 92vw;
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                overflow: hidden;
                box-shadow: 0 8px 28px rgba(0,0,0,0.55);
                color: ${TORN.text};
            }
            #${SCRIPT.id}-modal .bp-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: ${TORN.headerGradient};
                border-bottom: 1px solid ${TORN.border};
                color: #fff;
                font-size: 14px;
                font-weight: bold;
            }
            #${SCRIPT.id}-modal .bp-close {
                border: none;
                background: transparent;
                color: ${TORN.text};
                cursor: pointer;
                font-size: 20px;
                line-height: 1;
            }
            #${SCRIPT.id}-modal .bp-body {
                padding: 14px 16px 16px;
            }
            .${SCRIPT.id}-input-group {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .${SCRIPT.id}-input-group > input.input-money:not([type="hidden"]) {
                width: 45px !important;
                min-width: 45px !important;
                max-width: 45px !important;
                flex: 0 0 45px;
            }
            .${SCRIPT.id}-picker-btn,
            .${SCRIPT.id}-pick-btn,
            .${SCRIPT.id}-settings-btn {
                border: 1px solid #111;
                border-radius: 3px;
                cursor: pointer;
                color: #eee;
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%);
                text-shadow: 0 0 5px #000;
                font-family: Arial, sans-serif;
                font-weight: bold;
            }
            .${SCRIPT.id}-picker-btn {
                width: 28px;
                height: 22px;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                flex: 0 0 28px;
            }
            .${SCRIPT.id}-picker-btn svg {
                display: block;
                width: 14px;
                height: 14px;
            }
            .${SCRIPT.id}-picker-btn.error {
                border-color: ${TORN.red};
            }
            .${SCRIPT.id}-picker-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 360px;
                overflow-y: auto;
            }
            .${SCRIPT.id}-picker-item {
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                padding: 10px;
                background: rgba(255,255,255,0.02);
                display: flex;
                justify-content: space-between;
                gap: 10px;
                align-items: center;
            }
            .${SCRIPT.id}-picker-meta {
                font-size: 11px;
                color: ${TORN.textMuted};
                margin-top: 4px;
            }
            .${SCRIPT.id}-picker-price {
                font-size: 13px;
                font-weight: bold;
                color: ${TORN.text};
            }
            .${SCRIPT.id}-pick-btn,
            .${SCRIPT.id}-settings-btn {
                padding: 6px 10px;
                font-size: 11px;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(style);
    }

    function formatMoney(value) {
        return `$${(Number(value) || 0).toLocaleString('en-US')}`;
    }

    function parseItemId(container) {
        const img = container.querySelector('img[src*="/images/items/"]');
        const src = img?.getAttribute('src') || img?.getAttribute('srcset') || '';
        const match = src.match(/\/images\/items\/(\d+)\//);
        return match ? Number(match[1]) : null;
    }

    function parseItemName(container) {
        const imgAlt = container.querySelector('img[alt]')?.getAttribute('alt')?.trim();
        if (imgAlt) return imgAlt;
        return container.querySelector('.t-overflow, [role="heading"] span, .desc___VJSNQ span')?.textContent?.trim() || 'Unknown item';
    }

    function getPriceInput(container) {
        return container.querySelector('.input-money-group input.input-money:not([type="hidden"])');
    }

    function getMarketValue(container) {
        const text = container.querySelector('.info-wrap, .rrp___aiQg2')?.textContent || '';
        const match = text.match(/\$([\d,]+)/);
        return match ? Number(match[1].replace(/,/g, '')) : null;
    }

    function setInputValue(input, value) {
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    }

    function chooseListings(listings) {
        if (!Array.isArray(listings) || !listings.length) return [];
        return listings
            .map((listing) => ({
                price: Number(listing.price || listing.cost || 0),
                quantity: Number(listing.quantity || listing.amount || 0),
                seller: listing.player_name || listing.name || listing.seller_name || listing.sellerName || `Seller #${listing.player_id || listing.user_id || listing.seller_id || '?'}`,
                bazaar: listing.bazaar_name || listing.bazaarName || null
            }))
            .filter((listing) => listing.price > 0)
            .sort((a, b) => a.price - b.price);
    }

    function closeModal() {
        document.getElementById(`${SCRIPT.id}-modal`)?.remove();
    }

    function openSettings() {
        closeModal();
        const settings = loadSettings();
        const modal = document.createElement('div');
        modal.id = `${SCRIPT.id}-modal`;
        modal.innerHTML = `
            <div class="bp-panel">
                <div class="bp-header">
                    <span>${SCRIPT.name} Settings</span>
                    <button class="bp-close" type="button">×</button>
                </div>
                <div class="bp-body">
                    <div style="margin-bottom:14px;">
                        <label style="display:block;color:${TORN.textMuted};font-size:12px;font-weight:bold;margin-bottom:6px;">Undercut amount</label>
                        <input type="number" id="${SCRIPT.id}-undercut" min="0" step="1" value="${settings.undercutAmount}" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:3px;border:1px solid ${TORN.border};background:linear-gradient(0deg,#111 0%,#000 100%);color:${TORN.text};">
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end;">
                        <button class="${SCRIPT.id}-settings-btn" data-action="cancel" type="button">Cancel</button>
                        <button class="${SCRIPT.id}-settings-btn" data-action="save" type="button">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('.bp-close') || event.target.dataset.action === 'cancel') {
                closeModal();
                return;
            }
            if (event.target.dataset.action === 'save') {
                saveSettings({ undercutAmount: Math.max(0, Number(modal.querySelector(`#${SCRIPT.id}-undercut`).value) || 0) });
                closeModal();
            }
        });
    }

    function openPicker({ itemId, itemName, listings, input, marketValue }) {
        closeModal();
        const settings = loadSettings();
        const modal = document.createElement('div');
        modal.id = `${SCRIPT.id}-modal`;
        modal.innerHTML = `
            <div class="bp-panel">
                <div class="bp-header">
                    <span>${itemName} prices</span>
                    <button class="bp-close" type="button">×</button>
                </div>
                <div class="bp-body">
                    <div class="${SCRIPT.id}-picker-meta" style="margin-bottom: 10px;">
                        Item ID: ${itemId}${marketValue ? ` • Torn market value: ${formatMoney(marketValue)}` : ''}
                    </div>
                    <div class="${SCRIPT.id}-picker-list">
                        ${listings.map((listing, index) => {
                            const suggested = Math.max(0, Number(listing.price) - settings.undercutAmount);
                            const seller = listing.seller || 'Unknown seller';
                            const metaBits = [
                                listing.bazaar ? `Bazaar: ${listing.bazaar}` : null,
                                listing.quantity ? `Qty: ${listing.quantity}` : null
                            ].filter(Boolean).join(' • ');
                            return `
                                <div class="${SCRIPT.id}-picker-item">
                                    <div>
                                        <div><strong>${seller}</strong></div>
                                        <div class="${SCRIPT.id}-picker-meta">${metaBits || 'Current listing'}</div>
                                        <div class="${SCRIPT.id}-picker-price">${formatMoney(listing.price)} → ${formatMoney(suggested)}</div>
                                    </div>
                                    <button class="${SCRIPT.id}-pick-btn" type="button" data-index="${index}">Use this</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('.bp-close')) {
                closeModal();
                return;
            }
            const pickButton = event.target.closest(`.${SCRIPT.id}-pick-btn`);
            if (!pickButton) return;
            const selected = listings[Number(pickButton.dataset.index)];
            if (!selected) return;
            const nextPrice = Math.max(0, Number(selected.price) - settings.undercutAmount);
            setInputValue(input, nextPrice);
            closeModal();
        });
    }

    async function openPickerForContainer(container, button) {
        const itemId = parseItemId(container);
        const itemName = parseItemName(container);
        const input = getPriceInput(container);
        const marketValue = getMarketValue(container);
        if (!itemId || !input) {
            button.classList.add('error');
            return;
        }
        button.disabled = true;
        button.classList.remove('error');
        try {
            const data = await getMarketplaceItem(itemId);
            const listings = chooseListings(data.listings);
            if (!listings.length) {
                button.classList.add('error');
                return;
            }
            openPicker({ itemId, itemName, listings, input, marketValue });
        } catch (error) {
            console.error(`[${SCRIPT.name}]`, error);
            button.classList.add('error');
        } finally {
            button.disabled = false;
        }
    }

    function createPickerButton() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${SCRIPT.id}-picker-btn`;
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 7h16l-1.2 11.1a2 2 0 0 1-2 1.9H7.2a2 2 0 0 1-2-1.9L4 7zm3-3a5 5 0 0 1 10 0h-2a3 3 0 0 0-6 0H7z" />
            </svg>
        `;
        return button;
    }

    function enhancePriceContainer(container) {
        const input = getPriceInput(container);
        if (!input) return;
        const group = input.closest('.input-money-group');
        if (!group) return;

        let wrapper = group.querySelector(`.${SCRIPT.id}-input-group`);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = `${SCRIPT.id}-input-group`;
            wrapper.style.display = 'inline-flex';

            input.style.width = '45px';
            input.style.minWidth = '45px';
            input.style.maxWidth = '45px';
            wrapper.appendChild(input);

            const button = createPickerButton();
            wrapper.appendChild(button);
            group.insertBefore(wrapper, group.querySelector('input[type="hidden"]'));
            button.addEventListener('click', () => openPickerForContainer(container, button));
        } else {
            const visibleInput = wrapper.querySelector('input.input-money:not([type="hidden"])');
            if (visibleInput) {
                visibleInput.style.width = '45px';
                visibleInput.style.minWidth = '45px';
                visibleInput.style.maxWidth = '45px';
            }
        }
    }

    function scanTargets() {
        const containers = [
            ...document.querySelectorAll('.items-cont li.clearfix.no-mods[data-group="child"]'),
            ...document.querySelectorAll('[data-testid^="item-"]')
        ];
        const seen = new Set();
        containers.forEach((container) => {
            if (seen.has(container)) return;
            seen.add(container);
            enhancePriceContainer(container);
        });
    }

    function setupObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(scanTargets, CONFIG.observerDebounceMs);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register(SCRIPT.id, '🦞 Bazaar Pricer', {
            fields: [
                {
                    key: 'undercutAmount',
                    label: 'Undercut Amount',
                    type: 'number',
                    default: DEFAULT_SETTINGS.undercutAmount
                }
            ],
            onChange: (key, value) => {
                saveSettings({ ...loadSettings(), [key]: value });
            }
        });
    }

    function init() {
        injectStyles();
        registerWithSharedMenu();
        scanTargets();
        setupObserver();
        console.log(`[${SCRIPT.name}] v${SCRIPT.version} ready`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
