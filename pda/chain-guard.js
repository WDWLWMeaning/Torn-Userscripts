// ==UserScript==
// @name         Torn Chain Guard (PDA)
// @namespace    torn-chain-guard
// @version      1.5.0
// @description  Prevents accidental attacks when within range of a chain bonus threshold
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        DEFAULT_THRESHOLD: 15,
        CACHE_KEY: 'chain_guard_data',
        SETTINGS_KEY: 'chain_guard_settings',
        BONUS_THRESHOLDS: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
        DOM_CHAIN_SELECTOR: '.bar-value___uxnah',
        STYLE_ID: 'chain-guard-pda-styles'
    };

    const TORN = {
        bg: '#191919',
        panel: '#333',
        panelHover: '#444',
        text: '#ddd',
        textMuted: '#999',
        red: '#E54C19',
        yellow: '#F08C00',
        green: '#82c91e',
        blue: '#74c0fc',
        border: '#555'
    };

    let chainState = {
        amount: 0,
        max: 1000,
        bonuses: 1.0,
        lastUpdate: 0,
        source: 'cache'
    };

    let lastDangerZoneState = null;
    let domObserver = null;
    let ignoredBonusThreshold = null;
    let lastLoggedChainKey = null;
    let lastObservedChainText = null;
    let domParseTimeout = null;
    let lastDomParseAt = 0;
    let attackButtonObserver = null;
    let blockedAttackButtons = new Set();
    let settingsPanelRef = null;
    let headerButtonObserver = null;

    function log(...args) {
        console.log('[Chain Guard PDA]', ...args);
    }

    function storageGet(key, fallback = '{}') {
        try {
            const value = localStorage.getItem(key);
            return value ?? fallback;
        } catch (error) {
            console.warn('[Chain Guard PDA] Failed to read localStorage key:', key, error);
            return fallback;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('[Chain Guard PDA] Failed to write localStorage key:', key, error);
        }
    }

    function ensureStyles() {
        if (document.getElementById(CONFIG.STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = CONFIG.STYLE_ID;
        style.textContent = `
            #chain-guard-warning {
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                background: ${TORN.red};
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                font-family: 'Open Sans', Arial, sans-serif;
                animation: cg-pulse 2s infinite;
            }
            @keyframes cg-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(229,76,25,0.5); }
                50% { box-shadow: 0 4px 24px rgba(229,76,25,0.8); }
            }
            #chain-guard-warning .cg-icon {
                font-weight: bold;
                font-size: 18px;
                padding: 4px 8px;
                background: rgba(0,0,0,0.3);
                border-radius: 3px;
            }
            #chain-guard-warning .cg-content {
                text-align: center;
            }
            #chain-guard-warning .cg-title {
                font-size: 16px;
                font-weight: bold;
            }
            #chain-guard-warning .cg-subtitle {
                font-size: 13px;
                opacity: 0.9;
            }
            #chain-guard-warning strong {
                color: #ffeb3b;
            }
            #chain-guard-warning .cg-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            #chain-guard-warning .cg-ignore,
            #chain-guard-warning .cg-settings,
            #chain-guard-settings .cg-footer button,
            #chain-guard-settings .cg-close {
                border: 1px solid rgba(255,255,255,0.45);
                background: rgba(0,0,0,0.25);
                color: white;
                border-radius: 3px;
                padding: 8px 12px;
                cursor: pointer;
                font-weight: bold;
            }
            #chain-guard-warning .cg-settings {
                min-width: 40px;
                padding: 8px 10px;
                font-size: 16px;
                line-height: 1;
            }
            #chain-guard-warning .cg-ignore:hover,
            #chain-guard-warning .cg-settings:hover {
                background: rgba(0,0,0,0.4);
            }
            #chain-guard-settings {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #chain-guard-settings .cg-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.8);
            }
            #chain-guard-settings .cg-panel {
                position: relative;
                background: ${TORN.bg};
                border: 1px solid ${TORN.border};
                border-radius: 4px;
                width: 400px;
                max-width: 90%;
                font-family: 'Open Sans', Arial, sans-serif;
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-header {
                background: linear-gradient(to bottom, ${TORN.panel}, #222);
                padding: 12px 16px;
                border-bottom: 1px solid ${TORN.border};
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: bold;
            }
            #chain-guard-settings .cg-close {
                background: none;
                border: none;
                color: ${TORN.textMuted};
                font-size: 18px;
                padding: 0 4px;
            }
            #chain-guard-settings .cg-close:hover {
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-body {
                padding: 16px;
            }
            #chain-guard-settings .cg-field {
                margin-bottom: 16px;
            }
            #chain-guard-settings .cg-field label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                color: ${TORN.textMuted};
            }
            #chain-guard-settings .cg-field input[type="number"] {
                width: 100%;
                padding: 8px 12px;
                background: ${TORN.panel};
                border: 1px solid ${TORN.border};
                border-radius: 3px;
                color: ${TORN.text};
                font-size: 14px;
                box-sizing: border-box;
            }
            #chain-guard-settings .cg-checkbox-field label {
                display: flex;
                align-items: center;
                gap: 8px;
                color: ${TORN.text};
                cursor: pointer;
            }
            #chain-guard-settings .cg-checkbox-field input {
                width: auto;
                margin: 0;
            }
            #chain-guard-settings .cg-info {
                background: ${TORN.panel};
                padding: 12px;
                border-radius: 3px;
                font-size: 13px;
            }
            #chain-guard-settings .cg-info p {
                margin: 6px 0;
            }
            #chain-guard-settings .cg-footer {
                padding: 12px 16px;
                border-top: 1px solid ${TORN.border};
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            #chain-guard-settings .cg-save {
                background: linear-gradient(to bottom, #555, ${TORN.panel});
                color: ${TORN.text};
                border-color: ${TORN.border};
            }
            #chain-guard-settings .cg-save:hover {
                background: linear-gradient(to bottom, #666, #444);
            }
            #chain-guard-settings .cg-cancel {
                background: ${TORN.bg};
                color: ${TORN.textMuted};
                border-color: ${TORN.border};
            }
            #chain-guard-settings .cg-cancel:hover {
                color: ${TORN.text};
            }
            #chain-guard-header-settings {
                width: 32px;
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(to bottom, #3b3b3b, #1f1f1f);
                border: 1px solid #0f0f0f;
                border-radius: 6px;
                color: ${TORN.text};
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                margin-left: 6px;
                padding: 0;
            }
            #chain-guard-header-settings:hover {
                background: linear-gradient(to bottom, #4a4a4a, #2a2a2a);
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    function logDebug(...args) {
        if (loadSettings().debugMode) {
            log(...args);
        }
    }

    function loadSettings() {
        const saved = storageGet(CONFIG.SETTINGS_KEY, '{}');
        try {
            return { threshold: CONFIG.DEFAULT_THRESHOLD, debugMode: false, ...JSON.parse(saved) };
        } catch {
            return { threshold: CONFIG.DEFAULT_THRESHOLD, debugMode: false };
        }
    }

    function saveSettings(settings) {
        storageSet(CONFIG.SETTINGS_KEY, JSON.stringify(settings));
    }

    function loadChainCache() {
        const cached = storageGet(CONFIG.CACHE_KEY, '{}');
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.lastUpdate < 300000) {
                chainState = {
                    ...chainState,
                    ...data,
                    source: data.source === 'dom' ? 'dom' : 'cache'
                };
                log('Loaded cached chain:', chainState.amount, '/', chainState.max, 'source:', chainState.source);
            }
        } catch {
            // Ignore invalid cache
        }
    }

    function saveChainCache() {
        chainState.lastUpdate = Date.now();
        storageSet(CONFIG.CACHE_KEY, JSON.stringify(chainState));
    }

    function getNextBonus(amount) {
        return CONFIG.BONUS_THRESHOLDS.find((threshold) => amount < threshold) || null;
    }

    function applyChainState(amount, max, bonuses, source) {
        if (!Number.isFinite(amount)) return false;

        const normalizedSource = source === 'dom' ? 'dom' : 'cache';
        const normalizedMax = Number.isFinite(max) && max > 0 ? max : (getNextBonus(amount) || 1000);
        const normalizedBonuses = Number.isFinite(bonuses) ? bonuses : chainState.bonuses;
        const hasChanged = chainState.amount !== amount || chainState.max !== normalizedMax || chainState.bonuses !== normalizedBonuses;

        if (!hasChanged) {
            chainState.source = normalizedSource;
            return false;
        }

        chainState.amount = amount;
        chainState.max = normalizedMax;
        chainState.bonuses = normalizedBonuses;
        chainState.source = normalizedSource;

        if (ignoredBonusThreshold !== null && chainState.amount >= chainState.max) {
            logDebug('Ignore state reset, chain bonus reached at threshold:', ignoredBonusThreshold, 'current chain:', chainState.amount, '/', chainState.max);
            ignoredBonusThreshold = null;
        }

        saveChainCache();

        const chainKey = `${chainState.amount}/${chainState.max}`;
        if (lastLoggedChainKey !== chainKey) {
            lastLoggedChainKey = chainKey;
            log('Chain updated from', normalizedSource + ':', chainState.amount, '/', chainState.max);
        }

        updateGuard();
        return true;
    }

    function parseCompactNumber(value) {
        const normalized = String(value).trim().toLowerCase().replace(/,/g, '');
        const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
        if (!match) return NaN;

        const base = parseFloat(match[1]);
        const multiplier = match[2] === 'k' ? 1000 : match[2] === 'm' ? 1000000 : match[2] === 'b' ? 1000000000 : 1;
        return Math.round(base * multiplier);
    }

    function parseChainFromDOM(force = false) {
        const el = document.querySelector(CONFIG.DOM_CHAIN_SELECTOR);
        if (!el) {
            logDebug('DOM parse skipped, chain element not found');
            return false;
        }

        const text = el.textContent.trim();
        if (!force && text === lastObservedChainText) {
            return false;
        }

        lastObservedChainText = text;
        const match = text.match(/([^/]+)\s*\/\s*([^\s]+)/);
        if (!match) {
            logDebug('DOM parse failed, unexpected text:', text);
            return false;
        }

        const amount = parseCompactNumber(match[1]);
        const max = parseCompactNumber(match[2]);
        if (!Number.isFinite(amount) || !Number.isFinite(max)) {
            logDebug('DOM parse failed, invalid values:', text);
            return false;
        }

        logDebug('DOM parse success:', text, '=>', amount, '/', max);
        return applyChainState(amount, max, chainState.bonuses, 'dom');
    }

    function isInDangerZone() {
        const settings = loadSettings();
        const remaining = chainState.max - chainState.amount;
        return remaining > 0 && remaining <= settings.threshold;
    }

    function getDistanceToBonus() {
        return chainState.max - chainState.amount;
    }

    function getGuardStatusMarkup() {
        if (isInDangerZone()) {
            return `<span style="color:${TORN.red}">${isGuardIgnored() ? 'Protection ignored until next bonus' : 'PROTECTION ACTIVE'}</span>`;
        }

        return `<span style="color:${TORN.green}">Safe to attack</span>`;
    }

    function updateSettingsPanel() {
        if (!settingsPanelRef || !document.body.contains(settingsPanelRef)) {
            settingsPanelRef = null;
            return;
        }

        const chainValue = settingsPanelRef.querySelector('[data-cg-info="chain"]');
        const maxValue = settingsPanelRef.querySelector('[data-cg-info="max"]');
        const distanceValue = settingsPanelRef.querySelector('[data-cg-info="distance"]');
        const statusValue = settingsPanelRef.querySelector('[data-cg-info="status"]');

        if (chainValue) chainValue.textContent = chainState.amount;
        if (maxValue) maxValue.textContent = chainState.max;
        if (distanceValue) distanceValue.textContent = getDistanceToBonus();
        if (statusValue) statusValue.innerHTML = getGuardStatusMarkup();
    }

    function createWarningBanner() {
        let banner = document.getElementById('chain-guard-warning');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'chain-guard-warning';
            banner.innerHTML = `
                <div class="cg-icon">STOP</div>
                <div class="cg-content">
                    <div class="cg-title">Chain Bonus Protection Active</div>
                    <div class="cg-subtitle"></div>
                </div>
                <div class="cg-actions">
                    <button type="button" class="cg-settings" title="Open Chain Guard settings">⚙</button>
                    <button type="button" class="cg-ignore">Ignore once</button>
                </div>
            `;

            banner.querySelector('.cg-ignore').addEventListener('click', () => {
                ignoredBonusThreshold = chainState.max;
                logDebug('Ignore clicked, protection disabled until next bonus threshold:', ignoredBonusThreshold);
                removeWarningBanner();
                updateGuard();
            });

            banner.querySelector('.cg-settings').addEventListener('click', openSettings);
            document.body.appendChild(banner);
        }

        const subtitle = banner.querySelector('.cg-subtitle');
        subtitle.innerHTML = `Only <strong>${getDistanceToBonus()}</strong> attacks until chain bonus!`;
        return banner;
    }

    function removeWarningBanner() {
        const banner = document.getElementById('chain-guard-warning');
        if (banner) banner.remove();
    }

    function getBlockedButtonLabel() {
        return `Chain Guard: ${getDistanceToBonus()} to bonus`;
    }

    function updateBlockedButtonLabels() {
        blockedAttackButtons.forEach((btn) => {
            if (!btn.isConnected || btn.dataset.chainGuardBlocked !== 'true') {
                blockedAttackButtons.delete(btn);
                return;
            }

            if (btn.tagName === 'INPUT') {
                btn.value = getBlockedButtonLabel();
            } else {
                btn.textContent = getBlockedButtonLabel();
            }
        });
    }

    function isGuardIgnored() {
        return ignoredBonusThreshold !== null && chainState.amount < ignoredBonusThreshold;
    }

    function findAttackButtons() {
        const dialogStartFightButtons = [...document.querySelectorAll('.dialogButtons___nX4Bz button')].filter((el) => {
            const text = (el.textContent || el.value || '').trim().toLowerCase();
            return text === 'start fight';
        });

        const genericAttackButtons = [...document.querySelectorAll('button[type="submit"], button, input[type="submit"]')].filter((el) => {
            const text = (el.textContent || el.value || '').trim().toLowerCase();
            return text === 'attack' || text === 'start fight';
        });

        return [...new Set([...dialogStartFightButtons, ...genericAttackButtons])];
    }

    function blockAttackButtons() {
        findAttackButtons().forEach((btn) => {
            if (!btn.dataset.chainGuardBlocked) {
                btn.dataset.chainGuardBlocked = 'true';
                btn.dataset.originalDisabled = btn.disabled ? 'true' : 'false';
                btn.dataset.originalTitle = btn.title || '';
                btn.dataset.originalText = btn.tagName === 'INPUT' ? (btn.value || '') : (btn.textContent || '');
                btn.addEventListener('click', preventAttack, true);
            }

            blockedAttackButtons.add(btn);
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.title = 'Blocked by Chain Guard, too close to bonus!';
            if (btn.tagName === 'INPUT') {
                btn.value = getBlockedButtonLabel();
            } else {
                btn.textContent = getBlockedButtonLabel();
            }
        });

        document.querySelectorAll('a[href*="sid=attack"]').forEach((link) => {
            if (!link.dataset.chainGuardBlocked) {
                link.dataset.chainGuardBlocked = 'true';
                link.dataset.originalTitle = link.title || '';
                link.addEventListener('click', preventAttack, true);
            }
            link.style.opacity = '0.5';
            link.style.cursor = 'not-allowed';
            link.title = 'Blocked by Chain Guard, too close to bonus!';
        });
    }

    function preventAttack(event) {
        if (isInDangerZone() && !isGuardIgnored()) {
            logDebug('Attack blocked/intercepted,', getDistanceToBonus(), 'attacks away from bonus');
            event.preventDefault();
            event.stopPropagation();
            alert(`Chain Guard: You are only ${getDistanceToBonus()} attacks away from a chain bonus!\n\nClick Ignore once in the warning banner if you really want to attack.`);
            return false;
        }
    }

    function unblockAttackButtons() {
        document.querySelectorAll('[data-chain-guard-blocked="true"]').forEach((el) => {
            if ('disabled' in el) {
                el.disabled = el.dataset.originalDisabled === 'true';
            }
            el.style.opacity = '';
            el.style.cursor = '';
            el.title = el.dataset.originalTitle || '';
            if (el.tagName === 'INPUT' && typeof el.dataset.originalText === 'string') {
                el.value = el.dataset.originalText;
            } else if (typeof el.dataset.originalText === 'string') {
                el.textContent = el.dataset.originalText;
            }
            el.removeEventListener('click', preventAttack, true);
            blockedAttackButtons.delete(el);
            delete el.dataset.chainGuardBlocked;
            delete el.dataset.originalDisabled;
            delete el.dataset.originalTitle;
            delete el.dataset.originalText;
        });
    }

    function scheduleDomParse(force = false) {
        const now = Date.now();
        const remaining = Math.max(0, 1000 - (now - lastDomParseAt));

        if (domParseTimeout) {
            if (!force) return;
            clearTimeout(domParseTimeout);
        }

        domParseTimeout = setTimeout(() => {
            domParseTimeout = null;
            lastDomParseAt = Date.now();
            if (parseChainFromDOM(force)) {
                logDebug('DOM observer applied chain update');
            }
        }, remaining);
    }

    function ensureDomObserver() {
        if (domObserver) return;

        domObserver = new MutationObserver(() => {
            const el = document.querySelector(CONFIG.DOM_CHAIN_SELECTOR);
            const text = el?.textContent?.trim();
            if (!text || text === lastObservedChainText) return;
            scheduleDomParse();
        });

        domObserver.observe(document.documentElement || document, {
            subtree: true,
            childList: true,
            characterData: true
        });

        log('DOM observer started');
    }

    function ensureAttackButtonObserver() {
        if (attackButtonObserver) return;

        attackButtonObserver = new MutationObserver(() => {
            if (!window.location.href.includes('sid=attack')) return;
            if (!isInDangerZone() || isGuardIgnored()) return;
            blockAttackButtons();
        });

        attackButtonObserver.observe(document.documentElement || document, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'disabled', 'value']
        });

        log('Attack button observer started');
    }

    function ensureHeaderSettingsButton() {
        const existing = document.getElementById('chain-guard-header-settings');
        if (existing && existing.isConnected) return true;

        const headerWrapper = document.querySelector('.header-buttons-wrapper');
        if (!headerWrapper) return false;

        const button = document.createElement('button');
        button.id = 'chain-guard-header-settings';
        button.type = 'button';
        button.title = 'Chain Guard settings';
        button.setAttribute('aria-label', 'Chain Guard settings');
        button.textContent = '⚙';
        button.addEventListener('click', openSettings);
        headerWrapper.appendChild(button);
        return true;
    }

    function ensureHeaderButtonObserver() {
        if (ensureHeaderSettingsButton()) return;
        if (headerButtonObserver) return;

        headerButtonObserver = new MutationObserver(() => {
            if (ensureHeaderSettingsButton() && headerButtonObserver) {
                headerButtonObserver.disconnect();
                headerButtonObserver = null;
            }
        });

        headerButtonObserver.observe(document.documentElement || document, {
            subtree: true,
            childList: true
        });
    }

    function updateGuard() {
        const isAttackPage = window.location.href.includes('sid=attack');
        const inDangerZone = isInDangerZone();
        const ignored = isGuardIgnored();

        ensureHeaderSettingsButton();

        if (lastDangerZoneState !== inDangerZone) {
            log(inDangerZone ? 'Entered danger zone' : 'Exited danger zone');
            lastDangerZoneState = inDangerZone;
        }

        if (inDangerZone) {
            createWarningBanner();
            if (isAttackPage && !ignored) {
                blockAttackButtons();
                updateBlockedButtonLabels();
            } else {
                unblockAttackButtons();
            }
        } else {
            removeWarningBanner();
            unblockAttackButtons();
        }

        updateSettingsPanel();
    }

    function openSettings() {
        const settings = loadSettings();
        const existing = document.getElementById('chain-guard-settings');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'chain-guard-settings';
        panel.innerHTML = `
            <div class="cg-overlay"></div>
            <div class="cg-panel">
                <div class="cg-header">
                    <span>Chain Guard Settings</span>
                    <button type="button" class="cg-close">x</button>
                </div>
                <div class="cg-body">
                    <div class="cg-field">
                        <label>Warning Threshold (attacks from bonus)</label>
                        <input type="number" id="cg-threshold" value="${settings.threshold}" min="1" max="100">
                    </div>
                    <div class="cg-field cg-checkbox-field">
                        <label>
                            <input type="checkbox" id="cg-debug-mode" ${settings.debugMode ? 'checked' : ''}>
                            Enable Debug Mode
                        </label>
                    </div>
                    <div class="cg-info">
                        <p>Current chain: <strong data-cg-info="chain">${chainState.amount}</strong> / <span data-cg-info="max">${chainState.max}</span></p>
                        <p>Distance to bonus: <strong data-cg-info="distance">${getDistanceToBonus()}</strong></p>
                        <p>Status: <span data-cg-info="status">${getGuardStatusMarkup()}</span></p>
                    </div>
                </div>
                <div class="cg-footer">
                    <button type="button" class="cg-save">Save</button>
                    <button type="button" class="cg-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        settingsPanelRef = panel;
        updateSettingsPanel();

        const closePanel = () => {
            if (settingsPanelRef === panel) {
                settingsPanelRef = null;
            }
            panel.remove();
        };

        panel.querySelector('.cg-close').onclick = closePanel;
        panel.querySelector('.cg-cancel').onclick = closePanel;
        panel.querySelector('.cg-overlay').onclick = closePanel;
        panel.querySelector('.cg-save').onclick = () => {
            const threshold = parseInt(panel.querySelector('#cg-threshold').value, 10);
            const debugMode = panel.querySelector('#cg-debug-mode').checked;
            if (threshold > 0) {
                saveSettings({ threshold, debugMode });
                log('Settings saved:', { threshold, debugMode });
                updateGuard();
            }
            closePanel();
        };
    }

    function init() {
        log('Init start');
        ensureStyles();
        loadChainCache();
        ensureDomObserver();
        ensureAttackButtonObserver();
        ensureHeaderButtonObserver();
        parseChainFromDOM(true);

        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                log('URL changed, refreshing guard state:', url);
                scheduleDomParse(true);
                updateGuard();
            }
        }).observe(document, { subtree: true, childList: true });

        updateGuard();
        if (window.location.href.includes('sid=attack')) {
            blockAttackButtons();
            setInterval(() => {
                scheduleDomParse(true);
                updateGuard();
            }, 250);
        }

        log('Ready. Current chain:', chainState.amount, '/', chainState.max, 'source:', chainState.source);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
