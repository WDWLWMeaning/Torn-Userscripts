# Torn Userscripts

<p align="center">
  <img src="assets/torn-userscripts-logo.png" alt="Torn Userscripts logo" width="160">
</p>

> Browser extensions for [Torn City](https://www.torn.com) with enhanced gameplay, better UI, and API-powered features.

[![Torn](https://img.shields.io/badge/Torn-API%20v2-blue)](https://www.torn.com/api.html)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-green)](https://www.tampermonkey.net/)
[![Torn PDA](https://img.shields.io/badge/Torn%20PDA-Compatible-purple)](https://github.com/Manuito83/torn-pda)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Folder Structure

Scripts are organized by script name first, then by platform.

```text
torn-userscripts/
├── chain-guard/
│   ├── tampermonkey/
│   │   ├── chain-guard.user.js
│   │   └── chain-guard.meta.js
│   ├── pda/
│   │   └── chain-guard.js
│   ├── assets/
│   └── README.md
├── mission-tracker/
│   ├── tampermonkey/
│   │   ├── mission-tracker.user.js
│   │   └── mission-tracker.meta.js
│   ├── pda/
│   │   └── mission-tracker.js
│   ├── assets/
│   └── README.md
├── shared/
│   ├── pda-settings-menu.js
│   └── pda-boilerplate.js
├── examples.md
├── scripts/
│   └── generate-meta.sh
└── boilerplate.js (legacy, use shared/pda-boilerplate.js)
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
```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/tampermonkey/chain-guard.user.js
```

**Torn PDA Install:** Copy the script from:
```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/pda/chain-guard.js
```

See also: [chain-guard/README.md](chain-guard/README.md)

---

## Meta Files (Tampermonkey)

Each Tampermonkey script has a corresponding `.meta.js` file containing only the metadata block. These are automatically generated via GitLab CI.

**Why meta files?** Tampermonkey uses `@updateURL` to check for updates. By pointing to a `.meta.js` file instead of the full script, update checks are faster and use less bandwidth.

**How it works:**
- `.user.js` → full script with code
- `.meta.js` → metadata only (version, name, description, etc.)

**Example:**
```javascript
// ==UserScript==
// @name         Torn Chain Guard
// @version      1.6.0
// @updateURL    https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/tampermonkey/chain-guard.meta.js
// @downloadURL  https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/tampermonkey/chain-guard.user.js
// ==/UserScript==
```

**Generate locally:**
```bash
./scripts/generate-meta.sh
```

---

### Mission Tracker `v5.1.1`

Track your missions with native Torn styling. Available for both Tampermonkey and Torn PDA.

**Features:**
- Badge on the **Missions** button showing incomplete mission count
- **Red badge** = Mission expires in <24 hours (pulses for urgency)
- **Yellow badge** = Mission expires in <48 hours
- Updates every minute with smart caching
- Mobile and desktop responsive
- Persists across page navigation

**Tampermonkey Install:**
```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/tampermonkey/mission-tracker.user.js
```

**Torn PDA Install:** Copy the script from:
```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/pda/mission-tracker.js
```

See also: [mission-tracker/README.md](mission-tracker/README.md)

---

### Bazaar Pricer `v1.0.1`

Inline bazaar listing picker for Torn bazaar pricing, powered by Weav3r marketplace data.

**Features:**
- Shop icon button inline beside the price input
- Opens a picker with current public bazaar listings
- Applies selected listing price minus your configured undercut
- Optional floor protection against dropping below shown Torn market value
- Lightweight UI that stays out of Torn's layout

**Tampermonkey Install:**
```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/bazaar-pricer/tampermonkey/bazaar-pricer.user.js
```

---

### Boilerplate `v1.0.0`

A starter template for building your own Torn extensions with PDA + Tampermonkey support.

**Includes:**
- Shared PDA settings menu (draggable button, multiple scripts)
- PDA API key auto-detection (`###PDA-APIKEY###`)
- Tampermonkey-compatible structure
- Number and toggle setting types
- Smart caching helpers
- Torn API v2 request helper

**Get started:** Copy [`shared/pda-boilerplate.js`](shared/pda-boilerplate.js) and customize the `// YOUR SCRIPT CODE STARTS HERE` section.

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
- `###PDA-APIKEY###` , placeholder auto-replaced with user's API key
- `PDA_httpGet(url, headers)` , cross-origin GET
- `PDA_httpPost(url, headers, body)` , cross-origin POST

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
| `/key/info` | Key validation and permissions |
| `/user/cooldowns` | Cooldown timers |
| `/user/money` | Financial data |

**OpenAPI Spec:** https://www.torn.com/swagger/openapi.json

---

## Privacy & Security

- API keys stored **locally** in your browser or device
- No external servers, all requests go directly to Torn
- Open source, inspect the code before installing
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
