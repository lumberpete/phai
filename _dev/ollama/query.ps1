# phAI - PowerShell script to send prompt and images to local Ollama instance
# Usage: Run from the _dev/ollama directory
# Parameters:
#   $args[0] = test image number (e.g., 5 for test_image5.jpg) - optional
#   $args[1] = model index - optional
# If no parameters given, iterates through all available test images

param(
    [int]$TestImageNumber,
    [int]$ModelIndex = 3
)

# Configuration
$OllamaEndpoint = 'http://localhost:11434/api/generate'
$PromptFile = 'prompt.txt'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ReferenceImagePath = Join-Path $ScriptDir 'tmp/reference_image.jpg'

$Models = @(
    'gemma3:12b',
    'gemma3:4b',
    'minicpm-v',
    'qwen2.5vl:7b',
    'llava:7b',
    'llava:13b',
    'llama3.2-vision:11b'
)

# Function to get all available test image files
function Get-AvailableTestImages {
    $testImages = @()
    for ($i = 0; $i -le 50; $i++) {
        $testImagePath = Join-Path $ScriptDir "tmp/test_image$i.jpg"
        if (Test-Path $testImagePath) {
            $testImages += $testImagePath
        }
    }
    return $testImages
}

# Function to read and parse prompt file
function Get-PromptFromFile {
    if (!(Test-Path $PromptFile)) {
        Write-Error "Prompt file not found: $PromptFile"
        exit 1
    }

    # Read all lines and discard anything after '--- NOTES'
    $promptLines = Get-Content $PromptFile
    $notesIndex = $promptLines.IndexOf('--- NOTES')
    if ($notesIndex -ge 0) {
        $promptLines = $promptLines[0..($notesIndex - 1)]
    }
    return ($promptLines -join "`n").Trim()
}

# Function to validate model index
function Get-ValidatedModel {
    param([int]$ModelIndex)

    if ($ModelIndex -lt 0 -or $ModelIndex -ge $Models.Count) {
        Write-Error "Invalid model index: $ModelIndex. Valid range: 0-$($Models.Count - 1)"
        exit 1
    }
    return $Models[$ModelIndex]
}

# Function to resize and convert images to base64
function ConvertTo-Base64Images {
    param([array]$ImagePaths)

    $base64Images = @()
    foreach ($imagePath in $ImagePaths) {
        if (!(Test-Path $imagePath)) {
            Write-Error "Image not found: $imagePath"
            continue
        }

        # Resize image
        $resizedImageBytes = Resize-ImageIfNeeded -ImagePath $imagePath
        $base64Images += [Convert]::ToBase64String($resizedImageBytes)
    }
    return $base64Images
}

# Function to resize image if it exceeds maximum dimensions
function Resize-ImageIfNeeded {
    param(
        [string]$ImagePath,
        [int]$MaxWidth = 1100,
        [int]$MaxHeight = 1100
    )

    Add-Type -AssemblyName System.Drawing

    try {
        # Load the original image
        $originalImage = [System.Drawing.Image]::FromFile($ImagePath)
        $originalWidth = $originalImage.Width
        $originalHeight = $originalImage.Height

        # Check if resizing is needed
        if ($originalWidth -le $MaxWidth -and $originalHeight -le $MaxHeight) {
            # No resizing needed, return original bytes
            $originalImage.Dispose()
            return [IO.File]::ReadAllBytes($ImagePath)
        }

        # Calculate new dimensions while maintaining aspect ratio
        $aspectRatio = $originalWidth / $originalHeight
        $rand = Get-Random -Minimum 1 -Maximum 100

        if ($aspectRatio -gt ($MaxWidth / $MaxHeight)) {
            # Width is the limiting factor
            $newWidth = $MaxWidth + $rand
            $newHeight = [int]($MaxWidth / $aspectRatio)
        } else {
            # Height is the limiting factor
            $newHeight = $MaxHeight + $rand
            $newWidth = [int]($MaxHeight * $aspectRatio)
        }

        Write-Host "Resizing image from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}"

        # Create new bitmap with calculated dimensions
        $resizedImage = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
        $graphics = [System.Drawing.Graphics]::FromImage($resizedImage)

        # Set high quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        # Draw the resized image
        $graphics.DrawImage($originalImage, 0, 0, $newWidth, $newHeight)

        # Save to memory stream as JPEG
        $memoryStream = New-Object System.IO.MemoryStream
        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
        $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 85L)

        $resizedImage.Save($memoryStream, $jpegCodec, $encoderParams)
        $resizedBytes = $memoryStream.ToArray()

        # Clean up
        $graphics.Dispose()
        $resizedImage.Dispose()
        $originalImage.Dispose()
        $memoryStream.Dispose()

        return $resizedBytes
    }
    catch {
        Write-Error "Failed to resize image ${ImagePath}: $_"
        # Fallback to original image if resizing fails
        if ($originalImage) { $originalImage.Dispose() }
        return [IO.File]::ReadAllBytes($ImagePath)
    }
}

# Function to generate HTML content
function New-HtmlContent {
    param(
        [string]$SelectedModel,
        [array]$ImagePaths,
        [string]$Prompt,
        [string]$Response = $null
    )

    # Model section
    $htmlModel = "<div><h2>Model Used</h2><p style='font-family:sans-serif;font-size:1.1em;background:#e4eaf7;padding:8px;border-radius:5px;'>$SelectedModel</p></div>"

    # Images section
    $htmlImages = $ImagePaths | ForEach-Object {
        $imgName = [System.IO.Path]::GetFileName($_)
        $imgBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($_))
        "<div><h3>$imgName</h3><img src='data:image/jpeg;base64,$imgBase64' style='max-width:400px;max-height:400px;'/></div>"
    }

    # Prompt section
    $htmlPromptBody = ConvertFrom-Markdown -InputObject $Prompt
    $htmlPrompt = "<div><h2>Prompt Used</h2>" + $htmlPromptBody.Html + "</div>"

    # Response section (if provided)
    $htmlResponse = ""
    if ($Response) {
        $htmlResponseBody = ConvertFrom-Markdown -InputObject $Response
        $htmlResponse = "<div><h2>Ollama Response</h2>" + $htmlResponseBody.Html + "</div>"
    }

    # Combine all sections: Model + Images + Response + Prompt
    return "<html><body>" + $htmlModel + "<div style='display: flex; gap: 20px; flex-direction: row;'>" + ($htmlImages -join "`n") + $htmlResponse + "</div><hr/>" + $htmlPrompt + "</body></html>"
}

# Main script execution
try {
    # Read prompt from file
    $Prompt = Get-PromptFromFile

    # Get all available test images
    $TestImages = Get-AvailableTestImages

    # Check if reference image exists
    if (!(Test-Path $ReferenceImagePath)) {
        Write-Error "Reference image not found: $ReferenceImagePath"
        exit 1
    }

    # Validate and get selected model
    $SelectedModel = Get-ValidatedModel -ModelIndex $ModelIndex

    # Determine which test images to process
    if ($PSBoundParameters.ContainsKey('TestImageNumber')) {
        $testImagePath = Join-Path $ScriptDir "tmp/test_image$TestImageNumber.jpg"
        if (!(Test-Path $testImagePath)) {
            Write-Error "Test image not found: $testImagePath"
            exit 1
        }
        $TestImagesToProcess = @($testImagePath)
    }
    else {
        # No test image specified, process all available test images
        $TestImagesToProcess = $TestImages
        Write-Host "No test image specified. Processing all available test images: $($TestImagesToProcess.Count) images found."
    }

    # Process each test image
    foreach ($testImage in $TestImagesToProcess) {
        $imagesToUse = @($ReferenceImagePath, $testImage)

        # Convert images to base64
        $Base64Images = ConvertTo-Base64Images -ImagePaths $imagesToUse

        if ($Base64Images.Count -eq 0) {
            Write-Error "No valid images found"
            continue
        }

        $testImageName = [System.IO.Path]::GetFileName($testImage)
        $usedImageNames = @([System.IO.Path]::GetFileName($ReferenceImagePath), $testImageName)

        # Generate a UUID for this run
        $uuid = [guid]::NewGuid().ToString()
        $currentPrompt = "This is task number $uuid.`n`n$Prompt"

        # Generate initial HTML content (without response)
        $htmlFileName = [System.IO.Path]::ChangeExtension($testImageName, 'html')
        $tempHtmlPath = Join-Path $ScriptDir "tmp/$htmlFileName"
        $htmlContent = New-HtmlContent -SelectedModel $SelectedModel -ImagePaths $imagesToUse -Prompt $currentPrompt -Response "Processing request..."
        Set-Content -Path $tempHtmlPath -Value $htmlContent

        Write-Host "Model used in request: $SelectedModel"
        Write-Host "Images used in request: $($usedImageNames -join ', ')"

        # Prepare payload for Ollama
        if ($SelectedModel -eq 'llama3.2-vision:11b') {
            $Message = @{
                role = "user"
                content = $currentPrompt
                images = $Base64Images
            }
            $PayloadObject = @{
                model = $SelectedModel
                messages = @($Message)
            }
        }
        else {
            $PayloadObject = @{
                uuid = $uuid
                options = @{
                    num_ctx = 65536
                }
                model = $SelectedModel
                prompt = $currentPrompt
                images = $Base64Images
                stream = $false
            }
        }
        $Payload = $PayloadObject | ConvertTo-Json -Compress -Depth 5


        # Save request body to tmp/request.json (pretty-printed)
        $tmpRequestPath = Join-Path $ScriptDir 'tmp/request.json'
        $PayloadObject | ConvertTo-Json -Depth 5 | Out-File -FilePath $tmpRequestPath -Encoding utf8

        # Send request to Ollama with timing
        Write-Host 'Sending request to Ollama...'
        $startTime = Get-Date
        $Response = Invoke-RestMethod -Uri $OllamaEndpoint -Method Post -ContentType 'application/json; charset=utf-8' -Body $Payload
        $endTime = Get-Date
        $elapsed = $endTime - $startTime
        Write-Host ("Response received. Time taken: {0:N2} seconds" -f $elapsed.TotalSeconds)

        $responseText = if ($Response.response) { $Response.response } else { $Response }
        Write-Output $responseText

        # Update HTML content with response (response above prompt)
        $htmlContentWithResponse = New-HtmlContent -SelectedModel $SelectedModel -ImagePaths $imagesToUse -Prompt $currentPrompt -Response $responseText
        Set-Content -Path $tempHtmlPath -Value $htmlContentWithResponse

        # If processing multiple images, add separator
        if ($TestImagesToProcess.Count -gt 1) {
            Write-Host "`n" + "="*50 + "`n"
        }
    }
}
catch {
    Write-Error "Script execution failed: $_"
    exit 1
}
