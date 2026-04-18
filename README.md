# Torn Userscripts

A collection of browser extensions and userscripts for [Torn City](https://www.torn.com), updated for the Torn API v2.

## About

These userscripts enhance the Torn gameplay experience by adding custom features, automating lightweight tasks, and displaying data from Torn's API.

## Prerequisites

- [Tampermonkey](https://www.tampermonkey.net/) browser extension (or Greasemonkey/Violentmonkey)
- A Torn account
- A Torn API key with the selections your script needs

## Quick Start

1. Install Tampermonkey for your browser.
2. Copy a script below into a new Tampermonkey script.
3. Configure your Torn API key when prompted.
4. Grant the specific v2 selections the script needs.

## Userscripts

### Boilerplate
A starter template for building your own Torn extensions on top of the v2 API.

**Features:**
- Local API key storage
- Cached API requests
- Settings panel
- Notification system
- Dedicated v2 endpoint helpers
- Generic selector fallback for endpoints Torn has not split yet

**Install:** Copy the contents of `userscript.js` into a new Tampermonkey script.

### Mission Tracker
Tracks active missions and warns when accepted contracts are close to expiring.

**Features:**
- Uses `/user/missions`
- Uses `/key/info` to validate permissions
- Red badge for <24h, yellow for <48h
- Five-minute caching to stay polite to Torn's API

**Install:** Copy the contents of `mission-tracker.user.js` into a new Tampermonkey script.

## Torn API v2 notes

- Base URL: `https://api.torn.com/v2`
- OpenAPI spec: <https://www.torn.com/swagger/openapi.json>
- Prefer dedicated endpoints like `/user/missions` and `/key/info`
- The generic selector endpoints (`/user`, `/faction`, `/market`) still exist, but dedicated v2 paths are cleaner when available
- Torn's v2 rollout is still in progress, so some older domains may still need selector-based fallbacks

## Development

### Creating a new script

1. Copy `userscript.js` as a starting point.
2. Add features through the `Features` object.
3. Prefer dedicated v2 paths first.
4. Cache anything that does not need live-second accuracy.
5. Test on Torn pages before shipping.

### Best practices

- **Never hardcode API keys**
- **Cache aggressively**
- **Handle missing selections cleanly**
- **Prefer dedicated v2 endpoints**
- **Keep everything local unless the user explicitly wants otherwise**

## Privacy & Security

- API keys are stored locally in the browser
- No data is sent to external servers
- All API requests go directly to Torn's servers
- Scripts are open source, so users can inspect what they do

## Resources

- OpenAPI spec: <https://www.torn.com/swagger/openapi.json>
- Human docs: <https://www.torn.com/api.html>
- Tampermonkey docs: <https://www.tampermonkey.net/documentation.php>
- Torn forums: <https://www.torn.com/forums.php>
- Examples: [examples.md](examples.md)
