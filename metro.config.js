const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude native Android/iOS build and temporary CXX/CMake artifact directories from Metro's file watcher
config.resolver.blockList = [
  /.*\/android\/app\/\.cxx\/.*/,
  /.*\/android\/\.cxx\/.*/,
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/build\/.*/,
  /.*\.cxx\/.*/,
  /.*CMakeFiles\/.*/,
];

module.exports = config;
