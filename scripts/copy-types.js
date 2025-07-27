/**
 * Script to copy index.d.ts to dynamic-index.d.ts and add global declarations
 */

const fs = require("fs");
const path = require("path");

// Paths
const indexDtsPath = path.join(__dirname, "../dist/index.d.ts");
const dynamicIndexDtsPath = path.join(__dirname, "../dist/dynamic-index.d.ts");

// Read the index.d.ts file
let indexDtsContent = fs.readFileSync(indexDtsPath, "utf8");

// Create the dynamic-index.d.ts content
const dynamicIndexDtsContent = `/**
 * Type definitions for Viro React Native with dynamic architecture detection
 *
 * This file provides type definitions for the dynamic architecture detection.
 * At runtime, either the legacy or Fabric implementation will be used,
 * but for TypeScript purposes, we use the legacy implementation's types.
 */

// Add type declarations for global variables used in New Architecture detection
declare global {
  var nativeFabricUIManager: any;
  var __turboModuleProxy: any;
}

// Export all types from the legacy implementation
${indexDtsContent}
`;

// Write the dynamic-index.d.ts file
fs.writeFileSync(dynamicIndexDtsPath, dynamicIndexDtsContent);

// Also write to the source file for reference
const dynamicIndexSourceDtsPath = path.join(
  __dirname,
  "../dynamic-index-source.d.ts"
);
fs.writeFileSync(dynamicIndexSourceDtsPath, dynamicIndexDtsContent);

console.log(
  "Successfully copied types from index.d.ts to dynamic-index.d.ts and dynamic-index-source.d.ts"
);
