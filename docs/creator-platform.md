# Creator 接入与发布

插件和构建平台均使用 `playable`。生成、安装和构建命令见 [操作手册](ai-workflow.md)。实际验收范围见 [验证记录](../VALIDATION.md)。

## 版本与启动协议

`compatibility.json` 的 `creatorVersions` 列出可生成的准确版本。分组用于共享适配实现，`verifiedVersions` 单独记录已测版本。发布时取该清单与 cocos-pack 版本清单的交集。

| 版本组 | 构建适配 | 启动与资源 |
| --- | --- | --- |
| 232_234 | Creator 2 simple-build-target，继承 web-mobile | 保留 Web boot，包装 cc.loader 的非 UUID 下载处理器，保留 pack 路由 |
| 240_2415 | 同一 2.x 构建实现 | 使用 assetManager 管线，将 _preprocessPipe 映射到共享协议 |
| 300_352 | 旧式 Creator Web 钩子，Node 12 输出 | createApplication 工厂协议、扁平 settings |
| 360_363 | 旧式 Web 钩子，宿主读取 Web preset 生成加载器 | 适配工厂和 Application 两种导出协议 |
| 370_374 | 旧式 Web 钩子，使用宿主 module-system 重建浏览器加载器 | 同一协议适配层 |
| 380_382 | 与 370_374 共用构建实现 | 同一协议适配层 |
| 383_384 | 现代独立平台，Node 14.16 输出 | Application 类协议 |
| 385_389 | 现代独立平台，Node 20 输出 | Application 类协议 |

2.x 使用 `simple-build-target` 和项目 Profile，保留原 `main.js` 与引擎脚本。构建器将 `settings.js` 当作数据对象解析，支持 JSON5 无引号键。2.3 保留 UUID 和 pack 路由，其他资源通过内嵌 Blob 交给原解析器。2.4 复用 assetManager 管线。

3.x 使用 `contributions.builder` 与 `package_version: 2`。3.0～3.5.2 分组输出 `.js` 构建入口，兼容 3.0 的 CommonJS 加载器。该分组的启动入口使用 `createApplication`。3.7.0 起的旧式 Web 钩子通过宿主 module-system 重建浏览器加载器。较新的宿主继续复用 Web 加载器，构建平台保持 `playable`。

Creator 使用宿主 Sharp。2.x 通过 `Editor.App.path` 或 `Editor.url("app://")` 定位 `resources/utils/sharp`。图片压缩默认关闭，启用时要求宿主提供可用的 Sharp。

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

独立 playable 平台使用插件自带的 TypeScript 面板：勾选渠道后才展开各自设置，取消勾选保留参数但不参与本次构建。默认沿用旧任务选中的渠道；全部取消时提示并在构建初始化前拒绝执行。

每个渠道单独设置输出格式、方向、图片压缩和质量。通常仅单 HTML 显示内嵌编码、有损压缩显示质量；若已保存的值无效，也会显示对应字段供修正。Google Ads 当前仅提供 ZIP。

3.x 配置存入 `packages.playable.channels`。2.x 将渠道配置保存在项目的 `settings/playable.json`。下面是渠道对象示例：

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

## 适配代码归属

每个发布 profile 显式选择 applicationAdapter；协议一致的版本共用 application-class，旧版当前使用 creator-300_352。
所选目录提供 application.ts（构建端 settings/application 处理）、runtime.ts（浏览器启动和内嵌资源接入）与 bootstrap.ts.ejs（启动入口模板）。启动流程实现也保留在该目录的 startup.ts。

编译器只解析通用入口 @playable/host-application 和 @playable/host-runtime，不判断具体 Creator 版本。构建端与浏览器端分别打包；模板复制到插件 dist/bootstrap.ts.ejs，公共页面渲染固定读取它。直接从源码运行测试时，TypeScript 路径默认指向 application-class。

公共 runtime/index.ts 负责 SDK 公共初始化，单 HTML 入口负责解码、解压和 SystemJS 资源装载；两者通过 runtime/host.ts 的上下文契约调用所选运行适配器，不包含版本开关。渠道、压缩及归档流程不参与宿主版本判断。

## 试玩平台公共选项

独立平台隐藏调试模式、Source Maps、MD5 Cache、资源服务器及远程主包；在 onBeforeInit 中统一固定为关闭或空值，避免旧 Profile 中的隐藏值继续影响构建。Creator 3.5 使用 boolean 可见性配置，3.8 使用 hidden/default 描述。
名称、输出目录、场景、渠道、纹理压缩与启动图配置保留；项目资源 Bundle 自身的远程配置仍按现有规则校验，不因隐藏控件而自动转为本地资源。从旧 Web Mobile 附加入口升级时，替换旧插件并新建独立 playable 任务。

## cocos-pack 产物与维护边界

TypeScript 源码、测试、版本 adapter 和文档统一维护于独立仓库 cocos-pal-playable。cocos-pack 只接收生成的 Creator 插件目录，不再保留第二份开发源码。原迁入期间的变更可从 cocos-pack Git 历史追溯。

```text
cocos-pal-playable/src + runtime + scripts
    → 按 compatibility.json 编译
    → cocos-pack/playable/playable_<适配组>/
    → cocos-pack/CocosPack/v<版本>-playable.zip
    → Dashboard 下发安装
```

同适配 profile 本轮只编译、输出一份共享目录：playable_232_234、playable_240_2415、playable_300_352、playable_360_363、playable_370_374、playable_380_382、playable_383_384、playable_385_389。各目标版本仍分别生成 ZIP；版本范围目录名不扩大兼容映射。生成包记录逐文件 SHA-256，cocos-pack 中的产物应提交版本管理；CocosPack ZIP 和 .local 备份不提交。禁止手改产物后反向同步。

## 生成范围与产物管理

源码仓库生成、单包校验和 cocos-pack 封装命令见 [AI 操作手册](ai-workflow.md)。

省略 --root 时，默认使用本仓库旁边的 cocos-pack。版本选择取 cocos-pack/cocos-engine-ccbuild.txt 与 compatibility.json 精确映射的交集；--from / --to 可限制闭区间。未适配版本拒绝输出，不修改引擎或 ccbuild 清单。

发布前校验旧目录归属、清单和哈希。新目录在目标盘暂存并验证后替换；旧目录保存在 cocos-pack/.local/cocos-pack-*/backup-<版本>/。旧 ZIP 由发布工具备份到 CocosPack/backup-*，生成差异清单。不自动删除旧版本产物。

cocos-pack 根目录的 pack-playable 命令只校验并重新封装已有产物，不调用本源码仓库、不编译、无需安装 Playable 的开发依赖。ZIP 根目录直接是 package.json、dist 等文件。没有产物时应先从源码仓库生成。

CLI 包携带 Sharp 生产依赖，Creator 包复用宿主 Sharp。发布清单用于文件完整性校验，平台和架构的实测范围见 [验证记录](../VALIDATION.md)。

## Dashboard 热更约定

Creator 包同时保留 editor 和 engines.creator，由同一适配版本列表生成。Dashboard 使用 engines.creator 判断适用 Creator，使用标准 version 判断更新；package_version: 2 不作为递增发布版本。发布新版时手动递增本仓库 package.json 的 version。

插件与平台名称均为 playable。Dashboard 负责下载、安装，插件不实现自更新。Creator 3.x 插件通过 package.json 的 creator.builder.internal 和 creator.builder.platform（均为布尔值 true）声明内部构建平台。支持此机制的 Creator 从当前版本的全局 builtin-extensions/<版本>/playable/ 目录读取声明，并注册同名平台。正式云端下发和更新后的构建缓存仍需联调。
