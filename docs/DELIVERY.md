# TikTok 首版交付说明

范围：CLI 构建 TikTok HTML5 ZIP，使用 Pangle 测试 APK 验证；不含其他渠道、pink 面板、广告后台审核或正式投放。

## 构建

需要 Node.js 22、完成初始化的 cocos-cli，以及外部 HTML5 平台 SystemJS 兼容修复（见 README）。在本仓库执行：

```powershell
npm ci
npm test
npm run install:cli -- D:/code/cocos-cli
node D:/code/cocos-cli/dist/cli.js build -j D:/prj/playable-demo -p playable -c D:/code/cocos-pal-playable/examples/tiktok.build.json
```

交付使用 debug=false 发布配置（examples/tiktok.build.json），以启用现有引擎/脚本压缩和资源序列化压缩。平台默认 debug=false，显式调试配置仍可覆盖；ZIP 已采用 DEFLATE level 9。
产物位于项目 build/playable-delivery/tiktok.zip；同目录 report.json 记录大小、SHA-256、静态检查和待验项。广告平台上传 ZIP，不上传 report.json；构建失败时不可使用旧包。

## 可选 PNG 有损压缩

在构建配置中设置（完整示例：examples/tiktok.lossy.build.json）：

```json
{
  "debug": false,
  "packages": {
    "playable": {
      "channel": "tiktok",
      "imageCompression": "lossy",
      "imageQuality": 80
    }
  }
}
```

imageCompression 默认 none，开启填 lossy；imageQuality 默认 80，范围为整数 1–100，越高越保真，不代表压缩百分比。100 仍可能有损，需要原图请设 none。

当前只处理普通 8 位 PNG，采用调色板量化，保持路径、尺寸和 PNG 格式，支持透明背景；颜色和半透明像素会有近似。动画及高位深 PNG 保留，其他格式不变。不要对法线图、数据纹理等要求像素精确的项目开启此选项。

处理发生在 onAfterBuild 收集资源之后、生成 ZIP 之前；项目原图及中间构建文件不变。PNG 本身和其 DEFLATE 体积均更小时才替换，否则保留原文件。report.json 的 images 字段记录质量、每张图的处理结果和前后大小（图像字节，最终 ZIP 大小见 bytes）。

有损模式需要宿主可用的 sharp 0.32.x 原生依赖；当前 cocos-cli 已有 0.32.6。插件将 sharp 保留为外部可选 peer 依赖，开发安装使用固定版本；关闭压缩时不会加载它，不将该工具打入广告 ZIP。

本项目实测（仅代表当前素材）：

| 配置 | ZIP 字节 |
| --- | ---: |
| 不压缩图片 | 4,541,438 |
| 质量 40 | 2,641,584 |
| 质量 80 | 2,897,594 |
| 质量 100 | 3,144,954 |

质量 80 减少 36.2%，已复测 APK 启动、拖动、发射和自然结束页。质量 40/100 仅完成内存打包及图片解码检查，未做 APK 画面验收。

## pink 后续接入

平台已在 src/config.ts 声明 imageCompression 和 imageQuality，CLI 从 packages.playable 读取并校验；pink 后续沿用同一配置结构传入，不重复实现压缩。面板提供压缩方式选择和质量输入，质量控件仅在 lossy 模式显示。当前尚未实现或联调 pink 面板，配置声明不代表面板已自动支持。

## 游戏接入

将 runtime/playable.d.ts 放到项目类型检查范围内。

```ts
// 用户主动点击下载按钮。
playable.openStore();
// 游戏自然结束；幂等，不自动跳转或绘制结束 UI。
playable.finish();
// 与业务自身静音设置共同决定是否发声；销毁组件时退订。
const off = playable.onMuteChange(muted => { /* 更新业务音频状态 */ });
```

启动器预加载启动场景并等待 SDK 与展示状态；模板无需业务手动启动。广告隐藏暂停主循环，返回只恢复广告自己施加的暂停。业务在广告隐藏期间新增 game.pause 的归属仍需协调。

## 2026-09-29 验收快照

本版当前交付包使用质量 80，大小 2,897,594 字节，SHA-256 5f49e44524679781662fc7809805054b925393da123d094af827b52592c4e4e5。下述早期包记录用于说明各项验收对应的产物；本版图片压缩的复测范围见上文。

原始 APK 补验对应代码 b85bade。随后使用发布配置优化：未开启图片压缩时 ZIP 4,541,438 字节，SHA-256 8a1981cfcafac709c78c5c3942608244c41dfedc200be950ce00f9be0d70436b，比调试包减少 6.33%。发布包已复测 APK 启动、拖动/发射和自然结束；胜利及完整生命周期记录对应前一调试包。

- 严格 TS 检查、11 项现有测试、真实项目构建通过。
- APK 横屏 2856×1280、竖屏 1280×2856 均能启动、交互、进入结束页。视频阶段 viewable=false，游戏场景未启动；点击试玩后进入 game 场景。
- 实际换色/旋转/发射，分数 31→64→73→87→118，经过 93 分触发胜利结束页，finishPlayPlayable 只发送一次；未修改分数或强制发出结束事件。竖屏另覆盖自然失败结束。
- 用户确认听到音效；既有验证确认原生静音与业务状态同步、切后台暂停和返回恢复、下载跳转。
- 发现 demo 常驻 Download 被换色按钮和底部装饰部分遮挡；结束页 CTA 可见。布局整体不标记通过，此项由 demo UI 调整。
- APK 原生关闭/静音控件未遮住结束页 CTA。未取得 TikTok 官方安全区遮罩，不等同于 TikTok 信息流安全区通过。

## 首屏资源清单结论

在线 SDK 读取根目录 __playable_ready_resources__.json，预期相对路径数组；过滤音频、外链和 index.html 后，与 Resource Timing 对照，约每 300ms 检查一次，约 30 秒后仍有缺失则记录超时。读取失败会记录首屏监测错误。以上来自当前 SDK 实现观察，不是稳定公开协议。

[官方素材规范](https://ads.tiktok.com/resources/help/article/playable-ads?lang=en)没有在本次查阅内容中说明该清单的生成责任或格式；未确认是否由上传处理生成。当前不生成空清单或把整个 ZIP 列入，以免误报就绪/超时；保留 report.pending。若需要生产验收，应向平台确认该清单是否由制作方提供及首屏依赖口径，再实现生成规则。

[官方创建与测试说明](https://ads.tiktok.com/resources/help/article/how-to-create-playable-ads-on-tiktok-ads-manager?lang=en)要求单独用安全区遮罩检查 UI；技术校验不替代可玩性和安全区检查。

## 验收边界

测试 APK 从本地 HTTP 服务读取 ZIP 原始文件并加载官方 SDK，未上传正式广告后台；不能据此声明后台审核、真实投放资源加载或所有设备通过。剩余项：demo 常驻按钮遮挡、官方安全区、首屏清单责任确认及后台验证。
