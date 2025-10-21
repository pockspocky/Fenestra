# Requirements Document

## Introduction

This feature adds window storage and reopening capabilities to the in-game terminal system. Users will be able to save all necessary information to recreate any window into a serialized format (string/file), and later restore windows by dragging the saved file onto the terminal and pressing return. This enhances the user experience by allowing them to preserve and restore complex window configurations.

## Requirements

### Requirement 1

**User Story:** As a user, I want to save the current state of any window to a file, so that I can recreate it later with all its properties intact.

#### Acceptance Criteria

1. WHEN I execute a save command in the terminal THEN the system SHALL capture all window properties including position, size, title, content type, content path, and window-specific settings
2. WHEN the window data is captured THEN the system SHALL serialize it into a JSON format that contains all necessary recreation information
3. WHEN the serialization is complete THEN the system SHALL save the data to a file with a .fenestra extension in a designated storage directory
4. IF the window has special properties (like lens systems, picture settings, or content blur) THEN the system SHALL include these in the serialized data
5. WHEN the save operation completes THEN the system SHALL display a success message with the file path

### Requirement 2

**User Story:** As a user, I want to drag a saved window file onto the terminal, so that I can easily select which window configuration to restore.

#### Acceptance Criteria

1. WHEN I drag a .fenestra file onto the terminal area THEN the system SHALL detect the drag operation and highlight the terminal
2. WHEN the file is dropped on the terminal THEN the system SHALL read the file path and display it in the command input
3. WHEN a .fenestra file is dropped THEN the system SHALL validate that the file contains valid window data
4. IF the file is invalid or corrupted THEN the system SHALL display an error message and clear the input
5. WHEN a valid file is dropped THEN the system SHALL populate the command input with a restore command including the file path

### Requirement 3

**User Story:** As a user, I want to press return after dropping a window file, so that the window is recreated with all its original properties.

#### Acceptance Criteria

1. WHEN I press return with a restore command THEN the system SHALL parse the .fenestra file and extract window configuration data
2. WHEN the file is parsed successfully THEN the system SHALL validate that all required window properties are present
3. WHEN validation passes THEN the system SHALL recreate the window using the stored configuration including position, size, title, and content
4. IF the window ID already exists THEN the system SHALL either update the existing window or create a new window with a modified ID
5. WHEN the window is recreated THEN the system SHALL apply all special properties like transparency, always-on-top, lens systems, or content settings
6. WHEN restoration is complete THEN the system SHALL display a success message confirming the window has been restored

### Requirement 4

**User Story:** As a user, I want the system to handle different window types correctly, so that pictures, content windows, lens systems, and regular windows are all restored properly.

#### Acceptance Criteria

1. WHEN restoring a picture window THEN the system SHALL recreate it with the correct image path and fit mode settings
2. WHEN restoring a content window THEN the system SHALL recreate it with the correct content type, blur settings, and surface/hidden content
3. WHEN restoring a lens window THEN the system SHALL recreate both the lens and ensure proper targeting to the specified window
4. WHEN restoring a terminal window THEN the system SHALL recreate it with the correct dimensions and properties
5. IF the original content files are missing THEN the system SHALL display a warning but still create the window structure

### Requirement 5

**User Story:** As a developer, I want the storage format to be extensible and human-readable, so that it can be easily debugged and enhanced in the future.

#### Acceptance Criteria

1. WHEN window data is serialized THEN the system SHALL use JSON format with clear property names and structure
2. WHEN the JSON is created THEN the system SHALL include metadata like creation timestamp, version, and window type
3. WHEN storing file paths THEN the system SHALL use relative paths when possible to maintain portability
4. WHEN the format needs to be updated THEN the system SHALL include version information to support backward compatibility
5. WHEN debugging is needed THEN the JSON SHALL be formatted with proper indentation for human readability