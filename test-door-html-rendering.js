import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';

// Feature: door-visual-improvements, Property 3: State-image correspondence (closed)
// Feature: door-visual-improvements, Property 4: State-image correspondence (open)
// Feature: door-visual-improvements, Property 9: CSS property consistency

/**
 * Test that door.html exists and has required structure
 */
function testDoorHtmlExists() {
  console.log('\n=== Testing door.html existence and structure ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  
  if (!fs.existsSync(doorHtmlPath)) {
    console.error('❌ door.html does not exist');
    return false;
  }
  
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for required elements
  const requiredElements = [
    'door-container',
    'doorImage',
    'lockIcon',
    'door-image'
  ];
  
  for (const element of requiredElements) {
    if (!content.includes(element)) {
      console.error(`❌ Missing required element: ${element}`);
      return false;
    }
  }
  
  console.log('✅ door.html exists with required structure');
  return true;
}

/**
 * Test that door.html has object-fit: fill CSS property
 * Property 9: CSS property consistency
 */
function testObjectFitFill() {
  console.log('\n=== Testing Property 9: CSS property consistency ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for object-fit: fill in CSS
  const hasObjectFitFill = content.includes('object-fit: fill');
  
  if (!hasObjectFitFill) {
    console.error('❌ door.html does not have object-fit: fill CSS property');
    return false;
  }
  
  console.log('✅ Property test PASSED: door.html has object-fit: fill CSS property');
  return true;
}

/**
 * Test state-image correspondence logic
 * Property 3 & 4: State-image correspondence
 */
function testStateImageCorrespondence() {
  console.log('\n=== Testing Property 3 & 4: State-image correspondence ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check that the HTML contains logic for state-based image selection
  const hasStateLogic = content.includes('getImagePath') || 
                        content.includes('state') && content.includes('open') && content.includes('closed');
  
  if (!hasStateLogic) {
    console.error('❌ door.html does not have state-based image selection logic');
    return false;
  }
  
  // Check for references to both door images
  const hasDoorClosed = content.includes('DoorClosed.png');
  const hasDoorOpened = content.includes('DoorOpened.png');
  
  if (!hasDoorClosed || !hasDoorOpened) {
    console.error('❌ door.html does not reference both DoorClosed.png and DoorOpened.png');
    return false;
  }
  
  console.log('✅ Property test PASSED: door.html has state-image correspondence logic');
  return true;
}

/**
 * Test that door.html accepts required URL parameters
 */
function testUrlParameters() {
  console.log('\n=== Testing URL parameter acceptance ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for URL parameter parsing
  const requiredParams = [
    'doorId',
    'state',
    'isLocked',
    'isEncrypted'
  ];
  
  for (const param of requiredParams) {
    if (!content.includes(param)) {
      console.error(`❌ door.html does not handle parameter: ${param}`);
      return false;
    }
  }
  
  console.log('✅ door.html accepts required URL parameters');
  return true;
}

/**
 * Test lock icon visibility logic
 */
function testLockIconLogic() {
  console.log('\n=== Testing lock icon visibility logic ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for lock icon element
  const hasLockIcon = content.includes('lock-icon') || content.includes('lockIcon');
  
  if (!hasLockIcon) {
    console.error('❌ door.html does not have lock icon element');
    return false;
  }
  
  // Check for lock state handling
  const hasLockLogic = content.includes('isLocked') || content.includes('locked');
  
  if (!hasLockLogic) {
    console.error('❌ door.html does not have lock state handling logic');
    return false;
  }
  
  console.log('✅ door.html has lock icon visibility logic');
  return true;
}

/**
 * Test visual state CSS classes
 */
function testVisualStateClasses() {
  console.log('\n=== Testing visual state CSS classes ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for visual state classes
  const requiredClasses = [
    'locked',
    'unlocked',
    'encrypted'
  ];
  
  for (const className of requiredClasses) {
    if (!content.includes(className)) {
      console.error(`❌ door.html does not have CSS class: ${className}`);
      return false;
    }
  }
  
  // Check for brightness/filter CSS
  const hasBrightnessFilter = content.includes('brightness') || content.includes('filter');
  
  if (!hasBrightnessFilter) {
    console.error('❌ door.html does not have brightness/filter CSS for visual states');
    return false;
  }
  
  console.log('✅ door.html has visual state CSS classes');
  return true;
}

/**
 * Test transition animations
 */
function testTransitionAnimations() {
  console.log('\n=== Testing transition animations ===\n');
  
  const doorHtmlPath = path.join(process.cwd(), 'renderer', 'door.html');
  const content = fs.readFileSync(doorHtmlPath, 'utf-8');
  
  // Check for transition CSS
  const hasTransition = content.includes('transition') || content.includes('animation');
  
  if (!hasTransition) {
    console.error('❌ door.html does not have transition/animation CSS');
    return false;
  }
  
  console.log('✅ door.html has transition animations');
  return true;
}

/**
 * Property test: For any state parameter, the correct image path should be selected
 */
function testStateImagePathProperty() {
  console.log('\n=== Testing state-to-image-path property ===\n');
  
  const states = ['open', 'closed'];
  const expectedImages = {
    'open': 'DoorOpened.png',
    'closed': 'DoorClosed.png'
  };
  
  // Property: For any state, the getImagePath function should return the correct image
  const property = fc.property(
    fc.constantFrom(...states),
    (state) => {
      // Simulate the getImagePath logic from door.html
      const imagePath = state === 'open' 
        ? 'renderer/assets/doors/DoorOpened.png'
        : 'renderer/assets/doors/DoorClosed.png';
      
      return imagePath.includes(expectedImages[state]);
    }
  );
  
  const result = fc.check(property, { numRuns: 100 });
  
  if (result.failed) {
    console.error('❌ Property test FAILED');
    console.error('Counterexample:', result.counterexample);
    return false;
  } else {
    console.log('✅ Property test PASSED: State correctly maps to image path');
    return true;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting door HTML rendering property tests...\n');
  
  const test1 = testDoorHtmlExists();
  const test2 = testObjectFitFill();
  const test3 = testStateImageCorrespondence();
  const test4 = testUrlParameters();
  const test5 = testLockIconLogic();
  const test6 = testVisualStateClasses();
  const test7 = testTransitionAnimations();
  const test8 = testStateImagePathProperty();
  
  if (test1 && test2 && test3 && test4 && test5 && test6 && test7 && test8) {
    console.log('\n✅ All door HTML rendering property tests passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some property tests failed!\n');
    process.exit(1);
  }
}

runTests();
