// ==UserScript==
// @name         Torn Settings Dropdown
// @namespace    torn-settings-dropdown
// @version      1.0.1
// @description  Adds a settings dropdown button to the header (right of search)
// @author       You
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const LEFT_MENU_SELECTOR = '.header-menu.left.leftMenu___md3Ch';

    function addSettingsDropdown() {
        const leftMenu = document.querySelector(LEFT_MENU_SELECTOR);
        if (!leftMenu) return false;
        if (leftMenu.querySelector('.torn-settings-wrapper')) return true;

        // Create wrapper div for the settings button (inside the left menu div)
        const wrapper = document.createElement('div');
        wrapper.className = 'torn-settings-wrapper';
        wrapper.style.cssText = 'display: inline-block; vertical-align: top; position: relative;';

        // Create button - use header-menu-icon class to match hamburger button styling
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'top_header_button header-menu-icon torn-settings-btn';
        button.setAttribute('aria-label', 'Settings');
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.24 4.24l-4.24-4.24M6.34 6.34L2.1 2.1"></path>
            </svg>
        `;

        // Create dropdown menu
        const dropdown = document.createElement('ul');
        dropdown.className = 'torn-settings-menu';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
            min-width: 180px;
            padding: 8px 0;
            margin: 4px 0 0 0;
            list-style: none;
            z-index: 9999;
        `;

        // Add menu items
        const menuItems = [
            { text: 'Option 1', action: () => console.log('Option 1 clicked') },
            { text: 'Option 2', action: () => console.log('Option 2 clicked') },
            { text: 'Option 3', action: () => console.log('Option 3 clicked') },
        ];

        menuItems.forEach(item => {
            const menuLi = document.createElement('li');
            menuLi.style.cssText = 'padding: 0;';

            const link = document.createElement('a');
            link.href = '#';
            link.textContent = item.text;
            link.style.cssText = `
                display: block;
                padding: 8px 16px;
                color: #ccc;
                text-decoration: none;
                font-family: Arial, sans-serif;
                font-size: 13px;
            `;
            link.addEventListener('mouseenter', () => link.style.background = '#333');
            link.addEventListener('mouseleave', () => link.style.background = 'transparent');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                item.action();
                dropdown.style.display = 'none';
            });

            menuLi.appendChild(link);
            dropdown.appendChild(menuLi);
        });

        // Toggle dropdown on button click
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });

        wrapper.appendChild(button);
        wrapper.appendChild(dropdown);

        // Insert at the beginning of the left menu (before menu-items if present)
        const menuItems = leftMenu.querySelector('.menu-items');
        if (menuItems) {
            leftMenu.insertBefore(wrapper, menuItems);
        } else {
            leftMenu.appendChild(wrapper);
        }

        console.log('[Settings Dropdown] Added to left menu');
        return true;
    }

    function init() {
        if (addSettingsDropdown()) return;

        const observer = new MutationObserver((mutations, obs) => {
            if (addSettingsDropdown()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => observer.disconnect(), 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();