// ==UserScript==
// @name         Torn Chain Guard
// @namespace    torn-chain-guard
// @version      1.1.0
// @description  Prevents accidental attacks when within range of a chain bonus threshold
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard.user.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-start
// ==/UserScript==

/**
 * Torn Chain Guard v1.1.0
 * Prevents attacks when near chain bonus thresholds
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        DEFAULT_THRESHOLD: 15,
        CACHE_KEY: 'chain_guard_data',
        SETTINGS_KEY: 'chain_guard_settings',
        BONUS_THRESHOLDS: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
        DOM_CHAIN_SELECTOR: '.bar-value___uxnah'
    };

    // Torn-native color palette
    const TORN = {
        bg: '#191919',
        panel: '#333',
        panelHover: '#444',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        blue: '#74c0fc',
        border: '#555'
    };

    // State
    let chainState = {
        amount: 0,
        max: 1000,
        bonuses: 1.0,
        lastUpdate: 0,
        source: 'cache'
    };

    let lastDangerZoneState = null;
    let domObserver = null;

    function log(...args) {
        console.log('[Chain Guard]', ...args);
    }

    // Load settings
    function loadSettings() {
        const saved = GM_getValue(CONFIG.SETTINGS_KEY, '{}');
        try {
            return { threshold: CONFIG.DEFAULT_THRESHOLD, ...JSON.parse(saved) };
        } catch {
            return { threshold: CONFIG.DEFAULT_THRESHOLD };
        }
    }

    // Save settings
    function saveSettings(settings) {
        GM_setValue(CONFIG.SETTINGS_KEY, JSON.stringify(settings));
    }

    // Load cached chain data
    function loadChainCache() {
        const cached = GM_getValue(CONFIG.CACHE_KEY, '{}');
        try {
            const data = JSON.parse(cached);
            // Only use cache if less than 5 minutes old
            if (Date.now() - data.lastUpdate < 300000) {
                chainState = { ...chainState, ...data, source: data.source || 'cache' };
                log('Loaded cached chain:', chainState.amount, '/', chainState.max, 'source:', chainState.source);
            }
        } catch {
            // No valid cache
        }
    }

    // Save chain data to cache
    function saveChainCache() {
        chainState.lastUpdate = Date.now();
        GM_setValue(CONFIG.CACHE_KEY, JSON.stringify(chainState));
    }

    function getNextBonus(amount) {
        return CONFIG.BONUS_THRESHOLDS.find((threshold) => amount < threshold) || null;
    }

    function applyChainState(amount, max, bonuses, source) {
        if (!Number.isFinite(amount)) return false;

        const normalizedMax = Number.isFinite(max) && max > 0 ? max : (getNextBonus(amount) || 1000);
        chainState.amount = amount;
        chainState.max = normalizedMax;
        chainState.bonuses = Number.isFinite(bonuses) ? bonuses : chainState.bonuses;
        chainState.source = source;
        saveChainCache();
        log('Chain updated from', source + ':', chainState.amount, '/', chainState.max);
        updateGuard();
        return true;
    }

    // Parse chain data from WebSocket message
    function parseChainData(data) {
        try {
            const chain = data?.push?.pub?.data?.message?.namespaces?.sidebar?.actions?.updateChain?.chain;
            if (!chain) {
                log('WebSocket payload did not contain chain data');
                return false;
            }

            const amount = parseInt(chain.amount, 10);
            const max = parseInt(chain.max, 10);
            const bonuses = parseFloat(chain.bonuses);

            if (applyChainState(amount, max, bonuses, 'websocket')) {
                log('WebSocket chain parse success');
                return true;
            }

            log('WebSocket chain parse failed, invalid amount:', chain.amount);
            return false;
        } catch (e) {
            log('WebSocket chain parse error:', e);
            return false;
        }
    }

    function parseCompactNumber(value) {
        const normalized = String(value).trim().toLowerCase().replace(/,/g, '');
        const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
        if (!match) return NaN;

        const base = parseFloat(match[1]);
        const multiplier = match[2] === 'k' ? 1000 : match[2] === 'm' ? 1000000 : match[2] === 'b' ? 1000000000 : 1;
        return Math.round(base * multiplier);
    }

    function parseChainFromDOM() {
        const el = document.querySelector(CONFIG.DOM_CHAIN_SELECTOR);
        if (!el) {
            log('DOM parse skipped, chain element not found');
            return false;
        }

        const text = el.textContent.trim();
        const match = text.match(/([^/]+)\s*\/\s*([^\s]+)/);
        if (!match) {
            log('DOM parse failed, unexpected text:', text);
            return false;
        }

        const amount = parseCompactNumber(match[1]);
        const max = parseCompactNumber(match[2]);
        if (!Number.isFinite(amount) || !Number.isFinite(max)) {
            log('DOM parse failed, invalid values:', text);
            return false;
        }

        log('DOM parse success:', text, '=>', amount, '/', max);
        return applyChainState(amount, max, chainState.bonuses, 'dom');
    }

    // Check if we're in the danger zone
    function isInDangerZone() {
        const settings = loadSettings();
        const remaining = chainState.max - chainState.amount;
        return remaining > 0 && remaining <= settings.threshold;
    }

    // Get distance to next bonus
    function getDistanceToBonus() {
        return chainState.max - chainState.amount;
    }

    // Override WebSocket to intercept messages
    function hookWebSocket() {
        const OriginalWebSocket = window.WebSocket;
        log('Hooking WebSocket interceptor');

        window.WebSocket = function(url, protocols) {
            log('WebSocket constructed:', url);
            const ws = new OriginalWebSocket(url, protocols);

            ws.addEventListener('message', (event) => {
                log('WebSocket message received');
                try {
                    const data = JSON.parse(event.data);
                    const parsed = parseChainData(data);
                    if (!parsed) {
                        log('WebSocket message parsed as JSON, but no usable chain update found');
                    }
                } catch (error) {
                    log('WebSocket message JSON parse failed:', error);
                }
            });

            return ws;
        };

        // Copy static properties
        Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        log('WebSocket interceptor installed');
    }

    // Create warning banner
    function createWarningBanner() {
        const existing = document.getElementById('chain-guard-warning');
        if (existing) return existing;

        const banner = document.createElement('div');
        banner.id = 'chain-guard-warning';
        banner.innerHTML = `
            <div class="cg-icon">STOP</div>
            <div class="cg-content">
                <div class="cg-title">Chain Bonus Protection Active</div>
                <div class="cg-subtitle">
                    Only <strong>${getDistanceToBonus()}</strong> attacks until chain bonus!
                </div>
            </div>
        `;

        GM_addStyle(`
            #chain-guard-warning {
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                background: ${TORN.red};
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                font-family: 'Open Sans', Arial, sans-serif;
                animation: cg-pulse 2s infinite;
            }
            @keyframes cg-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(229,76,25,0.5); }
                50% { box-shadow: 0 4px 24px rgba(229,76,25,0.8); }
            }
            #chain-guard-warning .cg-icon {
                font-weight: bold;
                font-size: 18px;
                padding: 4px 8px;
                background: rgba(0,0,0,0.3);
                border-radius: 3px;
            }
            #chain-guard-warning .cg-content {
                text-align: center;
            }
            #chain-guard-warning .cg-title {
                font-size: 16px;
                font-weight: bold;
            }
            #chain-guard-warning .cg-subtitle {
                font-size: 13px;
                opacity: 0.9;
            }
            #chain-guard-warning strong {
                color: #ffeb3b;
            }
        `);

        document.body.appendChild(banner);
        return banner;
    }

    // Remove warning banner
    function removeWarningBanner() {
        const banner = document.getElementById('chain-guard-warning');
        if (banner) banner.remove();
    }

    // Block attack buttons
    function blockAttackButtons() {
        // Common attack button selectors on Torn
        const selectors = [
            'input[value="Attack"]',
            'input[value="attack"]',
            'button:contains("Attack")',
            '.attack-btn',
            '[data-action="attack"]',
            'a[href*="sid=attack&attack="]'
        ];

        selectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(btn => {
                if (!btn.dataset.chainGuardBlocked) {
                    btn.dataset.chainGuardBlocked = 'true';
                    btn.dataset.originalOnClick = btn.onclick;
                    btn.dataset.originalDisabled = btn.disabled;

                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                    btn.title = 'Blocked by Chain Guard - too close to bonus!';

                    // Prevent clicks
                    btn.addEventListener('click', preventAttack, true);
                }
            });
        });

        // Also block links that lead to attacks
        const attackLinks = document.querySelectorAll('a[href*="sid=attack"]');
        attackLinks.forEach(link => {
            if (!link.dataset.chainGuardBlocked) {
                link.dataset.chainGuardBlocked = 'true';
                link.addEventListener('click', preventAttack, true);
                link.style.opacity = '0.5';
                link.title = 'Blocked by Chain Guard - too close to bonus!';
            }
        });
    }

    // Prevent attack click
    function preventAttack(e) {
        if (isInDangerZone()) {
            log('Attack blocked,', getDistanceToBonus(), 'attacks away from bonus');
            e.preventDefault();
            e.stopPropagation();
            alert(`Chain Guard: You are only ${getDistanceToBonus()} attacks away from a chain bonus!\n\nDisable protection in the Chain Guard menu if you really want to attack.`);
            return false;
        }
    }

    // Unblock buttons (when leaving danger zone)
    function unblockAttackButtons() {
        document.querySelectorAll('[data-chain-guard-blocked="true"]').forEach(el => {
            el.disabled = el.dataset.originalDisabled === 'true';
            el.style.opacity = '';
            el.style.cursor = '';
            el.title = '';
            el.removeEventListener('click', preventAttack, true);
            delete el.dataset.chainGuardBlocked;
        });
    }

    function ensureDomObserver() {
        if (domObserver) return;

        domObserver = new MutationObserver(() => {
            if (parseChainFromDOM()) {
                log('DOM fallback observer applied chain update');
            }
        });

        domObserver.observe(document.documentElement || document, {
            subtree: true,
            childList: true,
            characterData: true
        });

        log('DOM fallback observer started');
    }

    // Update guard state
    function updateGuard() {
        const isAttackPage = window.location.href.includes('sid=attack');
        const inDangerZone = isInDangerZone();

        if (lastDangerZoneState !== inDangerZone) {
            log(inDangerZone ? 'Entered danger zone' : 'Exited danger zone');
            lastDangerZoneState = inDangerZone;
        }

        if (inDangerZone) {
            createWarningBanner();
            if (isAttackPage) {
                blockAttackButtons();
            }
        } else {
            removeWarningBanner();
            unblockAttackButtons();
        }
    }

    // Create settings panel
    function openSettings() {
        const settings = loadSettings();

        // Remove existing panel
        const existing = document.getElementById('chain-guard-settings');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'chain-guard-settings';
        panel.innerHTML = `
            <div class="cg-overlay"></div>
            <div class="cg-panel">
                <div class="cg-header">
                    <span>Chain Guard Settings</span>
                    <button class="cg-close">x</button>
                </div>
                <div class="cg-body">
                    <div class="cg-field">
                        <label>Warning Threshold (attacks from bonus)</label>
                        <input type="number" id="cg-threshold" value="${settings.threshold}" min="1" max="100">
                    </div>
                    <div class="cg-info">
                        <p>Current chain: <strong>${chainState.amount}</strong> / ${chainState.max}</p>
                        <p>Distance to bonus: <strong>${getDistanceToBonus()}</strong></p>
                        <p>Status: ${isInDangerZone() ? '<span style="color:' + TORN.red + '">PROTECTION ACTIVE</span>' : '<span style="color:' + TORN.green + '">Safe to attack</span>'}</p>
                    </div>
                </div>
                <div class="cg-footer">
                    <button class="cg-save">Save</button>
                    <button class="cg-cancel">Cancel</button>
                </div>
            </div>
        `;

        GM_addStyle(`
            #chain-guard-settings {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #chain-guard-settings .cg-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
            }
            #chain-guard-settings .cg-panel {
                position: relative;
                background: ${TORN.bg};
                border: 1px solid ${TORN.border};
                border-radius: 4px;
                width: 400px;
                max-width: 90%;
                font-family: 'Open Sans', Arial, sans-serif;
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-header {
                background: linear-gradient(to bottom, ${TORN.panel}, #222);
                padding: 12px 16px;
                border-bottom: 1px solid ${TORN.border};
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: bold;
            }
            #chain-guard-settings .cg-close {
                background: none;
                border: none;
                color: ${TORN.textMuted};
                cursor: pointer;
                font-size: 18px;
                padding: 0 4px;
            }
            #chain-guard-settings .cg-close:hover {
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-body {
                padding: 16px;
            }
            #chain-guard-settings .cg-field {
                margin-bottom: 16px;
            }
            #chain-guard-settings .cg-field label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                color: ${TORN.textMuted};
            }
            #chain-guard-settings .cg-field input {
                width: 100%;
                padding: 8px 12px;
                background: ${TORN.panel};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                color: ${TORN.text};
                font-size: 14px;
                box-sizing: border-box;
            }
            #chain-guard-settings .cg-info {
                background: ${TORN.panel};
                padding: 12px;
                border-radius: 3px;
                font-size: 13px;
            }
            #chain-guard-settings .cg-info p {
                margin: 6px 0;
            }
            #chain-guard-settings .cg-footer {
                padding: 12px 16px;
                border-top: 1px solid ${TORN.border};
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            #chain-guard-settings .cg-footer button {
                padding: 8px 16px;
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
            }
            #chain-guard-settings .cg-save {
                background: linear-gradient(to bottom, #555, ${TORN.panel});
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-save:hover {
                background: linear-gradient(to bottom, #666, #444);
            }
            #chain-guard-settings .cg-cancel {
                background: ${TORN.bg};
                color: ${TORN.textMuted};
            }
            #chain-guard-settings .cg-cancel:hover {
                color: ${TORN.text};
            }
        `);

        document.body.appendChild(panel);

        // Event handlers
        panel.querySelector('.cg-close').onclick = () => panel.remove();
        panel.querySelector('.cg-cancel').onclick = () => panel.remove();
        panel.querySelector('.cg-overlay').onclick = () => panel.remove();
        panel.querySelector('.cg-save').onclick = () => {
            const threshold = parseInt(panel.querySelector('#cg-threshold').value, 10);
            if (threshold > 0) {
                saveSettings({ threshold });
                log('Settings saved:', threshold);
                updateGuard();
            }
            panel.remove();
        };
    }

    // Initialize
    function init() {
        log('Init start');

        // Load cached chain data
        loadChainCache();

        // Hook WebSocket early
        hookWebSocket();

        // Start DOM fallback for when websocket updates are missing
        ensureDomObserver();
        parseChainFromDOM();

        // Watch for URL changes (SPA navigation)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                log('URL changed, refreshing guard state:', url);
                parseChainFromDOM();
                updateGuard();
            }
        }).observe(document, { subtree: true, childList: true });

        // Initial guard check
        updateGuard();

        // Periodic check for attack buttons (they load dynamically)
        if (window.location.href.includes('sid=attack')) {
            setInterval(() => {
                parseChainFromDOM();
                updateGuard();
            }, 1000);
        }

        // Register menu command
        GM_registerMenuCommand('Chain Guard Settings', openSettings);

        log('Ready. Current chain:', chainState.amount, '/', chainState.max, 'source:', chainState.source);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
