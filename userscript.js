// ==UserScript==
// @name         Torn Extension Boilerplate
// @namespace    torn-extension-boilerplate
// @version      1.0.0
// @description  A starter template for Torn userscripts with API integration
// @author       Your Name
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

/**
 * Torn Extension Boilerplate
 * 
 * This is a complete starter template for building Torn userscripts.
 * It includes:
 * - API key management with secure storage
 * - Cached API requests
 * - Settings panel
 * - Common utility functions
 * - Error handling
 * 
 * Terms of Service: This script stores API keys locally and does not
 * share data with external servers.
 */

(function() {
    'use strict';

    // ==========================================
    // Configuration
    // ==========================================
    const CONFIG = {
        scriptName: 'Torn Extension',
        version: '1.0.0',
        cacheTtl: {
            user: 60,      // Cache user data for 60 minutes
            faction: 30,   // Cache faction data for 30 minutes
            market: 5      // Cache market data for 5 minutes
        }
    };

    // ==========================================
    // State
    // ==========================================
    const state = {
        apiKey: null,
        cache: {}
    };

    // ==========================================
    // Storage / API Key Management
    // ==========================================
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
            // Clear all cached values
            const keys = ['user', 'faction', 'company', 'market'];
            keys.forEach(k => {
                GM_deleteValue(`cache_${k}`);
                GM_deleteValue(`cache_${k}_time`);
            });
        }
    };

    // ==========================================
    // API Client
    // ==========================================
    const TornAPI = {
        baseUrl: 'https://api.torn.com',
        
        request: (endpoint, params = {}) => {
            return new Promise((resolve, reject) => {
                const key = Storage.getKey();
                if (!key) {
                    reject(new Error('No API key configured'));
                    return;
                }

                const url = new URL(`${TornAPI.baseUrl}/${endpoint}/${params.id || ''}`);
                url.searchParams.set('key', key);
                if (params.selections) {
                    url.searchParams.set('selections', params.selections);
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url.toString(),
                    headers: {
                        'Accept': 'application/json'
                    },
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                reject(new Error(`API Error ${data.error.code}: ${data.error.error}`));
                            } else {
                                resolve(data);
                            }
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: (error) => {
                        reject(new Error('Network error: ' + error.statusText));
                    },
                    ontimeout: () => {
                        reject(new Error('Request timeout'));
                    }
                });
            });
        },

        // Cached request wrapper
        cachedRequest: (cacheKey, ttlMinutes, endpoint, params) => {
            const cached = Storage.getCache(cacheKey);
            if (cached && (Date.now() - cached.time) < ttlMinutes * 60000) {
                return Promise.resolve(cached.data);
            }
            
            return TornAPI.request(endpoint, params).then(data => {
                Storage.setCache(cacheKey, data);
                return data;
            });
        },

        // Convenience methods
        getUser: (selections = 'basic', userId = '') => 
            TornAPI.cachedRequest('user', CONFIG.cacheTtl.user, 'user', { id: userId, selections }),
        
        getFaction: (selections = 'basic', factionId = '') =>
            TornAPI.cachedRequest('faction', CONFIG.cacheTtl.faction, 'faction', { id: factionId, selections }),
        
        getCompany: (selections = 'profile', companyId = '') =>
            TornAPI.request('company', { id: companyId, selections }),
        
        getMarket: (itemId) =>
            TornAPI.cachedRequest(`market_${itemId}`, CONFIG.cacheTtl.market, 'market', { id: itemId }),
        
        getKeyInfo: () =>
            TornAPI.request('key', {})
    };

    // ==========================================
    // UI Components
    // ==========================================
    const UI = {
        // Create a styled panel
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

        // Show notification
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
            
            // Add animation
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

        // Settings modal
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
                        width: 400px;
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
                           placeholder="Enter your 16-character API key">
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

            // Event handlers
            modal.querySelector('#close-settings').onclick = () => modal.remove();
            modal.querySelector('#save-settings').onclick = () => {
                const key = modal.querySelector('#api-key').value.trim();
                if (key && key.length !== 16) {
                    alert('API key should be 16 characters');
                    return;
                }
                if (key) {
                    Storage.setKey(key);
                    UI.notify('Settings saved!', 'success');
                    modal.remove();
                    init(); // Re-initialize with new key
                }
            };
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        }
    };

    // ==========================================
    // Utilities
    // ==========================================
    const Utils = {
        // Wait for element to appear in DOM
        waitFor: (selector, timeout = 10000) => {
            return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);

                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
                        resolve(el);
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, timeout);
            });
        },

        // Format numbers
        formatNumber: (num) => {
            if (num === undefined || num === null) return 'N/A';
            return num.toLocaleString();
        },

        // Format money
        formatMoney: (amount) => {
            if (amount === undefined || amount === null) return '$0';
            return '$' + amount.toLocaleString();
        },

        // Debounce function
        debounce: (fn, ms) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn(...args), ms);
            };
        },

        // Throttle function
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

    // ==========================================
    // Main Features (Customize these!)
    // ==========================================
    const Features = {
        // Example: Display player networth on homepage
        showNetworth: async () => {
            if (!window.location.pathname.includes('index.php')) return;
            
            try {
                const data = await TornAPI.getUser('basic,networth');
                const networth = data.networth;
                
                if (networth) {
                    const panel = UI.createPanel('Your Networth', `
                        <div style="font-size: 18px; font-weight: bold; color: #2ecc71;">
                            ${Utils.formatMoney(networth.total)}
                        </div>
                        <div style="font-size: 12px; color: #888; margin-top: 5px;">
                            Last updated: ${new Date().toLocaleTimeString()}
                        </div>
                    `);
                    
                    // Insert after sidebar or main content
                    const sidebar = document.querySelector('#sidebarroot');
                    if (sidebar) {
                        sidebar.insertBefore(panel, sidebar.firstChild);
                    }
                }
            } catch (e) {
                console.error('Failed to load networth:', e);
            }
        },

        // Add your custom features here!
        // myCustomFeature: () => { ... }
    };

    // ==========================================
    // Initialization
    // ==========================================
    function init() {
        state.apiKey = Storage.getKey();
        
        if (!state.apiKey) {
            console.log(`${CONFIG.scriptName}: No API key found. Open settings to configure.`);
            // Show a one-time notification
            if (!GM_getValue('has_shown_setup', false)) {
                setTimeout(() => {
                    UI.notify('Click the Tampermonkey icon → User Script Commands → Settings to configure your API key', 'info');
                    GM_setValue('has_shown_setup', true);
                }, 2000);
            }
            return;
        }

        console.log(`${CONFIG.scriptName} v${CONFIG.version} initialized`);
        
        // Run features based on current page
        Features.showNetworth();
        // Features.myCustomFeature();
    }

    // ==========================================
    // Register Menu Commands
    // ==========================================
    GM_registerMenuCommand('⚙️ Settings', UI.showSettings);
    GM_registerMenuCommand('🔄 Clear Cache', () => {
        Storage.clearCache();
        UI.notify('Cache cleared!', 'success');
    });
    GM_registerMenuCommand('📊 API Key Info', async () => {
        try {
            const info = await TornAPI.getKeyInfo();
            alert(`API Key Info:\nAccess Level: ${info.access_level}\nSelections: ${info.selections?.join(', ') || 'N/A'}`);
        } catch (e) {
            UI.notify('Failed to get key info: ' + e.message, 'error');
        }
    });

    // ==========================================
    // Start
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();