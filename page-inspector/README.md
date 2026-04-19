# Torn Page Inspector

A userscript to extract full page information (HTML, CSS, computed styles) from Torn City pages for userscript development.

## Why Use This?

When building Torn userscripts, you often need to know:
- Exact CSS class names and structure
- Computed styles for elements
- How the DOM is structured on different pages (desktop vs mobile)
- What selectors will work reliably

Instead of taking screenshots or manually inspecting elements, this tool gives you everything in a copy-pasteable format.

## Installation

### Tampermonkey (Desktop)

1. Install [Tampermonkey](https://www.tampermonkey.net/) extension
2. Click the Tampermonkey icon → "Create a new script"
3. Delete the default content
4. Copy/paste the contents of `torn-page-inspector.user.js`
5. Press `Ctrl+S` to save
6. Visit any Torn page - you'll see a 🔍 button in the bottom-right

### Torn PDA (Mobile)

1. Open Torn PDA → Settings → Advanced Browser Settings
2. Enable "Custom User Scripts"
3. Tap "Manage Scripts" → "+"
4. Give it a name (e.g., "Page Inspector")
5. Copy/paste the contents of `torn-page-inspector-pda.js`
6. Set Injection Time to "End"
7. Save and visit any Torn page

## Usage

Click/tap the 🔍 button to open the inspector panel.

### Export Options

| Button | Description |
|--------|-------------|
| **📋 Full Page Dump** | Comprehensive JSON with HTML, CSS, computed styles, metadata. Best for giving to me. |
| **📄 HTML Only** | Clean HTML of the current page. Good for structure analysis. |
| **🎨 CSS Only** | All stylesheets and inline styles. Good for theming. |
| **🎯 Element Under Cursor** | Click/tap any element to get its full details (selector, attributes, computed styles, HTML). |
| **📊 Sidebar Only** | Just the sidebar HTML (useful for chain bar, quick links, etc.). |

## Workflow: Getting Page Info to Kevin

1. **Navigate** to the Torn page you want a feature for
2. **Open the inspector** (🔍 button)
3. **Click "📋 Copy Full Page Dump"**
4. **Paste** it to me in chat

I'll get:
- Page URL and viewport size
- Full HTML structure (truncated for size)
- All CSS rules (external + inline)
- Computed styles for key elements (sidebar, panels, bars, etc.)
- Sample elements with their selectors

## What the Output Looks Like

```json
{
  "meta": {
    "url": "https://www.torn.com/factions.php?step=your#/war/chain",
    "title": "Torn - Faction",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "viewport": { "width": 1920, "height": 1080 }
  },
  "html": {
    "bodyClasses": "desktop ...",
    "body": "<!DOCTYPE html>..."
  },
  "css": {
    "external": "/* Stylesheet: ... */",
    "inline": "/* Inline style block 1 */"
  },
  "samples": [
    {
      "selector": ".bar-value___uxnah",
      "tagName": "P",
      "className": "bar-value___uxnah",
      "computed": {
        "display": "block",
        "color": "rgb(221, 221, 221)",
        ...
      },
      "html": "<p class=\"bar-value___uxnah\">894 / 1k</p>"
    }
  ]
}
```

## Tips

- **Use "Element Under Cursor"** for quick inspection of a specific button/element
- **Use "Sidebar Only"** for chain-related features (much smaller output)
- **Mobile testing**: Use the PDA version to see what the page looks like on mobile
- **Page variants**: Export both desktop and mobile versions if you want responsive support

## Files

- `torn-page-inspector.user.js` - Tampermonkey version (desktop)
- `torn-page-inspector-pda.js` - Torn PDA version (mobile)

## License

MIT - Do whatever you want with it.