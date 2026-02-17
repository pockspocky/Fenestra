// Demo Script - Demonstrates external JavaScript loading via relative path
// This file is loaded from welcome-with-assets.html

console.log('External script loaded: scripts/demo.js');
console.log('This demonstrates that external scripts can be loaded using relative paths');

// Add some interactive functionality
(function() {
  'use strict';
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    console.log('Demo script initialized');
    
    // Add a visual indicator that the script loaded
    addScriptLoadedIndicator();
    
    // Add keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Log environment information
    logEnvironmentInfo();
  }
  
  function addScriptLoadedIndicator() {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #4caf50;
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    indicator.textContent = '✓ External script loaded';
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(indicator);
    
    // Remove after 3 seconds
    setTimeout(() => {
      indicator.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => indicator.remove(), 300);
    }, 3000);
  }
  
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + I: Log information
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        console.log('=== Email Template Information ===');
        console.log('Template: welcome-with-assets.html');
        console.log('Assets loaded:', {
          images: document.querySelectorAll('img').length,
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
        });
        console.log('================================');
      }
    });
    
    console.log('Keyboard shortcuts enabled: Ctrl/Cmd + I for info');
  }
  
  function logEnvironmentInfo() {
    console.log('=== Environment Information ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Viewport:', {
      width: window.innerWidth,
      height: window.innerHeight
    });
    console.log('Document:', {
      title: document.title,
      readyState: document.readyState
    });
    console.log('==============================');
  }
  
  // Export some utility functions to global scope
  window.emailTemplateUtils = {
    logInfo: function() {
      console.log('Email template utilities available');
      console.log('Available functions: logInfo, highlightAssets, getAssetCount');
    },
    
    highlightAssets: function() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.style.border = '2px solid #4caf50';
        setTimeout(() => {
          img.style.border = 'none';
        }, 2000);
      });
      console.log(`Highlighted ${images.length} assets`);
    },
    
    getAssetCount: function() {
      return {
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script').length,
        stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length
      };
    }
  };
  
  console.log('Email template utilities available via window.emailTemplateUtils');
})();
