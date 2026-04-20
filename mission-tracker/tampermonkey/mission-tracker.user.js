// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      3.2.4
// @description  Track Torn missions with native Torn styling. Red alert for <24h, yellow for <48h.
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/tampermonkey/mission-tracker.meta.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/tampermonkey/mission-tracker.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-end
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn Mission Tracker v3.2.4                            ║
 * ║  Native Torn styling that blends with the site          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000,
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48,
        requestComment: 'torn-mission-tracker-v3'
    };

    // Torn's native color palette (from CSS vars)
    const TORN = {
        bg: '#444',
        panel: '#333',
        panelActive: '#555',
        text: '#ddd',
        textMuted: '#999',
        borderDark: '#333',
        borderLight: '#444',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)',
        green: '#82c91e',
        blue: '#74c0fc',
        red: '#E54C19',
        yellow: '#F08C00',
        purple: '#B197FC',
        titleGradient: 'linear-gradient(180deg, #777 0%, #333 100%)',
        panelGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
    };

    let badgeElement = null;
    let updateTimer = null;

    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════
    const Storage = {
        getKey: () => GM_getValue('torn_api_key', ''),
        setKey: (key) => GM_setValue('torn_api_key', key),

        getCache: (key) => {
            const data = GM_getValue(`cache_${key}`, null);
            const time = GM_getValue(`cache_${key}_time`, 0);
            if (!data || (Date.now() - time) > CONFIG.cacheTtlMinutes * 60000) return null;
            return JSON.parse(data);
        },

        setCache: (key, data) => {
            GM_setValue(`cache_${key}`, JSON.stringify(data));
            GM_setValue(`cache_${key}_time`, Date.now());
        },

        clearCache: () => {
            GM_deleteValue('cache_missions');
            GM_deleteValue('cache_missions_time');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // API CLIENT
    // ═══════════════════════════════════════════════════════════
    function buildApiUrl(path, query = {}) {
        const url = new URL(`${CONFIG.apiBaseUrl}${path}`);
        const key = Storage.getKey();
        if (key) url.searchParams.set('key', key);
        url.searchParams.set('comment', CONFIG.requestComment);

        for (const [name, value] of Object.entries(query)) {
            if (value === undefined || value === null || value === '') continue;
            if (Array.isArray(value)) {
                value.forEach(entry => url.searchParams.append(name, entry));
            } else {
                url.searchParams.set(name, value);
            }
        }
        return url.toString();
    }

    const TornAPI = {
        request: (path, query = {}) => {
            const key = Storage.getKey();
            if (!key) return Promise.reject(new Error('No API key configured'));

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: buildApiUrl(path, query),
                    headers: { 'Accept': 'application/json' },
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) reject(new Error(`API Error ${data.error.code}: ${data.error.error}`));
                            else resolve(data);
                        } catch {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        },

        fetchKeyInfo: () => TornAPI.request('/key/info'),

        fetchMissions: () => {
            const cached = Storage.getCache('missions');
            if (cached) return Promise.resolve(cached);

            return TornAPI.request('/user/missions').then((data) => {
                Storage.setCache('missions', data.missions);
                return data.missions;
            });
        }
    };

    // ═══════════════════════════════════════════════════════════
    // MISSION PROCESSING
    // ═══════════════════════════════════════════════════════════
    function processMissions(missionsPayload) {
        const givers = missionsPayload?.givers;
        if (!Array.isArray(givers)) {
            console.log('[Mission Tracker] No mission giver data found');
            return { count: 0, urgent: false, warning: false };
        }

        const now = Date.now() / 1000;
        let incompleteCount = 0;
        let hasUrgent = false;
        let hasWarning = false;

        for (const giver of givers) {
            const contracts = Array.isArray(giver?.contracts) ? giver.contracts : [];

            for (const mission of contracts) {
                const status = mission?.status;
                const isIncomplete = status === 'Accepted' || status === 'Available';
                if (!isIncomplete) continue;

                incompleteCount++;

                if (status === 'Accepted' && typeof mission.expires_at === 'number') {
                    const hoursRemaining = (mission.expires_at - now) / 3600;
                    if (hoursRemaining > 0 && hoursRemaining <= CONFIG.urgentHours) {
                        hasUrgent = true;
                    } else if (hoursRemaining > 0 && hoursRemaining <= CONFIG.warningHours) {
                        hasWarning = true;
                    }
                }
            }
        }

        return {
            count: incompleteCount,
            urgent: hasUrgent,
            warning: hasWarning && !hasUrgent
        };
    }

    // ═══════════════════════════════════════════════════════════
    // STYLES - Native Torn Theme
    // ═══════════════════════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('torn-native-styles')) return;

        GM_addStyle(`
            /* ═══════════════════════════════════════════════════════════ */
            /* NATIVE TORN THEME v3.2                                       */
            /* ═══════════════════════════════════════════════════════════ */
            
            /* Mission Badge - Torn Native */
            #torn-mission-badge {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                background: ${TORN.panel};
                color: ${TORN.text};
                border: 1px solid ${TORN.borderLight};
                border-radius: 3px;
                font-size: 11px;
                font-weight: 700;
                font-family: Arial, sans-serif;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                box-shadow: 0 1px 2px rgba(0,0,0,0.5);
                pointer-events: none;
                user-select: none;
            }
            
            /* Urgent - Torn Red */
            #torn-mission-badge.mission-urgent {
                color: #fff;
                border-color: ${TORN.red};
                background: ${TORN.red};
                box-shadow: 0 0 8px rgba(229, 76, 25, 0.6);
            }
            
            /* Warning - Torn Yellow/Orange */
            #torn-mission-badge.mission-warning {
                color: #000;
                border-color: ${TORN.yellow};
                background: ${TORN.yellow};
                box-shadow: 0 0 6px rgba(240, 140, 0, 0.5);
            }
            
            /* Mobile Override */
            @media (max-width: 768px) {
                #torn-mission-badge {
                    right: 6px;
                    top: 6px;
                    transform: none;
                    width: 14px;
                    height: 14px;
                    font-size: 8px;
                }
            }
            
            /* ═══════════════════════════════════════════════════════════ */
            /* SETTINGS MODAL - Native Torn Panels                          */
            /* ═══════════════════════════════════════════════════════════ */

            #mission-tracker-settings {
                font-family: Arial, sans-serif;
            }

            #mission-tracker-settings .mt-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.85);
            }

            #mission-tracker-settings .mt-panel {
                width: 420px;
                max-width: 90%;
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                color: ${TORN.text};
                overflow: hidden;
            }

            #mission-tracker-settings .mt-header {
                background: ${TORN.headerGradient};
                color: #fff;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
                padding: 12px 16px;
                border-bottom: 1px solid ${TORN.borderDark};
            }

            #mission-tracker-settings .mt-body {
                padding: 16px;
            }

            #mission-tracker-settings .mt-field {
                margin-bottom: 16px;
            }

            #mission-tracker-settings .mt-field label {
                display: block;
                margin-bottom: 6px;
                color: ${TORN.textMuted};
                font-size: 12px;
                font-weight: bold;
            }

            #mission-tracker-settings .mt-input {
                width: 100%;
                padding: 8px 12px;
                box-sizing: border-box;
                background: linear-gradient(0deg, #111 0%, #000 100%);
                border: 1px solid ${TORN.borderLight};
                color: #fff;
                font-family: 'Courier New', monospace;
                border-radius: 3px;
            }

            #mission-tracker-settings .mt-input:focus {
                border-color: ${TORN.blue};
                box-shadow: 0 0 2px rgba(116, 192, 252, 0.6);
                outline: none;
            }

            #mission-tracker-settings .mt-card {
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 3px;
                padding: 12px;
                margin: 12px 0;
                font-size: 12px;
            }

            #mission-tracker-settings .mt-card-title {
                margin-bottom: 8px;
                color: ${TORN.textMuted};
                font-weight: bold;
                font-size: 12px;
            }

            #mission-tracker-settings .mt-row {
                margin-bottom: 5px;
                color: ${TORN.text};
            }

            #mission-tracker-settings .mt-muted {
                color: ${TORN.textMuted};
            }

            #mission-tracker-settings .mt-good {
                color: ${TORN.green};
                font-weight: bold;
            }

            #mission-tracker-settings .mt-error {
                color: ${TORN.red};
                font-weight: bold;
            }

            #mission-tracker-settings .mt-selections {
                margin-top: 10px;
                font-size: 11px;
                color: ${TORN.textMuted};
            }

            #mission-tracker-settings .mt-actions {
                margin-top: 20px;
                display: flex;
                gap: 10px;
            }

            #mission-tracker-settings .mt-actions button,
            #mission-tracker-settings .mt-link-button {
                flex: 1;
                display: inline-block;
                padding: 10px 12px;
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%);
                border: 1px solid #111;
                color: #eee;
                text-decoration: none;
                border-radius: 3px;
                font-family: Arial, sans-serif;
                font-weight: bold;
                font-size: 13px;
                text-align: center;
                text-shadow: 0 0 5px #000;
                cursor: pointer;
                box-sizing: border-box;
            }

            #mission-tracker-settings .mt-actions button:hover,
            #mission-tracker-settings .mt-link-button:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%);
                color: #fff;
            }

            #mission-tracker-settings .mt-primary {
                border-color: ${TORN.green};
            }

            #mission-tracker-settings .mt-link-button {
                margin-top: 10px;
            }

            #mission-tracker-settings code {
                background: ${TORN.bg};
                border: 1px solid ${TORN.borderLight};
                color: ${TORN.green};
                font-family: 'Courier New', monospace;
                border-radius: 2px;
                padding: 2px 5px;
            }

            #mission-tracker-settings .mt-footer-note {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid ${TORN.border};
                font-size: 10px;
                color: ${TORN.textMuted};
            }
        `);
    }

    // ═══════════════════════════════════════════════════════════
    // UI COMPONENTS
    // ═══════════════════════════════════════════════════════════
    function createBadge() {
        if (badgeElement) return;

        const missionsNav = document.getElementById('nav-missions');
        if (!missionsNav) return;

        badgeElement = document.createElement('span');
        badgeElement.id = 'torn-mission-badge';

        const areaRow = missionsNav.querySelector('.area-row___iBD8N');
        if (areaRow) {
            areaRow.appendChild(badgeElement);
        }
    }

    function updateBadge(status) {
        if (!badgeElement) createBadge();
        if (!badgeElement) return;

        injectStyles();

        if (status.count === 0) {
            badgeElement.style.display = 'none';
            return;
        }

        badgeElement.style.display = 'inline-flex';
        badgeElement.textContent = status.count;
        badgeElement.title = `${status.count} mission${status.count !== 1 ? 's' : ''} pending`;

        badgeElement.classList.remove('mission-urgent', 'mission-warning');

        if (status.urgent) {
            badgeElement.classList.add('mission-urgent');
        } else if (status.warning) {
            badgeElement.classList.add('mission-warning');
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MUTATION OBSERVER
    // ═══════════════════════════════════════════════════════════
    function setupMutationObserver() {
        const observer = new MutationObserver(() => {
            const existingBadge = document.getElementById('torn-mission-badge');
            const missionsNav = document.getElementById('nav-missions');

            if (!existingBadge || (missionsNav && !missionsNav.querySelector('.area-row___iBD8N #torn-mission-badge'))) {
                if (existingBadge) existingBadge.remove();
                badgeElement = null;
                createBadge();
                const cached = Storage.getCache('missions');
                if (cached) {
                    const status = processMissions(cached);
                    updateBadge(status);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ═══════════════════════════════════════════════════════════
    // SETTINGS MODAL
    // ═══════════════════════════════════════════════════════════
    async function showSettings() {
        const existing = document.getElementById('mission-tracker-settings');
        if (existing) existing.remove();

        let keyInfoHtml = '';
        const apiKey = Storage.getKey();
        if (apiKey) {
            try {
                const keyInfo = await TornAPI.fetchKeyInfo();
                const info = keyInfo.info || {};
                const access = info.access || {};
                const userSelections = Array.isArray(info.selections?.user) ? info.selections.user : [];

                const isCustomKey = userSelections.length > 0;
                const selectionsHtml = isCustomKey ? userSelections.map((selection) => {
                    const isMissions = selection === 'missions';
                    return `<span class="${isMissions ? 'mt-good' : 'mt-muted'}">${selection}</span>`;
                }).join(', ') : '';

                keyInfoHtml = `
                    <div class="mt-card">
                        <div class="mt-card-title">API Key Info</div>
                        <div class="mt-row">
                            <span class="mt-muted">Access Type:</span> <span class="mt-good">${access.type || 'Unknown'}</span>
                        </div>
                        <div class="mt-row">
                            <span class="mt-muted">Access Level:</span> <span class="mt-good">${access.level ?? 'Unknown'}</span>
                        </div>
                        ${isCustomKey ? `
                            <div class="mt-selections">
                                <strong>User Selections:</strong><br>
                                ${selectionsHtml}
                            </div>
                        ` : ''}
                        ${!userSelections.includes('missions') ? `
                            <div class="mt-error" style="margin-top: 10px; font-size: 11px;">
                                ⚠ Critical: <code>missions</code> selection not detected
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {
                keyInfoHtml = `
                    <div class="mt-card" style="border-color: ${TORN.red};">
                        <div class="mt-error">⚠ Connection Error: ${e.message}</div>
                    </div>
                `;
            }
        }

        const modal = document.createElement('div');
        modal.id = 'mission-tracker-settings';
        modal.innerHTML = `
            <div class="mt-overlay">
                <div class="mt-panel">
                    <div class="mt-header">⚙️ Mission Tracker Settings</div>
                    <div class="mt-body">
                        <div class="mt-field">
                            <label for="api-key-input">API Key</label>
                            <input type="password" id="api-key-input" class="mt-input"
                                   value="${apiKey}"
                                   placeholder="Enter your API key...">
                        </div>

                        <div class="mt-card">
                            <div class="mt-card-title">Required Permissions</div>
                            <div class="mt-row">
                                <span class="mt-muted">Access Level:</span> <span class="mt-good">Limited</span>+
                            </div>
                            <div class="mt-row">
                                <span class="mt-muted">Required Selection:</span> <code>missions</code>
                            </div>
                            <a class="mt-link-button" href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=MissionTracker&user=missions" target="_blank">Create New Key</a>
                        </div>

                        ${keyInfoHtml}

                        <div class="mt-actions">
                            <button id="save-mission-settings" class="mt-primary">Save</button>
                            <button id="cancel-mission-settings">Cancel</button>
                        </div>

                        <div class="mt-footer-note">
                            [🔒] Key stored in local storage, no external servers
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#cancel-mission-settings').onclick = () => modal.remove();
        modal.querySelector('#save-mission-settings').onclick = () => {
            const key = modal.querySelector('#api-key-input').value.trim();
            if (!key) {
                alert('Please enter an API key.');
                return;
            }
            Storage.setKey(key);
            modal.remove();
            refreshMissions(true);
        };
        modal.querySelector('.mt-overlay').onclick = (e) => {
            if (e.target.classList.contains('mt-overlay')) modal.remove();
        };
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN
    // ═══════════════════════════════════════════════════════════
    async function refreshMissions(force = false) {
        try {
            if (force) Storage.clearCache();
            const missions = await TornAPI.fetchMissions();
            const status = processMissions(missions);
            updateBadge(status);
            console.log('[Mission Tracker]', status);
        } catch (error) {
            console.error('[Mission Tracker] Error:', error.message);
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        if (!apiKey) {
            console.log('[Mission Tracker] No API key. Awaiting key...');
            if (!GM_getValue('mission_tracker_notified', false)) {
                setTimeout(() => {
                    if (confirm('[Mission Tracker] No API key detected. Open settings?')) {
                        showSettings();
                    }
                    GM_setValue('mission_tracker_notified', true);
                }, 2000);
            }
            return;
        }

        refreshMissions();

        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => refreshMissions(), CONFIG.updateInterval);

        setupMutationObserver();

        console.log('[Mission Tracker] Mission Tracker initialized. Running v3.2.4');
    }

    GM_registerMenuCommand('Settings', showSettings);
    GM_registerMenuCommand('Force Refresh', () => refreshMissions(true));
    GM_registerMenuCommand('Clear Cache', () => {
        Storage.clearCache();
        alert('Cache cleared from storage.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();