/**
 * Puzzle Service
 * 
 * Manages puzzle logic, progression, and state for the Fenestra game.
 * Integrates with foundation layer components to provide comprehensive
 * puzzle management and maintains all current game functionality.
 */

export class PuzzleService {
  constructor(dependencies = {}) {
    this.stateManager = dependencies.stateManager;
    this.gameWindowService = dependencies.gameWindowService;
    this.doorKeyService = dependencies.doorKeyService;
    this.emailService = dependencies.emailService;
    this.lensService = dependencies.lensService;
    this.actionCallbacks = dependencies.actionCallbacks;
    this.logger = dependencies.logger || console;
    
    // Puzzle state tracking
    this.puzzles = new Map(); // puzzleId -> puzzle data
    this.gameState = {
      currentLevel: 1,
      completedLevels: new Set(),
      unlockedFeatures: new Set(),
      gameStarted: false,
      gameCompleted: false
    };
    
    // Level progression tracking
    this.levelTriggers = new Map(); // levelId -> trigger conditions
    this.completionCallbacks = new Map(); // levelId -> completion callbacks
    
    this._initializeService();
  }

  /**
   * Initialize the service and register callbacks
   * @private
   */
  _initializeService() {
    if (this.actionCallbacks) {
      this.actionCallbacks.register('puzzle.start', this._onPuzzleStart.bind(this));
      this.actionCallbacks.register('puzzle.complete', this._onPuzzleComplete.bind(this));
      this.actionCallbacks.register('level.complete', this._onLevelComplete.bind(this));
      this.actionCallbacks.register('game.reset', this._onGameReset.bind(this));
    }

    // Initialize default puzzles and levels
    this._initializeDefaultPuzzles();

    this.logger.info('PuzzleService initialized', {
      service: 'PuzzleService',
      currentLevel: this.gameState.currentLevel
    });
  }

  /**
   * Start the game and initialize first level
   * @returns {Promise<void>}
   */
  async startGame() {
    if (this.gameState.gameStarted) {
      this.logger.warn('Game already started');
      return;
    }

    this.gameState.gameStarted = true;
    this.gameState.gameStartTime = Date.now();

    // Initialize level 1
    await this.initializeLevel(1);

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set('game.state', this.gameState);
    }

    this.logger.info('Game started', {
      level: this.gameState.currentLevel,
      operation: 'startGame'
    });
  }

  /**
   * Initialize a specific level
   * @param {number} levelNumber - Level number to initialize
   * @returns {Promise<void>}
   */
  async initializeLevel(levelNumber) {
    const levelConfig = this._getLevelConfiguration(levelNumber);
    if (!levelConfig) {
      throw new Error(`Level configuration not found: ${levelNumber}`);
    }

    this.gameState.currentLevel = levelNumber;

    // Create level-specific windows and elements
    await this._createLevelElements(levelConfig);

    // Set up level completion triggers
    this._setupLevelTriggers(levelNumber, levelConfig);

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set('game.currentLevel', levelNumber);
      await this.stateManager.set(`levels.${levelNumber}.initialized`, true);
    }

    this.logger.info('Level initialized', {
      level: levelNumber,
      elements: levelConfig.elements?.length || 0,
      operation: 'initializeLevel'
    });
  }

  /**
   * Complete a level and progress to the next
   * @param {number} levelNumber - Level number to complete
   * @returns {Promise<void>}
   */
  async completeLevel(levelNumber) {
    if (this.gameState.completedLevels.has(levelNumber)) {
      this.logger.warn('Level already completed', { level: levelNumber });
      return;
    }

    this.gameState.completedLevels.add(levelNumber);

    // Execute completion callbacks
    const callbacks = this.completionCallbacks.get(levelNumber) || [];
    for (const callback of callbacks) {
      try {
        await callback(levelNumber);
      } catch (error) {
        this.logger.error('Level completion callback failed', {
          level: levelNumber,
          error: error.message
        });
      }
    }

    // Check if this is the final level
    const nextLevel = levelNumber + 1;
    const nextLevelConfig = this._getLevelConfiguration(nextLevel);
    
    if (nextLevelConfig) {
      // Initialize next level
      await this.initializeLevel(nextLevel);
    } else {
      // Game completed
      await this.completeGame();
    }

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set('game.completedLevels', Array.from(this.gameState.completedLevels));
      await this.stateManager.set(`levels.${levelNumber}.completed`, true);
      await this.stateManager.set(`levels.${levelNumber}.completedAt`, Date.now());
    }

    this.logger.info('Level completed', {
      level: levelNumber,
      nextLevel: nextLevelConfig ? nextLevel : 'GAME_COMPLETE',
      operation: 'completeLevel'
    });
  }

  /**
   * Complete the entire game
   * @returns {Promise<void>}
   */
  async completeGame() {
    this.gameState.gameCompleted = true;
    this.gameState.gameCompletedAt = Date.now();
    this.gameState.totalPlayTime = this.gameState.gameCompletedAt - this.gameState.gameStartTime;

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set('game.state', this.gameState);
    }

    this.logger.info('Game completed', {
      totalLevels: this.gameState.completedLevels.size,
      playTime: this.gameState.totalPlayTime,
      operation: 'completeGame'
    });
  }

  /**
   * Reset the game to initial state
   * @returns {Promise<void>}
   */
  async resetGame() {
    // Close all game windows
    const allWindows = this.gameWindowService.getAllWindows();
    for (const [windowId] of allWindows) {
      await this.gameWindowService.destroyWindow(windowId);
    }

    // Reset game state
    this.gameState = {
      currentLevel: 1,
      completedLevels: new Set(),
      unlockedFeatures: new Set(),
      gameStarted: false,
      gameCompleted: false
    };

    // Clear puzzles
    this.puzzles.clear();

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set('game.state', this.gameState);
      await this.stateManager.set('game.reset', true);
      await this.stateManager.set('game.resetAt', Date.now());
    }

    this.logger.info('Game reset', {
      operation: 'resetGame'
    });
  }

  /**
   * Handle video window closure (triggers level 1 logic)
   * @param {string} windowId - Window identifier
   * @returns {Promise<void>}
   */
  async handleVideoWindowClosed(windowId) {
    if (windowId === 'video' && this.gameState.currentLevel === 1) {
      this.logger.info('Video window closed, triggering level 1 logic');
      
      // Create door and key for level 1
      await this._createLevel1Elements();
      
      // Mark level 1 as properly started
      if (this.stateManager) {
        await this.stateManager.set('levels.1.videoWatched', true);
      }
    }
  }

  /**
   * Create demo doors and keys for testing
   * @returns {Promise<void>}
   */
  async createDemoDoorsAndKeys() {
    try {
      // Create demo door
      const door = await this.gameWindowService.createDoor('demo-door', 'Demo Door', true, {
        initialState: 'closed',
        isLocked: false
      });

      // Create demo key
      const key = await this.gameWindowService.createKey('demo-key', 'Demo Key', true, {
        isOneTime: false,
        closeAfterUse: false
      });

      // Establish relationship
      await this.doorKeyService.establishRelation('demo-door', 'demo-key');
      await this.doorKeyService.initializeDoorState('demo-door', {
        initialState: 'closed',
        isLocked: false
      });
      await this.doorKeyService.initializeKeyConfiguration('demo-key', {
        isOneTime: false,
        closeAfterUse: false
      });

      this.logger.info('Demo doors and keys created', {
        doorId: 'demo-door',
        keyId: 'demo-key',
        operation: 'createDemoDoorsAndKeys'
      });

    } catch (error) {
      this.logger.error('Failed to create demo doors and keys', {
        error: error.message,
        operation: 'createDemoDoorsAndKeys'
      });
      throw error;
    }
  }

  /**
   * Get current game state
   * @returns {Object} Current game state
   */
  getGameState() {
    return { ...this.gameState };
  }

  /**
   * Get puzzle by ID
   * @param {string} puzzleId - Puzzle identifier
   * @returns {Object|null} Puzzle data or null if not found
   */
  getPuzzle(puzzleId) {
    return this.puzzles.get(puzzleId) || null;
  }

  /**
   * Check if a level is completed
   * @param {number} levelNumber - Level number
   * @returns {boolean} Whether the level is completed
   */
  isLevelCompleted(levelNumber) {
    return this.gameState.completedLevels.has(levelNumber);
  }

  /**
   * Get level configuration
   * @param {number} levelNumber - Level number
   * @returns {Object|null} Level configuration or null if not found
   * @private
   */
  _getLevelConfiguration(levelNumber) {
    const levelConfigs = {
      1: {
        id: 1,
        name: 'First Steps',
        description: 'Learn the basics of doors and keys',
        elements: [
          { type: 'door', id: 'door1', title: 'Main Door' },
          { type: 'key', id: 'key1', title: 'Master Key' }
        ],
        completionConditions: [
          { type: 'door-opened', doorId: 'door1' }
        ]
      },
      2: {
        id: 2,
        name: 'Hidden Secrets',
        description: 'Discover hidden content with lenses',
        elements: [
          { type: 'lens', id: 'lens1', title: 'Magnifying Lens' },
          { type: 'content', id: 'hidden1', title: 'Hidden Message' }
        ],
        completionConditions: [
          { type: 'content-revealed', contentId: 'hidden1' }
        ]
      },
      3: {
        id: 3,
        name: 'Communication',
        description: 'Handle email communications',
        elements: [
          { type: 'email', id: 'email1', title: 'Important Message' }
        ],
        completionConditions: [
          { type: 'email-action-executed', emailId: 'email1' }
        ]
      }
    };

    return levelConfigs[levelNumber] || null;
  }

  /**
   * Create elements for a specific level
   * @param {Object} levelConfig - Level configuration
   * @returns {Promise<void>}
   * @private
   */
  async _createLevelElements(levelConfig) {
    for (const element of levelConfig.elements || []) {
      try {
        switch (element.type) {
          case 'door':
            await this.gameWindowService.createDoor(element.id, element.title, true, {
              initialState: 'closed',
              isLocked: false
            });
            await this.doorKeyService.initializeDoorState(element.id, {
              initialState: 'closed',
              isLocked: false
            });
            break;

          case 'key':
            await this.gameWindowService.createKey(element.id, element.title, true);
            await this.doorKeyService.initializeKeyConfiguration(element.id, {
              isOneTime: false,
              closeAfterUse: false
            });
            break;

          case 'lens':
            await this.lensService.createLens(element.id, {
              title: element.title,
              type: 'magnifying'
            });
            break;

          case 'email':
            // Email creation would depend on email files being available
            break;

          case 'content':
            await this.lensService.addRevealableContent(element.id, {
              type: 'hidden-text',
              position: { x: 300, y: 300 },
              data: { text: 'You found the hidden message!' }
            });
            break;
        }
      } catch (error) {
        this.logger.error('Failed to create level element', {
          level: levelConfig.id,
          element: element.id,
          type: element.type,
          error: error.message
        });
      }
    }
  }

  /**
   * Set up triggers for level completion
   * @param {number} levelNumber - Level number
   * @param {Object} levelConfig - Level configuration
   * @private
   */
  _setupLevelTriggers(levelNumber, levelConfig) {
    // This would set up event listeners for completion conditions
    // Implementation would depend on specific game requirements
    this.levelTriggers.set(levelNumber, levelConfig.completionConditions || []);
  }

  /**
   * Create level 1 specific elements
   * @returns {Promise<void>}
   * @private
   */
  async _createLevel1Elements() {
    // Check if elements already exist
    const existingWindows = this.gameWindowService.getAllWindows();
    
    if (!existingWindows.has('door1')) {
      await this.gameWindowService.createDoor('door1', 'Main Door', true, {
        initialState: 'closed',
        isLocked: false
      });
      await this.doorKeyService.initializeDoorState('door1', {
        initialState: 'closed',
        isLocked: false
      });
    }
    
    if (!existingWindows.has('key1')) {
      await this.gameWindowService.createKey('key1', 'Master Key', true);
      await this.doorKeyService.initializeKeyConfiguration('key1', {
        isOneTime: false,
        closeAfterUse: false
      });
    }

    // Establish relationship
    await this.doorKeyService.establishRelation('door1', 'key1');
  }

  /**
   * Initialize default puzzles
   * @private
   */
  _initializeDefaultPuzzles() {
    // Initialize basic puzzle configurations
    this.puzzles.set('door-key-basic', {
      id: 'door-key-basic',
      type: 'door-key',
      name: 'Basic Door and Key',
      description: 'Use a key to open a door',
      difficulty: 1,
      elements: ['door1', 'key1']
    });

    this.puzzles.set('lens-revelation', {
      id: 'lens-revelation',
      type: 'lens',
      name: 'Hidden Content',
      description: 'Use a lens to reveal hidden content',
      difficulty: 2,
      elements: ['lens1', 'hidden1']
    });
  }

  /**
   * Action callback for puzzle start events
   * @param {Object} context - Action context
   * @private
   */
  _onPuzzleStart(context) {
    this.logger.debug('Puzzle start action callback', {
      action: context.action,
      puzzleId: context.data.puzzleId,
      phase: context.phase
    });
  }

  /**
   * Action callback for puzzle complete events
   * @param {Object} context - Action context
   * @private
   */
  _onPuzzleComplete(context) {
    this.logger.debug('Puzzle complete action callback', {
      action: context.action,
      puzzleId: context.data.puzzleId,
      phase: context.phase
    });
  }

  /**
   * Action callback for level complete events
   * @param {Object} context - Action context
   * @private
   */
  _onLevelComplete(context) {
    this.logger.debug('Level complete action callback', {
      action: context.action,
      level: context.data.level,
      phase: context.phase
    });
  }

  /**
   * Action callback for game reset events
   * @param {Object} context - Action context
   * @private
   */
  _onGameReset(context) {
    this.logger.debug('Game reset action callback', {
      action: context.action,
      phase: context.phase
    });
  }
}