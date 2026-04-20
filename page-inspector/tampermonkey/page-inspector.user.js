// ==UserScript==
// @name         Torn Page Inspector
// @namespace    torn-page-inspector
// @version      1.1.0
// @description  Extract Torn page HTML, CSS, and computed styles with native Torn styling
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/page-inspector/tampermonkey/page-inspector.meta.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/page-inspector/tampermonkey/page-inspector.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @run-at       document-end
// ==/UserScript==

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  Torn Page Inspector v1.1.0                             ║
 * ║  Native Torn-styled inspection tools for userscripts    ║
 * ╚══════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    const SCRIPT_CONFIG = {
        id: 'page-inspector',
        name: 'Torn Page Inspector',
        version: '1.1.0'
    };

    const CONFIG = {
        MAX_INLINE_STYLES: 50,
        MAX_CSS_RULES: 1000,
        MAX_ELEMENTS_SAMPLE: 100,
        INCLUDE_EXTERNAL_CSS: true
    };

    // ═══════════════════════════════════════════════════════════
    // TORN NATIVE COLORS
    // ═══════════════════════════════════════════════════════════
    const TORN = {
        bg: '#444',
        panel: '#333',
        panelHover: '#555',
        text: '#ddd',
        textMuted: '#999',
        green: '#82c91e',
        blue: '#74c0fc',
        red: '#E54C19',
        yellow: '#F08C00',
        border: '#444',
        borderLight: '#555',
        headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)',
        buttonGradient: 'linear-gradient(180deg, #111 0%, #555 25%, #333 60%, #333 78%, #111 100%)',
        buttonHoverGradient: 'linear-gradient(180deg, #333 0%, #777 25%, #555 59%, #666 78%, #333 100%)'
    };

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    let elementPickerActive = false;
    let pickerClickHandler = null;
    let pickerHighlightHandler = null;

    function log(...args) {
        console.log('[Page Inspector]', ...args);
    }

    // ═══════════════════════════════════════════════════════════
    // STYLES
    // ═══════════════════════════════════════════════════════════
    function injectStyles() {
        const styleId = `${SCRIPT_CONFIG.id}-styles`;
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #torn-inspector-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 320px;
                background: ${TORN.panel};
                border: 1px solid ${TORN.borderLight};
                border-radius: 4px;
                z-index: 999999;
                font-family: Arial, sans-serif;
                color: ${TORN.text};
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                overflow: hidden;
            }

            #torn-inspector-panel .ti-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: ${TORN.headerGradient};
                border-bottom: 1px solid ${TORN.border};
                font-weight: bold;
                color: #fff;
                text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
            }

            #torn-inspector-panel .ti-close {
                background: transparent;
                border: none;
                color: ${TORN.textMuted};
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }

            #torn-inspector-panel .ti-close:hover {
                color: #fff;
            }

            #torn-inspector-panel .ti-content {
                padding: 16px;
            }

            #torn-inspector-panel .ti-section {
                margin-bottom: 14px;
            }

            #torn-inspector-panel .ti-section:last-of-type {
                margin-bottom: 0;
            }

            #torn-inspector-panel .ti-btn {
                width: 100%;
                padding: 10px 12px;
                background: ${TORN.buttonGradient};
                border: 1px solid #111;
                border-radius: 3px;
                color: #eee;
                cursor: pointer;
                font-size: 13px;
                font-weight: bold;
                text-shadow: 0 0 5px #000;
            }

            #torn-inspector-panel .ti-btn:hover {
                background: ${TORN.buttonHoverGradient};
                color: #fff;
            }

            #torn-inspector-panel .ti-btn-primary {
                border-color: ${TORN.green};
            }

            #torn-inspector-panel .ti-hint {
                margin: 6px 0 0;
                font-size: 11px;
                color: ${TORN.textMuted};
            }

            #torn-inspector-panel .ti-status {
                margin-top: 12px;
                padding: 10px 12px;
                background: rgba(0, 0, 0, 0.18);
                border: 1px solid ${TORN.border};
                border-radius: 4px;
                font-size: 12px;
                min-height: 20px;
                display: none;
            }

            #torn-inspector-panel .ti-status.show {
                display: block;
            }

            #torn-inspector-panel .ti-status.success {
                border-left: 3px solid ${TORN.green};
            }

            #torn-inspector-panel .ti-status.error {
                border-left: 3px solid ${TORN.red};
            }

            #torn-inspector-trigger {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 44px;
                height: 44px;
                background: ${TORN.buttonGradient};
                border: 1px solid #111;
                border-radius: 50%;
                color: #eee;
                font-size: 18px;
                cursor: pointer;
                z-index: 999998;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
                text-shadow: 0 0 5px #000;
            }

            #torn-inspector-trigger:hover {
                background: ${TORN.buttonHoverGradient};
                border-color: ${TORN.green};
                color: #fff;
            }

            .ti-picker-active * {
                cursor: crosshair !important;
            }

            .ti-picker-highlight {
                outline: 2px solid ${TORN.green} !important;
                outline-offset: 2px !important;
            }
        `;

        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════════
    // UI
    // ═══════════════════════════════════════════════════════════
    function createPanel() {
        const existing = document.getElementById('torn-inspector-panel');
        if (existing) return existing;

        const panel = document.createElement('div');
        panel.id = 'torn-inspector-panel';
        panel.innerHTML = `
            <div class="ti-header">
                <span>🔍 ${SCRIPT_CONFIG.name}</span>
                <button type="button" class="ti-close" aria-label="Close inspector">×</button>
            </div>
            <div class="ti-content">
                <div class="ti-section">
                    <button type="button" class="ti-btn ti-btn-primary" data-action="full">📋 Copy Full Page Dump</button>
                    <p class="ti-hint">HTML + CSS + computed styles (comprehensive)</p>
                </div>
                <div class="ti-section">
                    <button type="button" class="ti-btn" data-action="html">📄 Copy HTML Only</button>
                    <p class="ti-hint">Clean DOM structure</p>
                </div>
                <div class="ti-section">
                    <button type="button" class="ti-btn" data-action="css">🎨 Copy CSS Only</button>
                    <p class="ti-hint">All stylesheets and inline styles</p>
                </div>
                <div class="ti-section">
                    <button type="button" class="ti-btn" data-action="element">🎯 Copy Element Under Cursor</button>
                    <p class="ti-hint">Click an element after enabling picker mode</p>
                </div>
                <div class="ti-section">
                    <button type="button" class="ti-btn" data-action="sidebar">📊 Copy Sidebar Only</button>
                    <p class="ti-hint">Just the sidebar (bars, quick links)</p>
                </div>
                <div class="ti-status"></div>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    function createTriggerButton() {
        const existing = document.getElementById('torn-inspector-trigger');
        if (existing) return existing;

        const button = document.createElement('button');
        button.id = 'torn-inspector-trigger';
        button.type = 'button';
        button.textContent = '🔍';
        button.title = SCRIPT_CONFIG.name;
        document.body.appendChild(button);
        return button;
    }

    function getStatusElement() {
        return document.querySelector('#torn-inspector-panel .ti-status');
    }

    function showStatus(message, isError = false) {
        const status = getStatusElement();
        if (!status) return;

        status.textContent = message;
        status.className = `ti-status show ${isError ? 'error' : 'success'}`;
        setTimeout(() => status.classList.remove('show'), 5000);
    }

    function togglePanel(forceOpen = false) {
        const panel = createPanel();
        const shouldShow = forceOpen || panel.style.display === 'none';
        panel.style.display = shouldShow ? 'block' : 'none';
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRACTION
    // ═══════════════════════════════════════════════════════════
    function getExternalStylesheets() {
        const css = [];
        const sheets = Array.from(document.styleSheets);

        sheets.forEach((sheet) => {
            try {
                const rules = Array.from(sheet.cssRules || sheet.rules || []);
                const limitedRules = rules.slice(0, CONFIG.MAX_CSS_RULES);
                css.push(`/* Stylesheet: ${sheet.href || 'inline'} */`);
                css.push(limitedRules.map((rule) => rule.cssText).join('\n'));
            } catch {
                if (sheet.href) {
                    css.push(`/* External stylesheet (CORS): ${sheet.href} */`);
                }
            }
        });

        return css.join('\n\n');
    }

    function getInlineStyles() {
        const styles = Array.from(document.querySelectorAll('style'));
        const limited = styles.slice(0, CONFIG.MAX_INLINE_STYLES);
        return limited.map((styleBlock, index) => `/* Inline style block ${index + 1} */\n${styleBlock.textContent}`).join('\n\n');
    }

    function getAllCSS() {
        const parts = [];

        if (CONFIG.INCLUDE_EXTERNAL_CSS) {
            parts.push('/* ===== EXTERNAL STYLESHEETS ===== */');
            parts.push(getExternalStylesheets());
        }

        parts.push('\n\n/* ===== INLINE STYLE BLOCKS ===== */');
        parts.push(getInlineStyles());

        parts.push('\n\n/* ===== ELEMENT INLINE STYLES (sample) ===== */');
        Array.from(document.querySelectorAll('[style]')).slice(0, 20).forEach((element) => {
            const selector = getUniqueSelector(element);
            parts.push(`${selector} { ${element.getAttribute('style')} }`);
        });

        return parts.join('\n');
    }

    function getComputedStylesForElement(element) {
        const computed = window.getComputedStyle(element);
        const importantProperties = [
            'display', 'position', 'width', 'height', 'background', 'color',
            'font-size', 'font-family', 'padding', 'margin', 'border',
            'flex', 'grid', 'z-index', 'visibility', 'opacity'
        ];

        const styles = {};
        importantProperties.forEach((property) => {
            const value = computed.getPropertyValue(property);
            if (value && value !== 'initial' && value !== 'auto' && value !== 'normal') {
                styles[property] = value;
            }
        });

        return styles;
    }

    function getUniqueSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\s+/).join('.');
            if (classes) return `.${classes}`;
        }
        return element.tagName.toLowerCase();
    }

    function getSampledElements() {
        const samples = [];
        const importantSelectors = [
            'body', '#mainContainer', '#sidebarroot', '[class*="sidebar"]',
            '[class*="header"]', '[class*="content"]', '[class*="panel"]',
            '[class*="chain"]', '[class*="bar-"]'
        ];

        importantSelectors.forEach((selector) => {
            try {
                const elements = Array.from(document.querySelectorAll(selector)).slice(0, 5);
                elements.forEach((element) => {
                    if (samples.length >= CONFIG.MAX_ELEMENTS_SAMPLE) return;
                    samples.push({
                        selector: getUniqueSelector(element),
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id,
                        computed: getComputedStylesForElement(element),
                        html: element.outerHTML.substring(0, 500) + (element.outerHTML.length > 500 ? '...' : '')
                    });
                });
            } catch {
                // Ignore invalid selectors from Torn's changing DOM.
            }
        });

        return samples;
    }

    function cleanHTML() {
        const clone = document.documentElement.cloneNode(true);

        clone.querySelectorAll('#torn-inspector-panel, #torn-inspector-trigger, .ti-picker-highlight').forEach((element) => element.remove());
        clone.querySelectorAll('script').forEach((script) => script.remove());
        clone.querySelectorAll('.ti-picker-active').forEach((element) => element.classList.remove('ti-picker-active'));

        return clone.outerHTML;
    }

    function getSidebarHTML() {
        const sidebar = document.querySelector('#sidebarroot')
            || document.querySelector('[class*="sidebar"]')
            || document.querySelector('[class*="bars-mobile"]');

        return sidebar ? sidebar.outerHTML : '/* Sidebar not found */';
    }

    // ═══════════════════════════════════════════════════════════
    // FORMATTERS
    // ═══════════════════════════════════════════════════════════
    function formatFullDump() {
        return JSON.stringify({
            meta: {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                viewport: { width: window.innerWidth, height: window.innerHeight },
                userAgent: navigator.userAgent.substring(0, 100)
            },
            html: {
                bodyClasses: document.body.className,
                head: document.head.innerHTML.substring(0, 2000),
                body: cleanHTML().substring(0, 50000)
            },
            css: {
                external: getExternalStylesheets().substring(0, 20000),
                inline: getInlineStyles().substring(0, 10000)
            },
            samples: getSampledElements()
        }, null, 2);
    }

    function formatHTML() {
        return `<!DOCTYPE html>\n<!--\n  URL: ${window.location.href}\n  Title: ${document.title}\n  Captured: ${new Date().toISOString()}\n  Viewport: ${window.innerWidth}x${window.innerHeight}\n-->\n${cleanHTML()}`;
    }

    function formatCSS() {
        return `/*\n  CSS Dump for: ${window.location.href}\n  Captured: ${new Date().toISOString()}\n*/\n\n${getAllCSS()}`;
    }

    function formatElement(element) {
        const data = {
            selector: getUniqueSelector(element),
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            attributes: {},
            computed: getComputedStylesForElement(element),
            html: element.outerHTML,
            text: element.textContent?.substring(0, 500)
        };

        Array.from(element.attributes).forEach((attribute) => {
            data.attributes[attribute.name] = attribute.value;
        });

        return JSON.stringify(data, null, 2);
    }

    function copyToClipboard(text, description) {
        GM_setClipboard(text, 'text');
        const sizeKB = (text.length / 1024).toFixed(1);
        showStatus(`✅ ${description} copied! (${sizeKB} KB) Ready to paste.`);
    }

    // ═══════════════════════════════════════════════════════════
    // ELEMENT PICKER
    // ═══════════════════════════════════════════════════════════
    function clearHighlights() {
        document.querySelectorAll('.ti-picker-highlight').forEach((element) => {
            element.classList.remove('ti-picker-highlight');
        });
    }

    function cleanupElementPicker() {
        if (pickerClickHandler) {
            document.removeEventListener('click', pickerClickHandler, true);
            pickerClickHandler = null;
        }

        if (pickerHighlightHandler) {
            document.removeEventListener('mouseover', pickerHighlightHandler, true);
            pickerHighlightHandler = null;
        }

        elementPickerActive = false;
        document.body.classList.remove('ti-picker-active');
        clearHighlights();
    }

    function activateElementPicker() {
        cleanupElementPicker();
        elementPickerActive = true;
        document.body.classList.add('ti-picker-active');
        showStatus('🎯 Click any element to inspect it...');

        pickerClickHandler = (event) => {
            if (!elementPickerActive) return;
            event.preventDefault();
            event.stopPropagation();
            copyToClipboard(formatElement(event.target), 'Element info');
            cleanupElementPicker();
        };

        pickerHighlightHandler = (event) => {
            if (!elementPickerActive) return;
            clearHighlights();
            event.target.classList.add('ti-picker-highlight');
        };

        document.addEventListener('click', pickerClickHandler, true);
        document.addEventListener('mouseover', pickerHighlightHandler, true);
    }

    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    function init() {
        injectStyles();

        const panel = createPanel();
        const trigger = createTriggerButton();

        trigger.addEventListener('click', () => togglePanel());
        panel.querySelector('.ti-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        panel.querySelectorAll('[data-action]').forEach((button) => {
            button.addEventListener('click', () => {
                try {
                    switch (button.dataset.action) {
                        case 'full':
                            copyToClipboard(formatFullDump(), 'Full page dump');
                            break;
                        case 'html':
                            copyToClipboard(formatHTML(), 'HTML');
                            break;
                        case 'css':
                            copyToClipboard(formatCSS(), 'CSS');
                            break;
                        case 'element':
                            panel.style.display = 'none';
                            activateElementPicker();
                            return;
                        case 'sidebar':
                            copyToClipboard(getSidebarHTML(), 'Sidebar HTML');
                            break;
                    }
                } catch (error) {
                    showStatus(`❌ Error: ${error.message}`, true);
                }
            });
        });

        panel.style.display = 'none';
        GM_registerMenuCommand(`${SCRIPT_CONFIG.name} Toggle Panel`, () => togglePanel(true));
        log(`v${SCRIPT_CONFIG.version} ready`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
