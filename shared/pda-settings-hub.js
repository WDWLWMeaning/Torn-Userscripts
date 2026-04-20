// ==UserScript==
// @name         Torn PDA Shared Settings Hub
// @namespace    torn-pda-shared-settings
// @version      1.0.0
// @description  Shared settings launcher for all Torn PDA userscripts. Provides a single settings button in the header that manages all registered scripts.
// @author       Kevin
// @match        https://www.torn.com/*
// @run-at       document-start
// ==/UserScript==

/**
 * Torn PDA Shared Settings Hub v1.0.0
 * 
 * Usage for other PDA scripts:
 * 
 * // Register your script with the hub
 * if (window.TornPDASettingsHub) {
 *     window.TornPDASettingsHub.register({
 *         id: 'my-script-id',
 *         title: 'My Script Name',
 *         icon: '⚙️', // optional
 *         order: 10,  // optional, lower = higher in list
 *         openSettings: () => {
 *             // Your function to show settings modal
 *             showMySettings();
 *         }
 *     });
 * }
 */

(function() {
    'use strict';

    const CONFIG = {
        POLL_INTERVAL_MS: 500,
        HEADER_BUTTON_ID: 'torn-pda-settings-hub-btn',
        MODAL_ID: 'torn-pda-settings-hub-modal',
        HUB_CONTAINER_ID: 'torn-pda-settings-hub-container'
    };

    // Torn native colors
    const TORN = {
        bg: '#444',
        panel: '#333',
        panelHover: '#555',
        text: '#ddd',
        textMuted: '#999',
        green: '#82c91e',
        border: '#444',
        borderLight: '#555',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
    };

    // Registry of registered scripts
    const registry = new Map();
    let hubInitialized = false;
    let pollInterval = null;
    let modalRef = null;

    // ==================== STYLES ====================

    function injectStyles() {
        if (document.getElementById('torn-pda-hub-styles')) return;

        const style = document.createElement('style');
        style.id = 'torn-pda-hub-styles';
        style.textContent = `
            /* Hub Button - positioned next to hamburger */
            #${CONFIG.HEADER_BUTTON_ID} {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                margin-left: 8px;
                background: transparent;
                border: 1px solid ${TORN.border};
                border-radius: 4px;
                color: ${TORN.text};
                font-size: 16px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            #${CONFIG.HEADER_BUTTON_ID}:active {
                background: ${TORN.panelHover};
                border-color: ${TORN.green};
            }
            #${CONFIG.HEADER_BUTTON_ID} .hub-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                background: ${TORN.green};
                color: #000;
                font-size: 10px;
                font-weight: bold;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Hub Modal */
            #${CONFIG.MODAL_ID} {
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
            }
            #${CONFIG.MODAL_ID} .hub-modal-content {
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                width: 90%;
                max-width: 400px;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            #${CONFIG.MODAL_ID} .hub-modal-header {
                background: ${TORN.headerGradient};
                padding: 12px 16px;
                border-bottom: 1px solid ${TORN.border};
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #${CONFIG.MODAL_ID} .hub-modal-header h3 {
                margin: 0;
                color: #fff;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 0 0 2px rgba(0,0,0,0.8);
            }
            #${CONFIG.MODAL_ID} .hub-modal-close {
                background: transparent;
                border: none;
                color: ${TORN.textMuted};
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            #${CONFIG.MODAL_ID} .hub-modal-close:active {
                color: #fff;
            }
            #${CONFIG.MODAL_ID} .hub-script-list {
                padding: 8px 0;
                max-height: 60vh;
                overflow-y: auto;
            }
            #${CONFIG.MODAL_ID} .hub-script-item {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                cursor: pointer;
                transition: background 0.2s;
                border-bottom: 1px solid ${TORN.border};
            }
            #${CONFIG.MODAL_ID} .hub-script-item:last-child {
                border-bottom: none;
            }
            #${CONFIG.MODAL_ID} .hub-script-item:active {
                background: ${TORN.panelHover};
            }
            #${CONFIG.MODAL_ID} .hub-script-icon {
                font-size: 18px;
                margin-right: 12px;
                width: 24px;
                text-align: center;
            }
            #${CONFIG.MODAL_ID} .hub-script-info {
                flex: 1;
            }
            #${CONFIG.MODAL_ID} .hub-script-title {
                color: ${TORN.text};
                font-size: 13px;
                font-weight: bold;
            }
            #${CONFIG.MODAL_ID} .hub-script-arrow {
                color: ${TORN.textMuted};
                font-size: 14px;
            }
            #${CONFIG.MODAL_ID} .hub-empty-state {
                padding: 32px;
                text-align: center;
                color: ${TORN.textMuted};
                font-size: 13px;
            }
            #${CONFIG.MODAL_ID} .hub-footer {
                padding: 12px 16px;
                border-top: 1px solid ${TORN.border};
                text-align: center;
                color: ${TORN.textMuted};
                font-size: 11px;
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== HEADER BUTTON ====================

    function findHeaderMenuButton() {
        // Try multiple selectors for PDA/mobile header
        const selectors = [
            '.header-menu.left .header-menu-icon',
            '.header-menu-icon',
            '[class*="header-menu"] button',
            '.top_header_button.header-menu-icon'
        ];
        
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    function findOrCreateContainer() {
        // Look for existing container or header area
        let container = document.getElementById(CONFIG.HUB_CONTAINER_ID);
        if (container) return container;

        const headerMenuBtn = findHeaderMenuButton();
        if (!headerMenuBtn) return null;

        // Create container next to hamburger
        container = document.createElement('div');
        container.id = CONFIG.HUB_CONTAINER_ID;
        container.style.cssText = 'display: inline-flex; align-items: center;';

        // Insert after hamburger button's parent
        const headerMenu = headerMenuBtn.closest('.header-menu, [class*="header-menu"]');
        if (headerMenu) {
            headerMenu.insertAdjacentElement('afterend', container);
        } else {
            headerMenuBtn.insertAdjacentElement('afterend', container);
        }

        return container;
    }

    function createHubButton() {
        if (document.getElementById(CONFIG.HEADER_BUTTON_ID)) {
            return document.getElementById(CONFIG.HEADER_BUTTON_ID);
        }

        const container = findOrCreateContainer();
        if (!container) return null;

        const btn = document.createElement('button');
        btn.id = CONFIG.HEADER_BUTTON_ID;
        btn.innerHTML = `⚙️<span class="hub-badge" style="display:none">0</span>`;
        btn.setAttribute('aria-label', 'Userscript Settings');
        btn.addEventListener('click', openHubModal);

        container.appendChild(btn);
        return btn;
    }

    function updateBadge() {
        const btn = document.getElementById(CONFIG.HEADER_BUTTON_ID);
        if (!btn) return;

        const badge = btn.querySelector('.hub-badge');
        if (!badge) return;

        const count = registry.size;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ==================== MODAL ====================

    function openHubModal() {
        injectStyles();

        // Close existing modal
        closeHubModal();

        const modal = document.createElement('div');
        modal.id = CONFIG.MODAL_ID;
        modalRef = modal;

        // Sort scripts by order
        const scripts = Array.from(registry.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

        let scriptListHtml;
        if (scripts.length === 0) {
            scriptListHtml = `<div class="hub-empty-state">No userscripts registered</div>`;
        } else {
            scriptListHtml = `<div class="hub-script-list">` +
                scripts.map(script => `
                    <div class="hub-script-item" data-script-id="${script.id}">
                        <span class="hub-script-icon">${script.icon || '🔧'}</span>
                        <div class="hub-script-info">
                            <div class="hub-script-title">${script.title}</div>
                        </div>
                        <span class="hub-script-arrow">›</span>
                    </div>
                `).join('') +
            `</div>`;
        }

        modal.innerHTML = `
            <div class="hub-modal-content">
                <div class="hub-modal-header">
                    <h3>⚙️ Userscript Settings</h3>
                    <button class="hub-modal-close">×</button>
                </div>
                ${scriptListHtml}
                <div class="hub-footer">${scripts.length} script${scripts.length !== 1 ? 's' : ''} active</div>
            </div>
        `;

        // Close button
        modal.querySelector('.hub-modal-close').addEventListener('click', closeHubModal);

        // Click on overlay to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHubModal();
        });

        // Script item clicks
        modal.querySelectorAll('.hub-script-item').forEach(item => {
            item.addEventListener('click', () => {
                const scriptId = item.dataset.scriptId;
                const script = registry.get(scriptId);
                if (script && script.openSettings) {
                    closeHubModal();
                    script.openSettings();
                }
            });
        });

        document.body.appendChild(modal);
    }

    function closeHubModal() {
        if (modalRef) {
            modalRef.remove();
            modalRef = null;
        }
    }

    // ==================== POLLING ====================

    function pollForHeader() {
        const btn = createHubButton();
        if (btn) {
            updateBadge();
        }
    }

    function startPolling() {
        if (pollInterval) return;

        // Initial attempt
        pollForHeader();

        // Poll for header availability (PDA-safe)
        pollInterval = setInterval(pollForHeader, CONFIG.POLL_INTERVAL_MS);
    }

    // ==================== PUBLIC API ====================

    function register(scriptConfig) {
        if (!scriptConfig || !scriptConfig.id || !scriptConfig.title) {
            console.error('[TornPDASettingsHub] Invalid registration:', scriptConfig);
            return false;
        }

        registry.set(scriptConfig.id, {
            icon: '🔧',
            order: 100,
            ...scriptConfig
        });

        console.log('[TornPDASettingsHub] Registered:', scriptConfig.title);
        updateBadge();
        return true;
    }

    function unregister(scriptId) {
        const removed = registry.delete(scriptId);
        if (removed) {
            updateBadge();
        }
        return removed;
    }

    function isRegistered(scriptId) {
        return registry.has(scriptId);
    }

    // ==================== INITIALIZATION ====================

    function init() {
        if (hubInitialized) return;
        hubInitialized = true;

        // Expose global API
        window.TornPDASettingsHub = {
            register,
            unregister,
            isRegistered,
            version: '1.0.0'
        };

        // Start polling for header
        startPolling();

        console.log('[TornPDASettingsHub] Initialized. Scripts can now register via window.TornPDASettingsHub.register()');
    }

    // Start immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();