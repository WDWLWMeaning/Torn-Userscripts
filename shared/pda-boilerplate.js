// ==UserScript==
// @name         Torn PDA Script Boilerplate
// @namespace    torn-pda-boilerplate
// @version      1.1.0
// @description  Self-contained boilerplate for Torn PDA userscripts with native API support
// @author       Kevin
// @match        https://www.torn.com/*
// @run-at       document-start
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn PDA Script Boilerplate v1.1.0                      ║
 * ║  Self-contained with native PDA API support              ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * TORN PDA NATIVE API:
 * - API Key: Use constant "###PDA-APIKEY###" (auto-replaced at runtime)
 * - HTTP: PDA_httpGet(url, headers) and PDA_httpPost(url, headers, body)
 * - GM Functions: GM_getValue, GM_setValue, GM_addStyle, etc. (via GMforPDA)
 * 
 * COOPERATIVE HEADER:
 * Scripts share header space by creating #torn-pda-scripts-container
 * next to the hamburger menu, each adding their own button.
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION - Customize these for your script
    // ═══════════════════════════════════════════════════════════
    const SCRIPT_CONFIG = {
        id: 'my-script-id',           // Unique ID (no spaces, kebab-case)
        name: 'My Script Name',        // Display name
        version: '1.0.0',              // Script version
        icon: '🔧',                    // Icon for header button (emoji)
        debug: false                   // Set to true for console logging
    };

    const CONFIG = {
        POLL_INTERVAL_MS: 500,         // PDA-safe DOM polling interval
        SETTINGS_KEY: 'my_script_settings',
        API_KEY_PLACEHOLDER: '###PDA-APIKEY###'  // Auto-replaced by PDA
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
    // DEBUG LOGGING
    // ═══════════════════════════════════════════════════════════
    function log(...args) {
        if (SCRIPT_CONFIG.debug) {
            console.log(`[${SCRIPT_CONFIG.name}]`, ...args);
        }
    }

    function logError(...args) {
        console.error(`[${SCRIPT_CONFIG.name}]`, ...args);
    }

    // ═══════════════════════════════════════════════════════════
    // NATIVE PDA API HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * Get the user's API key (auto-replaced by Torn PDA at runtime)
     * @returns {string} API key or placeholder if not in PDA
     */
    function getApiKey() {
        // ###PDA-APIKEY### is replaced by Torn PDA with the actual key
        const key = CONFIG.API_KEY_PLACEHOLDER;
        // If not replaced, return empty string
        return key.includes('PDA-APIKEY') ? '' : key;
    }

    /**
     * Check if running inside Torn PDA
     * @returns {boolean}
     */
    function isTornPDA() {
        return typeof PDA_httpGet === 'function' || 
               typeof window.flutter_inappwebview !== 'undefined' ||
               getApiKey() !== '';
    }

    /**
     * Make HTTP GET request using native PDA API if available
     * Falls back to fetch() if not in PDA
     */
    async function httpGet(url, headers = {}) {
        if (typeof PDA_httpGet === 'function') {
            log('Using PDA_httpGet');
            return PDA_httpGet(url, headers);
        }
        // Fallback to fetch
        log('Using fetch fallback');
        const response = await fetch(url, { headers });
        return {
            status: response.status,
            statusText: response.statusText,
            responseText: await response.text(),
            responseHeaders: ''
        };
    }

    /**
     * Make HTTP POST request using native PDA API if available
     */
    async function httpPost(url, headers = {}, body = null) {
        if (typeof PDA_httpPost === 'function') {
            log('Using PDA_httpPost');
            return PDA_httpPost(url, headers, body);
        }
        // Fallback to fetch
        log('Using fetch fallback');
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: typeof body === 'object' ? JSON.stringify(body) : body
        });
        return {
            status: response.status,
            statusText: response.statusText,
            responseText: await response.text(),
            responseHeaders: ''
        };
    }

    // ═══════════════════════════════════════════════════════════
    // COOPERATIVE HEADER BUTTON
    // ═══════════════════════════════════════════════════════════

    /**
     * Find the hamburger menu button in Torn's header
     * Tries multiple selectors for different page states
     */
    function findHamburgerMenu() {
        // Extended list of selectors for PDA/mobile/desktop
        const selectors = [
            '.header-menu.left .header-menu-icon',
            '.header-menu-icon',
            '.header-menu button',
            '[class*="header-menu"] button',
            '.top_header_button.header-menu-icon',
            '#topHeaderBanner .header-menu button',
            '.header-wrapper-top .header-menu button',
            '.container .header-menu button',
            'button[aria-label="Open menu"]',
            'button.header-menu-icon'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {  // Check visible
                log('Found hamburger menu:', sel);
                return el;
            }
        }
        return null;
    }

    /**
     * Get or create the shared container for PDA script buttons
     */
    function getOrCreateSharedContainer() {
        // Check if already exists
        let container = document.getElementById('torn-pda-scripts-container');
        if (container) {
            log('Using existing shared container');
            return container;
        }

        // Find hamburger menu
        const hamburger = findHamburgerMenu();
        if (!hamburger) {
            log('Hamburger menu not found yet');
            return null;
        }

        // Find the header-menu container
        const headerMenu = hamburger.closest('.header-menu, [class*="header-menu"]');
        if (!headerMenu) {
            logError('Header menu container not found');
            return null;
        }

        // Create shared container
        container = document.createElement('div');
        container.id = 'torn-pda-scripts-container';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 8px;
            vertical-align: middle;
        `;

        // Insert inside header-menu, after hamburger button
        hamburger.insertAdjacentElement('afterend', container);
        log('Created shared container');

        return container;
    }

    /**
     * Add this script's button to the shared header container
     */
    function addHeaderButton() {
        const btnId = `pda-script-btn-${SCRIPT_CONFIG.id}`;
        
        // Check if already added
        if (document.getElementById(btnId)) {
            log('Button already exists');
            return true;
        }

        const container = getOrCreateSharedContainer();
        if (!container) {
            return false;
        }

        // Create button
        const btn = document.createElement('button');
        btn.id = btnId;
        btn.type = 'button';
        btn.title = `${SCRIPT_CONFIG.name} settings`;
        btn.setAttribute('aria-label', `${SCRIPT_CONFIG.name} settings`);
        btn.textContent = SCRIPT_CONFIG.icon;
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: transparent;
            border: 1px solid ${TORN.border};
            border-radius: 4px;
            color: ${TORN.text};
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s;
            padding: 0;
            -webkit-tap-highlight-color: transparent;
        `;

        // Click handler
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSettings();
        });

        // Touch feedback for mobile
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            btn.style.background = TORN.panelHover;
            btn.style.borderColor = TORN.green;
        }, { passive: false });

        btn.addEventListener('touchend', () => {
            setTimeout(() => {
                btn.style.background = 'transparent';
                btn.style.borderColor = TORN.border;
            }, 150);
        });

        container.appendChild(btn);
        log('Added header button');
        return true;
    }

    /**
     * Start polling for header availability
     * Keeps trying until button is added or timeout
     */
    function initHeaderButton(maxAttempts = 60) {  // 60 * 500ms = 30 seconds
        let attempts = 0;

        const tryAddButton = () => {
            attempts++;
            log(`Attempt ${attempts}/${maxAttempts} to add header button`);

            if (addHeaderButton()) {
                log('Header button added successfully');
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(tryAddButton, CONFIG.POLL_INTERVAL_MS);
            } else {
                logError('Failed to add header button after max attempts');
            }
        };

        // Start trying
        tryAddButton();
    }

    // ═══════════════════════════════════════════════════════════
    // STORAGE (localStorage for PDA)
    // ═══════════════════════════════════════════════════════════
    function loadSettings() {
        try {
            const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
            return saved ? JSON.parse(saved) : getDefaultSettings();
        } catch (e) {
            logError('Failed to load settings:', e);
            return getDefaultSettings();
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings));
            log('Settings saved');
        } catch (e) {
            logError('Failed to save settings:', e);
        }
    }

    function getDefaultSettings() {
        return {
            enabled: true,
            // Add your defaults here
        };
    }

    // ═══════════════════════════════════════════════════════════
    // SETTINGS UI
    // ═══════════════════════════════════════════════════════════
    function openSettings() {
        const settings = loadSettings();
        const modalId = `${SCRIPT_CONFIG.id}-settings`;

        // Remove existing
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.85);
            z-index: 999999;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding-top: 60px;
            font-family: Arial, sans-serif;
        `;

        modal.innerHTML = `
            <div style="
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                width: 90%;
                max-width: 400px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            ">
                <div style="
                    background: ${TORN.headerGradient};
                    padding: 12px 16px;
                    border-bottom: 1px solid ${TORN.border};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                ">
                    <h3 style="
                        margin: 0; color: #fff; font-size: 14px;
                        font-weight: bold; text-shadow: 0 0 2px rgba(0,0,0,0.8);
                    ">${SCRIPT_CONFIG.icon} ${SCRIPT_CONFIG.name}</h3>
                    <button id="${SCRIPT_CONFIG.id}-close" style="
                        background: transparent; border: none;
                        color: ${TORN.textMuted}; font-size: 20px;
                        cursor: pointer; padding: 0 4px;
                    ">×</button>
                </div>
                <div style="padding: 16px;">
                    <div style="margin-bottom: 16px;">
                        <label style="
                            display: block; color: ${TORN.textMuted};
                            font-size: 12px; font-weight: bold;
                            margin-bottom: 6px;
                        ">Enable Feature</label>
                        <label style="color: ${TORN.text}; cursor: pointer;">
                            <input type="checkbox" id="${SCRIPT_CONFIG.id}-enabled" 
                                ${settings.enabled ? 'checked' : ''}
                                style="margin-right: 8px;">
                            Enabled
                        </label>
                    </div>
                    
                    <div style="
                        margin-top: 20px;
                        padding-top: 16px;
                        border-top: 1px solid ${TORN.border};
                    ">
                        <button id="${SCRIPT_CONFIG.id}-save" style="
                            width: 100%;
                            padding: 12px;
                            background: ${TORN.panelHover};
                            border: 1px solid ${TORN.borderLight};
                            color: ${TORN.text};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 14px;
                        ">Save Settings</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handlers
        const closeModal = () => modal.remove();
        modal.querySelector(`#${SCRIPT_CONFIG.id}-close`).addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        modal.querySelector(`#${SCRIPT_CONFIG.id}-save`).addEventListener('click', () => {
            settings.enabled = modal.querySelector(`#${SCRIPT_CONFIG.id}-enabled`).checked;
            saveSettings(settings);
            closeModal();
        });
    }

    // ═══════════════════════════════════════════════════════════
    // DOM POLLING HELPER (PDA-safe)
    // ═══════════════════════════════════════════════════════════
    function pollForElement(selector, callback, maxAttempts = 60) {
        let attempts = 0;

        const check = () => {
            attempts++;
            const el = document.querySelector(selector);
            
            if (el) {
                log('Found element:', selector);
                callback(el);
                return;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(check, CONFIG.POLL_INTERVAL_MS);
            } else {
                log('Timeout waiting for:', selector);
            }
        };

        check();
    }

    // ═══════════════════════════════════════════════════════════
    // YOUR SCRIPT LOGIC HERE
    // ═══════════════════════════════════════════════════════════
    async function initScript() {
        const settings = loadSettings();
        if (!settings.enabled) {
            log('Script disabled in settings');
            return;
        }

        log('v' + SCRIPT_CONFIG.version + ' running');
        log('Torn PDA detected:', isTornPDA());
        log('API Key available:', getApiKey() ? 'Yes' : 'No');

        // Example: Poll for an element and modify it
        // pollForElement('.some-selector', (el) => {
        //     el.style.border = '2px solid ' + TORN.green;
        // });

        // Example: Make API request
        // try {
        //     const data = await httpGet('https://api.torn.com/v2/user/basic?key=' + getApiKey());
        //     log('API response:', data);
        // } catch (e) {
        //     logError('API error:', e);
        // }
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    function init() {
        log('Initializing...');
        
        // Start header button polling
        initHeaderButton();
        
        // Run main script logic
        initScript();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();