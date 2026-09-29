# Cocos Playable 平台（开发原型）

私有源码仓库：`oahcy/cocos-pal-playable`。当前仅实现 TikTok HTML5 ZIP。
Google Ads、AppLovin 和 pink 专用面板尚未实现。

## 本地接入

需要 Node.js 22、已完成初始化的 cocos-cli（本次开发基于 0.0.1-alpha.43）。

```powershell
npm install
npm test
npm run build
npm run install:cli -- D:/code/cocos-cli
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
按钮、结束 UI 由业务实现；`finish()` 幂等调用 TikTok SDK 的 `sendEvent("finishPlayPlayable")`，不自动跳转。
请在真实用户点击回调中调用 openStore。
运行时合并浏览器和容器可见性，启动模块控制广告暂停，业务接入静音事件；
APK 已验证启动、首次交互静音策略和容器生命周期；音效听感、安全区和官方后台仍需验证。
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
npm run preview -- <tiktok.zip路径> --mock-sdk
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

- src/hooks.ts：连接 CLI 构建阶段，渲染 EJS 入口并交付打包。
- src/channel.ts：渠道注册与选项校验；当前仅注册 TikTok。
- src/channels/tiktok.ts：SDK 地址、方向文件、大小限制、外部引用例外和 TikTok 专用规则。
- src/packaging/web-files.ts：收集构建资源、校验包内引用及远程资源配置。
- src/packaging/directory-zip.ts：将文件集合编码为可复现的 ZIP。
- src/package.ts：按渠道选择打包器，管理输出目录、大小检查和校验报告。

渠道分别声明 packageFormat 和 resourceMode；当前实现为 directory-zip + files。
单 HTML 和内嵌资源加载尚未实现；新增渠道时还需要实现并验证对应运行时 SDK 适配，不能仅新增配置就视为支持。
运行时仍由 runtime/index.ts 提供 TikTok 接口适配，与构建期 ZIP 编码分离。

## 设备测试后修正

TikTok SDK 使用已实测可访问的小写路径 `playable/sdk/playable-sdk.js`。
2026-09-28，大写路径返回 404，小写路径返回 200；小写路径亦见官方 TikTok Ad Network 文档：
https://ads.tiktok.com/resources/help/article/how-to-create-tiktok-pangle-playable-ads?lang=en
平台在 onAfterInit 设置 appTemplateData.showFPS=false，关闭交付页面性能面板；保留 debug 编译选项。

当前在线 SDK 请求 `__playable_ready_resources__.json`，读取相对路径数组并对照 Resource Timing 检查首屏加载；读取失败会报告加载监测错误。
它不是游戏资源加载器，也不是 ZIP 文件列表。当前尚无经验证的首屏依赖清单生成规则，暂不生成该文件，report.pending 显式记录此项。
不使用空数组伪造首屏完成，也不将可能按需加载的整个资源目录当作首屏清单；需结合官方验收确认清单生成责任。

## 运行时中间层

游戏侧接口见 runtime/playable.d.ts。公共层 runtime/core.ts 管理就绪、首次交互、页面可见性、静音、订阅与结束幂等；runtime/adapters/tiktok.ts 只负责官方 SDK。runtime/index.ts 是当前 TikTok 的构建入口，esbuild 将入口、公共层和适配器合成一个 playable-runtime.js。新增渠道时新增其适配器和构建入口，并由渠道构建配置选择；不运行时探测渠道、不建立动态插件注册框架。当前仍只支持 TikTok。

- channel：构建渠道标识。
- ready / onReady(callback)：仅表示 SDK 可用；已就绪时同步调用，未就绪时订阅一次，返回退订函数。不代表游戏资源已加载或容器允许展示，也不自动启动玩法。
- openStore()：只在用户操作时调用，交给适配器；失败抛错，不自行网页跳转、不伪造暂停事件。
- finish()：幂等，不跳转、不绘制结束页；TikTok 调用官方 SDK sendEvent("finishPlayPlayable")。游戏自然结束时调用，下载按钮只调用 openStore()。这是结束通知，不代表服务端已确认接收。
- viewable / onPause / onResume：合并页面可见性与 SDK visibilityChange / isViewable；两者都允许展示才恢复。查询未完成时不可展示，订阅只通知后续变化；重复状态不重复通知。TikTok containerLifecycle=true。
- onMuteChange：订阅时立即给出状态；首次触摸前、页面/容器隐藏或 SDK 静音时应静音。解除限制不覆盖游戏自己的静音设置。

内部适配器契约（首版）：

```ts
interface ChannelAdapter {
  channel: string;
  capabilities: {
    openStore: boolean;
    finishNotification: boolean;
    containerLifecycle: boolean;
  };
  init(sink: { ready(): void; mute(value: boolean): void; viewable(value: boolean): void; error(error: Error): void }): void;
  openStore(): void;
  finish?(): void; // finishNotification=true 时必须提供
}
```

init 每个页面调用一次，适配器将官方回调转换为 sink 通知。TikTok SDK 按模板先同步加载，isReady() 不为 true 或缺少 SDK 时初始化明确抛错，不将其视为浏览器预览。初始展示状态使用 isViewable() 查询，后续订阅 visibilityChange，较早发出的查询不得覆盖较新的事件。查询失败或响应类型无效时，通过内部 error 通知终止启动并显示失败提示；较新展示事件已提供有效状态时，忽略旧查询的失败。正常不可展示状态继续等待，不设置强行放行的超时。当前不实现异步 SDK 加载与通用埋点。测试仍保留原有 11 项用例，仅调整模块拆分后的测试加载入口；额外诊断断言在 ai-runtime 内存执行。

运行时源码使用 TypeScript；内部契约见 runtime/adapter.ts，游戏接口使用 runtime/playable.d.ts，公共层返回值直接受该声明约束。构建先执行 tsc --noEmit 严格类型检查，再用 esbuild 输出浏览器 IIFE；构建插件、脚本、多语言及已有测试同样使用 TypeScript，由 tsx 执行开发工具。

启动模板只装配 Application 与 System.import；runtime/startup.ts 接受严格类型检查，在 onPostProjectInitDelegate 中预加载启动场景、等待 SDK 就绪和 viewable=true，然后沿用 Application.start 的 game.run。广告层记录暂停归属，只恢复自己暂停的主循环；业务预先暂停时不接管。隐藏期间业务新增 game.pause 无法从布尔状态区分，仍需项目协调，菜单可独立使用 director.pause/resume。内部 __startPlayable 不是游戏 SDK 接口。启动错误显示通用失败提示，详细原因留在控制台；公共订阅回调异常逐个隔离，避免阻断后续通知。
