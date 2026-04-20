// ==UserScript==
// @name         Torn PDA Script Boilerplate
// @namespace    torn-pda-boilerplate
// @version      1.0.0
// @description  Self-contained boilerplate for Torn PDA userscripts with cooperative header sharing
// @author       Kevin
// @match        https://www.torn.com/*
// @run-at       document-start
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn PDA Script Boilerplate v1.0.0                      ║
 * ║  Self-contained with cooperative header sharing          ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * KEY PRINCIPLE: Each script is self-contained and works independently.
 * Scripts cooperatively share header space WITHOUT dependencies.
 * 
 * HOW IT WORKS:
 * 1. Script checks for shared container (#torn-pda-scripts-container)
 * 2. If not found, creates one next to hamburger menu
 * 3. Adds its OWN button to this shared container
 * 4. Manages its own settings independently
 * 
 * BENEFITS:
 * ✓ No dependencies between scripts
 * ✓ Install/remove in any order
 * ✓ Each script works standalone
 * ✓ Clean shared header space
 * ✓ No "hub" script required
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
        icon: '🔧',                    // Icon for header button
    };

    const CONFIG = {
        POLL_INTERVAL_MS: 500,         // For PDA-safe DOM polling
        SETTINGS_KEY: 'my_script_settings'
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
        border: '#444',
        borderLight: '#555'
    };

    // ═══════════════════════════════════════════════════════════
    // COOPERATIVE HEADER (No dependencies!)
    // ═══════════════════════════════════════════════════════════

    function findHamburgerMenu() {
        const selectors = [
            '.header-menu.left .header-menu-icon',
            '.header-menu-icon',
            '[class*="header-menu"] button',
            '.top_header_button.header-menu-icon'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    function getOrCreateSharedContainer() {
        // Check if another script already created the container
        let container = document.getElementById('torn-pda-scripts-container');
        if (container) return container;

        const hamburger = findHamburgerMenu();
        if (!hamburger) return null;

        // Create shared container
        container = document.createElement('div');
        container.id = 'torn-pda-scripts-container';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 8px;
        `;

        // Insert next to hamburger
        const headerMenu = hamburger.closest('.header-menu, [class*="header-menu"]');
        if (headerMenu) {
            headerMenu.insertAdjacentElement('afterend', container);
        } else {
            hamburger.insertAdjacentElement('afterend', container);
        }

        return container;
    }

    function ensureHeaderButton() {
        const btnId = `pda-script-btn-${SCRIPT_CONFIG.id}`;
        if (document.getElementById(btnId)) return true;

        const container = getOrCreateSharedContainer();
        if (!container) return false;

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
        `;

        // Click handler
        btn.addEventListener('click', openSettings);

        // Touch feedback for PDA
        btn.addEventListener('touchstart', () => {
            btn.style.background = TORN.panelHover;
            btn.style.borderColor = TORN.green;
        });
        btn.addEventListener('touchend', () => {
            setTimeout(() => {
                btn.style.background = 'transparent';
                btn.style.borderColor = TORN.border;
            }, 200);
        });

        container.appendChild(btn);
        console.log(`[${SCRIPT_CONFIG.name}] Added to shared header`);
        return true;
    }

    function pollForHeader() {
        if (ensureHeaderButton()) return;
        setTimeout(pollForHeader, CONFIG.POLL_INTERVAL_MS);
    }

    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════
    function loadSettings() {
        try {
            const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
            return saved ? JSON.parse(saved) : getDefaultSettings();
        } catch {
            return getDefaultSettings();
        }
    }

    function saveSettings(data) {
        try {
            localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(data));
        } catch (e) {
            console.error(`[${SCRIPT_CONFIG.name}] Save failed:`, e);
        }
    }

    function getDefaultSettings() {
        return {
            enabled: true
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
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.85);
                z-index: 999999;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 60px;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    background: ${TORN.panel};
                    border: 1px solid ${TORN.borderLight};
                    border-radius: 4px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                ">
                    <div style="
                        background: linear-gradient(180deg, #777 0%, #333 100%);
                        padding: 12px 16px;
                        border-bottom: 1px solid ${TORN.border};
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
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
                        <!-- YOUR SETTINGS HERE -->
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block; color: ${TORN.textMuted};
                                font-size: 12px; font-weight: bold;
                                margin-bottom: 6px;
                            ">Enable Feature</label>
                            <input type="checkbox" id="${SCRIPT_CONFIG.id}-enabled" 
                                ${settings.enabled ? 'checked' : ''}
                                style="margin-right: 8px;">
                            <span style="color: ${TORN.text};">Enabled</span>
                        </div>
                        
                        <div style="margin-top: 20px; display: flex; gap: 10px;">
                            <button id="${SCRIPT_CONFIG.id}-save" style="
                                flex: 1; padding: 12px;
                                background: ${TORN.panelHover};
                                border: 1px solid ${TORN.borderLight};
                                color: ${TORN.text};
                                border-radius: 4px;
                                cursor: pointer;
                                font-weight: bold;
                            ">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handlers
        modal.querySelector(`#${SCRIPT_CONFIG.id}-close`).addEventListener('click', () => {
            modal.remove();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal.firstElementChild) modal.remove();
        });
        modal.querySelector(`#${SCRIPT_CONFIG.id}-save`).addEventListener('click', () => {
            settings.enabled = modal.querySelector(`#${SCRIPT_CONFIG.id}-enabled`).checked;
            saveSettings(settings);
            modal.remove();
            console.log(`[${SCRIPT_CONFIG.name}] Settings saved`);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // YOUR SCRIPT LOGIC HERE
    // ═══════════════════════════════════════════════════════════
    function initScript() {
        const settings = loadSettings();
        if (!settings.enabled) return;

        console.log(`[${SCRIPT_CONFIG.name}] v${SCRIPT_CONFIG.version} running`);
        
        // Your main logic here
        // Example: pollForElement('.selector', (el) => modifyElement(el));
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    function init() {
        pollForHeader();
        initScript();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();