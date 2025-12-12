# Design Document: New Game Confirmation Dialog

## Overview

This feature adds a confirmation dialog to the "New Game" button in the start menu to prevent accidental data loss. The implementation will modify the `handleNewGame` function in `startMenuManager.js` to check for existing saved game data and display a confirmation dialog before proceeding with the destructive action of clearing all saved data.

The design follows the existing patterns in the codebase:
- Uses Electron's native `dialog.showMessageBox` API for platform-consistent dialogs
- Integrates with the existing game state management system
- Maintains the current error handling and logging patterns
- Preserves the existing user experience when no saved data exists

## Architecture

### Component Interaction Flow

```
User Action (Click "New Game" or Press "N")
    ↓
handleNewGame() in startMenuManager.js
    ↓
Check if saved state exists (hasSavedState())
    ↓
    ├─ No saved state → Proceed directly to create demo content
    │
    └─ Saved state exists → Show confirmation dialog
        ↓
        ├─ User cancels → Return to start menu (no changes)
        │
        └─ User confirms → Clear storage directory → Create demo content
```

### Modified Components

1. **startMenuManager.js** (`src/core/startMenuManager.js`)
   - Modify `handleNewGame()` function to add confirmation logic
   - Add new helper function `clearStorageDirectory()` to remove all files from `.fenestra-storage`

2. **gameStateManager.js** (`src/core/systems/gameStateManager.js`)
   - No changes required (existing functions will be used)

### Integration Points

- **Electron Dialog API**: `dialog.showMessageBox()` for confirmation dialog
- **Game State Manager**: `hasSavedState()` to check for existing saves
- **File System**: Node.js `fs` module to clear storage directory
- **Start Menu HTML**: No changes required (existing button handlers remain the same)

## Components and Interfaces

### Modified Function: handleNewGame()

**Location**: `src/core/startMenuManager.js`

**Current Signature**:
```javascript
export async function handleNewGame()
```

**Enhanced Logic Flow**:
1. Check if saved state exists using `hasSavedState()`
2. If saved state exists:
   - Display confirmation dialog using `dialog.showMessageBox()`
   - If user cancels, return early with success: false
   - If user confirms, proceed to step 3
3. Close start menu
4. Clear storage directory using new `clearStorageDirectory()` function
5. Create demo content
6. Notify game started callback

**Return Type**: `Promise<Object>`
```javascript
{
  success: boolean,
  message: string,
  cancelled?: boolean,  // New field for cancelled confirmation
  error?: string
}
```

### New Function: clearStorageDirectory()

**Location**: `src/core/startMenuManager.js`

**Signature**:
```javascript
async function clearStorageDirectory()
```

**Purpose**: Remove all files from the `.fenestra-storage` directory to ensure a clean slate for new games.

**Implementation Details**:
- Get storage directory path from `getGameDataDirectory()` + `.fenestra-storage`
- Check if directory exists
- Read all files in directory
- Delete each file individually
- Log each deletion operation
- Handle errors gracefully (log but don't throw)

**Return Type**: `Promise<Object>`
```javascript
{
  success: boolean,
  filesRemoved: number,
  errors: Array<string>
}
```

### Confirmation Dialog Configuration

**Dialog Options**:
```javascript
{
  type: 'warning',
  title: 'Start New Game?',
  message: 'Start New Game?',
  detail: 'This will delete your current saved game. Are you sure you want to start a new game?',
  buttons: ['Cancel', 'Start New Game'],
  defaultId: 0,  // Default to Cancel for safety
  cancelId: 0,   // Escape key maps to Cancel
  noLink: true   // Prevent button grouping on macOS
}
```

**Response Handling**:
- `response === 0`: User clicked "Cancel" → Return early
- `response === 1`: User clicked "Start New Game" → Proceed with clearing data

## Data Models

### Confirmation Dialog Response

```javascript
{
  response: number,  // Button index clicked (0 = Cancel, 1 = Start New Game)
  checkboxChecked: boolean  // Not used in this implementation
}
```

### Storage Clear Result

```javascript
{
  success: boolean,
  filesRemoved: number,
  errors: Array<string>
}
```

### Enhanced handleNewGame Result

```javascript
{
  success: boolean,
  message: string,
  cancelled?: boolean,  // True if user cancelled confirmation
  storageCleared?: {    // Details about storage clearing
    filesRemoved: number,
    errors: Array<string>
  },
  error?: string
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, the following redundancies were identified:
- Properties 3.1 and 3.2 are redundant with 1.1 and 1.5 since keyboard shortcuts call the same `handleNewGame` function
- Property 3.3 is inherently true since both trigger paths call the same function
- Properties 4.2 and 4.3 are specific cases subsumed by property 4.4 (all files removed)
- Property 5.4 is redundant with 1.4 (both test cancellation preserves state)

The following properties provide unique validation value:

### Property 1: Confirmation dialog shown when save exists

*For any* saved game state, when the new game action is triggered, a confirmation dialog should be displayed before any destructive operations occur.

**Validates: Requirements 1.1, 3.1**

### Property 2: State unchanged on cancellation

*For any* storage directory state, when the user cancels the confirmation dialog, all files should remain unchanged and no demo content should be created.

**Validates: Requirements 1.4, 5.4**

### Property 3: Storage completely cleared on confirmation

*For any* set of files in the `.fenestra-storage` directory, when the user confirms the new game action, all files should be deleted.

**Validates: Requirements 1.3, 4.1, 4.4**

### Property 4: No confirmation when no save exists

*For any* system state where no saved game exists, the new game action should proceed directly to creating demo content without displaying a confirmation dialog.

**Validates: Requirements 1.5, 3.2**

### Property 5: Operations ordered correctly

*For any* new game confirmation, storage clearing must complete before demo content creation begins.

**Validates: Requirements 5.3**

### Property 6: Error resilience in dialog display

*For any* error that occurs during confirmation dialog display, the system should log the error and proceed with the new game action as a fallback.

**Validates: Requirements 5.5**

### Property 7: Error resilience in storage clearing

*For any* error that occurs during storage directory clearing, the system should log the error and continue with creating demo content.

**Validates: Requirements 5.6**

### Property 8: Logging of clear operations

*For any* storage clearing operation, the system should log details including the number of files removed.

**Validates: Requirements 4.5**

## Error Handling

### Dialog Display Errors

**Scenario**: Electron dialog API fails to display the confirmation dialog

**Handling**:
1. Catch the error in try-catch block
2. Log error with full context (error message, stack trace)
3. Proceed with new game action as fallback (safer than blocking user)
4. Return success result with warning message

**Rationale**: If we can't show the dialog, it's better to allow the user to proceed than to block them completely. The user explicitly clicked "New Game" so their intent is clear.

### Storage Clearing Errors

**Scenario**: File deletion fails for one or more files

**Handling**:
1. Continue attempting to delete remaining files (don't fail fast)
2. Collect all errors in an array
3. Log each error with file path and error message
4. Return result with success=true but include error details
5. Proceed with demo content creation

**Rationale**: Partial clearing is better than no clearing. Even if some files can't be deleted, we should still create demo content and let the user play.

### Directory Access Errors

**Scenario**: Storage directory doesn't exist or isn't accessible

**Handling**:
1. Log the situation (not necessarily an error)
2. Skip clearing operation
3. Proceed directly to demo content creation
4. Return success result

**Rationale**: If the directory doesn't exist, there's nothing to clear. This is a valid state.

### Error Logging Pattern

All errors should be logged with structured context:

```javascript
console.error('[START_MENU] Error description', {
  operation: 'operation-name',
  error: error.message,
  stack: error.stack,
  context: { /* relevant context */ }
});
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

1. **Dialog Configuration Test**: Verify dialog is called with correct options (title, message, buttons)
2. **No Save Bypass Test**: Verify no dialog shown when no save exists
3. **Cancellation Test**: Verify cancellation returns early with correct result
4. **Storage Clearing Test**: Verify all files are deleted from storage directory
5. **Error Handling Tests**: Verify graceful handling of dialog and file system errors

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (JavaScript property testing library):

**Configuration**: Each property test will run a minimum of 100 iterations.

**Test Tagging**: Each property test will include a comment with the format:
```javascript
// Feature: new-game-confirmation, Property 1: Confirmation dialog shown when save exists
```

#### Property Test 1: Confirmation with saves
- **Property**: Property 1 from design document
- **Generator**: Random saved game states (varying file counts, sizes)
- **Test**: Verify dialog is shown before any file operations
- **Tag**: `// Feature: new-game-confirmation, Property 1: Confirmation dialog shown when save exists`

#### Property Test 2: Cancellation preserves state
- **Property**: Property 2 from design document
- **Generator**: Random storage directory contents
- **Test**: Verify all files unchanged after cancellation
- **Tag**: `// Feature: new-game-confirmation, Property 2: State unchanged on cancellation`

#### Property Test 3: Complete storage clearing
- **Property**: Property 3 from design document
- **Generator**: Random sets of files in storage directory
- **Test**: Verify all files deleted after confirmation
- **Tag**: `// Feature: new-game-confirmation, Property 3: Storage completely cleared on confirmation`

#### Property Test 4: Bypass without saves
- **Property**: Property 4 from design document
- **Generator**: Various empty storage states
- **Test**: Verify no dialog shown, demo content created
- **Tag**: `// Feature: new-game-confirmation, Property 4: No confirmation when no save exists`

#### Property Test 5: Operation ordering
- **Property**: Property 5 from design document
- **Generator**: Random storage states
- **Test**: Verify storage cleared before demo content created
- **Tag**: `// Feature: new-game-confirmation, Property 5: Operations ordered correctly`

#### Property Test 6: Dialog error resilience
- **Property**: Property 6 from design document
- **Generator**: Various error conditions in dialog API
- **Test**: Verify fallback behavior and logging
- **Tag**: `// Feature: new-game-confirmation, Property 6: Error resilience in dialog display`

#### Property Test 7: Storage error resilience
- **Property**: Property 7 from design document
- **Generator**: Various file deletion error conditions
- **Test**: Verify continued operation and logging
- **Tag**: `// Feature: new-game-confirmation, Property 7: Error resilience in storage clearing`

#### Property Test 8: Logging verification
- **Property**: Property 8 from design document
- **Generator**: Random storage clearing operations
- **Test**: Verify appropriate logs generated with file counts
- **Tag**: `// Feature: new-game-confirmation, Property 8: Logging of clear operations`

### Integration Testing

Integration tests will verify the complete flow:

1. **Full Confirmation Flow**: Test complete user journey from button click through confirmation to demo content
2. **Keyboard Shortcut Integration**: Verify "N" key triggers same flow as button click
3. **Start Menu Integration**: Verify start menu closes after confirmation
4. **Game State Integration**: Verify demo content created correctly after clearing

### Manual Testing Checklist

- [ ] Click "New Game" with existing save → Dialog appears
- [ ] Click "Cancel" in dialog → Returns to start menu, save intact
- [ ] Click "Start New Game" in dialog → Save deleted, demo content created
- [ ] Click "New Game" without save → No dialog, demo content created immediately
- [ ] Press "N" key with save → Dialog appears
- [ ] Press "N" key without save → No dialog, demo content created
- [ ] Press Escape in dialog → Treated as cancel
- [ ] Verify all files removed from `.fenestra-storage` after confirmation
- [ ] Verify backup files also removed
- [ ] Test on macOS, Windows, and Linux for dialog appearance

## Implementation Notes

### File System Operations

Use Node.js `fs` module with proper error handling:

```javascript
import fs from 'node:fs';
import path from 'node:path';

// Read directory contents
const files = fs.readdirSync(storageDir);

// Delete each file
for (const file of files) {
  try {
    const filePath = path.join(storageDir, file);
    fs.unlinkSync(filePath);
  } catch (error) {
    // Log but continue
  }
}
```

### Dialog API Usage

Use Electron's dialog API with proper configuration:

```javascript
import { dialog } from 'electron';

const result = await dialog.showMessageBox({
  type: 'warning',
  title: 'Start New Game?',
  message: 'Start New Game?',
  detail: 'This will delete your current saved game. Are you sure you want to start a new game?',
  buttons: ['Cancel', 'Start New Game'],
  defaultId: 0,
  cancelId: 0,
  noLink: true
});

if (result.response === 0) {
  // User cancelled
  return { success: false, cancelled: true };
}
```

### Logging Best Practices

Follow existing logging patterns in the codebase:

```javascript
console.log('[START_MENU] Displaying new game confirmation dialog');
console.log('[START_MENU] User confirmed new game, clearing storage');
console.log('[START_MENU] Storage cleared: 3 files removed');
console.warn('[START_MENU] Failed to delete file:', { filePath, error });
console.error('[START_MENU] Dialog display failed:', { error: error.message });
```

## Security Considerations

### Path Validation

- Only delete files within the `.fenestra-storage` directory
- Use `path.join()` to construct file paths safely
- Verify directory path before deletion operations
- Don't follow symlinks outside the storage directory

### User Confirmation

- Default button is "Cancel" for safety
- Escape key maps to cancel action
- Clear warning message about data loss
- No automatic confirmation or timeout

### Error Information Disclosure

- Log full error details for debugging
- Don't expose file system paths to user in dialogs
- Keep user-facing error messages generic and helpful

## Performance Considerations

### Dialog Display

- Dialog display is synchronous from user perspective
- Minimal performance impact (< 100ms typically)
- No optimization needed

### File Deletion

- Small number of files (typically 1-3)
- Synchronous deletion is acceptable
- Total operation time < 50ms for typical case
- No need for async operations or progress indication

### Memory Usage

- No significant memory impact
- File operations are synchronous and immediate
- No caching or buffering required

## Backward Compatibility

### Existing Behavior Preservation

- When no save exists, behavior is unchanged (no dialog shown)
- Demo content creation remains identical
- Start menu closing behavior unchanged
- Keyboard shortcuts continue to work

### Migration Path

- No migration needed (pure addition of confirmation)
- Existing saves remain compatible
- No changes to save file format
- No changes to game state structure

## Future Enhancements

### Potential Improvements

1. **Save Backup Option**: Add checkbox to create backup before deletion
2. **Multiple Save Slots**: Support multiple save files with selection
3. **Save Preview**: Show save metadata in confirmation dialog (timestamp, progress)
4. **Undo Capability**: Temporary backup that can be restored
5. **Settings Integration**: Option to disable confirmation for advanced users

### Extension Points

- Confirmation dialog configuration could be externalized
- Storage clearing could be made pluggable for different storage backends
- Dialog content could be localized for internationalization
