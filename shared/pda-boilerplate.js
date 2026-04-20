// ==UserScript==
// @name         Torn PDA Script Boilerplate
// @namespace    torn-pda-boilerplate
// @version      1.0.0
// @description  Boilerplate for Torn PDA userscripts with shared settings hub integration
// @author       Kevin
// @match        https://www.torn.com/*
// @run-at       document-start
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn PDA Script Boilerplate v1.0.0                      ║
 * ║  Template for creating PDA-compatible userscripts        ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * INSTRUCTIONS:
 * 1. Copy this file as your starting point
 * 2. Change @name, @namespace, @description, @author
 * 3. Implement your script logic in the init() function
 * 4. Register with the shared settings hub (optional but recommended)
 * 5. Test in Torn PDA
 * 
 * REQUIRED SETUP:
 * - Install "Torn PDA Shared Settings Hub" script FIRST
 * - Then install this script (and your modified versions)
 * 
 * The Hub provides:
 * - Single settings button in header (next to hamburger)
 * - Unified settings modal
 * - Script registration/discovery
 * - Consistent Torn-native styling
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION - Customize these for your script
    // ═══════════════════════════════════════════════════════════
    const SCRIPT_CONFIG = {
        id: 'my-script-id',           // Unique ID (no spaces, use dashes)
        name: 'My Script Name',        // Display name
        version: '1.0.0',              // Script version
        icon: '🔧',                    // Icon for settings hub (emoji or text)
        order: 100                     // Order in settings list (lower = higher)
    };

    const CONFIG = {
        // Your script's config options here
        POLL_INTERVAL_MS: 300,         // For PDA-safe DOM polling
        SETTINGS_KEY: 'my_script_settings'
    };

    // ═══════════════════════════════════════════════════════════
    // TORN NATIVE COLORS - Use these for consistent styling
    // ═══════════════════════════════════════════════════════════
    const TORN = {
        bg: '#444',                    // Page background
        panel: '#333',                 // Panel background
        panelHover: '#555',            // Hover state
        text: '#ddd',                  // Primary text
        textMuted: '#999',             // Secondary text
        green: '#82c91e',              // Success/accent
        blue: '#74c0fc',               // Links
        red: '#E54C19',                // Errors/warnings
        yellow: '#F08C00',             // Warnings
        border: '#444',                // Borders
        borderLight: '#555',           // Light borders
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
    };

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    let isInitialized = false;
    let settings = {};

    // ═══════════════════════════════════════════════════════════
    // STORAGE HELPERS
    // ═══════════════════════════════════════════════════════════
    function loadSettings() {
        try {
            const saved = localStorage.getItem(CONFIG.SETTINGS_KEY);
            return saved ? JSON.parse(saved) : getDefaultSettings();
        } catch {
            return getDefaultSettings();
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error(`[${SCRIPT_CONFIG.name}] Failed to save settings:`, e);
        }
    }

    function getDefaultSettings() {
        return {
            // Your default settings here
            enabled: true,
            // option1: 'default_value'
        };
    }

    // ═══════════════════════════════════════════════════════════
    // PDA-SAFE DOM POLLING
    // ═══════════════════════════════════════════════════════════
    function pollForElement(selector, callback, timeout = 10000) {
        const startTime = Date.now();
        
        const check = () => {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
                return;
            }
            
            if (Date.now() - startTime < timeout) {
                setTimeout(check, CONFIG.POLL_INTERVAL_MS);
            } else {
                console.log(`[${SCRIPT_CONFIG.name}] Timeout waiting for: ${selector}`);
            }
        };
        
        check();
    }

    // ═══════════════════════════════════════════════════════════
    // SETTINGS UI
    // ═══════════════════════════════════════════════════════════
    function createSettingsModal() {
        // Remove existing
        const existing = document.getElementById(`${SCRIPT_CONFIG.id}-settings`);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = `${SCRIPT_CONFIG.id}-settings`;
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
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
                        background: ${TORN.headerGradient};
                        padding: 12px 16px;
                        border-bottom: 1px solid ${TORN.border};
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <h3 style="
                            margin: 0;
                            color: #fff;
                            font-size: 14px;
                            font-weight: bold;
                            text-shadow: 0 0 2px rgba(0,0,0,0.8);
                        ">${SCRIPT_CONFIG.icon} ${SCRIPT_CONFIG.name} Settings</h3>
                        <button id="${SCRIPT_CONFIG.id}-close" style="
                            background: transparent;
                            border: none;
                            color: ${TORN.textMuted};
                            font-size: 20px;
                            cursor: pointer;
                            padding: 0 4px;
                        ">×</button>
                    </div>
                    <div style="padding: 16px;">
                        <!-- Your settings UI here -->
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                color: ${TORN.textMuted};
                                font-size: 12px;
                                font-weight: bold;
                                margin-bottom: 6px;
                            ">Example Setting</label>
                            <input type="checkbox" id="${SCRIPT_CONFIG.id}-enabled" 
                                ${settings.enabled ? 'checked' : ''}
                                style="margin-right: 8px;">
                            <span style="color: ${TORN.text};">Enable feature</span>
                        </div>
                        
                        <div style="
                            margin-top: 20px;
                            display: flex;
                            gap: 10px;
                        ">
                            <button id="${SCRIPT_CONFIG.id}-save" style="
                                flex: 1;
                                padding: 12px;
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

        // Close handlers
        modal.querySelector(`#${SCRIPT_CONFIG.id}-close`).addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal.querySelector('div')) modal.remove();
        });

        // Save handler
        modal.querySelector(`#${SCRIPT_CONFIG.id}-save`).addEventListener('click', () => {
            settings.enabled = modal.querySelector(`#${SCRIPT_CONFIG.id}-enabled`).checked;
            saveSettings();
            modal.remove();
            console.log(`[${SCRIPT_CONFIG.name}] Settings saved`);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // REGISTER WITH SHARED HUB
    // ═══════════════════════════════════════════════════════════
    function registerWithHub() {
        // Check if hub exists (it should be loaded first)
        if (window.TornPDASettingsHub) {
            window.TornPDASettingsHub.register({
                id: SCRIPT_CONFIG.id,
                title: SCRIPT_CONFIG.name,
                icon: SCRIPT_CONFIG.icon,
                order: SCRIPT_CONFIG.order,
                openSettings: createSettingsModal
            });
            console.log(`[${SCRIPT_CONFIG.name}] Registered with Settings Hub`);
        } else {
            // Hub not loaded yet, try again later
            console.log(`[${SCRIPT_CONFIG.name}] Settings Hub not found. Load the Hub script first for best experience.`);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN SCRIPT LOGIC
    // ═══════════════════════════════════════════════════════════
    function init() {
        if (isInitialized) return;
        isInitialized = true;

        // Load settings
        settings = loadSettings();

        // Register with shared hub
        registerWithHub();

        // Your main script logic here
        console.log(`[${SCRIPT_CONFIG.name}] v${SCRIPT_CONFIG.version} initialized`);

        // Example: Poll for an element and modify it
        // pollForElement('.some-selector', (el) => {
        //     // Do something with the element
        // });
    }

    // ═══════════════════════════════════════════════════════════
    // START
    // ═══════════════════════════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();