// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      2.0.2
// @description  Track Torn missions with urgency indicators (red <24h, yellow <48h) via the Torn API v2
// @author       Kevin
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
 * Torn Mission Tracker
 *
 * Shows a badge with the count of incomplete missions.
 * - Red badge: At least one accepted mission has <24 hours remaining
 * - Yellow badge: At least one accepted mission has <48 hours remaining (but none <24h)
 * - Hidden: All missions are completed/failed
 *
 * Updates every 5 minutes with caching to respect API rate limits.
 */

(function() {
    'use strict';

    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000,
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48,
        requestComment: 'torn-mission-tracker'
    };

    let bubbleElement = null;
    let updateTimer = null;

    const Storage = {
        getKey: () => GM_getValue('torn_api_key', ''),
        setKey: (key) => GM_setValue('torn_api_key', key),

        getCache: (key) => {
            const data = GM_getValue(`cache_${key}`, null);
            const time = GM_getValue(`cache_${key}_time`, 0);
            if (!data || (Date.now() - time) > CONFIG.cacheTtlMinutes * 60000) {
                return null;
            }
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

    function buildApiUrl(path, query = {}) {
        const url = new URL(`${CONFIG.apiBaseUrl}${path}`);
        const key = Storage.getKey();
        if (key) {
            url.searchParams.set('key', key);
        }
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

    function createBubble() {
        if (bubbleElement) return;

        const missionsNav = document.getElementById('nav-missions');
        if (!missionsNav) return; // Don't create if missions nav not found

        bubbleElement = document.createElement('span');
        bubbleElement.id = 'torn-mission-badge';

        const link = missionsNav.querySelector('a');
        if (link) {
            link.appendChild(bubbleElement);
        }
    }

    // Watch for DOM changes to re-add badge if Torn's UI removes it
    function setupMutationObserver() {
        const observer = new MutationObserver(() => {
            const existingBadge = document.getElementById('torn-mission-badge');
            if (!existingBadge && bubbleElement) {
                // Badge was removed, recreate it
                bubbleElement = null;
                createBubble();
                // Re-apply current status
                const cached = Storage.getCache('missions');
                if (cached) {
                    const status = processMissions(cached);
                    updateBubble(status);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function addStyles() {
        if (document.getElementById('mission-tracker-styles')) return;

        GM_addStyle(`
            #torn-mission-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 16px;
                height: 16px;
                background: #3498db;
                color: white;
                border-radius: 8px;
                font-size: 10px;
                font-weight: bold;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                margin-left: 6px;
                padding: 0 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                vertical-align: middle;
                pointer-events: none;
                user-select: none;
            }
            
            #torn-mission-badge.mission-urgent {
                background: #e74c3c;
                animation: mission-pulse 2s infinite;
            }
            
            #torn-mission-badge.mission-warning {
                background: #f39c12;
            }
            
            @keyframes mission-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
            }
        `);
    }

    function updateBubble(status) {
        if (!bubbleElement) createBubble();
        if (!bubbleElement) return;

        addStyles();

        if (status.count === 0) {
            bubbleElement.style.display = 'none';
            return;
        }

        bubbleElement.style.display = 'inline-flex';
        bubbleElement.textContent = status.count;
        bubbleElement.title = `${status.count} incomplete mission${status.count !== 1 ? 's' : ''}`;

        // Remove old classes
        bubbleElement.classList.remove('mission-urgent', 'mission-warning');

        // Add appropriate class
        if (status.urgent) {
            bubbleElement.classList.add('mission-urgent');
        } else if (status.warning) {
            bubbleElement.classList.add('mission-warning');
        }
    }

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

                keyInfoHtml = `
                    <div style="
                        background: #16213e;
                        border: 1px solid #0f3460;
                        border-radius: 5px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                    ">
                        <div style="color: #888; margin-bottom: 5px;"><strong>Current API Key Info:</strong></div>
                        <div style="color: #fff;">Access Type: <span style="color: #2ecc71;">${access.type || 'Unknown'}</span></div>
                        <div style="color: #fff;">Access Level: <span style="color: #2ecc71;">${access.level ?? 'Unknown'}</span></div>
                        <div style="color: #aaa; margin-top: 5px; font-size: 11px;">
                            User selections: ${userSelections.length ? userSelections.join(', ') : 'N/A'}
                        </div>
                        ${!userSelections.includes('missions') ? `
                            <div style="color: #e74c3c; margin-top: 8px; font-size: 11px;">
                                ⚠️ This key does not include the v2 <code>missions</code> selection. Update the key permissions in Torn.
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (e) {
                keyInfoHtml = `
                    <div style="
                        background: #16213e;
                        border: 1px solid #e74c3c;
                        border-radius: 5px;
                        padding: 12px;
                        margin: 15px 0;
                        font-size: 12px;
                        color: #e74c3c;
                    ">
                        Unable to verify API key: ${e.message}
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
                background: rgba(0,0,0,0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    background: #1a1a2e;
                    border: 2px solid #e94560;
                    border-radius: 10px;
                    padding: 25px;
                    width: 420px;
                    max-width: 90%;
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #e94560;">⚙️ Mission Tracker Settings</h3>

                    <label style="display: block; margin: 15px 0 5px; color: #ccc;">
                        Torn API Key:
                    </label>
                    <input type="password" id="api-key-input"
                           value="${apiKey}"
                           placeholder="Enter your Torn API key"
                           style="
                               width: 100%;
                               padding: 10px;
                               border: 1px solid #0f3460;
                               background: #16213e;
                               color: #fff;
                               border-radius: 5px;
                               box-sizing: border-box;
                               font-family: monospace;
                           ">

                    <p style="font-size: 11px; color: #888; margin-top: 5px;">
                        Find your API key at: <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" style="color: #3498db;">torn.com/preferences.php#tab=api</a><br>
                        <strong>Required for v2:</strong> the key must include the <code>missions</code> user selection.
                    </p>

                    ${keyInfoHtml}

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button id="save-mission-settings" style="
                            flex: 1;
                            padding: 10px;
                            border: none;
                            border-radius: 5px;
                            background: #e94560;
                            color: white;
                            font-weight: bold;
                            cursor: pointer;
                        ">Save</button>
                        <button id="cancel-mission-settings" style="
                            flex: 1;
                            padding: 10px;
                            border: none;
                            border-radius: 5px;
                            background: #0f3460;
                            color: white;
                            font-weight: bold;
                            cursor: pointer;
                        ">Cancel</button>
                    </div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333; font-size: 11px; color: #666;">
                        <strong>Privacy:</strong> Your API key is stored locally. No data is sent to external servers.
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

    async function refreshMissions(force = false) {
        try {
            if (force) Storage.clearCache();
            const missions = await TornAPI.fetchMissions();
            const status = processMissions(missions);
            updateBubble(status);
            console.log('[Mission Tracker]', status);
        } catch (error) {
            console.error('[Mission Tracker] Error:', error.message);
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        if (!apiKey) {
            console.log('[Mission Tracker] No API key configured. Open settings to set up.');
            if (!GM_getValue('mission_tracker_notified', false)) {
                setTimeout(() => {
                    if (confirm('Mission Tracker: No API key configured. Open settings now?')) {
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

        console.log('[Mission Tracker] Initialized with Torn API v2.');
    }

    GM_registerMenuCommand('⚙️ Mission Tracker Settings', showSettings);
    GM_registerMenuCommand('🔄 Refresh Now', () => refreshMissions(true));
    GM_registerMenuCommand('🗑️ Clear Cache', () => {
        Storage.clearCache();
        alert('Cache cleared! Refresh to get latest mission data.');
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
