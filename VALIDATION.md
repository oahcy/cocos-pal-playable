# 验证结果

更新日期：2026-10-27。仅记录已经完成的验证；历史逐轮排查和中间产物哈希可从 Git 历史查询。

## 正式插件包与三渠道 UI 构建（2026-10-22）

- 通过根目录 `npm.cmd run pack-playable -- --creator-entry=platform 3.8.9` 生成 `CocosPack/v3.8.9-playable.zip`（125,576 字节）。补齐版本清单中的 3.8.9 / ccbuild 2.3.16 映射；依据为本地源码编辑器配套引擎 package.json。ZIP 校验通过，解包安装到源码编辑器 app/extension/playable 后，22 个清单文件 SHA-256 一致。
- 在已接入独立平台的 Creator 3.8.9 源码编辑器中打开 playable-demo，从“发布到 → 场景 → 试玩广告”进入配置。AppLovin 取消勾选收起详情、重新勾选保留参数；退出配置页再进入，三渠道选项保留，磁盘 Profile 与界面一致。
- 点击面板构建，一次任务约 68 秒完成，界面显示成功，构建日志无 warning/error。产物位于 `build/playable-007/`：TikTok ZIP 1,975,932 字节（质量 55），Google Ads ZIP 2,144,769 字节（质量 80），AppLovin Base64 单 HTML 2,969,903 字节（质量 80）；三份报告均 packaged、未超限且 SHA-256 一致。
- TikTok / Google ZIP 分别 103 / 102 个文件，AppLovin 内嵌 ZIP 99 个文件，全部 CRC 通过；各自 SDK 引用正确，没有嵌入其他渠道的交付目录。AppLovin 沿用工程已有的 https://baidu.com 测试链接，不代表正式商店地址。
- 本次覆盖正式打包入口、安装、真实面板配置保存与完整构建；未追加浏览器游戏运行、官方广告容器或真机验收。卡片仍使用本地 v3 测试包，未验证线上热更发布。

## Creator 3.8.9 独立平台（2026-10-21）

当前 cocos-editor 源码版已加入 playable 平台白名单和特性开关。插件安装在该编辑器的 app/extension/playable，日志确认 internalRegister pkg(playable) in playable platform success。此结果不扩展为所有原版 3.8.9 安装包都可注册。

- 使用 playable-demo 的隔离副本，保持当前打开的原工程不受影响。命令行构建 platform=playable；图片质量 60，单 HTML 使用 Base122。
- 单 HTML：2,391,846 字节，构建任务 46 秒；TikTok ZIP：1,995,767 字节，复用缓存构建任务 9 秒。两份报告均为 packaged；校验报告 SHA-256 和产物一致，ZIP 103 个条目通过 CRC，入口、SDK 引用和浏览器 SystemJS 加载器存在。
- Node 22.17.0 下完整 47 项自动测试通过；Node 18 环境的 CLI 依赖复制测试不通过，开发仍使用 README 要求的 Node 22。
- 本地 v3 卡片包的 UI 链路通过：在 playable-demo 点击“试玩广告”卡片进入独立配置页，确认 TikTok、channel-default、图片不压缩，点击构建；playable-002 任务约 59 秒完成，界面显示成功。生成 build/playable-002-delivery/tiktok.zip，3,788,982 字节、103 个条目，报告 SHA-256 和 ZIP CRC 校验通过。类型检查及新旧 Creator 适配器 4 项定向回归通过。
- 这次 UI 验证覆盖卡片、配置和构建，不包含游戏运行画面或官方广告容器。此前浏览器工具拒绝 file:// 本地产物预览，没有绕过此限制。
- 独立适配器及旧版适配器共用 creator-shared 的选项和交付编排，旧版 Web Mobile 行为保持回归覆盖。

### 历史独立平台适配准备（2026-10-21）

- 核对 Editor 本地 Git 标签 3.8.3–3.8.8 及源码版 3.8.9 的平台声明、构建参数和 module-system 接口；独立插件按 Node 14.16 / Node 20 分两组编译，共用一份适配源码。
- 按版本发布测试确认 3.8.4 与 3.8.6 生成 configs.playable，ZIP 文件清单校验通过。默认历史 Web Mobile 模式保持不变，独立平台不依赖旧入口适配器。
- 移除本轮新增的 Editor 源码补丁工具、命令和测试产物。宿主准入改动沿用对应 Editor 分支或既有版本补丁及重打包流程维护。
- 历史修改后编辑器的完整构建尚未验收；此前直接用已安装 3.8.4 的 CocosCreator.exe 执行 Node 验证未完成，不计为宿主验证通过。

## 渠道产物目录（2026-10-21）

最终广告包改为 `<构建目录>/<渠道>/`，Creator 两种入口与 CLI 共用此规则。类型检查、插件编译及 34 项相关回归通过，覆盖 ZIP、单 HTML、不同渠道报告隔离、重复打包排除已有广告包，以及无归属目录拒绝覆盖。历史 `-delivery` 目录不自动迁移或删除。本次尚未更新已安装的 Editor 插件或执行真实 Editor 构建。

## 独立平台多渠道（2026-10-21）

- 类型检查、插件编译通过；相关回归分两组执行，30/30、16/16 通过（有重复项）。生成插件包含 panel.cjs，3.8.4/3.8.6 分组发布校验通过。
- 模拟 Creator 一次构建生成 TikTok、Google Ads 两个包，验证 SDK、方向、config.json 隔离，共用 Web 文件不变；重复构建排除旧产物，未选渠道保留但不重建，单渠道失败后其他渠道继续输出。
- 使用实际面板 TypeScript 的浏览器测试页验证勾选展开、取消隐藏、Google 仅提供 ZIP、单 HTML 显示内嵌编码、空选择提示，以及重新勾选和刷新后恢复参数。测试页模拟 Editor 保存协议，尚未替代真实 Editor 面板构建验收。

渠道目录后续统一增加 playable- 前缀，输出为 <构建目录>/playable-<渠道>/。类型检查、编译及 36 项相关回归通过；旧目录不自动迁移或删除。

## 自动测试

2026-10-21 使用 Node 22.17.0 完成类型检查、插件编译和串行全量回归，55/55 项通过。覆盖渠道规则、ZIP/单 HTML、Base122、资源读取、CCONB、运行时行为、新旧宿主适配、版本选择及插件发布完整性。

本次审核先用回归复现准备阶段失败遗留成功产物、无效旧配置无法编辑两个问题，修复后通过。准备回调纳入打包失败处理，具名参数替代位置参数占位。浏览器面板验证旧质量值 0 能修正为 60，并在持续模拟无关配置更新时保留未提交输入。共用构建方向不依赖渠道顺序的回归通过。模拟宿主和浏览器面板测试不代替真实 Editor 多渠道完整构建或广告容器验收。

## cocos-pack 集成

源码已迁入 `cocos-pack/playable/`。根入口生成 3.8.3、3.8.4、3.8.5 三个独立安装 ZIP；同适配组编译一次，三份插件内容一致。已验证配置/钩子加载、ZIP CRC、清单 SHA-256、只读预览、版本筛选、无归属目录拒绝覆盖、旧目录与 ZIP 备份。迁入后的插件用户已确认测试无问题；本轮另在 Creator 3.8.5 完成全局安装和真实工程构建，见下文。热更下载配置和远程发布未接入。

## Creator 3.8.3

真实 demo 通过 Web Mobile 构建面板启用 Playable，TikTok ZIP 构建成功。图片有损压缩质量 80，38 张图片压缩成功；ZIP 为 3,396,587 字节、118 个文件，CRC 和报告 SHA-256 校验通过。

已处理 node: 模块名和 Object.hasOwn 的旧环境兼容问题。改用 Creator 自带 sharp 后，本次压缩构建未再崩溃。命令行构建仍以 -1 退出，使用编辑器面板完成验证。

此 3.8.3 产物尚未做游戏运行或广告容器验证。

## Creator 3.8.4 单 HTML

用户已确认 `cocos-test-projects` 最新 Base64 单 HTML 可以运行；更新最新版插件后，Creator 基础验证无问题。现有 Web 产物共 2187 个文件、348,432,827 字节；质量 65，内嵌 ZIP 为 159,324,726 字节。2184 个内嵌文件通过 CRC，1693 个未压缩改写资源与源文件逐字节一致。此大包用于兼容性测试，超限只记录错误并保留产物。

已验证的修复：

- Base122 分块编码、精确分配解码缓冲；Base64 预分配缓冲逐字节解码。两种编码通过 128 MiB 堆限制下的 16 MiB 数据回归，Base122 保持旧编码哈希兼容；启动时在 ZIP 解析前清空内嵌文本。
- Base122 打包曾在 Creator 自带 Electron 13.1.4 / Node 14.16.0 + Sharp 独立进程通过（堆限制 1024 MiB），输出 182,198,697 字节；这是打包进程验证，不代表该 Base122 产物已完成浏览器验收。
- Creator Spine 直接 fetch 模块相对路径的 WASM，现由保留域名路由读取内嵌 Blob。实际 Spine WASM（351,821 字节）通过字节一致性和流式编译测试；独立 CCONB 路由及解码异常回调通过回归。

尚未逐项验证 testcase 所有场景、媒体编码、广告容器和真机；SDK ready-resources 清单问题仍待确认。

## Creator 3.8.5

用户确认测试通过。3.8.3、3.8.4、3.8.5 归入 `creator-383_385` 共用适配组；未提供的具体场景、编码和渠道测试范围不作扩展推断。

2026-10-20 全局安装验证：

- 生成的 Creator 插件声明 `editor: 3.8.3 || 3.8.4 || 3.8.5`。在项目与全局同时存在同版本插件时，实际启用项目副本；退出编辑器后将项目副本移入 `temp` 备份，再启动只加载全局副本。
- `Editor.Package.getPath('playable')` 确认为 `C:/Users/delph/.CocosCreator/builtin-extensions/3.8.5/playable`。编辑器从其安装目录启动，真实 testcase Web Mobile 构建成功，耗时 2 分 41 秒。
- 单 HTML 使用 Base122、图片有损质量 65，506 张 PNG 中 491 张缩小、15 张保留原图。产物 `build/playable-global-check-delivery/tiktok.experimental.html` 为 182,030,250 字节，SHA-256 与报告一致；超限仅记录错误，构建状态为成功。
- 本轮验证全局插件加载及构建链路，未重新验收此 HTML 的游戏运行、广告容器，也未验证服务端下载或版本升级。

### playable-demo 快速回归（2026-10-20）

后续默认使用 `D:/prj/playable-demo`；大型 testcase 仅补测特殊资源或兼容性。该工程曾用高版本打开，先将 `library`、`temp` 移入 `local/creator-cache-20261020-105751/` 备份，再用 Creator 3.8.5 重建缓存。

全局 Playable 插件分别构建 TikTok ZIP 和单 HTML，均使用有损图片质量 65；单 HTML 使用 Base122。ZIP 为 3,099,888 字节（115 个条目），HTML 为 3,653,708 字节，均未超出当前大小检查限制。ZIP CRC 和两份产物的报告 SHA-256 一致性通过。首次 ZIP 构建约 74 秒，缓存后的单 HTML 构建约 12 秒。

本地静音预览验证两份产物的首屏、拖动、发射、下载按钮；控制台无 warning/error，下载按钮均触发模拟 SDK 的 openStore 日志。自动点击工具会附带同坐标 mousemove，demo 将其视为拖动，发射验证因此使用不附带 mousemove 的浏览器输入事件；未修改 demo 代码。预览服务和测试窗口已关闭。

这次使用模拟 SDK，不代表真实商店跳转、官方广告容器、音效或单 HTML 渠道格式验收。

## CLI 与 Pangle 测试 APK

历史 CLI TikTok 产物已在 Android 模拟器的 Pangle 测试 APK 验证启动、拖动/发射、自然结束、结束去重、静音与前后台暂停恢复，以及下载按钮跳转测试链接。用户确认过音效。有损质量 80 产物曾复测启动、交互与自然结束；这些结论不自动覆盖本次 Creator 产物。

APK 测试未上传正式广告后台，不代表 TikTok 信息流或物理真机验收。demo 常驻按钮遮挡和官方安全区仍需处理。

## Google Ads 与单 HTML

Google Ads：CLI 真实项目构建与静态检查通过；尚未完成平台上传、真实容器或商店跳转验证。

单 HTML：自动测试覆盖 CCONB、视频、WASM 二进制内嵌，MP4 Blob MIME、按需解压、Blob 复用和 Base64/Base122；Creator/WebView 端到端和具体媒体编码兼容仍需实际环境验证。Scoped import map、CSS @import 和普通业务网络请求的自动内嵌映射仍不支持。

## 待完成

- 按渠道生成独立插件包：保留现有 playable 多渠道入口，共用源码，通过发布配置指定插件名、平台名和包含的渠道（如 playable-tiktok、playable-google-ads）。单渠道包固定渠道并隐藏渠道选择，不依赖安装多渠道包；各插件的配置与构建输出隔离。复用宿主适配、资源处理和打包代码，不承诺跨独立构建任务复用引擎或资源构建。平台白名单由 Creator 同事负责，编辑器热更与缓存逻辑暂不处理。
- Creator testcase 更多场景、广告容器及真机验证。
- 官方平台预览/审核、安全区、业务动态网络和字体来源检查。
- SDK 首屏资源清单的生成责任与依赖口径确认。
- 卡片修正同步到 builder-workspace/apps/builder-web 正式源码并发布；本机无该仓库，目前只验证 Downloads 本地 v3 卡片包。
- 其他 Creator 版本的独立试玩平台入口、pink 面板，以及 AppLovin 官方预览和真机验证。

### 2026-10-26：Creator 3.5.2 正式适配源码

- 新增 creator-platform-300_352 profile；正式插件与平台名称均为 playable，目标 Node 14.16。旧版 Application/settings 差异隔离在适配器及启动模块；共用渠道、资源和压缩逻辑。
- 全量测试 67/67 通过，包括旧 settings 入口、未知模板拒绝、宿主 Web 钩子、插件生成及运行时协议选择。
- 正式生成包通过本地薄包装借用 gi-bytedance 白名单，使用安装版 Creator 3.5.2 构建兼容的 hello-3d-world 样例；三个渠道均成功生成。临时别名包装、工程和产物只放在 .local/ 或本机安装目录，不进发布包。
- TikTok ZIP 和 AppLovin 单 HTML 经浏览器 mock SDK 预览，场景正常显示，无 error/warn。Google Ads ZIP 已生成；不代表官方投放审核通过。
- CLI 日志显示构建成功；无头退出仍出现宿主 webContents 清理错误、进程退出码 36，因此不以退出码作为本次成功依据。
- 原版宿主尚未放开 playable 白名单，正式同名平台的完整 UI 链路待对应重打包 Editor 验收。其他早期版本未声明支持。

### 2026-10-26：启动适配集中重构

- 启动、settings 与启动模板归入 src/adapters/creator-300_352 或 application-class。发布 profile 选择 applicationAdapter，删除公共 runtime、单 HTML 入口及编译脚本中的 Creator 版本开关。
- 全量回归 68/68 通过；另补浏览器依赖图隔离检查，确保不引入构建端 hooks/config/application/sharp，也不引入另一套启动适配。
- Creator 3.5.2 借本地白名单薄包装完成三渠道实际构建；宿主 CLI 退出清理错误仍存在，构建日志及产物成功。
- 现代路径复用 playable-demo 的既有 3.8 Web 构建产物，通过新生成插件重新交付 TikTok ZIP 和 AppLovin HTML；本轮未重新编译现代 Editor 引擎。原 application.js 保持不变。
- 旧版样例与现代 demo 的 ZIP/单 HTML 共四份，经浏览器 mock SDK 预览均显示场景，无 error/warn；测试页面和预览服务均已关闭。现代 demo 本轮不压缩，AppLovin HTML 为 5,162,128 字节，超限日志和保留产物行为符合现有策略，不作为可投放包。

### 2026-10-27：3.5.2 安装包与用户 UI 构建验收

- 正式生成和打包保持 playable 名称；仅在生成后的测试副本统一改为 gi-bytedance，并重算校验清单。安装目录无临时包装层，源码不引入借名逻辑。
- application-modern 改名为 application-class；类型检查、构建与相关 9 项测试通过，启动行为不变。
- 用户从新版构建页重新构建 gi-bytedance-001；三个渠道的运行时代码与最新安装及正式生成包逐字节一致。
- TikTok ZIP 2,764,277 字节 / 49 文件；Google Ads ZIP 2,763,913 字节 / 48 文件；AppLovin HTML 3,793,949 字节，内嵌 ZIP 45 文件。SHA-256、CRC、报告大小、体积和文件数检查通过；PNG 有损质量 80。
- 三份用户产物经本地 mock SDK 预览，场景正常，无 error/warn；预览页面与服务已关闭。仍不替代官方投放及真机审核。

### 2026-10-27：试玩公共选项隐藏

- 独立平台隐藏调试、Source Maps、MD5 Cache、资源服务器及远程主包，初始化前统一覆盖旧 Profile 值。纹理压缩和启动图等保留；项目 Bundle 远程配置仍校验，旧 Web Mobile 入口不变。
- 类型检查及两组 Creator 适配测试 11/11 通过，覆盖隐藏配置、旧值归一和多渠道交付。
- 已生成并校验 3.5.2 插件；仅生成后测试副本使用 gi-bytedance，更新至全局准入目录。文件哈希及生成钩子验证通过，已替换此前 0.1.2 热更探测副本，无测试标记。需重启 Creator 刷新缓存后验收 UI，本轮未操作编辑器热更逻辑。

### 2026-10-27：移除 Web Mobile 附加构建入口

- 删除 creator-383_385 旧适配器和专用文档、deliverCreatorBuild 写回 Web 产物分支、插件启用开关类型、入口选择参数及重复版本映射。Creator 包统一注册 configs.playable，3.8.3–3.8.9 默认使用原独立平台映射，3.5.2 适配保持。
- 独立平台的宿主 Web 钩子和 SystemJS 浏览器加载器预设保留；未修改 Editor、引擎或 ccbuild。历史 Web Mobile 验证记录仅作历史证据，不表示当前仍提供该入口。
- 保留并迁移旧测试中的 Node 内置模块兼容、Sharp 解析、ZIP/单 HTML 打包与远程资源拒绝检查。类型检查、插件编译及全量 69/69 测试通过，生成的 Creator 包仅注册 playable。
- 旧安装副本和旧 Web Mobile 构建任务不自动迁移；更新插件后新建独立平台任务。原 --creator-entry 参数已删除，旧参数会明确报错。

### 2026-10-29：按 OpenPaaS 范围补充历史版本

- 覆盖版本清单中的 2.3.2–2.3.4、2.4.0–2.4.15 和全部已列出的 3.x；共 54 个版本、7 个生成目录，不自动开放范围内未列出的版本。
- 2.x 使用 simple-build-target、原 Web boot 和专用资源适配；3.6–3.8.2 接受工厂及 Application 两种启动协议。宿主差异集中于 adapters；未改 Editor、引擎和 ccbuild。
- 类型检查通过，源码回归 76/76；覆盖 2.x 生成包、双格式交付、下载管线、插件脚本顺序及暂停恢复。
- Creator 3.7.3 隔离样例实际构建成功：TikTok ZIP 5,418,894 字节，Google Ads ZIP 5,418,528 字节，AppLovin HTML 7,337,532 字节。未压缩，均超限并按约定保留；不代表可投放，也未验证画面。测试借名插件已移除，正式包名称保持 playable。
- 本机没有 Creator 2.x；其真实 Editor 加载、面板和画面仍待验收。其他历史安装包也未逐个验收，生成与自动回归不等同于全部客户端实测通过。

### 2026-10-29：可选 WebP 有损图片转码

- 新增 imageCompression=webp，沿用 imageQuality；原 none/lossy 配置继续有效。按文件内容识别 PNG/JPEG，保留尺寸、透明通道和资源路径，跳过动画、高位深、已有 WebP，未节省体积时保留原图。
- 单 HTML 的资源 Blob 和 CSS data URL 按真实图片格式生成 MIME。类型检查通过，全量 79/79 测试通过，覆盖透明度、扩展名不匹配、PNG 旧模式及 MIME。
- 用 test388/playable-002 的 TikTok ZIP 相同输入测试 quality=80，12 张图从 3,847,514 降至 174,902 字节；ZIP 从 5,578,467 降至 1,971,313 字节，Base122 实验 HTML 为 2,364,769 字节。产物放在 .local/webp-test388-q80，ZIP CRC 通过，未覆盖用户工程、未生成到 cocos-pack。
- 本轮没有进行广告 WebView、官方预览或游戏画面验收，已安装 Editor 插件尚未更新。

### 2026-10-29：图片模式与实际 Creator 3.8.8 产物检查

- 图片压缩选项顺序为“不压缩 → WebP → PNG+JPEG”；原 lossy 配置值保持，PNG 量化、JPEG 重编码分别保留原格式，WebP 模式将两者转为 WebP。按内容识别格式，质量参数共用。
- 已更新全局 Creator 3.8.8 测试插件并校验发布文件；未向 cocos-pack 生成产物。
- 用户实际构建 test388/playable-003：WebP、quality=80，12 张图从 3,847,514 降至 174,902 字节；TikTok ZIP 1,971,319，Google ZIP 1,970,957，AppLovin Base122 HTML 2,364,076 字节。图片尺寸及透明通道一致，两份 ZIP 与 HTML 内嵌 ZIP CRC、报告大小及 SHA-256 通过。
- 用户实际构建 test388/playable-004：PNG+JPEG、quality=80，12 张图均压缩，输出 9 PNG / 3 JPEG，共 920,756 字节；TikTok ZIP 2,708,963，Google ZIP 2,708,601，AppLovin HTML 3,207,098 字节。报告大小、SHA-256 与两份 ZIP CRC 通过，图片尺寸保持。
- 上述产物均未超体积限制；本轮未对运行画面、官方容器和有损画质进行验收。
- 最终类型检查与全量回归 81/81 通过，含 JPEG 重编码及无体积收益时保留原图的测试。
