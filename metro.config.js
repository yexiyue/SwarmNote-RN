const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// .html 作为静态资源处理，供 WebView 通过 Asset.fromModule 加载
config.resolver.assetExts.push("html");

module.exports = withNativewind(config);
