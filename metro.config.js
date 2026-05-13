const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// .html 作为静态资源处理，供 WebView 通过 Asset.fromModule 加载
config.resolver.assetExts.push("html");

// Lingui catalogs (.po/.pot) need to be importable as JS modules
config.resolver.sourceExts.push("po", "pot");
config.transformer.babelTransformerPath = require.resolve("@lingui/metro-transformer/expo");

// @swarmnote/editor-{core,web,react-native} 通过 pnpm.overrides 链到 sibling 仓
// `../swarmnote-editor/packages/{editor-core,editor-web,editor-react-native}`。
// Metro 默认不 watch 也不 resolve monorepo 外的 symlink target，需要显式声明。
// 路径可由 SWARMNOTE_EDITOR_LOCAL_PATH 环境变量覆盖（CI 或开发者把 sibling clone 到非默认位置时使用）。
const siblingEditorRoot = process.env.SWARMNOTE_EDITOR_LOCAL_PATH
  ? path.resolve(process.env.SWARMNOTE_EDITOR_LOCAL_PATH)
  : path.resolve(__dirname, "../swarmnote-editor");

const editorCoreLocalPath = path.join(siblingEditorRoot, "packages/editor-core");
const editorWebLocalPath = path.join(siblingEditorRoot, "packages/editor-web");
const editorRNLocalPath = path.join(siblingEditorRoot, "packages/editor-react-native");

// watch sibling root（不是单个 packages/*），覆盖 sibling pnpm .pnpm store。
// 否则 metro 拒绝读 sibling 包 node_modules symlink 指向的实际文件（在 sibling root 的 .pnpm/）。
config.watchFolders = [...(config.watchFolders ?? []), siblingEditorRoot];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@swarmnote/editor-core": editorCoreLocalPath,
  "@swarmnote/editor-web": editorWebLocalPath,
  "@swarmnote/editor-react-native": editorRNLocalPath,
};

// sibling 仓走 pnpm 默认 symlink 布局（peer-dep 如 comlink/react 都是 .pnpm store 的 symlink）。
// 本仓 .npmrc 设 node-linker=hoisted 不受影响——这里只是让 metro 在解析 sibling 文件时 follow symlink。
config.resolver.unstable_enableSymlinks = true;

// sibling 仓 devDep 也装了一份 react/react-native，导致 host 和 sibling 各加载一份 React，
// 触发 "Invalid hook call"。把单例敏感包强制走 host node_modules。
const HOST_SINGLETONS = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react/compiler-runtime",
  "react-native",
  "scheduler",
]);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (HOST_SINGLETONS.has(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, "package.json") },
      moduleName,
      platform,
    );
  }
  return previousResolveRequest
    ? previousResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config);
