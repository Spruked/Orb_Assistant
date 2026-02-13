# CALI Floating Assistant Orb

A screen-aware, cursor-tracking AI assistant that integrates with UCM_4_Core ECM for cognitive enhancement.

## Features

- 🖥️ **Screen Awareness**: Sees your screen and understands UI elements
- 🖱️ **Cursor Tracking**: Maintains 350px distance from cursor
- 🧠 **Cognitive Integration**: Uses ECM and SKG for intelligent assistance
- 🤖 **Automation**: Can automate typing and clicks with permission
- 📊 **Habit Learning**: Learns your usage patterns via SKG
- 🔒 **Privacy-First**: Requires explicit permission for all features

## Installation

### Prerequisites

- Node.js 16+
- Python 3.8+
- Tesseract OCR

### Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install

# Install Tesseract OCR
# macOS
brew install tesseract
# Ubuntu
sudo apt install tesseract-ocr
# Windows: Download from GitHub releases
```

### Build and Run

```bash
# Build the app
npm run build

# Start the orb
npm start
```

Or use the launch script:
```bash
chmod +x launch.sh
./launch.sh
```

## Architecture

### Core Components

1. **FloatingAssistantOrb** (Python)
   - Screen capture and OCR
   - Cursor tracking and positioning
   - ECM integration for cognitive processing
   - SKG habit learning

2. **Electron Main Process**
   - IPC bridge between Python and React
   - Window management
   - Permission handling

3. **React Renderer**
   - Floating orb UI
   - Query interface
   - Position updates

### Data Flow

```
Screen → OCR/Vision → ECM → Task Planning → Automation
Cursor → Position Tracking → Orb Movement
User Habits → SKG Learning → Personalized Assistance
```

## Permissions

The orb requests the following permissions:

- **Screen Access**: Required for contextual assistance
- **Automation**: Optional, allows automated typing/clicking
- **Browser Access**: For web-specific features
- **Desktop Access**: For system-wide assistance

## SKG Learning

The orb learns:

- Frequently used applications
- Typing patterns and speed
- Click heatmaps
- Common tasks and workflows
- Optimal assistance timing

All learning data is stored in the UCM_4_Core vault system.

## Development

### Project Structure

```
electron/
├── main/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Secure IPC bridge
│   └── orb-bridge.js    # Python integration
├── src/
│   ├── components/
│   │   ├── FloatingOrb.jsx
│   │   └── FloatingOrb.css
│   ├── main.jsx         # React entry point
│   └── index.html       # App HTML
├── requirements.txt     # Python dependencies
├── package.json         # Node.js config
└── launch.sh           # Launch script
```

### Adding New Features

1. Add Python methods to `FloatingAssistantOrb`
2. Expose via IPC in `orb-bridge.js`
3. Use in React components via `electronAPI`

## Security

- All screen data is processed locally
- No data is sent to external servers
- User must explicitly grant permissions
- Automation requires additional permission
- All data encrypted in UCM vault system

## Troubleshooting

### Orb Not Appearing
- Check console for permission errors
- Ensure screen access permission granted
- Verify Python dependencies installed

### Performance Issues
- Reduce screen capture region size
- Adjust cursor tracking frequency
- Disable vision model if not needed

### Permission Errors
- Restart the application
- Check OS security settings
- Reinstall with proper permissions