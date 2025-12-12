# Implementation Plan

- [x] 1. Implement storage directory clearing function
  - Create `clearStorageDirectory()` helper function in `startMenuManager.js`
  - Get storage directory path using existing `getGameDataDirectory()` from config
  - Read all files in the `.fenestra-storage` directory
  - Delete each file individually with error handling
  - Return result object with files removed count and any errors
  - Log each file deletion operation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 1.1 Write property test for storage clearing
  - **Property 3: Storage completely cleared on confirmation**
  - **Validates: Requirements 1.3, 4.1, 4.4**

- [ ]* 1.2 Write property test for clear operation logging
  - **Property 8: Logging of clear operations**
  - **Validates: Requirements 4.5**

- [x] 2. Add confirmation dialog to handleNewGame function
  - Import `dialog` from Electron at top of `startMenuManager.js`
  - Add check for existing saved state using `hasSavedState()` at start of `handleNewGame()`
  - If saved state exists, display confirmation dialog with `dialog.showMessageBox()`
  - Configure dialog with warning type, appropriate title and message
  - Set "Cancel" as default button (index 0) for safety
  - Handle user response: return early if cancelled, proceed if confirmed
  - Add error handling for dialog display failures with fallback behavior
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.5_

- [ ]* 2.1 Write property test for confirmation dialog display
  - **Property 1: Confirmation dialog shown when save exists**
  - **Validates: Requirements 1.1, 3.1**

- [ ]* 2.2 Write property test for no confirmation without saves
  - **Property 4: No confirmation when no save exists**
  - **Validates: Requirements 1.5, 3.2**

- [ ]* 2.3 Write unit tests for dialog configuration
  - Test dialog called with correct title "Start New Game?"
  - Test dialog message includes data loss warning
  - Test dialog has "Cancel" and "Start New Game" buttons
  - Test default button is "Cancel" (defaultId: 0)
  - Test cancel button is mapped to Escape key (cancelId: 0)
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 3. Integrate storage clearing into new game flow
  - After user confirms dialog, call `clearStorageDirectory()` before creating demo content
  - Store clearing result in variable for logging and return value
  - Ensure demo content creation happens after storage is cleared
  - Update return value to include storage clearing details
  - Add error handling for storage clearing failures
  - _Requirements: 1.3, 5.3, 5.6_

- [ ]* 3.1 Write property test for operation ordering
  - **Property 5: Operations ordered correctly**
  - **Validates: Requirements 5.3**

- [ ]* 3.2 Write property test for storage error resilience
  - **Property 7: Error resilience in storage clearing**
  - **Validates: Requirements 5.6**

- [x] 4. Handle cancellation flow
  - When user clicks "Cancel" (response === 0), return early from function
  - Return object with success: false and cancelled: true
  - Ensure no state modifications occur on cancellation
  - Add appropriate logging for cancellation
  - _Requirements: 1.4, 5.4_

- [ ]* 4.1 Write property test for cancellation state preservation
  - **Property 2: State unchanged on cancellation**
  - **Validates: Requirements 1.4, 5.4**

- [x] 5. Add comprehensive error handling and logging
  - Wrap dialog display in try-catch block
  - Log dialog display errors and proceed with fallback
  - Log storage clearing operations with file counts
  - Log individual file deletion errors
  - Ensure all log messages follow existing patterns with [START_MENU] prefix
  - _Requirements: 4.5, 5.5, 5.6_

- [ ]* 5.1 Write property test for dialog error resilience
  - **Property 6: Error resilience in dialog display**
  - **Validates: Requirements 5.5**

- [ ]* 5.2 Write unit tests for error scenarios
  - Test dialog display error handling
  - Test file deletion error handling
  - Test missing directory handling
  - Test partial deletion success
  - _Requirements: 5.5, 5.6_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
