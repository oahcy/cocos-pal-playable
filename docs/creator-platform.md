# Creator 独立 Playable 平台

打包核心和渠道逻辑共用；Creator 版本只影响宿主适配、编译目标与 Editor 接入。
目前 3.8.9 源码版已完成 UI 构建验证；3.8.3–3.8.8 已核对源码接口并提供插件生成配置，尚待修改后编辑器的完整构建验证。

## 版本与入口

- Creator 3.5.2 使用 `creator-300_352` 适配器和 Node 14.16 编译目标；仅启动及 settings 协议与 3.8 分开，渠道、压缩和交付逻辑共用。
- `creatorVersions`：唯一的 Creator 版本映射，覆盖已提供适配的 3.5.2 和 3.8.3–3.8.9，全部生成独立平台。
- 独立平台共用 `src/adapters/creator-platform`；3.8.3–3.8.4 输出 Node 14.16 兼容代码，3.8.5–3.8.9 输出 Node 20 兼容代码。
- 公共选项、交付流程和 sharp 适配位于 `creator-shared`。独立平台不依赖旧 Web Mobile 适配器。

旧 Web Mobile 附加适配、启用开关和入口选择参数已移除。旧安装副本不会自动卸载；升级时需替换旧插件，并新建独立 playable 平台任务。宿主 Web 钩子和浏览器加载器预设仍是独立平台的底层复用能力。

## 生成与发布

使用 Node 22，从 playable 目录生成独立平台插件：

```powershell
npm run plugin -- generate --host=creator --creator-version=3.8.4 --out=.local/platform-384
```

Creator 包无需选择入口；generate、pack 和 verify 均不接受旧的入口选择参数。
清单中的 `editorIntegration: playable-platform` 表示需要宿主准入，不代表原版 Editor 已支持此平台。

从 cocos-pack 根目录按版本生成安装包：

```powershell
npm run pack-playable -- --from=3.8.3 --to=3.8.9 --dry-run
npm run pack-playable -- --from=3.8.3 --to=3.8.9
```

只处理仓库版本清单与兼容映射的交集。同一 profile 编译一次，输出 `v<版本>/playable` 和 `CocosPack/v<版本>-playable.zip`。输出仍使用 playable 插件名和现有备份规则。

## Editor 接入

沿用已有 Editor 源码维护与重打包流程，不由 Playable 插件生成或应用源码补丁。

各目标版本需要核对：

- 平台类型与白名单包含 `playable`。
- `features.playable` 启用。
- 内置安装目录能取得内部构建配置能力；如需从全局热更目录加载，还需针对 `playable` 放开对应注册规则。
- 平台入口接入该版本的构建面板；历史版本不要求新版发布卡片。

这些改动维护在对应 Editor 分支或现有版本补丁中，由原流程编译和重打包。插件 ZIP 不负责修改宿主，也不携带 `.ccc`、`app.asar` 或 Editor 源码。先完成宿主能力接入，再发布插件热更。

## 构建流程

- 注册 `configs.playable`，类型 HTML5，纹理和 Bundle 按 Web 处理。
- 钩子设置 Web 脚本预设、引擎不拆分和运行时资源 URL。
- 3.8.3–3.8.9 的 module-system 调用参数已核对。插件使用宿主模块的 web-mobile 参数重新生成浏览器加载器，构建任务仍为 playable；这里的 web-mobile 是宿主加载器预设，移除旧构建入口后仍需保留。
- `creator-shared/delivery.ts` 共用页面、渠道 SDK 和交付编排。
- Source Maps 初始化前关闭，MD5 Cache、远程资源仍不支持。
- 最终广告包和报告位于构建目录内的渠道目录，例如 `<构建目录>/playable-tiktok/tiktok.zip`；Web 构建文件仍保留在构建目录，不再额外创建旁边的 `-delivery` 目录。

## 多渠道构建面板

独立 playable 平台使用插件自带的 TypeScript 面板：勾选 TikTok、Google Ads 后才展开各自设置，取消勾选保留参数但不参与本次构建。默认沿用旧任务选中的渠道；全部取消时提示并在构建初始化前拒绝执行。

每个渠道单独设置输出格式、方向、图片压缩和质量。通常仅单 HTML 显示内嵌编码、有损压缩显示质量；若已保存的值无效，也会显示对应字段供修正。Google Ads 当前仅提供 ZIP。

配置存入 `packages.playable.channels`：

```json
{
  "tiktok": { "enabled": true, "outputFormat": "single-html", "imageCompression": "lossy", "imageQuality": 60 },
  "google-ads": { "enabled": true, "outputFormat": "channel-default" }
}
```

没有 channels 的旧任务继续读取原单渠道配置。CLI 暂保持单渠道；自定义面板只注册在独立 playable 平台。

共用构建设置与统计信息保留宿主方向，不用任意渠道代表整个任务。引擎和资源只构建一次，各渠道依次组合自己的页面、SDK、方向设置并打包，组合文件仅在内存中覆盖，不修改共用 Web 文件。最终分别输出到 `<构建目录>/playable-<渠道>/`。页面准备、读取设置和编码均在同一失败处理流程内：失败会清除该渠道本格式旧包并写入失败报告。某渠道失败仍继续其他渠道，最后汇总错误；已有但本轮未选中的渠道产物保留，不代表本轮重新生成。

## 卡片发布待接入

本地 v3 测试包已验证卡片 → 配置 → 构建，但卡片修正仍仅在 Downloads 编译产物中。正式发布需在 `builder-workspace/apps/builder-web` 注册 playable 卡片和素材，并修正卡片列表、外层窗口的场景占位判断，再从源码构建正式卡片包和校验清单。本机没有该仓库；本地 OTA 测试 URL 不能用作正式发布配置。

## Creator 3.5.2 适配边界

生成时使用 `--creator-version=3.5.2`，插件和平台注册名均为 `playable`。
宿主需提供同名白名单；借用其他平台名的本地验证层不随源码或插件发布。

3.5 没有新版 Application 类和启动委托，适配器调用宿主 Web 钩子生成该版本的 application.js、settings 和浏览器加载器，再按 `createApplication` 协议启动。单 HTML 从内嵌 settings 初始化，并使用共用 assetManager 资源适配。旧 application 模板里的 settings 入口只在交付副本中定点处理；模板不匹配会明确报错，避免全局替换 XMLHttpRequest。原 Web 构建文件不修改。

SDK 和单 HTML 运行时随发布 profile 选择对应启动协议。当前只声明 3.5.2，不据此承诺其他 3.x 版本兼容；正式同名白名单包的完整 UI 链路仍需验收。

## 历史版本分组

独立平台沿用 OpenPaaS 的范围：`300_352`、`360_374`、`380_382`、`383_384`、`385_386`、`387`、`388`；另保留 `389`。
分组声明在 compatibility.json 的 creatorPlatformGroups。多个分组允许指向同一个适配实现，不复制代码；有实际接口差异时再拆分实现。

`300_352` 当前使用在 3.5.2 验证的旧启动适配；`360_374` 和 `380_382` 先保留位置，profile 为空。
分组范围用于规定适配边界，creatorVersions 仍是实际允许生成的版本清单。未经适配的版本不会因为落在范围内而自动发布。verifiedVersions 单独记录验证版本，扩展发布清单前应核对宿主接口并测试。

## 适配代码归属

每个发布 profile 显式选择 applicationAdapter；协议一致的版本共用 application-class，旧版当前使用 creator-300_352。
所选目录提供 application.ts（构建端 settings/application 处理）、runtime.ts（浏览器启动和内嵌资源接入）与 bootstrap.ts.ejs（启动入口模板）。启动流程实现也保留在该目录的 startup.ts。

编译器只解析通用入口 @playable/host-application 和 @playable/host-runtime，不判断具体 Creator 版本。构建端与浏览器端分别打包；模板复制到插件 dist/bootstrap.ts.ejs，公共页面渲染固定读取它。直接从源码运行测试时，TypeScript 路径默认指向 application-class。

公共 runtime/index.ts 负责 SDK 公共初始化，单 HTML 入口负责解码、解压和 SystemJS 资源装载；两者通过 runtime/host.ts 的上下文契约调用所选运行适配器，不包含版本开关。渠道、压缩及归档流程不参与宿主版本判断。

## 试玩平台公共选项

独立平台隐藏调试模式、Source Maps、MD5 Cache、资源服务器及远程主包；在 onBeforeInit 中统一固定为关闭或空值，避免旧 Profile 中的隐藏值继续影响构建。Creator 3.5 使用 boolean 可见性配置，3.8 使用 hidden/default 描述。
名称、输出目录、场景、渠道、纹理压缩与启动图配置保留；项目资源 Bundle 自身的远程配置仍按现有规则校验，不因隐藏控件而自动转为本地资源。原 Web Mobile 附加入口已移除。
