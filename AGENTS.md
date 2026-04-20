# Torn Userscripts - Agent Guide

**READ THIS FIRST** if you're working on this repository. This file defines the structure and conventions.

## Repository Structure

```
torn-userscripts/
├── AGENTS.md                          # This file - READ FIRST
├── README.md                          # User-facing documentation
├── examples.md                        # Code examples and patterns
│
├── shared/                            # Shared resources
│   ├── pda-boilerplate.js            # Template for new PDA scripts
│   └── tampermonkey-boilerplate.js   # Template for new Tampermonkey scripts
│
├── chain-guard/                       # Example: Chain Guard script
│   ├── README.md
│   ├── pda/
│   │   └── chain-guard.js            # PDA version
│   └── tampermonkey/
│       ├── chain-guard.meta.js       # Metadata for updates
│       └── chain-guard.user.js       # Main script
│
├── mission-tracker/                   # Example: Mission Tracker script
│   ├── README.md
│   └── tampermonkey/
│       ├── mission-tracker.meta.js
│       └── mission-tracker.user.js
│
└── page-inspector/                    # Example: Page Inspector
    ├── README.md
    ├── pda/
    │   └── page-inspector.js
    └── tampermonkey/
        └── page-inspector.user.js
```

## Folder Conventions

### Script Folder Structure
Each script lives in its own folder named after the script (kebab-case):

```
{script-name}/
├── README.md                          # Script-specific docs
├── pda/                               # PDA/mobile versions
│   └── {script-name}.js
└── tampermonkey/                      # Desktop browser versions
    ├── {script-name}.meta.js          # Update metadata
    └── {script-name}.user.js          # Main userscript
```

### Naming Conventions
- **Folders:** `kebab-case` (e.g., `chain-guard`, `mission-tracker`)
- **Files:** Match folder name (e.g., `chain-guard.user.js`)
- **Meta files:** Must match main script name (e.g., `chain-guard.meta.js`)

## Platform Versions

### Tampermonkey (Desktop)
- Uses `GM_*` functions: `GM_setValue`, `GM_getValue`, `GM_addStyle`, `GM_xmlhttpRequest`
- Has `@grant` declarations in header
- Can use `GM_registerMenuCommand` for settings
- Two files: `.user.js` (main) + `.meta.js` (for auto-updates)

### Torn PDA (Mobile)
- Uses `localStorage` instead of `GM_*`
- No `@grant` needed
- Manually inject styles (no `GM_addStyle`)
- Uses `fetch()` instead of `GM_xmlhttpRequest`
- Single file, no meta file needed
- Must use polling (300-500ms) instead of MutationObserver
- API key placeholder: `###PDA-APIKEY###`

## PDA Cooperative Header Pattern

All PDA scripts share header space cooperatively:

```javascript
// Each script creates shared container if needed
function getOrCreateSharedContainer() {
    let container = document.getElementById('torn-pda-scripts-container');
    if (container) return container;
    
    // Create next to hamburger menu
    // ...
}

// Each script adds its OWN button with unique ID
const btnId = `pda-script-btn-${SCRIPT_ID}`;
```

**Key points:**
- No dependencies between scripts
- Each works standalone
- Install/remove in any order
- Clean shared header space

## Torn Native Styling

Always use these colors for consistency:

```javascript
const TORN = {
    bg: '#444',                    // Page background
    panel: '#333',                 // Panel background
    panelHover: '#555',            // Hover state
    text: '#ddd',                  // Primary text
    textMuted: '#999',             // Secondary text
    green: '#82c91e',              // Success/accent
    blue: '#74c0fc',               // Links
    red: '#E54C19',                // Errors
    yellow: '#F08C00',             // Warnings
    border: '#444',                // Borders
    borderLight: '#555',           // Light borders
    headerGradient: 'linear-gradient(180deg, #777 0%, #333 100%)'
};
```

- Font: `Arial, sans-serif` (NOT 'Open Sans')
- Panels: Border radius `4px`, border `1px solid #444`
- Buttons: Match Torn's native button gradient

## Version Management

Always bump versions when making changes:
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Update both `.user.js` AND `.meta.js` (Tampermonkey)
- Update `@version` in header
- Commit with descriptive message

## Before Committing

1. Check file is in correct folder (`tampermonkey/` or `pda/`)
2. Verify naming matches conventions
3. Bump version if modified
4. Test that script works standalone
5. Ensure Torn-native styling
