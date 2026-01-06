/**
 * Testing Infrastructure - Centralized exports
 * 
 * Feature: foundational-abstraction
 * Requirements: 15.1, 15.2, 15.4, 15.6
 */

// Mock factories
export { MockFactory, mockFactory } from './MockFactory.js';

// Test containers
export { TestContainer, createTestContainer } from './TestContainer.js';

// Test transports
export { 
  MemoryTransport, 
  SpyTransport, 
  NullTransport,
  createMemoryTransport,
  createSpyTransport,
  createNullTransport
} from './TestTransports.js';

// Test utilities
export {
  CallbackVerifier,
  StateAssertion,
  AsyncTestHelper,
  createCallbackVerifier,
  createStateAssertion,
  createAsyncTestHelper,
  createTestLogger
} from './TestUtilities.js';