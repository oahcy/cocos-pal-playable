# Cocos Playable 平台（开发原型）

私有源码仓库：`oahcy/cocos-pal-playable`。当前仅实现 TikTok HTML5 ZIP。
Google Ads、AppLovin 和 pink 专用面板尚未实现。

## 本地接入

需要 Node.js 22、已完成初始化的 cocos-cli（本次开发基于 0.0.1-alpha.43）。

```powershell
npm install
npm test
npm run build
node scripts/install-cli.cjs D:/code/cocos-cli
node D:/code/cocos-cli/dist/cli.js build -j <项目目录> -p playable -c <构建配置.json>
```

配置示例见 `examples/tiktok.build.json`；场景、引擎模块等继续使用工程构建配置。
用户只进行一次 playable 构建，内部复用 HTML5/Web PAL，然后生成 ZIP。
当前 cocos-cli 还需包含外部 HTML5 平台的 SystemJS 修复：在
`src/core/builder/worker/builder/tasks/build-task/script.ts` 中，调用 `buildSystemJs` 时
将 `platformType === 'HTML5'` 映射为 `web-mobile`，其他平台保持原值。
否则现有 module-system 会为 playable 生成非浏览器加载器，导致黑屏。

安装脚本复制编译产物到 CLI 的 `packages/platforms/playable`；不修改公共 CLI 源码。
发布前保持 `private: true` 防止误发布，产物包访问权限和正式发布流程待确定。
`npm pack` 可生成本地分发包；当前安装脚本从源码仓库执行。

## 输出与限制

游戏中间文件保留在正常构建目录；交付目录为该目录加 `-delivery`，
包含 `tiktok.zip`、`report.json` 和所有权标记。
仅收集已知游戏文件和 `assets/`、`cocos-js/`、`src/`；这是首版目录白名单，
尚未实现精确的资源依赖图。源映射与其他根目录文件不进入 ZIP。
封装发生于平台的 `onAfterBuild`，目前不支持其他扩展在此之后修改游戏文件；
发布流水线验证钩子顺序后才能作为正式交付能力。

支持方向 auto/portrait/landscape、官方 SDK、统一 `playable.openStore()`。
按钮、结束 UI 由业务实现；`finish()` 是幂等本地标记，不向 TikTok 虚构结束协议。
请在真实用户点击回调中调用 openStore。
运行时提供浏览器可见性与静音事件基础接口，业务需接入暂停和音频控制；
首次交互前静音、真实容器生命周期、安全区和官方预览仍需验证。
不提供假下载跳转或自动 mock SDK；普通浏览器中 SDK 缺失会明确报错。

静态校验覆盖 ZIP 大小、方向、必要入口、HTML/CSS 引用、导入映射、
远程资源配置和 MRAID。不能证明业务动态请求合规。
TikTok 文档同时描述禁止 HTTP 与包内资源并行下载，本原型先保留标准 Web 包内加载，
必须经官方预览验证后再决定是否需要内存加载方案。
`report.status=packaged` 仅代表本地打包成功，不表示投放审核或设备测试通过。

官方依据（2026-09-28 核对）：
https://ads.tiktok.com/resources/help/article/playable-ads?lang=zh

## 浏览器检查

```powershell
node scripts/preview.cjs <tiktok.zip路径> --mock-sdk
```

打开输出的本地 URL。该命令直接服务 ZIP 内文件；mock 只替换预览响应中的官方 SDK，
不修改 ZIP。用于检查引擎启动、资源加载及下载调用，不能替代官方预览。

## 微信平台结构对齐

已按 cocos-pal-wechat 分离 static/templates 和 i18n，安装脚本同步这些运行必需文件。
也可将仓库直接检出到 cocos-cli/packages/platforms/playable，构建后由 CLI 扫描；
这种目录布局无需再次复制安装。当前 D:/code/cocos-pal-playable 保持独立，通过 install:cli 安装产物。
具体对应关系与保留差异见 [对齐说明](docs/wechat-alignment.md)。

## Source Map 默认值

直接执行 `cocos build -p playable` 时，CLI 可能带入公共默认值 `sourceMaps: "inline"`。
Playable 在 `onBeforeInit` 中将本次任务的 sourceMaps 设为 false，再初始化编译参数；
不修改项目保存的配置，也不修改 debug 选项。无需为了这个默认值额外传配置文件。
