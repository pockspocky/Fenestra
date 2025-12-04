# Key Assets

This directory contains key image assets used in the Fenestra application.

## Key.png

**Default Key Image**

- **File**: `Key.png`
- **Format**: PNG (Portable Network Graphics)
- **Color Depth**: 8-bit/color RGBA (32-bit total)
- **Dimensions**: 245 x 245 pixels
- **File Size**: ~6.1 KB
- **Compression**: Non-interlaced
- **Transparency**: Supports alpha channel (RGBA)

### Usage

This image is used as the default key image when creating key windows in the application. It is referenced by the `resolveKeyImagePath()` function in `src/core/utils/assetPathResolver.js`.

**Default Behavior:**
- When `createKey()` is called without an `imagePath` parameter, this Key.png image is used automatically
- If Key.png is missing, the system falls back to the legacy Keychain.jpeg image for backward compatibility
- All existing code continues to work without modifications

**Code Example:**
```javascript
// Uses default Key.png image
const key = createKey('key-1', 'Master Key', false);
```

### Fallback Chain

The system implements a robust fallback mechanism to ensure keys always display:

1. **Custom Image** (if provided) - Developer-specified image path
2. **Default Image** - `renderer/assets/Keys/Key.png` (this file)
3. **Legacy Fallback** - `renderer/assets/doors/Keychain.jpeg` (old default)
4. **Broken Image** - If all fail, renderer displays broken image placeholder

This ensures backward compatibility with existing game levels and graceful degradation if assets are missing.

### Requirements

- **Minimum dimensions**: 100 x 100 pixels (recommended)
- **Maximum dimensions**: 500 x 500 pixels (recommended)
- **Format**: PNG with alpha channel support
- **File permissions**: Must be readable by the application
- **Location**: Must be at `renderer/assets/Keys/Key.png` for automatic detection

### Custom Key Images

Developers can override this default image by providing a custom image path when creating keys:

**Relative Path Example:**
```javascript
// Custom key with relative path (resolved from project root)
const goldKey = createKey('key-2', 'Gold Key', false, [], null, 
  'renderer/assets/Keys/GoldKey.png');
```

**Absolute Path Example:**
```javascript
// Custom key with absolute path
const specialKey = createKey('key-3', 'Special Key', false, [], null, 
  '/Users/developer/custom-keys/special-key.png');
```

**Validation:**
- Custom paths are validated before use
- Invalid or missing custom images automatically fallback to default Key.png
- Warnings are logged when fallback occurs for debugging

Custom images should follow the same format requirements for best results.
