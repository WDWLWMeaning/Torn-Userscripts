# Torn Userscript Examples

## Example 1: Player Stats Overlay

Display battle stats on profile pages:

```javascript
// ==UserScript==
// @name         Torn Profile Stats
// @namespace    torn-profile-stats
// @version      1.0
// @description  Show battle stats on player profiles
// @author       You
// @match        https://www.torn.com/profiles.php?*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    
    const API_KEY = GM_getValue('torn_api_key', '');
    
    function init() {
        if (!API_KEY) {
            promptForKey();
            return;
        }
        
        // Extract player ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const playerId = urlParams.get('XID');
        
        if (playerId) {
            fetchPlayerStats(playerId);
        }
    }
    
    function promptForKey() {
        const key = prompt('Enter your Torn API key:');
        if (key) {
            GM_setValue('torn_api_key', key);
            location.reload();
        }
    }
    
    function fetchPlayerStats(playerId) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.torn.com/user/${playerId}?key=${API_KEY}&selections=battlestats`,
            onload: function(response) {
                const data = JSON.parse(response.responseText);
                if (data.error) {
                    console.error('Torn API Error:', data.error);
                    return;
                }
                displayStats(data);
            }
        });
    }
    
    function displayStats(data) {
        const statsHtml = `
            <div class="torn-stats-overlay" style="
                background: #1a1a1a;
                border: 1px solid #333;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
            ">
                <h4 style="color: #fff; margin: 0 0 10px 0;">Battle Stats</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; color: #ccc;">
                    <div>Strength: ${data.strength?.toLocaleString() || 'N/A'}</div>
                    <div>Defense: ${data.defense?.toLocaleString() || 'N/A'}</div>
                    <div>Speed: ${data.speed?.toLocaleString() || 'N/A'}</div>
                    <div>Dexterity: ${data.dexterity?.toLocaleString() || 'N/A'}</div>
                </div>
            </div>
        `;
        
        // Insert after profile header
        const target = document.querySelector('.profile-container') || document.querySelector('#mainContainer');
        if (target) {
            target.insertAdjacentHTML('afterbegin', statsHtml);
        }
    }
    
    // Wait for page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

## Example 2: Cooldown Tracker

Show a persistent cooldown display:

```javascript
// ==UserScript==
// @name         Torn Cooldown Tracker
// @namespace    torn-cooldowns
// @version      1.0
// @description  Track drug, booster, and medical cooldowns
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    
    const API_KEY = GM_getValue('torn_api_key', '');
    const CACHE_KEY = 'torn_cooldowns_cache';
    const CACHE_TIME_KEY = 'torn_cooldowns_time';
    
    function formatTime(seconds) {
        if (seconds <= 0) return 'Ready';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
    
    async function fetchCooldowns() {
        // Check cache (30 seconds)
        const cached = GM_getValue(CACHE_KEY, null);
        const cachedTime = GM_getValue(CACHE_TIME_KEY, 0);
        
        if (cached && (Date.now() - cachedTime) < 30000) {
            return JSON.parse(cached);
        }
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.torn.com/user/?key=${API_KEY}&selections=cooldowns`,
                onload: (response) => {
                    const data = JSON.parse(response.responseText);
                    if (data.error) {
                        reject(data.error);
                        return;
                    }
                    // Cache result
                    GM_setValue(CACHE_KEY, JSON.stringify(data.cooldowns));
                    GM_setValue(CACHE_TIME_KEY, Date.now());
                    resolve(data.cooldowns);
                },
                onerror: reject
            });
        });
    }
    
    function createCooldownPanel() {
        const panel = document.createElement('div');
        panel.id = 'torn-cooldown-panel';
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 5px;
            padding: 10px;
            color: #fff;
            z-index: 9999;
            min-width: 150px;
            font-family: monospace;
        `;
        panel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 5px;">
                Cooldowns
            </div>
            <div id="cd-drug">Drug: Loading...</div>
            <div id="cd-booster">Booster: Loading...</div>
            <div id="cd-medical">Medical: Loading...</div>
        `;
        document.body.appendChild(panel);
        return panel;
    }
    
    async function updateDisplay() {
        try {
            const cooldowns = await fetchCooldowns();
            document.getElementById('cd-drug').textContent = `Drug: ${formatTime(cooldowns.drug)}`;
            document.getElementById('cd-booster').textContent = `Booster: ${formatTime(cooldowns.booster)}`;
            document.getElementById('cd-medical').textContent = `Medical: ${formatTime(cooldowns.medical)}`;
        } catch (e) {
            console.error('Failed to fetch cooldowns:', e);
        }
    }
    
    function init() {
        if (!API_KEY) {
            const key = prompt('Enter Torn API key for cooldown tracker:');
            if (key) {
                GM_setValue('torn_api_key', key);
                location.reload();
            }
            return;
        }
        
        createCooldownPanel();
        updateDisplay();
        
        // Update every 30 seconds
        setInterval(updateDisplay, 30000);
    }
    
    init();
})();
```

## Example 3: Market Price Checker

Check bazaar prices for items:

```javascript
// ==UserScript==
// @name         Torn Item Price Check
// @namespace    torn-price-check
// @match        https://www.torn.com/item.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    
    const API_KEY = GM_getValue('torn_api_key', '');
    
    function fetchMarketPrices(itemId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.torn.com/market/${itemId}?key=${API_KEY}`,
                onload: (response) => {
                    const data = JSON.parse(response.responseText);
                    if (data.error) reject(data.error);
                    else resolve(data);
                },
                onerror: reject
            });
        });
    }
    
    function addPriceButton(itemElement, itemId) {
        const btn = document.createElement('button');
        btn.textContent = 'Check Prices';
        btn.style.cssText = 'margin-left: 10px; padding: 2px 8px;';
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'Loading...';
            try {
                const data = await fetchMarketPrices(itemId);
                displayPrices(data, itemElement);
            } catch (e) {
                alert('Error fetching prices: ' + e);
            }
            btn.disabled = false;
            btn.textContent = 'Check Prices';
        };
        itemElement.appendChild(btn);
    }
    
    function displayPrices(data, container) {
        const bazaarAvg = data.bazaar?.length 
            ? (data.bazaar.reduce((a, b) => a + b.cost, 0) / data.bazaar.length).toFixed(0)
            : 'N/A';
        
        const marketAvg = data.itemmarket?.length
            ? (data.itemmarket.reduce((a, b) => a + b.cost, 0) / data.itemmarket.length).toFixed(0)
            : 'N/A';
        
        const html = `
            <div class="price-info" style="
                background: #222;
                padding: 8px;
                margin-top: 5px;
                border-radius: 3px;
                font-size: 12px;
            ">
                <div>Bazaar Avg: $${Number(bazaarAvg).toLocaleString()}</div>
                <div>Market Avg: $${Number(marketAvg).toLocaleString()}</div>
            </div>
        `;
        
        const existing = container.querySelector('.price-info');
        if (existing) existing.remove();
        container.insertAdjacentHTML('beforeend', html);
    }
    
    function init() {
        // Find items on page and add price buttons
        // (Implementation depends on Torn's DOM structure)
    }
    
    init();
})();
```

## Common Patterns

### Cache with Expiration
```javascript
function getCached(key, ttlMinutes) {
    const data = GM_getValue(key, null);
    const time = GM_getValue(key + '_time', 0);
    if (!data || (Date.now() - time) > ttlMinutes * 60000) return null;
    return JSON.parse(data);
}

function setCached(key, data) {
    GM_setValue(key, JSON.stringify(data));
    GM_setValue(key + '_time', Date.now());
}
```

### Debounce API Calls
```javascript
function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}
```

### Wait for Element
```javascript
function waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found`));
        }, timeout);
    });
}
```