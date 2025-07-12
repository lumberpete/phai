#!/bin/bash

# Configuration
PROMPT="I am providing you with multiple images to analyze and group into potential duplicate clusters. Examine all images and identify which ones are duplicates or near-duplicates of each other by comparing:

1. Overall composition and layout
2. Objects, people, and subjects in the image
3. Background elements and scenery
4. Colors, lighting, and visual style
5. Image quality and resolution
6. Cropping or framing differences
7. Minor edits, filters, or processing differences

Consider images as duplicates if they are:
- Exact copies (identical files)
- Same photo with different compression/quality
- Same photo with minor cropping or resizing
- Same photo with slight color/brightness adjustments
- Same photo with watermarks added/removed

Consider images as near-duplicates if they are:
- Same scene taken moments apart (burst photos)
- Same subject with slightly different pose/angle
- Same location with minor composition changes

Analyze ALL images and identify groups of similar/duplicate images. At the end of your response, provide a JSON summary with duplicate groups in this format:
{
  'duplicate_groups': [
    {
      'group_id': 1,
      'images': [1, 3, 5],
      'duplicate_type': 'exact_copy',
      'confidence': 'high',
      'description': 'Same photo with different compression levels'
    },
    {
      'group_id': 2,
      'images': [2, 4],
      'duplicate_type': 'near_duplicate',
      'confidence': 'medium',
      'description': 'Same scene taken moments apart'
    }
  ],
  'unique_images': [6, 7, 8]
}

Use duplicate_type values: 'exact_copy', 'near_duplicate', 'same_scene'. Use confidence levels: 'high', 'medium', or 'low'. Include images that have no duplicates in the unique_images array."
OLLAMA_MODEL="llava:7b"

# Define comparison images array (no reference image needed)
COMPARISON_IMAGES=(
    "./../images/6affde31f19ae78385769e8d9d1e157df800bba812cebaa73fbc2725026fa474.jpg"
    "./../images/0298e99ea1d20caa6d6c5af1298fb6a9509b75833b636f2516ad5cad7b00ed30.jpg"
)

# Check if all comparison images exist
for img in "${COMPARISON_IMAGES[@]}"; do
    if [ ! -f "$img" ]; then
        echo "Error: Image not found: $img"
        exit 1
    fi
done

# Convert comparison images to base64 array
BASE64_IMAGES=()
for img in "${COMPARISON_IMAGES[@]}"; do
    BASE64_IMAGES+=($(base64 -w 0 "$img"))
done

# Debug: Check base64 lengths
for i in "${!COMPARISON_IMAGES[@]}"; do
    echo "Image $((i+1)) base64 length: ${#BASE64_IMAGES[$i]}"
done
echo "Total images to process: ${#BASE64_IMAGES[@]}"
echo "Prompt: $PROMPT"

# Get ollama host
OLLAMA_HOST=$(ip route show | grep -i default | awk '{ print $3 }')
[ -z "$OLLAMA_HOST" ] && OLLAMA_HOST="localhost"

echo "Using ollama host: $OLLAMA_HOST with model: $OLLAMA_MODEL"

# Create JSON payload and call API
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_JSON="$SCRIPT_DIR/temp_payload.json"

# Build images array for JSON
IMAGES_JSON=""
for i in "${!BASE64_IMAGES[@]}"; do
    if [ $i -gt 0 ]; then
        IMAGES_JSON+=","
    fi
    IMAGES_JSON+="\"${BASE64_IMAGES[$i]}\""
done

cat > "$TEMP_JSON" << EOF
{
  "model": "$OLLAMA_MODEL",
  "prompt": "$PROMPT",
  "images": [$IMAGES_JSON],
  "stream": true
}
EOF

echo "Generating response (streaming)..."
echo "----------------------------------------"

# Make streaming API call and process response in real-time
curl -s -H "Content-Type: application/json" \
    -X POST http://$OLLAMA_HOST:11434/api/generate -d @"$TEMP_JSON" | \
while IFS= read -r line; do
    if [ -n "$line" ]; then
        # Extract the response part from each JSON line
        response_part=$(echo "$line" | jq -r '.response // empty' 2>/dev/null)
        if [ -n "$response_part" ] && [ "$response_part" != "null" ]; then
            printf "%s" "$response_part"
        fi

        # Check if this is the final response
        done_status=$(echo "$line" | jq -r '.done // false' 2>/dev/null)
        if [ "$done_status" = "true" ]; then
            echo ""
            break
        fi
    fi
done

rm "$TEMP_JSON"