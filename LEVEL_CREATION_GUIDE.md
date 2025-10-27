# Fenestra Level Creation Guide

A comprehensive guide to creating levels, demos, and game scenarios in the Fenestra door-key system.

## Table of Contents

1. [Quick Start - Simple Demo](#quick-start---simple-demo)
2. [Core Concepts](#core-concepts)
3. [Basic Level Creation](#basic-level-creation)
4. [Advanced Features](#advanced-features)
5. [One-Time Use Keys](#one-time-use-keys)
6. [Multi-Key Doors](#multi-key-doors)
7. [Custom Messages](#custom-messages)
8. [Complete Level Examples](#complete-level-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start - Simple Demo

### Minimal 2-Window Demo

```javascript
import { createDoor, createKey } from './windowManager.js';
import { initializeDoorRelation, initializeKeyRelation, establishRelation } from './doorKeySystem.js';

function createSimpleDemo() {
  // 1. Create a door
  createDoor('demo_door', 'Demo Door (locked)', false);
  
  // 2. Create a key
  createKey('demo_key', 'Demo Key', false);
  
  // 3. Initialize relationships
  initializeDoorRelation('demo_door');
  initializeKeyRelation('demo_key');
  
  // 4. Connect them
  establishRelation('demo_door', 'demo_key');
  
  console.log('Simple demo created: drag key to door to open!');
}
```

### Run the Demo
```javascript
// Add to your game logic or main.js
createSimpleDemo();
```

---

## Core Concepts

### Windows Types
- **Doors**: Target windows that can be opened/closed
- **Keys**: Interactive windows that unlock doors
- **Lens Windows**: Special overlay windows for revealing content

### Relationship System
- **Door-Key Relations**: Which keys can open which doors
- **Encryption**: Doors/keys can be encrypted (require specific authorization)
- **States**: Doors track open/closed state and last key used

### Key Features
- **One-Time Use**: Keys that are consumed after use
- **Multi-Key Doors**: Doors requiring multiple keys in sequence
- **Custom Messages**: Personalized feedback for interactions
- **Auto-Close**: Windows that close automatically after use

---

## Basic Level Creation

### Step 1: Plan Your Level

Before coding, define:
- How many doors and keys?
- Which keys open which doors?
- Are any items encrypted?
- Do you want one-time use keys?
- What's the player's objective?

### Step 2: Create Windows

```javascript
function createBasicLevel() {
  // Create doors
  createDoor('entrance', 'Entrance Door (locked)', false);
  createDoor('treasure_room', 'Treasure Room (encrypted)', true);
  
  // Create keys
  createKey('entrance_key', 'Entrance Key', false);
  createKey('treasure_key', 'Golden Key (encrypted)', true);
  
  console.log('Basic level windows created');
}
```

### Step 3: Initialize Relationships

```javascript
function setupBasicRelationships() {
  // Initialize door relationships
  initializeDoorRelation('entrance');
  initializeDoorRelation('treasure_room');
  
  // Initialize key relationships
  initializeKeyRelation('entrance_key');
  initializeKeyRelation('treasure_key');
  
  // Set up encryption
  addEncryptedItem('treasure_room');
  addEncryptedItem('treasure_key');
  
  console.log('Relationships initialized');
}
```

### Step 4: Connect Keys to Doors

```javascript
function connectKeysAndDoors() {
  // Any key can open the entrance (not encrypted)
  establishRelation('entrance', 'entrance_key');
  establishRelation('entrance', 'treasure_key');
  
  // Only treasure key can open treasure room (both encrypted)
  establishRelation('treasure_room', 'treasure_key');
  
  console.log('Keys and doors connected');
}
```

### Step 5: Complete Basic Level

```javascript
function createBasicLevel() {
  // Create windows
  createDoor('entrance', 'Entrance Door (locked)', false);
  createDoor('treasure_room', 'Treasure Room (encrypted)', true);
  createKey('entrance_key', 'Entrance Key', false);
  createKey('treasure_key', 'Golden Key (encrypted)', true);
  
  // Initialize relationships
  initializeDoorRelation('entrance');
  initializeDoorRelation('treasure_room');
  initializeKeyRelation('entrance_key');
  initializeKeyRelation('treasure_key');
  
  // Set encryption
  addEncryptedItem('treasure_room');
  addEncryptedItem('treasure_key');
  
  // Connect keys to doors
  establishRelation('entrance', 'entrance_key');
  establishRelation('entrance', 'treasure_key');
  establishRelation('treasure_room', 'treasure_key');
  
  console.log('Basic level created successfully!');
}
```

---

## Advanced Features

### Encryption System

Encryption creates access control - only encrypted keys can open encrypted doors.

```javascript
// Make items encrypted
addEncryptedItem('secure_door');
addEncryptedItem('master_key');

// Now only master_key can open secure_door (if they're connected)
establishRelation('secure_door', 'master_key');
```

### Window Positioning

```javascript
// Create door at specific position
const doorWin = createDoor('positioned_door', 'Positioned Door', false);
doorWin.setBounds({ x: 100, y: 100, width: 200, height: 200 });

// Create key at specific position  
const keyWin = createKey('positioned_key', 'Positioned Key', false);
keyWin.setBounds({ x: 400, y: 100, width: 200, height: 200 });
```

---

## One-Time Use Keys

One-time keys are consumed after successful use and cannot be used again.

### Basic One-Time Key

```javascript
function createOneTimeKeyDemo() {
  // Create door and key
  createDoor('vault', 'Bank Vault (locked)', false);
  createKey('vault_key', 'Vault Key (One-Time)', false);
  
  // Set up relationships
  initializeDoorRelation('vault');
  initializeKeyRelation('vault_key');
  establishRelation('vault', 'vault_key');
  
  // Make key one-time use
  setKeyOneTimeUse('vault_key', true);
  
  console.log('One-time key demo created');
}
```

### One-Time Key with Auto-Close

```javascript
function createDisappearingKey() {
  createDoor('secret_door', 'Secret Door (locked)', false);
  createKey('disappearing_key', 'Disappearing Key', false);
  
  initializeDoorRelation('secret_door');
  initializeKeyRelation('disappearing_key');
  establishRelation('secret_door', 'disappearing_key');
  
  // Key will be consumed AND window will close after use
  setKeyOneTimeUse('disappearing_key', true, true);
  
  console.log('Disappearing key created - use it wisely!');
}
```

### Managing One-Time Keys

```javascript
// Check if key is still usable
if (isKeyUsable('vault_key')) {
  console.log('Key is available for use');
} else {
  console.log('Key has been consumed');
}

// Reset a used key (make it usable again)
resetKeyUsage('vault_key');

// Set auto-close behavior separately
setKeyCloseAfterUse('vault_key', true);
```

---

## Multi-Key Doors

Multi-key doors require multiple keys used in a specific sequence within a time limit.

### Basic Multi-Key Door

```javascript
function createMultiKeyDemo() {
  // Create the multi-key door
  createDoor('combination_safe', 'Combination Safe (locked)', true);
  
  // Create the required keys
  createKey('key_red', 'Red Key', true);
  createKey('key_blue', 'Blue Key', true);
  createKey('key_green', 'Green Key', true);
  
  // Initialize relationships
  initializeDoorRelation('combination_safe');
  initializeKeyRelation('key_red');
  initializeKeyRelation('key_blue');
  initializeKeyRelation('key_green');
  
  // Set up encryption
  addEncryptedItem('combination_safe');
  addEncryptedItem('key_red');
  addEncryptedItem('key_blue');
  addEncryptedItem('key_green');
  
  // Configure as multi-key door (sequence: red -> blue -> green, 30 second timeout)
  setMultiKeyDoor('combination_safe', ['key_red', 'key_blue', 'key_green'], 30000);
  
  console.log('Multi-key safe created: use red, then blue, then green within 30 seconds');
}
```

### Multi-Key with One-Time Keys

```javascript
function createChallengeLevel() {
  createDoor('final_door', 'Final Challenge Door', true);
  
  // Create one-time keys for the sequence
  createKey('alpha_key', 'Alpha Key (One-Time)', true);
  createKey('beta_key', 'Beta Key (One-Time)', true);
  createKey('gamma_key', 'Gamma Key (One-Time)', true);
  
  // Initialize
  initializeDoorRelation('final_door');
  initializeKeyRelation('alpha_key');
  initializeKeyRelation('beta_key');
  initializeKeyRelation('gamma_key');
  
  // Set encryption
  addEncryptedItem('final_door');
  addEncryptedItem('alpha_key');
  addEncryptedItem('beta_key');
  addEncryptedItem('gamma_key');
  
  // Configure multi-key sequence
  setMultiKeyDoor('final_door', ['alpha_key', 'beta_key', 'gamma_key'], 45000);
  
  // Make all keys one-time use with auto-close
  setKeyOneTimeUse('alpha_key', true, true);
  setKeyOneTimeUse('beta_key', true, true);
  setKeyOneTimeUse('gamma_key', true, true);
  
  console.log('Challenge level: one chance to get the sequence right!');
}
```

### Multi-Key Progress Tracking

```javascript
// Check progress on a multi-key door
const progress = getMultiKeyProgress('combination_safe');
if (progress) {
  console.log(`Progress: ${progress.progress}/${progress.total}`);
  console.log(`Next key needed: ${progress.nextKey}`);
  console.log(`Is complete: ${progress.isComplete}`);
}

// Reset progress manually
resetMultiKeyProgress('combination_safe');
```

---

## Custom Messages

Personalize the player experience with custom messages for different interactions.

### Global Messages

```javascript
// Set messages that apply to all doors/keys
setGlobalMessage('door_opened', 'Success! The {doorId} swings open with a satisfying click.');
setGlobalMessage('access_denied', 'The {keyId} doesn\'t fit. You need the right key for {doorId}.');
setGlobalMessage('key_used', 'The {keyId} crumbles to dust after use. It was a one-time key.');
```

### Door-Specific Messages

```javascript
// Messages specific to one door
setDoorMessage('treasure_room', 'door_opened', 'The treasure room door opens, revealing glittering gold inside!');
setDoorMessage('vault', 'access_denied', 'The vault\'s security system rejects your key. Access denied.');
```

### Key-Specific Messages

```javascript
// Messages specific to one key
setKeyMessage('master_key', 'key_used', 'The Master Key has served its purpose and dissolves into light.');
setKeyMessage('skeleton_key', 'door_opened', 'Your skeleton key works perfectly on {doorId}!');
```

### Multi-Key Messages

```javascript
// Messages for multi-key sequences
setGlobalMessage('progress_update', 'Key {keyId} accepted! Next: {nextKey} ({progress}/{total})');
setGlobalMessage('sequence_complete', 'Perfect! All {total} keys used correctly. {doorId} unlocked!');
setGlobalMessage('sequence_reset', 'Wrong key! The sequence has been reset. Start over.');
setGlobalMessage('timeout', 'Too slow! The sequence timed out and has been reset.');
```

### Message Variables

Available variables in message templates:
- `{doorId}` - The door's ID
- `{keyId}` - The key's ID  
- `{progress}` - Current progress in multi-key sequence
- `{total}` - Total keys needed in sequence
- `{nextKey}` - Next key needed in sequence
- `{reason}` - Reason for access denial

---

## Complete Level Examples

### Example 1: Escape Room

```javascript
function createEscapeRoom() {
  console.log('Creating Escape Room level...');
  
  // Create the room doors
  createDoor('exit_door', 'Exit Door (locked)', true);
  createDoor('supply_closet', 'Supply Closet (locked)', false);
  createDoor('office', 'Office Door (locked)', true);
  
  // Create keys and items
  createKey('closet_key', 'Janitor Key', false);
  createKey('office_key', 'Office Key (encrypted)', true);
  createKey('master_key', 'Master Key (One-Time)', true);
  
  // Initialize all relationships
  initializeDoorRelation('exit_door');
  initializeDoorRelation('supply_closet');
  initializeDoorRelation('office');
  initializeKeyRelation('closet_key');
  initializeKeyRelation('office_key');
  initializeKeyRelation('master_key');
  
  // Set up encryption
  addEncryptedItem('exit_door');
  addEncryptedItem('office');
  addEncryptedItem('office_key');
  addEncryptedItem('master_key');
  
  // Connect keys to doors
  establishRelation('supply_closet', 'closet_key'); // Any key works on supply closet
  establishRelation('office', 'office_key');
  establishRelation('exit_door', 'master_key');
  
  // Make master key one-time use
  setKeyOneTimeUse('master_key', true);
  
  // Custom messages
  setDoorMessage('exit_door', 'door_opened', 'Freedom! The exit door opens and you escape!');
  setKeyMessage('master_key', 'key_used', 'The master key breaks apart - it was designed for one use only.');
  
  console.log('Escape Room created: Find the master key to escape!');
}
```

### Example 2: Puzzle Sequence

```javascript
function createPuzzleSequence() {
  console.log('Creating Puzzle Sequence level...');
  
  // Create puzzle doors
  createDoor('puzzle_1', 'First Puzzle Door (locked)', true);
  createDoor('puzzle_2', 'Second Puzzle Door (locked)', true);
  createDoor('final_chamber', 'Final Chamber (locked)', true);
  
  // Create sequence keys
  createKey('red_crystal', 'Red Crystal Key', true);
  createKey('blue_crystal', 'Blue Crystal Key', true);
  createKey('gold_crystal', 'Gold Crystal Key', true);
  
  // Initialize relationships
  ['puzzle_1', 'puzzle_2', 'final_chamber'].forEach(doorId => {
    initializeDoorRelation(doorId);
    addEncryptedItem(doorId);
  });
  
  ['red_crystal', 'blue_crystal', 'gold_crystal'].forEach(keyId => {
    initializeKeyRelation(keyId);
    addEncryptedItem(keyId);
  });
  
  // Set up multi-key final chamber
  setMultiKeyDoor('final_chamber', ['red_crystal', 'blue_crystal', 'gold_crystal'], 60000);
  
  // Individual puzzle doors
  establishRelation('puzzle_1', 'red_crystal');
  establishRelation('puzzle_2', 'blue_crystal');
  
  // All crystals are one-time use
  setKeyOneTimeUse('red_crystal', true);
  setKeyOneTimeUse('blue_crystal', true);
  setKeyOneTimeUse('gold_crystal', true);
  
  // Custom puzzle messages
  setGlobalMessage('sequence_complete', 'The ancient mechanism activates! All crystals resonate in harmony!');
  setDoorMessage('final_chamber', 'door_opened', 'The Final Chamber opens, revealing the ancient treasure within!');
  
  console.log('Puzzle Sequence created: Solve puzzles to collect crystals, then use all three!');
}
```

### Example 3: Timed Challenge

```javascript
function createTimedChallenge() {
  console.log('Creating Timed Challenge level...');
  
  // Create challenge door
  createDoor('time_vault', 'Time-Locked Vault (locked)', true);
  
  // Create disappearing keys
  createKey('temp_key_1', 'Temporary Key Alpha', true);
  createKey('temp_key_2', 'Temporary Key Beta', true);
  createKey('temp_key_3', 'Temporary Key Gamma', true);
  
  // Initialize
  initializeDoorRelation('time_vault');
  addEncryptedItem('time_vault');
  
  ['temp_key_1', 'temp_key_2', 'temp_key_3'].forEach(keyId => {
    initializeKeyRelation(keyId);
    addEncryptedItem(keyId);
  });
  
  // Set up fast multi-key sequence (15 seconds!)
  setMultiKeyDoor('time_vault', ['temp_key_1', 'temp_key_2', 'temp_key_3'], 15000);
  
  // All keys disappear after use
  setKeyOneTimeUse('temp_key_1', true, true);
  setKeyOneTimeUse('temp_key_2', true, true);
  setKeyOneTimeUse('temp_key_3', true, true);
  
  // Urgent messages
  setGlobalMessage('timeout', 'TIME\'S UP! The vault seals itself. Challenge failed.');
  setGlobalMessage('progress_update', 'HURRY! Key {keyId} used. Need {nextKey} next! ({progress}/{total})');
  
  console.log('Timed Challenge created: 15 seconds to use all three keys in order!');
}
```

---

## Best Practices

### 1. Plan Before Coding
- Sketch your level layout
- Define the key-door relationships
- Decide on difficulty and mechanics
- Plan the player's journey

### 2. Use Descriptive IDs
```javascript
// Good
createDoor('library_entrance', 'Library Entrance', false);
createKey('librarian_key', 'Librarian\'s Key', false);

// Avoid
createDoor('d1', 'Door', false);
createKey('k1', 'Key', false);
```

### 3. Initialize in Order
```javascript
// 1. Create windows
// 2. Initialize relationships  
// 3. Set encryption
// 4. Connect keys to doors
// 5. Configure special features (one-time, multi-key)
// 6. Set custom messages
```

### 4. Test Your Level
```javascript
// Add debug functions
function debugLevel() {
  console.log('=== Level Debug Info ===');
  console.log(getRelationsDebugInfo());
  
  // Test key usability
  ['key1', 'key2'].forEach(keyId => {
    console.log(`${keyId} usable:`, isKeyUsable(keyId));
  });
}
```

### 5. Provide Clear Feedback
- Use custom messages to guide players
- Make objectives clear in door/key titles
- Indicate special properties (one-time, encrypted, etc.)

### 6. Balance Difficulty
- Start simple, add complexity gradually
- Give players time to understand mechanics
- Provide hints through naming and messages

---

## Troubleshooting

### Common Issues

**Keys won't open doors:**
```javascript
// Check if both are encrypted or both are not
console.log('Door encrypted:', encryptedItems.has('door_id'));
console.log('Key encrypted:', encryptedItems.has('key_id'));

// Check if relationship exists
console.log('Relations:', getRelationsDebugInfo());
```

**One-time key not working:**
```javascript
// Check if key is still usable
console.log('Key usable:', isKeyUsable('key_id'));

// Reset if needed
resetKeyUsage('key_id');
```

**Multi-key door issues:**
```javascript
// Check progress
const progress = getMultiKeyProgress('door_id');
console.log('Multi-key progress:', progress);

// Reset if stuck
resetMultiKeyProgress('door_id');
```

### Debug Functions

```javascript
function debugAllSystems() {
  console.log('=== FENESTRA DEBUG ===');
  
  // Window status
  console.log('Windows:', getAllWindows().size);
  
  // Relations
  console.log('Relations:', getRelationsDebugInfo());
  
  // Key usability
  ['key1', 'key2', 'key3'].forEach(keyId => {
    if (getAllWindows().has(keyId)) {
      console.log(`${keyId}:`, isKeyUsable(keyId) ? 'USABLE' : 'CONSUMED');
    }
  });
  
  // Multi-key progress
  ['door1', 'door2'].forEach(doorId => {
    const progress = getMultiKeyProgress(doorId);
    if (progress) {
      console.log(`${doorId} progress:`, `${progress.progress}/${progress.total}`);
    }
  });
}
```

---

## Advanced Tips

### Dynamic Level Creation
```javascript
function createDynamicLevel(config) {
  const { doors, keys, relationships, oneTimeKeys, multiKeyDoors } = config;
  
  // Create doors
  doors.forEach(door => {
    createDoor(door.id, door.title, door.encrypted);
    initializeDoorRelation(door.id);
    if (door.encrypted) addEncryptedItem(door.id);
  });
  
  // Create keys
  keys.forEach(key => {
    createKey(key.id, key.title, key.encrypted);
    initializeKeyRelation(key.id);
    if (key.encrypted) addEncryptedItem(key.id);
    if (oneTimeKeys.includes(key.id)) {
      setKeyOneTimeUse(key.id, true, key.autoClose);
    }
  });
  
  // Establish relationships
  relationships.forEach(rel => {
    establishRelation(rel.door, rel.key);
  });
  
  // Set up multi-key doors
  multiKeyDoors.forEach(mkd => {
    setMultiKeyDoor(mkd.doorId, mkd.sequence, mkd.timeout);
  });
}

// Usage
const levelConfig = {
  doors: [
    { id: 'vault', title: 'Bank Vault', encrypted: true }
  ],
  keys: [
    { id: 'vault_key', title: 'Vault Key', encrypted: true, autoClose: true }
  ],
  relationships: [
    { door: 'vault', key: 'vault_key' }
  ],
  oneTimeKeys: ['vault_key'],
  multiKeyDoors: []
};

createDynamicLevel(levelConfig);
```

### Level State Management
```javascript
class LevelManager {
  constructor() {
    this.currentLevel = null;
    this.levelState = {};
  }
  
  startLevel(levelName, levelFunction) {
    this.currentLevel = levelName;
    this.levelState[levelName] = { started: Date.now(), completed: false };
    levelFunction();
    console.log(`Level '${levelName}' started`);
  }
  
  completeLevel(levelName) {
    if (this.levelState[levelName]) {
      this.levelState[levelName].completed = true;
      this.levelState[levelName].completedAt = Date.now();
      console.log(`Level '${levelName}' completed!`);
    }
  }
  
  resetLevel(levelName) {
    // Reset all key usage for the level
    // Clear multi-key progress
    // Recreate windows if needed
  }
}
```

---

This guide covers everything you need to create engaging levels in Fenestra. Start with simple demos and gradually add complexity as you become comfortable with the system. The one-time key system adds strategic depth, while multi-key doors create exciting puzzle sequences.

Happy level building!