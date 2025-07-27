const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver for fabric-interop
config.resolver.platforms = ["ios", "android"];

// Make sure to include the parent directory for proper resolution
config.watchFolders = [__dirname, "../ios", "../android"];

module.exports = config;
