/**
 * Electron Platform Adapters
 * 
 * Exports all Electron-specific platform adapters that implement
 * the foundation layer interfaces.
 */

export { ElectronWindowAdapter, ElectronWindowWrapper } from './ElectronWindowAdapter.js';
export { ElectronResourceAdapter } from './ElectronResourceAdapter.js';
export { ElectronIpcAdapter } from './ElectronIpcAdapter.js';