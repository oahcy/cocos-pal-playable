# Cocos Playable

私有试玩广告打包插件。支持 TikTok ZIP、Google Ads ZIP、AppLovin 单 HTML，以及 TikTok 的实验性单 HTML。源码使用 TypeScript。

- CLI：独立 playable 平台，复用 HTML5 引擎编译与资源构建。
- Creator：统一为独立 Playable 平台，不再提供 Web Mobile 附加构建入口。
- Creator 历史发布映射覆盖 OpenPaaS 的 2.3.2～2.3.4、2.4.0～2.4.15、3.0.0～3.8.8 清单版本，并保留原 3.8.9；按宿主/启动协议选择 adapter。
- 2.x 使用 simple-build-target 继承 Web Mobile 构建，专用面板和启动/资源桥接；3.x 注册独立平台，均不修改宿主引擎或其他平台钩子。宿主仍需允许平台注册。
- 历史版本产物生成和自动测试不代表每个安装包已完成实机验收。实测范围见 [验证记录](VALIDATION.md)；pink 专用面板尚未接入。

## 常用命令

使用 Node.js 22。从仓库根目录安装依赖并运行回归。

```sh
npm ci
npm run typecheck
npm test
npm run verify:panel
```

`verify:panel` 使用本机 Chrome 或 Edge 检查 3.x 面板。验收已有广告包时，替换下方路径和预期 Creator 版本。

```sh
npm run preview -- "./artifacts/tiktok.zip" --mock-api
npm run verify:preview -- "./artifacts/tiktok.zip" --expected-version=3.7.3
npm run demo:sdk
```

### 生成 Creator 插件

以 3.5.2 为例。每次生成使用新目录。

```sh
npm run plugin -- generate --host=creator --creator-version=3.5.2 --out=.local/plugin-352
npm run plugin -- pack --input=.local/plugin-352 --out=.local/playable-352.zip
npm run plugin -- verify --input=.local/playable-352.zip
```

支持全局内置扩展的宿主可将生成目录安装到 Creator 用户数据根目录下的 `builtin-extensions/3.5.2/playable/`。实际根目录以目标宿主为准。安装后重启 Creator，在构建发布面板选择 Playable 平台和目标渠道。构建完成后，在输出目录的 `playable-<渠道>/` 下查看广告包和报告。宿主准入与版本范围见 [Creator 接入与发布](docs/creator-platform.md)。

### CLI 联调与发布

先初始化 cocos-cli，再从本仓库执行以下命令。把示例项目路径换成实际项目。

示例假定插件仓库、cocos-cli、cocos-pack 和项目并列放置。目录不同就替换成实际路径，路径含空格时保留引号。

```sh
npm run build
npm run install:cli -- "../cocos-cli"
```

切到 cocos-cli 根目录后执行项目构建。

```sh
node dist/cli.js build -j "../my-game" -p playable -c "../cocos-pal-playable/examples/tiktok.build.json"
```

回到插件仓库根目录，再预览同步计划。

```sh
npm run pack:cocos -- "--root=../cocos-pack" 3.5.2 --dry-run
npm run pack:cocos -- "--root=../cocos-pack" 3.5.2
```

## 使用文档

- [操作手册与 AI 执行流程](docs/ai-workflow.md)
- [Creator 接入、版本适配与发布](docs/creator-platform.md)
- [构建配置、交付格式与渠道规则](docs/DELIVERY.md)
- [ccapi 接口设计](docs/ccapi-playable.md)
- [SDK 渠道验收 Demo](examples/sdk-demo/README.md)
- [验证结果与未完成项](VALIDATION.md)

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
