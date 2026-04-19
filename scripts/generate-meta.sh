#!/bin/bash
# Generate .meta.js files from .user.js files
# Usage: ./scripts/generate-meta.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Generating .meta.js files for Tampermonkey scripts..."
echo ""

found_any=false

while read -r tampermonkey_dir; do
    found_any=true

    for user_script in "$tampermonkey_dir"/*.user.js; do
        if [ -f "$user_script" ]; then
            base_name=$(basename "$user_script" .user.js)
            meta_file="$tampermonkey_dir/${base_name}.meta.js"

            rel_user_script="${user_script#"$REPO_ROOT"/}"
            rel_meta_file="${meta_file#"$REPO_ROOT"/}"

            echo "Processing: $rel_user_script -> $rel_meta_file"

            awk '
                /^\/\/ ==UserScript==$/ { printing = 1 }
                printing { print }
                /^\/\/ ==\/UserScript==$/ { printing = 0; exit }
            ' "$user_script" > "$meta_file"

            if [ -s "$meta_file" ]; then
                echo "  ✓ Created $rel_meta_file"
            else
                echo "  ✗ Failed to extract metadata"
                rm -f "$meta_file"
            fi
        fi
    done
done < <(find "$REPO_ROOT" -mindepth 2 -maxdepth 2 -type d -name tampermonkey | sort)

if [ "$found_any" = false ]; then
    echo "No tampermonkey directories found"
fi

echo ""
echo "Meta file generation complete!"
meta_files=$(find "$REPO_ROOT" -path '*/tampermonkey/*.meta.js' -type f | sort)
if [ -n "$meta_files" ]; then
    printf '%s\n' "$meta_files" | sed "s#^$REPO_ROOT/##"
else
    echo "No .meta.js files found"
fi
