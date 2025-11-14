// 核心模块统一导出
export * from './windowManager.js';
export * from './doorKeySystem.js'; // Includes: registerDoorOpenCallback, unregisterDoorOpenCallback, getDoorOpenCallbackInfo
export * from './gameLogic.js';
export * from './workerManager.js';
export * from './ipcHandlers.js';
export * from './loggerConfig.js';
export * from './config.js';
export * from './emailSystem.js';
export * from './emailActions.js'; // Includes: registerEmailCallback, unregisterEmailCallback, getRegisteredCallbacks, isCallbackRegistered, clearAllCallbacks

