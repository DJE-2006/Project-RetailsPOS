const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

// SVG support — .svg files import as React components (react-native-svg).
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts.push("svg");

module.exports = config;
