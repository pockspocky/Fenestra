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

---

This guide covers everything you need to create engaging levels in Fenestra. Start with simple demos and gradually add complexity as you become comfortable with the system.

Happy level building!
