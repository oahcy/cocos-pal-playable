# Google Ads Playable（App campaigns）

官方规范：https://support.google.com/google-ads/answer/9981650?hl=en （2026-10-16 核对）。

渠道标识为 `google-ads`，配置见 `examples/google-ads.build.json`。

```powershell
npm run build
npm run install:cli -- D:/code/cocos-cli
node D:/code/cocos-cli/dist/cli.js build -j <项目目录> -p playable -c D:/code/cocos-pal-playable/examples/google-ads.build.json
```

交付文件为 `<构建目录>/playable-google-ads/google-ads.zip`，同目录生成 `report.json`。
ZIP 根目录包含 `index.html`，不生成 TikTok 的 `config.json`。
默认仅支持多文件 ZIP；请求 `single-html` 会明确拒绝。

## 游戏接口

在真实用户点击中调用 `playable.openStore()`，由 Google 适配器调用 `window.ExitApi.exit()`。
不传商店 URL，不自行跳转。SDK 使用官方 `exitapi.js`，在 head 中阻塞加载，先于运行时。
缺少 Exit API 时明确报错；普通浏览器验证使用 `npm run preview -- <google-ads.zip> --mock-sdk`。
预览 mock 仅改服务响应，不改交付文件，也不表示 Google 官方验证通过。

`finishNotification=false`，`containerLifecycle=false`：`finish()` 只标记本地结束，不跳转。
页面 visibilitychange 控制暂停与恢复，首次 pointerdown 之前保持静音策略。
业务音频仍须遵守 `playable.onMuteChange`；这不证明所有业务音频都已自动接入。

## 构建校验

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
