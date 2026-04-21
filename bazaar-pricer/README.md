# Bazaar Pricer

<p align="center">
  <img src="../assets/torn-userscripts-logo.png" alt="Torn Userscripts logo" width="120">
</p>

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

## Notes

- Weav3r responses are cached briefly to avoid hammering the endpoint
- If Torn changes its bazaar markup again, the selector logic may need another update
