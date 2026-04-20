// ==UserScript==
// @name         Torn Mission Tracker (PDA)
// @namespace    torn-mission-tracker
// @version      4.0.0
// @description  Track Torn missions with alerts for urgent missions (uses shared PDA menu)
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        apiBaseUrl: 'https://api.torn.com/v2',
        updateInterval: 5 * 60 * 1000,
        cacheTtlMinutes: 5,
        urgentHours: 24,
        warningHours: 48
    };

    const TORN = {
        bg: '#444',
        panel: '#333',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        border: '#444'
    };

    let badgeElement = null;
    let updateTimer = null;

    function log(...args) { console.log('[Mission Tracker]', ...args); }

    function storageGet(key, fallback = '') {
        try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch {}
    }
    function getCache(key) {
        try {
            const data = storageGet(`mt_cache_${key}`);
            const time = parseInt(storageGet(`mt_cache_${key}_time`, '0'));
            if (!data || (Date.now() - time) > CONFIG.cacheTtlMinutes * 60000) return null;
            return JSON.parse(data);
        } catch { return null; }
    }
    function setCache(key, data) {
        storageSet(`mt_cache_${key}`, JSON.stringify(data));
        storageSet(`mt_cache_${key}_time`, Date.now().toString());
    }

    function getApiKey() {
        // Use shared menu if available
        if (window.PDAScriptsMenu) {
            return window.PDAScriptsMenu.getSetting('missionTracker', 'apiKey', '');
        }
        return storageGet('mt_api_key');
    }

    async function apiRequest(path) {
        const key = getApiKey();
        if (!key) throw new Error('No API key');

        const url = `${CONFIG.apiBaseUrl}${path}?key=${encodeURIComponent(key)}&comment=mission-tracker-pda`;

        // Use PDA_httpGet if available, otherwise fetch
        if (typeof PDA_httpGet === 'function') {
            const resp = await PDA_httpGet(url);
            const data = JSON.parse(resp.responseText);
            if (data.error) throw new Error(data.error.error);
            return data;
        } else {
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.error) throw new Error(data.error.error);
            return data;
        }
    }

    function processMissions(payload) {
        const givers = payload?.givers;
        if (!Array.isArray(givers)) return { count: 0, urgent: false, warning: false };

        const now = Date.now() / 1000;
        let count = 0, urgent = false, warning = false;

        for (const giver of givers) {
            for (const mission of (giver?.contracts || [])) {
                if (mission.status !== 'Accepted' && mission.status !== 'Available') continue;
                count++;
                if (mission.status === 'Accepted' && mission.expires_at) {
                    const hours = (mission.expires_at - now) / 3600;
                    if (hours > 0 && hours <= CONFIG.urgentHours) urgent = true;
                    else if (hours > 0 && hours <= CONFIG.warningHours) warning = true;
                }
            }
        }
        return { count, urgent, warning: warning && !urgent };
    }

    function ensureStyles() {
        if (document.getElementById('mt-pda-styles')) return;
        const style = document.createElement('style');
        style.id = 'mt-pda-styles';
        style.textContent = `
            #mt-mission-badge {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 18px;
                height: 18px;
                padding: 0 4px;
                background: ${TORN.panel};
                color: ${TORN.text};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                font-size: 11px;
                font-weight: 700;
                font-family: Arial, sans-serif;
            }
            #mt-mission-badge.urgent {
                background: ${TORN.red};
                color: #fff;
                box-shadow: 0 0 8px rgba(229,76,25,0.6);
            }
            #mt-mission-badge.warning {
                background: ${TORN.yellow};
                color: #000;
            }
            @media (max-width: 768px) {
                #mt-mission-badge { right: 4px; top: 4px; transform: none; min-width: 14px; height: 14px; font-size: 9px; }
            }
        `;
        document.head.appendChild(style);
    }

    function updateBadge(status) {
        ensureStyles();
        const nav = document.getElementById('nav-missions');
        if (!nav) return;

        if (!badgeElement || !document.body.contains(badgeElement)) {
            badgeElement = document.createElement('span');
            badgeElement.id = 'mt-mission-badge';
            const row = nav.querySelector('.area-row___iBD8N, a[href*="missions"]');
            if (row) row.style.position = 'relative';
            if (row) row.appendChild(badgeElement);
        }

        if (!badgeElement) return;

        if (status.count === 0) {
            badgeElement.style.display = 'none';
            return;
        }

        badgeElement.style.display = 'inline-flex';
        badgeElement.textContent = status.count;
        badgeElement.className = status.urgent ? 'urgent' : status.warning ? 'warning' : '';
    }

    async function refresh(force = false) {
        if (!getApiKey()) {
            log('No API key configured');
            return;
        }
        try {
            if (force) setCache('missions', null);
            let missions = getCache('missions');
            if (!missions) {
                missions = await apiRequest('/user/missions');
                setCache('missions', missions);
            }
            const status = processMissions(missions);
            updateBadge(status);
            log('Updated:', status);
        } catch (err) {
            log('Error:', err.message);
        }
    }

    // Register with shared menu
    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('missionTracker', '📋 Mission Tracker', {
            fields: [
                {
                    key: 'apiKey',
                    label: 'Torn API Key (Limited access with "missions" selection)',
                    type: 'text',
                    default: ''
                }
            ],
            onChange: (key) => {
                if (key === 'apiKey') {
                    log('API key updated');
                    refresh(true);
                }
            }
        });
        log('✓ Registered with shared menu');
    }

    function init() {
        log('v4.0.0 initializing...');
        registerWithSharedMenu();

        refresh();

        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(refresh, CONFIG.updateInterval);

        // Re-attach badge if nav changes
        new MutationObserver(() => {
            if (!document.getElementById('mt-mission-badge')) {
                badgeElement = null;
                const cached = getCache('missions');
                if (cached) updateBadge(processMissions(cached));
            }
        }).observe(document.body, { childList: true, subtree: true });

        log('Mission polling started');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
