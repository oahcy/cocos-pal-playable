# Playable SDK 验收 Demo

纯 HTML 页面，复用 runtime/core 和三个真实渠道 Adapter，覆盖 PlayableAPI 的全部属性、方法和退订函数。

在仓库根目录执行以下命令，一次生成三个渠道的产物。

```powershell
npm run demo:sdk
npm run demo:sdk -- --config="配置文件.json"
```

默认读取 examples/sdk-demo/config.json。title 控制页面标题，storeUrl 是 AppLovin 商店链接，outputDirectory 是相对仓库根目录的输出目录。后续占位内容统一放入此配置。上传测试前把 storeUrl 替换为实际 HTTPS 商店链接。

产物位于 outputDirectory/playable-<渠道>/，TikTok 和 Google 为 ZIP，AppLovin 为单 HTML。可传 --channel=tiktok 单独生成一个渠道，--out=目录 覆盖输出位置。

将产物上传对应平台。页面自动订阅 onReady、onPause、onResume 和 onMuteChange；下载与结束按钮调用 openStore 和 finish。读取状态显示 channel、ready、viewable、capabilities。取消监听调用四个退订函数，重新监听用于检查订阅恢复。

本地可执行 npm run preview -- "产物路径" --mock-sdk。也可使用 --mock-api，并通过 window.__playablePreview 控制状态。版本验收命令 verify:preview 的场景检查用于 Creator 产物；本示例的验证入口是页面状态和事件日志。
