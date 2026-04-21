# Chain Guard

> Prevent accidental attacks when you're close to a chain bonus threshold in TORN City.

[![Version](https://img.shields.io/badge/version-2.0.7-blue)](https://git.er-ic.ca/Kevin/torn-userscripts)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-green)](https://www.tampermonkey.net/)
[![Torn PDA](https://img.shields.io/badge/Torn%20PDA-Compatible-purple)](https://github.com/Manuito83/torn-pda)

## What It Does

Chain Guard protects your faction's chain bonus by preventing accidental attacks when you're within a configurable distance of the next bonus threshold.

### Key Features

- 🛡️ **Blocks attack buttons** when you're close to a chain bonus
- ⚠️ **Warning banner** shows how many attacks until the next bonus
- 🔧 **Editable distance** — customize how close is "too close"
- 📱 **Works on both desktop and mobile** (Tampermonkey + Torn PDA)
- 🔄 **Live updates** — button text updates as the chain progresses
- ⏭️ **Ignore option** — temporary bypass if you really need to attack

## Demo

![Editable distance from chain bonus](./assets/distance-demo.gif)

> The settings panel lets you customize the warning threshold. Set it to 15 attacks (default), 5 attacks, or whatever works for your faction's chaining style.

## Installation

### Tampermonkey (Desktop Browsers)

1. Install [Tampermonkey](https://www.tampermonkey.net/) extension
2. Click this link to install:
   ```
   https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/tampermonkey/chain-guard.user.js
   ```
3. Tampermonkey will prompt you to install

### Torn PDA (Mobile)

1. Open Torn PDA → Settings → Advanced Browser Settings
2. Enable "Custom User Scripts"
3. Tap "Manage Scripts" → "+" to add new
4. Copy the contents of:
   ```
   https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/chain-guard/pda/chain-guard.js
   ```
5. Paste and save

## How to Use

On Torn PDA, Chain Guard uses the shared unified **⚙️ PDA Scripts** settings menu. Its section is collapsible and defaults to collapsed.


### Changing the Warning Distance

1. Click the **⚙️ settings button** in the Torn header (PDA) or use the Tampermonkey menu
2. Adjust the **"Warning Threshold"** — this is how many attacks from the bonus the protection kicks in
3. Click **Save**

**Recommended values:**
- **15** (default) — Good for most factions
- **10** — If you're chaining fast and careful
- **5** — Last-minute protection only

### When Protection is Active

You'll see a red warning banner at the top of attack pages showing:
- How many attacks until the next bonus
- An "Ignore once" button to temporarily bypass

Attack buttons will be disabled and show "Chain Guard: X to bonus"

### Ignoring Protection

Click **"Ignore once"** if you really need to attack. Protection will:
- Stay disabled until you reach the next bonus
- Automatically re-enable when the bonus is hit
- Reset if you change the threshold in settings

## Chain Bonus Thresholds

The script knows all TORN chain bonus levels:

`10 → 25 → 50 → 100 → 250 → 500 → 1k → 2.5k → 5k → 10k → 25k → 50k → 100k`

## Troubleshooting

**Script not detecting the chain?**
- Make sure you're on a TORN page with the chain bar visible
- Try refreshing the page
- On mobile, the chain bar text may show as just the number (e.g., "916") when the screen is small — this is handled automatically

**Settings button not showing?**
- PDA: Look for the ⚙️ icon in the Torn header (next to search/avatar)
- Tampermonkey: Check the Tampermonkey menu for "Chain Guard Settings"

## Changelog

### v2.0.7
- PDA settings now live in the unified shared PDA Scripts menu
- PDA menu sections are collapsible and default to collapsed

### v1.6.0
- Reorganized for script-first folder structure
- Removed debug mode (no longer needed)
- Improved mobile/PDA compatibility

### v1.5.x
- Added attack page chain detection
- Fixed small-screen parsing (when "/1k" is hidden)
- Added visible debug overlay (now removed)

### v1.0.0 - v1.4.x
- Initial release
- DOM-based chain tracking
- Attack button blocking
- Live button text updates
- Settings panel

## Credits

Created by **Kevin** for the TORN community.

Repo: https://git.er-ic.ca/Kevin/torn-userscripts
