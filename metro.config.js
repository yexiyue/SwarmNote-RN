const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// .html 作为静态资源处理，供 WebView 通过 Asset.fromModule 加载
config.resolver.assetExts.push("html");

// Lingui catalogs (.po/.pot) need to be importable as JS modules
config.resolver.sourceExts.push("po", "pot");
config.transformer.babelTransformerPath = require.resolve("@lingui/metro-transformer/expo");

// @swarmnote/editor-core 通过 pnpm link 指向 sibling 仓 ../swarmnote-editor/packages/editor-core。
// Metro 默认不 watch 也不 resolve monorepo 外的 symlink target，需要显式声明。
// 路径可由 EDITOR_CORE_LOCAL_PATH 环境变量覆盖（CI 或开发者把 sibling clone 到非默认位置时使用）。
const editorCoreLocalPath = process.env.EDITOR_CORE_LOCAL_PATH
  ? path.resolve(process.env.EDITOR_CORE_LOCAL_PATH)
  : path.resolve(__dirname, "../swarmnote-editor/packages/editor-core");

config.watchFolders = [...(config.watchFolders ?? []), editorCoreLocalPath];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@swarmnote/editor-core": editorCoreLocalPath,
};

module.exports = withNativewind(config);
