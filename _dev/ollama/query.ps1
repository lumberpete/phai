# phAI - PowerShell script to send prompt and images to local Ollama instance
# Usage: Run from the _dev/ollama directory

$OllamaEndpoint = 'http://localhost:11434/api/generate'
$Models = @(
   'gemma3:12b',
   'gemma3:4b',
   'minicpm-v', # good for image queries
   'qwen2.5vl:7b',
   'llava:7b',
   'llava:13b'
)
$PromptFile = 'prompt.txt'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Declare $TestImages array: reference first, then test_image0-4.jpg
$TestImages = @(
	Join-Path $ScriptDir 'tmp/reference_image.jpg'
	Join-Path $ScriptDir 'tmp/test_image0.jpg'
	Join-Path $ScriptDir 'tmp/test_image1.jpg'
	Join-Path $ScriptDir 'tmp/test_image2.jpg'
	Join-Path $ScriptDir 'tmp/test_image3.jpg'
)

# Read prompt from file
if (!(Test-Path $PromptFile)) {
	Write-Error "Prompt file not found: $PromptFile"
	exit 1
}
# Read all lines and discard anything after '--- NOTES'
$PromptLines = Get-Content $PromptFile
$NotesIndex = $PromptLines.IndexOf('--- NOTES')
if ($NotesIndex -ge 0) {
	$PromptLines = $PromptLines[0..($NotesIndex - 1)]
}
$Prompt = ($PromptLines -join "`n").Trim()


# Convert all images to base64 and store in $Base64Images array
$Base64Images = @()
for ($i = 0; $i -lt $TestImages.Count; $i++) {
	if (!(Test-Path $TestImages[$i])) {
		Write-Error "Image not found: $($TestImages[$i])"
		exit 1
	}
	$Base64Images += [Convert]::ToBase64String([IO.File]::ReadAllBytes($TestImages[$i]))
}

# Allow passing image indexes as script arguments

# Simplified argument parsing:
# $args[0] = reference image index (default 0)
# $args[1] = test image index (default 1)
# $args[2] = model index (default 3)

$defaultRefIdx = 0
$defaultTestIdx = 1
$defaultModelIdx = 3

$refIdx = if ($args.Count -ge 1) { [int]$args[0] } else { $defaultRefIdx }
$testIdx = if ($args.Count -ge 2) { [int]$args[1] } else { $defaultTestIdx }
$modelIndex = if ($args.Count -ge 3) { [int]$args[2] } else { $defaultModelIdx }

if ($modelIndex -lt 0 -or $modelIndex -ge $Models.Count) {
	Write-Error "Invalid model index: $modelIndex"
	exit 1
}
$SelectedModel = $Models[$modelIndex]
$usedImageIndexes = @($refIdx, $testIdx)
$usedImageNames = $usedImageIndexes | ForEach-Object { [System.IO.Path]::GetFileName($TestImages[$_]) }
Write-Host "Model used in request: $SelectedModel"
Write-Host "Images used in request: $($usedImageNames -join ', ')"
$Payload = @{
   model  = $SelectedModel
   prompt = $Prompt
   images = $usedImageIndexes | ForEach-Object { $Base64Images[$_] }
   stream = $false
} | ConvertTo-Json -Compress

# Send request to Ollama
try {
	Write-Host 'Sending request to Ollama...'
	$Response = Invoke-RestMethod -Uri $OllamaEndpoint -Method Post -ContentType 'application/json' -Body $Payload
	Write-Host 'Response received.'
	if ($Response.response) {
		Write-Output $Response.response
	}
 else {
		Write-Output $Response
	}
}
catch {
	Write-Error "Failed to communicate with Ollama: $_"
	exit 1
}
