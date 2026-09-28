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
任务层传递真实的 `platform` 和 `platformType`；
`src/core/builder/worker/builder/asset-handler/script/build-script.ts` 的
`buildSystemJsCommand()` 在调用旧版 module-system 时，将 HTML5 类型映射为其支持的 Web 加载器名称。
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


## 渠道与打包职责

- src/hooks.cjs：连接 CLI 构建阶段，渲染 EJS 入口并交付打包。
- src/channel.cjs：渠道注册与选项校验；当前仅注册 TikTok。
- src/channels/tiktok.cjs：SDK 地址、方向文件、大小限制、外部引用例外和 TikTok 专用规则。
- src/packaging/web-files.cjs：收集构建资源、校验包内引用及远程资源配置。
- src/packaging/directory-zip.cjs：将文件集合编码为可复现的 ZIP。
- src/package.cjs：按渠道选择打包器，管理输出目录、大小检查和校验报告。

渠道分别声明 packageFormat 和 resourceMode；当前实现为 directory-zip + files。
单 HTML 和内嵌资源加载尚未实现；新增渠道时还需要实现并验证对应运行时 SDK 适配，不能仅新增配置就视为支持。
运行时仍由 runtime/playable.js 提供 TikTok 接口适配，与构建期 ZIP 编码分离。

## 设备测试后修正

TikTok SDK 使用已实测可访问的小写路径 `playable/sdk/playable-sdk.js`。
2026-09-28，大写路径返回 404，小写路径返回 200；小写路径亦见官方 TikTok Ad Network 文档：
https://ads.tiktok.com/resources/help/article/how-to-create-tiktok-pangle-playable-ads?lang=en
平台在 onAfterInit 设置 appTemplateData.showFPS=false，关闭交付页面性能面板；保留 debug 编译选项。

当前在线 SDK 请求 `__playable_ready_resources__.json`，读取相对路径数组并对照 Resource Timing 检查首屏加载；读取失败会报告加载监测错误。
它不是游戏资源加载器，也不是 ZIP 文件列表。当前尚无经验证的首屏依赖清单生成规则，暂不生成该文件，report.pending 显式记录此项。
不使用空数组伪造首屏完成，也不将可能按需加载的整个资源目录当作首屏清单；需结合官方验收确认清单生成责任。
