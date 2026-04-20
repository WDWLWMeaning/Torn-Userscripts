// ==UserScript==
// @name         Torn Page Inspector (PDA)
// @version      1.0.1
// @description  Extract full page HTML, CSS, and computed styles for userscript development (Torn PDA version)
// @author       Kevin
// @match        https://www.torn.com/*
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        maxInlineStyles: 50,
        maxCssRules: 1000,
        maxElementsSample: 100,
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
                    <p class="ti-hint">Tap element after tapping this</p>
                </div>
                <div class="ti-section">
                    <button class="ti-btn" data-action="sidebar">📊 Copy Sidebar Only</button>
                    <p class="ti-hint">Just the sidebar (bars, quick links)</p>
                </div>
                <div class="ti-status"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Inject styles (PDA-compatible, no GM_addStyle)
        const style = document.createElement('style');
        style.textContent = `
            #torn-inspector-panel {
                position: fixed !important;
                top: 80px !important;
                left: 10px !important;
                right: 10px !important;
                max-width: 400px;
                margin: 0 auto;
                background: #191919 !important;
                border: 1px solid #333 !important;
                border-radius: 8px !important;
                z-index: 999999 !important;
                font-family: Arial, sans-serif !important;
                color: #ddd !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
            }
            .ti-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #222 !important;
                border-radius: 8px 8px 0 0;
                font-weight: bold;
                border-bottom: 1px solid #333 !important;
            }
            .ti-close {
                background: transparent;
                border: none;
                color: #999;
                font-size: 20px;
                cursor: pointer;
                padding: 0 4px;
            }
            .ti-close:active { color: #fff; }
            .ti-content { padding: 16px; }
            .ti-section { margin-bottom: 16px; }
            .ti-section:last-child { margin-bottom: 0; }
            .ti-btn {
                width: 100%;
                padding: 12px;
                background: #333 !important;
                border: 1px solid #444 !important;
                color: #ddd !important;
                border-radius: 4px !important;
                cursor: pointer;
                font-size: 14px;
                -webkit-tap-highlight-color: transparent;
            }
            .ti-btn:active {
                background: #444 !important;
                border-color: #555 !important;
            }
            .ti-btn-primary {
                background: #2b4a1e !important;
                border-color: #82c91e !important;
            }
            .ti-btn-primary:active {
                background: #3a5f28 !important;
            }
            .ti-hint {
                margin: 6px 0 0 0;
                font-size: 11px;
                color: #777 !important;
            }
            .ti-status {
                margin-top: 12px;
                padding: 10px;
                background: #222 !important;
                border-radius: 4px;
                font-size: 12px;
                min-height: 20px;
                display: none;
                word-break: break-word;
            }
            .ti-status.show { display: block; }
            .ti-status.success { border-left: 3px solid #82c91e; }
            .ti-status.error { border-left: 3px solid #E54C19; }

            /* Element picker highlight */
            .ti-picker-active * {
                cursor: crosshair !important;
            }
            .ti-picker-highlight {
                outline: 3px solid #82c91e !important;
                outline-offset: 2px !important;
            }
        `;
        document.head.appendChild(style);

        return panel;
    }

    function createTriggerButton() {
        const btn = document.createElement('button');
        btn.id = 'torn-inspector-trigger';
        btn.textContent = '🔍';
        btn.title = 'Torn Page Inspector';

        const style = document.createElement('style');
        style.textContent = `
            #torn-inspector-trigger {
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                width: 50px !important;
                height: 50px !important;
                background: #191919 !important;
                border: 2px solid #444 !important;
                border-radius: 50% !important;
                color: #ddd !important;
                font-size: 20px !important;
                cursor: pointer;
                z-index: 999998 !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
                -webkit-tap-highlight-color: transparent;
            }
            #torn-inspector-trigger:active {
                background: #333 !important;
                border-color: #82c91e !important;
            }
        `;
        document.head.appendChild(style);
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
        parts.push('/* ===== EXTERNAL STYLESHEETS ===== */');
        parts.push(getExternalStylesheets());
        parts.push('\n\n/* ===== INLINE STYLE BLOCKS ===== */');
        parts.push(getInlineStyles());

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
        const inspector = clone.querySelector('#torn-inspector-panel');
        const trigger = clone.querySelector('#torn-inspector-trigger');
        if (inspector) inspector.remove();
        if (trigger) trigger.remove();
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
                body: cleanHTML().substring(0, 50000)
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

        Array.from(el.attributes).forEach(attr => {
            data.attributes[attr.name] = attr.value;
        });

        return JSON.stringify(data, null, 2);
    }

    // ==================== PDA CLIPBOARD WORKAROUND ====================

    function copyToClipboard(text, description) {
        const sizeKB = (text.length / 1024).toFixed(1);

        // Try multiple methods for PDA
        try {
            // Method 1: navigator.clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    showStatus(`✅ ${description} copied! (${sizeKB} KB) Ready to paste.`);
                }).catch(() => {
                    fallbackCopy(text, description, sizeKB);
                });
            } else {
                fallbackCopy(text, description, sizeKB);
            }
        } catch (e) {
            fallbackCopy(text, description, sizeKB);
        }
    }

    function fallbackCopy(text, description, sizeKB) {
        // Method 2: Create textarea and select
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const success = document.execCommand('copy');
            if (success) {
                showStatus(`✅ ${description} copied! (${sizeKB} KB) Ready to paste.`);
            } else {
                showFallback(text, description, sizeKB);
            }
        } catch (e) {
            showFallback(text, description, sizeKB);
        }

        document.body.removeChild(textarea);
    }

    function showFallback(text, description, sizeKB) {
        // Show modal with text for manual copy
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            padding: 20px;
        `;
        modal.innerHTML = `
            <div style="color: #82c91e; font-size: 16px; margin-bottom: 10px;">
                ⚠️ Auto-copy failed. Tap below, Select All, Copy:
            </div>
            <textarea style="flex: 1; font-family: monospace; font-size: 10px; background: #111; color: #ddd; border: 1px solid #444; padding: 10px;">${escapeHtml(text)}</textarea>
            <button style="margin-top: 10px; padding: 15px; background: #333; color: #ddd; border: 1px solid #444; border-radius: 4px; font-size: 14px;">Close</button>
        `;
        document.body.appendChild(modal);

        const textarea = modal.querySelector('textarea');
        textarea.focus();
        textarea.select();

        modal.querySelector('button').addEventListener('click', () => {
            modal.remove();
            showStatus(`${description} ready! (${sizeKB} KB)`);
        });
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ==================== UI HANDLERS ====================

    let elementPickerActive = false;

    function showStatus(message, isError = false) {
        const status = document.querySelector('.ti-status');
        status.textContent = message;
        status.className = `ti-status show ${isError ? 'error' : 'success'}`;
        setTimeout(() => status.classList.remove('show'), 5000);
    }

    function activateElementPicker() {
        elementPickerActive = true;
        document.body.classList.add('ti-picker-active');
        showStatus('🎯 Tap any element to inspect it...');

        const handler = (e) => {
            if (!elementPickerActive) return;
            e.preventDefault();
            e.stopPropagation();

            const el = e.target;
            copyToClipboard(formatElement(el), 'Element info');

            elementPickerActive = false;
            document.body.classList.remove('ti-picker-active');
            document.removeEventListener('click', handler, true);

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
        document.addEventListener('touchstart', (e) => {
            if (!elementPickerActive) return;
            document.querySelectorAll('.ti-picker-highlight').forEach(el => {
                el.classList.remove('ti-picker-highlight');
            });
            e.target.classList.add('ti-picker-highlight');
        }, {passive: true});
    }

    function init() {
        const panel = createPanel();
        const trigger = createTriggerButton();

        trigger.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        panel.querySelector('.ti-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });

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
                            return;
                        case 'sidebar':
                            copyToClipboard(getSidebarHTML(), 'Sidebar HTML');
                            break;
                    }
                } catch (e) {
                    showStatus(`❌ Error: ${e.message}`, true);
                }
            });
        });

        panel.style.display = 'none';

        console.log('[Torn Page Inspector PDA] Ready! Tap the 🔍 button to start.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();