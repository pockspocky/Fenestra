/**
 * Email Service
 * 
 * Manages email system functionality including email processing, storage,
 * and integration with the game's email mechanics. Integrates with foundation
 * layer components for comprehensive email management.
 */

export class EmailService {
  constructor(dependencies = {}) {
    this.stateManager = dependencies.stateManager;
    this.resourceManager = dependencies.resourceManager;
    this.gameWindowService = dependencies.gameWindowService;
    this.actionCallbacks = dependencies.actionCallbacks;
    this.logger = dependencies.logger || console;
    
    // Email storage and tracking
    this.emails = new Map(); // emailId -> email data
    this.emailSequences = new Map(); // sequenceId -> sequence data
    this.inboxWatchers = new Map(); // path -> watcher instance
    
    // Email processing state
    this.processingQueue = [];
    this.isProcessing = false;
    
    this._initializeService();
  }

  /**
   * Initialize the service and register callbacks
   * @private
   */
  _initializeService() {
    if (this.actionCallbacks) {
      this.actionCallbacks.register('email.receive', this._onEmailReceive.bind(this));
      this.actionCallbacks.register('email.read', this._onEmailRead.bind(this));
      this.actionCallbacks.register('email.action', this._onEmailAction.bind(this));
    }

    this.logger.info('EmailService initialized', {
      service: 'EmailService'
    });
  }

  /**
   * Process an email file
   * @param {string} emailPath - Path to email file
   * @returns {Promise<Object>} Processed email data
   */
  async processEmail(emailPath) {
    try {
      // Load email content through resource manager
      const emailContent = await this.resourceManager.readFile(emailPath);
      const emailData = this._parseEmailContent(emailContent);
      
      // Generate email ID
      const emailId = this._generateEmailId(emailPath);
      
      // Store email data
      this.emails.set(emailId, {
        id: emailId,
        path: emailPath,
        ...emailData,
        receivedAt: Date.now(),
        isRead: false,
        actions: emailData.actions || []
      });

      // Update state manager
      if (this.stateManager) {
        await this.stateManager.set(`emails.${emailId}`, this.emails.get(emailId));
      }

      this.logger.info('Email processed', {
        emailId,
        path: emailPath,
        subject: emailData.subject,
        operation: 'processEmail'
      });

      return this.emails.get(emailId);
    } catch (error) {
      this.logger.error('Failed to process email', {
        path: emailPath,
        error: error.message,
        operation: 'processEmail'
      });
      throw error;
    }
  }

  /**
   * Display an email in a window
   * @param {string} emailId - Email identifier
   * @param {Object} options - Display options
   * @returns {Promise<Object>} Created email window
   */
  async displayEmail(emailId, options = {}) {
    const email = this.emails.get(emailId);
    if (!email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    // Create email window
    const windowId = options.windowId || `email-${emailId}`;
    const emailWindow = await this.gameWindowService.createEmail(windowId, {
      title: email.subject || 'Email',
      width: options.width || 600,
      height: options.height || 400,
      ...options
    });

    // Mark email as read
    await this.markAsRead(emailId);

    this.logger.info('Email displayed', {
      emailId,
      windowId,
      subject: email.subject,
      operation: 'displayEmail'
    });

    return emailWindow;
  }

  /**
   * Mark an email as read
   * @param {string} emailId - Email identifier
   * @returns {Promise<void>}
   */
  async markAsRead(emailId) {
    const email = this.emails.get(emailId);
    if (email && !email.isRead) {
      email.isRead = true;
      email.readAt = Date.now();

      if (this.stateManager) {
        await this.stateManager.set(`emails.${emailId}.isRead`, true);
        await this.stateManager.set(`emails.${emailId}.readAt`, email.readAt);
      }

      this.logger.info('Email marked as read', {
        emailId,
        subject: email.subject,
        operation: 'markAsRead'
      });
    }
  }

  /**
   * Execute an email action
   * @param {string} emailId - Email identifier
   * @param {string} actionId - Action identifier
   * @returns {Promise<Object>} Action result
   */
  async executeEmailAction(emailId, actionId) {
    const email = this.emails.get(emailId);
    if (!email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    const action = email.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const result = {
      success: false,
      message: null,
      data: null
    };

    try {
      // Execute action based on type
      switch (action.type) {
        case 'reply':
          result.data = await this._executeReplyAction(email, action);
          break;
        case 'forward':
          result.data = await this._executeForwardAction(email, action);
          break;
        case 'delete':
          result.data = await this._executeDeleteAction(email, action);
          break;
        case 'custom':
          result.data = await this._executeCustomAction(email, action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      result.success = true;
      result.message = action.successMessage || 'Action executed successfully';

      // Update email state
      if (!email.executedActions) {
        email.executedActions = [];
      }
      email.executedActions.push({
        actionId,
        executedAt: Date.now(),
        result: result.data
      });

      if (this.stateManager) {
        await this.stateManager.set(`emails.${emailId}.executedActions`, email.executedActions);
      }

      this.logger.info('Email action executed', {
        emailId,
        actionId,
        actionType: action.type,
        operation: 'executeEmailAction'
      });

    } catch (error) {
      result.message = error.message;
      this.logger.error('Failed to execute email action', {
        emailId,
        actionId,
        error: error.message,
        operation: 'executeEmailAction'
      });
    }

    return result;
  }

  /**
   * Start watching an inbox directory for new emails
   * @param {string} inboxPath - Path to inbox directory
   * @param {Object} options - Watch options
   * @returns {Promise<void>}
   */
  async startInboxWatcher(inboxPath, options = {}) {
    if (this.inboxWatchers.has(inboxPath)) {
      this.logger.warn('Inbox watcher already exists', { inboxPath });
      return;
    }

    try {
      // Use resource manager to watch directory
      const watcher = await this.resourceManager.watchDirectory(inboxPath, {
        onFileAdded: (filePath) => this._onEmailFileAdded(filePath),
        onFileChanged: (filePath) => this._onEmailFileChanged(filePath),
        onFileRemoved: (filePath) => this._onEmailFileRemoved(filePath),
        ...options
      });

      this.inboxWatchers.set(inboxPath, watcher);

      this.logger.info('Inbox watcher started', {
        inboxPath,
        operation: 'startInboxWatcher'
      });

    } catch (error) {
      this.logger.error('Failed to start inbox watcher', {
        inboxPath,
        error: error.message,
        operation: 'startInboxWatcher'
      });
      throw error;
    }
  }

  /**
   * Stop watching an inbox directory
   * @param {string} inboxPath - Path to inbox directory
   * @returns {Promise<void>}
   */
  async stopInboxWatcher(inboxPath) {
    const watcher = this.inboxWatchers.get(inboxPath);
    if (watcher) {
      await watcher.close();
      this.inboxWatchers.delete(inboxPath);

      this.logger.info('Inbox watcher stopped', {
        inboxPath,
        operation: 'stopInboxWatcher'
      });
    }
  }

  /**
   * Get all emails
   * @returns {Array} Array of email data
   */
  getAllEmails() {
    return Array.from(this.emails.values());
  }

  /**
   * Get email by ID
   * @param {string} emailId - Email identifier
   * @returns {Object|null} Email data or null if not found
   */
  getEmail(emailId) {
    return this.emails.get(emailId) || null;
  }

  /**
   * Get unread emails
   * @returns {Array} Array of unread email data
   */
  getUnreadEmails() {
    return Array.from(this.emails.values()).filter(email => !email.isRead);
  }

  /**
   * Parse email content from file
   * @param {string} content - Raw email content
   * @returns {Object} Parsed email data
   * @private
   */
  _parseEmailContent(content) {
    // Simple email parsing - in a real implementation this would be more sophisticated
    const lines = content.split('\n');
    const email = {
      headers: {},
      body: '',
      actions: []
    };

    let inHeaders = true;
    let inActions = false;
    let bodyLines = [];
    let actionLines = [];

    for (const line of lines) {
      if (inHeaders && line.trim() === '') {
        inHeaders = false;
        continue;
      }

      if (line.startsWith('---ACTIONS---')) {
        inActions = true;
        continue;
      }

      if (inHeaders) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          email.headers[key] = value;
        }
      } else if (inActions) {
        actionLines.push(line);
      } else {
        bodyLines.push(line);
      }
    }

    email.subject = email.headers.subject || 'No Subject';
    email.from = email.headers.from || 'Unknown Sender';
    email.to = email.headers.to || 'Unknown Recipient';
    email.body = bodyLines.join('\n').trim();

    // Parse actions
    if (actionLines.length > 0) {
      try {
        const actionsText = actionLines.join('\n');
        email.actions = JSON.parse(actionsText);
      } catch (error) {
        this.logger.warn('Failed to parse email actions', { error: error.message });
        email.actions = [];
      }
    }

    return email;
  }

  /**
   * Generate email ID from path
   * @param {string} emailPath - Email file path
   * @returns {string} Generated email ID
   * @private
   */
  _generateEmailId(emailPath) {
    // Simple ID generation based on path and timestamp
    const pathHash = emailPath.replace(/[^a-zA-Z0-9]/g, '_');
    return `email_${pathHash}_${Date.now()}`;
  }

  /**
   * Handle new email file added to inbox
   * @param {string} filePath - Path to new email file
   * @private
   */
  async _onEmailFileAdded(filePath) {
    try {
      await this.processEmail(filePath);
      this.logger.info('New email detected and processed', { filePath });
    } catch (error) {
      this.logger.error('Failed to process new email', {
        filePath,
        error: error.message
      });
    }
  }

  /**
   * Handle email file changed
   * @param {string} filePath - Path to changed email file
   * @private
   */
  async _onEmailFileChanged(filePath) {
    // Re-process the email
    await this._onEmailFileAdded(filePath);
  }

  /**
   * Handle email file removed
   * @param {string} filePath - Path to removed email file
   * @private
   */
  _onEmailFileRemoved(filePath) {
    // Find and remove email from memory
    for (const [emailId, email] of this.emails.entries()) {
      if (email.path === filePath) {
        this.emails.delete(emailId);
        this.logger.info('Email removed from memory', { emailId, filePath });
        break;
      }
    }
  }

  /**
   * Execute reply action
   * @param {Object} email - Email data
   * @param {Object} action - Action data
   * @returns {Promise<Object>} Action result
   * @private
   */
  async _executeReplyAction(email, action) {
    // Implementation would depend on game requirements
    return { type: 'reply', originalEmailId: email.id };
  }

  /**
   * Execute forward action
   * @param {Object} email - Email data
   * @param {Object} action - Action data
   * @returns {Promise<Object>} Action result
   * @private
   */
  async _executeForwardAction(email, action) {
    // Implementation would depend on game requirements
    return { type: 'forward', originalEmailId: email.id };
  }

  /**
   * Execute delete action
   * @param {Object} email - Email data
   * @param {Object} action - Action data
   * @returns {Promise<Object>} Action result
   * @private
   */
  async _executeDeleteAction(email, action) {
    // Remove email from memory and state
    this.emails.delete(email.id);
    
    if (this.stateManager) {
      await this.stateManager.set(`emails.${email.id}`, null);
    }

    return { type: 'delete', deletedEmailId: email.id };
  }

  /**
   * Execute custom action
   * @param {Object} email - Email data
   * @param {Object} action - Action data
   * @returns {Promise<Object>} Action result
   * @private
   */
  async _executeCustomAction(email, action) {
    // Custom actions would be implemented based on game requirements
    return { type: 'custom', action: action.id, emailId: email.id };
  }

  /**
   * Action callback for email receive events
   * @param {Object} context - Action context
   * @private
   */
  _onEmailReceive(context) {
    this.logger.debug('Email receive action callback', {
      action: context.action,
      emailId: context.data.emailId,
      phase: context.phase
    });
  }

  /**
   * Action callback for email read events
   * @param {Object} context - Action context
   * @private
   */
  _onEmailRead(context) {
    this.logger.debug('Email read action callback', {
      action: context.action,
      emailId: context.data.emailId,
      phase: context.phase
    });
  }

  /**
   * Action callback for email action events
   * @param {Object} context - Action context
   * @private
   */
  _onEmailAction(context) {
    this.logger.debug('Email action callback', {
      action: context.action,
      emailId: context.data.emailId,
      actionId: context.data.actionId,
      phase: context.phase
    });
  }
}