// ==UserScript==
// @name         Torn Tampermonkey Script Boilerplate
// @namespace    torn-tampermonkey-boilerplate
// @version      1.0.0
// @description  Self-contained boilerplate for Torn Tampermonkey userscripts
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn Tampermonkey Script Boilerplate v1.0.0             ║
 * ║  Template for desktop browser userscripts                ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * INSTRUCTIONS:
 * 1. Copy this file as your starting point
 * 2. Change @name, @namespace, @description, @author
 * 3. Add/remove @grant lines as needed
 * 4. Implement your script logic in init()
 * 5. Test in browser with Tampermonkey extension
 * 
 * FEATURES:
 * - GM_* storage for persistent settings
 * - GM_addStyle for CSS injection
 * - GM_registerMenuCommand for settings menu
 * - GM_xmlhttpRequest for API calls
 * - MutationObserver for DOM changes (desktop only)
 * - Torn-native styling
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION - Customize these for your script
    // ═══════════════════════════════════════════════════════════
    const SCRIPT_CONFIG = {
        id: 'my-script-id',           // Unique ID (no spaces)
        name: 'My Script Name',        // Display name
        version: '1.0.0',              // Script version
    };

    const CONFIG = {
        SETTINGS_KEY: 'my_script_settings',
        API_BASE_URL: 'https://api.torn.com/v2',
        UPDATE_INTERVAL: 5 * 60 * 1000  // 5 minutes
    };

    // ═══════════════════════════════════════════════════════════
    // TORN NATIVE COLORS
    // ═══════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════
    // STORAGE (GM_* functions)
    // ═══════════════════════════════════════════════════════════
    const Storage = {
        get: (key, defaultValue = null) => {
            try {
                const value = GM_getValue(key, null);
                return value !== null ? JSON.parse(value) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        
        set: (key, value) => {
            try {
                GM_setValue(key, JSON.stringify(value));
            } catch (e) {
                console.error(`[${SCRIPT_CONFIG.name}] Storage error:`, e);
            }
        },
        
        delete: (key) => {
            try {
                GM_deleteValue(key);
            } catch (e) {
                console.error(`[${SCRIPT_CONFIG.name}] Delete error:`, e);
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    // SETTINGS MANAGEMENT
    // ═══════════════════════════════════════════════════════════
    function loadSettings() {
        return Storage.get(CONFIG.SETTINGS_KEY, getDefaultSettings());
    }

    function saveSettings(settings) {
        Storage.set(CONFIG.SETTINGS_KEY, settings);
    }

    function getDefaultSettings() {
        return {
            enabled: true,
            apiKey: '',
            // Add your defaults here
        };
    }

    // ═══════════════════════════════════════════════════════════
    // STYLES (GM_addStyle)
    // ═══════════════════════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById(`${SCRIPT_CONFIG.id}-styles`)) return;

        GM_addStyle(`
            #${SCRIPT_CONFIG.id}-modal {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                z-index: 999999;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 100px;
                font-family: Arial, sans-serif;
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-content {
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                width: 400px;
                max-width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-header {
                background: ${TORN.headerGradient};
                padding: 12px 16px;
                border-bottom: 1px solid ${TORN.border};
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-header h3 {
                margin: 0;
                color: #fff;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 0 0 2px rgba(0,0,0,0.8);
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-close {
                background: transparent;
                border: none;
                color: ${TORN.textMuted};
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-close:hover {
                color: #fff;
            }
            
            #${SCRIPT_CONFIG.id}-modal .modal-body {
                padding: 16px;
            }
            
            #${SCRIPT_CONFIG.id}-modal .form-field {
                margin-bottom: 16px;
            }
            
            #${SCRIPT_CONFIG.id}-modal .form-field label {
                display: block;
                color: ${TORN.textMuted};
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 6px;
            }
            
            #${SCRIPT_CONFIG.id}-modal .form-field input {
                width: 100%;
                padding: 8px 12px;
                background: ${TORN.panel};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                color: ${TORN.text};
                font-size: 14px;
                box-sizing: border-box;
            }
            
            #${SCRIPT_CONFIG.id}-modal .form-field input:focus {
                border-color: ${TORN.blue};
                outline: none;
                box-shadow: 0 0 2px rgba(116, 192, 252, 0.6);
            }
            
            #${SCRIPT_CONFIG.id}-modal .btn {
                padding: 10px 16px;
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%);
                border: 1px solid #111;
                color: #eee;
                border-radius: 3px;
                cursor: pointer;
                font-weight: bold;
                text-shadow: 0 0 5px #000;
            }
            
            #${SCRIPT_CONFIG.id}-modal .btn:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%);
                color: #fff;
            }
            
            #${SCRIPT_CONFIG.id}-modal .btn-primary {
                border-color: ${TORN.green};
            }
        `);
    }

    // ═══════════════════════════════════════════════════════════
    // SETTINGS UI
    // ═══════════════════════════════════════════════════════════
    function openSettings() {
        injectStyles();
        
        const settings = loadSettings();
        const modalId = `${SCRIPT_CONFIG.id}-modal`;
        
        // Remove existing
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${SCRIPT_CONFIG.name} Settings</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-field">
                        <label>API Key (optional)</label>
                        <input type="text" id="${SCRIPT_CONFIG.id}-apikey" 
                            value="${settings.apiKey}" 
                            placeholder="Enter Torn API key">
                    </div>
                    
                    <div class="form-field">
                        <label>
                            <input type="checkbox" id="${SCRIPT_CONFIG.id}-enabled" 
                                ${settings.enabled ? 'checked' : ''}>
                            Enable script
                        </label>
                    </div>
                    
                    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-cancel">Cancel</button>
                        <button class="btn btn-primary btn-save">Save</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handlers
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.btn-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        modal.querySelector('.btn-save').addEventListener('click', () => {
            settings.apiKey = modal.querySelector(`#${SCRIPT_CONFIG.id}-apikey`).value.trim();
            settings.enabled = modal.querySelector(`#${SCRIPT_CONFIG.id}-enabled`).checked;
            saveSettings(settings);
            modal.remove();
            console.log(`[${SCRIPT_CONFIG.name}] Settings saved`);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // API CLIENT (GM_xmlhttpRequest)
    // ═══════════════════════════════════════════════════════════
    function buildApiUrl(path, params = {}) {
        const settings = loadSettings();
        const url = new URL(`${CONFIG.API_BASE_URL}${path}`);
        
        if (settings.apiKey) {
            url.searchParams.set('key', settings.apiKey);
        }
        url.searchParams.set('comment', SCRIPT_CONFIG.id);
        
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        }
        
        return url.toString();
    }

    function apiRequest(path, params = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: buildApiUrl(path, params),
                headers: { 'Accept': 'application/json' },
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
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DOM OBSERVER (Desktop only - NOT for PDA)
    // ═══════════════════════════════════════════════════════════
    function waitForElement(selector, callback, timeout = 10000) {
        const el = document.querySelector(selector);
        if (el) {
            callback(el);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Timeout cleanup
        if (timeout > 0) {
            setTimeout(() => observer.disconnect(), timeout);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // YOUR SCRIPT LOGIC HERE
    // ═══════════════════════════════════════════════════════════
    function initScript() {
        const settings = loadSettings();
        if (!settings.enabled) {
            console.log(`[${SCRIPT_CONFIG.name}] Disabled in settings`);
            return;
        }

        console.log(`[${SCRIPT_CONFIG.name}] v${SCRIPT_CONFIG.version} running`);

        // Example: Wait for element and modify it
        // waitForElement('.some-selector', (el) => {
        //     el.style.background = TORN.green;
        // });

        // Example: API call
        // apiRequest('/user/basic')
        //     .then(data => console.log('User:', data))
        //     .catch(err => console.error('API error:', err));
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    function init() {
        // Register menu command for settings
        GM_registerMenuCommand(`${SCRIPT_CONFIG.name} Settings`, openSettings);
        
        // Run main script
        initScript();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();