# Requirements Document

## Introduction

This feature adds a confirmation dialog to the "New Game" button in the start menu to prevent accidental data loss. When a user clicks "New Game" and a saved game exists, they will be prompted to confirm their action before the saved game data is deleted. This provides a safety mechanism to protect users from accidentally losing their progress.

## Glossary

- **Start Menu**: The initial window displayed when the application launches, containing "New Game" and "Continue Game" buttons
- **Saved Game State**: Persistent game data stored in the `.fenestra-storage` directory, including window positions, door-key relationships, and game progress
- **Storage Directory**: The `.fenestra-storage` directory within the game data directory that contains all persistent game data including save files and backup files
- **Confirmation Dialog**: A modal dialog that requires explicit user confirmation before proceeding with a destructive action
- **Demo Content**: Default game content created when starting a new game, consisting of initial doors, keys, and windows

## Requirements

### Requirement 1

**User Story:** As a player, I want to be warned before starting a new game when I have existing saved progress, so that I don't accidentally lose my game data.

#### Acceptance Criteria

1. WHEN a user clicks the "New Game" button AND a saved game state exists THEN the system SHALL display a confirmation dialog before proceeding
2. WHEN the confirmation dialog is displayed THEN the system SHALL include a clear message indicating that existing progress will be lost
3. WHEN a user confirms the new game action THEN the system SHALL delete all contents of the `.fenestra-storage` directory and create demo content
4. WHEN a user cancels the new game action THEN the system SHALL close the dialog and return to the start menu without any changes
5. WHEN a user clicks the "New Game" button AND no saved game state exists THEN the system SHALL proceed directly to create demo content without showing a confirmation dialog

### Requirement 2

**User Story:** As a player, I want the confirmation dialog to be clear and easy to understand, so that I can make an informed decision about starting a new game.

#### Acceptance Criteria

1. WHEN the confirmation dialog is displayed THEN the system SHALL show the title "Start New Game?"
2. WHEN the confirmation dialog is displayed THEN the system SHALL show a message stating "This will delete your current saved game. Are you sure you want to start a new game?"
3. WHEN the confirmation dialog is displayed THEN the system SHALL provide two buttons: "Start New Game" and "Cancel"
4. WHEN the confirmation dialog is displayed THEN the system SHALL use the native Electron dialog API for consistent platform appearance
5. WHEN the user presses the Escape key while the dialog is open THEN the system SHALL treat it as a cancel action

### Requirement 3

**User Story:** As a player, I want the keyboard shortcut for "New Game" to also show the confirmation dialog, so that I have the same protection regardless of how I trigger the action.

#### Acceptance Criteria

1. WHEN a user presses the "N" key AND a saved game state exists THEN the system SHALL display the confirmation dialog
2. WHEN a user presses the "N" key AND no saved game state exists THEN the system SHALL proceed directly to create demo content
3. WHEN the confirmation dialog is displayed via keyboard shortcut THEN the system SHALL behave identically to when triggered by button click

### Requirement 4

**User Story:** As a player, I want all saved data to be completely cleared when starting a new game, so that I have a fresh start without any remnants of previous games.

#### Acceptance Criteria

1. WHEN a user confirms starting a new game THEN the system SHALL delete all files within the `.fenestra-storage` directory
2. WHEN clearing the storage directory THEN the system SHALL remove the `game-state.json` file if it exists
3. WHEN clearing the storage directory THEN the system SHALL remove the `game-state.backup.json` file if it exists
4. WHEN clearing the storage directory THEN the system SHALL remove any other files that may exist in the directory
5. WHEN the storage directory is cleared THEN the system SHALL log the operation with details of files removed

### Requirement 5

**User Story:** As a developer, I want the confirmation logic to be centralized in the start menu manager, so that the implementation is maintainable and consistent.

#### Acceptance Criteria

1. WHEN implementing the confirmation dialog THEN the system SHALL add the logic to the `handleNewGame` function in `startMenuManager.js`
2. WHEN the confirmation dialog is shown THEN the system SHALL use the Electron `dialog.showMessageBox` API
3. WHEN the user confirms the action THEN the system SHALL call a new function to clear the storage directory before creating demo content
4. WHEN the user cancels the action THEN the system SHALL return early from the function without modifying any state
5. WHEN an error occurs during confirmation dialog display THEN the system SHALL log the error and proceed with the new game action as a fallback
6. WHEN an error occurs during storage directory clearing THEN the system SHALL log the error and continue with creating demo content
