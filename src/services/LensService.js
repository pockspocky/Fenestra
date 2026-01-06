/**
 * Lens Service
 * 
 * Manages lens system functionality including lens creation, tracking,
 * and content revelation mechanics. Integrates with foundation layer
 * components for comprehensive lens management.
 */

export class LensService {
  constructor(dependencies = {}) {
    this.stateManager = dependencies.stateManager;
    this.gameWindowService = dependencies.gameWindowService;
    this.actionCallbacks = dependencies.actionCallbacks;
    this.logger = dependencies.logger || console;
    
    // Lens tracking
    this.lenses = new Map(); // lensId -> lens data
    this.trackingSessions = new Map(); // sessionId -> tracking session data
    
    // Lens configuration
    this.lensTypes = new Map(); // lensType -> configuration
    this.revealedContent = new Map(); // contentId -> revealed content data
    
    this._initializeService();
  }

  /**
   * Initialize the service and register callbacks
   * @private
   */
  _initializeService() {
    if (this.actionCallbacks) {
      this.actionCallbacks.register('lens.create', this._onLensCreate.bind(this));
      this.actionCallbacks.register('lens.move', this._onLensMove.bind(this));
      this.actionCallbacks.register('lens.destroy', this._onLensDestroy.bind(this));
      this.actionCallbacks.register('lens.track', this._onLensTrack.bind(this));
    }

    // Initialize default lens types
    this._initializeDefaultLensTypes();

    this.logger.info('LensService initialized', {
      service: 'LensService'
    });
  }

  /**
   * Create a new lens
   * @param {string} lensId - Unique lens identifier
   * @param {Object} options - Lens creation options
   * @returns {Promise<Object>} Created lens data
   */
  async createLens(lensId, options = {}) {
    const lensData = {
      id: lensId,
      type: options.type || 'default',
      size: options.size || { width: 200, height: 200 },
      position: options.position || { x: 100, y: 100 },
      isActive: false,
      isTracking: false,
      createdAt: Date.now(),
      revealedContent: [],
      ...options
    };

    // Create lens window
    const lensWindow = await this.gameWindowService.createLens(lensId, {
      title: options.title || 'Lens',
      width: lensData.size.width,
      height: lensData.size.height,
      x: lensData.position.x,
      y: lensData.position.y,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      ...options.windowOptions
    });

    // Store lens data
    this.lenses.set(lensId, lensData);

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`lenses.${lensId}`, lensData);
    }

    this.logger.info('Lens created', {
      lensId,
      type: lensData.type,
      size: lensData.size,
      position: lensData.position,
      operation: 'createLens'
    });

    return {
      lens: lensData,
      window: lensWindow
    };
  }

  /**
   * Move a lens to a new position
   * @param {string} lensId - Lens identifier
   * @param {Object} position - New position {x, y}
   * @returns {Promise<void>}
   */
  async moveLens(lensId, position) {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      throw new Error(`Lens not found: ${lensId}`);
    }

    // Update lens position
    lens.position = { ...position };
    lens.lastMoved = Date.now();

    // Move the window
    const window = this.gameWindowService.getWindow(lensId);
    if (window && window.setBounds) {
      window.setBounds({
        x: position.x,
        y: position.y,
        width: lens.size.width,
        height: lens.size.height
      });
    }

    // Check for content revelation at new position
    await this._checkContentRevelation(lensId, position);

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`lenses.${lensId}.position`, position);
      await this.stateManager.set(`lenses.${lensId}.lastMoved`, lens.lastMoved);
    }

    this.logger.debug('Lens moved', {
      lensId,
      position,
      operation: 'moveLens'
    });
  }

  /**
   * Start tracking a lens
   * @param {string} lensId - Lens identifier
   * @param {Object} options - Tracking options
   * @returns {Promise<string>} Tracking session ID
   */
  async startTracking(lensId, options = {}) {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      throw new Error(`Lens not found: ${lensId}`);
    }

    const sessionId = `tracking_${lensId}_${Date.now()}`;
    const trackingSession = {
      id: sessionId,
      lensId,
      startTime: Date.now(),
      isActive: true,
      trackingData: [],
      options: {
        interval: options.interval || 100, // ms
        recordMovement: options.recordMovement !== false,
        detectContent: options.detectContent !== false,
        ...options
      }
    };

    this.trackingSessions.set(sessionId, trackingSession);
    lens.isTracking = true;
    lens.currentTrackingSession = sessionId;

    // Start tracking interval if needed
    if (trackingSession.options.recordMovement) {
      this._startTrackingInterval(sessionId);
    }

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`lenses.${lensId}.isTracking`, true);
      await this.stateManager.set(`trackingSessions.${sessionId}`, trackingSession);
    }

    this.logger.info('Lens tracking started', {
      lensId,
      sessionId,
      options: trackingSession.options,
      operation: 'startTracking'
    });

    return sessionId;
  }

  /**
   * Stop tracking a lens
   * @param {string} sessionId - Tracking session ID
   * @returns {Promise<Object>} Tracking session data
   */
  async stopTracking(sessionId) {
    const session = this.trackingSessions.get(sessionId);
    if (!session) {
      throw new Error(`Tracking session not found: ${sessionId}`);
    }

    session.isActive = false;
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;

    const lens = this.lenses.get(session.lensId);
    if (lens) {
      lens.isTracking = false;
      lens.currentTrackingSession = null;
    }

    // Stop tracking interval
    this._stopTrackingInterval(sessionId);

    // Update state manager
    if (this.stateManager) {
      await this.stateManager.set(`lenses.${session.lensId}.isTracking`, false);
      await this.stateManager.set(`trackingSessions.${sessionId}`, session);
    }

    this.logger.info('Lens tracking stopped', {
      lensId: session.lensId,
      sessionId,
      duration: session.duration,
      dataPoints: session.trackingData.length,
      operation: 'stopTracking'
    });

    return session;
  }

  /**
   * Destroy a lens
   * @param {string} lensId - Lens identifier
   * @returns {Promise<boolean>} Success status
   */
  async destroyLens(lensId) {
    const lens = this.lenses.get(lensId);
    if (!lens) {
      return false;
    }

    // Stop any active tracking
    if (lens.isTracking && lens.currentTrackingSession) {
      await this.stopTracking(lens.currentTrackingSession);
    }

    // Destroy the window
    const success = await this.gameWindowService.destroyWindow(lensId);
    
    if (success) {
      this.lenses.delete(lensId);

      // Update state manager
      if (this.stateManager) {
        await this.stateManager.set(`lenses.${lensId}`, null);
      }

      this.logger.info('Lens destroyed', {
        lensId,
        operation: 'destroyLens'
      });
    }

    return success;
  }

  /**
   * Register a lens type with specific configuration
   * @param {string} typeName - Lens type name
   * @param {Object} config - Lens type configuration
   * @returns {Promise<void>}
   */
  async registerLensType(typeName, config) {
    this.lensTypes.set(typeName, {
      name: typeName,
      defaultSize: config.defaultSize || { width: 200, height: 200 },
      revealRadius: config.revealRadius || 100,
      contentTypes: config.contentTypes || ['text', 'image'],
      effects: config.effects || [],
      ...config
    });

    if (this.stateManager) {
      await this.stateManager.set(`lensTypes.${typeName}`, this.lensTypes.get(typeName));
    }

    this.logger.info('Lens type registered', {
      typeName,
      config,
      operation: 'registerLensType'
    });
  }

  /**
   * Add content that can be revealed by lenses
   * @param {string} contentId - Content identifier
   * @param {Object} contentData - Content data
   * @returns {Promise<void>}
   */
  async addRevealableContent(contentId, contentData) {
    const content = {
      id: contentId,
      type: contentData.type || 'text',
      position: contentData.position || { x: 0, y: 0 },
      size: contentData.size || { width: 100, height: 100 },
      data: contentData.data,
      revealConditions: contentData.revealConditions || {},
      isRevealed: false,
      revealedAt: null,
      revealedBy: null,
      ...contentData
    };

    this.revealedContent.set(contentId, content);

    if (this.stateManager) {
      await this.stateManager.set(`revealableContent.${contentId}`, content);
    }

    this.logger.info('Revealable content added', {
      contentId,
      type: content.type,
      position: content.position,
      operation: 'addRevealableContent'
    });
  }

  /**
   * Get lens by ID
   * @param {string} lensId - Lens identifier
   * @returns {Object|null} Lens data or null if not found
   */
  getLens(lensId) {
    return this.lenses.get(lensId) || null;
  }

  /**
   * Get all lenses
   * @returns {Array} Array of lens data
   */
  getAllLenses() {
    return Array.from(this.lenses.values());
  }

  /**
   * Get tracking session data
   * @param {string} sessionId - Tracking session ID
   * @returns {Object|null} Tracking session data or null if not found
   */
  getTrackingSession(sessionId) {
    return this.trackingSessions.get(sessionId) || null;
  }

  /**
   * Get revealed content
   * @returns {Array} Array of revealed content
   */
  getRevealedContent() {
    return Array.from(this.revealedContent.values()).filter(content => content.isRevealed);
  }

  /**
   * Initialize default lens types
   * @private
   */
  _initializeDefaultLensTypes() {
    this.lensTypes.set('default', {
      name: 'default',
      defaultSize: { width: 200, height: 200 },
      revealRadius: 100,
      contentTypes: ['text', 'image'],
      effects: []
    });

    this.lensTypes.set('magnifying', {
      name: 'magnifying',
      defaultSize: { width: 150, height: 150 },
      revealRadius: 75,
      contentTypes: ['text', 'hidden-text'],
      effects: ['magnify']
    });

    this.lensTypes.set('xray', {
      name: 'xray',
      defaultSize: { width: 250, height: 250 },
      revealRadius: 125,
      contentTypes: ['hidden', 'encrypted'],
      effects: ['xray']
    });
  }

  /**
   * Check for content revelation at lens position
   * @param {string} lensId - Lens identifier
   * @param {Object} position - Lens position
   * @private
   */
  async _checkContentRevelation(lensId, position) {
    const lens = this.lenses.get(lensId);
    if (!lens) return;

    const lensType = this.lensTypes.get(lens.type);
    if (!lensType) return;

    for (const [contentId, content] of this.revealedContent.entries()) {
      if (content.isRevealed) continue;

      // Check if lens is within reveal radius of content
      const distance = Math.sqrt(
        Math.pow(position.x - content.position.x, 2) +
        Math.pow(position.y - content.position.y, 2)
      );

      if (distance <= lensType.revealRadius) {
        // Check if lens type can reveal this content type
        if (lensType.contentTypes.includes(content.type)) {
          await this._revealContent(contentId, lensId);
        }
      }
    }
  }

  /**
   * Reveal content
   * @param {string} contentId - Content identifier
   * @param {string} lensId - Lens identifier that revealed the content
   * @private
   */
  async _revealContent(contentId, lensId) {
    const content = this.revealedContent.get(contentId);
    if (!content || content.isRevealed) return;

    content.isRevealed = true;
    content.revealedAt = Date.now();
    content.revealedBy = lensId;

    // Add to lens's revealed content list
    const lens = this.lenses.get(lensId);
    if (lens) {
      lens.revealedContent.push(contentId);
    }

    if (this.stateManager) {
      await this.stateManager.set(`revealableContent.${contentId}`, content);
      if (lens) {
        await this.stateManager.set(`lenses.${lensId}.revealedContent`, lens.revealedContent);
      }
    }

    this.logger.info('Content revealed', {
      contentId,
      lensId,
      contentType: content.type,
      operation: 'revealContent'
    });
  }

  /**
   * Start tracking interval for a session
   * @param {string} sessionId - Tracking session ID
   * @private
   */
  _startTrackingInterval(sessionId) {
    const session = this.trackingSessions.get(sessionId);
    if (!session) return;

    session.intervalId = setInterval(() => {
      if (!session.isActive) {
        this._stopTrackingInterval(sessionId);
        return;
      }

      const lens = this.lenses.get(session.lensId);
      if (lens) {
        session.trackingData.push({
          timestamp: Date.now(),
          position: { ...lens.position },
          revealedContentCount: lens.revealedContent.length
        });
      }
    }, session.options.interval);
  }

  /**
   * Stop tracking interval for a session
   * @param {string} sessionId - Tracking session ID
   * @private
   */
  _stopTrackingInterval(sessionId) {
    const session = this.trackingSessions.get(sessionId);
    if (session && session.intervalId) {
      clearInterval(session.intervalId);
      delete session.intervalId;
    }
  }

  /**
   * Action callback for lens create events
   * @param {Object} context - Action context
   * @private
   */
  _onLensCreate(context) {
    this.logger.debug('Lens create action callback', {
      action: context.action,
      lensId: context.data.lensId,
      phase: context.phase
    });
  }

  /**
   * Action callback for lens move events
   * @param {Object} context - Action context
   * @private
   */
  _onLensMove(context) {
    this.logger.debug('Lens move action callback', {
      action: context.action,
      lensId: context.data.lensId,
      position: context.data.position,
      phase: context.phase
    });
  }

  /**
   * Action callback for lens destroy events
   * @param {Object} context - Action context
   * @private
   */
  _onLensDestroy(context) {
    this.logger.debug('Lens destroy action callback', {
      action: context.action,
      lensId: context.data.lensId,
      phase: context.phase
    });
  }

  /**
   * Action callback for lens track events
   * @param {Object} context - Action context
   * @private
   */
  _onLensTrack(context) {
    this.logger.debug('Lens track action callback', {
      action: context.action,
      lensId: context.data.lensId,
      sessionId: context.data.sessionId,
      phase: context.phase
    });
  }
}