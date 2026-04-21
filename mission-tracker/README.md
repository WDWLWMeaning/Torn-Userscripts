# Mission Tracker

> Track your TORN missions with native Torn styling and urgency indicators.

[![Version](https://img.shields.io/badge/version-5.1.2-blue)](https://git.er-ic.ca/Kevin/torn-userscripts)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-green)](https://www.tampermonkey.net/)
[![Torn PDA](https://img.shields.io/badge/Torn%20PDA-Compatible-purple)](https://github.com/Manuito83/torn-pda)

## What It Does

Mission Tracker adds a visual badge to the **Missions** button in TORN, showing how many incomplete missions you have at a glance. The badge color indicates urgency:

| Badge Color | Meaning | Action Needed |
|-------------|---------|---------------|
| 🔴 **Red (pulsing)** | Expires in < 24 hours | **URGENT** — Complete soon! |
| 🟡 **Yellow** | Expires in < 48 hours | Complete when convenient |
| 🔵 **Blue** | No urgency | No rush |

## Demo

![Mission Tracker in action](./assets/demo.gif)

> The badge updates every 5 minutes and shows your incomplete mission count with color-coded urgency.

## Installation

### Tampermonkey (Desktop Browsers)

1. Install [Tampermonkey](https://www.tampermonkey.net/) extension for your browser
2. Click this link to install:
   ```
   https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/tampermonkey/mission-tracker.user.js
   ```
3. Tampermonkey will prompt you to install — click "Install"
4. Enter your TORN API key when prompted (required to fetch mission data)

### Torn PDA (Mobile)

1. Open **Torn PDA → Settings → Advanced Browser Settings**
2. Enable **"Custom User Scripts"**
3. Tap **"Manage Scripts" → "+"**
4. Paste the script from:
   ```
   https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/mission-tracker/pda/mission-tracker.js
   ```
5. Set **"Inject at"** to **End**
6. The script will automatically use your PDA-connected API key

### Getting Your API Key (Tampermonkey only)

1. Go to [TORN Preferences → API Keys](https://www.torn.com/preferences.php#tab=api)
2. Create a new key
3. Select **"Limited"** access level (minimum needed)
4. Copy the key and paste it when the script asks

## Features

On Torn PDA, Mission Tracker uses the shared unified **⚙️ PDA Scripts** settings menu. Its section is collapsible and defaults to collapsed.


### Smart Caching
- Updates every **5 minutes** to avoid spamming TORN's API
- Caches mission data locally so it works across page navigation
- Refreshes automatically when you open the missions page

### Visual Indicators
- **Pulsing red badge** — Can't miss it when missions are about to expire
- **Clean integration** — Uses TORN's native styling, looks like it's part of the game
- **Mobile responsive** — Badge scales properly on mobile browsers

### Privacy
- Your API key is stored **locally** in your browser
- All requests go directly to TORN's servers
- No data is sent anywhere else

## Troubleshooting

**Badge not showing?**
- Make sure you've entered a valid API key
- Check that the API key has the right permissions ("Limited" or higher)
- Try refreshing the page

**Wrong mission count?**
- The badge updates every 5 minutes — wait a bit or refresh
- Check that your API key is still valid (keys can expire)

**Not working on mobile?**
- Use the Torn PDA version above
- Make sure you've enabled "Custom User Scripts" in PDA settings
- Set "Inject at" to "End" for proper DOM access

## Technical Details

### API Endpoints Used
- `/user/missions` — Fetch your current missions
- `/key/info` — Validate your API key

### Caching Strategy
- Mission data cached for 5 minutes
- API key cached until manually changed
- Automatic refresh on page load

## Changelog

### v5.1.2
- PDA settings now use the unified shared PDA Scripts menu behavior
- PDA menu sections are collapsible and default to collapsed

### v5.1.1
- Added Torn PDA support with shared menu integration
- API key auto-detected from PDA
- Badge CSS matches Tampermonkey version exactly

### v3.2.1
- Reorganized for script-first folder structure
- Updated meta file URLs

### v3.2.0
- Improved badge positioning
- Better error handling for API failures

### v3.1.x and earlier
- Initial releases
- Native TORN styling
- Smart caching implementation
- Settings panel with API key validation

## Credits

Created by **Kevin** for the TORN community.

Repo: https://git.er-ic.ca/Kevin/torn-userscripts

---

**Note:** Both Tampermonkey and Torn PDA versions are supported. The PDA version uses your PDA-connected API key automatically.
