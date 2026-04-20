// ==UserScript==
// @name         Torn Chain Guard (PDA)
// @namespace    torn-chain-guard
// @version      1.6.2
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
        border: '#444',
        borderLight: '#555',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
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
    let ignoredBonusThreshold = null;
    let lastLoggedChainKey = null;
    let lastObservedChainText = null;
    let blockedAttackButtons = new Set();
    let settingsPanelRef = null;
    let chainPollInterval = null;
    let guardPollInterval = null;
    let lastPollMode = null;
    let lastMissingChainLogKey = null;
    let debugState = {
        status: 'Running',
        currentUrl: window.location.href,
        pollMode: 'sidebar',
        searchResults: [],
        lastParsed: null,
        lastMessage: 'Waiting for DOM...'
    };

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
                font-family: Arial, sans-serif;
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
                font-family: Arial, sans-serif;
                color: ${TORN.text};
            }
            #chain-guard-settings .cg-header {
                background: ${TORN.headerGradient};
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

        `;
        document.head.appendChild(style);
    }

    function formatDebugValue(value) {
        if (value === null || value === undefined || value === '') return 'n/a';
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    function updateDebugState(patch = {}) {
        debugState = {
            ...debugState,
            ...patch,
            currentUrl: window.location.href
        };
    }

    function logDebug(...args) {
        updateDebugState({
            lastMessage: args.map((arg) => formatDebugValue(arg)).join(' ') || 'n/a'
        });
    }

    function loadSettings() {
        const saved = storageGet(CONFIG.SETTINGS_KEY, '{}');
        try {
            return { threshold: CONFIG.DEFAULT_THRESHOLD, ...JSON.parse(saved) };
        } catch {
            return { threshold: CONFIG.DEFAULT_THRESHOLD };
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
                updateDebugState({
                    lastParsed: {
                        amount: chainState.amount,
                        max: chainState.max,
                        source: chainState.source,
                        selector: 'cache'
                    }
                });
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
        updateDebugState({
            lastParsed: {
                amount,
                max: normalizedMax,
                source: normalizedSource,
                selector: debugState.lastParsed?.selector || normalizedSource
            }
        });

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

    function findChainElement(selectors, { scope, isCandidate }) {
        const searchResults = [];

        for (const selector of selectors) {
            const matches = [...document.querySelectorAll(selector)];
            let foundMatch = null;

            for (const el of matches) {
                const text = el.textContent?.trim() || '';
                if (!text) continue;
                if (isCandidate(text, el)) {
                    foundMatch = { el, selector, text };
                    break;
                }
            }

            searchResults.push({
                scope,
                selector,
                found: Boolean(foundMatch),
                matchText: foundMatch?.text ? foundMatch.text.slice(0, 80) : '',
                matchCount: matches.length
            });

            if (foundMatch) {
                return { match: foundMatch, searchResults };
            }
        }

        return { match: null, searchResults };
    }

    function findAttackChainElement() {
        return findChainElement(CONFIG.ATTACK_CHAIN_FALLBACK_SELECTORS, {
            scope: 'attack',
            isCandidate: (text) => /\d/.test(text) && (/\d+\s*[:]\s*\d+/.test(text) || /chain/i.test(text) || /\d+(?:\.\d+)?\s*[kmb]?/i.test(text))
        });
    }

    function findSidebarChainElement() {
        const searchResults = [];

        const getNearbyChainText = (el) => {
            if (!el) return '';
            const candidates = [
                el,
                el.closest('a, [class*="chain"], [href*="chain"]'),
                el.parentElement,
                el.closest('li, div, section, article')
            ].filter(Boolean);

            return candidates
                .map((node) => node.textContent?.trim() || '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const isChainLink = (el) => el?.matches?.('a[class*="chain-bar"], a[href*="chain"]');
        const hasChainContext = (el) => /chain\s*:/i.test(getNearbyChainText(el)) || /\bchain\b/i.test(getNearbyChainText(el));

        const findMatch = (scope, selector, matcher) => {
            const matches = [...document.querySelectorAll(selector)];
            let foundMatch = null;

            for (const el of matches) {
                const text = el.textContent?.trim() || '';
                if (!text) continue;
                if (matcher(el, text)) {
                    foundMatch = { el, selector, text };
                    break;
                }
            }

            searchResults.push({
                scope: 'sidebar',
                selector,
                found: Boolean(foundMatch),
                matchText: foundMatch?.text ? foundMatch.text.slice(0, 80) : '',
                matchCount: matches.length
            });

            return foundMatch;
        };

        const directLinkMatch = findMatch('sidebar', 'a[class*="chain-bar"], a[href*="chain"]', (el, text) => {
            return /\d/.test(text) && (isChainLink(el) || hasChainContext(el));
        });
        if (directLinkMatch) {
            return { match: directLinkMatch, searchResults };
        }

        const labelMatch = findMatch('sidebar', 'a, div, span, p, strong', (el, text) => {
            return /chain\s*:/i.test(text) && /\d/.test(text) && (isChainLink(el) || hasChainContext(el));
        });
        if (labelMatch) {
            return { match: labelMatch, searchResults };
        }

        const barValueMatch = findMatch('sidebar', '.bar-value___uxnah', (el, text) => {
            return /\//.test(text) && /\d/.test(text) && (isChainLink(el.closest('a')) || hasChainContext(el));
        });
        if (barValueMatch) {
            return { match: barValueMatch, searchResults };
        }

        return { match: null, searchResults };
    }

    function parseAttackPageChain(el, selector = CONFIG.ATTACK_CHAIN_SELECTOR) {
        if (!el) return null;

        const fullText = el.textContent?.trim() || '';
        const spanText = el.querySelector('span')?.textContent?.trim() || '';
        const amountMatch = fullText.match(/(?:chain\s*)?(\d+(?:\.\d+)?\s*[kmb]?)/i);
        const timerMatch = fullText.match(/(\d+\s*:\s*\d+)/);
        const amountText = spanText || amountMatch?.[1] || '';
        const amount = parseCompactNumber(amountText);
        if (!Number.isFinite(amount)) {
            logDebug('Attack DOM parse failed for selector', selector, 'raw text:', fullText, 'timer:', timerMatch?.[1] || 'none');
            return null;
        }

        return {
            amount,
            max: getNextBonus(amount) || chainState.max || 1000,
            text: fullText,
            selector,
            timerText: timerMatch?.[1] || null
        };
    }

    function parseSidebarChain(sidebarEl) {
        if (!sidebarEl) return null;

        const text = sidebarEl.textContent.trim();
        let amount = NaN;
        let max = NaN;

        const matchWithSlash = text.match(/(\d+(?:\.\d+)?\s*[kmb]?)\s*\/\s*(\d+(?:\.\d+)?\s*[kmb]?)/i);
        if (matchWithSlash) {
            amount = parseCompactNumber(matchWithSlash[1]);
            max = parseCompactNumber(matchWithSlash[2]);
        } else {
            const matchNumber = text.match(/(\d+(?:\.\d+)?\s*[kmb]?)/i);
            if (matchNumber) {
                amount = parseCompactNumber(matchNumber[1]);
                max = getNextBonus(amount) || 1000;
            }
        }

        if (!Number.isFinite(amount) || !Number.isFinite(max)) {
            logDebug('Sidebar DOM parse failed, unexpected or invalid text:', text);
            return null;
        }

        return { amount, max, text };
    }

    function parseChainFromDOM(force = false) {
        const isAttackPage = window.location.href.includes('sid=attack');
        const attackSearch = isAttackPage ? findAttackChainElement() : { match: null, searchResults: [] };
        const sidebarSearch = findSidebarChainElement();
        const combinedSearchResults = [...attackSearch.searchResults, ...sidebarSearch.searchResults];

        updateDebugState({
            pollMode: isAttackPage ? 'attack' : 'sidebar',
            searchResults: combinedSearchResults,
            status: 'Running'
        });

        if (isAttackPage && attackSearch.match) {
            const parsed = parseAttackPageChain(attackSearch.match.el, attackSearch.match.selector);
            if (parsed) {
                const observedText = `attack:${parsed.selector}:${parsed.text}`;
                updateDebugState({
                    status: 'Chain found',
                    lastParsed: {
                        amount: parsed.amount,
                        max: parsed.max,
                        source: 'dom',
                        selector: parsed.selector
                    }
                });
                if (!force && observedText === lastObservedChainText) {
                    return false;
                }

                lastObservedChainText = observedText;
                lastMissingChainLogKey = null;
                logDebug('Attack DOM parse success via', parsed.selector + ':', parsed.text, '=>', parsed.amount, '/', parsed.max, parsed.timerText ? `timer ${parsed.timerText}` : '');
                return applyChainState(parsed.amount, parsed.max, chainState.bonuses, 'dom');
            }
        }

        if (sidebarSearch.match?.el) {
            const parsed = parseSidebarChain(sidebarSearch.match.el);
            if (parsed) {
                const observedText = `sidebar:${parsed.text}`;
                updateDebugState({
                    status: 'Chain found',
                    lastParsed: {
                        amount: parsed.amount,
                        max: parsed.max,
                        source: 'dom',
                        selector: sidebarSearch.match.selector
                    }
                });
                if (!force && observedText === lastObservedChainText) {
                    return false;
                }

                lastObservedChainText = observedText;
                lastMissingChainLogKey = null;
                logDebug('Sidebar DOM parse success via', sidebarSearch.match.selector + ':', parsed.text, '=>', parsed.amount, '/', parsed.max);
                return applyChainState(parsed.amount, parsed.max, chainState.bonuses, 'dom');
            }
        }

        const missingKey = `${isAttackPage ? 'attack' : 'sidebar'}:missing:${window.location.href}`;
        updateDebugState({ status: 'Chain NOT found' });
        if (lastMissingChainLogKey !== missingKey) {
            lastMissingChainLogKey = missingKey;
            logDebug('DOM parse could not find a chain element for mode:', isAttackPage ? 'attack' : 'sidebar');
        }
        return false;
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
        if (!settingsPanelRef || !settingsPanelRef.isConnected) {
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

    function ensurePolling() {
        if (!chainPollInterval) {
            chainPollInterval = setInterval(() => {
                const isAttackPage = window.location.href.includes('sid=attack');
                const pollMode = isAttackPage ? 'attack' : 'sidebar';
                if (pollMode !== lastPollMode) {
                    lastPollMode = pollMode;
                    log('Chain poll mode:', pollMode, 'url:', window.location.href);
                }

                if (parseChainFromDOM()) {
                    logDebug('Chain poll applied DOM update');
                }
            }, CONFIG.POLL_INTERVAL_MS);

            log('Chain polling started, interval:', CONFIG.POLL_INTERVAL_MS, 'ms');
        }

        if (!guardPollInterval) {
            guardPollInterval = setInterval(() => {
                updateGuard();
            }, CONFIG.POLL_INTERVAL_MS);

            logDebug('Guard polling started, interval:', CONFIG.POLL_INTERVAL_MS, 'ms');
        }
    }

    // ==================== COOPERATIVE HEADER BUTTON ====================
    // Each script adds its own button to a shared container - no dependencies

    function findHamburgerMenu() {
        // Try multiple selectors for different page states (desktop, mobile, PDA)
        const selectors = [
            '.header-menu.left .header-menu-icon',           // Desktop with left menu
            '.header-menu-icon',                              // Generic
            '[class*="header-menu"] button',                // Class-based
            '.top_header_button.header-menu-icon',           // Torn native class
            '.header-navigation .header-buttons-wrapper',    // Alternative header structure
            '.header-wrapper-top .header-menu',              // Top header area
            '#topHeaderBanner .header-menu',                 // Within header banner
            '.container .header-menu'                        // Within container
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                logDebug('Found hamburger menu with selector:', sel);
                return el;
            }
        }
        logDebug('Hamburger menu not found yet');
        return null;
    }

    function getOrCreateSharedContainer() {
        let container = document.getElementById('torn-pda-scripts-container');
        if (container) return container;

        const hamburger = findHamburgerMenu();
        if (!hamburger) return null;

        container = document.createElement('div');
        container.id = 'torn-pda-scripts-container';
        container.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:8px;';

        const headerMenu = hamburger.closest('.header-menu, [class*="header-menu"]');
        if (headerMenu) {
            headerMenu.insertAdjacentElement('afterend', container);
        } else {
            hamburger.insertAdjacentElement('afterend', container);
        }

        return container;
    }

    function ensureHeaderButton() {
        const btnId = 'pda-script-btn-chain-guard';
        if (document.getElementById(btnId)) return true;

        const container = getOrCreateSharedContainer();
        if (!container) return false;

        const btn = document.createElement('button');
        btn.id = btnId;
        btn.type = 'button';
        btn.title = 'Chain Guard settings';
        btn.setAttribute('aria-label', 'Chain Guard settings');
        btn.textContent = '🛡️';
        btn.style.cssText = `
            display:flex;align-items:center;justify-content:center;
            width:32px;height:32px;background:transparent;
            border:1px solid ${TORN.border};border-radius:4px;
            color:${TORN.text};font-size:16px;cursor:pointer;
            transition:all 0.2s;padding:0;
        `;
        btn.addEventListener('click', openSettings);

        // Touch feedback
        btn.addEventListener('touchstart', () => {
            btn.style.background = TORN.panelHover;
            btn.style.borderColor = TORN.green;
        });
        btn.addEventListener('touchend', () => {
            setTimeout(() => {
                btn.style.background = 'transparent';
                btn.style.borderColor = TORN.border;
            }, 200);
        });

        container.appendChild(btn);
        log('Added header button');
        return true;
    }

    function updateGuard() {
        const isAttackPage = window.location.href.includes('sid=attack');
        const inDangerZone = isInDangerZone();
        const ignored = isGuardIgnored();

        ensureHeaderButton();

        if (lastDangerZoneState !== inDangerZone) {
            log(inDangerZone ? 'Entered danger zone' : 'Exited danger zone');
            lastDangerZoneState = inDangerZone;
        }

        if (inDangerZone && !ignored) {
            createWarningBanner();
            if (isAttackPage) {
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
            if (threshold > 0) {
                saveSettings({ threshold });
                ignoredBonusThreshold = null;
                log('Settings saved:', { threshold });
                updateGuard();
            }
            closePanel();
        };
    }

    // Poll for header button availability (separate from chain polling)
    let headerButtonPollInterval = null;
    function startHeaderButtonPolling() {
        if (headerButtonPollInterval) return;
        
        headerButtonPollInterval = setInterval(() => {
            if (ensureHeaderButton()) {
                // Success! Stop polling
                clearInterval(headerButtonPollInterval);
                headerButtonPollInterval = null;
                log('Header button attached successfully');
            }
        }, 500);
        
        // Stop after 30 seconds to avoid infinite polling
        setTimeout(() => {
            if (headerButtonPollInterval) {
                clearInterval(headerButtonPollInterval);
                headerButtonPollInterval = null;
                logDebug('Header button polling timeout - header may not be present on this page');
            }
        }, 30000);
    }

    function init() {
        log('Init start');
        ensureStyles();
        loadChainCache();
        startHeaderButtonPolling();  // Start dedicated polling for button
        ensurePolling();
        parseChainFromDOM(true);
        updateGuard();

        log('Ready. Current chain:', chainState.amount, '/', chainState.max, 'source:', chainState.source);
        logDebug('Ready state', { url: window.location.href, chain: `${chainState.amount}/${chainState.max}`, source: chainState.source });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
