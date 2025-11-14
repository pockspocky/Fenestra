# Fenestra

An Electron-based window puzzle game featuring dynamic window management, lens systems, and interactive door-key mechanics.

## Features

### 🪟 Advanced Window Management
- **Dynamic Window Creation**: Create various types of windows (doors, keys, pictures, content, lenses)
- **Window Storage System**: Save and restore window configurations with full state preservation
- **Smart Positioning**: Automatic window offset and overlap avoidance for optimal layout
- **Interactive Terminal**: Command-line interface for window control and management

### 🔍 Lens System
- **Visual Decryption**: Create semi-transparent lens windows to reveal clear content through blurred surfaces
- **Multi-Lens Support**: Up to 3 simultaneous lens windows for complex puzzles
- **Real-time Tracking**: Lens windows automatically sync with target content positioning
- **Customizable Effects**: Adjustable blur levels and transparency settings

### 🚪 Door-Key System
- **Permission-Based Access**: Doors require specific keys to open
- **Visual Feedback**: Animated responses for successful and failed access attempts
- **Relationship Management**: Complex door-key relationships with overlap detection
- **Smart Collision**: Automatic key positioning to avoid door overlap

### 💾 Window Storage
- **Complete State Preservation**: Save window configurations, content, and special properties
- **Drag-and-Drop Restore**: Simply drag .fenestra files into terminal to restore windows
- **Portable Configurations**: Relative path handling for cross-system compatibility
- **Version Management**: Built-in versioning for configuration compatibility

## Quick Start

### Installation
```bash
npm install
npm start
```

### Basic Usage

1. **Open Terminal**: Press `Ctrl+~` (Windows/Linux) or `Cmd+~` (Mac)

2. **Create Content Windows**:
   ```bash
   create-content secret text "" 20 true
   create-lens viewer secret 300 200
   ```

3. **Save Window Configurations**:
   ```bash
   save-window secret my-puzzle.fenestra
   ```

4. **Restore Windows**: Drag .fenestra files into terminal or use:
   ```bash
   restore-window my-puzzle.fenestra
   ```

## Architecture

### Core Modules (`src/core/`)
- **windowManager.js**: Window creation, positioning, and lifecycle management
- **windowStorage.js**: Serialization, file operations, and state restoration
- **lensSystem.js**: Lens window mechanics and content synchronization
- **doorKeySystem.js**: Permission system and relationship management
- **gameLogic.js**: Game state and demo content management
- **workerManager.js**: Background processing for overlap detection
- **ipcHandlers.js**: Inter-process communication handling

### Window Types
- **Picture Windows**: Display images with customizable fit modes
- **Content Windows**: Text/image display with blur effects
- **Lens Windows**: Transparent overlays for content revelation
- **Door/Key Windows**: Interactive puzzle elements
- **Terminal Window**: Command interface for system control

## Terminal Commands

### Window Management
```bash
create-window [id] [width] [height]     # Create basic window
create-picture [id] [path] [fit]        # Create picture window
create-content [id] [type] [path] [blur] [blurred]  # Create content window
create-lens [id] [target] [width] [height]  # Create lens window
```

### Storage Operations
```bash
save-window [windowId] [filename]       # Save window configuration
restore-window [filepath]               # Restore from file
list-saved                              # List stored configurations
delete-saved [filename]                 # Delete stored file
```

### System Control
```bash
list                                    # List all windows
hide [windowId]                         # Hide window
show [windowId]                         # Show window
close [windowId]                        # Close window
set-opacity [windowId] [0-1]           # Set transparency
```

## Configuration

### Window Positioning
```javascript
import { setWindowOffset } from './src/core/windowManager.js';
setWindowOffset(30, 30); // 30px offset for new windows
```

### Overlap Prevention
```javascript
import { setKeyDoorMaxOverlap } from './src/core/windowManager.js';
setKeyDoorMaxOverlap(0.4); // 40% maximum overlap allowed
```

### Logging Levels
```javascript
import { setLogLevel } from './src/core/loggerConfig.js';
setLogLevel("debug"); // debug (default), log, warn, error, none
```

## File Structure

```
fenestra/
├── src/core/                   # Core system modules
│   ├── windowManager.js        # Window management
│   ├── windowStorage.js        # Storage system
│   ├── lensSystem.js          # Lens mechanics
│   ├── doorKeySystem.js       # Door-key system
│   ├── gameLogic.js           # Game logic
│   ├── workerManager.js       # Background processing
│   └── ipcHandlers.js         # IPC communication
├── renderer/                   # HTML templates
│   ├── terminal.html          # Terminal interface
│   ├── contentViewer.html     # Content display
│   ├── lensViewer.html        # Lens overlay
│   └── pictureViewer.html     # Picture display
├── .fenestra-storage/          # Saved configurations
├── doors/                      # Demo images
├── main.js                     # Application entry
└── package.json               # Dependencies
```

## Development

### Adding New Window Types
1. Extend `windowManager.js` with creation function
2. Add serialization support in `windowStorage.js`
3. Create HTML template in `renderer/`
4. Update terminal commands in `ipcHandlers.js`

### Custom Lens Effects
Modify `lensViewer.html` CSS for custom visual effects:
```css
#lens-frame {
  border: 3px solid rgba(255, 0, 0, 0.8);
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
}
```

### Storage Format
Window configurations are saved as JSON with metadata:
```json
{
  "version": "1.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "metadata": {
    "originalId": "window1",
    "windowType": "content",
    "description": "Content window with blur effect"
  },
  "windowConfig": { /* window properties */ },
  "contentConfig": { /* content settings */ },
  "specialConfig": { /* type-specific settings */ }
}
```

## Documentation

All documentation has been organized in the `docs/` directory:

- **[Documentation Index](docs/README.md)** - Complete documentation overview
- **[Configuration Guide](docs/CONFIGURATION_GUIDE.md)** - System configuration
- **[Email System](docs/EMAIL_SYSTEM.md)** - Email receiver interface
- **[Email JSON Guide](docs/EMAIL_JSON_GUIDE.md)** - How to write email JSON files
- **[Lens System Guide](docs/LENS_SYSTEM_GUIDE.md)** - Lens mechanics and usage
- **[Level Creation Guide](docs/LEVEL_CREATION_GUIDE.md)** - Creating game levels
- **[Window Storage Guide](docs/WINDOW_STORAGE_GUIDE.md)** - Window state persistence
- **[Logging Guide](src/core/LOGGING_GUIDE.md)** - Logging system configuration

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.