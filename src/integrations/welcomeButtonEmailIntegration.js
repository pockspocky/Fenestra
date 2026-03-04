/**
 * Welcome Button Email Integration
 * 
 * Integrates the welcome button with the email scheduling system to send
 * a follow-up email from Pakk Quin after the configured delay.
 */

import { scheduleEmailOnEvent } from '../systems/emailScheduler.js';
import { getEmailSystemConfig } from '../core/config.js';

/**
 * Initialize welcome button email integration
 * 
 * Sets up event listener to schedule Pakk Quin follow-up email when
 * the welcome button is clicked. The email is scheduled with the configured
 * delay and only triggers once.
 * 
 * @returns {Object} Result with success flag and registration ID
 */
export function initializeWelcomeButtonEmailIntegration() {
  console.log('[WELCOME_EMAIL] Initializing welcome button email integration');

  try {
    const emailConfig = getEmailSystemConfig();
    const delay = emailConfig.welcomeButtonDelay;
    
    // Schedule email when welcome button is clicked
    const registrationId = scheduleEmailOnEvent(
      'welcome:button:clicked',
      {
        emailFileName: 'pakk-quin-followup.json',
        delayMs: delay
      },
      {
        once: true  // Only send once
      }
    );

    console.log('[WELCOME_EMAIL] Email scheduling registered', { 
      registrationId,
      delay: delay
    });

    return {
      success: true,
      registrationId
    };
  } catch (error) {
    console.error('[WELCOME_EMAIL] Failed to initialize email integration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
