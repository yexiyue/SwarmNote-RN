const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// .html 作为静态资源处理，供 WebView 通过 Asset.fromModule 加载
config.resolver.assetExts.push("html");

// Lingui catalogs (.po/.pot) need to be importable as JS modules
config.resolver.sourceExts.push("po", "pot");
config.transformer.babelTransformerPath = require.resolve("@lingui/metro-transformer/expo");

module.exports = withNativewind(config);
