# Requirements Document

## Introduction

This specification defines enhancements to the existing door key system to provide customizable messaging for different door-key interaction states. The current system uses hardcoded messages for door opening, closing, and access denial scenarios. This enhancement will allow developers to configure custom messages for various interaction states while maintaining backward compatibility with the existing demo functionality.

## Glossary

- **Door_Key_System**: The existing system that manages door-key relationships, permissions, and interactions
- **Message_Configuration**: A system for defining custom messages for different door-key interaction states
- **Interaction_State**: The current state of a door-key interaction (opening, closing, access denied, etc.)
- **Demo_Compatibility**: Ensuring the current demo functionality continues to work after enhancements
- **Message_Template**: A configurable text template that can include dynamic values like door ID, key ID, etc.
- **One_Time_Key**: A key that becomes unusable after a single successful door unlock operation
- **Multi_Key_Door**: A door that requires multiple different specified keys to be used in sequence before it can be opened
- **Key_Usage_State**: The current usage status of a key (available, used, disabled)
- **Door_Unlock_Progress**: The current unlock progress for multi-key doors (keys used count, remaining keys needed, fully unlocked)
- **Custom_HTML_Content**: The ability to load different HTML files or content into door and key windows for custom visual presentation

## Requirements

### Requirement 1

**User Story:** As a developer using the door key system, I want to customize messages when doors are successfully opened, so that I can provide context-appropriate feedback to users.

#### Acceptance Criteria

1. WHEN a door is successfully opened, THE Door_Key_System SHALL display a configurable message instead of the hardcoded "Door opened!" text using the existing dialog.showMessageBox mechanism
2. WHERE custom open messages are configured, THE Door_Key_System SHALL use the custom message template with dynamic values passed to the existing handleDoorToggle function
3. IF no custom open message is configured, THEN THE Door_Key_System SHALL use the current default "Door opened!" message to maintain backward compatibility
4. THE Door_Key_System SHALL support message templates that include doorId and keyId variables using the existing function parameters
5. THE Door_Key_System SHALL maintain the existing dialog.showMessageBox call structure and window reference pattern from getWindow(doorId)

### Requirement 2

**User Story:** As a developer using the door key system, I want to customize messages when doors are closed, so that I can provide appropriate feedback for door closing actions.

#### Acceptance Criteria

1. WHEN a door is successfully closed, THE Door_Key_System SHALL display a configurable message instead of the hardcoded "Door closed!" text using the existing dialog.showMessageBox mechanism in handleDoorToggle
2. WHERE custom close messages are configured, THE Door_Key_System SHALL use the custom message template with doorId and keyId parameters already available in handleDoorToggle
3. IF no custom close message is configured, THEN THE Door_Key_System SHALL use the current default "Door closed!" message to maintain backward compatibility
4. THE Door_Key_System SHALL support message templates using the existing doorId and keyId parameters passed to handleDoorToggle function
5. THE Door_Key_System SHALL maintain the existing dialog.showMessageBox call structure and doorWin window reference pattern

### Requirement 3

**User Story:** As a developer using the door key system, I want to customize messages when door access is denied, so that I can provide specific error feedback based on the context.

#### Acceptance Criteria

1. WHEN door access is denied due to insufficient permissions, THE Door_Key_System SHALL display a configurable error message instead of the hardcoded Chinese text using the existing dialog.showMessageBox mechanism in handleFailedOpen
2. WHERE custom access denied messages are configured, THE Door_Key_System SHALL use the custom message template with doorId and keyId parameters already available in handleFailedOpen
3. IF no custom access denied message is configured, THEN THE Door_Key_System SHALL use an English default message while maintaining the existing error dialog structure
4. THE Door_Key_System SHALL support message templates using the existing doorId and keyId parameters and canOpenDoor return value for denial reason
5. THE Door_Key_System SHALL maintain the existing dialog.showMessageBox error type and doorWin window reference from getWindow(doorId)

### Requirement 4

**User Story:** As a developer maintaining the existing demo, I want the current demo functionality to continue working unchanged, so that existing implementations remain functional.

#### Acceptance Criteria

1. WHEN no custom message configuration is provided, THE Door_Key_System SHALL use current hardcoded messages to maintain existing workerManager.js behavior
2. THE Door_Key_System SHALL preserve all existing function signatures: canOpenDoor(doorId, keyId), handleFailedOpen(doorId, keyId), handleDoorToggle(doorId, keyId)
3. THE Door_Key_System SHALL maintain compatibility with existing workerManager.js calls and return values from canOpenDoor function
4. THE Door_Key_System SHALL continue to support existing doorStates Map, encryptedItems Set, and doorKeyRelations Map data structures
5. THE Door_Key_System SHALL preserve the existing bounceKeyAway animation function and door title update mechanisms

### Requirement 5

**User Story:** As a developer configuring the door key system, I want a simple API to set custom messages, so that I can easily integrate custom messaging into my application.

#### Acceptance Criteria

1. THE Door_Key_System SHALL provide new configuration functions that extend the existing doorKeySystem.js module exports
2. THE Door_Key_System SHALL support per-door message customization using existing doorId parameters as keys in new message configuration Maps
3. THE Door_Key_System SHALL support global message templates stored in new module-level variables similar to existing doorStates and encryptedItems patterns
4. WHERE both global and per-door messages are configured, THE Door_Key_System SHALL prioritize per-door messages using the same lookup pattern as existing doorKeyRelations.get(doorId)
5. THE Door_Key_System SHALL validate message templates using existing console.warn and console.error logging patterns from the current module

### Requirement 6

**User Story:** As a game developer, I want keys to have the option to be one-time use, so that I can create puzzle mechanics where keys are consumed after use.

#### Acceptance Criteria

1. THE Door_Key_System SHALL support configuring keys as one-time use using a new Set similar to existing encryptedItems Set pattern
2. WHEN a one-time use key successfully unlocks a door, THE Door_Key_System SHALL mark the key as used in handleDoorToggle function using the existing keyId parameter
3. WHEN a used one-time key is attempted to be used again, THE Door_Key_System SHALL check the used keys Set in canOpenDoor function and return false to trigger existing handleFailedOpen behavior
4. THE Door_Key_System SHALL provide a new exported function to check key usability following the existing module export pattern
5. THE Door_Key_System SHALL maintain backward compatibility by defaulting keys to reusable unless explicitly added to the one-time use Set

### Requirement 7

**User Story:** As a game developer, I want doors to require multiple different specified keys in sequence, so that I can create complex unlock puzzles requiring two or more keys.

#### Acceptance Criteria

1. THE Door_Key_System SHALL support configuring doors to require multiple keys using a new Map similar to existing doorKeyRelations Map pattern
2. WHEN a required key is used on a multi-key door, THE Door_Key_System SHALL record progress in handleDoorToggle using existing doorStates Map structure with additional progress fields
3. WHEN all required keys have been used in correct sequence, THE Door_Key_System SHALL unlock the door using existing door title update mechanism and dialog.showMessageBox
4. IF an incorrect key is used at any stage, THEN THE Door_Key_System SHALL reset progress in existing doorStates Map and trigger existing handleFailedOpen behavior
5. THE Door_Key_System SHALL provide configurable timeout using existing setTimeout pattern and doorStates Map for tracking timeout state

### Requirement 8

**User Story:** As a developer using multi-key doors, I want clear feedback about unlock progress, so that users understand what keys are needed and the current state.

#### Acceptance Criteria

1. WHEN a required key is used on a multi-key door, THE Door_Key_System SHALL display progress messages using existing dialog.showMessageBox mechanism with doorWin reference from getWindow(doorId)
2. THE Door_Key_System SHALL support custom messages for each key sequence step using the same message template system as other requirements
3. THE Door_Key_System SHALL visually indicate multi-key door state using existing doorWin.setTitle mechanism with progress indicators in title text
4. WHERE a multi-key door times out, THE Door_Key_System SHALL display timeout message using existing dialog.showMessageBox and reset progress in doorStates Map
5. THE Door_Key_System SHALL provide new exported status functions following existing getDoorState and getRelationsDebugInfo function patterns

### Requirement 9

**User Story:** As a developer creating doors and keys, I want to load different HTML content into door and key windows using the existing otherContents pattern, so that I can customize their visual appearance consistently with the current system.

#### Acceptance Criteria

1. THE Door_Key_System SHALL extend the createDoor function to accept an optional otherContents parameter while maintaining the current default of "pictureViewer.html?imagePath=doors/Door.png&fitMode=fill"
2. THE Door_Key_System SHALL extend the createKey function to accept an optional otherContents parameter while maintaining the current default of index.html
3. THE Door_Key_System SHALL maintain full backward compatibility with existing createDoor(doorId, title, encrypt) and createKey(keyId, title, encrypt, relatedDoors) function signatures
4. THE Door_Key_System SHALL pass door and key IDs through query parameters to the loaded HTML content using the existing createWindow mechanism
5. THE Door_Key_System SHALL support the same otherContents string format as createDoor currently uses: "filename.html?param=value&param2=value2"