/**
 * Dependency Injection Container
 * 
 * Manages service registration and resolution with support for singleton
 * and transient lifetimes, factory functions, and circular dependency detection.
 */

export class Container {
  constructor() {
    this.services = new Map(); // service name -> service definition
    this.instances = new Map(); // singleton instances
    this.resolving = new Set(); // circular dependency detection
  }

  /**
   * Register a service with the container
   * @param {string} name - Service name
   * @param {Function|Object} implementation - Service constructor or factory
   * @param {Object} options - Registration options
   */
  register(name, implementation, options = {}) {
    const serviceDefinition = {
      name,
      implementation,
      lifetime: options.lifetime || 'transient', // 'singleton' or 'transient'
      dependencies: options.dependencies || [],
      factory: options.factory || false,
      metadata: options.metadata || {}
    };

    this.services.set(name, serviceDefinition);
  }

  /**
   * Register a singleton service
   * @param {string} name - Service name
   * @param {Function|Object} implementation - Service constructor or factory
   * @param {Object} options - Registration options
   */
  registerSingleton(name, implementation, options = {}) {
    this.register(name, implementation, { ...options, lifetime: 'singleton' });
  }

  /**
   * Register a transient service
   * @param {string} name - Service name
   * @param {Function|Object} implementation - Service constructor or factory
   * @param {Object} options - Registration options
   */
  registerTransient(name, implementation, options = {}) {
    this.register(name, implementation, { ...options, lifetime: 'transient' });
  }

  /**
   * Register a factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @param {Object} options - Registration options
   */
  registerFactory(name, factory, options = {}) {
    this.register(name, factory, { ...options, factory: true });
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @returns {any} Service instance
   */
  resolve(name) {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      const cycle = Array.from(this.resolving).join(' -> ') + ' -> ' + name;
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    const serviceDefinition = this.services.get(name);
    if (!serviceDefinition) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // Return singleton instance if it exists
    if (serviceDefinition.lifetime === 'singleton' && this.instances.has(name)) {
      return this.instances.get(name);
    }

    // Mark as resolving for circular dependency detection
    this.resolving.add(name);

    try {
      const instance = this._createInstance(serviceDefinition);

      // Store singleton instance
      if (serviceDefinition.lifetime === 'singleton') {
        this.instances.set(name, instance);
      }

      return instance;
    } finally {
      // Remove from resolving set
      this.resolving.delete(name);
    }
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean} Whether the service is registered
   */
  isRegistered(name) {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   * @returns {string[]} Array of service names
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Get service definition
   * @param {string} name - Service name
   * @returns {Object|null} Service definition or null if not found
   */
  getServiceDefinition(name) {
    return this.services.get(name) || null;
  }

  /**
   * Clear all services and instances (useful for testing)
   */
  clear() {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Get container statistics
   * @returns {Object} Statistics about the container
   */
  getStats() {
    const servicesByLifetime = {
      singleton: 0,
      transient: 0
    };

    for (const service of this.services.values()) {
      servicesByLifetime[service.lifetime]++;
    }

    return {
      totalServices: this.services.size,
      singletonInstances: this.instances.size,
      servicesByLifetime,
      currentlyResolving: Array.from(this.resolving)
    };
  }

  /**
   * Create an instance of a service
   * @private
   */
  _createInstance(serviceDefinition) {
    const { implementation, dependencies, factory } = serviceDefinition;

    // Resolve dependencies
    const resolvedDependencies = dependencies.map(dep => this.resolve(dep));

    if (factory) {
      // Factory function - call with resolved dependencies
      return implementation(...resolvedDependencies);
    } else if (typeof implementation === 'function') {
      // Constructor function - create new instance
      return new implementation(...resolvedDependencies);
    } else {
      // Direct object - return as is (useful for configuration objects)
      return implementation;
    }
  }

  /**
   * Validate service definitions for common issues
   * @returns {Object[]} Array of validation issues
   */
  validate() {
    const issues = [];

    for (const [name, service] of this.services) {
      // Check for missing dependencies
      for (const dep of service.dependencies) {
        if (!this.services.has(dep)) {
          issues.push({
            type: 'missing_dependency',
            service: name,
            dependency: dep,
            message: `Service '${name}' depends on '${dep}' which is not registered`
          });
        }
      }

      // Check for potential circular dependencies (basic check)
      const visited = new Set();
      const stack = [name];
      
      while (stack.length > 0) {
        const current = stack.pop();
        
        if (visited.has(current)) {
          continue;
        }
        
        visited.add(current);
        const currentService = this.services.get(current);
        
        if (currentService) {
          for (const dep of currentService.dependencies) {
            if (dep === name) {
              issues.push({
                type: 'circular_dependency',
                service: name,
                dependency: dep,
                message: `Potential circular dependency: ${name} -> ... -> ${dep} -> ${name}`
              });
            } else {
              stack.push(dep);
            }
          }
        }
      }
    }

    return issues;
  }
}