/**
 * Door-Key Service
 * 
 * Manages door-key relationships, access control, and game logic for the
 * Fenestra puzzle system. Integrates with StateManager for persistent
 * relationships and maintains all current door-key functionality.
 */

export class DoorKeyService {
  constructor(dependencies = {}) {
    this.stateManager = dependencies.stateManager;
    this.gameWindowService = dependencies.gameWindowService;
    this.actionCallbacks = dependencies.actionCallbacks;
    this.logger = dependencies.logger || console;
    
    // Relationship tracking
    this.doorKeyRelations = new Map(); // doorId -> Set of keyIds
    this.keyDoorRelations = new Map(); // keyId -> Set of doorIds
    
    // Door states
    this.doorStates = new Map(); // doorId -> door state object
    
    // Key configurations
    this.oneTimeKeys = new Set(); // keyId - one-time use keys
    this.usedKeys = new Set(); // keyId - already used keys
    this.closeAfterUse = new Set(); // keyId - keys that close after use
    
    // Multi-key doors
    this.multiKeyDoors = new Map(); // doorId -> { requiredKeys: Array, timeoutDuration: number }
    
    // Encrypted items
    this.encryptedItems = new Set(); // encrypted item IDs
    
    // Message system
    this.globalMessages = new Map(); // messageType -> template
    this.doorMessages = new Map(); // doorId -> Map(messageType -> template)
    this.keyMessages = new Map(); // keyId -> Map(messageType -> template)
    
    this._initializeService();
  }

  /**
   * Initialize the service and register callbacks
   * @private
   */
  _initializeService() {
    if (this.actionCallbacks) {
      this.actionCallbacks.register('door.open', this._onDoorOpen.bind(this));
      this.actionCallbacks.register('door.close', this._onDoorClose.bind(this));
      this.actionCallbacks.register('key.use', this._onKeyUse.bind(this));
    }

    this.logger.info('DoorKeyService initialized', {
      service: 'DoorKeyService'
    });
  }

  /**
   * Establish a relationship between a door and key
   * @param {string} doorId - Door identifier
   * @param {string} keyId - Key identifier
   * @returns {Promise<void>}
   */
  async establishRelation(doorId, keyId) {
    // Update in-memory relationships
    if (!this.doorKeyRelations.has(doorId)) {
      this.doorKeyRelations.set(doorId, new Set());
    }
    this.doorKeyRelations.get(doorId).add(keyId);
    
    if (!this.keyDoorRelations.has(keyId)) {
      this.keyDoorRelations.set(keyId, new Set());
    }
    this.keyDoorRelations.get(keyId).add(doorId);

    // Persist to state manager
    if (this.stateManager) {
      await this.stateManager.set(`relationships.doors.${doorId}`, 
        Array.from(this.doorKeyRelations.get(doorId)));
      await this.stateManager.set(`relationships.keys.${keyId}`, 
        Array.from(this.keyDoorRelations.get(keyId)));
    }

    this.logger.info('Door-key relationship established', {
      doorId,
      keyId,
      operation: 'establishRelation'
    });
  }

  /**
   * Remove a relationship between a door and key
   * @param {string} doorId - Door identifier
   * @param {string} keyId - Key identifier
   * @returns {Promise<void>}
   */
  async removeRelation(doorId, keyId) {
    // Update in-memory relationships
    if (this.doorKeyRelations.has(doorId)) {
      this.doorKeyRelations.get(doorId).delete(keyId);
      if (this.doorKeyRelations.get(doorId).size === 0) {
        this.doorKeyRelations.delete(doorId);
      }
    }
    
    if (this.keyDoorRelations.has(keyId)) {
      this.keyDoorRelations.get(keyId).delete(doorId);
      if (this.keyDoorRelations.get(keyId).size === 0) {
        this.keyDoorRelations.delete(keyId);
      }
    }

    // Persist to state manager
    if (this.stateManager) {
      const doorKeys = this.doorKeyRelations.get(doorId);
      await this.stateManager.set(`relationships.doors.${doorId}`, 
        doorKeys ? Array.from(doorKeys) : null);
      
      const keyDoors = this.keyDoorRelations.get(keyId);
      await this.stateManager.set(`relationships.keys.${keyId}`, 
        keyDoors ? Array.from(keyDoors) : null);
    }

    this.logger.info('Door-key relationship removed', {
      doorId,
      keyId,
      operation: 'removeRelation'
    });
  }

  /**
   * Initialize door state
   * @param {string} doorId - Door identifier
   * @param {Object} options - Door state options
   * @returns {Promise<void>}
   */
  async initializeDoorState(doorId, options = {}) {
    const doorState = {
      isOpen: options.initialState === 'open',
      lastKeyUsed: null,
      state: options.initialState || 'closed',
      isLocked: options.isLocked !== false,
      isEncrypted: options.isEncrypted || false,
      closedImagePath: options.closedImagePath || null,
      openedImagePath: options.openedImagePath || null,
      createdAt: Date.now(),
      lastStateChange: Date.now(),
      ...options
    };

    this.doorStates.set(doorId, doorState);

    // Persist to state manager
    if (this.stateManager) {
      await this.stateManager.set(`doors.${doorId}.state`, doorState);
    }

    this.logger.info('Door state initialized', {
      doorId,
      state: doorState,
      operation: 'initializeDoorState'
    });
  }

  /**
   * Initialize key configuration
   * @param {string} keyId - Key identifier
   * @param {Object} options - Key configuration options
   * @returns {Promise<void>}
   */
  async initializeKeyConfiguration(keyId, options = {}) {
    if (options.isOneTime) {
      this.oneTimeKeys.add(keyId);
    }
    
    if (options.closeAfterUse) {
      this.closeAfterUse.add(keyId);
    }

    // Persist to state manager
    if (this.stateManager) {
      await this.stateManager.set(`keys.${keyId}.config`, {
        isOneTime: options.isOneTime || false,
        closeAfterUse: options.closeAfterUse || false,
        ...options
      });
    }

    this.logger.info('Key configuration initialized', {
      keyId,
      options,
      operation: 'initializeKeyConfiguration'
    });
  }

  /**
   * Attempt to use a key on a door
   * @param {string} keyId - Key identifier
   * @param {string} doorId - Door identifier
   * @returns {Promise<Object>} Result of the key usage attempt
   */
  async useKey(keyId, doorId) {
    const result = {
      success: false,
      action: null,
      message: null,
      doorState: null
    };

    try {
      // Check if key has already been used (for one-time keys)
      if (this.oneTimeKeys.has(keyId) && this.usedKeys.has(keyId)) {
        result.message = this._getMessage('key-already-used', keyId, doorId);
        this.logger.warn('Key already used', { keyId, doorId });
        return result;
      }

      // Check if key can open this door
      if (!this._canKeyOpenDoor(keyId, doorId)) {
        result.message = this._getMessage('access-denied', keyId, doorId);
        this.logger.warn('Access denied', { keyId, doorId });
        return result;
      }

      // Get current door state
      const doorState = this.doorStates.get(doorId);
      if (!doorState) {
        result.message = 'Door not found';
        this.logger.error('Door state not found', { doorId });
        return result;
      }

      // Determine action based on current state
      if (doorState.isOpen) {
        // Close the door
        await this._closeDoor(doorId, keyId);
        result.action = 'close';
        result.message = this._getMessage('door-closed', keyId, doorId);
      } else {
        // Open the door
        await this._openDoor(doorId, keyId);
        result.action = 'open';
        result.message = this._getMessage('door-opened', keyId, doorId);
      }

      // Mark key as used if it's a one-time key
      if (this.oneTimeKeys.has(keyId)) {
        this.usedKeys.add(keyId);
        if (this.stateManager) {
          await this.stateManager.set(`keys.${keyId}.used`, true);
        }
      }

      // Close key window if configured to do so
      if (this.closeAfterUse.has(keyId) && this.gameWindowService) {
        await this.gameWindowService.destroyWindow(keyId);
      }

      result.success = true;
      result.doorState = this.doorStates.get(doorId);

      this.logger.info('Key used successfully', {
        keyId,
        doorId,
        action: result.action,
        operation: 'useKey'
      });

    } catch (error) {
      result.message = 'An error occurred while using the key';
      this.logger.error('Error using key', {
        keyId,
        doorId,
        error: error.message,
        operation: 'useKey'
      });
    }

    return result;
  }

  /**
   * Check if a key can open a specific door
   * @param {string} keyId - Key identifier
   * @param {string} doorId - Door identifier
   * @returns {boolean} Whether the key can open the door
   */
  canKeyOpenDoor(keyId, doorId) {
    return this._canKeyOpenDoor(keyId, doorId);
  }

  /**
   * Get door state
   * @param {string} doorId - Door identifier
   * @returns {Object|null} Door state or null if not found
   */
  getDoorState(doorId) {
    return this.doorStates.get(doorId) || null;
  }

  /**
   * Get all doors that a key can open
   * @param {string} keyId - Key identifier
   * @returns {Array} Array of door IDs
   */
  getDoorsForKey(keyId) {
    const doors = this.keyDoorRelations.get(keyId);
    return doors ? Array.from(doors) : [];
  }

  /**
   * Get all keys that can open a door
   * @param {string} doorId - Door identifier
   * @returns {Array} Array of key IDs
   */
  getKeysForDoor(doorId) {
    const keys = this.doorKeyRelations.get(doorId);
    return keys ? Array.from(keys) : [];
  }

  /**
   * Add an encrypted item
   * @param {string} itemId - Item identifier
   * @returns {Promise<void>}
   */
  async addEncryptedItem(itemId) {
    this.encryptedItems.add(itemId);
    
    if (this.stateManager) {
      await this.stateManager.set(`encrypted.items`, Array.from(this.encryptedItems));
    }

    this.logger.info('Encrypted item added', { itemId });
  }

  /**
   * Check if an item is encrypted
   * @param {string} itemId - Item identifier
   * @returns {boolean} Whether the item is encrypted
   */
  isItemEncrypted(itemId) {
    return this.encryptedItems.has(itemId);
  }

  /**
   * Set a custom message for a specific context
   * @param {string} messageType - Type of message
   * @param {string} template - Message template
   * @param {string} entityId - Optional entity ID (door or key)
   * @returns {Promise<void>}
   */
  async setMessage(messageType, template, entityId = null) {
    if (entityId) {
      // Entity-specific message
      if (entityId.startsWith('door')) {
        if (!this.doorMessages.has(entityId)) {
          this.doorMessages.set(entityId, new Map());
        }
        this.doorMessages.get(entityId).set(messageType, template);
      } else if (entityId.startsWith('key')) {
        if (!this.keyMessages.has(entityId)) {
          this.keyMessages.set(entityId, new Map());
        }
        this.keyMessages.get(entityId).set(messageType, template);
      }
    } else {
      // Global message
      this.globalMessages.set(messageType, template);
    }

    if (this.stateManager) {
      await this.stateManager.set(`messages.${messageType}.${entityId || 'global'}`, template);
    }

    this.logger.info('Message set', { messageType, entityId, template });
  }

  /**
   * Internal method to check if key can open door
   * @param {string} keyId - Key identifier
   * @param {string} doorId - Door identifier
   * @returns {boolean} Whether the key can open the door
   * @private
   */
  _canKeyOpenDoor(keyId, doorId) {
    const doorKeys = this.doorKeyRelations.get(doorId);
    return doorKeys ? doorKeys.has(keyId) : false;
  }

  /**
   * Internal method to open a door
   * @param {string} doorId - Door identifier
   * @param {string} keyId - Key identifier used
   * @returns {Promise<void>}
   * @private
   */
  async _openDoor(doorId, keyId) {
    const doorState = this.doorStates.get(doorId);
    if (doorState) {
      doorState.isOpen = true;
      doorState.state = 'open';
      doorState.lastKeyUsed = keyId;
      doorState.lastStateChange = Date.now();

      if (this.stateManager) {
        await this.stateManager.set(`doors.${doorId}.state`, doorState);
      }
    }
  }

  /**
   * Internal method to close a door
   * @param {string} doorId - Door identifier
   * @param {string} keyId - Key identifier used
   * @returns {Promise<void>}
   * @private
   */
  async _closeDoor(doorId, keyId) {
    const doorState = this.doorStates.get(doorId);
    if (doorState) {
      doorState.isOpen = false;
      doorState.state = 'closed';
      doorState.lastKeyUsed = keyId;
      doorState.lastStateChange = Date.now();

      if (this.stateManager) {
        await this.stateManager.set(`doors.${doorId}.state`, doorState);
      }
    }
  }

  /**
   * Get a message for a specific context
   * @param {string} messageType - Type of message
   * @param {string} keyId - Key identifier
   * @param {string} doorId - Door identifier
   * @returns {string} Message text
   * @private
   */
  _getMessage(messageType, keyId, doorId) {
    // Check for door-specific message
    if (this.doorMessages.has(doorId)) {
      const doorMsgs = this.doorMessages.get(doorId);
      if (doorMsgs.has(messageType)) {
        return doorMsgs.get(messageType);
      }
    }

    // Check for key-specific message
    if (this.keyMessages.has(keyId)) {
      const keyMsgs = this.keyMessages.get(keyId);
      if (keyMsgs.has(messageType)) {
        return keyMsgs.get(messageType);
      }
    }

    // Check for global message
    if (this.globalMessages.has(messageType)) {
      return this.globalMessages.get(messageType);
    }

    // Default messages
    const defaultMessages = {
      'door-opened': 'Door opened successfully',
      'door-closed': 'Door closed successfully',
      'access-denied': 'Access denied - key does not match this door',
      'key-already-used': 'This key has already been used'
    };

    return defaultMessages[messageType] || 'Action completed';
  }

  /**
   * Action callback for door open events
   * @param {Object} context - Action context
   * @private
   */
  _onDoorOpen(context) {
    this.logger.debug('Door open action callback', {
      action: context.action,
      doorId: context.data.doorId,
      phase: context.phase
    });
  }

  /**
   * Action callback for door close events
   * @param {Object} context - Action context
   * @private
   */
  _onDoorClose(context) {
    this.logger.debug('Door close action callback', {
      action: context.action,
      doorId: context.data.doorId,
      phase: context.phase
    });
  }

  /**
   * Action callback for key use events
   * @param {Object} context - Action context
   * @private
   */
  _onKeyUse(context) {
    this.logger.debug('Key use action callback', {
      action: context.action,
      keyId: context.data.keyId,
      doorId: context.data.doorId,
      phase: context.phase
    });
  }
}