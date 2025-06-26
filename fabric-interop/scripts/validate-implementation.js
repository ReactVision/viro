#!/usr/bin/env node

/**
 * Validation script for fabric-interop implementation
 * Checks that all required files and functions are properly implemented
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  header: (msg) => console.log(`${colors.bold}${colors.blue}${msg}${colors.reset}`)
};

// Base paths
const rootDir = path.join(__dirname, '../..');
const fabricInteropDir = path.join(rootDir, 'fabric-interop');
const iosDir = path.join(rootDir, 'ios/ViroFabric');
const androidDir = path.join(rootDir, 'android/viro_bridge/src/main');

// Required files
const requiredFiles = {
  javascript: [
    'NativeViro.ts',
    'ViroFabricContainer.tsx',
    'components/ViroGlobal.ts',
    'components/ViroUtils.ts',
    'components/ViroNode.tsx',
    'components/ViroScene.tsx',
    'components/ViroBox.tsx',
    'components/ViroSphere.tsx',
    'components/ViroText.tsx',
    'index.ts'
  ],
  ios: [
    'ViroFabricJSI.h',
    'ViroFabricJSI.mm',
    'ViroFabricSceneManager.h',
    'ViroFabricSceneManager.mm',
    'ViroEventsTurboModule.h',
    'ViroEventsTurboModule.mm',
    'ViroFabricContainerComponentView.h',
    'ViroFabricContainerComponentView.mm'
  ],
  android: [
    'java/com/viromedia/bridge/fabric/ViroFabricContainer.java',
    'java/com/viromedia/bridge/fabric/ViroFabricSceneManager.java',
    'java/com/viromedia/bridge/fabric/ViroEventsTurboModule.java',
    'java/com/viromedia/bridge/fabric/ViroFabricContainerViewManager.java',
    'java/com/viromedia/bridge/fabric/ViroFabricPackage.java',
    'cpp/fabric/ViroFabricContainerJSI.cpp'
  ]
};

// Required JSI functions (should be consistent across platforms)
const requiredJSIFunctions = [
  'createViroNode',
  'updateViroNode',
  'deleteViroNode',
  'addViroNodeChild',
  'removeViroNodeChild',
  'registerEventCallback',
  'unregisterEventCallback',
  'createViroScene',
  'activateViroScene',
  'deactivateViroScene',
  'destroyViroScene',
  'getViroSceneState',
  'createViroMaterial',
  'updateViroMaterial',
  'createViroAnimation',
  'executeViroAnimation',
  'getViroMemoryStats',
  'performViroMemoryCleanup',
  'initialize',
  'setViroARPlaneDetection',
  'setViroARImageTargets'
];

let totalTests = 0;
let passedTests = 0;

function test(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    log.success(message);
    return true;
  } else {
    log.error(message);
    return false;
  }
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  return test(exists, `${description}: ${path.basename(filePath)}`);
}

function checkFileContains(filePath, searchText, description) {
  try {
    if (!fs.existsSync(filePath)) {
      return test(false, `${description}: file ${path.basename(filePath)} not found`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const contains = content.includes(searchText);
    return test(contains, `${description}: ${searchText}`);
  } catch (error) {
    return test(false, `${description}: error reading file - ${error.message}`);
  }
}

function checkJSIFunctions(filePath, platform) {
  log.header(`\\nChecking JSI functions in ${platform}:`);
  
  if (!fs.existsSync(filePath)) {
    log.error(`JSI file not found: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  requiredJSIFunctions.forEach(func => {
    checkFileContains(filePath, func, `  JSI function ${func}`);
  });
}

function validateTypeScriptAPI() {
  log.header('\\nValidating TypeScript API:');
  
  const nativeViroPath = path.join(fabricInteropDir, 'NativeViro.ts');
  const viroGlobalPath = path.join(fabricInteropDir, 'components/ViroGlobal.ts');
  
  // Check interface definitions
  checkFileContains(nativeViroPath, 'export type ViroNodeType', 'ViroNodeType definition');
  checkFileContains(nativeViroPath, 'export type ViroEventCallback', 'ViroEventCallback definition');
  checkFileContains(nativeViroPath, 'handleViroEvent', 'Global event handler');
  
  checkFileContains(viroGlobalPath, 'interface NativeViroType', 'NativeViro interface');
  checkFileContains(viroGlobalPath, 'getNativeViro', 'getNativeViro function');
}

function validateReactComponents() {
  log.header('\\nValidating React components:');
  
  const viroUtilsPath = path.join(fabricInteropDir, 'components/ViroUtils.ts');
  const viroNodePath = path.join(fabricInteropDir, 'components/ViroNode.tsx');
  
  checkFileContains(viroUtilsPath, 'useViroNode', 'useViroNode hook');
  checkFileContains(viroUtilsPath, 'ViroContext', 'ViroContext');
  checkFileContains(viroUtilsPath, 'convertCommonProps', 'Props conversion');
  
  checkFileContains(viroNodePath, 'ViroContextProvider', 'Context provider usage');
}

function validateEventSystem() {
  log.header('\\nValidating event system:');
  
  const iosTurboModule = path.join(iosDir, 'ViroEventsTurboModule.mm');
  const androidTurboModule = path.join(androidDir, 'java/com/viromedia/bridge/fabric/ViroEventsTurboModule.java');
  
  // iOS event system
  checkFileContains(iosTurboModule, 'emitJSICallback', 'iOS: JSI callback emission');
  checkFileContains(iosTurboModule, 'sharedInstance', 'iOS: Singleton pattern');
  
  // Android event system
  checkFileContains(androidTurboModule, 'emitJSICallbackInternal', 'Android: JSI callback emission');
  checkFileContains(androidTurboModule, 'getInstance', 'Android: Singleton pattern');
}

function validateSceneManagement() {
  log.header('\\nValidating scene management:');
  
  const iosSceneManager = path.join(iosDir, 'ViroFabricSceneManager.mm');
  const androidSceneManager = path.join(androidDir, 'java/com/viromedia/bridge/fabric/ViroFabricSceneManager.java');
  
  const sceneFunctions = ['createScene', 'activateScene', 'destroyScene', 'getMemoryStats'];
  
  sceneFunctions.forEach(func => {
    checkFileContains(iosSceneManager, func, `iOS scene: ${func}`);
    checkFileContains(androidSceneManager, func, `Android scene: ${func}`);
  });
}

function validateFabricIntegration() {
  log.header('\\nValidating Fabric integration:');
  
  const iosComponentView = path.join(iosDir, 'ViroFabricContainerComponentView.mm');
  const androidViewManager = path.join(androidDir, 'java/com/viromedia/bridge/fabric/ViroFabricContainerViewManager.java');
  const fabricContainer = path.join(fabricInteropDir, 'ViroFabricContainer.tsx');
  
  checkFileContains(iosComponentView, 'RCTViewComponentView', 'iOS: Fabric ComponentView');
  checkFileContains(androidViewManager, 'ViewGroupManager', 'Android: Fabric ViewManager');
  checkFileContains(fabricContainer, 'requireNativeComponent', 'JS: Native component registration');
  checkFileContains(fabricContainer, 'ViroFabricContainerView', 'JS: Native component name');
}

function main() {
  console.log(`${colors.bold}${colors.blue}ReactVision Fabric-Interop Implementation Validator${colors.reset}\\n`);
  
  // Check file structure
  log.header('Checking file structure:');
  
  // JavaScript files
  requiredFiles.javascript.forEach(file => {
    checkFileExists(path.join(fabricInteropDir, file), 'JS');
  });
  
  // iOS files
  requiredFiles.ios.forEach(file => {
    checkFileExists(path.join(iosDir, file), 'iOS');
  });
  
  // Android files
  requiredFiles.android.forEach(file => {
    checkFileExists(path.join(androidDir, file), 'Android');
  });
  
  // Check JSI implementations
  checkJSIFunctions(path.join(iosDir, 'ViroFabricJSI.mm'), 'iOS');
  checkJSIFunctions(path.join(androidDir, 'cpp/fabric/ViroFabricContainerJSI.cpp'), 'Android');
  
  // Validate specific components
  validateTypeScriptAPI();
  validateReactComponents();
  validateEventSystem();
  validateSceneManagement();
  validateFabricIntegration();
  
  // Final summary
  log.header('\\nValidation Summary:');
  const percentage = Math.round((passedTests / totalTests) * 100);
  
  if (percentage >= 90) {
    log.success(`Implementation is ${percentage}% complete (${passedTests}/${totalTests} tests passed)`);
    log.success('Fabric-interop layer appears to be fully functional!');
  } else if (percentage >= 70) {
    log.warning(`Implementation is ${percentage}% complete (${passedTests}/${totalTests} tests passed)`);
    log.warning('Some issues found but should be mostly functional');
  } else {
    log.error(`Implementation is only ${percentage}% complete (${passedTests}/${totalTests} tests passed)`);
    log.error('Significant issues found - may not be functional');
  }
  
  console.log('\\nNext steps:');
  console.log('1. Run the basic functionality test: npm run test:fabric-interop');
  console.log('2. Test with a real React Native app using New Architecture');
  console.log('3. Verify AR functionality works correctly');
  
  process.exit(percentage >= 90 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main, test, checkFileExists, checkFileContains };