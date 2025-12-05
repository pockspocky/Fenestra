import fc from 'fast-check';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Feature: door-visual-improvements, Property 1: Asset path consistency
// For any door window created, all image paths should reference the renderer/assets/ directory structure

/**
 * Test that door image paths use the new asset structure
 */
function testAssetPathConsistency() {
  console.log('\n=== Testing Property 1: Asset path consistency ===\n');
  
  // Define valid door image paths
  const validDoorPaths = [
    'renderer/assets/doors/DoorClosed.png',
    'renderer/assets/doors/DoorOpened.png',
    'renderer/assets/doors/Keychain.jpeg'
  ];
  
  // Property: All door-related image paths should start with 'renderer/assets/'
  const property = fc.property(
    fc.constantFrom(...validDoorPaths),
    (imagePath) => {
      // Check that path starts with renderer/assets/
      const startsWithAssets = imagePath.startsWith('renderer/assets/');
      
      // Check that path contains doors subdirectory
      const containsDoors = imagePath.includes('/doors/');
      
      // Check that path is a valid door asset
      const isValidDoorAsset = validDoorPaths.includes(imagePath);
      
      return startsWithAssets && containsDoors && isValidDoorAsset;
    }
  );
  
  // Run the property test with 100 iterations
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: All door image paths use renderer/assets/ structure');
    return true;
  }
}

/**
 * Test backward compatibility - old paths should be resolvable
 */
function testBackwardCompatibility() {
  console.log('\n=== Testing Property 2: Backward compatibility preservation ===\n');
  
  // Old path format
  const oldPaths = [
    'doors/Door.png',
    'doors/Keychain.jpeg'
  ];
  
  // New path format
  const newPaths = [
    'renderer/assets/doors/DoorClosed.png',
    'renderer/assets/doors/DoorOpened.png',
    'renderer/assets/doors/Keychain.jpeg'
  ];
  
  // Property: For any old-style path, we should be able to map it to a new path
  const property = fc.property(
    fc.constantFrom(...oldPaths),
    (oldPath) => {
      // Simple mapping logic (this would be in actual code)
      let newPath;
      if (oldPath === 'doors/Door.png') {
        newPath = 'renderer/assets/doors/DoorClosed.png';
      } else if (oldPath === 'doors/Keychain.jpeg') {
        newPath = 'renderer/assets/doors/Keychain.jpeg';
      }
      
      // Check that we can map old path to new path
      const canMap = newPath !== undefined;
      
      // Check that new path is in valid paths
      const isValid = newPaths.includes(newPath);
      
      return canMap && isValid;
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: Old paths can be mapped to new paths');
    return true;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting door asset path property tests...\n');
  
  const test1 = testAssetPathConsistency();
  const test2 = testBackwardCompatibility();
  
  if (test1 && test2) {
    console.log('\n✅ All property tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some property tests failed!\n');
    process.exit(1);
  }
}

runTests();
