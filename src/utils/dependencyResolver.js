/**
 * Circular Dependency Resolver
 * 
 * Provides tools for detecting and resolving circular dependencies in the module system.
 * Uses dependency graph analysis and proxy patterns to break circular references.
 * 
 * @module dependencyResolver
 */

import fs from 'node:fs';
import path from 'node:path';
import '../../logger.js';

/**
 * Circular Dependency Resolver class
 */
export class CircularDependencyResolver {
  constructor() {
    // Dependency graph: module -> Set of dependencies
    this.dependencyGraph = new Map();
    
    // Reverse dependency graph: module -> Set of dependents
    this.reverseDependencyGraph = new Map();
    
    // Detected circular dependencies
    this.circularDependencies = new Set();
    
    // Proxy objects for breaking circular references
    this.proxyObjects = new Map();
    
    // Lazy loading registry
    this.lazyLoaders = new Map();
    
    // Module cache for analysis
    this.moduleCache = new Map();
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Analyze dependencies in a directory
   * @param {string} rootDir - Root directory to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis result
   */
  analyzeDependencies(rootDir = 'src', options = {}) {
    const {
      extensions = ['.js', '.mjs', '.ts'],
      excludePatterns = ['node_modules', '.git', 'test', 'tests'],
      includeRelativeOnly = true
    } = options;

    console.log(`[DEPENDENCY_RESOLVER] Starting dependency analysis in ${rootDir}`);

    // Clear previous analysis
    this.dependencyGraph.clear();
    this.reverseDependencyGraph.clear();
    this.circularDependencies.clear();
    this.moduleCache.clear();

    try {
      // Find all module files
      const moduleFiles = this._findModuleFiles(rootDir, extensions, excludePatterns);
      console.log(`[DEPENDENCY_RESOLVER] Found ${moduleFiles.length} module files`);

      // Parse each module for dependencies
      for (const filePath of moduleFiles) {
        this._parseModuleDependencies(filePath, includeRelativeOnly);
      }

      // Detect circular dependencies
      const cycles = this._detectAllCycles();

      // Generate analysis report
      const report = {
        totalModules: moduleFiles.length,
        totalDependencies: this._getTotalDependencyCount(),
        circularDependencies: cycles,
        dependencyGraph: this._serializeDependencyGraph(),
        analysis: {
          mostDependentModules: this._getMostDependentModules(5),
          mostDependedOnModules: this._getMostDependedOnModules(5),
          isolatedModules: this._getIsolatedModules()
        }
      };

      console.log(`[DEPENDENCY_RESOLVER] Analysis complete: ${cycles.length} circular dependencies found`);
      return { success: true, report };

    } catch (error) {
      console.error('[DEPENDENCY_RESOLVER] Analysis failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect circular dependencies starting from a specific module
   * @param {string} startModule - Module to start detection from
   * @returns {Array} Array of detected cycles
   */
  detectCircularDependencies(startModule) {
    console.log(`[DEPENDENCY_RESOLVER] Detecting cycles from ${startModule}`);

    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (module, path = []) => {
      if (recursionStack.has(module)) {
        // Found a cycle
        const cycleStart = path.indexOf(module);
        const cycle = path.slice(cycleStart).concat([module]);
        cycles.push(cycle);
        console.log(`[DEPENDENCY_RESOLVER] Cycle detected: ${cycle.join(' -> ')}`);
        return;
      }

      if (visited.has(module)) {
        return;
      }

      visited.add(module);
      recursionStack.add(module);
      path.push(module);

      const dependencies = this.dependencyGraph.get(module) || new Set();
      for (const dependency of dependencies) {
        dfs(dependency, [...path]);
      }

      recursionStack.delete(module);
    };

    dfs(startModule);
    return cycles;
  }

  /**
   * Resolve circular dependency using proxy pattern
   * @param {Array} cycle - Circular dependency cycle
   * @returns {Object} Resolution result
   */
  resolveCircularDependency(cycle) {
    console.log(`[DEPENDENCY_RESOLVER] Resolving cycle: ${cycle.join(' -> ')}`);

    try {
      // Identify the best module to break the cycle at
      const breakPoint = this._findOptimalBreakPoint(cycle);
      console.log(`[DEPENDENCY_RESOLVER] Breaking cycle at: ${breakPoint.module} -> ${breakPoint.dependency}`);

      // Create proxy for the dependency
      const proxyResult = this.createDependencyProxy(breakPoint.dependency);
      
      if (!proxyResult.success) {
        return { success: false, error: proxyResult.error };
      }

      // Store resolution information
      const resolutionId = `${breakPoint.module}->${breakPoint.dependency}`;
      this.circularDependencies.add(resolutionId);

      return {
        success: true,
        breakPoint,
        proxyId: proxyResult.proxyId,
        message: `Circular dependency resolved using proxy pattern`
      };

    } catch (error) {
      console.error('[DEPENDENCY_RESOLVER] Resolution failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a proxy object to break circular references
   * @param {string} modulePath - Module to create proxy for
   * @returns {Object} Proxy creation result
   */
  createDependencyProxy(modulePath) {
    console.log(`[DEPENDENCY_RESOLVER] Creating proxy for ${modulePath}`);

    try {
      const proxyId = `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a proxy object that will be populated later
      const proxyObject = new Proxy({}, {
        get(target, prop) {
          // Lazy load the actual module when properties are accessed
          if (!target._resolved) {
            try {
              // Use dynamic import for ES modules
              import(modulePath).then(actualModule => {
                Object.assign(target, actualModule);
                target._resolved = true;
                console.log(`[DEPENDENCY_RESOLVER] Proxy ${proxyId} resolved for ${modulePath}`);
              }).catch(error => {
                console.error(`[DEPENDENCY_RESOLVER] Failed to resolve proxy ${proxyId}:`, error);
                target._resolveError = error;
              });
              
              // Return a placeholder for immediate access
              if (prop === '_resolved') return false;
              if (prop === '_resolving') return true;
              return undefined;
            } catch (error) {
              console.error(`[DEPENDENCY_RESOLVER] Failed to resolve proxy ${proxyId}:`, error);
              throw error;
            }
          }
          
          return target[prop];
        },
        
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
        
        has(target, prop) {
          if (!target._resolved) {
            // For 'has' checks, return false for unresolved modules
            return prop === '_resolved' || prop === '_resolving';
          }
          return prop in target;
        }
      });

      // Store the proxy
      this.proxyObjects.set(proxyId, {
        proxy: proxyObject,
        modulePath,
        createdAt: Date.now()
      });

      console.log(`[DEPENDENCY_RESOLVER] Proxy ${proxyId} created for ${modulePath}`);
      return { success: true, proxyId, proxy: proxyObject };

    } catch (error) {
      console.error('[DEPENDENCY_RESOLVER] Proxy creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start real-time dependency monitoring
   * @param {Object} options - Monitoring options
   */
  monitorDependencyChanges(options = {}) {
    const { interval = 30000, rootDir = 'src' } = options;

    if (this.isMonitoring) {
      console.warn('[DEPENDENCY_RESOLVER] Monitoring already active');
      return;
    }

    console.log(`[DEPENDENCY_RESOLVER] Starting dependency monitoring (interval: ${interval}ms)`);
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      try {
        const result = this.analyzeDependencies(rootDir);
        
        if (result.success && result.report.circularDependencies.length > 0) {
          console.warn(`[DEPENDENCY_RESOLVER] Monitoring detected ${result.report.circularDependencies.length} circular dependencies`);
          
          // Auto-resolve if configured
          if (options.autoResolve) {
            for (const cycle of result.report.circularDependencies) {
              this.resolveCircularDependency(cycle);
            }
          }
        }
      } catch (error) {
        console.error('[DEPENDENCY_RESOLVER] Monitoring error:', error);
      }
    }, interval);
  }

  /**
   * Stop dependency monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      console.log('[DEPENDENCY_RESOLVER] Dependency monitoring stopped');
    }
  }

  /**
   * Generate dependency report
   * @returns {Object} Comprehensive dependency report
   */
  generateDependencyReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalModules: this.dependencyGraph.size,
        totalDependencies: this._getTotalDependencyCount(),
        circularDependencies: this.circularDependencies.size,
        proxyObjects: this.proxyObjects.size
      },
      circularDependencies: Array.from(this.circularDependencies),
      dependencyGraph: this._serializeDependencyGraph(),
      proxyObjects: this._serializeProxyObjects(),
      analysis: {
        mostDependentModules: this._getMostDependentModules(10),
        mostDependedOnModules: this._getMostDependedOnModules(10),
        isolatedModules: this._getIsolatedModules(),
        dependencyDepth: this._calculateDependencyDepth()
      }
    };

    console.log('[DEPENDENCY_RESOLVER] Generated dependency report');
    return report;
  }

  // Private helper methods

  /**
   * Find all module files in a directory
   * @private
   */
  _findModuleFiles(rootDir, extensions, excludePatterns) {
    const files = [];
    
    const scanDirectory = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          // Skip excluded patterns
          if (excludePatterns.some(pattern => fullPath.includes(pattern))) {
            continue;
          }
          
          if (entry.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`[DEPENDENCY_RESOLVER] Cannot scan directory ${dir}:`, error.message);
      }
    };

    scanDirectory(rootDir);
    return files;
  }

  /**
   * Parse module dependencies from file content
   * @private
   */
  _parseModuleDependencies(filePath, includeRelativeOnly = true) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dependencies = new Set();

      // Regular expressions for different import patterns
      const importPatterns = [
        /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g,
        /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
        /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
      ];

      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          
          // Skip if we only want relative imports and this isn't one
          if (includeRelativeOnly && !importPath.startsWith('.')) {
            continue;
          }
          
          // Resolve relative paths
          let resolvedPath = importPath;
          if (importPath.startsWith('.')) {
            resolvedPath = path.resolve(path.dirname(filePath), importPath);
            // Normalize path separators
            resolvedPath = resolvedPath.replace(/\\/g, '/');
          }
          
          dependencies.add(resolvedPath);
        }
      }

      // Store in dependency graph
      const normalizedFilePath = filePath.replace(/\\/g, '/');
      this.dependencyGraph.set(normalizedFilePath, dependencies);

      // Update reverse dependency graph
      for (const dep of dependencies) {
        if (!this.reverseDependencyGraph.has(dep)) {
          this.reverseDependencyGraph.set(dep, new Set());
        }
        this.reverseDependencyGraph.get(dep).add(normalizedFilePath);
      }

      // Cache module info
      this.moduleCache.set(normalizedFilePath, {
        dependencies: Array.from(dependencies),
        size: content.length,
        lastModified: fs.statSync(filePath).mtime
      });

    } catch (error) {
      console.warn(`[DEPENDENCY_RESOLVER] Cannot parse ${filePath}:`, error.message);
    }
  }

  /**
   * Detect all cycles in the dependency graph
   * @private
   */
  _detectAllCycles() {
    const visited = new Set();
    const cycles = [];

    for (const module of this.dependencyGraph.keys()) {
      if (!visited.has(module)) {
        const moduleCycles = this.detectCircularDependencies(module);
        cycles.push(...moduleCycles);
        
        // Mark all modules in found cycles as visited
        for (const cycle of moduleCycles) {
          for (const cycleModule of cycle) {
            visited.add(cycleModule);
          }
        }
      }
    }

    // Remove duplicate cycles
    const uniqueCycles = [];
    const cycleSignatures = new Set();
    
    for (const cycle of cycles) {
      const signature = cycle.slice().sort().join('->');
      if (!cycleSignatures.has(signature)) {
        cycleSignatures.add(signature);
        uniqueCycles.push(cycle);
      }
    }

    return uniqueCycles;
  }

  /**
   * Find optimal break point for a circular dependency
   * @private
   */
  _findOptimalBreakPoint(cycle) {
    // Strategy: Break at the dependency with the least impact
    let bestBreakPoint = null;
    let minImpact = Infinity;

    for (let i = 0; i < cycle.length - 1; i++) {
      const module = cycle[i];
      const dependency = cycle[i + 1];
      
      // Calculate impact score (number of reverse dependencies)
      const dependencyImpact = (this.reverseDependencyGraph.get(dependency) || new Set()).size;
      const moduleImpact = (this.reverseDependencyGraph.get(module) || new Set()).size;
      const totalImpact = dependencyImpact + moduleImpact;
      
      if (totalImpact < minImpact) {
        minImpact = totalImpact;
        bestBreakPoint = { module, dependency, impact: totalImpact };
      }
    }

    return bestBreakPoint || { module: cycle[0], dependency: cycle[1], impact: 0 };
  }

  /**
   * Get total dependency count
   * @private
   */
  _getTotalDependencyCount() {
    let total = 0;
    for (const deps of this.dependencyGraph.values()) {
      total += deps.size;
    }
    return total;
  }

  /**
   * Serialize dependency graph for reporting
   * @private
   */
  _serializeDependencyGraph() {
    const serialized = {};
    for (const [module, deps] of this.dependencyGraph.entries()) {
      serialized[module] = Array.from(deps);
    }
    return serialized;
  }

  /**
   * Serialize proxy objects for reporting
   * @private
   */
  _serializeProxyObjects() {
    const serialized = {};
    for (const [id, info] of this.proxyObjects.entries()) {
      serialized[id] = {
        modulePath: info.modulePath,
        createdAt: info.createdAt,
        resolved: false // Don't try to access proxy properties during serialization
      };
    }
    return serialized;
  }

  /**
   * Get modules with most dependencies
   * @private
   */
  _getMostDependentModules(limit = 5) {
    const modules = Array.from(this.dependencyGraph.entries())
      .map(([module, deps]) => ({ module, dependencyCount: deps.size }))
      .sort((a, b) => b.dependencyCount - a.dependencyCount)
      .slice(0, limit);
    
    return modules;
  }

  /**
   * Get modules that are depended on most
   * @private
   */
  _getMostDependedOnModules(limit = 5) {
    const modules = Array.from(this.reverseDependencyGraph.entries())
      .map(([module, dependents]) => ({ module, dependentCount: dependents.size }))
      .sort((a, b) => b.dependentCount - a.dependentCount)
      .slice(0, limit);
    
    return modules;
  }

  /**
   * Get isolated modules (no dependencies or dependents)
   * @private
   */
  _getIsolatedModules() {
    const isolated = [];
    
    for (const module of this.dependencyGraph.keys()) {
      const hasDependencies = (this.dependencyGraph.get(module) || new Set()).size > 0;
      const hasDependents = (this.reverseDependencyGraph.get(module) || new Set()).size > 0;
      
      if (!hasDependencies && !hasDependents) {
        isolated.push(module);
      }
    }
    
    return isolated;
  }

  /**
   * Calculate dependency depth for each module
   * @private
   */
  _calculateDependencyDepth() {
    const depths = new Map();
    
    const calculateDepth = (module, visited = new Set()) => {
      if (depths.has(module)) {
        return depths.get(module);
      }
      
      if (visited.has(module)) {
        // Circular dependency detected
        return Infinity;
      }
      
      visited.add(module);
      
      const dependencies = this.dependencyGraph.get(module) || new Set();
      if (dependencies.size === 0) {
        depths.set(module, 0);
        return 0;
      }
      
      let maxDepth = 0;
      for (const dep of dependencies) {
        const depDepth = calculateDepth(dep, new Set(visited));
        maxDepth = Math.max(maxDepth, depDepth);
      }
      
      const depth = maxDepth === Infinity ? Infinity : maxDepth + 1;
      depths.set(module, depth);
      return depth;
    };
    
    for (const module of this.dependencyGraph.keys()) {
      calculateDepth(module);
    }
    
    return Object.fromEntries(depths);
  }
}

// Export singleton instance
export const circularDependencyResolver = new CircularDependencyResolver();

// Export utility functions

/**
 * Quick analysis of circular dependencies in a directory
 * @param {string} rootDir - Directory to analyze
 * @returns {Object} Analysis result
 */
export function analyzeCircularDependencies(rootDir = 'src') {
  return circularDependencyResolver.analyzeDependencies(rootDir);
}

/**
 * Resolve all detected circular dependencies
 * @param {string} rootDir - Directory to analyze
 * @returns {Object} Resolution result
 */
export function resolveAllCircularDependencies(rootDir = 'src') {
  console.log('[DEPENDENCY_RESOLVER] Starting comprehensive circular dependency resolution');
  
  const analysisResult = circularDependencyResolver.analyzeDependencies(rootDir);
  
  if (!analysisResult.success) {
    return analysisResult;
  }
  
  const { circularDependencies } = analysisResult.report;
  const resolutions = [];
  
  for (const cycle of circularDependencies) {
    const resolution = circularDependencyResolver.resolveCircularDependency(cycle);
    resolutions.push({
      cycle,
      resolution
    });
  }
  
  return {
    success: true,
    totalCycles: circularDependencies.length,
    resolutions,
    message: `Resolved ${resolutions.filter(r => r.resolution.success).length} of ${circularDependencies.length} circular dependencies`
  };
}

/**
 * Generate and save dependency report
 * @param {string} outputPath - Path to save report
 * @returns {Object} Operation result
 */
export function generateDependencyReport(outputPath = 'dependency-report.json') {
  try {
    const report = circularDependencyResolver.generateDependencyReport();
    
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`[DEPENDENCY_RESOLVER] Report saved to ${outputPath}`);
    }
    
    return { success: true, report, outputPath };
  } catch (error) {
    console.error('[DEPENDENCY_RESOLVER] Failed to generate report:', error);
    return { success: false, error: error.message };
  }
}