# AppLovin

在独立 Playable 平台勾选 AppLovin，可与 TikTok、Google Ads 同时构建。
输出为 `<构建目录>/playable-applovin/applovin.html`，渠道默认即单 HTML，不提供 ZIP。

- `orientation` 必须为 `auto`，游戏需实际支持横竖屏。
- `storeUrl` 填入实际投放应用的 HTTPS 商店链接；由 `playable.openStore()` 调用 `mraid.open(storeUrl)`。
- `embeddedEncoding` 可选 `base64` / `base122`；图片压缩沿用 `imageCompression`、`imageQuality`。
- 最大 5,000,000 字节，超限记录错误并保留产物，不表示可以投放。

MRAID 由广告容器提供，通过 `mraid.js` 加载，不附带模拟 SDK。运行时等待 MRAID ready，再查询可见性、启动场景；隐藏时通过已有 pause/mute 事件通知游戏。MRAID 2.0 没有通用试玩结束上报，`finish()` 只作本地标记。

直接双击 HTML 没有 MRAID 环境。开发预览可用：

```powershell
npm run preview -- <applovin.html> --mock-sdk
```

模拟仅用于本地检查，不写入广告文件，也不会真正跳转。游戏应响应 `onMuteChange`，在首次交互后计时，禁止自动跳转或首次交互直接跳转。实际音频、横竖屏、动态网络请求及 WebGL 失败恢复仍需项目和真机验证；静态校验无法证明这些行为全部合规。

官方验证入口及规范：https://p.applov.in/playablePreview?create=1
先验证官方网页预览，再使用 AppLovin Playable Preview App 验证；本地报告不代表官方验收。

## 待办：Playable Analytics

暂不接入 `trackEvent`，不改变当前启动、交互和下载跳转流程；目前不提供挑战进度、成功/失败等 Analytics 数据。

后续增加可选 `playable.trackEvent`，由 AppLovin adapter 检查容器的 `ALPlayableAnalytics` 并转发官方预定义事件。事件名、顺序和调用时机按官方规范实现；不能假定生命周期事件会自动上报，也不能把 SDK ready、`finish()` 分别直接等同于内容可交互或结束页展示。

官方文档：https://support.applovin.com/en/growth/promoting-your-apps/welcome-to-applovin/playable-analytics-integration
