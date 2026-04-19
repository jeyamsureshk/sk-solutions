const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for tfjs model files if you plan to use custom ones later
config.resolver.assetExts.push('tflite');
config.resolver.assetExts.push('bin');

module.exports = config;
