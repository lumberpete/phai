# phAI - AI-powered Google Photos automation tool

phAI is an Electron-based desktop application that automates the process of scanning Google Photos and generating AI-powered descriptions for your images using Ollama's local AI models.

## Features

- **Automated Google Photos scanning**: Navigate through your photo library automatically
- **AI image description**: Generate detailed descriptions using configurable Ollama models
- **Customizable prompts**: Define your own AI prompts for specific description needs
- **Multiple model support**: Choose between llava:7b and llava:13b models
- **Configurable endpoint**: Connect to local or remote Ollama instances
- **Export functionality**: Export results to CSV for further analysis
- **Real-time progress**: Monitor scanning progress with stop/start controls
- **Detailed metadata**: View photo details, location data, and technical information

## Prerequisites

- [Ollama](https://ollama.ai) installed and running
- One of the supported vision models:
  - `ollama pull llava:7b` (smaller, faster)
  - `ollama pull llava:13b` (larger, more detailed)

## Installation

### Download Pre-built Binaries

Download the latest release from the [Releases](../../releases) page.

### Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/phai.git
   cd phai
   ```

2. Install dependencies:
   ```bash
   cd client
   npm install
   ```

3. Build for your platform:
   ```bash
   # For Windows (from any platform)
   npm run make

   # For your current platform
   npm start
   ```

## Usage

1. **Start Ollama**: Ensure Ollama is running with a vision model
   ```bash
   ollama serve
   ```

2. **Launch phAI**: Run the application and configure your settings:
   - **AI Prompt**: Customize the description prompt (default provides detailed descriptions)
   - **Ollama Endpoint**: Set your Ollama server address (default: localhost:11434)
   - **Model**: Choose between llava:7b or llava:13b
   - **Max Photos**: Set the number of photos to process

3. **Start Scanning**: Click "Start scanning Google Photos" to begin automated processing

4. **Monitor Progress**: Watch as phAI navigates your photos and generates descriptions

5. **Export Results**: Use the export feature to save your data as CSV

## Configuration

### Ollama Setup

The application connects to Ollama via HTTP API. Default configuration:
- **Endpoint**: `localhost:11434`
- **Model**: `llava:7b`
- **Temperature**: `0.1` (for consistent descriptions)

### Custom Prompts

You can customize the AI prompt to focus on specific aspects:
- **Default**: General detailed descriptions including subjects, setting, colors, mood, and text
- **Custom examples**:
  - "Identify any people in this image and describe their activities"
  - "Focus on the architectural elements and building styles visible"
  - "Describe any text, signs, or written content in detail"

## Development

### Project Structure

```
client/
├── src/
│   ├── index.html          # Main UI interface
│   ├── index.css           # Application styling
│   ├── renderer.js         # Core application logic
│   └── preload.js          # Electron preload script
├── forge.config.js         # Build configuration
└── package.json            # Dependencies and scripts
```

### Key Components

- **Renderer Process**: Handles UI interactions and Google Photos automation
- **Webview Integration**: Embeds Google Photos for automated navigation
- **Ollama API Client**: Manages AI model communication
- **Image Processing**: Downloads and processes photos for AI analysis

### Available Scripts

```bash
npm start          # Development mode
npm run make       # Build distributables
npm test           # Run tests (if available)
```

## Technical Details

### AI Integration

phAI uses Ollama's vision models to analyze images:
- Images are converted to base64 for API transmission
- Configurable prompts allow domain-specific descriptions
- Error handling ensures robust operation

### Google Photos Automation

- Uses Electron's webview to embed Google Photos
- Simulates user interactions for navigation
- Extracts metadata including location and technical details
- Handles dynamic content loading

### Cross-Platform Building

Built with Electron Forge for multi-platform support:
- Windows: ZIP distribution (tested)
- macOS: DMG (untested)
- Linux: AppImage/DEB (untested)

## Troubleshooting

### Common Issues

1. **Ollama Connection Failed**
   - Verify Ollama is running: `ollama serve`
   - Check endpoint configuration
   - Ensure firewall allows connections

2. **Model Not Found**
   - Pull the required model: `ollama pull llava:7b`
   - Verify model name in dropdown matches installed models

3. **Google Photos Access**
   - Ensure you're logged into Google Photos
   - Check for browser extensions that might interfere
   - Try refreshing the webview

### Debug Mode

Enable debug logging in development:
```bash
DEBUG=* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit with descriptive messages
5. Push to your fork and submit a pull request

## License

[MIT License](LICENSE) - see LICENSE file for details

## Acknowledgments

- [Ollama](https://ollama.ai) for providing local AI model infrastructure
- [Electron](https://electronjs.org) for cross-platform desktop framework
- LLaVA models for vision-language capabilities

## Support

For issues and questions:
- Check existing [Issues](../../issues)
- Create a new issue with detailed reproduction steps
- Include system information and error logs
