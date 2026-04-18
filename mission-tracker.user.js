// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      3.2.0
// @description  Track Torn missions with native Torn styling. Red alert for <24h, yellow for <48h.
// @author       Kevin (🦝⚙️)
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/-/raw/main/mission-tracker.user.js?ref_type=heads
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/-/raw/main/mission-tracker.user.js?ref_type=heads
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-end
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  🦝⚙️ Torn Mission Tracker v3.2.0                         ║
 * ║  Native Torn styling that blends with the site            ║
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
        bg: '#191919',
        panel: '#333',
        panelActive: '#444',
        text: '#ddd',
        textMuted: '#999',
        borderDark: '#222',
        borderLight: '#444',
        green: '#82c91e',
        blue: '#74c0fc',
        red: '#E54C19',
        yellow: '#F08C00',
        purple: '#B197FC',
        titleGradient: 'linear-gradient(180deg, #555 0%, #333 100%)',
        panelGradient: 'linear-gradient(180deg, #555 0%, #333 100%)'
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
            console.log('[🦝⚙️ Mission Tracker] No mission giver data found');
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
            /* 🦝⚙️ NATIVE TORN THEME v3.2                                  */
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
            
            #mission-modal-overlay {
                background: rgba(25, 25, 25, 0.95) !important;
            }
            
            #mission-tracker-settings > div > div {
                background: ${TORN.panel} !important;
                border: 1px solid ${TORN.borderLight} !important;
                border-radius: 4px !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
            }
            
            /* Torn-style title bar */
            #mission-tracker-settings h3 {
                background: ${TORN.titleGradient} !important;
                color: #fff !important;
                font-family: Arial, sans-serif !important;
                font-size: 14px;
                font-weight: bold;
                text-shadow: 0 0 2px rgba(0,0,0,0.8);
                padding: 10px 15px !important;
                margin: -25px -25px 15px -25px !important;
                border-bottom: 1px solid ${TORN.borderDark};
                border-radius: 4px 4px 0 0;
            }
            
            #mission-tracker-settings label {
                color: ${TORN.textMuted} !important;
                font-size: 12px;
                font-weight: bold;
            }
            
            /* Torn-style input */
            #api-key-input {
                background: linear-gradient(0deg, #111 0%, #000 100%) !important;
                border: 1px solid ${TORN.borderLight} !important;
                color: #fff !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 3px !important;
                padding: 8px !important;
            }
            
            #api-key-input:focus {
                border-color: ${TORN.blue} !important;
                box-shadow: 0 0 2px rgba(116, 192, 252, 0.6) !important;
                outline: none !important;
            }
            
            /* Info Panels - Torn panels */
            #mission-tracker-settings [style*="background: #1a1410"] {
                background: ${TORN.panel} !important;
                border: 1px solid ${TORN.borderLight} !important;
                border-radius: 3px !important;
            }
            
            #mission-tracker-settings [style*="color: #b87333"] {
                color: ${TORN.textMuted} !important;
            }
            
            #mission-tracker-settings [style*="color: #e8dcc4"] {
                color: ${TORN.text} !important;
            }
            
            #mission-tracker-settings [style*="color: #daa520"] {
                color: ${TORN.green} !important;
            }
            
            /* Links - Torn blue */
            #mission-tracker-settings a[href*="torn.com"] {
                color: ${TORN.blue} !important;
                text-decoration: none !important;
            }
            
            #mission-tracker-settings a[href*="torn.com"]:hover {
                color: #a5d8ff !important;
                text-decoration: underline !important;
            }
            
            /* Buttons - Torn native */
            #save-mission-settings {
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%) !important;
                border: 1px solid #111 !important;
                color: #eee !important;
                border-radius: 3px !important;
                font-family: Arial, sans-serif !important;
                font-weight: bold !important;
                text-shadow: 0 0 5px #000 !important;
                box-shadow: none !important;
            }
            
            #save-mission-settings:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%) !important;
                color: #fff !important;
                text-shadow: 0 0 5px rgba(255,255,255,0.25) !important;
            }
            
            #cancel-mission-settings {
                background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%) !important;
                border: 1px solid #111 !important;
                color: #eee !important;
                border-radius: 3px !important;
                font-family: Arial, sans-serif !important;
                font-weight: bold !important;
                text-shadow: 0 0 5px #000 !important;
            }
            
            #cancel-mission-settings:hover {
                background: linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%) !important;
                color: #fff !important;
            }
            
            /* Code Tags */
            #mission-tracker-settings code {
                background: ${TORN.bg} !important;
                border: 1px solid ${TORN.borderLight} !important;
                color: ${TORN.green} !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 2px !important;
                padding: 2px 5px !important;
            }
            
            /* Error Messages - Torn Red */
            #mission-tracker-settings [style*="color: #8b4513"] {
                color: ${TORN.red} !important;
            }
            
            /* Success/Green text */
            #mission-tracker-settings span[style*="color: #b8860b"] {
                color: ${TORN.green} !important;
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
        badgeElement.title = `[🦝⚙️] ${status.count} mission${status.count !== 1 ? 's' : ''} pending`;

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
                const selectionsHtml = isCustomKey ? userSelections.map(sel => {
                    const isMissions = sel === 'missions';
                    return `<span style="color: ${isMissions ? '#82c91e' : '#999'}; ${isMissions ? 'font-weight: bold;' : ''}">${sel}</span>`;
                }).join(', ') : '';

                keyInfoHtml = `
                    <div style="
                        background: #333;
                        border: 1px solid #444;
                        border-radius: 3px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                    ">
                        <div style="color: #999; margin-bottom: 8px; font-weight: bold;">API Key Info</div>
                        <div style="color: #ddd; margin-bottom: 5px;">
                            <span style="color: #999;">Access Type:</span> <span style="color: #82c91e; font-weight: bold;">${access.type || 'Unknown'}</span>
                        </div>
                        <div style="color: #ddd; margin-bottom: 5px;">
                            <span style="color: #999;">Access Level:</span> <span style="color: #82c91e; font-weight: bold;">${access.level ?? 'Unknown'}</span>
                        </div>
                        ${isCustomKey ? `
                            <div style="color: #999; margin-top: 10px; font-size: 11px;">
                                <strong>User Selections:</strong><br>
                                ${selectionsHtml}
                            </div>
                        ` : ''}
                        ${!userSelections.includes('missions') ? `
                            <div style="color: #E54C19; margin-top: 10px; font-size: 11px; font-weight: bold;">
                                ⚠ Critical: <code>missions</code> selection not detected
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {
                keyInfoHtml = `
                    <div style="
                        background: #333;
                        border: 1px solid #E54C19;
                        border-radius: 3px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        color: #E54C19;
                        font-weight: bold;
                    ">
                        ⚠ Connection Error: ${e.message}
                    </div>
                `;
            }
        }

        const modal = document.createElement('div');
        modal.id = 'mission-tracker-settings';
        modal.innerHTML = `
            <div id="mission-modal-overlay" style="
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    padding: 25px;
                    width: 420px;
                    max-width: 90%;
                ">
                    <h3 style="margin-top: 0;">⚙️ Mission Tracker — v3.2.0</h3>

                    <label style="display: block; margin: 15px 0 5px;">
                        API Key
                    </label>
                    <input type="password" id="api-key-input"
                           value="${apiKey}"
                           placeholder="Enter your API key..."
                           style="
                               width: 100%;
                               padding: 8px;
                               box-sizing: border-box;
                           ">

                    <div style="
                        background: #333;
                        border: 1px solid #444;
                        padding: 12px;
                        margin: 12px 0;
                        font-size: 11px;
                        border-radius: 3px;
                    ">
                        <div style="margin-bottom: 8px; color: #999; font-weight: bold;">Required Permissions</div>
                        <div style="margin-bottom: 5px; color: #ddd;">
                            <span style="color: #999;">Access Level:</span> <span style="color: #82c91e;">Limited</span>+
                        </div>
                        <div style="margin-bottom: 10px; color: #ddd;">
                            <span style="color: #999;">Required Selection:</span> <code>missions</code>
                        </div>
                        <a href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=MissionTracker&user=missions" target="_blank" style="
                            display: inline-block;
                            padding: 6px 12px;
                            background: linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%);
                            border: 1px solid #111;
                            color: #eee;
                            text-decoration: none;
                            border-radius: 3px;
                            font-weight: bold;
                            text-shadow: 0 0 5px #000;
                        ">Create New Key</a>
                    </div>

                    ${keyInfoHtml}

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button id="save-mission-settings" style="flex: 1; padding: 10px;">Save</button>
                        <button id="cancel-mission-settings" style="flex: 1; padding: 10px;">Cancel</button>
                    </div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #444; font-size: 10px; color: #999;">
                        [🔒] Key stored in local storage — No external servers
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
        modal.querySelector('#mission-modal-overlay').onclick = (e) => {
            if (e.target.id === 'mission-modal-overlay') modal.remove();
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
            console.log('[🦝⚙️ Mission Tracker]', status);
        } catch (error) {
            console.error('[🦝⚙️ Mission Tracker] Error:', error.message);
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        if (!apiKey) {
            console.log('[🦝⚙️ Mission Tracker] No API key. Awaiting key...');
            if (!GM_getValue('mission_tracker_notified', false)) {
                setTimeout(() => {
                    if (confirm('[🦝⚙️ Mission Tracker] No API key detected. Open settings?')) {
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

        console.log('[🦝⚙️ Mission Tracker] Mission Tracker initialized. Running v3.2.0');
    }

    GM_registerMenuCommand('[🦝⚙️] Settings', showSettings);
    GM_registerMenuCommand('[🦝⚙️] Force Refresh', () => refreshMissions(true));
    GM_registerMenuCommand('[🦝⚙️] Clear Cache', () => {
        Storage.clearCache();
        alert('[🦝⚙️] Cache cleared from storage.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();