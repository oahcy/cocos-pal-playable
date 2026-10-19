# 试玩配置与交付

CLI 安装见 [README](../README.md)，Creator 操作见 [Creator 3.8.3–3.8.4](creator-383_384.md)，Google 的专用规则见 [Google Ads](google-ads.md)。

## 构建配置

CLI 从 packages.playable 读取以下参数；Creator 面板传入同一组参数。

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
| channel | tiktok（默认）、google-ads |
| outputFormat | channel-default（默认）、directory-zip、single-html；受渠道支持范围限制 |
| orientation | auto（默认）、portrait、landscape |
| imageCompression | none（默认）、lossy |
| imageQuality | 整数 1–100，默认 80，越高越保真；不是压缩百分比 |
| embeddedEncoding | base64（默认）、base122；仅单 HTML 生效 |

完整配置见 examples/。发布构建使用 debug=false；CLI 自动关闭本次任务的 Source Maps。引擎属性混淆可参考 tiktok.mangle.build.json，业务脚本控制流混淆不在范围内。pink 专用面板尚未接入。

## 产物与预览

输出在构建目录旁的 <目录>-delivery/，含广告包、报告和所有权标记。默认 TikTok 输出 tiktok.zip，Google 输出 google-ads.zip；报告记录体积、SHA-256、图片处理和待验项。上传广告包，不上传报告；构建失败不可沿用旧包。

体积超限只打印错误日志，不中断构建，仍输出产物及哈希。报告保持 status=packaged，同时设置 sizeLimitExceeded=true 和 sizeLimitError；这表示包已生成但不满足大小限制。资源缺失、非法引用、编码或写入失败仍会阻止打包。

TikTok 单 HTML 输出 tiktok.experimental.html 和 single-html.report.json，与 ZIP 互不覆盖。它只用于格式验证，不表示 TikTok 接受此投放格式；报告标记 channelDefaultFormat=false，并保守沿用渠道大小上限。Google 当前只支持 ZIP。

已有试玩构建目录可重新封装为 HTML：

```powershell
npm run build
npm run single-html -- <试玩构建目录> 80 base122
npm run preview -- <ZIP或HTML路径> --mock-sdk
```

single-html 命令省略质量参数时保留原图。预览只有显式传入 --mock-sdk 才模拟 SDK，且不修改产物；正式环境缺少 SDK 会报错。

## 图片压缩

lossy 对普通 8 位 PNG 做调色板量化，保持路径、尺寸与 PNG 格式，但颜色和半透明像素可能近似。质量 100 仍可能有损；需要原图应选 none。动画、高位深 PNG 和其他图片格式保持不变；法线图、数据纹理等像素敏感素材不宜开启。

处理发生在资源收集后、ZIP/HTML 编码前，原素材和中间构建文件不变。只有 PNG 自身及其 DEFLATE 体积都减小时才采用压缩结果，否则保留原文件。报告 images 记录逐图结果，最终包大小见 bytes。

CLI 插件携带 sharp；Creator 从编辑器目录加载宿主版本。关闭压缩时不加载它，广告包中不包含该工具。

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

运行时公共逻辑在 runtime/core.ts，启动控制在 runtime/startup.ts，渠道实现位于 runtime/adapters/；构建时显式选择 runtime/entries/ 入口。内部契约以 runtime/adapter.ts 为准，不做运行时渠道探测，__startPlayable 不是游戏 API。

## 验收边界

本地校验和 report.status=packaged 不代表平台审核通过，已完成范围见 [验证记录](../VALIDATION.md)。动态请求、实际画面、音频、字体来源、官方安全区和后台投放仍需验证。

TikTok SDK 曾观察到读取 __playable_ready_resources__.json 用于首屏监测；其生成责任和依赖口径尚未确认。当前不生成空清单或整包文件列表来伪造就绪，保留 report.pending。

官方参考：[素材规范](https://ads.tiktok.com/resources/help/article/playable-ads?lang=en)、[创建与测试](https://ads.tiktok.com/resources/help/article/how-to-create-playable-ads-on-tiktok-ads-manager?lang=en)。
