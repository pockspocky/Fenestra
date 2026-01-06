/**
 * State Manager Implementation
 * 
 * Centralized, observable state management with path-based access,
 * transactions, and rollback capability. Integrates with action callback system.
 */

import { randomUUID } from 'crypto';

export class StateManager {
  constructor(options = {}) {
    this.state = {};
    this.subscribers = new Map(); // path -> Set of subscribers
    this.transactions = new Map(); // transaction ID -> transaction data
    this.actionCallbackSystem = options.actionCallbackSystem || null;
    this.persistenceAdapter = options.persistenceAdapter || null;
    this.maxTransactionHistory = options.maxTransactionHistory || 100;
    this.transactionHistory = [];
  }

  /**
   * Get state value at path
   * @param {string} path - Dot-notation path (e.g., "user.profile.name")
   * @param {any} defaultValue - Default value if path doesn't exist
   * @returns {any} State value
   */
  get(path, defaultValue = undefined) {
    return this._getValueAtPath(this.state, path, defaultValue);
  }

  /**
   * Set state value at path
   * @param {string} path - Dot-notation path
   * @param {any} value - Value to set
   * @param {Object} options - Set options
   * @returns {Promise<void>}
   */
  async set(path, value, options = {}) {
    const oldValue = this.get(path);
    
    if (options.transactionId) {
      // Part of a transaction
      this._setInTransaction(options.transactionId, path, value, oldValue);
    } else {
      // Direct set
      await this._performSet(path, value, oldValue, options);
    }
  }

  /**
   * Update state using a function
   * @param {string} path - Dot-notation path
   * @param {Function} updater - Function that receives current value and returns new value
   * @param {Object} options - Update options
   * @returns {Promise<void>}
   */
  async update(path, updater, options = {}) {
    const currentValue = this.get(path);
    const newValue = updater(currentValue);
    await this.set(path, newValue, options);
  }

  /**
   * Delete state at path
   * @param {string} path - Dot-notation path
   * @param {Object} options - Delete options
   * @returns {Promise<void>}
   */
  async delete(path, options = {}) {
    const oldValue = this.get(path);
    
    if (options.transactionId) {
      this._deleteInTransaction(options.transactionId, path, oldValue);
    } else {
      await this._performDelete(path, oldValue, options);
    }
  }

  /**
   * Subscribe to state changes at path
   * @param {string} path - Dot-notation path (supports wildcards)
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   * @returns {string} Subscription ID
   */
  subscribe(path, callback, options = {}) {
    const subscription = {
      id: randomUUID(),
      path,
      callback,
      immediate: options.immediate || false,
      metadata: options.metadata || {}
    };

    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    
    this.subscribers.get(path).add(subscription);

    // Call immediately with current value if requested
    if (subscription.immediate) {
      const currentValue = this.get(path);
      try {
        callback({
          path,
          newValue: currentValue,
          oldValue: undefined,
          timestamp: Date.now(),
          source: 'subscription'
        });
      } catch (error) {
        console.error('[StateManager] Immediate subscription callback error:', error);
      }
    }

    return subscription.id;
  }

  /**
   * Unsubscribe from state changes
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} Whether subscription was found and removed
   */
  unsubscribe(subscriptionId) {
    for (const [path, subscriptions] of this.subscribers) {
      for (const subscription of subscriptions) {
        if (subscription.id === subscriptionId) {
          subscriptions.delete(subscription);
          if (subscriptions.size === 0) {
            this.subscribers.delete(path);
          }
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Start a transaction
   * @param {Object} options - Transaction options
   * @returns {string} Transaction ID
   */
  beginTransaction(options = {}) {
    const transactionId = randomUUID();
    
    this.transactions.set(transactionId, {
      id: transactionId,
      operations: [],
      startTime: Date.now(),
      metadata: options.metadata || {},
      committed: false,
      rolledBack: false
    });

    return transactionId;
  }

  /**
   * Commit a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<void>}
   */
  async commitTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.committed || transaction.rolledBack) {
      throw new Error(`Transaction ${transactionId} already ${transaction.committed ? 'committed' : 'rolled back'}`);
    }

    try {
      // Apply all operations
      for (const operation of transaction.operations) {
        if (operation.type === 'set') {
          await this._performSet(operation.path, operation.newValue, operation.oldValue, { 
            source: 'transaction',
            transactionId 
          });
        } else if (operation.type === 'delete') {
          await this._performDelete(operation.path, operation.oldValue, { 
            source: 'transaction',
            transactionId 
          });
        }
      }

      transaction.committed = true;
      transaction.commitTime = Date.now();
      
      // Add to history
      this._addToHistory(transaction);
      
      // Trigger action callback
      if (this.actionCallbackSystem) {
        await this.actionCallbackSystem.trigger('state-transaction-committed', 'after', {
          source: 'StateManager',
          data: {
            transactionId,
            operationCount: transaction.operations.length,
            duration: transaction.commitTime - transaction.startTime
          }
        });
      }

    } catch (error) {
      // Auto-rollback on commit failure
      await this.rollbackTransaction(transactionId);
      throw error;
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Rollback a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<void>}
   */
  async rollbackTransaction(transactionId) {
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.committed) {
      throw new Error(`Cannot rollback committed transaction ${transactionId}`);
    }

    transaction.rolledBack = true;
    transaction.rollbackTime = Date.now();
    
    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-transaction-rolled-back', 'after', {
        source: 'StateManager',
        data: {
          transactionId,
          operationCount: transaction.operations.length,
          duration: transaction.rollbackTime - transaction.startTime
        }
      });
    }

    this.transactions.delete(transactionId);
  }

  /**
   * Get current state snapshot
   * @returns {Object} Deep copy of current state
   */
  getSnapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Load state from snapshot
   * @param {Object} snapshot - State snapshot
   * @param {Object} options - Load options
   * @returns {Promise<void>}
   */
  async loadSnapshot(snapshot, options = {}) {
    const oldState = this.getSnapshot();
    
    this.state = JSON.parse(JSON.stringify(snapshot));
    
    // Notify all subscribers of the change
    await this._notifyAllSubscribers(oldState, this.state, {
      source: 'snapshot-load',
      ...options
    });

    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-snapshot-loaded', 'after', {
        source: 'StateManager',
        data: { snapshot, options }
      });
    }
  }

  /**
   * Persist state using configured adapter
   * @param {Object} options - Persistence options
   * @returns {Promise<void>}
   */
  async persist(options = {}) {
    if (!this.persistenceAdapter) {
      throw new Error('No persistence adapter configured');
    }

    const snapshot = this.getSnapshot();
    await this.persistenceAdapter.save(snapshot, options);

    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-persisted', 'after', {
        source: 'StateManager',
        data: { options }
      });
    }
  }

  /**
   * Load state from persistence adapter
   * @param {Object} options - Load options
   * @returns {Promise<void>}
   */
  async load(options = {}) {
    if (!this.persistenceAdapter) {
      throw new Error('No persistence adapter configured');
    }

    const snapshot = await this.persistenceAdapter.load(options);
    await this.loadSnapshot(snapshot, { source: 'persistence-load', ...options });
  }

  /**
   * Clear all state
   * @param {Object} options - Clear options
   * @returns {Promise<void>}
   */
  async clear(options = {}) {
    const oldState = this.getSnapshot();
    this.state = {};
    
    await this._notifyAllSubscribers(oldState, {}, {
      source: 'clear',
      ...options
    });

    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-cleared', 'after', {
        source: 'StateManager',
        data: { options }
      });
    }
  }

  /**
   * Get state manager statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const subscriptionCounts = {};
    for (const [path, subscriptions] of this.subscribers) {
      subscriptionCounts[path] = subscriptions.size;
    }

    return {
      totalSubscriptions: Array.from(this.subscribers.values()).reduce((sum, subs) => sum + subs.size, 0),
      subscriptionPaths: Array.from(this.subscribers.keys()),
      subscriptionCounts,
      activeTransactions: this.transactions.size,
      transactionHistory: this.transactionHistory.length,
      hasPersistenceAdapter: !!this.persistenceAdapter
    };
  }

  /**
   * Set action callback system reference
   * @param {ActionCallbackSystem} actionCallbackSystem - Action callback system instance
   */
  setActionCallbackSystem(actionCallbackSystem) {
    this.actionCallbackSystem = actionCallbackSystem;
  }

  /**
   * Set persistence adapter
   * @param {Object} persistenceAdapter - Persistence adapter instance
   */
  setPersistenceAdapter(persistenceAdapter) {
    this.persistenceAdapter = persistenceAdapter;
  }

  /**
   * Get value at path using dot notation
   * @private
   */
  _getValueAtPath(obj, path, defaultValue) {
    if (!path) return obj;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Set value at path using dot notation
   * @private
   */
  _setValueAtPath(obj, path, value) {
    if (!path) return;
    
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Delete value at path
   * @private
   */
  _deleteValueAtPath(obj, path) {
    if (!path) return;
    
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        return; // Path doesn't exist
      }
      current = current[key];
    }
    
    delete current[keys[keys.length - 1]];
  }

  /**
   * Perform actual set operation
   * @private
   */
  async _performSet(path, value, oldValue, options = {}) {
    this._setValueAtPath(this.state, path, value);
    
    await this._notifySubscribers(path, value, oldValue, {
      source: 'set',
      ...options
    });

    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-changed', 'after', {
        source: 'StateManager',
        data: { path, newValue: value, oldValue, operation: 'set' }
      });
    }
  }

  /**
   * Perform actual delete operation
   * @private
   */
  async _performDelete(path, oldValue, options = {}) {
    this._deleteValueAtPath(this.state, path);
    
    await this._notifySubscribers(path, undefined, oldValue, {
      source: 'delete',
      ...options
    });

    // Trigger action callback
    if (this.actionCallbackSystem) {
      await this.actionCallbackSystem.trigger('state-changed', 'after', {
        source: 'StateManager',
        data: { path, newValue: undefined, oldValue, operation: 'delete' }
      });
    }
  }

  /**
   * Add operation to transaction
   * @private
   */
  _setInTransaction(transactionId, path, value, oldValue) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.operations.push({
      type: 'set',
      path,
      newValue: value,
      oldValue,
      timestamp: Date.now()
    });
  }

  /**
   * Add delete operation to transaction
   * @private
   */
  _deleteInTransaction(transactionId, path, oldValue) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    transaction.operations.push({
      type: 'delete',
      path,
      oldValue,
      timestamp: Date.now()
    });
  }

  /**
   * Notify subscribers of state changes
   * @private
   */
  async _notifySubscribers(path, newValue, oldValue, context) {
    const change = {
      path,
      newValue,
      oldValue,
      timestamp: Date.now(),
      source: context.source || 'unknown'
    };

    // Find matching subscribers (exact match and parent paths)
    const matchingSubscribers = [];
    
    for (const [subscriberPath, subscriptions] of this.subscribers) {
      if (this._pathMatches(path, subscriberPath)) {
        matchingSubscribers.push(...subscriptions);
      }
    }

    // Notify all matching subscribers
    for (const subscription of matchingSubscribers) {
      try {
        await subscription.callback(change);
      } catch (error) {
        console.error(`[StateManager] Subscriber callback error for ${subscription.id}:`, error);
      }
    }
  }

  /**
   * Notify all subscribers (used for snapshot loading)
   * @private
   */
  async _notifyAllSubscribers(oldState, newState, context) {
    for (const [path, subscriptions] of this.subscribers) {
      const oldValue = this._getValueAtPath(oldState, path);
      const newValue = this._getValueAtPath(newState, path);
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        await this._notifySubscribers(path, newValue, oldValue, context);
      }
    }
  }

  /**
   * Check if a path matches a subscription path (supports wildcards)
   * @private
   */
  _pathMatches(changePath, subscriptionPath) {
    // Exact match
    if (changePath === subscriptionPath) {
      return true;
    }

    // Wildcard support
    if (subscriptionPath.includes('*')) {
      const pattern = subscriptionPath.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(changePath);
    }

    // Parent path subscription (e.g., subscribing to "user" gets "user.name" changes)
    if (changePath.startsWith(subscriptionPath + '.')) {
      return true;
    }

    return false;
  }

  /**
   * Add transaction to history
   * @private
   */
  _addToHistory(transaction) {
    this.transactionHistory.push({
      id: transaction.id,
      operationCount: transaction.operations.length,
      startTime: transaction.startTime,
      commitTime: transaction.commitTime,
      duration: transaction.commitTime - transaction.startTime,
      metadata: transaction.metadata
    });

    // Trim history if it exceeds max size
    if (this.transactionHistory.length > this.maxTransactionHistory) {
      this.transactionHistory.shift();
    }
  }
}