# Cocos Playable

私有试玩广告打包插件。支持 TikTok ZIP、Google Ads ZIP、AppLovin 单 HTML，以及 TikTok 的实验性单 HTML。源码使用 TypeScript。

- CLI：独立 playable 平台，复用 HTML5 引擎编译与资源构建。
- Creator：统一为独立 Playable 平台，不再提供 Web Mobile 附加构建入口。
- Creator 历史发布映射覆盖 OpenPaaS 的 2.3.2～2.3.4、2.4.0～2.4.15、3.0.0～3.8.8 清单版本，并保留原 3.8.9；按宿主/启动协议选择 adapter。
- 2.x 使用 simple-build-target 继承 Web Mobile 构建，专用面板和启动/资源桥接；3.x 注册独立平台，均不修改宿主引擎或其他平台钩子。宿主仍需允许平台注册。
- 历史版本产物生成和自动测试不代表每个安装包已完成实机验收。已验证边界与待测版本见 [历史适配](docs/historical-creators.md)；pink 专用面板尚未接入。

## 开发与 CLI 接入

源码统一维护于独立仓库 `cocos-pal-playable`；cocos-pack 只接收生成的 Creator 插件产物。开发环境使用 Node.js 22，在本目录运行以下命令；CLI 调试前先初始化 cocos-cli：

```powershell
npm ci
npm test
npm run install:cli -- D:/code/cocos-cli
node D:/code/cocos-cli/dist/cli.js build -j <项目目录> -p playable -c <构建配置.json>
```

从 cocos-cli 工作目录执行构建。配置示例在 examples/：TikTok 默认、有损压缩、引擎属性混淆，以及 Google Ads。场景和引擎模块沿用项目配置。

CLI 需要外部 HTML5 平台的 SystemJS 兼容修复：传递真实 platform/platformType，并在 buildSystemJsCommand 调用旧版 module-system 时按 HTML5 类型选择 Web 加载器。安装脚本仅复制插件，不修改 CLI 主体。

npm run build 生成 dist/ 与 i18n/*.js；npm test 包含构建。生成文件无需提交。插件可直接检出到 CLI 的 packages/platforms/playable，也可通过 install:cli 安装。

## Creator 与插件发布

生成并单向同步 Creator 插件到 cocos-pack：

```powershell
npm run pack:cocos -- --root=D:/code/cocos-pack --dry-run
npm run pack:cocos -- --root=D:/code/cocos-pack
```

按适配组写入 `playable/playable_<适配组>/`，并按目标版本生成 `CocosPack/v<版本>-playable.zip`。不要在 cocos-pack 修改生成的插件；需要修复时回到本仓库修改、验证并重新生成。

[Creator 独立平台](docs/creator-platform.md) 说明安装、面板选项和限制；[插件发布](docs/cocos-pack-integration.md) 说明 generate/pack/verify 和 cocos-pack 根仓库调度。

Creator 复用编辑器自带 sharp；CLI 独立插件携带自己的依赖。宿主差异集中在适配层，不复制打包核心。

## 使用文档

- [试玩配置、游戏接口与 ZIP／单 HTML 交付](docs/DELIVERY.md)
- [ccapi Playable 接口对接设计](docs/ccapi-playable.md)
- [Google Ads 渠道](docs/google-ads.md)
- [AppLovin 渠道](docs/applovin.md)
- [验证结果与未完成项](VALIDATION.md)

```powershell
npm run preview -- "产物.zip" --mock-api
npm run verify:preview -- "产物.html" --browser=chrome --timeout=30000 --expected-version=2.4.12
```

统一 Mock 通过真实 runtime 的 Adapter 工厂注入，ZIP 和单 HTML 共用；要求产物由当前插件生成，包含 data-playable-runtime 标记和工厂入口。SystemJS、内嵌资源与 Creator 启动适配继续执行产物代码。预览仅修改本地 HTTP 响应。

自动验收使用本机已安装的 Chrome，也可传 --browser=msedge 使用 Edge。它等待真实场景和后续两帧引擎运行，捕获脚本错误、HTTP/资源失败及超时，同时输出浏览器日志，检查引擎自己的 `Cocos Creator v…` 启动日志，并读取运行中的 `cc.ENGINE_VERSION` 交叉验证；部分正式引擎不打印 banner 时使用运行时版本值，输出注明来源。两者都缺失、互相冲突或与 `--expected-version` 不一致均验收失败。版本应来自测试计划，不从产物名推断。成功退出 0，失败退出 1。playwright-core 仅为开发依赖。

批量验收执行 `npm run verify:preview -- --batch=验收清单.json`，清单内容例如：

```json
[
  { "archive": "build/creator2412/tiktok.zip", "expectedVersion": "2.4.12" },
  { "archive": "build/creator373/applovin.html", "expectedVersion": "3.7.3" }
]
```

路径相对清单文件。批量串行执行，浏览器和 Mock 编译只初始化一次，每项新建隔离浏览器上下文；失败继续后续项，任意失败时命令退出码为 1。输出共享初始化耗时，以及各项准备（含 ZIP CRC 和预览启动）、场景启动、后续两帧、清理、总耗时（毫秒），失败项保留已执行阶段的耗时。不重新运行 Creator 构建。

控制台可调用 window.__playablePreview.setViewable(false) 隐藏容器，传 true 恢复；调用 window.__playablePreview.setMuted(true) 静音，传 false 解除。下载和结束调用记录在 window.__playablePreview.calls。预览 URL 附加 ?ready=manual&viewable=false 可模拟未就绪且初始隐藏，再调用 window.__playablePreview.ready() 和 setViewable(true) 启动。

原渠道 SDK Mock 仍使用 npm run preview -- "产物.zip" --mock-sdk，适用于渠道接口映射检查和旧产物。两种 Mock 模式互斥。按钮和结束 UI 由业务实现，下载点击调用 playable.openStore()。

## 面板自动回归

```powershell
npm run verify:panel
```

无需启动 Creator 或执行工程构建。使用本机 Chrome（可传 `--browser=msedge`），按正式插件的同一编译方法生成实际 panel.cjs，覆盖 3.x 共用面板的 Node 12、14.16、20 三组编译目标（3.5.2 / 3.8.3 / 3.8.8）。在隔离的浏览器上下文中自动检查渠道展开/收起、格式约束、PNG+JPEG/WebP/不压缩、质量边界及非法值、商店 URL 校验、宿主更新、只读及监听清理。

测试宿主独立接收 `update` 事件并保存到 localStorage，重新加载实际面板后核对恢复值，以及宿主收集到的完整任务配置。面板没有自己的构建按钮，因此这里只验证配置事件和收集边界，不假装验证 Editor 的真实任务提交。Editor 翻译、存储和传输为模拟实现，不覆盖平台注册、真实构建页面路由及 Editor 的持久化机制。2.x Vue 面板尚未纳入此浏览器回归。浏览器检查独立于 npm test，不为普通单元测试新增浏览器安装要求。

## SDK 渠道验收 Demo

npm run demo:sdk 生成极简 SDK 测试页面，输出 generated/sdk-demo/ 下的 TikTok ZIP、Google Ads ZIP 和 AppLovin 单 HTML。页面覆盖统一 API 全部属性、方法与退订函数，使用真实渠道 Adapter；标题、商店链接及输出目录集中在 examples/sdk-demo/config.json，也可通过 --config 指定配置。详细操作见 [SDK Demo](examples/sdk-demo/README.md)。

## 文件职责

| 目录 | 职责 |
| --- | --- |
| src/adapters/ | CLI、Creator 构建接口及宿主依赖适配 |
| src/channels/ | 渠道 SDK 地址、格式与校验规则 |
| src/packaging/ | 文件收集、图片压缩、ZIP/HTML 编码 |
| src/package.ts、src/template.ts | 共用打包编排与模板渲染 |
| runtime/ | 渠道接口、启动控制和内嵌资源读取 |
| static/templates/、i18n/*.ts | 模板与多语言源码 |
| scripts/release/ | 插件自身的编译、依赖收集、发布和校验 |
| tests/、examples/ | 自动测试与构建配置示例 |

## 交付边界

广告包位于 `<构建目录>/playable-<渠道>/`，附带报告和所有权标记；例如 `build/playable/playable-tiktok/tiktok.zip`。渠道目录不参与资源收集，重复构建不会把旧广告包打入新包。仅收集已知根文件及 assets/、cocos-js/、src/，未实现完整资源依赖图。封装位于 onAfterBuild，其他插件此后的修改不会进入广告包。

report.status=packaged 只代表本地打包成功。体积、入口、静态引用及渠道规则检查不能替代动态请求、画面、声音、官方安全区或投放审核。SDK 首屏资源清单责任尚待确认，不生成空清单伪造就绪。
