# Bazaar Pricer

<p align="center">
  <img src="../assets/torn-userscripts-logo.png" alt="Torn Userscripts logo" width="120">
</p>

[![Torn Rules](https://img.shields.io/badge/Torn%20Rules-Compliant-brightgreen)](#torn-rules-compliance)

Bazaar Pricer adds a small inline shop button beside bazaar price inputs so you can open current public Weav3r listings and choose a price quickly.

## Features

- Inline listing picker button beside the visible price input
- Works with legacy bazaar rows and newer React-style item cards
- Uses Weav3r public marketplace data
- Applies selected listing price minus your configured undercut amount
- Available for both Tampermonkey and Torn PDA

## Install

### Tampermonkey

```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/bazaar-pricer/tampermonkey/bazaar-pricer.user.js
```

### Torn PDA

Copy the script from:

```text
https://git.er-ic.ca/Kevin/torn-userscripts/raw/main/bazaar-pricer/pda/bazaar-pricer.js
```

## Settings

Current setting:
- Undercut amount

On Torn PDA, Bazaar Pricer uses the shared unified **⚙️ PDA Scripts** settings menu. Its section is collapsible and now defaults to collapsed.

## Torn Rules Compliance

This script is fully compliant with [Torn's Scripting Rules](https://www.torn.com/rules.php):

- ✅ Uses **Weav3r public API** (third-party, not Torn scraping)
- ✅ No non-API requests to Torn
- ✅ No page scraping or data extraction from Torn
- ✅ All marketplace data comes from public Weav3r listings
- ✅ User-initiated actions only (click button to view prices)

## Notes

- Weav3r responses are cached briefly to avoid hammering the endpoint
- The PDA version shares one unified settings button with other PDA scripts instead of adding its own separate settings UI
- If Torn changes its bazaar markup again, the selector logic may need another update
