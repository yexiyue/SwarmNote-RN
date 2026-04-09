const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// 允许 Metro 解析和转换 .po 文件（Lingui 国际化）
config.resolver.sourceExts.push("po");
config.transformer.babelTransformerPath = require.resolve("@lingui/metro-transformer/expo");

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  inlineRem: 16,
});
