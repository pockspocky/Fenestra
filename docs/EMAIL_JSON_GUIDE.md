# Email JSON Format Guide

A comprehensive guide to creating email JSON files for the Fenestra email system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Required Fields](#required-fields)
3. [Optional Fields](#optional-fields)
4. [Email Actions](#email-actions)
5. [Attachments](#attachments)
6. [Complete Examples](#complete-examples)
7. [Validation Rules](#validation-rules)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Minimal Email

The simplest valid email requires only 7 fields:

```json
{
  "id": "welcome-001",
  "senderName": "System",
  "senderEmail": "system@fenestra.com",
  "subject": "Welcome!",
  "body": "Welcome to Fenestra!",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false
}
```

Save this as `inbox/welcome-001.json` and it will appear in the email window.

---

## Required Fields

### id
- **Type**: String
- **Description**: Unique identifier for the email
- **Rules**: Must be unique across all emails
- **Example**: `"welcome-001"`, `"quest-start"`, `"level-1-hint"`

```json
"id": "welcome-001"
```

### senderName
- **Type**: String
- **Description**: Display name of the sender
- **Rules**: Cannot be empty
- **Example**: `"Alice Johnson"`, `"Game Master"`, `"System Admin"`

```json
"senderName": "Alice Johnson"
```

### senderEmail
- **Type**: String
- **Description**: Email address of the sender
- **Rules**: Must be valid email format (contains @ and domain)
- **Example**: `"alice@example.com"`, `"admin@fenestra.com"`

```json
"senderEmail": "alice@example.com"
```

### subject
- **Type**: String
- **Description**: Email subject line
- **Rules**: Cannot be empty
- **Example**: `"Welcome to Fenestra"`, `"Quest: Find the Golden Key"`

```json
"subject": "Welcome to Fenestra"
```

### body
- **Type**: String
- **Description**: Main content of the email
- **Rules**: Cannot be empty, supports plain text or HTML
- **Example**: See body types below

```json
"body": "This is the email content. It can be multiple lines."
```

### timestamp
- **Type**: String
- **Description**: When the email was sent
- **Rules**: Must be ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
- **Example**: `"2025-11-13T10:30:00Z"`, `"2025-12-25T00:00:00Z"`

```json
"timestamp": "2025-11-13T10:30:00Z"
```

### isRead
- **Type**: Boolean
- **Description**: Whether the email has been read
- **Rules**: Must be `true` or `false` (not a string)
- **Example**: `false` for new emails, `true` for read emails

```json
"isRead": false
```

---

## Optional Fields

### recipientEmail
- **Type**: String
- **Description**: Email address of the recipient (player)
- **Default**: Not displayed if omitted
- **Example**: `"player@fenestra.com"`

```json
"recipientEmail": "player@fenestra.com"
```

### priority
- **Type**: String
- **Description**: Email priority level
- **Values**: `"low"`, `"normal"`, `"high"`, `"urgent"`
- **Default**: `"normal"`
- **Effect**: High/urgent emails show with visual indicator

```json
"priority": "high"
```

### bodyType
- **Type**: String
- **Description**: Format of the email body
- **Values**: `"text"` (plain text), `"html"` (HTML content)
- **Default**: `"text"`

```json
"bodyType": "text"
```

**HTML Body Example:**
```json
{
  "bodyType": "html",
  "body": "<h2>Welcome!</h2><p>This is <strong>HTML</strong> content.</p>"
}
```

### attachments
- **Type**: Array of objects
- **Description**: Files attached to the email
- **Default**: Empty array if omitted
- **See**: [Attachments section](#attachments) for details

```json
"attachments": [
  {
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "filePath": "/path/to/document.pdf"
  }
]
```

### actions
- **Type**: Array of objects
- **Description**: Interactive buttons that trigger game actions
- **Default**: Empty array if omitted
- **See**: [Email Actions section](#email-actions) for details

```json
"actions": [
  {
    "label": "Open Door",
    "type": "createDoor",
    "parameters": {
      "doorId": "secret-door",
      "width": 400,
      "height": 300
    }
  }
]
```

---

## Email Actions

Actions create interactive buttons in emails that trigger game events.

### Action Structure

```json
{
  "label": "Button Text",
  "type": "actionType",
  "parameters": {
    // Action-specific parameters
  }
}
```

### Available Action Types

#### 1. Create Window

Creates a basic window.

```json
{
  "label": "Open Window",
  "type": "createWindow",
  "parameters": {
    "windowId": "info-window",
    "width": 600,
    "height": 400,
    "title": "Information"
  }
}
```

#### 2. Create Door

Creates a door window.

```json
{
  "label": "Open Secret Door",
  "type": "createDoor",
  "parameters": {
    "doorId": "secret-door-1",
    "width": 400,
    "height": 300,
    "title": "Secret Room",
    "encrypted": false
  }
}
```

#### 3. Create Key

Creates a key window.

```json
{
  "label": "Receive Key",
  "type": "createKey",
  "parameters": {
    "keyId": "golden-key",
    "width": 200,
    "height": 200,
    "title": "Golden Key",
    "encrypted": false
  }
}
```

#### 4. Create Lens

Creates a lens window for viewing blurred content.

```json
{
  "label": "Use Magnifying Glass",
  "type": "createLens",
  "parameters": {
    "lensId": "magnifier",
    "targetId": "secret-message",
    "width": 300,
    "height": 200
  }
}
```

#### 5. Create Content

Creates a content window with text or image.

```json
{
  "label": "View Secret Message",
  "type": "createContent",
  "parameters": {
    "contentId": "secret-msg",
    "contentType": "text",
    "path": "",
    "blurAmount": 20,
    "blurred": true
  }
}
```

#### 6. Open Path

Opens a file or URL in the default application.

```json
{
  "label": "Open Website",
  "type": "openPath",
  "parameters": {
    "path": "https://example.com"
  }
}
```

#### 7. Execute Function

Executes a custom game function (deprecated - use callback instead).

```json
{
  "label": "Start Quest",
  "type": "executeFunction",
  "parameters": {
    "functionName": "startQuest",
    "args": ["quest-1", "easy"]
  }
}
```

#### 8. Callback (Recommended)

Executes a registered callback function. This is the recommended way to create custom actions.

```json
{
  "label": "Start Quest",
  "type": "callback",
  "parameters": {
    "name": "startQuest",
    "args": ["quest-1", "easy"]
  }
}
```

**Registering Callbacks:**

Before using a callback in an email, you must register it in your code:

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';

// Register a callback
registerEmailCallback('startQuest', (questId, difficulty) => {
  console.log(`Starting quest ${questId} with difficulty ${difficulty}`);
  
  // Your custom logic here
  // Create windows, update game state, etc.
  
  return {
    questStarted: true,
    questId,
    difficulty
  };
});
```

**Callback Management:**

```javascript
import { 
  registerEmailCallback,
  unregisterEmailCallback,
  getRegisteredCallbacks,
  isCallbackRegistered,
  clearAllCallbacks
} from './src/core/emailActions.js';

// Register a callback
registerEmailCallback('myCallback', (arg1, arg2) => {
  // Your logic
  return { success: true };
});

// Check if registered
if (isCallbackRegistered('myCallback')) {
  console.log('Callback is registered');
}

// Get all registered callbacks
const callbacks = getRegisteredCallbacks();
console.log('Registered callbacks:', callbacks);

// Unregister a specific callback
unregisterEmailCallback('myCallback');

// Clear all callbacks
clearAllCallbacks();
```

### Multiple Actions

An email can have multiple action buttons:

```json
"actions": [
  {
    "label": "Accept Quest",
    "type": "executeFunction",
    "parameters": {
      "functionName": "acceptQuest",
      "args": ["quest-1"]
    }
  },
  {
    "label": "Decline Quest",
    "type": "executeFunction",
    "parameters": {
      "functionName": "declineQuest",
      "args": ["quest-1"]
    }
  }
]
```

---

## Attachments

Attachments display file information in the email.

### Attachment Structure

```json
{
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "filePath": "/path/to/document.pdf"
}
```

### Fields

- **fileName**: Display name of the file
- **fileSize**: Size in bytes (will be formatted as KB/MB)
- **filePath**: Path to the file (optional, for future functionality)

### Multiple Attachments

```json
"attachments": [
  {
    "fileName": "map.png",
    "fileSize": 2048000,
    "filePath": "/images/map.png"
  },
  {
    "fileName": "instructions.txt",
    "fileSize": 5120,
    "filePath": "/docs/instructions.txt"
  },
  {
    "fileName": "key-code.pdf",
    "fileSize": 102400,
    "filePath": "/secrets/key-code.pdf"
  }
]
```

---

## Complete Examples

### Example 1: Simple Welcome Email

```json
{
  "id": "welcome-001",
  "senderName": "Fenestra System",
  "senderEmail": "system@fenestra.com",
  "subject": "Welcome to Fenestra",
  "body": "Welcome to the Fenestra puzzle game! Check your inbox regularly for hints and new challenges.",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false,
  "priority": "normal",
  "bodyType": "text"
}
```

### Example 2: Quest Email with Action

```json
{
  "id": "quest-001",
  "senderName": "Game Master",
  "senderEmail": "gamemaster@fenestra.com",
  "recipientEmail": "player@fenestra.com",
  "subject": "New Quest: The Golden Key",
  "body": "A mysterious door has appeared in the realm. Find the Golden Key to unlock its secrets. Click below to receive your key.",
  "timestamp": "2025-11-13T11:30:00Z",
  "isRead": false,
  "priority": "high",
  "bodyType": "text",
  "actions": [
    {
      "label": "Receive Golden Key",
      "type": "createKey",
      "parameters": {
        "keyId": "golden-key-1",
        "width": 200,
        "height": 200,
        "title": "Golden Key",
        "encrypted": true
      }
    }
  ]
}
```

### Example 3: Email with HTML and Attachments

```json
{
  "id": "report-001",
  "senderName": "Alice Johnson",
  "senderEmail": "alice@research.com",
  "recipientEmail": "player@fenestra.com",
  "subject": "Research Report: Ancient Artifacts",
  "body": "<h2>Research Findings</h2><p>I've discovered something <strong>incredible</strong> about the ancient artifacts.</p><p>Please review the attached documents carefully.</p><ul><li>Map of the temple</li><li>Translation notes</li><li>Security codes</li></ul>",
  "timestamp": "2025-11-13T14:45:00Z",
  "isRead": false,
  "priority": "urgent",
  "bodyType": "html",
  "attachments": [
    {
      "fileName": "temple-map.png",
      "fileSize": 3145728,
      "filePath": "/research/temple-map.png"
    },
    {
      "fileName": "translations.pdf",
      "fileSize": 524288,
      "filePath": "/research/translations.pdf"
    },
    {
      "fileName": "security-codes.txt",
      "fileSize": 2048,
      "filePath": "/research/security-codes.txt"
    }
  ]
}
```

### Example 4: Multi-Action Email

```json
{
  "id": "choice-001",
  "senderName": "The Oracle",
  "senderEmail": "oracle@fenestra.com",
  "subject": "A Choice Must Be Made",
  "body": "Two paths lie before you. The red door leads to power, the blue door leads to wisdom. Choose wisely, for you may only open one.",
  "timestamp": "2025-11-13T16:00:00Z",
  "isRead": false,
  "priority": "high",
  "bodyType": "text",
  "actions": [
    {
      "label": "Choose Red Door (Power)",
      "type": "createDoor",
      "parameters": {
        "doorId": "red-door",
        "width": 400,
        "height": 300,
        "title": "Door of Power",
        "encrypted": true
      }
    },
    {
      "label": "Choose Blue Door (Wisdom)",
      "type": "createDoor",
      "parameters": {
        "doorId": "blue-door",
        "width": 400,
        "height": 300,
        "title": "Door of Wisdom",
        "encrypted": true
      }
    }
  ]
}
```

### Example 5: Puzzle Hint Email

```json
{
  "id": "hint-level-1",
  "senderName": "Hint System",
  "senderEmail": "hints@fenestra.com",
  "subject": "Hint: Level 1 Puzzle",
  "body": "Having trouble with the first puzzle? Here's a hint: The lens reveals what is hidden. Look carefully at the blurred message.",
  "timestamp": "2025-11-13T17:30:00Z",
  "isRead": false,
  "priority": "low",
  "bodyType": "text",
  "actions": [
    {
      "label": "Create Lens",
      "type": "createLens",
      "parameters": {
        "lensId": "hint-lens",
        "targetId": "puzzle-1-content",
        "width": 300,
        "height": 200
      }
    }
  ]
}
```

### Example 6: Custom Callback Email

```json
{
  "id": "quest-start",
  "senderName": "Quest Master",
  "senderEmail": "quests@fenestra.com",
  "subject": "New Quest Available: The Ancient Artifact",
  "body": "A new quest is available! An ancient artifact has been discovered in the temple ruins. Will you accept this quest?",
  "timestamp": "2025-11-13T18:00:00Z",
  "isRead": false,
  "priority": "high",
  "bodyType": "text",
  "actions": [
    {
      "label": "Accept Quest",
      "type": "callback",
      "parameters": {
        "name": "acceptQuest",
        "args": ["ancient-artifact", "medium", { "reward": 1000, "xp": 500 }]
      }
    },
    {
      "label": "Decline Quest",
      "type": "callback",
      "parameters": {
        "name": "declineQuest",
        "args": ["ancient-artifact"]
      }
    }
  ]
}
```

**Callback Registration (in your main.js or game logic):**

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';
import { createDoor, createKey } from './src/core/windowManager.js';

// Register quest acceptance callback
registerEmailCallback('acceptQuest', (questId, difficulty, rewards) => {
  console.log(`Quest accepted: ${questId}`);
  console.log(`Difficulty: ${difficulty}`);
  console.log(`Rewards:`, rewards);
  
  // Create quest-related windows
  createDoor('quest-door', 'Quest Location', true);
  createKey('quest-key', 'Quest Key', true);
  
  // Update game state
  // gameState.activeQuests.push({ questId, difficulty, rewards });
  
  return {
    success: true,
    message: `Quest '${questId}' accepted!`,
    questId,
    difficulty,
    rewards
  };
});

// Register quest decline callback
registerEmailCallback('declineQuest', (questId) => {
  console.log(`Quest declined: ${questId}`);
  
  return {
    success: true,
    message: `Quest '${questId}' declined`,
    questId
  };
});
```

---

## Working with Callbacks

Callbacks provide a flexible way to create custom email actions without modifying the core email system.

### Why Use Callbacks?

- **Flexibility**: Create any custom action you need
- **Separation of Concerns**: Keep email logic separate from game logic
- **Type Safety**: Full control over parameters and return values
- **Reusability**: Register once, use in multiple emails
- **Security**: Only registered callbacks can be executed

### Callback Workflow

1. **Register** your callback function in your application code
2. **Create** an email JSON with a callback action
3. **User clicks** the action button in the email
4. **System executes** your registered callback with the provided arguments
5. **Callback returns** a result that can be used for feedback

### Basic Callback Example

**Step 1: Register the callback (main.js or gameLogic.js)**

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';

registerEmailCallback('unlockDoor', (doorId) => {
  console.log(`Unlocking door: ${doorId}`);
  
  // Your custom logic
  const door = getDoorById(doorId);
  if (door) {
    door.unlock();
    return { success: true, message: `Door ${doorId} unlocked!` };
  }
  
  return { success: false, message: 'Door not found' };
});
```

**Step 2: Create email with callback action**

```json
{
  "id": "unlock-email",
  "senderName": "Keeper",
  "senderEmail": "keeper@fenestra.com",
  "subject": "Door Unlock Code",
  "body": "I've sent you the unlock code for the main door.",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false,
  "actions": [
    {
      "label": "Unlock Door",
      "type": "callback",
      "parameters": {
        "name": "unlockDoor",
        "args": ["main-door"]
      }
    }
  ]
}
```

### Advanced Callback Example

**Complex game logic with multiple operations:**

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';
import { createDoor, createKey, createLensWindow } from './src/core/windowManager.js';

registerEmailCallback('startLevel', (levelId, config) => {
  console.log(`Starting level: ${levelId}`, config);
  
  try {
    // Create level windows
    const door = createDoor(`${levelId}-door`, config.doorTitle, config.encrypted);
    const key = createKey(`${levelId}-key`, config.keyTitle, config.encrypted);
    
    // Create puzzle elements
    if (config.hasPuzzle) {
      createLensWindow(
        `${levelId}-lens`,
        `${levelId}-content`,
        { width: 300, height: 200 }
      );
    }
    
    // Update game state
    gameState.currentLevel = levelId;
    gameState.levelStartTime = Date.now();
    
    // Save progress
    saveGameState();
    
    return {
      success: true,
      message: `Level ${levelId} started successfully!`,
      levelId,
      windows: {
        door: `${levelId}-door`,
        key: `${levelId}-key`,
        lens: config.hasPuzzle ? `${levelId}-lens` : null
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to start level: ${error.message}`,
      error: error.message
    };
  }
});
```

**Email using the advanced callback:**

```json
{
  "id": "level-2-start",
  "senderName": "Game Master",
  "senderEmail": "gm@fenestra.com",
  "subject": "Level 2: The Encrypted Chamber",
  "body": "You've completed Level 1! Ready for Level 2? This level includes encrypted doors and a puzzle.",
  "timestamp": "2025-11-13T12:00:00Z",
  "isRead": false,
  "priority": "high",
  "actions": [
    {
      "label": "Start Level 2",
      "type": "callback",
      "parameters": {
        "name": "startLevel",
        "args": [
          "level-2",
          {
            "doorTitle": "Encrypted Chamber",
            "keyTitle": "Chamber Key",
            "encrypted": true,
            "hasPuzzle": true
          }
        ]
      }
    }
  ]
}
```

### Callback Best Practices

1. **Descriptive Names**: Use clear, descriptive callback names
   ```javascript
   // Good
   registerEmailCallback('startBossLevel', ...);
   registerEmailCallback('unlockSecretArea', ...);
   
   // Avoid
   registerEmailCallback('cb1', ...);
   registerEmailCallback('func', ...);
   ```

2. **Error Handling**: Always handle errors in callbacks
   ```javascript
   registerEmailCallback('myCallback', (...args) => {
     try {
       // Your logic
       return { success: true, result: ... };
     } catch (error) {
       console.error('Callback error:', error);
       return { success: false, error: error.message };
     }
   });
   ```

3. **Return Consistent Structure**: Return objects with consistent properties
   ```javascript
   // Good - consistent structure
   return {
     success: true,
     message: 'Operation completed',
     data: { ... }
   };
   ```

4. **Validate Arguments**: Check arguments before using them
   ```javascript
   registerEmailCallback('processData', (data) => {
     if (!data || typeof data !== 'object') {
       return { success: false, error: 'Invalid data' };
     }
     // Process data
   });
   ```

5. **Register Early**: Register callbacks during app initialization
   ```javascript
   // In main.js or initialization code
   function initializeEmailCallbacks() {
     registerEmailCallback('callback1', ...);
     registerEmailCallback('callback2', ...);
     registerEmailCallback('callback3', ...);
   }
   
   initializeEmailCallbacks();
   ```

### Callback Lifecycle Management

```javascript
import { 
  registerEmailCallback,
  unregisterEmailCallback,
  getRegisteredCallbacks,
  clearAllCallbacks
} from './src/core/emailActions.js';

// Register callbacks for a level
function setupLevelCallbacks(levelId) {
  registerEmailCallback(`${levelId}-start`, () => { /* ... */ });
  registerEmailCallback(`${levelId}-complete`, () => { /* ... */ });
}

// Clean up callbacks when level ends
function cleanupLevelCallbacks(levelId) {
  unregisterEmailCallback(`${levelId}-start`);
  unregisterEmailCallback(`${levelId}-complete`);
}

// Debug: List all registered callbacks
function debugCallbacks() {
  const callbacks = getRegisteredCallbacks();
  console.log('Registered callbacks:', callbacks);
}

// Reset all callbacks (useful for testing)
function resetAllCallbacks() {
  clearAllCallbacks();
  // Re-register core callbacks
  initializeEmailCallbacks();
}
```

### Async Callbacks

Callbacks can be async functions:

```javascript
registerEmailCallback('loadLevel', async (levelId) => {
  console.log(`Loading level: ${levelId}`);
  
  try {
    // Async operations
    const levelData = await fetchLevelData(levelId);
    const assets = await loadLevelAssets(levelData);
    
    // Create windows
    createLevelWindows(levelData);
    
    return {
      success: true,
      message: `Level ${levelId} loaded`,
      levelData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
```

---

## Validation Rules

### Email ID
- ✅ Must be unique
- ✅ Cannot be empty
- ✅ Recommended: Use descriptive IDs like `"quest-1"` not `"email1"`

### Email Addresses
- ✅ Must contain `@` symbol
- ✅ Must have domain after `@`
- ❌ Invalid: `"user"`, `"user@"`, `"@domain.com"`
- ✅ Valid: `"user@domain.com"`

### Timestamp
- ✅ Must be ISO 8601 format
- ✅ Format: `YYYY-MM-DDTHH:mm:ssZ`
- ❌ Invalid: `"2025-11-13"`, `"11/13/2025"`, `"10:30 AM"`
- ✅ Valid: `"2025-11-13T10:30:00Z"`

### Boolean Fields
- ✅ Must be boolean, not string
- ❌ Invalid: `"isRead": "false"`, `"isRead": "true"`
- ✅ Valid: `"isRead": false`, `"isRead": true`

### Priority Values
- ✅ Valid: `"low"`, `"normal"`, `"high"`, `"urgent"`
- ❌ Invalid: `"medium"`, `"critical"`, `"1"`, `"2"`

---

## Best Practices

### 1. Use Descriptive IDs

```json
// Good
"id": "quest-golden-key"
"id": "hint-level-1"
"id": "welcome-new-player"

// Avoid
"id": "email1"
"id": "msg"
"id": "test"
```

### 2. Write Clear Subjects

```json
// Good
"subject": "Quest: Find the Golden Key"
"subject": "Hint: Level 1 Puzzle Solution"
"subject": "New Area Unlocked: Ancient Temple"

// Avoid
"subject": "Quest"
"subject": "Hint"
"subject": "New"
```

### 3. Format Timestamps Correctly

```javascript
// Generate current timestamp in JavaScript
const timestamp = new Date().toISOString();
// Result: "2025-11-13T10:30:00.000Z"
```

```bash
# Generate timestamp in bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
# Result: 2025-11-13T10:30:00Z
```

### 4. Use Priority Appropriately

- **low**: Optional hints, flavor text
- **normal**: Regular game emails, updates
- **high**: Important quests, key items
- **urgent**: Critical information, time-sensitive

### 5. Keep Body Text Readable

```json
// Good - readable plain text
"body": "Welcome to Fenestra!\n\nThis is a puzzle game where you'll solve mysteries using windows, doors, and keys.\n\nCheck your email regularly for hints and new challenges."

// Good - formatted HTML
"bodyType": "html",
"body": "<h2>Welcome!</h2><p>This is a puzzle game.</p><ul><li>Solve mysteries</li><li>Use windows and doors</li><li>Check email for hints</li></ul>"
```

### 6. Test Your JSON

Before adding to the game, validate your JSON:

```bash
# Using jq (if installed)
cat your-email.json | jq

# Or use an online JSON validator
```

---

## Troubleshooting

### Email Doesn't Appear

**Check:**
1. File is in the correct directory (`inbox/`)
2. File has `.json` extension
3. JSON is valid (no syntax errors)
4. All required fields are present
5. Email window is open

**Test:**
```bash
# Validate JSON syntax
cat inbox/your-email.json | jq
```

### Validation Errors

**Common Issues:**

1. **Missing required field**
   ```json
   // ❌ Missing senderEmail
   {
     "id": "test",
     "senderName": "Test",
     "subject": "Test"
   }
   ```

2. **Invalid email format**
   ```json
   // ❌ No @ symbol
   "senderEmail": "invalid-email"
   
   // ✅ Correct
   "senderEmail": "valid@email.com"
   ```

3. **Invalid timestamp**
   ```json
   // ❌ Wrong format
   "timestamp": "2025-11-13"
   
   // ✅ Correct
   "timestamp": "2025-11-13T10:00:00Z"
   ```

4. **Boolean as string**
   ```json
   // ❌ String instead of boolean
   "isRead": "false"
   
   // ✅ Correct
   "isRead": false
   ```

### Actions Not Working

**Check:**
1. Action type is spelled correctly
2. All required parameters are provided
3. Parameter values are valid
4. Check console for error messages

**Example:**
```json
// ❌ Wrong type name
"type": "makeDoor"

// ✅ Correct
"type": "createDoor"
```

### File Not Detected

**Solutions:**
1. Wait 2 seconds after creating file
2. Ensure file is in `inbox/` directory
3. Check file permissions (must be readable)
4. Restart application if watcher isn't running

---

## Quick Reference

### Minimal Template

```json
{
  "id": "unique-id",
  "senderName": "Sender Name",
  "senderEmail": "sender@example.com",
  "subject": "Email Subject",
  "body": "Email body text",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false
}
```

### Full Template

```json
{
  "id": "unique-id",
  "senderName": "Sender Name",
  "senderEmail": "sender@example.com",
  "recipientEmail": "player@fenestra.com",
  "subject": "Email Subject",
  "body": "Email body text",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false,
  "priority": "normal",
  "bodyType": "text",
  "attachments": [
    {
      "fileName": "file.pdf",
      "fileSize": 1024000,
      "filePath": "/path/to/file.pdf"
    }
  ],
  "actions": [
    {
      "label": "Button Text",
      "type": "createWindow",
      "parameters": {
        "windowId": "window-id",
        "width": 600,
        "height": 400
      }
    },
    {
      "label": "Custom Action",
      "type": "callback",
      "parameters": {
        "name": "myCallback",
        "args": ["arg1", "arg2"]
      }
    }
  ]
}
```

### Callback Registration Template

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';

// Register your callback
registerEmailCallback('myCallback', (arg1, arg2) => {
  console.log('Callback executed:', arg1, arg2);
  
  // Your custom logic here
  
  return {
    success: true,
    message: 'Callback executed successfully',
    data: { arg1, arg2 }
  };
});
```

---

## Additional Resources

- [Email System Documentation](EMAIL_SYSTEM.md) - Complete email system overview
- [Configuration Guide](CONFIGURATION_GUIDE.md) - System configuration
- Sample emails in `game-data/test-inbox/` directory

---

**Happy email crafting! 📧**

If you encounter issues or have questions, check the console logs for detailed error messages.
