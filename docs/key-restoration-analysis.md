# Key Image Restoration Flow Analysis

## Current Issue Identified

The key image restoration bug occurs because keys are incorrectly routed through the generic window restoration logic instead of using key-specific restoration that applies proper image path resolution.

## Current Flow Analysis

### 1. Key Creation (Working Correctly)
When a new key is created via `createKey()`:
```javascript
// In windowManager.js createKey function:
const resolvedKeyImage = resolveKeyImagePath(imagePath);
const htmlContent = `pictureViewer.html?imagePath=${encodeURIComponent(resolvedKeyImage)}&fitMode=cover`;
```

- Uses `resolveKeyImagePath()` for proper image path resolution
- Creates `pictureViewer.html` with correct image path parameter
- Applies fallback chain: custom image → Key.png → Keychain.jpeg

### 2. Key Serialization (Working Correctly)
When a key is saved:
```javascript
// In windowStorage.js extractContentConfig function:
contentConfig.path = params.get('path') || params.get('imagePath') || '';
```

- Extracts image path from URL parameters
- Stores in `contentConfig.path`
- Window type correctly identified as 'key'

### 3. Key Restoration (BROKEN - The Problem)
When a key is restored via `recreateWindowByType()`:

```javascript
// In windowStorage.js recreateWindowByType function:
switch (windowType) {
  case 'picture':
  case 'door':
    createdWindow = recreatePictureWindow(windowId, windowData);
    break;
  // ... other cases ...
  case 'key':  // ← Keys go to default case!
  case 'generic':
  default:
    createdWindow = recreateGenericWindow(windowId, windowData);  // ← WRONG!
    break;
}
```

**Problem**: Keys are routed to `recreateGenericWindow()` instead of key-specific logic.

### 4. What recreateGenericWindow Does (INCORRECT for Keys)
```javascript
// In windowStorage.js recreateGenericWindow function:
if (contentConfig && contentConfig.htmlName) {
  options.otherContents = contentConfig.htmlName;  // Uses 'pictureViewer.html'
}
return createWindow(windowId, options);  // Creates basic window without image path!
```

**Result**: Creates a window with `pictureViewer.html` but NO image path parameter, causing it to display `index.html` instead.

## Root Cause Analysis

1. **Incorrect Routing**: Keys are treated as generic windows instead of picture windows
2. **Missing Image Path Resolution**: No call to `resolveKeyImagePath()` during restoration
3. **Incomplete URL Construction**: The restored window gets `pictureViewer.html` without the required `imagePath` parameter

## Comparison: Working vs Broken

### Working (createKey):
```
createKey() → resolveKeyImagePath() → pictureViewer.html?imagePath=renderer/assets/Keys/Key.png
```

### Broken (restoration):
```
deserializeWindow() → recreateGenericWindow() → pictureViewer.html (no imagePath parameter)
```

## Required Fixes

1. **Add Key-Specific Routing**: Modify `recreateWindowByType()` to route keys to a dedicated function
2. **Create recreateKeyWindow Function**: Implement key-specific restoration logic
3. **Apply resolveKeyImagePath**: Use the same image path resolution as `createKey()`
4. **Extract Parameters Correctly**: Get image path from saved data and apply proper resolution
5. **Maintain Consistency**: Ensure restored keys behave identically to newly created keys

## Data Flow Issues

### Current Serialization (Correct):
```
Key Window URL: pictureViewer.html?imagePath=renderer/assets/Keys/Key.png
↓ (extraction)
contentConfig.path: "renderer/assets/Keys/Key.png"
```

### Current Restoration (Broken):
```
contentConfig.path: "renderer/assets/Keys/Key.png"
↓ (ignored by recreateGenericWindow)
Window URL: pictureViewer.html (missing imagePath parameter)
```

### Required Restoration (Fix):
```
contentConfig.path: "renderer/assets/Keys/Key.png"
↓ (processed by recreateKeyWindow)
resolveKeyImagePath(extractedPath)
↓
Window URL: pictureViewer.html?imagePath=renderer/assets/Keys/Key.png
```

## Impact

- **Severity**: Critical - Keys completely fail to display images after game restore
- **User Experience**: Keys show blank/broken content instead of key images
- **Scope**: Affects all saved games with keys
- **Backward Compatibility**: Must handle existing save files correctly