/**
 * Email Scheduling System
 * 
 * Enables programmatic email delivery with configurable delays and event-driven callbacks.
 * Follows the established patterns from the door/key callback system.
 * 
 * @module emailScheduler
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { emailSchemaValidator } from '../security/emailSchemaValidator.js';
import { systemEvents, EMAIL_SCHEDULING_EVENTS } from '../events/systemEvents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Error Code Constants
// ============================================================================

/**
 * Error codes for email scheduling operations
 */
export const EMAIL_SCHEDULING_ERROR_CODES = {
  // File errors
  EMAIL_FILE_NOT_FOUND: 'EMAIL_FILE_NOT_FOUND',
  INVALID_EMAIL_JSON: 'INVALID_EMAIL_JSON',
  EMAIL_VALIDATION_FAILED: 'EMAIL_VALIDATION_FAILED',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  FILE_PERMISSION_ERROR: 'FILE_PERMISSION_ERROR',
  DISK_SPACE_ERROR: 'DISK_SPACE_ERROR',
  
  // Scheduling errors
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  SCHEDULE_ALREADY_COMPLETED: 'SCHEDULE_ALREADY_COMPLETED',
  MAX_SCHEDULED_EMAILS_EXCEEDED: 'MAX_SCHEDULED_EMAILS_EXCEEDED',
  INVALID_DELAY: 'INVALID_DELAY',
  
  // Callback errors
  CALLBACK_NOT_FOUND: 'CALLBACK_NOT_FOUND',
  
  // State errors
  STATE_FILE_READ_ERROR: 'STATE_FILE_READ_ERROR',
  STATE_FILE_WRITE_ERROR: 'STATE_FILE_WRITE_ERROR',
  STATE_FILE_CORRUPTED: 'STATE_FILE_CORRUPTED'
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  defaultDelay: 5000,
  maxScheduledEmails: 50,
  enablePersistence: true,
  stateFile: 'scheduled-emails.json'
};

/**
 * Current configuration (loaded from .fenestra-config.json)
 */
let config = { ...DEFAULT_CONFIG };

/**
 * Load configuration from .fenestra-config.json
 * Falls back to default values if configuration is missing or invalid
 * 
 * @returns {Object} Configuration object
 */
function loadConfiguration() {
  try {
    // Find the config file (go up from src/systems/ to project root)
    const configPath = path.join(__dirname, '..', '..', '.fenestra-config.json');
    
    if (!fs.existsSync(configPath)) {
      console.warn('[EMAIL_SCHEDULER] Configuration file not found, using defaults');
      return { ...DEFAULT_CONFIG };
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const fullConfig = JSON.parse(configContent);
    
    // Extract emailScheduling section
    const emailSchedulingConfig = fullConfig.emailScheduling || {};
    
    // Merge with defaults, validating each field
    const loadedConfig = {
      defaultDelay: validateDefaultDelay(emailSchedulingConfig.defaultDelay),
      maxScheduledEmails: validateMaxScheduledEmails(emailSchedulingConfig.maxScheduledEmails),
      enablePersistence: validateEnablePersistence(emailSchedulingConfig.enablePersistence),
      stateFile: validateStateFile(emailSchedulingConfig.stateFile)
    };
    
    console.log('[EMAIL_SCHEDULER] Configuration loaded', loadedConfig);
    return loadedConfig;
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Failed to load configuration, using defaults', {
      error: error.message
    });
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Validate defaultDelay configuration value
 * 
 * @param {*} value - Value to validate
 * @returns {number} Valid defaultDelay or default value
 */
function validateDefaultDelay(value) {
  if (typeof value !== 'number' || value < 0 || value > 86400000) {
    if (value !== undefined) {
      console.warn('[EMAIL_SCHEDULER] Invalid defaultDelay, using default', {
        provided: value,
        default: DEFAULT_CONFIG.defaultDelay
      });
    }
    return DEFAULT_CONFIG.defaultDelay;
  }
  return value;
}

/**
 * Validate maxScheduledEmails configuration value
 * 
 * @param {*} value - Value to validate
 * @returns {number} Valid maxScheduledEmails or default value
 */
function validateMaxScheduledEmails(value) {
  if (typeof value !== 'number' || value < 1 || value > 1000) {
    if (value !== undefined) {
      console.warn('[EMAIL_SCHEDULER] Invalid maxScheduledEmails, using default', {
        provided: value,
        default: DEFAULT_CONFIG.maxScheduledEmails
      });
    }
    return DEFAULT_CONFIG.maxScheduledEmails;
  }
  return value;
}

/**
 * Validate enablePersistence configuration value
 * 
 * @param {*} value - Value to validate
 * @returns {boolean} Valid enablePersistence or default value
 */
function validateEnablePersistence(value) {
  if (typeof value !== 'boolean') {
    if (value !== undefined) {
      console.warn('[EMAIL_SCHEDULER] Invalid enablePersistence, using default', {
        provided: value,
        default: DEFAULT_CONFIG.enablePersistence
      });
    }
    return DEFAULT_CONFIG.enablePersistence;
  }
  return value;
}

/**
 * Validate stateFile configuration value
 * 
 * @param {*} value - Value to validate
 * @returns {string} Valid stateFile or default value
 */
function validateStateFile(value) {
  if (typeof value !== 'string' || value.includes('/') || value.includes('\\')) {
    if (value !== undefined) {
      console.warn('[EMAIL_SCHEDULER] Invalid stateFile, using default', {
        provided: value,
        default: DEFAULT_CONFIG.stateFile
      });
    }
    return DEFAULT_CONFIG.stateFile;
  }
  return value;
}

/**
 * Get current configuration
 * 
 * @returns {Object} Current configuration
 */
export function getConfiguration() {
  return { ...config };
}

// ============================================================================
// In-Memory Schedule Storage
// ============================================================================

/**
 * Map of active schedules
 * Key: scheduleId (string)
 * Value: Schedule_Entry object with timer reference
 */
const schedules = new Map();

/**
 * Get all active schedules (for testing/debugging)
 * 
 * @returns {Map} Active schedules map
 */
export function getActiveSchedules() {
  return schedules;
}

/**
 * Get schedule count (for testing/debugging)
 * 
 * @returns {number} Number of active schedules
 */
export function getScheduleCount() {
  return schedules.size;
}

// ============================================================================
// Module Initialization
// ============================================================================

/**
 * Initialize the email scheduler module
 * Loads configuration and prepares the system
 */
export async function initialize() {
  console.log('[EMAIL_SCHEDULER] Initializing email scheduler');

  // Load configuration
  config = loadConfiguration();
  console.log('[EMAIL_SCHEDULER] Configuration loaded');

  // Load persisted schedules from state file
  console.log('[EMAIL_SCHEDULER] Loading persisted schedules...');
  const loadResult = await loadStateFile();

  if (!loadResult.success) {
    console.error('[EMAIL_SCHEDULER] Failed to load state file', {
      error: loadResult.error,
      message: loadResult.message
    });
    // Continue initialization even if state file loading fails
  } else {
    console.log('[EMAIL_SCHEDULER] State file loaded', {
      scheduleCount: loadResult.schedules.length,
      message: loadResult.message
    });

    // Restore each persisted schedule with recalculated delay
    for (const schedule of loadResult.schedules) {
      try {
        // Skip schedules that are already completed
        if (schedule.status === 'sent' || schedule.status === 'cancelled' || schedule.status === 'failed') {
          console.log('[EMAIL_SCHEDULER] Skipping completed schedule', {
            scheduleId: schedule.scheduleId,
            status: schedule.status,
            emailFileName: schedule.emailFileName
          });
          continue;
        }

        // Recalculate remaining delay based on elapsed time
        const remainingDelay = recalculateDelay(schedule);

        console.log('[EMAIL_SCHEDULER] Restoring schedule', {
          scheduleId: schedule.scheduleId,
          emailFileName: schedule.emailFileName,
          originalDelay: schedule.delayMs,
          remainingDelay,
          willSendImmediately: remainingDelay === 0
        });

        // Schedule the email with recalculated delay
        // Note: We use the internal scheduling logic to avoid creating duplicate state entries
        const result = await scheduleEmail(
          schedule.emailFileName,
          remainingDelay,
          schedule.options || {}
        );

        if (result.success) {
          console.log('[EMAIL_SCHEDULER] Schedule restored successfully', {
            scheduleId: result.scheduleId,
            emailFileName: schedule.emailFileName
          });
        } else {
          console.error('[EMAIL_SCHEDULER] Failed to restore schedule', {
            scheduleId: schedule.scheduleId,
            emailFileName: schedule.emailFileName,
            error: result.error,
            message: result.message
          });
        }

      } catch (error) {
        console.error('[EMAIL_SCHEDULER] Error restoring schedule', {
          scheduleId: schedule.scheduleId,
          emailFileName: schedule.emailFileName,
          error: error.message,
          stack: error.stack
        });
        // Continue with next schedule
      }
    }
  }

  console.log('[EMAIL_SCHEDULER] Email scheduler initialized', {
    activeSchedules: schedules.size
  });
}

// Auto-initialize on module load
initialize();

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate email structure before sending
 * Checks required fields and validates body or bodyFile presence
 * 
 * @param {Object} emailData - Email data object to validate
 * @returns {Object} Validation result with isValid flag and errors array
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export function validateEmail(emailData) {
  try {
    // Use the existing emailSchemaValidator for validation
    const validation = emailSchemaValidator.validateEmailJson(emailData);
    
    // Return validation result in the expected format
    return {
      isValid: validation.isValid,
      errors: validation.errors || []
    };
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Email validation error', {
      error: error.message,
      emailId: emailData?.id
    });
    
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`]
    };
  }
}

// ============================================================================
// Email Sending
// ============================================================================

/**
 * Send an email immediately
 * Validates email file exists, reads and parses JSON, validates structure,
 * creates destination directory if needed, and copies file to game-data/emails/
 * 
 * @param {string} emailFileName - Name of email file in emailsPending/
 * @param {Object} options - Optional configuration
 * @param {boolean} options.skipValidation - Skip validation (default: false)
 * @returns {Promise<Object>} Result with success flag and emailId or error
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
 */
export async function sendEmail(emailFileName, options = {}) {
  try {
    // Construct paths
    const projectRoot = path.join(__dirname, '..', '..');
    const emailsPendingPath = path.join(projectRoot, 'emailsPending', emailFileName);
    
    // Read configuration to get gameDataDirectory
    const configPath = path.join(projectRoot, '.fenestra-config.json');
    let gameDataDir = './game-data';
    
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const fullConfig = JSON.parse(configContent);
        gameDataDir = fullConfig.gameDataDirectory || './game-data';
      }
    } catch (configError) {
      console.warn('[EMAIL_SCHEDULER] Failed to read config, using default game-data path', {
        error: configError.message
      });
    }
    
    const emailsDestPath = path.join(projectRoot, gameDataDir, 'emails');
    const emailDestFilePath = path.join(emailsDestPath, emailFileName);
    
    // Requirement 1.3: Validate email file exists in emailsPending/
    if (!fs.existsSync(emailsPendingPath)) {
      console.error('[EMAIL_SCHEDULER] Email file not found', {
        emailFileName,
        path: emailsPendingPath
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.EMAIL_FILE_NOT_FOUND,
        message: `Email file not found: ${emailFileName}`,
        details: {
          emailFileName,
          expectedPath: emailsPendingPath
        }
      };
    }
    
    // Read and parse email JSON file
    let emailContent;
    let emailData;
    
    try {
      emailContent = fs.readFileSync(emailsPendingPath, 'utf-8');
    } catch (readError) {
      console.error('[EMAIL_SCHEDULER] Failed to read email file', {
        emailFileName,
        error: readError.message,
        code: readError.code
      });
      
      // Requirement 10.3: Handle file permission errors
      if (readError.code === 'EACCES') {
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.FILE_PERMISSION_ERROR,
          message: `Permission denied reading email file: ${emailFileName}`,
          details: {
            emailFileName,
            systemError: readError.message
          }
        };
      }
      
      // Requirement 1.9: Handle file system errors
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
        message: `Failed to read email file: ${emailFileName}`,
        details: {
          emailFileName,
          systemError: readError.message
        }
      };
    }
    
    // Requirement 1.4: Validate JSON parsing
    try {
      emailData = JSON.parse(emailContent);
    } catch (parseError) {
      console.error('[EMAIL_SCHEDULER] Invalid email JSON', {
        emailFileName,
        error: parseError.message
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.INVALID_EMAIL_JSON,
        message: `Invalid JSON in email file: ${emailFileName}`,
        details: {
          emailFileName,
          parseError: parseError.message
        }
      };
    }
    
    // Requirement 1.5, 1.7: Validate email structure using validateEmail
    if (!options.skipValidation) {
      const validation = validateEmail(emailData);
      
      if (!validation.isValid) {
        console.error('[EMAIL_SCHEDULER] Email validation failed', {
          emailFileName,
          emailId: emailData.id,
          errors: validation.errors
        });
        
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.EMAIL_VALIDATION_FAILED,
          message: `Email validation failed: ${emailFileName}`,
          details: {
            emailFileName,
            emailId: emailData.id,
            validationErrors: validation.errors
          }
        };
      }
    }
    
    // Requirement 1.8: Create game-data/emails/ directory if needed
    try {
      if (!fs.existsSync(emailsDestPath)) {
        fs.mkdirSync(emailsDestPath, { recursive: true });
        console.log('[EMAIL_SCHEDULER] Created emails directory', {
          path: emailsDestPath
        });
      }
    } catch (mkdirError) {
      console.error('[EMAIL_SCHEDULER] Failed to create emails directory', {
        path: emailsDestPath,
        error: mkdirError.message,
        code: mkdirError.code
      });
      
      // Requirement 10.3: Handle permission errors
      if (mkdirError.code === 'EACCES') {
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.FILE_PERMISSION_ERROR,
          message: `Permission denied creating emails directory`,
          details: {
            path: emailsDestPath,
            systemError: mkdirError.message
          }
        };
      }
      
      // Requirement 10.4: Handle disk space errors
      if (mkdirError.code === 'ENOSPC') {
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.DISK_SPACE_ERROR,
          message: `Insufficient disk space to create emails directory`,
          details: {
            path: emailsDestPath,
            systemError: mkdirError.message
          }
        };
      }
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
        message: `Failed to create emails directory`,
        details: {
          path: emailsDestPath,
          systemError: mkdirError.message
        }
      };
    }
    
    // Requirement 1.6: Handle file overwrite with warning log
    if (fs.existsSync(emailDestFilePath)) {
      console.warn('[EMAIL_SCHEDULER] Overwriting existing email file', {
        emailFileName,
        emailId: emailData.id,
        path: emailDestFilePath
      });
    }
    
    // Requirement 1.1: Copy file from emailsPending/ to game-data/emails/
    try {
      fs.copyFileSync(emailsPendingPath, emailDestFilePath);
      
      console.log('[EMAIL_SCHEDULER] Email sent successfully', {
        emailFileName,
        emailId: emailData.id,
        from: emailsPendingPath,
        to: emailDestFilePath
      });
      
      // Requirement 2.7: Trigger email-sent event
      systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SENT, {
        entityId: emailData.id,
        emailId: emailData.id,
        emailFileName,
        scheduleId: options.scheduleId || null,
        timestamp: Date.now(),
        source: 'emailScheduler'
      });
      
      // Requirement 1.2: Return success with emailId
      return {
        success: true,
        emailId: emailData.id,
        message: `Email sent successfully: ${emailFileName}`
      };
      
    } catch (copyError) {
      console.error('[EMAIL_SCHEDULER] Failed to copy email file', {
        emailFileName,
        emailId: emailData.id,
        error: copyError.message,
        code: copyError.code
      });
      
      // Requirement 10.3: Handle permission errors
      if (copyError.code === 'EACCES') {
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.FILE_PERMISSION_ERROR,
          message: `Permission denied copying email file: ${emailFileName}`,
          details: {
            emailFileName,
            emailId: emailData.id,
            systemError: copyError.message
          }
        };
      }
      
      // Requirement 10.4: Handle disk space errors
      if (copyError.code === 'ENOSPC') {
        return {
          success: false,
          error: EMAIL_SCHEDULING_ERROR_CODES.DISK_SPACE_ERROR,
          message: `Insufficient disk space to copy email file: ${emailFileName}`,
          details: {
            emailFileName,
            emailId: emailData.id,
            systemError: copyError.message
          }
        };
      }
      
      // Requirement 1.9: Handle file system errors
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
        message: `Failed to copy email file: ${emailFileName}`,
        details: {
          emailFileName,
          emailId: emailData.id,
          systemError: copyError.message
        }
      };
    }
    
  } catch (error) {
    // Requirement 10.6: Handle all errors gracefully without throwing exceptions
    console.error('[EMAIL_SCHEDULER] Unexpected error in sendEmail', {
      emailFileName,
      error: error.message,
      stack: error.stack
    });
    
    // Requirement 2.8: Trigger email-send-failed event
    systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SEND_FAILED, {
      entityId: options.scheduleId || emailFileName,
      scheduleId: options.scheduleId || null,
      emailFileName,
      error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
      message: `Unexpected error sending email: ${emailFileName}`,
      timestamp: Date.now(),
      source: 'emailScheduler'
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
      message: `Unexpected error sending email: ${emailFileName}`,
      details: {
        emailFileName,
        systemError: error.message
      }
    };
  }
}

// ============================================================================
// Email Scheduling
// ============================================================================

/**
 * Schedule an email for delayed delivery
 * Generates unique schedule ID, validates delay range, checks limits,
 * creates Schedule_Entry, stores in schedules Map, sets up timer
 * 
 * @param {string} emailFileName - Name of email file in emailsPending/
 * @param {number} delayMs - Delay in milliseconds (0-86400000)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.skipValidation - Skip validation (default: false)
 * @returns {Promise<Object>} Result with success flag and scheduleId or error
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.9, 11.3, 11.4
 */
export async function scheduleEmail(emailFileName, delayMs, options = {}) {
  try {
    // Requirement 2.4: Validate delay is within range (0-86400000ms)
    if (typeof delayMs !== 'number' || delayMs < 0 || delayMs > 86400000) {
      console.error('[EMAIL_SCHEDULER] Invalid delay duration', {
        emailFileName,
        delayMs,
        validRange: '0-86400000'
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.INVALID_DELAY,
        message: `Invalid delay duration: ${delayMs}. Must be between 0 and 86400000 milliseconds.`,
        details: {
          emailFileName,
          providedDelay: delayMs,
          validRange: { min: 0, max: 86400000 }
        }
      };
    }
    
    // Requirement 11.3, 11.4: Check maxScheduledEmails limit
    if (schedules.size >= config.maxScheduledEmails) {
      console.error('[EMAIL_SCHEDULER] Maximum scheduled emails exceeded', {
        emailFileName,
        currentCount: schedules.size,
        maxAllowed: config.maxScheduledEmails
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.MAX_SCHEDULED_EMAILS_EXCEEDED,
        message: `Maximum scheduled emails limit reached: ${config.maxScheduledEmails}`,
        details: {
          emailFileName,
          currentCount: schedules.size,
          maxAllowed: config.maxScheduledEmails
        }
      };
    }
    
    // Requirement 2.5: Handle zero-delay as immediate send
    if (delayMs === 0) {
      console.log('[EMAIL_SCHEDULER] Zero delay detected, sending email immediately', {
        emailFileName
      });
      
      const sendResult = await sendEmail(emailFileName, options);
      
      if (sendResult.success) {
        return {
          success: true,
          scheduleId: null, // No schedule ID for immediate send
          emailId: sendResult.emailId,
          message: `Email sent immediately: ${emailFileName}`,
          immediate: true
        };
      } else {
        return sendResult; // Return the error from sendEmail
      }
    }
    
    // Requirement 2.1: Generate unique schedule ID (UUID)
    const scheduleId = crypto.randomUUID();
    
    // Get current timestamp
    const now = Date.now();
    const sendAt = now + delayMs;
    
    // Requirement 2.1: Create Schedule_Entry object with metadata
    const scheduleEntry = {
      scheduleId,
      emailFileName,
      delayMs,
      scheduledAt: now,
      sendAt,
      status: 'pending',
      options: {
        skipValidation: options.skipValidation || false
      },
      metadata: {
        source: options.source || 'manual',
        eventType: options.eventType || null,
        entityId: options.entityId || null
      },
      timer: null // Will be set below
    };
    
    // Requirement 2.3: Set up setTimeout timer for delay
    // When timer expires, call sendEmail with the email file name
    const timer = setTimeout(async () => {
      console.log('[EMAIL_SCHEDULER] Timer expired, sending scheduled email', {
        scheduleId,
        emailFileName,
        delayMs
      });
      
      // Send the email (pass scheduleId in options for event emission)
      const sendResult = await sendEmail(emailFileName, { ...options, scheduleId });
      
      // Update schedule status based on send result
      const schedule = schedules.get(scheduleId);
      if (schedule) {
        if (sendResult.success) {
          schedule.status = 'sent';
          console.log('[EMAIL_SCHEDULER] Scheduled email sent successfully', {
            scheduleId,
            emailFileName,
            emailId: sendResult.emailId
          });
          // Note: email-sent event already emitted by sendEmail function
        } else {
          schedule.status = 'failed';
          console.error('[EMAIL_SCHEDULER] Scheduled email send failed', {
            scheduleId,
            emailFileName,
            error: sendResult.error,
            message: sendResult.message
          });
          
          // Requirement 2.8: Trigger email-send-failed event
          systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SEND_FAILED, {
            entityId: scheduleId,
            scheduleId,
            emailFileName,
            error: sendResult.error,
            message: sendResult.message,
            validationErrors: sendResult.details?.validationErrors || [],
            timestamp: Date.now(),
            source: 'emailScheduler'
          });
        }
        
        // Remove schedule from map after processing
        schedules.delete(scheduleId);
        
        // Requirement 8.6: Save state file after email sent successfully or failed
        const saveResult = await saveStateFile();
        if (!saveResult.success) {
          console.error('[EMAIL_SCHEDULER] Failed to save state file after sending email, continuing with in-memory state', {
            scheduleId,
            emailFileName,
            error: saveResult.error,
            message: saveResult.message
          });
          // Continue with in-memory state - don't fail the operation
        }
      }
    }, delayMs);
    
    // Store timer reference in the Schedule_Entry for later cancellation
    scheduleEntry.timer = timer;
    
    // Requirement 2.2: Store Schedule_Entry in schedules Map
    schedules.set(scheduleId, scheduleEntry);
    
    console.log('[EMAIL_SCHEDULER] Email scheduled successfully', {
      scheduleId,
      emailFileName,
      delayMs,
      sendAt: new Date(sendAt).toISOString(),
      currentScheduleCount: schedules.size
    });
    
    // Requirement 2.6: Trigger email-scheduled event
    systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_SCHEDULED, {
      entityId: scheduleId,
      scheduleId,
      emailFileName,
      delayMs,
      sendAt,
      timestamp: Date.now(),
      source: 'emailScheduler'
    });
    
    // Requirement 8.1: Save state file after creating schedule entry
    const saveResult = await saveStateFile();
    if (!saveResult.success) {
      console.error('[EMAIL_SCHEDULER] Failed to save state file after scheduling, continuing with in-memory state', {
        scheduleId,
        emailFileName,
        error: saveResult.error,
        message: saveResult.message
      });
      // Continue with in-memory state - don't fail the scheduling operation
    }
    
    // Requirement 2.9: Return success with scheduleId
    return {
      success: true,
      scheduleId,
      message: `Email scheduled successfully: ${emailFileName}`,
      details: {
        emailFileName,
        delayMs,
        scheduledAt: now,
        sendAt,
        scheduleId
      }
    };
    
  } catch (error) {
    // Handle all errors gracefully without throwing exceptions
    console.error('[EMAIL_SCHEDULER] Unexpected error in scheduleEmail', {
      emailFileName,
      delayMs,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
      message: `Unexpected error scheduling email: ${emailFileName}`,
      details: {
        emailFileName,
        delayMs,
        systemError: error.message
      }
    };
  }
}

/**
 * Cancel a scheduled email
 * Validates schedule ID exists, checks if already completed,
 * clears the timer, and removes the Schedule_Entry from schedules Map
 * 
 * @param {string} scheduleId - Schedule ID returned from scheduleEmail
 * @returns {Promise<Object>} Result with success flag or error
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
 */
export async function cancelScheduledEmail(scheduleId) {
  try {
    // Requirement 3.4: Validate schedule ID exists
    if (!schedules.has(scheduleId)) {
      console.error('[EMAIL_SCHEDULER] Schedule not found', {
        scheduleId
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.SCHEDULE_NOT_FOUND,
        message: `Schedule not found: ${scheduleId}`,
        details: {
          scheduleId
        }
      };
    }
    
    // Get the schedule entry
    const schedule = schedules.get(scheduleId);
    
    // Requirement 3.5: Check if schedule already completed
    if (schedule.status === 'sent' || schedule.status === 'failed') {
      console.error('[EMAIL_SCHEDULER] Schedule already completed', {
        scheduleId,
        status: schedule.status,
        emailFileName: schedule.emailFileName
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.SCHEDULE_ALREADY_COMPLETED,
        message: `Schedule already completed with status: ${schedule.status}`,
        details: {
          scheduleId,
          status: schedule.status,
          emailFileName: schedule.emailFileName
        }
      };
    }
    
    // Requirement 3.1: Clear setTimeout timer
    if (schedule.timer) {
      clearTimeout(schedule.timer);
      console.log('[EMAIL_SCHEDULER] Timer cleared for schedule', {
        scheduleId,
        emailFileName: schedule.emailFileName
      });
    }
    
    // Update status to cancelled
    schedule.status = 'cancelled';
    
    // Requirement 3.2: Remove Schedule_Entry from schedules Map
    schedules.delete(scheduleId);
    
    console.log('[EMAIL_SCHEDULER] Schedule cancelled successfully', {
      scheduleId,
      emailFileName: schedule.emailFileName,
      remainingSchedules: schedules.size
    });
    
    // Requirement 3.3: Trigger email-cancelled event
    systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_CANCELLED, {
      entityId: scheduleId,
      scheduleId,
      emailFileName: schedule.emailFileName,
      reason: 'manual',
      timestamp: Date.now(),
      source: 'emailScheduler'
    });
    
    // Requirement 8.6: Save state file after cancelScheduledEmail
    const saveResult = await saveStateFile();
    if (!saveResult.success) {
      console.error('[EMAIL_SCHEDULER] Failed to save state file after cancelling schedule, continuing with in-memory state', {
        scheduleId,
        emailFileName: schedule.emailFileName,
        error: saveResult.error,
        message: saveResult.message
      });
      // Continue with in-memory state - don't fail the cancellation operation
    }
    
    // Requirement 3.6: Return success status
    return {
      success: true,
      message: `Schedule cancelled successfully: ${scheduleId}`,
      details: {
        scheduleId,
        emailFileName: schedule.emailFileName,
        cancelledAt: Date.now()
      }
    };
    
  } catch (error) {
    // Handle all errors gracefully without throwing exceptions
    console.error('[EMAIL_SCHEDULER] Unexpected error in cancelScheduledEmail', {
      scheduleId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
      message: `Unexpected error cancelling schedule: ${scheduleId}`,
      details: {
        scheduleId,
        systemError: error.message
      }
    };
  }
}

// ============================================================================
// State Persistence
// ============================================================================

/**
 * Get the path to the state file
 * 
 * @returns {string} Full path to scheduled-emails.json
 */
function getStateFilePath() {
  const projectRoot = path.join(__dirname, '..', '..');
  
  // Read configuration to get gameDataDirectory
  const configPath = path.join(projectRoot, '.fenestra-config.json');
  let gameDataDir = './game-data';
  
  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const fullConfig = JSON.parse(configContent);
      gameDataDir = fullConfig.gameDataDirectory || './game-data';
    }
  } catch (configError) {
    console.warn('[EMAIL_SCHEDULER] Failed to read config for state file path, using default', {
      error: configError.message
    });
  }
  
  const stateDir = path.join(projectRoot, gameDataDir, 'state');
  return path.join(stateDir, config.stateFile);
}

/**
 * Load scheduled emails from state file
 * Reads scheduled-emails.json and returns the schedules array
 * Handles missing file gracefully by returning empty schedules
 * Handles corrupted JSON gracefully by logging warning, backing up file, and returning empty
 * 
 * @returns {Promise<Object>} Result with success flag and schedules array or error
 * 
 * Requirements: 8.2, 8.5
 */
export async function loadStateFile() {
  try {
    const stateFilePath = getStateFilePath();
    
    // Handle missing file gracefully - return empty schedules
    if (!fs.existsSync(stateFilePath)) {
      console.log('[EMAIL_SCHEDULER] State file not found, starting with empty schedules', {
        path: stateFilePath
      });
      
      return {
        success: true,
        schedules: [],
        message: 'No state file found, starting fresh'
      };
    }
    
    // Read state file
    let stateContent;
    try {
      stateContent = fs.readFileSync(stateFilePath, 'utf-8');
    } catch (readError) {
      console.error('[EMAIL_SCHEDULER] Failed to read state file', {
        path: stateFilePath,
        error: readError.message,
        code: readError.code
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_READ_ERROR,
        message: `Failed to read state file: ${readError.message}`,
        schedules: []
      };
    }
    
    // Parse JSON - handle corrupted JSON gracefully
    let stateData;
    try {
      stateData = JSON.parse(stateContent);
    } catch (parseError) {
      console.warn('[EMAIL_SCHEDULER] State file corrupted, backing up and starting fresh', {
        path: stateFilePath,
        error: parseError.message
      });
      
      // Backup corrupted file
      const backupPath = `${stateFilePath}.corrupted.${Date.now()}.bak`;
      try {
        fs.copyFileSync(stateFilePath, backupPath);
        console.log('[EMAIL_SCHEDULER] Corrupted state file backed up', {
          backupPath
        });
      } catch (backupError) {
        console.error('[EMAIL_SCHEDULER] Failed to backup corrupted state file', {
          error: backupError.message
        });
      }
      
      return {
        success: true,
        schedules: [],
        message: 'State file corrupted, backed up and starting fresh',
        warning: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_CORRUPTED
      };
    }
    
    // Validate state file schema
    if (!stateData || typeof stateData !== 'object' || !stateData.version || !Array.isArray(stateData.schedules)) {
      console.warn('[EMAIL_SCHEDULER] Invalid state file schema, starting fresh', {
        path: stateFilePath,
        hasVersion: stateData && !!stateData.version,
        hasSchedules: stateData && Array.isArray(stateData.schedules)
      });
      
      // Backup invalid file
      const backupPath = `${stateFilePath}.invalid.${Date.now()}.bak`;
      try {
        fs.copyFileSync(stateFilePath, backupPath);
        console.log('[EMAIL_SCHEDULER] Invalid state file backed up', {
          backupPath
        });
      } catch (backupError) {
        console.error('[EMAIL_SCHEDULER] Failed to backup invalid state file', {
          error: backupError.message
        });
      }
      
      return {
        success: true,
        schedules: [],
        message: 'Invalid state file schema, backed up and starting fresh',
        warning: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_CORRUPTED
      };
    }
    
    console.log('[EMAIL_SCHEDULER] State file loaded successfully', {
      path: stateFilePath,
      version: stateData.version,
      scheduleCount: stateData.schedules.length
    });
    
    return {
      success: true,
      schedules: stateData.schedules,
      version: stateData.version,
      lastUpdated: stateData.lastUpdated,
      message: `Loaded ${stateData.schedules.length} schedule(s) from state file`
    };
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Unexpected error loading state file', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_READ_ERROR,
      message: `Unexpected error loading state file: ${error.message}`,
      schedules: []
    };
  }
}

/**
 * Save scheduled emails to state file
 * Writes current schedules to scheduled-emails.json
 * Creates state directory if it doesn't exist
 * Handles write errors gracefully by logging error and continuing with in-memory state
 * 
 * @returns {Promise<Object>} Result with success flag or error
 * 
 * Requirements: 8.1, 8.6
 */
export async function saveStateFile() {
  try {
    // Skip if persistence is disabled
    if (!config.enablePersistence) {
      console.log('[EMAIL_SCHEDULER] State persistence disabled, skipping save');
      return {
        success: true,
        message: 'State persistence disabled'
      };
    }
    
    const stateFilePath = getStateFilePath();
    const stateDir = path.dirname(stateFilePath);
    
    // Create state directory if it doesn't exist
    try {
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
        console.log('[EMAIL_SCHEDULER] Created state directory', {
          path: stateDir
        });
      }
    } catch (mkdirError) {
      console.error('[EMAIL_SCHEDULER] Failed to create state directory', {
        path: stateDir,
        error: mkdirError.message
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_WRITE_ERROR,
        message: `Failed to create state directory: ${mkdirError.message}`
      };
    }
    
    // Convert schedules Map to array for serialization
    const schedulesArray = [];
    for (const [scheduleId, schedule] of schedules.entries()) {
      // Don't include the timer reference in the serialized data
      schedulesArray.push({
        scheduleId: schedule.scheduleId,
        emailFileName: schedule.emailFileName,
        delayMs: schedule.delayMs,
        scheduledAt: schedule.scheduledAt,
        sendAt: schedule.sendAt,
        status: schedule.status,
        options: schedule.options,
        metadata: schedule.metadata
      });
    }
    
    // Create state file data structure with version field
    const stateData = {
      version: '1.0.0',
      schedules: schedulesArray,
      lastUpdated: Date.now()
    };
    
    // Write to file
    try {
      const stateContent = JSON.stringify(stateData, null, 2);
      fs.writeFileSync(stateFilePath, stateContent, 'utf-8');
      
      console.log('[EMAIL_SCHEDULER] State file saved successfully', {
        path: stateFilePath,
        scheduleCount: schedulesArray.length
      });
      
      return {
        success: true,
        message: `Saved ${schedulesArray.length} schedule(s) to state file`
      };
      
    } catch (writeError) {
      console.error('[EMAIL_SCHEDULER] Failed to write state file', {
        path: stateFilePath,
        error: writeError.message,
        code: writeError.code
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_WRITE_ERROR,
        message: `Failed to write state file: ${writeError.message}`
      };
    }
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Unexpected error saving state file', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_WRITE_ERROR,
      message: `Unexpected error saving state file: ${error.message}`
    };
  }
}

/**
 * Delete state file
 * Used for new game cleanup to remove all scheduled email state
 * Handles missing file gracefully (no error if file doesn't exist)
 * 
 * @returns {Promise<Object>} Result with success flag or error
 * 
 * Requirements: 9.2
 */
export async function deleteStateFile() {
  try {
    const stateFilePath = getStateFilePath();
    
    // Handle missing file gracefully - not an error
    if (!fs.existsSync(stateFilePath)) {
      console.log('[EMAIL_SCHEDULER] State file does not exist, nothing to delete', {
        path: stateFilePath
      });
      
      return {
        success: true,
        message: 'State file does not exist'
      };
    }
    
    // Delete the file
    try {
      fs.unlinkSync(stateFilePath);
      
      console.log('[EMAIL_SCHEDULER] State file deleted successfully', {
        path: stateFilePath
      });
      
      return {
        success: true,
        message: 'State file deleted successfully'
      };
      
    } catch (deleteError) {
      console.error('[EMAIL_SCHEDULER] Failed to delete state file', {
        path: stateFilePath,
        error: deleteError.message,
        code: deleteError.code
      });
      
      return {
        success: false,
        error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_WRITE_ERROR,
        message: `Failed to delete state file: ${deleteError.message}`
      };
    }
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Unexpected error deleting state file', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.STATE_FILE_WRITE_ERROR,
      message: `Unexpected error deleting state file: ${error.message}`
    };
  }
}

/**
 * Recalculate remaining delay for a scheduled email
 * Calculates elapsed time since scheduledAt and returns remaining delay
 * Returns 0 for expired schedules (immediate send)
 * 
 * @param {Object} schedule - Schedule_Entry object with scheduledAt and delayMs
 * @returns {number} Remaining delay in milliseconds (0 if expired)
 * 
 * Requirements: 8.3, 8.4
 */
export function recalculateDelay(schedule) {
  const now = Date.now();
  const elapsed = now - schedule.scheduledAt;
  const remaining = schedule.delayMs - elapsed;
  
  // Requirement 8.4: Return 0 for expired schedules (immediate send)
  if (remaining <= 0) {
    console.log('[EMAIL_SCHEDULER] Schedule expired, will send immediately', {
      scheduleId: schedule.scheduleId,
      emailFileName: schedule.emailFileName,
      elapsed,
      delayMs: schedule.delayMs
    });
    return 0;
  }
  
  // Requirement 8.3: Return remaining delay for active schedules
  console.log('[EMAIL_SCHEDULER] Recalculated remaining delay', {
    scheduleId: schedule.scheduleId,
    emailFileName: schedule.emailFileName,
    elapsed,
    remaining,
    originalDelay: schedule.delayMs
  });
  
  return remaining;
}

/**
 * Clear all scheduled emails
 * Called by startMenuManager on new game to cancel all pending email schedules
 * Iterates through all schedules, cancels timers, and clears the schedules Map
 * 
 * @returns {Promise<Object>} Result with success flag, cancelledCount, and cancelledIds
 * 
 * Requirements: 9.1, 9.3
 */
export async function clearAllScheduledEmails() {
  try {
    const cancelledCount = schedules.size;
    const cancelledIds = [];
    
    console.log('[EMAIL_SCHEDULER] Clearing all scheduled emails', {
      count: cancelledCount
    });
    
    // Iterate through all schedules in Map
    for (const [scheduleId, schedule] of schedules.entries()) {
      // Cancel each timer with clearTimeout
      if (schedule.timer) {
        clearTimeout(schedule.timer);
        console.log('[EMAIL_SCHEDULER] Timer cleared for schedule', {
          scheduleId,
          emailFileName: schedule.emailFileName
        });
      }
      
      // Collect cancelled schedule IDs
      cancelledIds.push(scheduleId);
      
      // Requirement 9.4: Trigger email-cancelled event for each cancelled email
      systemEvents.emit(EMAIL_SCHEDULING_EVENTS.EMAIL_CANCELLED, {
        entityId: scheduleId,
        scheduleId,
        emailFileName: schedule.emailFileName,
        reason: 'new-game',
        timestamp: Date.now(),
        source: 'emailScheduler'
      });
    }
    
    // Clear schedules Map
    schedules.clear();
    
    // Delete state file
    await deleteStateFile();
    
    console.log('[EMAIL_SCHEDULER] All scheduled emails cleared', {
      cancelledCount,
      cancelledIds
    });
    
    // Return success with cancelledCount and cancelledIds
    return {
      success: true,
      cancelledCount,
      cancelledIds,
      message: `Cleared ${cancelledCount} scheduled email(s)`
    };
    
  } catch (error) {
    // Handle all errors gracefully without throwing exceptions
    console.error('[EMAIL_SCHEDULER] Unexpected error in clearAllScheduledEmails', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: EMAIL_SCHEDULING_ERROR_CODES.FILE_SYSTEM_ERROR,
      message: `Unexpected error clearing scheduled emails`,
      details: {
        systemError: error.message
      }
    };
  }
}

// ============================================================================
// Event-Driven Scheduling
// ============================================================================

/**
 * Map of event-driven schedule registrations
 * Key: registrationId (string)
 * Value: { eventType, emailConfig, options, listener }
 */
const eventRegistrations = new Map();

/**
 * Schedule email when a specific event occurs
 * Registers an event listener that schedules an email when the event is triggered
 * Supports one-time triggers (once: true) and repeating triggers
 * Supports entityId filtering to only trigger for specific entities
 * 
 * @param {string} eventType - Event type to listen for
 * @param {Object} emailConfig - Email configuration
 * @param {string} emailConfig.emailFileName - Email file name
 * @param {number} emailConfig.delayMs - Delay after event
 * @param {Object} options - Optional configuration
 * @param {boolean} options.once - Trigger only once (default: false)
 * @param {string} options.entityId - Filter by entity ID
 * @returns {string} Registration ID for unregistering
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export function scheduleEmailOnEvent(eventType, emailConfig, options = {}) {
  try {
    // Validate parameters
    if (!eventType || typeof eventType !== 'string') {
      throw new Error('eventType must be a non-empty string');
    }
    
    if (!emailConfig || typeof emailConfig !== 'object') {
      throw new Error('emailConfig must be an object');
    }
    
    if (!emailConfig.emailFileName || typeof emailConfig.emailFileName !== 'string') {
      throw new Error('emailConfig.emailFileName must be a non-empty string');
    }
    
    if (typeof emailConfig.delayMs !== 'number' || emailConfig.delayMs < 0) {
      throw new Error('emailConfig.delayMs must be a non-negative number');
    }
    
    // Requirement 7.4: Generate unique registration ID
    const registrationId = crypto.randomUUID();
    
    // Create event listener function
    const listener = async (eventData) => {
      try {
        // Requirement 7.5: Support entityId filtering via options
        if (options.entityId && eventData.entityId !== options.entityId) {
          // Skip this event - doesn't match the filter
          console.log('[EMAIL_SCHEDULER] Event skipped due to entityId filter', {
            eventType,
            expectedEntityId: options.entityId,
            actualEntityId: eventData.entityId,
            registrationId
          });
          return;
        }
        
        console.log('[EMAIL_SCHEDULER] Event-driven schedule triggered', {
          eventType,
          emailFileName: emailConfig.emailFileName,
          delayMs: emailConfig.delayMs,
          registrationId,
          eventData
        });
        
        // Requirement 7.5: Call scheduleEmail with the configured parameters
        const scheduleResult = await scheduleEmail(
          emailConfig.emailFileName,
          emailConfig.delayMs,
          {
            source: 'event-driven',
            eventType,
            entityId: eventData.entityId || null
          }
        );
        
        // Handle scheduling errors gracefully
        if (!scheduleResult.success) {
          console.error('[EMAIL_SCHEDULER] Event-driven scheduling failed', {
            eventType,
            emailFileName: emailConfig.emailFileName,
            error: scheduleResult.error,
            message: scheduleResult.message,
            registrationId
          });
        } else {
          console.log('[EMAIL_SCHEDULER] Event-driven email scheduled successfully', {
            eventType,
            emailFileName: emailConfig.emailFileName,
            scheduleId: scheduleResult.scheduleId,
            registrationId
          });
        }
        
        // Requirement 7.6: Support once option (unregister after first trigger)
        if (options.once) {
          console.log('[EMAIL_SCHEDULER] One-time trigger, unregistering listener', {
            eventType,
            registrationId
          });
          
          // Unregister the listener
          systemEvents.off(eventType, listener);
          
          // Remove from registrations map
          eventRegistrations.delete(registrationId);
        }
        
      } catch (error) {
        console.error('[EMAIL_SCHEDULER] Error in event-driven schedule listener', {
          eventType,
          emailFileName: emailConfig.emailFileName,
          registrationId,
          error: error.message,
          stack: error.stack
        });
      }
    };
    
    // Requirement 7.4: Register event listener on systemEvents
    systemEvents.on(eventType, listener);
    
    // Store registration for cleanup
    eventRegistrations.set(registrationId, {
      eventType,
      emailConfig,
      options,
      listener
    });
    
    console.log('[EMAIL_SCHEDULER] Event-driven schedule registered', {
      registrationId,
      eventType,
      emailFileName: emailConfig.emailFileName,
      delayMs: emailConfig.delayMs,
      once: options.once || false,
      entityId: options.entityId || null
    });
    
    // Return registration ID
    return registrationId;
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Failed to register event-driven schedule', {
      eventType,
      emailConfig,
      options,
      error: error.message,
      stack: error.stack
    });
    
    throw error; // Re-throw for caller to handle
  }
}

/**
 * Unregister an event-driven schedule
 * Removes the event listener and cleans up the registration
 * 
 * @param {string} registrationId - Registration ID returned from scheduleEmailOnEvent
 * @returns {boolean} Success status
 */
export function unregisterEventDrivenSchedule(registrationId) {
  try {
    // Check if registration exists
    if (!eventRegistrations.has(registrationId)) {
      console.warn('[EMAIL_SCHEDULER] Event registration not found', {
        registrationId
      });
      return false;
    }
    
    // Get registration
    const registration = eventRegistrations.get(registrationId);
    
    // Remove event listener
    systemEvents.off(registration.eventType, registration.listener);
    
    // Remove from registrations map
    eventRegistrations.delete(registrationId);
    
    console.log('[EMAIL_SCHEDULER] Event-driven schedule unregistered', {
      registrationId,
      eventType: registration.eventType,
      emailFileName: registration.emailConfig.emailFileName
    });
    
    return true;
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Failed to unregister event-driven schedule', {
      registrationId,
      error: error.message,
      stack: error.stack
    });
    
    return false;
  }
}

/**
 * Clear all event-driven schedule registrations
 * Used for cleanup or testing
 * 
 * @returns {number} Number of registrations cleared
 */
export function clearAllEventDrivenSchedules() {
  try {
    const count = eventRegistrations.size;
    
    console.log('[EMAIL_SCHEDULER] Clearing all event-driven schedules', {
      count
    });
    
    // Unregister all listeners
    for (const [registrationId, registration] of eventRegistrations.entries()) {
      systemEvents.off(registration.eventType, registration.listener);
      console.log('[EMAIL_SCHEDULER] Event listener removed', {
        registrationId,
        eventType: registration.eventType,
        emailFileName: registration.emailConfig.emailFileName
      });
    }
    
    // Clear registrations map
    eventRegistrations.clear();
    
    console.log('[EMAIL_SCHEDULER] All event-driven schedules cleared', {
      count
    });
    
    return count;
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Failed to clear event-driven schedules', {
      error: error.message,
      stack: error.stack
    });
    
    return 0;
  }
}

/**
 * Get all event-driven schedule registrations (for testing/debugging)
 * 
 * @returns {Map} Event registrations map
 */
export function getEventRegistrations() {
  return eventRegistrations;
}

// ============================================================================
// Configuration Parsing Functions
// ============================================================================

/**
 * Parse email schedule configuration from JSON
 * Validates required fields (emailFile, delay) and returns descriptive errors
 * 
 * @param {string} configJson - JSON configuration string
 * @returns {Object} Result with success flag and parsed config or error
 * 
 * Requirements: 12.1, 12.4, 12.5
 */
export function parseEmailScheduleConfig(configJson) {
  try {
    // Requirement 12.4: Return descriptive errors for invalid JSON
    if (typeof configJson !== 'string') {
      return {
        success: false,
        error: 'INVALID_CONFIG_FORMAT',
        message: 'Configuration must be a JSON string',
        details: {
          providedType: typeof configJson
        }
      };
    }
    
    // Parse JSON
    let config;
    try {
      config = JSON.parse(configJson);
    } catch (parseError) {
      return {
        success: false,
        error: 'INVALID_JSON',
        message: `Invalid JSON format: ${parseError.message}`,
        details: {
          parseError: parseError.message
        }
      };
    }
    
    // Handle null or non-object results from JSON.parse
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {
        success: false,
        error: 'INVALID_CONFIG_FORMAT',
        message: 'Configuration must be a JSON object',
        details: {
          parsedType: config === null ? 'null' : Array.isArray(config) ? 'array' : typeof config
        }
      };
    }
    
    // Requirement 12.5: Validate required fields (emailFile, delay)
    const errors = [];
    
    if (!config.emailFile || typeof config.emailFile !== 'string') {
      errors.push('Missing or invalid required field: emailFile (must be a non-empty string)');
    }
    
    if (config.delay === undefined || config.delay === null) {
      errors.push('Missing required field: delay');
    } else if (typeof config.delay !== 'number') {
      errors.push('Invalid field type: delay (must be a number)');
    } else if (config.delay < 0 || config.delay > 86400000) {
      errors.push('Invalid field value: delay (must be between 0 and 86400000 milliseconds)');
    }
    
    // Return descriptive errors for missing fields
    if (errors.length > 0) {
      return {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'Configuration validation failed',
        details: {
          errors,
          providedConfig: config
        }
      };
    }
    
    // Requirement 12.1: Return parsed configuration
    console.log('[EMAIL_SCHEDULER] Configuration parsed successfully', {
      emailFile: config.emailFile,
      delay: config.delay
    });
    
    return {
      success: true,
      config: {
        emailFile: config.emailFile,
        delay: config.delay,
        // Include optional fields if present
        skipValidation: config.skipValidation || false,
        metadata: config.metadata || {}
      },
      message: 'Configuration parsed successfully'
    };
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Unexpected error parsing configuration', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: 'PARSE_ERROR',
      message: `Unexpected error parsing configuration: ${error.message}`,
      details: {
        systemError: error.message
      }
    };
  }
}

/**
 * Format Schedule_Entry object to JSON string
 * Converts a Schedule_Entry object to a formatted JSON configuration string
 * 
 * @param {Object} scheduleEntry - Schedule_Entry object to format
 * @returns {Object} Result with success flag and formatted JSON string or error
 * 
 * Requirements: 12.2
 */
export function formatEmailScheduleConfig(scheduleEntry) {
  try {
    // Validate input
    if (!scheduleEntry || typeof scheduleEntry !== 'object') {
      return {
        success: false,
        error: 'INVALID_SCHEDULE_ENTRY',
        message: 'Schedule entry must be an object',
        details: {
          providedType: typeof scheduleEntry
        }
      };
    }
    
    // Validate required fields
    if (!scheduleEntry.emailFileName || typeof scheduleEntry.emailFileName !== 'string') {
      return {
        success: false,
        error: 'MISSING_EMAIL_FILE_NAME',
        message: 'Schedule entry must have emailFileName field',
        details: {
          scheduleEntry
        }
      };
    }
    
    if (scheduleEntry.delayMs === undefined || scheduleEntry.delayMs === null || typeof scheduleEntry.delayMs !== 'number') {
      return {
        success: false,
        error: 'MISSING_DELAY',
        message: 'Schedule entry must have delayMs field',
        details: {
          scheduleEntry
        }
      };
    }
    
    // Requirement 12.2: Convert Schedule_Entry to JSON configuration format
    const config = {
      emailFile: scheduleEntry.emailFileName,
      delay: scheduleEntry.delayMs,
      skipValidation: scheduleEntry.options?.skipValidation || false,
      metadata: scheduleEntry.metadata || {}
    };
    
    // Format with proper indentation
    const configJson = JSON.stringify(config, null, 2);
    
    console.log('[EMAIL_SCHEDULER] Schedule entry formatted successfully', {
      emailFile: config.emailFile,
      delay: config.delay
    });
    
    return {
      success: true,
      configJson,
      message: 'Schedule entry formatted successfully'
    };
    
  } catch (error) {
    console.error('[EMAIL_SCHEDULER] Unexpected error formatting schedule entry', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: 'FORMAT_ERROR',
      message: `Unexpected error formatting schedule entry: ${error.message}`,
      details: {
        systemError: error.message
      }
    };
  }
}
