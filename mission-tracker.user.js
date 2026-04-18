// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      3.1.0
// @description  Track Torn missions with steampunk brass & leather styling. Red alert for <24h, yellow for <48h.
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
 * ┌─────────────────────────────────────────────────────────┐
 * │  🦝⚙️ Kevin's Steampunk Mission Tracker v3.1.0          │
 * │  Brass gears & leather-bound mission tracking          │
 * │  for the distinguished Torn gentleman/lady              │
 * └─────────────────────────────────────────────────────────┘
 * 
 * Theme: Steampunk Raccoon
 * - Victorian industrial brass and leather aesthetic
 * - Warm brass (#b8860b) for accents
 * - Dark leather (#3d2817) backgrounds
 * - Copper (#b87333) and bronze (#cd7f32) details
 * - Sepia tones, serif fonts, ornate borders
 */

(function() {
    'use strict';

    // ─────────────────────────────────────────────────────────
    // CONFIGURATION
    // ─────────────────────────────────────────────────────────
    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000,
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48,
        requestComment: 'steampunk-mission-tracker-v3'
    };

    // Steampunk color palette
    const BRASS = {
        primary: '#b8860b',
        copper: '#b87333',
        bronze: '#cd7f32',
        leather: '#3d2817',
        sepia: '#704214',
        steam: '#e8dcc4',
        coal: '#1a1410',
        rust: '#8b4513',
        gold: '#daa520'
    };

    let badgeElement = null;
    let updateTimer = null;

    // ─────────────────────────────────────────────────────────
    // STORAGE
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // API CLIENT
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // MISSION PROCESSING
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // STYLES - Steampunk Raccoon Theme
    // ─────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('kevin-steampunk-styles')) return;

        GM_addStyle(`
            /* ───────────────────────────────────────────────────────── */
            /* 🦝⚙️ STEAMPUNK RACCOON THEME v3.1                          */
            /* ───────────────────────────────────────────────────────── */
            
            /* Mission Badge - Brass Gear */
            #torn-mission-badge {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                background: linear-gradient(145deg, ${BRASS.leather}, ${BRASS.coal});
                color: ${BRASS.steam};
                border: 2px solid ${BRASS.primary};
                border-radius: 50%;
                font-size: 11px;
                font-weight: 700;
                font-family: Georgia, 'Times New Roman', serif;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                box-shadow: 
                    0 2px 4px rgba(0,0,0,0.5),
                    inset 0 1px 2px rgba(184, 134, 11, 0.3);
                pointer-events: none;
                user-select: none;
            }
            
            /* Urgent - Rusted Brass */
            #torn-mission-badge.mission-urgent {
                color: ${BRASS.steam};
                border-color: ${BRASS.rust};
                background: linear-gradient(145deg, #5a1a0a, ${BRASS.coal});
                box-shadow: 
                    0 0 10px rgba(139, 69, 19, 0.6),
                    inset 0 1px 2px rgba(139, 69, 19, 0.4);
                animation: gear-tick 2s ease-in-out infinite;
            }
            
            /* Warning - Aged Copper */
            #torn-mission-badge.mission-warning {
                color: ${BRASS.steam};
                border-color: ${BRASS.copper};
                background: linear-gradient(145deg, ${BRASS.sepia}, ${BRASS.coal});
                box-shadow: 
                    0 2px 6px rgba(184, 115, 51, 0.4),
                    inset 0 1px 2px rgba(184, 115, 51, 0.2);
            }
            
            /* Gear Tick Animation */
            @keyframes gear-tick {
                0%, 100% { transform: translateY(-50%) rotate(0deg); }
                25% { transform: translateY(-50%) rotate(2deg); }
                75% { transform: translateY(-50%) rotate(-2deg); }
            }
            
            /* Mobile Override - Compact Brass */
            @media (max-width: 768px) {
                #torn-mission-badge {
                    right: 4px;
                    top: 4px;
                    transform: none;
                    width: 18px;
                    height: 18px;
                    font-size: 9px;
                    border-width: 1px;
                }
                #torn-mission-badge.mission-urgent {
                    animation: gear-tick-mobile 2s ease-in-out infinite;
                }
                @keyframes gear-tick-mobile {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(2deg); }
                    75% { transform: rotate(-2deg); }
                }
            }
            
            /* ───────────────────────────────────────────────────────── */
            /* SETTINGS MODAL - Victorian Leather Journal                  */
            /* ───────────────────────────────────────────────────────── */
            
            #mission-tracker-settings {
                font-family: Georgia, 'Times New Roman', serif;
            }
            
            #mission-modal-overlay {
                background: rgba(26, 20, 16, 0.95) !important;
            }
            
            #mission-tracker-settings > div > div {
                background: linear-gradient(145deg, ${BRASS.leather}, ${BRASS.coal}) !important;
                border: 3px solid ${BRASS.primary} !important;
                border-radius: 8px !important;
                box-shadow: 
                    0 8px 32px rgba(0,0,0,0.6),
                    inset 0 1px 1px rgba(184, 134, 11, 0.2) !important;
            }
            
            #mission-tracker-settings h3 {
                color: ${BRASS.primary} !important;
                font-family: Georgia, serif !important;
                font-style: italic;
                letter-spacing: 1px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                border-bottom: 2px solid ${BRASS.copper};
                padding-bottom: 12px;
            }
            
            #mission-tracker-settings label {
                color: ${BRASS.steam} !important;
                font-size: 12px;
                font-style: italic;
                letter-spacing: 0.5px;
            }
            
            #api-key-input {
                background: ${BRASS.coal} !important;
                border: 2px solid ${BRASS.copper} !important;
                color: ${BRASS.steam} !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 4px !important;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.5) !important;
            }
            
            #api-key-input:focus {
                border-color: ${BRASS.primary} !important;
                box-shadow: 0 0 8px rgba(184, 134, 11, 0.4), inset 0 2px 4px rgba(0,0,0,0.5) !important;
                outline: none !important;
            }
            
            /* Info Panels - Aged Paper */
            #mission-tracker-settings [style*="background: #0a0a0f"] {
                background: ${BRASS.coal} !important;
                border: 2px solid ${BRASS.sepia} !important;
                border-radius: 6px !important;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.5) !important;
            }
            
            #mission-tracker-settings [style*="color: #888"] {
                color: ${BRASS.copper} !important;
            }
            
            #mission-tracker-settings [style*="color: #fff"] {
                color: ${BRASS.steam} !important;
            }
            
            /* Links - Brass Rivets */
            #mission-tracker-settings a[href*="torn.com"] {
                color: ${BRASS.primary} !important;
                text-decoration: none !important;
                border-bottom: 1px dashed ${BRASS.copper};
                transition: all 0.2s;
            }
            
            #mission-tracker-settings a[href*="torn.com"]:hover {
                color: ${BRASS.gold} !important;
                border-bottom-color: ${BRASS.gold};
            }
            
            /* Buttons - Brass Machinery */
            #save-mission-settings {
                background: linear-gradient(145deg, ${BRASS.primary}, ${BRASS.bronze}) !important;
                border: 2px solid ${BRASS.gold} !important;
                color: ${BRASS.coal} !important;
                border-radius: 4px !important;
                font-family: Georgia, serif !important;
                font-weight: 700 !important;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
                transition: all 0.2s !important;
            }
            
            #save-mission-settings:hover {
                background: linear-gradient(145deg, ${BRASS.gold}, ${BRASS.primary}) !important;
                box-shadow: 0 6px 12px rgba(184, 134, 11, 0.4) !important;
                transform: translateY(-1px);
            }
            
            #cancel-mission-settings {
                background: ${BRASS.coal} !important;
                border: 2px solid ${BRASS.copper} !important;
                color: ${BRASS.steam} !important;
                border-radius: 4px !important;
                font-family: Georgia, serif !important;
                transition: all 0.2s !important;
            }
            
            #cancel-mission-settings:hover {
                border-color: ${BRASS.primary} !important;
                color: ${BRASS.primary} !important;
                box-shadow: 0 0 8px rgba(184, 134, 11, 0.3) !important;
            }
            
            /* Code Tags - Typewriter Keys */
            #mission-tracker-settings code {
                background: ${BRASS.coal} !important;
                border: 1px solid ${BRASS.copper} !important;
                color: ${BRASS.primary} !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 3px !important;
                padding: 2px 6px !important;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
            }
            
            /* Error Messages - Rust Warning */
            #mission-tracker-settings [style*="color: #e74c3c"] {
                color: ${BRASS.rust} !important;
                font-weight: bold;
            }
            
            /* Success/Green text override - Brass */
            #mission-tracker-settings span[style*="color: #2ecc71"] {
                color: ${BRASS.primary} !important;
                font-weight: bold;
            }
        `);
    }

    // ─────────────────────────────────────────────────────────
    // UI COMPONENTS
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // MUTATION OBSERVER
    // ─────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────
    // SETTINGS MODAL
    // ─────────────────────────────────────────────────────────
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
                    return `<span style="color: ${isMissions ? '#b8860b' : '#6b6b6b'}; ${isMissions ? 'font-weight: bold;' : ''}">${sel}</span>`;
                }).join(', ') : '';

                keyInfoHtml = `
                    <div style="
                        background: #1a1410;
                        border: 2px solid #704214;
                        border-radius: 6px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
                    ">
                        <div style="color: #b87333; margin-bottom: 8px; font-family: Georgia, serif; font-style: italic;"><strong>Apparatus Status</strong></div>
                        <div style="color: #e8dcc4; margin-bottom: 5px;">
                            <span style="color: #b87333;">Access Type:</span> <span style="color: #daa520; font-weight: bold;">${access.type || 'Unknown'}</span>
                        </div>
                        <div style="color: #e8dcc4; margin-bottom: 5px;">
                            <span style="color: #b87333;">Access Level:</span> <span style="color: #daa520; font-weight: bold;">${access.level ?? 'Unknown'}</span>
                        </div>
                        ${isCustomKey ? `
                            <div style="color: #b87333; margin-top: 10px; font-size: 11px; font-family: 'Courier New', monospace;">
                                <strong>Active Mechanisms:</strong><br>
                                ${selectionsHtml}
                            </div>
                        ` : ''}
                        ${!userSelections.includes('missions') ? `
                            <div style="color: #8b4513; margin-top: 10px; font-size: 11px; font-family: Georgia, serif; font-weight: bold;">
                                ⚠ Critical: <code>missions</code> mechanism not detected
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {
                keyInfoHtml = `
                    <div style="
                        background: #1a1410;
                        border: 2px solid #8b4513;
                        border-radius: 6px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        color: #8b4513;
                        font-family: Georgia, serif;
                        font-weight: bold;
                    ">
                        ⚠ Telegraph Failure: ${e.message}
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
                    <h3 style="margin-top: 0;">⚙️ Mission Tracker — v3.1.0</h3>

                    <label style="display: block; margin: 15px 0 5px;">
                        Telegraph Key
                    </label>
                    <input type="password" id="api-key-input"
                           value="${apiKey}"
                           placeholder="ENTER_KEY..."
                           style="
                               width: 100%;
                               padding: 10px;
                               box-sizing: border-box;
                           ">

                    <div style="
                        padding: 12px;
                        margin: 12px 0;
                        font-size: 11px;
                    ">
                        <div style="margin-bottom: 8px; font-family: Georgia, serif; font-style: italic; color: #b87333;"><strong>Required Mechanisms</strong></div>
                        <div style="margin-bottom: 5px; color: #e8dcc4;">
                            <span style="color: #b87333;">Access Level:</span> <span style="color: #daa520;">Limited</span>+
                        </div>
                        <div style="margin-bottom: 10px; color: #e8dcc4;">
                            <span style="color: #b87333;">Required Gear:</span> <code>missions</code>
                        </div>
                        <a href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=MissionTracker&user=missions" target="_blank" style="
                            display: inline-block;
                            padding: 8px 16px;
                            font-family: Georgia, serif;
                            font-size: 11px;
                            font-style: italic;
                        ">[ Forge New Key ]</a>
                    </div>

                    ${keyInfoHtml}

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button id="save-mission-settings" style="flex: 1; padding: 12px;">Engage</button>
                        <button id="cancel-mission-settings" style="flex: 1; padding: 12px;">Dismiss</button>
                    </div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #704214; font-size: 10px; color: #b87333; font-family: Georgia, serif; font-style: italic;">
                        [🔒] Key secured in local brass lockbox — No telegraph transmissions
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#cancel-mission-settings').onclick = () => modal.remove();
        modal.querySelector('#save-mission-settings').onclick = () => {
            const key = modal.querySelector('#api-key-input').value.trim();
            if (!key) {
                alert('Please enter a telegraph key.');
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

    // ─────────────────────────────────────────────────────────
    // MAIN
    // ─────────────────────────────────────────────────────────
    async function refreshMissions(force = false) {
        try {
            if (force) Storage.clearCache();
            const missions = await TornAPI.fetchMissions();
            const status = processMissions(missions);
            updateBadge(status);
            console.log('[🦝⚙️ Mission Tracker]', status);
        } catch (error) {
            console.error('[🦝⚙️ Mission Tracker] Malfunction:', error.message);
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        if (!apiKey) {
            console.log('[🦝⚙️ Mission Tracker] No telegraph key. Awaiting authentication...');
            if (!GM_getValue('mission_tracker_notified', false)) {
                setTimeout(() => {
                    if (confirm('[🦝⚙️ Mission Tracker] No telegraph key detected. Open settings?')) {
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

        console.log('[🦝⚙️ Mission Tracker] Steam apparatus online. Running Mission Tracker v3.1.0');
    }

    GM_registerMenuCommand('[🦝⚙️] Apparatus Settings', showSettings);
    GM_registerMenuCommand('[🦝⚙️] Force Recalibration', () => refreshMissions(true));
    GM_registerMenuCommand('[🦝⚙️] Purge Cache', () => {
        Storage.clearCache();
        alert('[🦝⚙️] Cache purged from brass cylinders.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();