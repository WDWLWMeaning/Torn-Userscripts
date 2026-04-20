// ==UserScript==
// @name         Torn Page Inspector
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Extract full page HTML, CSS, and computed styles for userscript development
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        maxInlineStyles: 50,      // Limit inline style elements
        maxCssRules: 1000,        // Limit CSS rules per stylesheet
        maxElementsSample: 100,   // Limit element samples with computed styles
        includeExternalCss: true, // Try to fetch external stylesheets
    };

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'torn-inspector-panel';
        panel.innerHTML = `
            <div class="ti-header">
                <span>🔍 Torn Page Inspector</span>
                <button class="ti-close">×</button>
            </div>
            <div class="ti-content">
                <div class="ti-section">
                    <button class="ti-btn ti-btn-primary" data-action="full">📋 Copy Full Page Dump</button>
                    <p class="ti-hint">HTML + CSS + computed styles (comprehensive)</p>
                </div>
                <div class="ti-section">
                    <button class="ti-btn" data-action="html">📄 Copy HTML Only</button>
                    <p class="ti-hint">Clean DOM structure</p>
                </div>
                <div class="ti-section">
                    <button class="ti-btn" data-action="css">🎨 Copy CSS Only</button>
                    <p class="ti-hint">All stylesheets and inline styles</p>
                </div>
                <div class="ti-section">
                    <button class="ti-btn" data-action="element">🎯 Copy Element Under Cursor</button>
                    <p class="ti-hint">Click element after clicking this</p>
                </div>
                <div class="ti-section">
                    <button class="ti-btn" data-action="sidebar">📊 Copy Sidebar Only</button>
                    <p class="ti-hint">Just the sidebar (bars, quick links)</p>
                </div>
                <div class="ti-status"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Inject styles
        GM_addStyle(`
            #torn-inspector-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 300px;
                background: #191919;
                border: 1px solid #333;
                border-radius: 8px;
                z-index: 999999;
                font-family: Arial, sans-serif;
                color: #ddd;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            .ti-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #222;
                border-radius: 8px 8px 0 0;
                font-weight: bold;
                border-bottom: 1px solid #333;
            }
            .ti-close {
                background: transparent;
                border: none;
                color: #999;
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            .ti-close:hover { color: #fff; }
            .ti-content { padding: 16px; }
            .ti-section { margin-bottom: 16px; }
            .ti-section:last-child { margin-bottom: 0; }
            .ti-btn {
                width: 100%;
                padding: 10px;
                background: #333;
                border: 1px solid #444;
                color: #ddd;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            .ti-btn:hover {
                background: #444;
                border-color: #555;
            }
            .ti-btn-primary {
                background: #2b4a1e;
                border-color: #82c91e;
            }
            .ti-btn-primary:hover {
                background: #3a5f28;
            }
            .ti-hint {
                margin: 6px 0 0 0;
                font-size: 11px;
                color: #777;
            }
            .ti-status {
                margin-top: 12px;
                padding: 10px;
                background: #222;
                border-radius: 4px;
                font-size: 12px;
                min-height: 20px;
                display: none;
            }
            .ti-status.show { display: block; }
            .ti-status.success { border-left: 3px solid #82c91e; }
            .ti-status.error { border-left: 3px solid #E54C19; }

            /* Element picker highlight */
            .ti-picker-active * {
                cursor: crosshair !important;
            }
            .ti-picker-highlight {
                outline: 2px solid #82c91e !important;
                outline-offset: 2px !important;
            }
        `);

        return panel;
    }

    function createTriggerButton() {
        const btn = document.createElement('button');
        btn.id = 'torn-inspector-trigger';
        btn.textContent = '🔍';
        btn.title = 'Torn Page Inspector';
        GM_addStyle(`
            #torn-inspector-trigger {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 44px;
                height: 44px;
                background: #191919;
                border: 1px solid #444;
                border-radius: 50%;
                color: #ddd;
                font-size: 18px;
                cursor: pointer;
                z-index: 999998;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                transition: all 0.2s;
            }
            #torn-inspector-trigger:hover {
                background: #333;
                border-color: #82c91e;
            }
        `);
        document.body.appendChild(btn);
        return btn;
    }

    // ==================== EXTRACTION FUNCTIONS ====================

    function getExternalStylesheets() {
        const css = [];
        const sheets = Array.from(document.styleSheets);

        sheets.forEach(sheet => {
            try {
                const rules = Array.from(sheet.cssRules || sheet.rules || []);
                const limitedRules = rules.slice(0, CONFIG.maxCssRules);
                css.push(`/* Stylesheet: ${sheet.href || 'inline'} */`);
                css.push(limitedRules.map(r => r.cssText).join('\n'));
            } catch (e) {
                // Cross-origin stylesheet - can't read rules
                if (sheet.href) {
                    css.push(`/* External stylesheet (CORS): ${sheet.href} */`);
                }
            }
        });

        return css.join('\n\n');
    }

    function getInlineStyles() {
        const styles = Array.from(document.querySelectorAll('style'));
        const limited = styles.slice(0, CONFIG.maxInlineStyles);
        return limited.map((s, i) => `/* Inline style block ${i + 1} */\n${s.textContent}`).join('\n\n');
    }

    function getAllCSS() {
        const parts = [];

        // External stylesheets
        if (CONFIG.includeExternalCss) {
            parts.push('/* ===== EXTERNAL STYLESHEETS ===== */');
            parts.push(getExternalStylesheets());
        }

        // Inline styles
        parts.push('\n\n/* ===== INLINE STYLE BLOCKS ===== */');
        parts.push(getInlineStyles());

        // Inline element styles (style attributes)
        parts.push('\n\n/* ===== ELEMENT INLINE STYLES (sample) ===== */');
        const elementsWithStyle = Array.from(document.querySelectorAll('[style]')).slice(0, 20);
        elementsWithStyle.forEach(el => {
            const selector = getUniqueSelector(el);
            parts.push(`${selector} { ${el.getAttribute('style')} }`);
        });

        return parts.join('\n');
    }

    function getComputedStylesForElement(el) {
        const computed = window.getComputedStyle(el);
        const important = ['display', 'position', 'width', 'height', 'background', 'color',
                          'font-size', 'font-family', 'padding', 'margin', 'border',
                          'flex', 'grid', 'z-index', 'visibility', 'opacity'];

        const styles = {};
        important.forEach(prop => {
            const val = computed.getPropertyValue(prop);
            if (val && val !== 'initial' && val !== 'auto' && val !== 'normal') {
                styles[prop] = val;
            }
        });

        return styles;
    }

    function getUniqueSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).join('.');
            if (classes) return `.${classes}`;
        }
        return el.tagName.toLowerCase();
    }

    function getSampledElements() {
        const samples = [];
        const importantSelectors = [
            'body', '#mainContainer', '#sidebarroot', '[class*="sidebar"]',
            '[class*="header"]', '[class*="content"]', '[class*="panel"]',
            '[class*="chain"]', '[class*="bar-"]'
        ];

        importantSelectors.forEach(selector => {
            try {
                const els = Array.from(document.querySelectorAll(selector)).slice(0, 5);
                els.forEach(el => {
                    samples.push({
                        selector: getUniqueSelector(el),
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        computed: getComputedStylesForElement(el),
                        html: el.outerHTML.substring(0, 500) + (el.outerHTML.length > 500 ? '...' : '')
                    });
                });
            } catch (e) {}
        });

        return samples;
    }

    function cleanHTML() {
        const clone = document.documentElement.cloneNode(true);

        // Remove our inspector elements
        const inspector = clone.querySelector('#torn-inspector-panel');
        const trigger = clone.querySelector('#torn-inspector-trigger');
        if (inspector) inspector.remove();
        if (trigger) trigger.remove();

        // Remove scripts (they clutter the output)
        clone.querySelectorAll('script').forEach(s => s.remove());

        return clone.outerHTML;
    }

    function getSidebarHTML() {
        const sidebar = document.querySelector('#sidebarroot') ||
                       document.querySelector('[class*="sidebar"]') ||
                       document.querySelector('[class*="bars-mobile"]');
        return sidebar ? sidebar.outerHTML : '/* Sidebar not found */';
    }

    // ==================== OUTPUT FORMATTERS ====================

    function formatFullDump() {
        const data = {
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
                body: cleanHTML().substring(0, 50000) // Limit body size
            },
            css: {
                external: getExternalStylesheets().substring(0, 20000),
                inline: getInlineStyles().substring(0, 10000)
            },
            samples: getSampledElements()
        };

        return JSON.stringify(data, null, 2);
    }

    function formatHTML() {
        return `<!DOCTYPE html>
<!--
  URL: ${window.location.href}
  Title: ${document.title}
  Captured: ${new Date().toISOString()}
  Viewport: ${window.innerWidth}x${window.innerHeight}
-->
${cleanHTML()}`;
    }

    function formatCSS() {
        return `/*
  CSS Dump for: ${window.location.href}
  Captured: ${new Date().toISOString()}
*/

${getAllCSS()}`;
    }

    function formatElement(el) {
        const data = {
            selector: getUniqueSelector(el),
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            attributes: {},
            computed: getComputedStylesForElement(el),
            html: el.outerHTML,
            text: el.textContent?.substring(0, 500)
        };

        // Get all attributes
        Array.from(el.attributes).forEach(attr => {
            data.attributes[attr.name] = attr.value;
        });

        return JSON.stringify(data, null, 2);
    }

    // ==================== UI HANDLERS ====================

    let elementPickerActive = false;

    function showStatus(message, isError = false) {
        const status = document.querySelector('.ti-status');
        status.textContent = message;
        status.className = `ti-status show ${isError ? 'error' : 'success'}`;
        setTimeout(() => status.classList.remove('show'), 5000);
    }

    function copyToClipboard(text, description) {
        GM_setClipboard(text, 'text');
        const sizeKB = (text.length / 1024).toFixed(1);
        showStatus(`✅ ${description} copied! (${sizeKB} KB) Ready to paste.`);
    }

    function activateElementPicker() {
        elementPickerActive = true;
        document.body.classList.add('ti-picker-active');
        showStatus('🎯 Click any element to inspect it...');

        const handler = (e) => {
            if (!elementPickerActive) return;
            e.preventDefault();
            e.stopPropagation();

            const el = e.target;
            copyToClipboard(formatElement(el), 'Element info');

            // Cleanup
            elementPickerActive = false;
            document.body.classList.remove('ti-picker-active');
            document.removeEventListener('click', handler, true);

            // Remove highlight
            document.querySelectorAll('.ti-picker-highlight').forEach(el => {
                el.classList.remove('ti-picker-highlight');
            });
        };

        const highlightHandler = (e) => {
            if (!elementPickerActive) return;
            document.querySelectorAll('.ti-picker-highlight').forEach(el => {
                el.classList.remove('ti-picker-highlight');
            });
            e.target.classList.add('ti-picker-highlight');
        };

        document.addEventListener('click', handler, true);
        document.addEventListener('mouseover', highlightHandler, true);
    }

    function init() {
        const panel = createPanel();
        const trigger = createTriggerButton();

        // Toggle panel
        trigger.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        // Close button
        panel.querySelector('.ti-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // Action buttons
        panel.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;

                try {
                    switch(action) {
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
                            return; // Don't show status yet
                        case 'sidebar':
                            copyToClipboard(getSidebarHTML(), 'Sidebar HTML');
                            break;
                    }
                } catch (e) {
                    showStatus(`❌ Error: ${e.message}`, true);
                }
            });
        });

        // Hide panel initially
        panel.style.display = 'none';

        console.log('[Torn Page Inspector] Ready! Click the 🔍 button to start.');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();