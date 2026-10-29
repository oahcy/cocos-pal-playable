# Cocos Playable

私有试玩广告打包插件。支持 TikTok ZIP、Google Ads ZIP、AppLovin 单 HTML，以及 TikTok 的实验性单 HTML。源码使用 TypeScript。

- CLI：独立 playable 平台，复用 HTML5 引擎编译与资源构建。
- Creator：统一为独立 Playable 平台，不再提供 Web Mobile 附加构建入口。
- 当前已放开白名单的 Creator 3.8.9 源码版：独立 Playable 平台，支持勾选多渠道并分别配置，一次构建输出多份广告包，见 [接入说明](docs/creator-platform.md)。
- 历史独立平台：提供 3.8.3–3.8.9 的生成配置；平台白名单由 Creator 侧负责，历史版本仍需对应宿主验证，见同一接入说明。
- Creator 3.5.2：独立平台适配，使用旧版 Web 模板与启动协议；正式名称仍为 `playable`，需 Editor 放开白名单。其他更早版本和 pink 专用面板尚未接入。

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

按版本写入 `v<版本>/playable/` 并生成 `CocosPack/v<版本>-playable.zip`。不要在 cocos-pack 修改生成的插件；需要修复时回到本仓库修改、验证并重新生成。

[Creator 独立平台](docs/creator-platform.md) 说明安装、面板选项和限制；[插件发布](docs/cocos-pack-integration.md) 说明 generate/pack/verify 和 cocos-pack 根仓库调度。

Creator 复用编辑器自带 sharp；CLI 独立插件携带自己的依赖。宿主差异集中在适配层，不复制打包核心。

## 使用文档

- [试玩配置、游戏接口与 ZIP／单 HTML 交付](docs/DELIVERY.md)
- [ccapi Playable 接口对接设计](docs/ccapi-playable.md)
- [Google Ads 渠道](docs/google-ads.md)
- [AppLovin 渠道](docs/applovin.md)
- [验证结果与未完成项](VALIDATION.md)

```powershell
npm run preview -- <ZIP或HTML路径> --mock-sdk
```

预览仅在显式传入 --mock-sdk 时模拟 SDK，不修改交付文件。按钮和结束 UI 由业务实现，下载点击调用 playable.openStore()。

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
