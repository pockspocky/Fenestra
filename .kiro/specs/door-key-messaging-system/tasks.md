# Implementation Plan

- [x] 1. Set up message configuration system
  - Add new data structures for global, door, and key message templates to doorKeySystem.js
  - Implement message template parsing and variable substitution functions
  - Create exported functions for setting and clearing custom messages
  - _Requirements: 1.2, 2.2, 3.2, 5.1, 5.2, 5.3, 5.4_

- [x] 2. Implement customizable dialog messages
- [x] 2.1 Update handleDoorToggle function for custom open/close messages
  - Modify existing dialog.showMessageBox calls to use custom message templates
  - Implement message template variable substitution for doorId and keyId
  - Maintain backward compatibility with existing hardcoded messages as defaults
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5_

- [x] 2.2 Update handleFailedOpen function for custom access denied messages
  - Replace hardcoded Chinese error message with configurable English template
  - Implement message template variable substitution including denial reason
  - Maintain existing dialog.showMessageBox error type and window reference pattern
  - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [x] 3. Implement one-time use key system
- [x] 3.1 Add one-time key data structures and configuration functions
  - Add oneTimeKeys, usedKeys, and closeAfterUse Sets to doorKeySystem.js
  - Implement setKeyOneTimeUse, isKeyUsable, resetKeyUsage, and setKeyCloseAfterUse functions
  - Add validation and error handling using existing console logging patterns
  - _Requirements: 6.1, 6.4_

- [x] 3.2 Update canOpenDoor function to check key usage status
  - Add usedKeys Set check before existing permission validation
  - Maintain existing return value behavior for workerManager.js compatibility
  - _Requirements: 6.3, 4.2, 4.3_

- [x] 3.3 Update handleDoorToggle function for key consumption and closing
  - Add key to usedKeys Set when oneTimeKeys contains the keyId
  - Implement key window closing using existing getWindow pattern when closeAfterUse is true
  - Add custom message display for key consumption and closing events
  - _Requirements: 6.2, 6.5_

- [x] 4. Implement multi-key door system
- [x] 4.1 Extend doorStates Map with multi-key progress tracking
  - Add requiredKeys, usedKeys, timeoutId, and timeoutDuration fields to existing doorStates structure
  - Implement setMultiKeyDoor, getMultiKeyProgress, and resetMultiKeyProgress functions
  - Add timeout management using existing setTimeout patterns
  - _Requirements: 7.1, 7.5, 8.5_

- [x] 4.2 Update canOpenDoor function for multi-key door validation
  - Add multi-key door progress checking and next required key validation
  - Maintain existing boolean return value for compatibility with workerManager.js
  - _Requirements: 7.1, 4.2, 4.3_

- [x] 4.3 Update handleDoorToggle function for multi-key progress management
  - Implement progress tracking, timeout management, and sequence completion detection
  - Add custom message display for progress updates and completion
  - Maintain existing door title update mechanism with progress indicators
  - _Requirements: 7.2, 7.3, 8.1, 8.3_

- [x] 4.4 Update handleFailedOpen function for multi-key sequence reset
  - Add progress reset logic for incorrect key usage in multi-key doors
  - Display sequence reset messages using existing dialog.showMessageBox pattern
  - _Requirements: 7.4, 8.4_

- [ ] 5. Extend window creation functions with custom HTML support
- [ ] 5.1 Update createDoor function to accept otherContents parameter
  - Add optional otherContents parameter while maintaining existing function signature
  - Implement backward compatibility with existing pictureViewer.html default
  - Pass doorId through query parameters using existing createWindow mechanism
  - _Requirements: 9.1, 9.3, 9.4_

- [ ] 5.2 Update createKey function to accept otherContents parameter
  - Add optional otherContents parameter while maintaining existing function signature
  - Implement backward compatibility with existing index.html default
  - Pass keyId through query parameters using existing createWindow mechanism
  - _Requirements: 9.2, 9.3, 9.4_

- [ ] 6. Add comprehensive validation and error handling
  - Implement message template validation using existing console logging patterns
  - Add multi-key door configuration validation with clear error messages
  - Implement one-time key validation and edge case handling
  - _Requirements: 5.5_

- [ ]* 7. Write unit tests for new functionality
  - Create tests for message template parsing and variable substitution
  - Write tests for multi-key door progress tracking logic
  - Add tests for one-time key usage state management
  - Test backward compatibility with existing function signatures
  - _Requirements: All requirements validation_

- [ ]* 8. Integration testing and demo compatibility verification
- [ ]* 8.1 Test existing demo functionality remains unchanged
  - Verify workerManager.js integration continues working without modifications
  - Test all existing function calls produce same results as before
  - Validate existing door states and transitions work identically
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 8.2 Test new functionality integration with existing systems
  - Verify custom messages display correctly through existing dialog system
  - Test multi-key door interactions with existing overlap detection
  - Validate one-time key behavior with existing key bounce animations
  - Test custom HTML loading with existing window management
  - _Requirements: 9.5_