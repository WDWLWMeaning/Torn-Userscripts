#!/bin/bash
# Generate .meta.js files from .user.js files
# Usage: ./scripts/generate-meta.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TAMPERMONKEY_DIR="$REPO_ROOT/tampermonkey"

echo "Generating .meta.js files for Tampermonkey scripts..."
echo ""

# Find all .user.js files
for user_script in "$TAMPERMONKEY_DIR"/*.user.js; do
    if [ -f "$user_script" ]; then
        # Get the base name without .user.js
        base_name=$(basename "$user_script" .user.js)
        meta_file="$TAMPERMONKEY_DIR/${base_name}.meta.js"
        
        echo "Processing: $(basename "$user_script") -> $(basename "$meta_file")"
        
        # Extract the metadata block (from ==UserScript== to ==/UserScript==)
        awk '
            /^\/\/ ==UserScript==$/ { printing = 1 }
            printing { print }
            /^\/\/ ==\/UserScript==$/ { printing = 0; exit }
        ' "$user_script" > "$meta_file"
        
        if [ -s "$meta_file" ]; then
            echo "  ✓ Created $(basename "$meta_file")"
        else
            echo "  ✗ Failed to extract metadata"
            rm -f "$meta_file"
        fi
    fi
done

echo ""
echo "Meta file generation complete!"
ls -la "$TAMPERMONKEY_DIR"/*.meta.js 2>/dev/null || echo "No .meta.js files found"
