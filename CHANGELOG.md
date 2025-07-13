# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-13

### Added
- Initial release of phAI - AI-powered Google Photos automation tool
- Automated Google Photos scanning and navigation
- AI image description using Ollama's LLaVA models (7b and 13b)
- Configurable Ollama endpoint support
- Custom AI prompt configuration
- Real-time photo processing with start/stop controls
- Collapsible details view with metadata display
- Table-based data presentation for photo information
- Cross-platform Windows executable support
- Professional UI with modern typography and styling

### Features
- **Google Photos Integration**: Automated navigation through photo library
- **AI Processing**: Generate detailed image descriptions using local Ollama models
- **Flexible Configuration**:
  - Custom Ollama endpoint (default: localhost:11434)
  - Model selection (llava:7b, llava:13b)
  - Customizable AI prompts for specific use cases
- **User Interface**:
  - Clean, modern design with Inter font family
  - Collapsible sections for better organization
  - Table-based metadata display
  - Real-time progress monitoring
  - Start/stop controls for processing
- **Cross-Platform**: Built with Electron for Windows, macOS, and Linux support
- **Export Capability**: Process and analyze photo collections

### Technical Details
- Built with Electron for cross-platform desktop deployment
- Uses webview for secure Google Photos integration
- Implements Ollama API for local AI processing
- Professional code organization with JSDoc documentation
- Comprehensive error handling and user feedback

### Development
- Complete JSDoc documentation for all functions
- Clean, maintainable code structure
- Professional repository setup with README and LICENSE
- Build configuration for Windows ZIP distribution
- Removed legacy code and unused dependencies
