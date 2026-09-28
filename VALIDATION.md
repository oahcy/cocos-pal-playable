# 首版验证记录

日期：2026-09-28。

- 私有源码目录：D:/code/cocos-pal-playable，远端 oahcy/cocos-pal-playable。
- 插件成功安装到 cocos-cli/packages/platforms/playable，并由 CLI 注册。
- 8 项 Node 测试通过：ZIP 根目录、文件筛选、外部引用/缺失资源/远程配置/MRAID 拦截、失败清理旧 ZIP、压缩包超限、下载代理、静音和退订、配置校验。
- 普通文件名构建成功；MD5 文件名 + portrait 构建成功。
- 初版浏览器验证时的隔离场景 ZIP：2,548,662 字节，45 个文件。
- 初版浏览器验证时的 ZIP SHA-256：9768ea357f8f5da7ad452e492c43450d21f9a6d3aa9e3e697a3d21fe470af78a。
- ZIP 直接通过本地 HTTP 服务在浏览器加载，SDK 使用明确的预览 mock。修复后日志记录 LoadScene db://assets/scene.scene 成功，空场景背景已渲染。
- cocos-cli 通用修复：SystemJS 生成时按 HTML5 平台类型选择 Web 加载器；原先按 playable 名称选择到非浏览器加载器导致黑屏。CLI 的 tsc -b 通过。
- npm pack --dry-run 验证分发文件仅包含 dist、运行时类型声明、package.json、README；不包含 src、测试、隔离工程或源映射。

本次没有上传官方 TikTok 预览，也没有验证设备容器、音频业务接入、真实商店跳转和广告安全区。浏览器 smoke 不等于平台合规验收。
Google Ads、AppLovin、pink 专用配置面板以及正式发布流水线尚未实现。
本记录描述本地验证结果；不代表已发布或推送远端。

隔离工程及构建日志位于 .local/，已被 Git 忽略。


## 微信平台结构对齐后的复验

- 已分离 static/templates 和 i18n，并随安装与分发携带。
- 8 项测试、插件编译、安装与完整 MD5/竖屏构建通过。
- 当前 ZIP 为 2,548,671 字节；SHA-256：609e210d47f37fe9113414faf780b23580cb58c11e5965f17e96cc2183c48b97。
- npm pack --dry-run 确认模板、多语言文件和类型声明已包含，src 与测试未包含。
- 本轮未重复浏览器检查；前述浏览器记录对应初版产物。

## 无配置文件的 demo 构建回归

修复：CLI 公共 sourceMaps 默认值为 inline，插件在 onBeforeInit 自动归一为 false，替代直接拒绝。
9 项测试通过。原命令 `node dist/cli.js build -j D:/prj/playable-demo -p playable` 实测构建成功（42 秒）。
产物 D:/prj/playable-demo/build/playable-delivery/tiktok.zip，4,846,723 字节。
SHA-256：ff4fe02c2ce08cc1e3b3ba5a783858eca783048c7ac49bee53b7c28c55318e0c。
构建 JS 未检出内联或外置 Source Map 引用；此次未做浏览器或官方预览验证。

## 真实 demo：广告接口接入与浏览器验证

- 将 demo 的 DownloadBtn.ts、StopPropagation.ts 从 Bingo PlayableSDK 改为 playable.finish() / playable.openStore()；根目录增加 playable.d.ts 类型声明。
- 从 D:/code/cocos-cli 执行原构建命令成功。最终 ZIP 为 4,846,719 字节，距离当前 5,000,000 字节校验上限约 153 KB。
- 浏览器直接预览该 ZIP，使用显式 SDK mock，未上传任何广告平台。场景 game.scene 加载成功，3D 模型、贴图与 UI 可见。
- 点击 DOWNLOAD 和结束页遮罩均记录 openStore (mock; no redirect)。重建后无新增组件丢失错误，未出现 PlayableSDK is not defined。
- demo 原有未提交场景修改将 DownloadView 设为初始启用，结束页遮罩挡住玩法；本轮保留原场景设置，未完成旋转/发射/结算的全流程验证。
- 首次交互前静音、切后台音频与暂停、真机、官方预览和真实商店跳转仍待验证。画面中的 FPS 面板仍开启，正式交付前需检查调试配置。

排查记录：最初从引擎工作目录启动 CLI 时产生 exports is not defined；切换到 CLI 目录后仍有两处脚本缓存导致 Missing class，构建虽成功但按钮组件被移除。将 demo 的 temp/programming、temp/builder 备份到同目录的 *.playable-backup-* 后重建恢复。尚未修改 CLI 的工作目录/编译配置隔离逻辑；当前验证命令应从 cocos-cli 目录执行。
最终 ZIP SHA-256：8b8dd5bb10bdad7b8e437fe33691339a1088ededa331dbf0185bf1714201ab89。

## EJS 与渠道打包边界重构复验

入口模板改用 EJS（index.ejs、index.js.ejs），移除自定义模板替换。
TikTok SDK、方向文件、大小限制及专用规则移入 src/channels/tiktok.cjs；公共资源校验和 ZIP 编码分别位于 src/packaging/，由 src/package.cjs 编排。
渠道分别声明产物格式与资源模式，当前仅实现 directory-zip + files，未增加渠道或内嵌资源支持。
11 项测试通过（新增 SDK 缺失/顺序校验，以及不支持的渠道不能覆盖既有产物）。插件已编译并安装到本地 CLI，真实 demo 重建成功。
渠道边界重构前后 ZIP SHA-256 完全一致：de354435f4f231abcd579286e810bb2f8a2fb4b72dc7959d7b6f8a99b38fc4fc；大小 4,846,735 字节。
本轮未重复浏览器检查或官方平台验证；历史浏览器记录见上文。

## SDK 地址与交付性能面板修正

- 2026-09-28：Pangle 测试 APK / Android 模拟器中实测，大写 SDK 路径返回 404；小写路径返回 200。小写地址亦见 TikTok Ad Network 官方接入文档，已写回渠道配置。
- 此前仅在内存替换 SDK 后，按钮调用 openAppStore 已观察到；用户随后确认打开测试链接 example.com。该结果属于 Pangle 测试容器，不代表 TikTok 官方验收或真实商店安装验证。
- onAfterInit 将 appTemplateData.showFPS 设为 false，保留 debug 编译选项，不修改项目保存配置。
- 现有 11 项测试通过，插件编译、安装及真实 demo CLI 构建成功。新 ZIP 4,846,736 字节，107 个文件，SHA-256：c6ea363399fd4b40fed45225df790cd848dff0f92ae991288160615ea1d65184。
- ai-runtime 从新 ZIP 内存解包并直接提供 HTTP 响应，未替换 HTML/SDK、未添加 mock。CDP 检查：openAppStore 为 function，playableSDK.isReady() 为 true，场景为 game，profiler.isShowingStats() 为 false。此次未重新验证实际跳转。
- 在线 SDK 源码表明 __playable_ready_resources__.json 用于首屏资源加载监测，文件缺失会报告监测错误；不是游戏加载依赖。本轮暂不生成未经验证的首屏清单，已加入 report.pending，仍需官方验收确认。
- 本轮未新增测试脚本文件；诊断与产物检查通过内存执行。官方预览、全流程玩法、音频/生命周期、安全区仍未完成。
