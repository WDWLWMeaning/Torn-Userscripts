// ==UserScript==
// @name         Torn Chain Guard (PDA)
// @namespace    torn-chain-guard
// @version      2.0.0
// @description  Prevents accidental attacks when within range of a chain bonus threshold (uses shared PDA menu)
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        DEFAULT_THRESHOLD: 15,
        CACHE_KEY: 'chain_guard_data',
        BONUS_THRESHOLDS: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
        DOM_CHAIN_SELECTOR: '.bar-value___uxnah',
        SIDEBAR_CHAIN_FALLBACK_SELECTORS: [
            '[class*="chain-bar"]',
            '.bar-value___uxnah',
            '[class*="bar-value"]',
            '[class*="chain"] [class*="bar"]',
            '[class*="chain"] [class*="value"]',
            '[class*="sidebar"] [class*="chain"]',
            '[class*="chainBar"]',
            '[class*="chain"]'
        ],
        ATTACK_CHAIN_SELECTOR: '.labelTitle___ZtfnD',
        ATTACK_CHAIN_FALLBACK_SELECTORS: [
            '.labelTitle___ZtfnD',
            '[class*="labelTitle"]',
            '[class*="chain"] [class*="title"]',
            '[class*="chain"] [class*="label"]',
            '[class*="attack"] [class*="chain"]',
            '[class*="title"]',
            '[class*="label"]'
        ],
        POLL_INTERVAL_MS: 300,
        STYLE_ID: 'chain-guard-pda-styles'
    };

    const TORN = {
        bg: '#444',
        panel: '#333',
        panelHover: '#555',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        border: '#444'
    };

    let chainState = { amount: 0, max: 1000, bonuses: 1.0, lastUpdate: 0, source: 'cache' };
    let lastDangerZoneState = null;
    let ignoredBonusThreshold = null;
    let blockedAttackButtons = new Set();
    let chainPollInterval = null;
    let guardPollInterval = null;

    function log(...args) { console.log('[Chain Guard]', ...args); }

    function storageGet(key, fallback = '{}') {
        try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch {}
    }

    function getThreshold() {
        if (window.PDAScriptsMenu) {
            return window.PDAScriptsMenu.getSetting('chainGuard', 'threshold', CONFIG.DEFAULT_THRESHOLD);
        }
        try {
            const saved = JSON.parse(storageGet('pda_script_chainGuard_settings', '{}'));
            return saved.threshold ?? CONFIG.DEFAULT_THRESHOLD;
        } catch { return CONFIG.DEFAULT_THRESHOLD; }
    }

    function loadChainCache() {
        try {
            const cached = JSON.parse(storageGet(CONFIG.CACHE_KEY, '{}'));
            if (Date.now() - cached.lastUpdate < 300000) {
                chainState = { ...chainState, ...cached, source: cached.source === 'dom' ? 'dom' : 'cache' };
            }
        } catch {}
    }
    function saveChainCache() {
        chainState.lastUpdate = Date.now();
        storageSet(CONFIG.CACHE_KEY, JSON.stringify(chainState));
    }

    function getNextBonus(amount) {
        return CONFIG.BONUS_THRESHOLDS.find(t => amount < t) || null;
    }
    function getDistanceToBonus() {
        if (!chainState.max) return null;
        return chainState.max - chainState.amount;
    }
    function isInDangerZone() {
        const dist = getDistanceToBonus();
        return dist !== null && dist <= getThreshold();
    }
    function isGuardIgnored() {
        return ignoredBonusThreshold !== null && chainState.amount < ignoredBonusThreshold;
    }

    function parseCompactNumber(value) {
        const normalized = String(value).trim().toLowerCase().replace(/,/g, '');
        const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
        if (!match) return NaN;
        const base = parseFloat(match[1]);
        const mult = match[2] === 'k' ? 1000 : match[2] === 'm' ? 1000000 : match[2] === 'b' ? 1000000000 : 1;
        return Math.round(base * mult);
    }

    function parseChainFromDOM() {
        const isAttack = window.location.href.includes('sid=attack');
        const selectors = isAttack ? CONFIG.ATTACK_CHAIN_FALLBACK_SELECTORS : CONFIG.SIDEBAR_CHAIN_FALLBACK_SELECTORS;

        for (const selector of selectors) {
            for (const el of document.querySelectorAll(selector)) {
                const text = el.textContent?.trim() || '';
                const match = text.match(/(\d+(?:\.\d+)?[kmb]?)\s*\/\s*(\d+(?:\.\d+)?[kmb]?)/i) ||
                             text.match(/chain[:\s]*(\d+(?:\.\d+)?[kmb]?)/i);
                if (match) {
                    const amount = parseCompactNumber(match[1]);
                    const max = parseCompactNumber(match[2]) || getNextBonus(amount) || 1000;
                    if (!isNaN(amount)) {
                        chainState = { amount, max, bonuses: chainState.bonuses, source: 'dom', lastUpdate: Date.now() };
                        saveChainCache();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function ensureStyles() {
        if (document.getElementById(CONFIG.STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = CONFIG.STYLE_ID;
        style.textContent = `
            #chain-guard-warning { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 999999;
                background: ${TORN.red}; color: white; padding: 12px 24px; border-radius: 4px; display: flex;
                align-items: center; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-family: Arial, sans-serif; }
            #chain-guard-warning strong { color: #ffeb3b; }
            #chain-guard-warning .cg-actions { display: flex; gap: 8px; }
            #chain-guard-warning button { border: 1px solid rgba(255,255,255,0.45); background: rgba(0,0,0,0.25);
                color: white; border-radius: 3px; padding: 8px 12px; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    function createWarningBanner() {
        if (document.getElementById('chain-guard-warning')) return;
        const banner = document.createElement('div');
        banner.id = 'chain-guard-warning';
        banner.innerHTML = `
            <span>⚠️ Chain Guard Active</span>
            <span>Only <strong>${getDistanceToBonus()}</strong> attacks until bonus!</span>
            <div class="cg-actions">
                <button onclick="this.closest('#chain-guard-warning').querySelector('.cg-ignore').click()">Ignore</button>
                <button class="cg-ignore" style="display:none"></button>
            </div>
        `;
        banner.querySelector('.cg-ignore').addEventListener('click', () => {
            ignoredBonusThreshold = chainState.max;
            banner.remove();
        });
        document.body.appendChild(banner);
    }
    function removeWarningBanner() {
        document.getElementById('chain-guard-warning')?.remove();
    }

    function findAttackButtons() {
        return [...document.querySelectorAll('button[type="submit"], button, input[type="submit"]')].filter(el => {
            const text = (el.textContent || el.value || '').trim().toLowerCase();
            return text === 'attack' || text === 'start fight';
        });
    }

    function blockAttackButtons() {
        findAttackButtons().forEach(btn => {
            if (!btn.dataset.chainGuardBlocked) {
                btn.dataset.chainGuardBlocked = 'true';
                btn.dataset.originalText = btn.tagName === 'INPUT' ? btn.value : btn.textContent;
                btn.addEventListener('click', preventAttack, true);
            }
            btn.disabled = true;
            btn.style.opacity = '0.5';
            const label = `Chain Guard: ${getDistanceToBonus()} to bonus`;
            if (btn.tagName === 'INPUT') btn.value = label; else btn.textContent = label;
            blockedAttackButtons.add(btn);
        });
    }

    function unblockAttackButtons() {
        blockedAttackButtons.forEach(btn => {
            if (!document.body.contains(btn)) { blockedAttackButtons.delete(btn); return; }
            btn.disabled = false;
            btn.style.opacity = '';
            if (btn.tagName === 'INPUT') btn.value = btn.dataset.originalText || 'Attack';
            else btn.textContent = btn.dataset.originalText || 'Attack';
            btn.removeEventListener('click', preventAttack, true);
            delete btn.dataset.chainGuardBlocked;
            delete btn.dataset.originalText;
            blockedAttackButtons.delete(btn);
        });
    }

    function preventAttack(e) {
        if (isInDangerZone() && !isGuardIgnored()) {
            e.preventDefault();
            e.stopPropagation();
            alert(`Chain Guard: Only ${getDistanceToBonus()} attacks until bonus!\n\nUse the PDA Scripts menu to adjust threshold.`);
            return false;
        }
    }

    function updateGuard() {
        const inDanger = isInDangerZone();
        if (lastDangerZoneState !== inDanger) {
            lastDangerZoneState = inDanger;
            log(inDanger ? 'Entered danger zone' : 'Exited danger zone');
        }

        if (inDanger && !isGuardIgnored()) {
            createWarningBanner();
            if (window.location.href.includes('sid=attack')) blockAttackButtons();
            else unblockAttackButtons();
        } else {
            removeWarningBanner();
            unblockAttackButtons();
        }
    }

    // Register with shared menu
    function registerWithSharedMenu() {
        if (!window.PDAScriptsMenu) {
            setTimeout(registerWithSharedMenu, 500);
            return;
        }
        window.PDAScriptsMenu.register('chainGuard', '🛡️ Chain Guard', {
            fields: [{
                key: 'threshold',
                label: 'Warning Threshold (attacks from bonus)',
                type: 'number',
                default: CONFIG.DEFAULT_THRESHOLD
            }],
            onChange: () => updateGuard()
        });
        log('✓ Registered with shared menu');
    }

    // Init
    function init() {
        log('v2.0.0 initializing...');
        ensureStyles();
        loadChainCache();
        registerWithSharedMenu();

        chainPollInterval = setInterval(() => {
            if (parseChainFromDOM()) updateGuard();
        }, CONFIG.POLL_INTERVAL_MS);

        guardPollInterval = setInterval(updateGuard, CONFIG.POLL_INTERVAL_MS);

        log('Chain polling started');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
