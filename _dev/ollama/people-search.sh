#!/bin/bash

# Configuration
PROMPT="I am providing you with multiple images. The first image contains only one person - use this person as a reference by carefully studying their facial features (eyes, nose, mouth, jawline, facial structure, etc.). For each subsequent image, determine if this same person from the reference image appears anywhere in that image. When comparing, focus primarily on facial features to identify the person. If you find the same person in any image, highlight any significant aspects of their attire, clothing, or accessories compared to the reference. Provide your reasoning based on facial feature analysis for each image comparison.

For each comparison image where you find the same person, also document identifying characteristics that could be used to find this person in other photos beyond facial features, such as: body build/physique, height relative to surroundings, distinctive clothing patterns, jewelry, tattoos, posture, hair style/color, skin tone, or any other unique visual markers.

At the end of your response, provide a JSON summary with explicit true/false values for each comparison image in this format:
{
  'results': [
    {'image': 2, 'person_found': true, 'confidence': 'high', 'identifying_features': ['medium build', 'dark hair', 'wearing blue shirt', 'silver watch']},
    {'image': 3, 'person_found': false, 'confidence': 'high', 'identifying_features': []}
  ]
}

Replace the image numbers, true/false values, and identifying features based on your analysis. Use confidence levels: 'high', 'medium', or 'low'. Include an empty array for identifying_features when person_found is false."
OLLAMA_MODEL="llava:7b"

# Define reference image and comparison images array
REFERENCE_IMAGE="./20250711_123110.jpg"
COMPARISON_IMAGES=(
    "./../images/6affde31f19ae78385769e8d9d1e157df800bba812cebaa73fbc2725026fa474.jpg"
    "./../images/0298e99ea1d20caa6d6c5af1298fb6a9509b75833b636f2516ad5cad7b00ed30.jpg"
)

# OLD IMAGES:
# "./../images/54fffd30eba481acb0980059015597af91303a13084f0c5371e148bd83f684bd.jpg"
# "./../images/544a86f7391afdcada987b76cb8e3cea4e7fd2c416878f862964a4c796f2a8bb.jpg"

# Check if reference image exists
if [ ! -f "$REFERENCE_IMAGE" ]; then
    echo "Error: Reference image not found: $REFERENCE_IMAGE"
    exit 1
fi

# Check if all comparison images exist
for img in "${COMPARISON_IMAGES[@]}"; do
    if [ ! -f "$img" ]; then
        echo "Error: Comparison image not found: $img"
        exit 1
    fi
done

# Convert reference image to base64
BASE64_REFERENCE=$(base64 -w 0 "$REFERENCE_IMAGE")

# Convert comparison images to base64 array
BASE64_IMAGES=()
BASE64_IMAGES+=("$BASE64_REFERENCE")  # Add reference image first
for img in "${COMPARISON_IMAGES[@]}"; do
    BASE64_IMAGES+=($(base64 -w 0 "$img"))
done

# Debug: Check base64 lengths
echo "Reference image base64 length: ${#BASE64_REFERENCE}"
for i in "${!COMPARISON_IMAGES[@]}"; do
    echo "Comparison image $((i+1)) base64 length: ${#BASE64_IMAGES[$((i+1))]}"
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