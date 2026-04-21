// ==UserScript==
// @name         Torn Bazaar Pricer
// @namespace    torn-bazaar-pricer
// @version      0.1.0
// @description  Add Weav3r-powered quick pricing buttons to Torn bazaar item listings with configurable undercutting.
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
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT = {
        id: 'torn-bazaar-pricer',
        name: 'Torn Bazaar Pricer',
        version: '0.1.0'
    };

    const CONFIG = {
        weav3rBaseUrl: 'https://weav3r.dev/api',
        cacheTtlMs: 60 * 1000,
        observerDebounceMs: 250
    };

    const TORN = {
        bg: '#444',
        panel: '#333',
        panelHover: '#555',
        text: '#ddd',
        textMuted: '#999',
        green: '#82c91e',
        blue: '#74c0fc',
        red: '#E54C19',
        yellow: '#F08C00',
        border: '#444',
        borderLight: '#555',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
    };

    const DEFAULT_SETTINGS = {
        enabled: true,
        undercutAmount: 1,
        minimumPrice: 1,
        ignoreBelowMarketValue: false
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
        },
        del(key) {
            GM_deleteValue(key);
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
        if (cached && (Date.now() - cached.timestamp) < CONFIG.cacheTtlMs) {
            return cached.data;
        }

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
                width: 480px;
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
            .${SCRIPT.id}-quick-btn,
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
            .${SCRIPT.id}-quick-btn:hover,
            .${SCRIPT.id}-pick-btn:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%);
                color: #fff;
            }

            #${SCRIPT.id}-modal .bp-btn {
                padding: 9px 14px;
            }

            #${SCRIPT.id}-modal .bp-btn-primary,
            .${SCRIPT.id}-quick-btn,
            .${SCRIPT.id}-pick-btn {
                border-color: ${TORN.green};
            }

            .${SCRIPT.id}-toolbar {
                margin-top: 6px;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
            }

            .${SCRIPT.id}-quick-btn {
                padding: 5px 8px;
                font-size: 11px;
                min-height: 24px;
            }

            .${SCRIPT.id}-status {
                font-size: 11px;
                color: ${TORN.textMuted};
            }

            .${SCRIPT.id}-status.error {
                color: ${TORN.red};
            }

            .${SCRIPT.id}-status.success {
                color: ${TORN.green};
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
        const amount = Number(value) || 0;
        return `$${amount.toLocaleString('en-US')}`;
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
        const overflow = li.querySelector('.t-overflow');
        return overflow?.textContent?.trim() || 'Unknown item';
    }

    function getPriceInput(li) {
        return li.querySelector('input.input-money[type="text"]');
    }

    function getMarketValue(li) {
        const info = li.querySelector('.info-wrap');
        const text = info?.textContent || '';
        const match = text.match(/\$([\d,]+)/);
        return match ? Number(match[1].replace(/,/g, '')) : null;
    }

    function setReactInputValue(input, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    }

    function choosePrice(listings, settings, marketValue) {
        if (!Array.isArray(listings) || !listings.length) return null;

        const usable = listings
            .map((listing) => ({
                price: Number(listing.price || listing.cost || 0),
                quantity: Number(listing.quantity || listing.amount || 0),
                seller: listing.name || listing.seller_name || listing.sellerName || `Seller #${listing.user_id || listing.seller_id || '?'}`,
                bazaar: listing.bazaar_name || listing.bazaarName || null
            }))
            .filter((listing) => listing.price > 0)
            .sort((a, b) => a.price - b.price);

        if (!usable.length) return null;

        const target = usable[0];
        let price = Math.max(settings.minimumPrice, target.price - settings.undercutAmount);

        if (settings.ignoreBelowMarketValue && marketValue && price < marketValue) {
            price = Math.max(settings.minimumPrice, marketValue);
        }

        return {
            source: target,
            value: price,
            listings: usable
        };
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
                    <div class="bp-field">
                        <label>Minimum allowed price</label>
                        <input type="number" id="${SCRIPT.id}-minimum" min="1" step="1" value="${settings.minimumPrice}">
                    </div>
                    <div class="bp-field bp-checkbox">
                        <input type="checkbox" id="${SCRIPT.id}-enabled" ${settings.enabled ? 'checked' : ''}>
                        <label for="${SCRIPT.id}-enabled">Enable script</label>
                    </div>
                    <div class="bp-field bp-checkbox">
                        <input type="checkbox" id="${SCRIPT.id}-ignore-market" ${settings.ignoreBelowMarketValue ? 'checked' : ''}>
                        <label for="${SCRIPT.id}-ignore-market">Never price below Torn market value shown on the row</label>
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
                const nextSettings = {
                    enabled: modal.querySelector(`#${SCRIPT.id}-enabled`).checked,
                    undercutAmount: Math.max(0, Number(modal.querySelector(`#${SCRIPT.id}-undercut`).value) || 0),
                    minimumPrice: Math.max(1, Number(modal.querySelector(`#${SCRIPT.id}-minimum`).value) || 1),
                    ignoreBelowMarketValue: modal.querySelector(`#${SCRIPT.id}-ignore-market`).checked
                };
                saveSettings(nextSettings);
                closeModal();
                scanBazaarRows();
            }
        });
    }

    function openPicker({ itemId, itemName, listings, input, statusEl, marketValue }) {
        injectStyles();
        closeModal();
        const settings = loadSettings();

        const modal = document.createElement('div');
        modal.id = `${SCRIPT.id}-modal`;
        const rows = listings.map((listing, index) => {
            const suggested = Math.max(settings.minimumPrice, Number(listing.price) - settings.undercutAmount);
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
        }).join('');

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
                    <div class="${SCRIPT.id}-picker-list">${rows || '<div>No listings found.</div>'}</div>
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

            let nextPrice = Math.max(settings.minimumPrice, Number(selected.price) - settings.undercutAmount);
            if (settings.ignoreBelowMarketValue && marketValue && nextPrice < marketValue) {
                nextPrice = Math.max(settings.minimumPrice, marketValue);
            }
            setReactInputValue(input, nextPrice);
            if (statusEl) {
                statusEl.textContent = `Set to ${formatMoney(nextPrice)} from ${selected.seller || 'selected listing'}`;
                statusEl.className = `${SCRIPT.id}-status success`;
            }
            closeModal();
        });
    }

    async function handlePriceLookup(li, toolbar, quickButton, statusEl) {
        const settings = loadSettings();
        if (!settings.enabled) {
            statusEl.textContent = 'Script disabled in settings';
            statusEl.className = `${SCRIPT.id}-status error`;
            return;
        }

        const itemId = parseItemId(li);
        const itemName = parseItemName(li);
        const input = getPriceInput(li);
        const marketValue = getMarketValue(li);

        if (!itemId || !input) {
            statusEl.textContent = 'Could not detect item or price input';
            statusEl.className = `${SCRIPT.id}-status error`;
            return;
        }

        quickButton.disabled = true;
        statusEl.textContent = 'Loading current bazaar prices...';
        statusEl.className = `${SCRIPT.id}-status`;

        try {
            const data = await getMarketplaceItem(itemId);
            const result = choosePrice(data.listings, settings, marketValue);
            if (!result) {
                statusEl.textContent = 'No usable listings returned by Weav3r';
                statusEl.className = `${SCRIPT.id}-status error`;
                return;
            }

            setReactInputValue(input, result.value);
            statusEl.textContent = `Set ${formatMoney(result.value)} from ${result.source.seller || 'lowest listing'} (${formatMoney(result.source.price)})`;
            statusEl.className = `${SCRIPT.id}-status success`;

            const pickerButton = toolbar.querySelector(`.${SCRIPT.id}-picker-open`);
            if (pickerButton) {
                pickerButton.onclick = () => openPicker({
                    itemId,
                    itemName,
                    listings: result.listings,
                    input,
                    statusEl,
                    marketValue
                });
                pickerButton.disabled = false;
            }
        } catch (error) {
            console.error(`[${SCRIPT.name}]`, error);
            statusEl.textContent = `Pricing lookup failed: ${error.message}`;
            statusEl.className = `${SCRIPT.id}-status error`;
        } finally {
            quickButton.disabled = false;
        }
    }

    function enhanceBazaarRow(li) {
        if (li.dataset.bazaarPricerBound === '1') return;
        const input = getPriceInput(li);
        if (!input) return;

        li.dataset.bazaarPricerBound = '1';

        const priceContainer = input.closest('.price');
        if (!priceContainer) return;

        const toolbar = document.createElement('div');
        toolbar.className = `${SCRIPT.id}-toolbar`;
        toolbar.innerHTML = `
            <button type="button" class="${SCRIPT.id}-quick-btn">Use bazaar price</button>
            <button type="button" class="${SCRIPT.id}-quick-btn ${SCRIPT.id}-picker-open" disabled>Choose listing</button>
            <span class="${SCRIPT.id}-status">Ready</span>
        `;

        priceContainer.appendChild(toolbar);

        const quickButton = toolbar.querySelector(`.${SCRIPT.id}-quick-btn`);
        const statusEl = toolbar.querySelector(`.${SCRIPT.id}-status`);
        quickButton.addEventListener('click', () => handlePriceLookup(li, toolbar, quickButton, statusEl));
    }

    function scanBazaarRows() {
        const settings = loadSettings();
        const rows = document.querySelectorAll('.items-cont li.clearfix.no-mods[data-group="child"]');
        rows.forEach((li) => {
            if (!settings.enabled) {
                const toolbar = li.querySelector(`.${SCRIPT.id}-toolbar`);
                if (toolbar) toolbar.style.display = 'none';
                return;
            }

            enhanceBazaarRow(li);
            const toolbar = li.querySelector(`.${SCRIPT.id}-toolbar`);
            if (toolbar) toolbar.style.display = '';
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
        GM_registerMenuCommand('Bazaar Pricer Clear Cache', () => {
            Object.keys(GM_getValue('___dummy___', null) || {});
            alert('Use browser reload if you need fresh prices. Weav3r also caches for 60 seconds.');
        });
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
