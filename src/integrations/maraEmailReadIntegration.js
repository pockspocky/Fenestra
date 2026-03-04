/**
 * Mara Email Read Integration
 * 
 * Integrates the email read event with the email scheduling system to send
 * a follow-up email from Pakk Quin after Mara's welcome email is read.
 * Configuration is read from .fenestra-config.json under emailFollowUp section.
 */

import { scheduleEmail } from '../systems/emailScheduler.js';
import { domainEvents, EMAIL_EVENTS } from '../events/domainEvents.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  enabled: true,
  triggerEmailId: 'email-001',
  followUpEmailFile: 'pakk-quin-followup.json',
  delayMs: 2000
};

/**
 * Store registration ID for cleanup
 */
let registrationId = null;

/**
 * Load email follow-up configuration from .fenestra-config.json
 * 
 * @returns {Object} Configuration object with enabled, triggerEmailId, followUpEmailFile, delayMs
 */
function loadEmailFollowUpConfig() {
  try {
    // Find the config file (go up from src/integrations/ to project root)
    const configPath = path.join(__dirname, '..', '..', '.fenestra-config.json');
    
    if (!fs.existsSync(configPath)) {
      console.warn('[MARA_EMAIL_READ] Configuration file not found, using defaults');
      return { ...DEFAULT_CONFIG };
    }
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const fullConfig = JSON.parse(configContent);
    
    // Extract emailFollowUp section
    const emailFollowUpConfig = fullConfig.emailFollowUp || {};
    
    // Merge with defaults
    const config = {
      enabled: emailFollowUpConfig.enabled !== undefined ? emailFollowUpConfig.enabled : DEFAULT_CONFIG.enabled,
      triggerEmailId: emailFollowUpConfig.triggerEmailId || DEFAULT_CONFIG.triggerEmailId,
      followUpEmailFile: emailFollowUpConfig.followUpEmailFile || DEFAULT_CONFIG.followUpEmailFile,
      delayMs: emailFollowUpConfig.delayMs !== undefined ? emailFollowUpConfig.delayMs : DEFAULT_CONFIG.delayMs
    };
    
    console.log('[MARA_EMAIL_READ] Configuration loaded', config);
    return config;
    
  } catch (error) {
    console.error('[MARA_EMAIL_READ] Failed to load configuration, using defaults', {
      error: error.message
    });
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Initialize Mara email read integration
 * 
 * Sets up event listener to schedule Pakk Quin follow-up email when
 * Mara's welcome email is marked as read. Configuration is read from
 * .fenestra-config.json under emailFollowUp section.
 * 
 * Configuration options:
 * - enabled: Whether the integration is enabled (default: true)
 * - triggerEmailId: Email ID that triggers the follow-up (default: 'email-001')
 * - followUpEmailFile: Follow-up email file name (default: 'pakk-quin-followup.json')
 * - delayMs: Delay in milliseconds before sending (default: 2000)
 * 
 * @returns {Object} Result with success flag and registration ID or skip reason
 */
export function initializeMaraEmailReadIntegration() {
  console.log('[MARA_EMAIL_READ] Initializing Mara email read integration');

  try {
    // Load configuration
    const config = loadEmailFollowUpConfig();
    
    // Check if integration is enabled
    if (!config.enabled) {
      console.log('[MARA_EMAIL_READ] Integration disabled in configuration');
      return {
        success: true,
        skipped: true,
        reason: 'Integration disabled in configuration'
      };
    }
    
    // Validate configuration
    if (!config.triggerEmailId || typeof config.triggerEmailId !== 'string') {
      console.error('[MARA_EMAIL_READ] Invalid triggerEmailId in configuration', {
        triggerEmailId: config.triggerEmailId
      });
      return {
        success: false,
        error: 'Invalid triggerEmailId in configuration'
      };
    }
    
    if (!config.followUpEmailFile || typeof config.followUpEmailFile !== 'string') {
      console.error('[MARA_EMAIL_READ] Invalid followUpEmailFile in configuration', {
        followUpEmailFile: config.followUpEmailFile
      });
      return {
        success: false,
        error: 'Invalid followUpEmailFile in configuration'
      };
    }
    
    if (typeof config.delayMs !== 'number' || config.delayMs < 0) {
      console.error('[MARA_EMAIL_READ] Invalid delayMs in configuration', {
        delayMs: config.delayMs
      });
      return {
        success: false,
        error: 'Invalid delayMs in configuration'
      };
    }
    
    // Flag to ensure we only trigger once
    let hasTriggered = false;
    
    // Create event listener for email:read event
    const listener = async (eventData) => {
      try {
        console.log('[MARA_EMAIL_READ] Email read event received', {
          entityId: eventData.entityId,
          expectedEntityId: config.triggerEmailId,
          eventData
        });
        
        // Filter by entityId (email ID)
        if (eventData.entityId !== config.triggerEmailId) {
          console.log('[MARA_EMAIL_READ] Event skipped - different email', {
            receivedId: eventData.entityId,
            expectedId: config.triggerEmailId
          });
          return;
        }
        
        // Ensure we only trigger once
        if (hasTriggered) {
          console.log('[MARA_EMAIL_READ] Event skipped - already triggered');
          return;
        }
        
        hasTriggered = true;
        
        console.log('[MARA_EMAIL_READ] Trigger email read, scheduling follow-up', {
          triggerEmailId: config.triggerEmailId,
          followUpEmailFile: config.followUpEmailFile,
          delayMs: config.delayMs
        });
        
        // Schedule the follow-up email
        const scheduleResult = await scheduleEmail(
          config.followUpEmailFile,
          config.delayMs,
          {
            source: 'email-follow-up',
            eventType: EMAIL_EVENTS.READ,
            entityId: config.triggerEmailId
          }
        );
        
        if (scheduleResult.success) {
          console.log('[MARA_EMAIL_READ] Follow-up email scheduled successfully', {
            scheduleId: scheduleResult.scheduleId,
            followUpEmailFile: config.followUpEmailFile,
            delayMs: config.delayMs
          });
          
          // Unregister listener after successful scheduling
          domainEvents.off(registrationId);
          console.log('[MARA_EMAIL_READ] Listener unregistered after successful trigger');
        } else {
          console.error('[MARA_EMAIL_READ] Failed to schedule follow-up email', {
            error: scheduleResult.error,
            message: scheduleResult.message
          });
          hasTriggered = false; // Allow retry on failure
        }
        
      } catch (error) {
        console.error('[MARA_EMAIL_READ] Error in email read listener', {
          error: error.message,
          stack: error.stack
        });
        hasTriggered = false; // Allow retry on error
      }
    };
    
    // Register listener on domainEvents (not systemEvents!)
    registrationId = domainEvents.on(EMAIL_EVENTS.READ, listener);

    console.log('[MARA_EMAIL_READ] Follow-up email listener registered', { 
      registrationId,
      triggerEvent: EMAIL_EVENTS.READ,
      triggerEmailId: config.triggerEmailId,
      followUpEmailFile: config.followUpEmailFile,
      delayMs: config.delayMs
    });

    return {
      success: true,
      registrationId,
      config
    };
  } catch (error) {
    console.error('[MARA_EMAIL_READ] Failed to initialize email integration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
