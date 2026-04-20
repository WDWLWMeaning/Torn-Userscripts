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

## ⚠️ MANDATORY: Version Bumping

**ALWAYS bump the version after ANY change to a script file.**

This is critical for:
- Tampermonkey auto-updates to detect changes
- Users to know they're on latest version
- Tracking what changed when

### Rules
1. **Any code change = version bump** (even tiny fixes)
2. **Both files if Tampermonkey:** Update `.user.js` AND `.meta.js`
3. **Use semantic versioning:** `MAJOR.MINOR.PATCH`
   - `PATCH` (0.0.1→0.0.2): Bug fixes, small tweaks
   - `MINOR` (0.0.x→0.1.0): New features
   - `MAJOR` (0.x.x→1.0.0): Breaking changes

### Where to Update
```
// In the userscript header:
// @version      1.2.3    ← UPDATE THIS

// In .meta.js (Tampermonkey only):
// @version      1.2.3    ← UPDATE THIS TOO
```

### Examples
- Fixed typo → 1.0.0 → 1.0.1
- Added new feature → 1.0.5 → 1.1.0
- Rewrote core logic → 1.5.0 → 2.0.0

## Before Committing Checklist

- [ ] File is in correct folder (`tampermonkey/` or `pda/`)
- [ ] Naming follows conventions
- [ ] **⚠️ Version bumped in `@version` header**
- [ ] **⚠️ Meta file updated too (Tampermonkey)**
- [ ] Script works standalone
- [ ] Uses Torn-native styling
- [ ] Commit message describes the change

## CI/CD Setup (GitLab)

The repository uses GitLab CI to auto-generate `.meta.js` files.

### Required CI/CD Variables
In GitLab project settings → CI/CD → Variables, add:
- `GITLAB_TOKEN`: A project access token with `write_repository` permission

### How CI Works
1. **generate-meta** job: Runs `scripts/generate-meta.sh` to create `.meta.js` files
2. **commit-meta** job: Commits any changed meta files back to the repo

### Common CI Issues
- **CI fails at commit-meta**: `GITLAB_TOKEN` is missing or invalid
- **Meta files out of sync**: Run `./scripts/generate-meta.sh` locally and commit changes
- **New script missing meta**: Ensure the script is in `tampermonkey/` folder and has `.user.js` extension
