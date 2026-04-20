// ==UserScript==
// @name         PDA Scripts Shared Settings Menu
// @namespace    torn-pda-shared-menu
// @version      1.0.0
// @description  Shared draggable settings menu for Torn PDA userscripts
// @author       Kevin
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// PDA Scripts Shared Settings Menu
// This script can be included by any PDA userscript - only creates menu once

(function() {
    'use strict';

    // If menu already exists (created by another script), don't recreate
    if (window.PDAScriptsMenu) {
        console.log('[PDA Menu] Already initialized by another script');
        return;
    }

    const MENU_ID = 'pda-shared-settings-menu';
    const BUTTON_ID = 'pda-shared-settings-btn';
    const POSITION_KEY = 'pda_shared_menu_position';
    const REGISTERED_SCRIPTS_KEY = 'pda_registered_scripts';

    const STYLES = {
        bg: '#2a2a2a',
        panel: '#333',
        panelHover: '#444',
        text: '#ddd',
        textMuted: '#999',
        border: '#555',
        accent: '#82c91e',
        danger: '#E54C19',
        warning: '#F08C00'
    };

    // Storage helpers
    function storageGet(key, fallback = '{}') {
        try {
            const value = localStorage.getItem(key);
            return value ?? fallback;
        } catch {
            return fallback;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {}
    }

    // Load/save position
    function loadPosition() {
        try {
            const saved = storageGet(POSITION_KEY, '{}');
            const pos = JSON.parse(saved);
            return { top: pos.top ?? 100, left: pos.left ?? 10 };
        } catch {
            return { top: 100, left: 10 };
        }
    }

    function savePosition(top, left) {
        storageSet(POSITION_KEY, JSON.stringify({ top, left }));
    }

    function clampToViewport(top, left, width = 44, height = 44) {
        const margin = 5;
        return {
            top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
            left: Math.max(margin, Math.min(left, window.innerWidth - width - margin))
        };
    }

    // Registered scripts storage
    function getRegisteredScripts() {
        try {
            return JSON.parse(storageGet(REGISTERED_SCRIPTS_KEY, '[]'));
        } catch {
            return [];
        }
    }

    function saveRegisteredScripts(scripts) {
        storageSet(REGISTERED_SCRIPTS_KEY, JSON.stringify(scripts));
    }

    // Global menu object
    window.PDAScriptsMenu = {
        _scripts: new Map(),
        _button: null,
        _dropdown: null,
        _isDragging: false,

        register(scriptId, scriptName, settingsConfig) {
            console.log('[PDA Menu] Registering:', scriptId);
            this._scripts.set(scriptId, {
                id: scriptId,
                name: scriptName,
                config: settingsConfig,
                values: this._loadScriptSettings(scriptId)
            });
            this._saveRegistration(scriptId, scriptName);
            this._updateDropdown();
        },

        unregister(scriptId) {
            this._scripts.delete(scriptId);
            this._updateDropdown();
        },

        getSetting(scriptId, key, defaultValue) {
            const script = this._scripts.get(scriptId);
            if (!script) return defaultValue;
            return script.values[key] ?? defaultValue;
        },

        setSetting(scriptId, key, value) {
            const script = this._scripts.get(scriptId);
            if (!script) return;
            script.values[key] = value;
            this._saveScriptSettings(scriptId, script.values);
            
            // Notify callback if exists
            if (script.config.onChange) {
                script.config.onChange(key, value);
            }
        },

        _loadScriptSettings(scriptId) {
            try {
                return JSON.parse(storageGet(`pda_script_${scriptId}_settings`, '{}'));
            } catch {
                return {};
            }
        },

        _saveScriptSettings(scriptId, values) {
            storageSet(`pda_script_${scriptId}_settings`, JSON.stringify(values));
        },

        _saveRegistration(id, name) {
            const registered = getRegisteredScripts();
            if (!registered.find(s => s.id === id)) {
                registered.push({ id, name, registeredAt: Date.now() });
                saveRegisteredScripts(registered);
            }
        },

        _ensureButton() {
            if (this._button) return this._button;

            const existing = document.getElementById(BUTTON_ID);
            if (existing) {
                this._button = existing;
                return this._button;
            }

            const btn = document.createElement('button');
            btn.id = BUTTON_ID;
            btn.type = 'button';
            btn.title = 'PDA Scripts Settings (hold to drag)';
            btn.innerHTML = '⚙️';

            const pos = clampToViewport(...Object.values(loadPosition()));
            btn.style.cssText = `
                position: fixed;
                top: ${pos.top}px;
                left: ${pos.left}px;
                z-index: 99999;
                width: 44px;
                height: 44px;
                background: ${STYLES.bg};
                border: 2px solid ${STYLES.border};
                border-radius: 8px;
                color: ${STYLES.text};
                font-size: 22px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 3px 12px rgba(0,0,0,0.4);
                transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
                touch-action: none;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            `;

            // Drag handling
            let dragStartTime = 0;
            let startX, startY, startTop, startLeft;
            const DRAG_THRESHOLD = 300;

            const startDrag = (clientX, clientY) => {
                this._isDragging = true;
                btn.style.cursor = 'grabbing';
                btn.style.transition = 'none';
                btn.style.boxShadow = `0 5px 20px rgba(130, 201, 30, 0.5)`;
                btn.style.borderColor = STYLES.accent;
                startX = clientX;
                startY = clientY;
                startTop = parseInt(btn.style.top, 10);
                startLeft = parseInt(btn.style.left, 10);
            };

            const moveDrag = (clientX, clientY) => {
                if (!this._isDragging) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                const clamped = clampToViewport(startTop + dy, startLeft + dx);
                btn.style.top = clamped.top + 'px';
                btn.style.left = clamped.left + 'px';
            };

            const endDrag = () => {
                if (!this._isDragging) return;
                this._isDragging = false;
                btn.style.cursor = 'pointer';
                btn.style.transition = 'transform 0.15s, box-shadow 0.15s, border-color 0.15s';
                btn.style.boxShadow = '0 3px 12px rgba(0,0,0,0.4)';
                btn.style.borderColor = STYLES.border;
                savePosition(parseInt(btn.style.top, 10), parseInt(btn.style.left, 10));
            };

            // Mouse events
            btn.addEventListener('mousedown', (e) => {
                dragStartTime = Date.now();
                const timer = setTimeout(() => {
                    if (Date.now() - dragStartTime >= DRAG_THRESHOLD - 50) {
                        startDrag(e.clientX, e.clientY);
                    }
                }, DRAG_THRESHOLD);

                const onMove = (e) => moveDrag(e.clientX, e.clientY);
                const onUp = () => {
                    clearTimeout(timer);
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    endDrag();
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            // Touch events
            btn.addEventListener('touchstart', (e) => {
                dragStartTime = Date.now();
                const touch = e.touches[0];
                const timer = setTimeout(() => {
                    if (Date.now() - dragStartTime >= DRAG_THRESHOLD - 50) {
                        startDrag(touch.clientX, touch.clientY);
                    }
                }, DRAG_THRESHOLD);

                const onMove = (e) => {
                    const touch = e.touches[0];
                    moveDrag(touch.clientX, touch.clientY);
                };
                const onEnd = () => {
                    clearTimeout(timer);
                    document.removeEventListener('touchmove', onMove);
                    document.removeEventListener('touchend', onEnd);
                    endDrag();
                };
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onEnd);
            }, { passive: true });

            // Click to open dropdown
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (Date.now() - dragStartTime < DRAG_THRESHOLD && !this._isDragging) {
                    this._toggleDropdown();
                }
            });

            // Hover effects
            btn.addEventListener('mouseenter', () => {
                if (!this._isDragging) {
                    btn.style.transform = 'scale(1.05)';
                    btn.style.borderColor = STYLES.accent;
                }
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                if (!this._dropdown?.classList.contains('open')) {
                    btn.style.borderColor = STYLES.border;
                }
            });

            document.body.appendChild(btn);
            this._button = btn;
            return btn;
        },

        _toggleDropdown() {
            if (this._dropdown) {
                this._dropdown.remove();
                this._dropdown = null;
                return;
            }
            this._showDropdown();
        },

        _showDropdown() {
            const dropdown = document.createElement('div');
            dropdown.id = MENU_ID;
            dropdown.className = 'open';

            const btnRect = this._button.getBoundingClientRect();
            const dropdownWidth = 320;

            let left = btnRect.left;
            if (left + dropdownWidth > window.innerWidth - 10) {
                left = window.innerWidth - dropdownWidth - 10;
            }

            dropdown.style.cssText = `
                position: fixed;
                top: ${btnRect.bottom + 8}px;
                left: ${left}px;
                width: ${dropdownWidth}px;
                max-height: 80vh;
                background: ${STYLES.bg};
                border: 1px solid ${STYLES.border};
                border-radius: 8px;
                z-index: 99998;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: Arial, sans-serif;
                color: ${STYLES.text};
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 12px 16px;
                border-bottom: 1px solid ${STYLES.border};
                font-weight: bold;
                font-size: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(180deg, #3a3a3a 0%, ${STYLES.bg} 100%);
                border-radius: 8px 8px 0 0;
            `;
            header.innerHTML = `<span>🎮 PDA Scripts</span><span style="color:${STYLES.textMuted};font-size:12px;font-weight:normal">${this._scripts.size} active</span>`;
            dropdown.appendChild(header);

            // Scripts sections
            if (this._scripts.size === 0) {
                const empty = document.createElement('div');
                empty.style.cssText = `padding: 24px; text-align: center; color: ${STYLES.textMuted};`;
                empty.textContent = 'No scripts registered';
                dropdown.appendChild(empty);
            } else {
                this._scripts.forEach((script, id) => {
                    dropdown.appendChild(this._createScriptSection(script));
                });
            }

            // Close on outside click
            const closeOnOutside = (e) => {
                if (!dropdown.contains(e.target) && e.target !== this._button) {
                    dropdown.remove();
                    this._dropdown = null;
                    document.removeEventListener('click', closeOnOutside);
                }
            };
            setTimeout(() => document.addEventListener('click', closeOnOutside), 0);

            document.body.appendChild(dropdown);
            this._dropdown = dropdown;
        },

        _createScriptSection(script) {
            const section = document.createElement('div');
            section.style.cssText = `border-bottom: 1px solid ${STYLES.border};`;

            // Script header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 10px 16px;
                background: ${STYLES.panel};
                font-weight: bold;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            header.textContent = script.name;
            section.appendChild(header);

            // Settings fields
            const body = document.createElement('div');
            body.style.cssText = 'padding: 12px 16px;';

            if (script.config.fields) {
                script.config.fields.forEach(field => {
                    body.appendChild(this._createField(script, field));
                });
            }

            section.appendChild(body);
            return section;
        },

        _createField(script, field) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'margin-bottom: 12px;';

            const label = document.createElement('label');
            label.style.cssText = `
                display: block;
                font-size: 12px;
                color: ${STYLES.textMuted};
                margin-bottom: 4px;
            `;
            label.textContent = field.label;
            wrapper.appendChild(label);

            const currentValue = this.getSetting(script.id, field.key, field.default);

            if (field.type === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.value = currentValue;
                input.style.cssText = `
                    width: 100%;
                    padding: 8px 10px;
                    background: ${STYLES.panel};
                    border: 1px solid ${STYLES.border};
                    border-radius: 4px;
                    color: ${STYLES.text};
                    font-size: 13px;
                    box-sizing: border-box;
                `;
                input.addEventListener('change', () => {
                    this.setSetting(script.id, field.key, parseInt(input.value) || field.default);
                });
                wrapper.appendChild(input);

            } else if (field.type === 'toggle') {
                const toggle = document.createElement('button');
                toggle.textContent = currentValue ? '✅ Enabled' : '❌ Disabled';
                toggle.style.cssText = `
                    padding: 6px 12px;
                    background: ${currentValue ? STYLES.accent : STYLES.panel};
                    border: 1px solid ${STYLES.border};
                    border-radius: 4px;
                    color: ${STYLES.text};
                    cursor: pointer;
                    font-size: 12px;
                `;
                toggle.addEventListener('click', () => {
                    const newValue = !this.getSetting(script.id, field.key, field.default);
                    this.setSetting(script.id, field.key, newValue);
                    toggle.textContent = newValue ? '✅ Enabled' : '❌ Disabled';
                    toggle.style.background = newValue ? STYLES.accent : STYLES.panel;
                });
                wrapper.appendChild(toggle);

            } else if (field.type === 'select') {
                const select = document.createElement('select');
                select.style.cssText = `
                    width: 100%;
                    padding: 8px 10px;
                    background: ${STYLES.panel};
                    border: 1px solid ${STYLES.border};
                    border-radius: 4px;
                    color: ${STYLES.text};
                    font-size: 13px;
                `;
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    option.selected = opt.value === currentValue;
                    select.appendChild(option);
                });
                select.addEventListener('change', () => {
                    this.setSetting(script.id, field.key, select.value);
                });
                wrapper.appendChild(select);
            }

            return wrapper;
        },

        _updateDropdown() {
            if (this._dropdown) {
                this._dropdown.remove();
                this._dropdown = null;
                this._showDropdown();
            }
        }
    };

    // Initialize button on load
    function initMenu() {
        if (window.PDAScriptsMenu._button) return; // Already initialized
        window.PDAScriptsMenu._ensureButton();
        console.log('[PDA Menu] Shared settings menu initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMenu);
    } else {
        initMenu();
    }
})();

// Global function for scripts to ensure menu exists
// Scripts can call: ensurePDASharedMenu();
window.ensurePDASharedMenu = function() {
    if (window.PDAScriptsMenu) return Promise.resolve(window.PDAScriptsMenu);
    
    // Wait for menu to be created by another script
    return new Promise((resolve) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            if (window.PDAScriptsMenu) {
                clearInterval(checkInterval);
                resolve(window.PDAScriptsMenu);
            }
            if (++attempts > 50) { // 5 second timeout
                clearInterval(checkInterval);
                console.error('[PDA Menu] Timeout waiting for shared menu');
                resolve(null);
            }
        }, 100);
    });
};