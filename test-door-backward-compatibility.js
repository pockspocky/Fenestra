import fc from 'fast-check';
import { resolveAssetPath, resolveDoorImagePath, resolveKeyImagePath, assetExists } from './src/core/utils/assetPathResolver.js';

// Feature: door-visual-improvements, Property 2: Backward compatibility preservation
// For any door created with old-style paths, the system should successfully resolve and load the images without errors

/**
 * Test that old paths are correctly resolved to new paths
 */
function testOldPathResolution() {
  console.log('\n=== Testing backward compatibility path resolution ===\n');
  
  const oldToNewMappings = [
    { old: 'doors/Door.png', new: 'renderer/assets/doors/DoorClosed.png' },
    { old: 'doors/DoorClosed.png', new: 'renderer/assets/doors/DoorClosed.png' },
    { old: 'doors/DoorOpened.png', new: 'renderer/assets/doors/DoorOpened.png' },
    { old: 'doors/Keychain.jpeg', new: 'renderer/assets/doors/Keychain.jpeg' }
  ];
  
  // Property: For any old path, resolveAssetPath should return the correct new path
  const property = fc.property(
    fc.constantFrom(...oldToNewMappings),
    (mapping) => {
      const resolved = resolveAssetPath(mapping.old);
      
      // The resolved path should be the new path
      return resolved === mapping.new;
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: Old paths correctly resolve to new paths');
    return true;
  }
}

/**
 * Test that new paths pass through unchanged
 */
function testNewPathPassthrough() {
  console.log('\n=== Testing new path passthrough ===\n');
  
  const newPaths = [
    'renderer/assets/doors/DoorClosed.png',
    'renderer/assets/doors/DoorOpened.png',
    'renderer/assets/doors/Keychain.jpeg'
  ];
  
  // Property: For any new path, resolveAssetPath should return it unchanged
  const property = fc.property(
    fc.constantFrom(...newPaths),
    (newPath) => {
      const resolved = resolveAssetPath(newPath);
      
      // The resolved path should be the same as input
      return resolved === newPath;
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: New paths pass through unchanged');
    return true;
  }
}

/**
 * Test door image path resolution with state
 */
function testDoorImagePathResolution() {
  console.log('\n=== Testing door image path resolution ===\n');
  
  const states = ['open', 'closed'];
  
  // Property: For any state, resolveDoorImagePath should return appropriate image
  const property = fc.property(
    fc.constantFrom(...states),
    (state) => {
      const resolved = resolveDoorImagePath(null, state);
      
      // Check that resolved path is correct for state
      if (state === 'open') {
        return resolved === 'renderer/assets/doors/DoorOpened.png';
      } else {
        return resolved === 'renderer/assets/doors/DoorClosed.png';
      }
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: Door image paths resolve correctly by state');
    return true;
  }
}

/**
 * Test key image path resolution
 */
function testKeyImagePathResolution() {
  console.log('\n=== Testing key image path resolution ===\n');
  
  // Property: resolveKeyImagePath with null should return default key image
  // Updated for new default: Key.png (with fallback to Keychain.jpeg)
  const resolved = resolveKeyImagePath(null);
  const expectedNew = 'renderer/assets/Keys/Key.png';
  const expectedFallback = 'renderer/assets/doors/Keychain.jpeg';
  
  if (resolved === expectedNew || resolved === expectedFallback) {
    console.log('✅ Property test PASSED: Key image path resolves to default (Key.png or Keychain.jpeg fallback)');
    return true;
  } else {
    console.error('❌ Property test FAILED');
    console.error(`Expected: ${expectedNew} or ${expectedFallback}, Got: ${resolved}`);
    return false;
  }
}

/**
 * Test asset existence checking
 */
function testAssetExistence() {
  console.log('\n=== Testing asset existence checking ===\n');
  
  const existingAssets = [
    'renderer/assets/doors/DoorClosed.png',
    'renderer/assets/doors/DoorOpened.png',
    'renderer/assets/doors/Keychain.jpeg'
  ];
  
  // Property: For any existing asset, assetExists should return true
  const property = fc.property(
    fc.constantFrom(...existingAssets),
    (assetPath) => {
      return assetExists(assetPath);
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: All expected assets exist');
    return true;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting backward compatibility property tests...\n');
  
  const test1 = testOldPathResolution();
  const test2 = testNewPathPassthrough();
  const test3 = testDoorImagePathResolution();
  const test4 = testKeyImagePathResolution();
  const test5 = testAssetExistence();
  
  if (test1 && test2 && test3 && test4 && test5) {
    console.log('\n✅ All backward compatibility property tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some property tests failed!\n');
    process.exit(1);
  }
}

runTests();
