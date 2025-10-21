# Design Document

## Overview

The window storage and reopening system extends the existing terminal functionality to provide persistent window state management. The system will serialize window configurations into JSON files with a `.fenestra` extension, and provide drag-and-drop restoration capabilities through the terminal interface.

The design leverages the existing window management architecture in `windowManager.js` and terminal command system in `ipcHandlers.js`, adding new storage and restoration capabilities while maintaining compatibility with all current window types (picture, content, lens, terminal, door, key).

## Architecture

### Core Components

1. **Window Serializer** - Captures and serializes window state
2. **Window Deserializer** - Parses and validates stored window data  
3. **Storage Manager** - Handles file operations for .fenestra files
4. **Terminal Integration** - Extends terminal with save/restore commands and drag-drop
5. **Drag-Drop Handler** - Manages file drag-drop operations in terminal

### Data Flow

```
Save Flow:
Window → Serializer → Storage Manager → .fenestra file

Restore Flow:
.fenestra file → Drag-Drop Handler → Terminal → Deserializer → Window Manager → Recreated Window
```

### File Structure

```
project-root/
├── .fenestra-storage/          # Storage directory for saved windows
│   ├── window-{id}-{timestamp}.fenestra
│   └── ...
├── src/core/
│   ├── windowStorage.js        # New: Storage system implementation
│   ├── windowManager.js        # Extended: Add storage integration
│   └── ipcHandlers.js         # Extended: Add storage commands
└── renderer/
    └── terminal.html          # Extended: Add drag-drop support
```

## Components and Interfaces

### WindowStorage Module (`src/core/windowStorage.js`)

```javascript
// Core storage functions
export function serializeWindow(windowId)
export function deserializeWindow(windowData, options = {})
export function saveWindowToFile(windowId, customPath = null)
export function loadWindowFromFile(filePath)
export function validateWindowData(data)

// Storage management
export function getStorageDirectory()
export function ensureStorageDirectory()
export function listStoredWindows()
export function deleteStoredWindow(filename)
```

### Extended WindowManager Functions

```javascript
// New functions in windowManager.js
export function getWindowSerializationData(windowId)
export function createWindowFromData(windowData, options = {})
export function updateWindowFromData(windowId, windowData)
```

### Extended Terminal Commands

New terminal commands to be added to `ipcHandlers.js`:

- `save-window [windowId] [filename?]` - Save window to .fenestra file
- `restore-window [filepath]` - Restore window from .fenestra file  
- `list-saved` - List all saved window files
- `delete-saved [filename]` - Delete a saved window file

### Drag-Drop Integration

Enhanced `terminal.html` with:
- Drag-over visual feedback
- File validation on drop
- Automatic command population
- Error handling for invalid files

## Data Models

### Window Serialization Format

```json
{
  "version": "1.0",
  "timestamp": "2024-10-14T10:30:00.000Z",
  "metadata": {
    "originalId": "window-id",
    "windowType": "picture|content|lens|terminal|door|key|generic",
    "description": "User-friendly description"
  },
  "windowConfig": {
    "id": "window-id",
    "title": "Window Title",
    "bounds": {
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600
    },
    "properties": {
      "resizable": true,
      "transparent": false,
      "alwaysOnTop": false,
      "opacity": 1.0
    }
  },
  "contentConfig": {
    "htmlName": "index.html",
    "otherContents": {},
    "type": "text|image",
    "path": "relative/path/to/content",
    "surfaceContent": "...",
    "hiddenContent": "...",
    "blurAmount": 10,
    "blurred": true
  },
  "specialConfig": {
    "pictureSettings": {
      "imagePath": "doors/Door.png",
      "fitMode": "fill"
    },
    "lensSettings": {
      "targetWindowId": "content-window-1",
      "isLens": true
    },
    "doorKeySettings": {
      "isDoor": true,
      "isKey": true,
      "encrypted": false,
      "relatedItems": []
    }
  }
}
```

### File Naming Convention

- Format: `{windowType}-{originalId}-{timestamp}.fenestra`
- Examples:
  - `picture-door1-20241014103000.fenestra`
  - `content-text1-20241014103015.fenestra`
  - `lens-lens1-20241014103030.fenestra`

## Error Handling

### Serialization Errors
- Missing window: Log warning, return error object
- Inaccessible properties: Use defaults, log warning
- File system errors: Display user-friendly error message

### Deserialization Errors
- Invalid JSON: Display parse error, suggest file corruption
- Missing required fields: Display validation error with missing fields
- Version mismatch: Attempt backward compatibility, warn user
- Missing content files: Create window structure, warn about missing content

### Drag-Drop Errors
- Invalid file type: Display error, clear input
- File read errors: Display file access error
- Large files: Warn about file size, allow user to proceed

## Testing Strategy

### Unit Tests
- Window serialization accuracy for each window type
- JSON validation and error handling
- File path resolution and storage directory management
- Drag-drop event handling and validation

### Integration Tests
- End-to-end save and restore workflows
- Cross-window-type compatibility
- Terminal command integration
- File system operations across different platforms

### Manual Testing Scenarios
1. Save and restore each window type (picture, content, lens, etc.)
2. Drag multiple files onto terminal in sequence
3. Test with missing content files
4. Test with corrupted .fenestra files
5. Test storage directory creation and permissions
6. Test with very long file paths and special characters

## Security Considerations

### File System Access
- Restrict file operations to designated storage directory
- Validate file paths to prevent directory traversal
- Sanitize filenames to prevent injection attacks

### Content Validation
- Validate JSON structure before parsing
- Sanitize content paths and data
- Limit file size for drag-drop operations

### User Data Protection
- Store relative paths when possible for portability
- Avoid storing sensitive system information
- Provide clear error messages without exposing system details

## Performance Considerations

### File Operations
- Asynchronous file I/O to prevent UI blocking
- Lazy loading of window content during restoration
- Efficient JSON parsing for large window configurations

### Memory Management
- Stream large files instead of loading entirely into memory
- Clean up temporary objects after serialization/deserialization
- Limit concurrent file operations

### User Experience
- Progress indicators for large file operations
- Debounced drag-over effects to prevent flickering
- Responsive terminal during file operations

## Backward Compatibility

### Version Management
- Include version field in serialization format
- Maintain parser for older format versions
- Graceful degradation for unsupported features

### Migration Strategy
- Automatic detection of format versions
- Optional migration tools for bulk updates
- Clear documentation of breaking changes

## Future Extensibility

### Plugin Architecture
- Extensible serialization hooks for custom window types
- Configurable storage backends (local, cloud, network)
- Custom validation rules for specialized use cases

### Enhanced Features
- Batch operations (save/restore multiple windows)
- Window collections and workspaces
- Automatic backup and versioning
- Import/export functionality for sharing configurations