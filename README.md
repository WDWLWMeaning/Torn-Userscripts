# Torn Userscripts

> Browser extensions for [Torn City](https://www.torn.com) — enhanced gameplay, better UI, and API-powered features.

[![Torn](https://img.shields.io/badge/Torn-API%20v2-blue)](https://www.torn.com/api.html)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-green)](https://www.tampermonkey.net/)
[![Torn PDA](https://img.shields.io/badge/Torn%20PDA-Compatible-purple)](https://github.com/Manuito83/torn-pda)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Folder Structure

```
torn-userscripts/
├── tampermonkey/     # Tampermonkey/Greasemonkey userscripts
│   ├── chain-guard.user.js
│   └── mission-tracker.user.js
├── pda/              # Torn PDA-compatible scripts
│   └── chain-guard.js
├── examples.md       # Code patterns and snippets
└── userscript.js     # Boilerplate template
```

---

## Available Scripts

### Chain Guard

Prevents accidental attacks when near chain bonus thresholds.

**Features:**
- DOM-based chain tracking in real-time
- Blocks attack buttons when within 15 hits of a chain bonus
- Shows warning banner when protection is active
- "Ignore once" button to bypass for current bonus
- Live button text updates (counts down as chain progresses)
- Debug mode toggle for verbose logging
- Caches chain data for use on attack pages
- Configurable threshold (default: 15 attacks)

**Tampermonkey Install:**
```
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/tampermonkey/chain-guard.user.js
```

**Torn PDA Install:** Copy the script from:
```
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/pda/chain-guard.js
```

---

## Meta Files (Tampermonkey)

Each Tampermonkey script has a corresponding `.meta.js` file containing only the metadata block. These are automatically generated via GitLab CI.

**Why meta files?** Tampermonkey uses `@updateURL` to check for updates. By pointing to a `.meta.js` file (instead of the full script), update checks are faster and use less bandwidth.

**How it works:**
- `.user.js` → full script with code
- `.meta.js` → metadata only (version, name, description, etc.)

**Example:**
```javascript
// ==UserScript==
// @name         Torn Chain Guard
// @version      1.5.3
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/tampermonkey/chain-guard.meta.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/tampermonkey/chain-guard.user.js
// ==/UserScript==
```

**Generate locally:**
```bash
./scripts/generate-meta.sh
```

---

### Mission Tracker `v3.2.1` (Tampermonkey only)

Track your missions with native Torn styling.

**Features:**
- Badge on the **Missions** button showing incomplete mission count
- **Red badge** = Mission expires in <24 hours (pulses for urgency)
- **Yellow badge** = Mission expires in <48 hours
- **Blue badge** = No urgency
- Updates every 5 minutes with smart caching
- Mobile and desktop responsive
- Persists across page navigation
- Settings panel with API key validation

**Install:**
```
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/tampermonkey/mission-tracker.user.js
```

---

### Userscript Boilerplate `v2.0.1`

A starter template for building your own Torn extensions.

**Includes:**
- Secure API key storage
- Smart caching with TTL
- Settings panel template
- Torn API v2 helpers
- Clean UI components

**Get started:** Copy `userscript.js` and modify the `Features` object.

---

## Platform Differences

### Tampermonkey vs Torn PDA

| Feature | Tampermonkey | Torn PDA |
|---------|--------------|----------|
| **Storage** | `GM_setValue` / `GM_getValue` | `localStorage` |
| **HTTP Requests** | `GM_xmlhttpRequest` | `fetch()` or `PDA_httpGet/Post` |
| **API Key** | User provides manually | `###PDA-APIKEY###` placeholder |
| **Menu Command** | `GM_registerMenuCommand` | Not supported (use UI button) |
| **Styling** | `GM_addStyle` | Manual `<style>` injection |

**PDA-Specific Features:**
- `###PDA-APIKEY###` — placeholder auto-replaced with user's API key
- `PDA_httpGet(url, headers)` — cross-origin GET
- `PDA_httpPost(url, headers, body)` — cross-origin POST

See [Torn PDA Userscripts](https://github.com/Manuito83/torn-pda/tree/master/userscripts) for more.

---

## Prerequisites

### Tampermonkey

1. **Install Tampermonkey** (Chrome/Firefox/Edge)
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

2. **Get a Torn API key**
   - Go to [Torn Preferences → API Keys](https://www.torn.com/preferences.php#tab=api)
   - Create a new key
   - Select the required scopes for your script

3. **Install a script**
   - Click the install link above
   - Tampermonkey will prompt you to install
   - Enter your API key when prompted

### Torn PDA

1. **Install Torn PDA** from your app store
2. Open **Settings → Advanced Browser Settings**
3. Enable "Custom User Scripts"
4. Tap "Manage Scripts" → "+" to add
5. Paste the script code
6. Set injection time (Start/End) as needed

---

## API v2 Information

These scripts use the **Torn API v2** for better performance and dedicated endpoints.

**Base URL:** `https://api.torn.com/v2`

**Endpoints used:**
| Endpoint | Purpose |
|----------|---------|
| `/user/missions` | Mission data |
| `/key/info` | Key validation & permissions |
| `/user/cooldowns` | Cooldown timers |
| `/user/money` | Financial data |

**OpenAPI Spec:** https://www.torn.com/swagger/openapi.json

---

## Privacy & Security

- API keys stored **locally** in your browser/device
- No external servers — all requests go directly to Torn
- Open source — inspect the code before installing
- No data collection or tracking

---

## Development

Want to contribute or build your own?

1. Fork this repo
2. Check `examples.md` for patterns and snippets
3. Use the boilerplate as a starting point
4. Test on Torn before submitting

**Best practices:**
- Cache aggressively (respect Torn's servers)
- Use dedicated v2 endpoints when available
- Handle errors gracefully
- Keep UI minimal and non-intrusive

---

## Resources

- [Torn API Docs](https://www.torn.com/api.html)
- [OpenAPI Spec](https://www.torn.com/swagger/openapi.json)
- [Tampermonkey Docs](https://www.tampermonkey.net/documentation.php)
- [Torn PDA Scripts](https://github.com/Manuito83/torn-pda/tree/master/userscripts)
- [Examples & Patterns](examples.md)

---

## Contributing

Found a bug? Want a new feature?

- Open an issue
- Submit a pull request
- Or DM me on Torn

---

Made for the Torn community
