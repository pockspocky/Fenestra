/**
 * Layout Engine for Window Positioning
 * 
 * Provides intelligent window positioning strategies to prevent overlap,
 * optimize screen usage, and implement various layout patterns.
 */

export class LayoutEngine {
  constructor(options = {}) {
    this.strategies = new Map();
    this.screenInfo = null;
    this.logger = options.logger;
    
    // Register default strategies
    this._registerDefaultStrategies();
  }

  /**
   * Register a positioning strategy
   * @param {string} name - Strategy name
   * @param {Function} strategy - Strategy function
   */
  registerStrategy(name, strategy) {
    this.strategies.set(name, strategy);
    
    if (this.logger) {
      this.logger.debug('Layout strategy registered', {
        operation: 'registerStrategy',
        strategyName: name,
        totalStrategies: this.strategies.size
      });
    }
  }

  /**
   * Apply a layout strategy to position a window
   * @param {string} strategyName - Name of the strategy to use
   * @param {WindowConfig} windowConfig - Window configuration
   * @param {WindowWrapper[]} existingWindows - Array of existing windows
   * @param {Object} screenInfo - Screen information
   * @returns {Promise<Object>} Calculated position {x, y}
   */
  async applyStrategy(strategyName, windowConfig, existingWindows = [], screenInfo = null) {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Layout strategy '${strategyName}' not found`);
    }

    // Update screen info if provided
    if (screenInfo) {
      this.screenInfo = screenInfo;
    }

    // Ensure we have screen info
    if (!this.screenInfo) {
      this.screenInfo = this._getDefaultScreenInfo();
    }

    const startTime = Date.now();
    
    try {
      const position = await strategy({
        windowConfig,
        existingWindows,
        screenInfo: this.screenInfo,
        layoutEngine: this
      });

      const duration = Date.now() - startTime;
      
      if (this.logger) {
        this.logger.debug('Layout strategy applied', {
          operation: 'applyStrategy',
          strategyName,
          windowId: windowConfig.id,
          position,
          duration: `${duration}ms`,
          existingWindowCount: existingWindows.length
        });
      }

      return position;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Layout strategy failed', {
          operation: 'applyStrategy',
          strategyName,
          windowId: windowConfig.id,
          error: error.message,
          fallbackStrategy: 'center'
        });
      }

      // Fallback to center strategy
      return this.applyStrategy('center', windowConfig, existingWindows, screenInfo);
    }
  }

  /**
   * Calculate optimal position to minimize overlap
   * @param {WindowConfig} windowConfig - Window configuration
   * @param {WindowWrapper[]} existingWindows - Array of existing windows
   * @returns {Promise<Object>} Optimal position {x, y}
   */
  async calculateOptimalPosition(windowConfig, existingWindows = []) {
    return this.applyStrategy('optimal', windowConfig, existingWindows);
  }

  /**
   * Check if a position would cause excessive overlap
   * @param {Object} bounds - Window bounds {x, y, width, height}
   * @param {WindowWrapper[]} existingWindows - Array of existing windows
   * @param {number} maxOverlapRatio - Maximum allowed overlap ratio (0-1)
   * @returns {Promise<Object>} Overlap analysis {hasExcessiveOverlap, overlaps}
   */
  async checkOverlap(bounds, existingWindows = [], maxOverlapRatio = 0.4) {
    const overlaps = [];
    let hasExcessiveOverlap = false;

    for (const window of existingWindows) {
      try {
        const existingBounds = await window.getBounds();
        const overlapRatio = this._calculateOverlapRatio(bounds, existingBounds);
        
        if (overlapRatio > 0) {
          overlaps.push({
            windowId: window.getId(),
            ratio: overlapRatio,
            excessive: overlapRatio > maxOverlapRatio
          });
          
          if (overlapRatio > maxOverlapRatio) {
            hasExcessiveOverlap = true;
          }
        }
      } catch (error) {
        // Skip windows that can't provide bounds (might be destroyed)
        continue;
      }
    }

    return { hasExcessiveOverlap, overlaps };
  }

  /**
   * Get available strategies
   * @returns {string[]} Array of strategy names
   */
  getAvailableStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Update screen information
   * @param {Object} screenInfo - New screen information
   */
  updateScreenInfo(screenInfo) {
    this.screenInfo = screenInfo;
    
    if (this.logger) {
      this.logger.debug('Screen info updated', {
        operation: 'updateScreenInfo',
        screenInfo
      });
    }
  }

  /**
   * Register default positioning strategies
   * @private
   */
  _registerDefaultStrategies() {
    // Center strategy - position window in center of screen
    this.registerStrategy('center', ({ windowConfig, screenInfo }) => {
      const x = Math.round((screenInfo.width - windowConfig.width) / 2);
      const y = Math.round((screenInfo.height - windowConfig.height) / 2);
      return { x, y };
    });

    // Cascade strategy - offset each new window from previous ones
    this.registerStrategy('cascade', ({ windowConfig, existingWindows, screenInfo }) => {
      const offset = 30;
      const baseX = 100;
      const baseY = 100;
      
      let x = baseX;
      let y = baseY;
      
      // Calculate cascade position based on existing windows
      const cascadeCount = existingWindows.length;
      x += cascadeCount * offset;
      y += cascadeCount * offset;
      
      // Wrap around if we go off screen
      if (x + windowConfig.width > screenInfo.width) {
        x = baseX;
      }
      if (y + windowConfig.height > screenInfo.height) {
        y = baseY;
      }
      
      return { x, y };
    });

    // Optimal strategy - find position with minimal overlap
    this.registerStrategy('optimal', async ({ windowConfig, existingWindows, screenInfo, layoutEngine }) => {
      const { width, height } = windowConfig;
      const maxAttempts = 50;
      const gridSize = 50;
      
      let bestPosition = { x: 100, y: 100 };
      let minOverlap = Infinity;
      
      // Try grid-based positions
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let x, y;
        
        if (attempt < 20) {
          // Grid-based positioning
          const cols = Math.floor(screenInfo.width / gridSize);
          const gridX = attempt % cols;
          const gridY = Math.floor(attempt / cols);
          x = gridX * gridSize;
          y = gridY * gridSize;
        } else {
          // Random positioning for remaining attempts
          x = Math.random() * (screenInfo.width - width);
          y = Math.random() * (screenInfo.height - height);
        }
        
        // Ensure window stays on screen
        x = Math.max(0, Math.min(x, screenInfo.width - width));
        y = Math.max(0, Math.min(y, screenInfo.height - height));
        
        const bounds = { x, y, width, height };
        const { overlaps } = await layoutEngine.checkOverlap(bounds, existingWindows, 1.0);
        
        // Calculate total overlap score
        const totalOverlap = overlaps.reduce((sum, overlap) => sum + overlap.ratio, 0);
        
        if (totalOverlap < minOverlap) {
          minOverlap = totalOverlap;
          bestPosition = { x, y };
          
          // If we found a position with no overlap, use it
          if (totalOverlap === 0) {
            break;
          }
        }
      }
      
      return bestPosition;
    });

    // Manual strategy - use provided coordinates or defaults
    this.registerStrategy('manual', ({ windowConfig }) => {
      return {
        x: windowConfig.x ?? 100,
        y: windowConfig.y ?? 100
      };
    });

    // Smart strategy - combines multiple approaches
    this.registerStrategy('smart', async ({ windowConfig, existingWindows, screenInfo, layoutEngine }) => {
      // If position is manually specified, use it
      if (windowConfig.x !== undefined && windowConfig.y !== undefined) {
        return layoutEngine.applyStrategy('manual', windowConfig, existingWindows, screenInfo);
      }
      
      // If no existing windows, center it
      if (existingWindows.length === 0) {
        return layoutEngine.applyStrategy('center', windowConfig, existingWindows, screenInfo);
      }
      
      // For few windows, use cascade
      if (existingWindows.length < 5) {
        return layoutEngine.applyStrategy('cascade', windowConfig, existingWindows, screenInfo);
      }
      
      // For many windows, use optimal positioning
      return layoutEngine.applyStrategy('optimal', windowConfig, existingWindows, screenInfo);
    });
  }

  /**
   * Calculate overlap ratio between two rectangles
   * @private
   */
  _calculateOverlapRatio(rect1, rect2) {
    const x1 = Math.max(rect1.x, rect2.x);
    const y1 = Math.max(rect1.y, rect2.y);
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);
    
    const interWidth = Math.max(0, x2 - x1);
    const interHeight = Math.max(0, y2 - y1);
    const interArea = interWidth * interHeight;
    
    if (interArea <= 0) {
      return 0;
    }
    
    const rect1Area = rect1.width * rect1.height;
    const rect2Area = rect2.width * rect2.height;
    const minArea = Math.min(rect1Area, rect2Area);
    
    return interArea / minArea;
  }

  /**
   * Get default screen information
   * @private
   */
  _getDefaultScreenInfo() {
    return {
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      scaleFactor: 1.0
    };
  }
}