# 试玩配置与交付

构建、安装与验收命令见 [操作手册](ai-workflow.md)。

## 构建配置

CLI 从 `packages.playable` 读取以下参数。Creator 可为每个渠道单独配置。

```json
{
  "debug": false,
  "packages": {
    "playable": {
      "channel": "tiktok",
      "outputFormat": "channel-default",
      "orientation": "auto",
      "imageCompression": "lossy",
      "imageQuality": 80,
      "embeddedEncoding": "base64"
    }
  }
}
```

| 参数 | 可选值与默认值 |
| --- | --- |
| channel | tiktok（默认）、google-ads、applovin |
| storeUrl | AppLovin 必填，使用 HTTPS 商店链接 |
| outputFormat | channel-default（默认）、directory-zip、single-html；受渠道支持范围限制 |
| orientation | auto（默认）、portrait、landscape |
| imageCompression | none（默认）、lossy（PNG 量化、JPEG 重编码）、webp（WebP 有损） |
| imageQuality | 整数 1–100，默认 80，越高越保真；不是压缩百分比 |
| embeddedEncoding | base64（默认）、base122；仅单 HTML 生效 |

完整配置见 examples/。发布构建使用 debug=false；CLI 自动关闭本次任务的 Source Maps。引擎属性混淆可参考 tiktok.mangle.build.json，业务脚本控制流混淆不在范围内。pink 专用面板尚未接入。

## 产物与预览

输出在 `<构建目录>/playable-<渠道>/`，含广告包、报告和所有权标记，不再创建旁边的 `-delivery` 目录。渠道目录不参与资源收集；不同渠道的包和报告互不覆盖。默认 TikTok 输出 tiktok.zip，Google 输出 google-ads.zip；报告记录体积、SHA-256、图片处理和待验项。上传广告包，不上传报告；构建失败不可沿用旧包。

体积超限只打印错误日志，不中断构建，仍输出产物及哈希。报告保持 status=packaged，同时设置 sizeLimitExceeded=true 和 sizeLimitError；这表示包已生成但不满足大小限制。Google Ads ZIP 超过 512 个文件同样只打印错误并保留产物，报告设置 maxFiles、fileCountLimitExceeded 和 fileCountLimitError；未配置文件数上限的渠道不套用此限制。资源缺失、非法引用、编码或写入失败仍会阻止打包。

TikTok 单 HTML 输出 tiktok.experimental.html 和 single-html.report.json，与 ZIP 互不覆盖。它只用于格式验证，不表示 TikTok 接受此投放格式；报告标记 channelDefaultFormat=false，并保守沿用渠道大小上限。Google 当前只支持 ZIP。

重新封装、本地预览和自动验收见 [AI 操作手册](ai-workflow.md#本地预览和自动验收)。

## 图片压缩

lossy 对普通 8 位 PNG 做调色板量化，保持路径、尺寸与 PNG 格式，但颜色和半透明像素可能近似。质量 100 仍可能有损；需要原图应选 none。动画、高位深 PNG、已有 WebP 和其他图片格式保持不变；法线图、数据纹理等像素敏感素材不宜开启。

处理发生在资源收集后、ZIP/HTML 编码前，原素材和中间构建文件不变。只有 PNG 自身及其 DEFLATE 体积都减小时才采用压缩结果，否则保留原文件。报告 images 记录逐图结果，最终包大小见 bytes。

CLI 插件携带 sharp；Creator 从编辑器目录加载宿主版本。关闭压缩时不加载它，广告包中不包含该工具。

`webp` 对 PNG/JPEG 转码为有损 WebP，沿用 imageQuality（1–100），保留透明通道、尺寸与资源路径；实际格式由文件内容识别，因此能处理扩展名为 .jpg 的 PNG。动画、高位深、已有 WebP 保留原样；仅在裸文件和 ZIP 压缩后均变小时替换。单 HTML 的 Blob 和 CSS data URL 根据实际内容生成 MIME。目录 ZIP 保留原扩展名，由浏览器识别图片数据，需在目标广告 WebView 验收；法线图、数据纹理等像素敏感素材不宜开启。

页面的 PNG+JPEG 选项（imageCompression=lossy）也处理 JPEG：按实际内容识别，PNG 做调色板量化，JPEG 按同一 imageQuality 重新编码为 JPEG，保持各自格式、路径和尺寸。PNG 不转成 JPEG，透明图仍保留 PNG；只在裸文件和 ZIP 压缩后均更小时替换。JPEG 再编码仍会产生有损变化，不新增独立 JPEG 选项。

## 单 HTML 的资源加载

游戏文件以 ZIP 配合 Base64 或 Base122 内嵌；Base122 只减少编码膨胀，不改变画质。页面保留相同的渠道 SDK 引用和运行时，SDK 仍按渠道规则外链加载。

资源按需解压，并发请求复用解压任务和 Blob URL；SystemJS 保留原模块地址解析依赖。资源准备接在 load/preload 的 preprocess 之后，沿用引擎解码器；Bundle、合并 JSON、CCONB 二进制包、字体和插件脚本通过适配入口读取。不修改引擎源码或 XMLHttpRequest；单 HTML 包装 fetch，只将保留域名 `https://playable.invalid/` 的 GET 请求转到内嵌 Blob，其余请求原样交给浏览器。这样覆盖绕过 assetManager 的引擎 WASM/二进制加载。

JSON 缓存文本、每次独立解析；Blob 保留至页面销毁，不提前释放音频或字体引用。CCONB 保持 Creator 原始二进制数据，由 Creator 导出的 `cclegacy.internal.decodeCCONBinary` 解码。图片、音频、WASM、MP4/WebM 等随构建资源进入内嵌 ZIP，运行时沿引擎资源管线解析为 Blob URL，并设置常见格式的 MIME。视频编码能否播放仍取决于目标浏览器/WebView 的解码能力。当前仍拒绝 scoped import map 和 CSS @import；普通相对地址或外部地址的自定义网络请求不会自动映射到内嵌文件，目标移动 WebView 需单独验证。

## 游戏接口与启动

将 runtime/playable.d.ts 放入项目类型检查范围。按钮、结束 UI 和业务音频由游戏实现。

```ts
playable.openStore(); // 仅在用户主动点击时调用
playable.finish();    // 自然结束时通知；幂等，不自动跳转
const off = playable.onMuteChange(muted => { /* 更新业务音频 */ });
// 组件销毁时调用 off()
```

- ready / onReady：仅表示 SDK 可用，不代表资源加载完毕或允许展示；已就绪时同步回调，未就绪时订阅一次。
- openStore：转发渠道下载接口，失败抛错，不自行网页跳转。
- finish：按渠道能力发送结束通知；TikTok 调用 finishPlayPlayable，不代表服务端确认。
- viewable / onPause / onResume：合并页面与容器可见性，按状态变化通知。TikTok 初始查询完成前不展示，旧查询不得覆盖新事件。
- onMuteChange：订阅时立即通知；首次触摸前、隐藏或 SDK 静音时应静音，不覆盖业务自身的静音设置。

启动器预加载启动场景，等待 SDK 就绪和允许展示后启动游戏。广告隐藏时暂停，只恢复广告自己暂停的主循环；业务在隐藏期间再次 pause 的归属需自行协调。启动错误显示通用提示，具体原因留在控制台，订阅回调异常独立处理。

运行时公共逻辑在 runtime/core.ts，启动及 settings 适配在 src/adapters/ 中，由发布 profile 的 applicationAdapter 选择，渠道实现位于 runtime/adapters/；构建时显式选择 runtime/entries/ 入口。内部契约以 runtime/adapter.ts 为准，不做运行时渠道探测，__startPlayable 不是游戏 API。

## 验收边界

本地校验和 report.status=packaged 不代表平台审核通过，已完成范围见 [验证记录](../VALIDATION.md)。动态请求、实际画面、音频、字体来源、官方安全区和后台投放仍需验证。

TikTok SDK 曾观察到读取 __playable_ready_resources__.json 用于首屏监测；其生成责任和依赖口径尚未确认。当前不生成空清单或整包文件列表来伪造就绪，保留 report.pending。

官方参考：[素材规范](https://ads.tiktok.com/resources/help/article/playable-ads?lang=en)、[创建与测试](https://ads.tiktok.com/resources/help/article/how-to-create-playable-ads-on-tiktok-ads-manager?lang=en)。

## 渠道专用规则

### Google Ads（App campaigns）

官方规范：https://support.google.com/google-ads/answer/9981650?hl=en （2026-10-16 核对）。

渠道标识为 `google-ads`，配置见 [Google Ads 配置示例](../examples/google-ads.build.json)。

按 [CLI 联调流程](ai-workflow.md#cli-联调与-cocos-pack-发布) 构建，配置文件选用上述 Google Ads 示例。

交付文件为 `<构建目录>/playable-google-ads/google-ads.zip`，同目录生成 `report.json`。
ZIP 根目录包含 `index.html`，不生成 TikTok 的 `config.json`。
默认仅支持多文件 ZIP；请求 `single-html` 会明确拒绝。

#### 游戏接口

在真实用户点击中调用 `playable.openStore()`，由 Google 适配器调用 `window.ExitApi.exit()`。
不传商店 URL，不自行跳转。SDK 使用官方 `exitapi.js`，在 head 中阻塞加载，先于运行时。
缺少 Exit API 时明确报错；普通浏览器验证使用 [渠道 SDK Mock 预览](ai-workflow.md#本地预览和自动验收)。

`finishNotification=false`，`containerLifecycle=false`：`finish()` 只标记本地结束，不跳转。
页面 visibilitychange 控制暂停与恢复，首次 pointerdown 之前保持静音策略。
业务音频仍须遵守 `playable.onMuteChange`；这不证明所有业务音频都已自动接入。

#### 构建校验

- ZIP 不超过 5,000,000 字节（共享字段使用 exclusive cap，因此值为 5,000,001）。
- ZIP 规范上限为 512 个文件；超限记录错误并保留 ZIP，报告标记 fileCountLimitExceeded=true，不代表满足投放规范。保留 UTF-8 页面与响应式画布。
- head 中生成唯一 `ad.orientation`：portrait、landscape 或 portrait,landscape。
- DOCTYPE、html/body 显式闭合标签、官方 Exit API 的位置和加载顺序。
- 复用公共相对路径、文件存在性、import-map、Bundle 和远程资源配置检查。
- Google 仅允许 Google web fonts。包内 ttf/otf/woff 等字体逐项列入 pending，需核对来源及上传接受情况；扩展名不能证明字体来源。
- 外部引用白名单限于 Exit API 和官方规范列出的 Google 托管库地址。

静态检查不分析任意 JavaScript 的动态 URL、存储调用、动态 DOM 或网络行为。
业务必须移除 localStorage 等本地存储调用，并核对 SVG 显式闭合、音频与布局。
pending 会保留这些运行时和人工审核事项；本地 packaged 不等于 Google 接受素材。

该渠道只支持 Google Ads 应用安装试玩素材，不接入 AdMob 原生 SDK、Google Play Billing 或自动投放 API。
不承诺其他 Google 广告类型共享这一套规则。

### AppLovin

在独立 Playable 平台勾选 AppLovin，可与 TikTok、Google Ads 同时构建。
输出为 `<构建目录>/playable-applovin/applovin.html`，渠道默认即单 HTML，不提供 ZIP。

- `orientation` 必须为 `auto`，游戏需实际支持横竖屏。
- `storeUrl` 填入实际投放应用的 HTTPS 商店链接；由 `playable.openStore()` 调用 `mraid.open(storeUrl)`。
- `embeddedEncoding` 可选 `base64` / `base122`；图片压缩沿用 `imageCompression`、`imageQuality`。
- 最大 5,000,000 字节，超限记录错误并保留产物，不表示可以投放。

MRAID 由广告容器提供，通过 `mraid.js` 加载，不附带模拟 SDK。运行时等待 MRAID ready，再查询可见性、启动场景；隐藏时通过已有 pause/mute 事件通知游戏。MRAID 2.0 没有通用试玩结束上报，`finish()` 只作本地标记。

开发预览使用 [渠道 SDK Mock](ai-workflow.md#本地预览和自动验收)。游戏应响应 `onMuteChange`，在首次交互后计时，禁止自动跳转或首次交互直接跳转。实际音频、横竖屏、动态网络请求及 WebGL 失败恢复仍需项目和真机验证；静态校验无法证明这些行为全部合规。

官方验证入口及规范：https://p.applov.in/playablePreview?create=1
先验证官方网页预览，再使用 AppLovin Playable Preview App 验证；本地报告不代表官方验收。

#### Playable Analytics 待办

暂不接入 `trackEvent`，不改变当前启动、交互和下载跳转流程；目前不提供挑战进度、成功/失败等 Analytics 数据。

后续增加可选 `playable.trackEvent`，由 AppLovin adapter 检查容器的 `ALPlayableAnalytics` 并转发官方预定义事件。事件名、顺序和调用时机按官方规范实现；不能假定生命周期事件会自动上报，也不能把 SDK ready、`finish()` 分别直接等同于内容可交互或结束页展示。

官方文档：https://support.applovin.com/en/growth/promoting-your-apps/welcome-to-applovin/playable-analytics-integration
