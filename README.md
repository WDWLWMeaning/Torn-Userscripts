# Torn Userscript Boilerplate

A complete starter template for building Torn City browser extensions with Tampermonkey.

## Features

- ✅ Secure API key storage
- ✅ Cached API requests with configurable TTL
- ✅ Settings panel with privacy notice
- ✅ Notification system
- ✅ Error handling
- ✅ Rate limiting helpers
- ✅ Utility functions (waitFor, debounce, throttle)
- ✅ Responsive UI components

## Quick Start

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Firefox/Edge)
2. Click the Tampermonkey icon → "Create a new script"
3. Delete the default template
4. Copy the contents of `userscript.js` into the editor
5. Press Ctrl+S to save
6. Visit [torn.com](https://www.torn.com) and configure your API key

## Configuration

### Getting Your API Key

1. Log into Torn
2. Go to [Preferences → API Keys](https://www.torn.com/preferences.php#tab=api)
3. Create a new key with appropriate permissions
4. Copy the 16-character key

### Setting Up the Script

1. Click the Tampermonkey icon
2. Click on this script
3. Go to "User Script Commands" → "⚙️ Settings"
4. Paste your API key
5. Save

## Customization

### Adding New Features

Edit the `Features` object in the script:

```javascript
const Features = {
    showNetworth: async () => {
        // Your code here
    },
    
    myNewFeature: async () => {
        // Fetch data
        const data = await TornAPI.getUser('basic,cooldowns');
        
        // Create UI
        const panel = UI.createPanel('My Feature', `
            <div>Content here</div>
        `);
        
        // Insert into page
        document.body.appendChild(panel);
    }
};
```

Then call it in `init()`:

```javascript
function init() {
    Features.showNetworth();
    Features.myNewFeature();
}
```

### API Endpoints

Available convenience methods:

```javascript
// Get user data (cached)
const user = await TornAPI.getUser('basic,profile', '123456');

// Get faction data (cached)
const faction = await TornAPI.getFaction('basic,members', '12345');

// Get market prices (cached)
const prices = await TornAPI.getMarket('1'); // Item ID 1 = Baseball Bat

// Raw request (no caching)
const data = await TornAPI.request('user', { 
    id: '123456', 
    selections: 'basic,battlestats' 
});
```

### Cache Configuration

Adjust cache TTL in the `CONFIG` object:

```javascript
const CONFIG = {
    cacheTtl: {
        user: 60,      // minutes
        faction: 30,
        market: 5
    }
};
```

## Privacy & Security

- API keys are stored locally using `GM_setValue` (browser extension storage)
- No data is sent to external servers
- All API requests go directly to Torn's servers
- Clear cache anytime via User Script Commands

## Troubleshooting

### "No API key configured"

Open the settings panel and enter your API key.

### "API Error 2: Incorrect key"

Your API key is invalid or expired. Generate a new one in Torn preferences.

### "Rate limited"

You're making too many requests. The script has built-in caching, but if you manually trigger many requests, wait a few minutes.

### Script not running

Check that:
1. Tampermonkey is enabled
2. The script is enabled in Tampermonkey's dashboard
3. You're on a Torn page (https://www.torn.com/*)

## Resources

- [Torn API Documentation](https://www.torn.com/api.html)
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [OpenClaw Skill: torn-tampermonkey](../../SKILL.md)

## License

This boilerplate is provided as-is for the Torn community. Follow Torn's API Terms of Service when building and sharing userscripts.