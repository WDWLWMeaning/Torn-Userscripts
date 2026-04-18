// ==UserScript==
// @name         Torn Extension Boilerplate
// @namespace    torn-extension-boilerplate
// @version      2.0.0
// @description  A starter template for Torn userscripts using the Torn API v2
// @author       Your Name
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

/**
 * Torn Extension Boilerplate
 *
 * Starter template for Torn userscripts built on Torn API v2.
 * It includes:
 * - API key management with local storage
 * - Cached API requests
 * - Settings panel
 * - Common utility functions
 * - Error handling
 */

(function() {
    'use strict';

    const CONFIG = {
        scriptName: 'Torn Extension',
        version: '2.0.0',
        apiBaseUrl: 'https://api.torn.com/v2',
        requestComment: 'torn-extension-boilerplate',
        cacheTtl: {
            basic: 30,
            faction: 30,
            money: 5,
            cooldowns: 1,
            battlestats: 15,
            market: 5
        }
    };

    const state = {
        apiKey: null
    };

    const Storage = {
        getKey: () => GM_getValue('torn_api_key', ''),
        setKey: (key) => GM_setValue('torn_api_key', key),
        deleteKey: () => GM_deleteValue('torn_api_key'),

        getCache: (key) => {
            const data = GM_getValue(`cache_${key}`, null);
            const time = GM_getValue(`cache_${key}_time`, 0);
            if (!data) return null;
            return { data: JSON.parse(data), time };
        },

        setCache: (key, data) => {
            GM_setValue(`cache_${key}`, JSON.stringify(data));
            GM_setValue(`cache_${key}_time`, Date.now());
        },

        clearCache: () => {
            const keys = [
                'basic',
                'money',
                'cooldowns',
                'battlestats',
                'faction_basic',
                'key_info'
            ];
            keys.forEach((key) => {
                GM_deleteValue(`cache_${key}`);
                GM_deleteValue(`cache_${key}_time`);
            });
        }
    };

    function buildApiUrl(path, query = {}) {
        const url = new URL(`${CONFIG.apiBaseUrl}${path}`);
        const key = Storage.getKey();
        if (key) {
            url.searchParams.set('key', key);
        }
        url.searchParams.set('comment', CONFIG.requestComment);

        for (const [name, value] of Object.entries(query)) {
            if (value === undefined || value === null || value === '') continue;
            if (Array.isArray(value)) {
                value.forEach((entry) => url.searchParams.append(name, entry));
            } else {
                url.searchParams.set(name, value);
            }
        }

        return url.toString();
    }

    const TornAPI = {
        request: (path, query = {}) => {
            return new Promise((resolve, reject) => {
                const key = Storage.getKey();
                if (!key) {
                    reject(new Error('No API key configured'));
                    return;
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: buildApiUrl(path, query),
                    headers: {
                        Accept: 'application/json'
                    },
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                reject(new Error(`API Error ${data.error.code}: ${data.error.error}`));
                            } else {
                                resolve(data);
                            }
                        } catch {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: (error) => reject(new Error(`Network error: ${error.statusText || 'unknown error'}`)),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        },

        cachedRequest: (cacheKey, ttlMinutes, path, query = {}) => {
            const cached = Storage.getCache(cacheKey);
            if (cached && (Date.now() - cached.time) < ttlMinutes * 60000) {
                return Promise.resolve(cached.data);
            }

            return TornAPI.request(path, query).then((data) => {
                Storage.setCache(cacheKey, data);
                return data;
            });
        },

        // Prefer dedicated v2 endpoints.
        getMyBasic: () => TornAPI.cachedRequest('basic', CONFIG.cacheTtl.basic, '/user/basic'),
        getUserBasic: (userId) => TornAPI.cachedRequest(`basic_${userId}`, CONFIG.cacheTtl.basic, `/user/${userId}/basic`),
        getMyMoney: () => TornAPI.cachedRequest('money', CONFIG.cacheTtl.money, '/user/money'),
        getMyCooldowns: () => TornAPI.cachedRequest('cooldowns', CONFIG.cacheTtl.cooldowns, '/user/cooldowns'),
        getMyBattlestats: () => TornAPI.cachedRequest('battlestats', CONFIG.cacheTtl.battlestats, '/user/battlestats'),
        getFactionBasic: (factionId = '') => TornAPI.cachedRequest(
            factionId ? `faction_basic_${factionId}` : 'faction_basic',
            CONFIG.cacheTtl.faction,
            factionId ? `/faction/${factionId}/basic` : '/faction/basic'
        ),
        getItemMarket: (itemId, options = {}) => TornAPI.cachedRequest(
            `market_${itemId}_${options.limit || 20}_${options.offset || 0}_${options.bonus || 'all'}`,
            CONFIG.cacheTtl.market,
            `/market/${itemId}/itemmarket`,
            options
        ),
        getKeyInfo: () => TornAPI.cachedRequest('key_info', CONFIG.cacheTtl.basic, '/key/info'),

        // Use the generic selector endpoint only when Torn does not yet expose a dedicated v2 path.
        requestSelection: (domain, selections, query = {}) => TornAPI.request(`/${domain}`, {
            ...query,
            selections: Array.isArray(selections) ? selections.join(',') : selections
        })
    };

    const UI = {
        createPanel: (title, content) => {
            const panel = document.createElement('div');
            panel.className = 'torn-userscript-panel';
            panel.innerHTML = `
                <style>
                    .torn-userscript-panel {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        border: 1px solid #0f3460;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 10px 0;
                        color: #e94560;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    .torn-userscript-panel h3 {
                        margin: 0 0 10px 0;
                        color: #fff;
                        border-bottom: 2px solid #e94560;
                        padding-bottom: 5px;
                    }
                    .torn-userscript-panel .content {
                        color: #eaeaea;
                    }
                </style>
                <h3>${title}</h3>
                <div class="content">${content}</div>
            `;
            return panel;
        },

        notify: (message, type = 'info') => {
            const colors = {
                info: '#3498db',
                success: '#2ecc71',
                warning: '#f39c12',
                error: '#e74c3c'
            };

            const div = document.createElement('div');
            div.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type] || colors.info};
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 10000;
                font-family: sans-serif;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
            `;
            div.textContent = message;

            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(div);
            setTimeout(() => div.remove(), 5000);
        },

        showSettings: () => {
            const existing = document.getElementById('torn-userscript-settings');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'torn-userscript-settings';
            modal.innerHTML = `
                <style>
                    #torn-userscript-settings {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.8);
                        z-index: 10001;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .settings-box {
                        background: #1a1a2e;
                        border: 2px solid #e94560;
                        border-radius: 10px;
                        padding: 30px;
                        width: 420px;
                        max-width: 90%;
                    }
                    .settings-box h2 {
                        color: #fff;
                        margin-top: 0;
                    }
                    .settings-box label {
                        color: #eaeaea;
                        display: block;
                        margin: 15px 0 5px;
                    }
                    .settings-box input {
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #0f3460;
                        background: #16213e;
                        color: #fff;
                        border-radius: 5px;
                        box-sizing: border-box;
                    }
                    .settings-box .buttons {
                        margin-top: 20px;
                        display: flex;
                        gap: 10px;
                    }
                    .settings-box button {
                        flex: 1;
                        padding: 10px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    .btn-primary {
                        background: #e94560;
                        color: white;
                    }
                    .btn-secondary {
                        background: #0f3460;
                        color: white;
                    }
                    .tos-note {
                        font-size: 11px;
                        color: #888;
                        margin-top: 15px;
                        padding-top: 15px;
                        border-top: 1px solid #333;
                    }
                </style>
                <div class="settings-box">
                    <h2>${CONFIG.scriptName} Settings</h2>
                    <label for="api-key">Torn API Key:</label>
                    <input type="password" id="api-key" value="${Storage.getKey()}"
                           placeholder="Enter your Torn API key">
                    <div class="buttons">
                        <button class="btn-primary" id="save-settings">Save</button>
                        <button class="btn-secondary" id="close-settings">Cancel</button>
                    </div>
                    <div class="tos-note">
                        <strong>Privacy:</strong> Your API key is stored locally in your browser.
                        No data is sent to external servers.
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('#close-settings').onclick = () => modal.remove();
            modal.querySelector('#save-settings').onclick = () => {
                const key = modal.querySelector('#api-key').value.trim();
                if (!key) {
                    alert('Please enter an API key.');
                    return;
                }
                Storage.setKey(key);
                UI.notify('Settings saved!', 'success');
                modal.remove();
                init();
            };
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        }
    };

    const Utils = {
        waitFor: (selector, timeout = 10000) => {
            return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);

                const observer = new MutationObserver(() => {
                    const found = document.querySelector(selector);
                    if (found) {
                        observer.disconnect();
                        resolve(found);
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, timeout);
            });
        },

        formatNumber: (num) => {
            if (num === undefined || num === null) return 'N/A';
            return Number(num).toLocaleString();
        },

        formatMoney: (amount) => {
            if (amount === undefined || amount === null) return '$0';
            return '$' + Number(amount).toLocaleString();
        },

        debounce: (fn, ms) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn(...args), ms);
            };
        },

        throttle: (fn, ms) => {
            let lastTime = 0;
            return (...args) => {
                const now = Date.now();
                if (now - lastTime >= ms) {
                    lastTime = now;
                    fn(...args);
                }
            };
        }
    };

    const Features = {
        showWealth: async () => {
            if (!window.location.pathname.includes('index.php')) return;

            try {
                const data = await TornAPI.getMyMoney();
                const money = data.money;
                if (!money) return;

                const panel = UI.createPanel('Your Wealth', `
                    <div style="font-size: 18px; font-weight: bold; color: #2ecc71;">
                        Daily networth: ${Utils.formatMoney(money.daily_networth)}
                    </div>
                    <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
                        <div>Wallet: ${Utils.formatMoney(money.wallet)}</div>
                        <div>Points: ${Utils.formatNumber(money.points)}</div>
                        <div>City bank: ${money.city_bank ? Utils.formatMoney(money.city_bank.amount) : 'None'}</div>
                    </div>
                    <div style="font-size: 12px; color: #888; margin-top: 8px;">
                        Last updated: ${new Date().toLocaleTimeString()}
                    </div>
                `);

                const sidebar = document.querySelector('#sidebarroot');
                if (sidebar) {
                    sidebar.insertBefore(panel, sidebar.firstChild);
                }
            } catch (e) {
                console.error('Failed to load wealth:', e);
            }
        }
    };

    function init() {
        state.apiKey = Storage.getKey();

        if (!state.apiKey) {
            console.log(`${CONFIG.scriptName}: No API key found. Open settings to configure.`);
            if (!GM_getValue('has_shown_setup', false)) {
                setTimeout(() => {
                    UI.notify('Click the Tampermonkey icon → User Script Commands → Settings to configure your API key', 'info');
                    GM_setValue('has_shown_setup', true);
                }, 2000);
            }
            return;
        }

        console.log(`${CONFIG.scriptName} v${CONFIG.version} initialized with Torn API v2`);
        Features.showWealth();
    }

    GM_registerMenuCommand('⚙️ Settings', UI.showSettings);
    GM_registerMenuCommand('🔄 Clear Cache', () => {
        Storage.clearCache();
        UI.notify('Cache cleared!', 'success');
    });
    GM_registerMenuCommand('📊 API Key Info', async () => {
        try {
            const info = await TornAPI.getKeyInfo();
            const access = info.info?.access;
            const userSelections = info.info?.selections?.user || [];
            alert(
                `API Key Info:\nAccess type: ${access?.type || 'Unknown'}\nAccess level: ${access?.level ?? 'Unknown'}\nUser selections: ${userSelections.join(', ') || 'N/A'}`
            );
        } catch (e) {
            UI.notify('Failed to get key info: ' + e.message, 'error');
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
