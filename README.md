# 🎮 Torn Userscripts

> Browser extensions for [Torn City](https://www.torn.com) — enhanced gameplay, better UI, and API-powered features.

[![Torn](https://img.shields.io/badge/Torn-API%20v2-blue)](https://www.torn.com/api.html)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-green)](https://www.tampermonkey.net/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📦 Available Scripts

### 🔥 Mission Tracker `v2.0.6`
Track your missions and never miss a deadline again.

**What it does:**
- Shows a badge on the **Missions** button with count of incomplete missions
- 🔴 **Red badge** = Mission expires in <24 hours (pulses for urgency)
- 🟡 **Yellow badge** = Mission expires in <48 hours
- 🔵 **Blue badge** = No urgency
- Updates every 5 minutes with smart caching

**Features:**
- ✅ Mobile & desktop responsive
- ✅ Persists across page navigation
- ✅ Settings panel with API key validation
- ✅ Shows your key's access level and permissions

**Install:**
```
https://git.er-ic.ca/Kevin/torn-userscripts/-/raw/main/mission-tracker.user.js?ref_type=heads
```

---

### 🚀 Userscript Boilerplate
A complete starter template for building your own Torn extensions.

**Includes:**
- 🔐 Secure API key storage (`GM_getValue`/`GM_setValue`)
- 💾 Smart caching with TTL
- ⚙️ Settings panel template
- 🔔 Notification system
- 📡 Torn API v2 helpers
- 🎨 Clean UI components

**Use this if:**
- You want to build a custom Torn tool
- You need a solid foundation with best practices
- You want to learn the API v2 patterns

**Get started:** Copy `userscript.js` and modify the `Features` object.

---

## 🛠️ Prerequisites

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

---

## 🧩 API v2 Information

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

## 🔒 Privacy & Security

- ✅ API keys stored **locally** in your browser
- ✅ No external servers — all requests go directly to Torn
- ✅ Open source — inspect the code before installing
- ✅ No data collection or tracking

---

## 📝 Development

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

## 📚 Resources

- [Torn API Docs](https://www.torn.com/api.html)
- [OpenAPI Spec](https://www.torn.com/swagger/openapi.json)
- [Tampermonkey Docs](https://www.tampermonkey.net/documentation.php)
- [Examples & Patterns](examples.md)

---

## 🤝 Contributing

Found a bug? Want a new feature?

- Open an issue
- Submit a pull request
- Or DM me on Torn

---

Made with ☕ for the Torn community