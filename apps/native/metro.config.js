const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prevent react-native-worklets from being auto-detected as a config plugin
// It should only be used as a Babel plugin
config.resolver.blockList = config.resolver.blockList || [];
// This doesn't actually block it, but we're documenting the intent

module.exports = config;
