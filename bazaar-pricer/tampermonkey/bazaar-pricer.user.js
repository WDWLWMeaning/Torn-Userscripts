// ==UserScript==
// @name         Torn Bazaar Pricer
// @namespace    torn-bazaar-pricer
// @version      1.0.3
// @description  Add a Weav3r-powered listing picker button beside Torn bazaar price inputs.
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/bazaar-pricer/tampermonkey/bazaar-pricer.meta.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/bazaar-pricer/tampermonkey/bazaar-pricer.user.js
// @icon         https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/assets/favicon_io/favicon-32x32.png
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT = {
        id: 'torn-bazaar-pricer',
        name: 'Torn Bazaar Pricer',
        version: '1.0.3'
    };

    const CONFIG = {
        weav3rBaseUrl: 'https://weav3r.dev/api',
        cacheTtlMs: 60 * 1000,
        observerDebounceMs: 250
    };

    const TORN = {
        panel: '#333',
        text: '#ddd',
        textMuted: '#999',
        green: '#82c91e',
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

    const Storage = {
        get(key, fallback = null) {
            try {
                const value = GM_getValue(key, null);
                return value !== null ? JSON.parse(value) : fallback;
            } catch {
                return fallback;
            }
        },
        set(key, value) {
            GM_setValue(key, JSON.stringify(value));
        }
    };

    function loadSettings() {
        return { ...DEFAULT_SETTINGS, ...Storage.get(`${SCRIPT.id}:settings`, {}) };
    }

    function saveSettings(settings) {
        Storage.set(`${SCRIPT.id}:settings`, settings);
    }

    function buildWeav3rUrl(path, query = {}) {
        const url = new URL(`${CONFIG.weav3rBaseUrl}${path}`);
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null || value === '') continue;
            url.searchParams.set(key, String(value));
        }
        return url.toString();
    }

    function weav3rRequest(path, query = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: buildWeav3rUrl(path, query),
                headers: { Accept: 'application/json' },
                onload: (response) => {
                    try {
                        if (response.status < 200 || response.status >= 300) {
                            reject(new Error(`HTTP ${response.status}`));
                            return;
                        }
                        resolve(JSON.parse(response.responseText));
                    } catch {
                        reject(new Error('Invalid JSON response from Weav3r'));
                    }
                },
                onerror: () => reject(new Error('Network error contacting Weav3r')),
                ontimeout: () => reject(new Error('Timed out contacting Weav3r'))
            });
        });
    }

    function getCacheKey(itemId) {
        return `${SCRIPT.id}:item:${itemId}`;
    }

    async function getMarketplaceItem(itemId) {
        const cacheKey = getCacheKey(itemId);
        const cached = Storage.get(cacheKey, null);
        if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheTtlMs) return cached.data;
        const data = await weav3rRequest(`/marketplace/${itemId}`);
        Storage.set(cacheKey, { timestamp: Date.now(), data });
        return data;
    }

    function injectStyles() {
        if (document.getElementById(`${SCRIPT.id}-styles`)) return;
        GM_addStyle(`
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
                text-shadow: 0 0 2px rgba(0,0,0,0.8);
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

            #${SCRIPT.id}-modal .bp-field {
                margin-bottom: 14px;
            }

            #${SCRIPT.id}-modal .bp-field label {
                display: block;
                color: ${TORN.textMuted};
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 6px;
            }

            #${SCRIPT.id}-modal .bp-field input[type="number"] {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 10px;
                border-radius: 3px;
                border: 1px solid ${TORN.border};
                background: linear-gradient(0deg, #111 0%, #000 100%);
                color: ${TORN.text};
            }

            #${SCRIPT.id}-modal .bp-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                color: ${TORN.text};
                font-size: 12px;
            }

            #${SCRIPT.id}-modal .bp-actions {
                margin-top: 18px;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }

            #${SCRIPT.id}-modal .bp-btn,
            .${SCRIPT.id}-picker-btn,
            .${SCRIPT.id}-pick-btn {
                border: 1px solid #111;
                border-radius: 3px;
                cursor: pointer;
                color: #eee;
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%);
                text-shadow: 0 0 5px #000;
                font-family: Arial, sans-serif;
                font-weight: bold;
            }

            #${SCRIPT.id}-modal .bp-btn:hover,
            .${SCRIPT.id}-picker-btn:hover,
            .${SCRIPT.id}-pick-btn:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%);
                color: #fff;
            }

            #${SCRIPT.id}-modal .bp-btn {
                padding: 9px 14px;
            }

            #${SCRIPT.id}-modal .bp-btn-primary,
            .${SCRIPT.id}-picker-btn,
            .${SCRIPT.id}-pick-btn {
                border-color: #111;
            }

            .${SCRIPT.id}-input-group {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }

            .${SCRIPT.id}-input-group > input.input-money[type="text"] {
                width: 45px !important;
                min-width: 45px !important;
                max-width: 45px !important;
                flex: 0 0 45px;
            }

            .${SCRIPT.id}-picker-btn {
                width: 28px;
                height: 22px;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                vertical-align: middle;
                flex: 0 0 28px;
            }

            .${SCRIPT.id}-picker-btn svg {
                display: block;
                width: 14px;
                height: 14px;
                pointer-events: none;
            }

            .${SCRIPT.id}-picker-btn.loading {
                opacity: 0.7;
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

            .${SCRIPT.id}-pick-btn {
                padding: 6px 10px;
                font-size: 11px;
                white-space: nowrap;
            }
        `);
        const styleMarker = document.createElement('div');
        styleMarker.id = `${SCRIPT.id}-styles`;
        styleMarker.hidden = true;
        document.body.appendChild(styleMarker);
    }

    function formatMoney(value) {
        return `$${(Number(value) || 0).toLocaleString('en-US')}`;
    }

    function parseItemId(li) {
        const img = li.querySelector('img[src*="/images/items/"]');
        const src = img?.getAttribute('src') || img?.getAttribute('srcset') || '';
        const match = src.match(/\/images\/items\/(\d+)\//);
        return match ? Number(match[1]) : null;
    }

    function parseItemName(li) {
        const imgAlt = li.querySelector('img[alt]')?.getAttribute('alt')?.trim();
        if (imgAlt) return imgAlt;
        return li.querySelector('.t-overflow')?.textContent?.trim() || 'Unknown item';
    }

    function getPriceInput(li) {
        return li.querySelector('input.input-money[type="text"]');
    }

    function getMarketValue(li) {
        const text = li.querySelector('.info-wrap')?.textContent || '';
        const match = text.match(/\$([\d,]+)/);
        return match ? Number(match[1].replace(/,/g, '')) : null;
    }

    function getVisiblePriceInput(li) {
        return li.querySelector('.input-money-group input.input-money[type="text"]');
    }

    function setReactInputValue(input, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, String(value));
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
        injectStyles();
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
                    <div class="bp-field">
                        <label>Undercut amount</label>
                        <input type="number" id="${SCRIPT.id}-undercut" min="0" step="1" value="${settings.undercutAmount}">
                    </div>
                    <div class="bp-actions">
                        <button class="bp-btn" data-action="cancel" type="button">Cancel</button>
                        <button class="bp-btn bp-btn-primary" data-action="save" type="button">Save</button>
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
                saveSettings({
                    undercutAmount: Math.max(0, Number(modal.querySelector(`#${SCRIPT.id}-undercut`).value) || 0)
                });
                closeModal();
            }
        });
    }

    function openPicker({ itemId, itemName, listings, input, marketValue }) {
        injectStyles();
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

            setReactInputValue(input, nextPrice);
            closeModal();
        });
    }

    async function openPickerForRow(li, button) {
        loadSettings();

        const itemId = parseItemId(li);
        const itemName = parseItemName(li);
        const input = getPriceInput(li);
        const marketValue = getMarketValue(li);

        if (!itemId || !input) {
            button.classList.add('error');
            return;
        }

        button.disabled = true;
        button.classList.remove('error');
        button.classList.add('loading');

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
            button.classList.remove('loading');
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

    function enhanceBazaarRow(li) {
        const input = getVisiblePriceInput(li);
        if (!input) return;

        const group = input.closest('.input-money-group');
        if (!group) return;

        let wrapper = group.querySelector(`.${SCRIPT.id}-input-group`);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = `${SCRIPT.id}-input-group`;
            wrapper.style.display = 'inline-flex';

            const priceInput = input;
            priceInput.style.width = '45px';
            priceInput.style.minWidth = '45px';
            priceInput.style.maxWidth = '45px';
            wrapper.appendChild(priceInput);

            const button = createPickerButton();
            wrapper.appendChild(button);
            group.insertBefore(wrapper, group.querySelector('input[type="hidden"]'));

            button.addEventListener('click', () => openPickerForRow(li, button));
        } else {
            const priceInput = wrapper.querySelector('input.input-money[type="text"]');
            if (priceInput) {
                priceInput.style.width = '45px';
                priceInput.style.minWidth = '45px';
                priceInput.style.maxWidth = '45px';
            }
        }
    }

    function scanBazaarRows() {
        const rows = document.querySelectorAll('.items-cont li.clearfix.no-mods[data-group="child"]');
        rows.forEach((li) => {
            enhanceBazaarRow(li);
        });
    }

    function setupObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(scanBazaarRows, CONFIG.observerDebounceMs);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        injectStyles();
        GM_registerMenuCommand('Bazaar Pricer Settings', openSettings);
        scanBazaarRows();
        setupObserver();
        console.log(`[${SCRIPT.name}] v${SCRIPT.version} ready`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
