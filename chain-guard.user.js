// ==UserScript==
// @name         Torn Chain Guard
// @namespace    torn-chain-guard
// @version      1.0.0
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
 * Torn Chain Guard v1.0.0
 * Prevents attacks when near chain bonus thresholds
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        DEFAULT_THRESHOLD: 15,
        CACHE_KEY: 'chain_guard_data',
        SETTINGS_KEY: 'chain_guard_settings'
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
        lastUpdate: 0
    };

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
                chainState = data;
                console.log('[Chain Guard] Loaded cached chain:', chainState.amount, '/', chainState.max);
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

    // Parse chain data from WebSocket message
    function parseChainData(data) {
        try {
            if (data?.push?.pub?.data?.message?.namespaces?.sidebar?.actions?.updateChain?.chain) {
                const chain = data.push.pub.data.message.namespaces.sidebar.actions.updateChain.chain;
                if (chain.amount !== undefined) {
                    chainState.amount = parseInt(chain.amount, 10);
                    chainState.max = parseInt(chain.max, 10) || 1000;
                    chainState.bonuses = parseFloat(chain.bonuses) || 1.0;
                    saveChainCache();
                    console.log('[Chain Guard] Chain updated:', chainState.amount, '/', chainState.max);
                    updateGuard();
                }
            }
        } catch (e) {
            console.log('[Chain Guard] Parse error:', e);
        }
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

        window.WebSocket = function(url, protocols) {
            const ws = new OriginalWebSocket(url, protocols);

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    parseChainData(data);
                } catch {
                    // Not JSON, ignore
                }
            });

            return ws;
        };

        // Copy static properties
        Object.setPrototypeOf(window.WebSocket, OriginalWebSocket);
        window.WebSocket.prototype = OriginalWebSocket.prototype;
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

    // Update guard state
    function updateGuard() {
        const isAttackPage = window.location.href.includes('sid=attack');

        if (isInDangerZone()) {
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
                console.log('[Chain Guard] Settings saved:', threshold);
                updateGuard();
            }
            panel.remove();
        };
    }

    // Initialize
    function init() {
        console.log('[Chain Guard] Initializing...');

        // Load cached chain data
        loadChainCache();

        // Hook WebSocket early
        hookWebSocket();

        // Watch for URL changes (SPA navigation)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                updateGuard();
            }
        }).observe(document, { subtree: true, childList: true });

        // Initial guard check
        updateGuard();

        // Periodic check for attack buttons (they load dynamically)
        if (window.location.href.includes('sid=attack')) {
            setInterval(updateGuard, 1000);
        }

        // Register menu command
        GM_registerMenuCommand('Chain Guard Settings', openSettings);

        console.log('[Chain Guard] Ready. Current chain:', chainState.amount, '/', chainState.max);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
