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

## 2026-09-29：Pangle 测试 APK 补测

验收范围按约定以测试 APK 为主。通过 ai-runtime 内存服务加载上述 SHA-256 为 c6ea3633…d65184 的原始 ZIP，未替换 SDK、未使用 mock、未修改场景状态、未落地测试脚本。本次为 Android 模拟器结果，不代表 TikTok 后台审核或物理真机验收。

| 项目 | 结果与证据 |
| --- | --- |
| 启动与 SDK | 场景 game 加载，openAppStore 为 function，SDK isReady 为 true，FPS 面板关闭。 |
| DOWNLOAD 跳转 | 实际点击按钮，Android VIEW Intent 指向 https://example.com/，Chrome 成为前台；返回后游戏恢复。仅测试链接，未测试真实商店安装。 |
| 前后台 | 下载跳转触发 pause/mute，返回触发 resume；Home 后 game.isPaused 为 true，间隔读取帧数均为 5346；从最近任务恢复后为 false，帧数由 5394 增长至 5456，场景仍为 game。 |
| 容器静音 | 存在缺口：点击 APK 喇叭，官方 SDK isMuted 返回 false → true → false，但 playable.onMuteChange 仅保留初次回调 false，未收到容器切换。当前接口只覆盖首次触摸及页面可见性。不能据此认定实际音频未静音，官方 SDK 还有音频处理；听感及实际游戏音效尚未验收。 |
| 完整玩法 | 被 demo 初始启用的 DownloadView 遮挡，结算页与新手引导叠加；未完成旋转、发射到自然结算的完整流程。保留用户场景修改。 |
| 方向与布局 | APK 竖屏、横屏均能渲染，横屏为竖版内容居中，两侧留白较大；结算页与引导叠加仍存在。仅确认显示，未认定横屏体验、安全区通过。 |
| 首屏资源监测 | __playable_ready_resources__.json 仍返回 404，延续上一轮待确认项。 |

阶段结论：启动、下载测试链接、基本前后台暂停恢复通过；完整玩法、容器静音通知与音频体验、布局仍有待处理项，不能标记为全部验收通过。下一步优先修正 demo 初始结算页配置，并补齐官方 SDK 静音事件到统一接口的映射后复测。本次仅追加验证记录，未修改实现、提交或推送。

## 2026-09-29：遮罩与容器静音修复复验

- demo 仅将 game.scene 的 DownloadView 初始 active 改为 false，保留其他已有场景改动。
- runtime 订阅官方 playableSDK 的 muteChange({ muted })，查询初始 isMuted()；保留首次触摸、后台静音规则，并防止旧异步查询覆盖较新的事件。containerLifecycle 能力仍为 false，没有扩展暂停接口承诺。
- 现有 11 项测试通过；通过 ai-runtime 内存运行的断言验证 SDK 事件、异步查询竞争、后台优先级和退订，未落地测试代码。
- 插件编译、安装、真实 demo 构建成功。新 ZIP：4,846,897 字节，SHA-256 e933983b4449d82f9c9577fde69f1c1b35755935342c143f142439b2eb6d319b。
- APK 加载此 ZIP 原始文件后 DownloadView 初始 false。真实拖动旋转、点击发射、连续发射自然触发结束页；未改分数或手动触发结束事件。本次分数为 0，覆盖游戏结束分支，未覆盖 93 分胜利分支。结束页与新手引导不再叠加。
- 首次交互前统一接口回调 true；交互后 false；实际点 APK 喇叭时，官方状态 true/false 对应统一接口序列 [true, false, true, false]，静音映射通过。
- 结束页 DOWNLOAD 实际点击后，Android VIEW Intent 指向 https://example.com/，Chrome 成为前台；切回后 hidden=false、game.isPaused=false、scene=game。浏览器出现离线提示，本项仅验跳转，不验目标网络可用性或商店安装。
- 诊断监听已移除。本轮未提交、未推送。音效听感、胜利分支、横屏体验/安全区及首屏资源清单仍待验证，前述未通过项按本节结果更新。

## 2026-09-29：公共运行时与 TikTok 适配器拆分

- 新增 runtime/core.cjs 和 runtime/adapters/tiktok.cjs，runtime/playable.js 仅组合二者。分发仍为单个 playable-runtime.js，无新增运行时全局注册表。
- 游戏接口增加 channel、ready、onReady；SDK 就绪不代表资源就绪或可展示。晚订阅立即调用，等待中的订阅支持退订。下载、结束、暂停恢复、静音的游戏调用保持不变。
- 现有 11 项测试通过；仅调整已有测试的入口与 SDK fixture 以对应模块拆分。未新增诊断脚本。额外在 ai-runtime 内存验证公共层可独立使用替代适配器、就绪单次通知/晚订阅/退订及结束幂等。
- 编译、安装、demo CLI 构建通过。ZIP 4,847,300 字节，SHA-256 63402cfa18e9f70f5e76f2f44d777d9ea3991885984b939d3e94b40308d4a114。
- APK 从新 ZIP 原样加载，曾一次未加载到远端 SDK，运行时明确报 SDK unavailable；重新加载后 SDK 正常，channel=tiktok、ready=true，onReady 晚订阅收到一次通知。
- 实际拖动、点击发射后第 6 次发射自然进入结束页；SDK 静音开关对应统一事件 true/false；实际点击结束页 DOWNLOAD，Android VIEW Intent 指向 https://example.com/。
- 跳转后 hidden=true、game.isPaused=true、收到 pause/mute；返回后 hidden=false、game.isPaused=false、收到 resume/unmute。临时监听已退订清理。
- finishNotification 与 containerLifecycle 仍为 false；未接入其他渠道、SDK 展示事件、通用埋点或自动启动门控。音效听感、胜利分支、安全区和首屏资源清单沿用待验证项。未提交或推送。

## TypeScript 运行时迁移

- 公共层 core.ts、适配器 adapters/tiktok.ts、入口 index.ts；内部契约 adapter.ts。公共层直接实现现有 PlayableAPI 声明，SDK 回调与返回值显式类型化。
- 新增 TypeScript 5.9.3 开发依赖及严格 tsconfig；构建先 tsc --noEmit，再 esbuild 打包。SDK 能力与游戏接口保持原约定，构建期 CJS 脚本不变。
- npm test（含严格类型检查、运行时打包和原有 11 项测试）通过，插件已重新安装到本地 CLI。未新增测试文件。本轮未重建 demo ZIP、未重复 APK 验证；上节 APK 结果对应迁移前 ZIP。未提交、未推送。

## 全仓 TypeScript 迁移

- src 构建钩子、渠道规则、资源检查与 ZIP 打包，scripts 构建/安装/预览工具，i18n 多语言源文件及原有 tests 全部改用 TypeScript。入口模板改名 index.ts.ejs。新增构建边界类型，不使用 any、ts-ignore 或关闭严格检查绕过迁移。
- npm run build / test / install:cli / preview 使用 tsx；tsc --noEmit 覆盖运行时、插件源码、脚本、多语言和既有测试。dist/*.cjs、dist/playable-runtime.js 以及 i18n/*.js 为生成产物，i18n JS 带生成标记，维护对应 .ts。
- 严格检查和原有 11 项测试通过；安装到本地 CLI，真实 demo 完整构建通过。npm pack --dry-run 确认实现 TS、测试和开发脚本未进入分发；保留游戏类型声明及入口模板。
- 通过 ai-runtime 内存诊断启动 TypeScript 预览工具，验证 HTTP 页面、mock SDK 和产物运行时能初始化 ready=true/channel=tiktok；测试后停止预览进程，未新增测试文件。mock SDK 补齐了就绪接口，以适配中间层。
- 本轮未重复 APK 验证，未提交、未推送。
产物：4847334 字节，SHA-256 257c39d7a652c61cead0d5cc1f0ce583b5f1fefa457cbbbfe1307c1600dd4cee。

## TikTok 展示控制与结束通知（2026-09-29）

- 接入当前官方小写路径 SDK 的 isViewable / visibilityChange({viewable,isInit}) 和 sendEvent("finishPlayPlayable")。finishNotification/containerLifecycle 均为 true；通知发送不等于广告后台确认接收。
- 入口使用引擎 onPostProjectInitDelegate 预加载启动场景，等待 SDK 与页面/容器允许展示后继续 game.run。公共层忽略过期初始查询，合并页面和容器状态、去重通知。
- 严格类型检查和现有 11 项测试通过；ai-runtime 内存断言通过：过期查询不得覆盖新事件、双重可见性、结束只发送一次、不自动下载，以及资源/SDK/展示三个条件未齐时不启动。未新增测试脚本。
- 安装本地 CLI 后实际 demo 构建通过。ZIP 4,849,673 字节，SHA-256 150c5e1eae21b326c0b8cc02bfd582427675bca13b5f50d79e852bdd56a47ef4。
- Pangle 测试 APK 加载 ZIP 原始文件和在线官方 SDK：game 场景正常；实际拖动并发射 6 次自然进入结束页，捕获一次 finishPlayPlayable，未自动跳转。demo 在 gameEndEvent 调用 finish，CTA 仅 openStore。
- 原生静音按钮 true/false 与公共层、AudioController.adMuted 同步。这里只验证静音控制链路，未确认扬声器听感。
- 点击结束页 DOWNLOAD 后页面隐藏、SDK visibilityChange=false、viewable=false、game.isPaused=true；返回后 SDK visibilityChange=true、viewable=true、game.isPaused=false。暂停/恢复各通知一次。临时包装和监听已清理。
- APK 覆盖自然失败结束；93 分胜利分支仍未实际通关验证。首屏资源清单、安全区、音效听感等既有待验证项不变。没有广告后台审核或投放验收结论。未提交、未推送。

## 设计收敛与启动模块整理（2026-09-29）

- 新增 runtime/startup.ts：启动逻辑纳入严格 TypeScript 检查；EJS 入口仅装配 Application 和 System.import。构建不增加新的渠道或打包策略。
- 广告只恢复自己暂停的主循环；业务预先暂停时不接管。隐藏期间新增业务 game.pause 的归属仍无法从引擎布尔状态区分，文档明确该限制，不修改引擎或包装其公开方法。
- 展示查询失败/非法响应进入启动失败提示，正常不可展示继续等待；较新事件优先于旧查询。回调异常逐个捕获，后续订阅继续执行。内部失败信号不扩充游戏公开 SDK。
- 严格类型检查、原有 11 项测试及 demo CLI 构建通过。ai-runtime 内存断言验证订阅异常隔离、业务预先暂停、广告暂停归属、SDK 查询失败；未新增测试脚本。
- 新 ZIP 4,848,470 字节，SHA-256 516e8c25809decba931aa10a7dfb4a8a960f0a7cf823b55a94f9a70a294d9534。
- Pangle APK 重新启动加载新 ZIP：game 场景可见，ready/viewable=true，无启动失败提示；实际切后台 viewable=false/paused=true，返回 true/false。
- 通过调试调用 game.pause 模拟业务暂停后，再实际切后台/返回，viewable=true 时 paused 仍为 true。测试后已主动恢复，未修改产物或 SDK。
- 设计文档本期范围收敛为 TikTok；其他渠道仅保留扩展方向。本轮未重测下载/自然结束、听感或胜利分支。未提交或推送。

## 首版补验（2026-09-29）

当前整理已提交 b85bade，未推送。本轮未修改平台运行时代码或 ZIP，测试使用上一节 516e8c... 产物。

- 用户先表示无法确认，随后明确回复“听到了”：记录为能听到音效，不额外声称音质测量通过。
- APK 实际旋转、换色、发射，分数 31/64/73/87/118，经过93分进入胜利页；一次 finishPlayPlayable。没有修改分数或强制结束；临时 sendEvent 包装已恢复。
- 竖屏重新加载同包；视频阶段 viewable=false 且无 game 场景，点击试玩后场景启动。实际发射后自然失败进入结束页。
- 横竖屏都发现常驻 Download 与换色按钮、底部装饰重叠；结束页 CTA 可见。APK 控件未覆盖结束页 CTA，但不代表 TikTok 官方安全区通过。
- 复核官方文档及当前 SDK，首屏资源清单是加载监测输入，未发现公开生成约定；保持待确认，不添加假清单。
- 完整交付命令、游戏接口、验收范围及剩余项见 docs/DELIVERY.md。本轮诊断均在 ai-runtime 内存执行，无新增测试脚本。

## 发布构建体积优化（2026-09-29）

- ZIP 原本已使用 DEFLATE level 9；此前无配置构建沿用 CLI debug=true 默认值。使用 examples/tiktok.build.json 的 debug=false 重建后，4,848,470 → 4,541,438 字节，减少 307,032 字节（6.33%）。新 SHA-256：8a1981cfcafac709c78c5c3942608244c41dfedc200be950ce00f9be0d70436b。
- ZIP 内脚本压缩体积 877,742 → 571,988 字节；PNG、MP3、TTF、BIN 与优化前逐文件字节一致，没有降质或删除资源。
- 平台 commonOptions.debug 默认 false，显式 debug=true 仍允许；交付说明明确使用发布配置。新默认值已安装本地 CLI；本次 ZIP 通过显式发布配置生成。
- 严格类型检查和原有 11 项测试通过，真实构建通过。APK 确认加载发布引擎（cc.js decodedBodySize=2,115,090），game 场景启动，实际拖动/发射后进入结束页，ready/viewable=true。
- 本轮未改图像编码、字体裁剪或音频质量；PNG 占压缩包约 2.70 MB，是后续主要优化空间。图片无损重编码探测因当前 ai-runtime 未装 Pillow 而未执行，没有安装额外依赖。
- 未提交或推送。本条覆盖交付说明中的旧包体积快照。

## 可选 PNG 有损压缩（2026-09-29）

- 新增 imageCompression=none/lossy、imageQuality=1–100（默认 none/80）；收集后仅在内存量化 PNG，最终 ZIP 使用压缩图，中间目录与源素材不变。无体积收益、动画、高位深图片保留。
- 质量 80 的真实 CLI 构建通过：4,541,438 → 2,897,594 字节（减少 36.2%）；40 张 PNG 中 38 张改变，其他文件逐字节一致，原构建目录 PNG 与压缩前一致。SHA-256：5f49e44524679781662fc7809805054b925393da123d094af827b52592c4e4e5。
- ai-runtime 内存断言验证默认旁路、非法配置拒绝、损坏 PNG 拒绝、尺寸不变、透明渐变支持、文件不增大及其他类型不变。当前量化器会近似 alpha（个别原 alpha=254 的近不透明图片变为不透明），不承诺逐像素透明度一致。
- 内存重打包质量 40/80/100 分别为 2,641,584 / 2,897,594 / 3,144,954 字节；质量 80 与 CLI ZIP 完全一致。质量不是体积百分比，100 也不是无损。
- Pangle APK 读取质量 80 新 ZIP，Resource Timing 确认新 PNG 大小；game 场景正常、ready/viewable=true。实际拖动和 7 次发射后自然进入结束页；画面、透明边缘及结束 CTA 未见明显异常。本轮未重复音频、下载及后台生命周期验收。
- 原 11 项测试与严格 TS 检查通过；本轮新增诊断代码仅在 ai-runtime 内存运行。未提交、未推送。

## 本版收尾（2026-09-29）

- 收录发布构建默认值与可选 PNG 有损压缩，代码、配置示例和交付说明一并归档。前述“未提交”是当轮验证时的状态。
- 本地 CLI 已安装本版；当前交付包仍为质量 80 的 2,897,594 字节 ZIP，未更换已验收产物。最后的 APNG 保护检查及重打包与当前 ZIP 字节一致性断言通过。
- pink 仅完成参数契约与平台配置声明，面板和传参联调后续进行；其他渠道、正式投放验收不属于本版完成范围。

## 结构整理（2026-10-08）

- options.ts 集中平台参数默认值、解析与校验；channel.ts 仅注册及查找渠道。config.ts 复用相同默认值，图片模块保留参数边界校验。
- template.ts 接管 EJS 渲染、入口编译及文件输出；hooks.ts 保留构建生命周期调度和 MD5 配置。builder-types.ts 隔离 CLI 类型，方向、交付状态及检查范围类型收紧。
- runtime/index.ts 提供公共 installRuntime；runtime/entries/tiktok.ts 显式装配 TikTok，构建脚本指向该入口。没有增加渠道或动态注册框架。
- 通过 ai-runtime 运行严格 TS 检查和原有 11 项测试；内存断言覆盖配置默认值一致、非法输入，以及重构前后就绪/可见性/静音/暂停恢复/下载/结束去重/SDK 缺失错误处理的行为一致性。未新增落地诊断脚本。
- 安装到本地 CLI 并重新构建真实项目，质量 80 ZIP 为 2,897,618 字节，比上一版增加 24 字节；逐条目对比仅 playable-runtime.js 改变，入口页面和全部其他资源字节一致。SHA-256：58c2d881e86fc68eef127eac811a68af14a54449851574a8cc66d4b71c7577b8。
- 第一次真实构建因上次 ai-runtime 检查遗留的 curz 文件句柄锁定 ZIP 而失败；关闭该检查句柄后重建成功，没有修改打包错误策略。
- 本轮模拟器在线，但没有测试 APK 的可调试 WebView，旧调试连接已失效；未重复 APK 画面与实际交互验收。前述运行时行为比较使用内存模拟 SDK，不等同于 APK 验收。未提交、未推送。

## 结构整理后的 APK 补验（2026-10-08）

- 打开模拟器已安装的 Pangle Demo，进入 All Test Tool → Playable 验证页后成功重新发现并连接 WebView；此前没有调试目标仅因未打开试玩页，不是 APK 不可用。
- 使用本次 2,897,618 字节 ZIP（SHA-256 58c2d881e86fc68eef127eac811a68af14a54449851574a8cc66d4b71c7577b8），内存 HTTP 服务提供原始 ZIP 文件及官方在线 SDK。校验服务响应的 runtime 与 ZIP 一致，WebView Resource Timing 的 runtime 解码大小为 5,257 字节。
- 竖屏 game 场景正常，ready/viewable=true、paused=false，无启动失败提示；截图确认画面显示。实际拖动、7 次发射后自然出现结束页，捕获一次 finishPlayPlayable，未强制设置游戏状态；临时 SDK 观测包装已恢复并清理。
- 点击结束页 DOWNLOAD 后 Android VIEW Intent 指向 https://example.com/，系统 Chrome 打开；广告 viewable=false、paused=true。切回 Pangle 后 viewable=true、paused=false，结束页仍存在。仅证明跳转链路，不要求测试站点网络加载成功。
- 本次诊断通过 ai-runtime 完成，无新增落地测试脚本。未重测横屏、音效听感、胜利分支或广告后台审核；本条补充并更新上一节未做 APK 验收的状态。未提交、未推送。

## Google Ads Playable 渠道（2026-10-16）

- 新增 google-ads 渠道、独立 Exit API 运行时、head SDK 和方向元信息、ZIP 与文件数校验。
- npm test：29 项通过，包含 Google 三方向 ZIP、无效结构、外链、文件数、包体、字体待审、运行时静音与可见性、编译后构建钩子及原 TikTok/单 HTML 回归。
- 源码构建成功，已通过 install:cli 同步到 D:/code/cocos-cli/packages/platforms/playable。
- 真实 smoke 项目经 cocos-cli 构建成功（启用 MD5），交付 .local/smoke-project/build/google-ads-smoke-delivery/google-ads.zip。
- Google 字体规则要求核对来源；Cocos 内置 OpenSans 字体记录在 report.pending，不按扩展名声称其合规或不合规。
- 未上传 Google Ads，未验证真实容器或商店跳转；业务动态网络、localStorage、SVG、响应式布局和音频仍需审核。
