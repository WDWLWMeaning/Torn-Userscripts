// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      3.0.0
// @description  Track Torn missions with cyberpunk neon styling. Red alert for <24h, yellow for <48h.
// @author       Kevin (🦝)
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
 * ║  🦝 KEvin's Cyberpunk Mission Tracker v3.0.0              ║
 * ║  Neon-lit mission tracking for the shadows of Torn City   ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Theme: Cyberpunk Raccoon
 * - Dark terminal aesthetic with neon accents
 * - Hot pink (#ff006e) for urgent alerts
 * - Cyan (#00f5d4) for system info
 * - Purple (#8338ec) for depth
 * - Monospace fonts, glowing effects, sharp edges
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000, // 5 minutes
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48,
        requestComment: 'cyberpunk-mission-tracker-v3'
    };

    // Cyberpunk color palette
    const NEON = {
        pink: '#ff006e',
        cyan: '#00f5d4',
        purple: '#8338ec',
        yellow: '#ffbe0b',
        dark: '#0a0a0f',
        panel: '#12121a',
        border: '#1e1e2e',
        text: '#e0e0e0',
        textDim: '#6b6b8a'
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
            console.log('[🦝 Mission Tracker] No mission giver data found');
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
    // STYLES - Cyberpunk Raccoon Theme
    // ═══════════════════════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('kevin-cyberpunk-styles')) return;

        GM_addStyle(`
            /* ═══════════════════════════════════════════════════════════ */
            /* 🦝 CYBERPUNK RACCOON THEME v3.0                              */
            /* ═══════════════════════════════════════════════════════════ */
            
            /* Mission Badge - Neon Core */
            #torn-mission-badge {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                background: ${NEON.dark};
                color: ${NEON.cyan};
                border: 1px solid ${NEON.cyan};
                border-radius: 4px;
                font-size: 11px;
                font-weight: 700;
                font-family: 'Courier New', 'Consolas', monospace;
                text-shadow: 0 0 5px ${NEON.cyan};
                box-shadow: 0 0 10px rgba(0, 245, 212, 0.3), inset 0 0 5px rgba(0, 245, 212, 0.1);
                pointer-events: none;
                user-select: none;
                letter-spacing: 0.5px;
            }
            
            /* Urgent - Hot Pink Neon */
            #torn-mission-badge.mission-urgent {
                color: ${NEON.pink};
                border-color: ${NEON.pink};
                text-shadow: 0 0 8px ${NEON.pink}, 0 0 15px ${NEON.pink};
                box-shadow: 0 0 15px rgba(255, 0, 110, 0.5), inset 0 0 8px rgba(255, 0, 110, 0.2);
                animation: neon-pulse 1.5s ease-in-out infinite;
            }
            
            /* Warning - Yellow Neon */
            #torn-mission-badge.mission-warning {
                color: ${NEON.yellow};
                border-color: ${NEON.yellow};
                text-shadow: 0 0 5px ${NEON.yellow};
                box-shadow: 0 0 10px rgba(255, 190, 11, 0.4), inset 0 0 5px rgba(255, 190, 11, 0.1);
            }
            
            /* Neon Pulse Animation */
            @keyframes neon-pulse {
                0%, 100% { 
                    box-shadow: 0 0 15px rgba(255, 0, 110, 0.5), inset 0 0 8px rgba(255, 0, 110, 0.2);
                    transform: translateY(-50%) scale(1);
                }
                50% { 
                    box-shadow: 0 0 25px rgba(255, 0, 110, 0.8), inset 0 0 12px rgba(255, 0, 110, 0.3);
                    transform: translateY(-50%) scale(1.05);
                }
            }
            
            /* Mobile Override - Compact Neon */
            @media (max-width: 768px) {
                #torn-mission-badge {
                    right: 6px;
                    top: 6px;
                    transform: none;
                    width: 16px;
                    height: 16px;
                    font-size: 9px;
                    border-radius: 3px;
                }
                #torn-mission-badge.mission-urgent {
                    animation: neon-pulse-mobile 1.5s ease-in-out infinite;
                }
                @keyframes neon-pulse-mobile {
                    0%, 100% { box-shadow: 0 0 10px rgba(255, 0, 110, 0.5); transform: scale(1); }
                    50% { box-shadow: 0 0 18px rgba(255, 0, 110, 0.8); transform: scale(1.05); }
                }
            }
            
            /* ═══════════════════════════════════════════════════════════ */
            /* SETTINGS MODAL - Cyberpunk Terminal                          */
            /* ═══════════════════════════════════════════════════════════ */
            
            #mission-tracker-settings {
                font-family: 'Segoe UI', Tahoma, sans-serif;
            }
            
            #mission-modal-overlay {
                background: rgba(10, 10, 15, 0.95) !important;
                backdrop-filter: blur(5px);
            }
            
            #mission-tracker-settings > div > div {
                background: ${NEON.panel} !important;
                border: 1px solid ${NEON.border} !important;
                border-radius: 8px !important;
                box-shadow: 0 0 30px rgba(131, 56, 236, 0.3), 0 10px 40px rgba(0,0,0,0.5) !important;
            }
            
            #mission-tracker-settings h3 {
                color: ${NEON.cyan} !important;
                font-family: 'Courier New', monospace !important;
                text-transform: uppercase;
                letter-spacing: 2px;
                text-shadow: 0 0 10px ${NEON.cyan};
                border-bottom: 1px solid ${NEON.border};
                padding-bottom: 12px;
            }
            
            #mission-tracker-settings label {
                color: ${NEON.textDim} !important;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            #api-key-input {
                background: ${NEON.dark} !important;
                border: 1px solid ${NEON.border} !important;
                color: ${NEON.cyan} !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 4px !important;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.5) !important;
            }
            
            #api-key-input:focus {
                border-color: ${NEON.cyan} !important;
                box-shadow: 0 0 10px rgba(0, 245, 212, 0.3), inset 0 2px 4px rgba(0,0,0,0.5) !important;
                outline: none !important;
            }
            
            /* Info Panels */
            #mission-tracker-settings [style*="background: #16213e"] {
                background: ${NEON.dark} !important;
                border: 1px solid ${NEON.border} !important;
                border-radius: 6px !important;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.5) !important;
            }
            
            #mission-tracker-settings [style*="color: #888"] {
                color: ${NEON.textDim} !important;
            }
            
            #mission-tracker-settings [style*="color: #fff"] {
                color: ${NEON.text} !important;
            }
            
            /* Links */
            #mission-tracker-settings a[href*="torn.com"] {
                color: ${NEON.cyan} !important;
                text-decoration: none !important;
                border-bottom: 1px dashed ${NEON.cyan};
                transition: all 0.2s;
            }
            
            #mission-tracker-settings a[href*="torn.com"]:hover {
                color: ${NEON.pink} !important;
                border-bottom-color: ${NEON.pink};
                text-shadow: 0 0 8px ${NEON.pink};
            }
            
            /* Buttons - Neon Glow */
            #save-mission-settings {
                background: linear-gradient(135deg, ${NEON.pink}, #d9005c) !important;
                border: none !important;
                border-radius: 4px !important;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: 700 !important;
                box-shadow: 0 4px 15px rgba(255, 0, 110, 0.4) !important;
                transition: all 0.2s !important;
            }
            
            #save-mission-settings:hover {
                box-shadow: 0 6px 20px rgba(255, 0, 110, 0.6) !important;
                transform: translateY(-1px);
            }
            
            #cancel-mission-settings {
                background: ${NEON.dark} !important;
                border: 1px solid ${NEON.border} !important;
                color: ${NEON.textDim} !important;
                border-radius: 4px !important;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.2s !important;
            }
            
            #cancel-mission-settings:hover {
                border-color: ${NEON.cyan} !important;
                color: ${NEON.cyan} !important;
                box-shadow: 0 0 10px rgba(0, 245, 212, 0.3) !important;
            }
            
            /* Code Tags */
            #mission-tracker-settings code {
                background: ${NEON.dark} !important;
                border: 1px solid ${NEON.border} !important;
                color: ${NEON.cyan} !important;
                font-family: 'Courier New', monospace !important;
                border-radius: 3px !important;
                padding: 2px 6px !important;
            }
            
            /* Error Messages */
            #mission-tracker-settings [style*="color: #e74c3c"] {
                color: ${NEON.pink} !important;
                text-shadow: 0 0 5px rgba(255, 0, 110, 0.5);
            }
            
            /* Success/Green text override */
            #mission-tracker-settings span[style*="color: #2ecc71"] {
                color: ${NEON.cyan} !important;
                text-shadow: 0 0 5px rgba(0, 245, 212, 0.5);
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
        badgeElement.title = `[🦝] ${status.count} mission${status.count !== 1 ? 's' : ''} pending`;

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
                    return `<span style="color: ${isMissions ? '#00f5d4' : '#6b6b8a'}; ${isMissions ? 'font-weight: bold; text-shadow: 0 0 5px rgba(0,245,212,0.5);' : ''}">${sel}</span>`;
                }).join(', ') : '';

                keyInfoHtml = `
                    <div style="
                        background: #0a0a0f;
                        border: 1px solid #1e1e2e;
                        border-radius: 6px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
                    ">
                        <div style="color: #6b6b8a; margin-bottom: 8px; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 1px;"><strong>› System Status</strong></div>
                        <div style="color: #e0e0e0; margin-bottom: 5px;">
                            <span style="color: #6b6b8a;">Access Type:</span> <span style="color: #00f5d4; text-shadow: 0 0 5px rgba(0,245,212,0.5);">${access.type || 'Unknown'}</span>
                        </div>
                        <div style="color: #e0e0e0; margin-bottom: 5px;">
                            <span style="color: #6b6b8a;">Access Level:</span> <span style="color: #00f5d4; text-shadow: 0 0 5px rgba(0,245,212,0.5);">${access.level ?? 'Unknown'}</span>
                        </div>
                        ${isCustomKey ? `
                            <div style="color: #6b6b8a; margin-top: 10px; font-size: 11px; font-family: 'Courier New', monospace;">
                                <span style="text-transform: uppercase; letter-spacing: 1px;">› Active Modules</span><br>
                                ${selectionsHtml}
                            </div>
                        ` : ''}
                        ${!userSelections.includes('missions') ? `
                            <div style="color: #ff006e; margin-top: 10px; font-size: 11px; font-family: 'Courier New', monospace; text-shadow: 0 0 5px rgba(255,0,110,0.5);">
                                ⚠ CRITICAL: <code>missions</code> module not detected
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {
                keyInfoHtml = `
                    <div style="
                        background: #0a0a0f;
                        border: 1px solid #ff006e;
                        border-radius: 6px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        color: #ff006e;
                        font-family: 'Courier New', monospace;
                        text-shadow: 0 0 5px rgba(255,0,110,0.5);
                    ">
                        ⚠ CONNECTION ERROR: ${e.message}
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
                    <h3 style="margin-top: 0;">⚙️ Mission Tracker // v3.0.0</h3>

                    <label style="display: block; margin: 15px 0 5px;">
                        › API Key
                    </label>
                    <input type="password" id="api-key-input"
                           value="${apiKey}"
                           placeholder="ENTER_API_KEY..."
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
                        <div style="margin-bottom: 8px; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 1px;"><strong>› Required Permissions</strong></div>
                        <div style="margin-bottom: 5px;">
                            <span style="color: #6b6b8a;">Access Level:</span> <span style="color: #00f5d4;">Limited</span>+
                        </div>
                        <div style="margin-bottom: 10px;">
                            <span style="color: #6b6b8a;">Required Module:</span> <code>missions</code>
                        </div>
                        <a href="https://www.torn.com/preferences.php#tab=api?step=addNewKey&title=MissionTracker&user=missions" target="_blank" style="
                            display: inline-block;
                            padding: 8px 16px;
                            font-family: 'Courier New', monospace;
                            font-size: 10px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        ">[ Initialize New Key ]</a>
                    </div>

                    ${keyInfoHtml}

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button id="save-mission-settings" style="flex: 1; padding: 12px;">Execute</button>
                        <button id="cancel-mission-settings" style="flex: 1; padding: 12px;">Abort</button>
                    </div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1e1e2e; font-size: 10px; color: #6b6b8a; font-family: 'Courier New', monospace;">
                        [🔒] Key stored locally // No external telemetry
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
            console.log('[🦝 Mission Tracker]', status);
        } catch (error) {
            console.error('[🦝 Mission Tracker] Error:', error.message);
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        if (!apiKey) {
            console.log('[🦝 Mission Tracker] No API key. Awaiting initialization...');
            if (!GM_getValue('mission_tracker_notified', false)) {
                setTimeout(() => {
                    if (confirm('[🦝 Mission Tracker] No API key detected. Open settings?')) {
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

        console.log('[🦝 Mission Tracker] System online. Running Mission Tracker v3.0.0');
    }

    GM_registerMenuCommand('[🦝] System Settings', showSettings);
    GM_registerMenuCommand('[🦝] Force Refresh', () => refreshMissions(true));
    GM_registerMenuCommand('[🦝] Purge Cache', () => {
        Storage.clearCache();
        alert('[🦝] Cache purged.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();