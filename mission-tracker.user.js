// ==UserScript==
// @name         Torn Mission Tracker
// @namespace    torn-mission-tracker
// @version      1.0.0
// @description  Track Torn missions with urgency indicators (red <24h, yellow <48h)
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker.user.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-end
// ==/UserScript==

/**
 * Torn Mission Tracker
 * 
 * Shows a floating bubble with the count of incomplete missions.
 * - Red bubble: At least one mission has <24 hours remaining
 * - Yellow bubble: At least one mission has <48 hours remaining (but none <24h)
 * - Hidden: All missions complete
 * 
 * Updates every 5 minutes with caching to respect API rate limits.
 */

(function() {
    'use strict';

    // ==========================================
    // Configuration
    // ==========================================
    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com',
        updateInterval: 5 * 60 * 1000, // 5 minutes
        cacheTtl: 5, // Cache for 5 minutes
        urgentHours: 24, // Red threshold
        warningHours: 48 // Yellow threshold
    };

    // ==========================================
    // State
    // ==========================================
    let bubbleElement = null;
    let updateTimer = null;

    // ==========================================
    // Storage / API Key Management
    // ==========================================
    const Storage = {
        getKey: () => GM_getValue('torn_api_key', ''),
        setKey: (key) => GM_setValue('torn_api_key', key),
        
        getCache: (key) => {
            const data = GM_getValue(`cache_${key}`, null);
            const time = GM_getValue(`cache_${key}_time`, 0);
            if (!data || (Date.now() - time) > CONFIG.cacheTtl * 60000) return null;
            return JSON.parse(data);
        },
        
        setCache: (key, data) => {
            GM_setValue(`cache_${key}`, JSON.stringify(data));
            GM_setValue(`cache_${key}_time`, Date.now());
        }
    };

    // ==========================================
    // API Client
    // ==========================================
    const TornAPI = {
        fetchMissions: () => {
            const key = Storage.getKey();
            if (!key) return Promise.reject('No API key configured');
            
            // Check cache first
            const cached = Storage.getCache('missions');
            if (cached) return Promise.resolve(cached);
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${CONFIG.apiBaseUrl}/user/?key=${key}&selections=missions`,
                    headers: { 'Accept': 'application/json' },
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                reject(new Error(`API Error ${data.error.code}: ${data.error.error}`));
                            } else {
                                Storage.setCache('missions', data.missions);
                                resolve(data.missions);
                            }
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        }
    };

    // ==========================================
    // Mission Processing
    // ==========================================
    function processMissions(missions) {
        if (!missions || typeof missions !== 'object') {
            return { count: 0, urgent: false, warning: false };
        }
        
        const now = Date.now() / 1000; // Current time in seconds
        let incompleteCount = 0;
        let hasUrgent = false;
        let hasWarning = false;
        
        for (const [missionId, mission] of Object.entries(missions)) {
            // Skip if mission is already complete
            if (mission.completed === 1 || mission.status === 'completed') continue;
            
            incompleteCount++;
            
            // Check deadline if available
            if (mission.deadline) {
                const hoursRemaining = (mission.deadline - now) / 3600;
                
                if (hoursRemaining > 0 && hoursRemaining <= CONFIG.urgentHours) {
                    hasUrgent = true;
                } else if (hoursRemaining > 0 && hoursRemaining <= CONFIG.warningHours) {
                    hasWarning = true;
                }
            }
        }
        
        return {
            count: incompleteCount,
            urgent: hasUrgent,
            warning: hasWarning && !hasUrgent // Only warning if not already urgent
        };
    }

    // ==========================================
    // UI Components
    // ==========================================
    function createBubble() {
        if (bubbleElement) return;
        
        bubbleElement = document.createElement('div');
        bubbleElement.id = 'torn-mission-bubble';
        document.body.appendChild(bubbleElement);
    }

    function updateBubble(status) {
        if (!bubbleElement) createBubble();
        
        // Hide if no incomplete missions
        if (status.count === 0) {
            bubbleElement.style.display = 'none';
            return;
        }
        
        // Determine color
        let color, shadow;
        if (status.urgent) {
            color = '#e74c3c'; // Red
            shadow = '0 4px 15px rgba(231, 76, 60, 0.5)';
        } else if (status.warning) {
            color = '#f39c12'; // Yellow/Orange
            shadow = '0 4px 15px rgba(243, 156, 18, 0.5)';
        } else {
            color = '#3498db'; // Blue (default, no urgency)
            shadow = '0 4px 15px rgba(52, 152, 219, 0.5)';
        }
        
        bubbleElement.style.cssText = `
            position: fixed;
            top: 70px;
            right: 15px;
            width: 40px;
            height: 40px;
            background: ${color};
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            font-family: 'Segoe UI', Tahoma, sans-serif;
            box-shadow: ${shadow};
            z-index: 9999;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        
        bubbleElement.textContent = status.count;
        bubbleElement.style.display = 'flex';
        
        // Hover effect
        bubbleElement.onmouseenter = () => {
            bubbleElement.style.transform = 'scale(1.1)';
        };
        bubbleElement.onmouseleave = () => {
            bubbleElement.style.transform = 'scale(1)';
        };
        
        // Click to go to missions page
        bubbleElement.onclick = () => {
            window.location.href = 'https://www.torn.com/missions.php';
        };
        
        // Tooltip
        bubbleElement.title = `${status.count} incomplete mission${status.count !== 1 ? 's' : ''}`;
    }

    // ==========================================
    // Settings
    // ==========================================
    function showSettings() {
        const existing = document.getElementById('mission-tracker-settings');
        if (existing) existing.remove();
        
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
                    width: 400px;
                    max-width: 90%;
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #e94560;">⚙️ Mission Tracker Settings</h3>
                    
                    <label style="display: block; margin: 15px 0 5px; color: #ccc;">
                        Torn API Key:
                    </label>
                    <input type="password" id="api-key-input" 
                           value="${Storage.getKey()}" 
                           placeholder="Enter your 16-character API key"
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
                        Find your API key at: <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" style="color: #3498db;">torn.com/preferences.php#tab=api</a>
                    </p>
                    
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
        
        // Event handlers
        modal.querySelector('#cancel-mission-settings').onclick = () => modal.remove();
        
        modal.querySelector('#save-mission-settings').onclick = () => {
            const key = modal.querySelector('#api-key-input').value.trim();
            if (key && key.length !== 16) {
                alert('API key should be 16 characters');
                return;
            }
            if (key) {
                Storage.setKey(key);
                modal.remove();
                // Refresh immediately
                refreshMissions();
            }
        };
        
        modal.querySelector('#mission-modal-overlay').onclick = (e) => {
            if (e.target.id === 'mission-modal-overlay') modal.remove();
        };
    }

    // ==========================================
    // Main Logic
    // ==========================================
    async function refreshMissions() {
        try {
            const missions = await TornAPI.fetchMissions();
            const status = processMissions(missions);
            updateBubble(status);
            console.log('[Mission Tracker]', status);
        } catch (error) {
            console.error('[Mission Tracker] Error:', error.message);
            // Don't hide bubble on error, keep last known state
        }
    }

    function init() {
        const apiKey = Storage.getKey();
        
        if (!apiKey) {
            console.log('[Mission Tracker] No API key configured. Open settings to set up.');
            // Show notification once
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
        
        // Initial fetch
        refreshMissions();
        
        // Set up periodic updates
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(refreshMissions, CONFIG.updateInterval);
        
        console.log('[Mission Tracker] Initialized. Updates every 5 minutes.');
    }

    // ==========================================
    // Register Menu Commands
    // ==========================================
    GM_registerMenuCommand('⚙️ Mission Tracker Settings', showSettings);
    GM_registerMenuCommand('🔄 Refresh Now', refreshMissions);

    // ==========================================
    // Start
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();