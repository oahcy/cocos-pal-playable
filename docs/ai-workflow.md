# 操作手册与 AI 执行流程

在 `cocos-pal-playable` 源码仓库根目录执行命令。Windows 示例使用 PowerShell 和 Node.js 22。先核对目标 Creator 版本、项目副本、输出目录和验收范围。有锁定依赖时用 `npm ci` 初始化。临时配置、插件和日志放在 `.local/`，每次使用新的输出名。

## 选择测试入口

| 要验证的变更 | 执行入口 |
| --- | --- |
| 类型、构建钩子、压缩、打包、SDK 适配或插件发布 | `npm run typecheck`、`npm test` |
| 3.x 面板控件、配置事件、模拟保存与重开 | `npm run verify:panel` |
| 已有广告包的引擎版本、场景启动和资源加载 | `npm run verify:preview -- <产物路径> --expected-version=<版本>` |
| Creator 安装、平台注册或构建钩子和实际工程的组合 | 生成并安装对应版本插件，在隔离工程执行实际构建，再验收广告包 |
| 渠道 SDK 的真实容器行为 | `npm run demo:sdk` 生成测试包，按渠道流程验收 |

`npm test` 先编译插件，再运行 `tests/*.test.ts`。定向测试可在编译后运行 `npx tsx --test tests/preview-logs.test.ts`。面板检查用已安装的 Chrome，也支持 `--browser=msedge`，分别编译三组 3.x 目标并运行实际面板。宿主配置传输和存储由测试宿主模拟，2.x Profile 读取和交付由现有用例覆盖。正式 Editor 面板验收需在目标宿主中打开 Playable，修改参数并核对提交值。

## 生成和校验 Creator 插件

从 `compatibility.json` 的 `creatorVersions` 选择准确版本。以下用 3.5.2 举例，`generate` 的输出目录必须是新目录。

```powershell
npm run plugin -- generate --host=creator --creator-version=3.5.2 --out=.local/plugin-352
npm run plugin -- pack --input=.local/plugin-352 --out=.local/playable-352.zip
npm run plugin -- verify --input=.local/playable-352.zip
```

生成目录直接包含 `package.json`、`dist` 和发布清单。每条命令成功后再执行下一条。支持内置构建插件的 Windows 测试宿主可将生成目录安装为 `%USERPROFILE%\.CocosCreator\builtin-extensions\<版本>\playable\`。先核对对应版本的准入能力和已启用副本，保留已有安装的备份。安装后对照发布清单检查文件，再启动目标 Creator。版本差异和宿主配置见 [Creator 接入](creator-platform.md) 及 [版本与启动协议](creator-platform.md#版本与启动协议)。

## 在隔离工程构建广告包

使用与目标 Creator 兼容的项目副本。把下方的 `$editorExe`、`$project` 和 `$buildConfig` 设为实际绝对路径。3.x 构建配置示例保存到 `$buildConfig` 指向的文件，`outputName` 每轮取新值。

```json
{
  "platform": "playable",
  "buildPath": "project://build",
  "outputName": "playable-ai-check",
  "debug": false,
  "sourceMaps": false,
  "md5Cache": false,
  "packages": {
    "playable": {
      "channels": {
        "tiktok": { "enabled": true },
        "google-ads": { "enabled": true },
        "applovin": { "enabled": true, "storeUrl": "https://example.com/store" }
      }
    }
  }
}
```

```powershell
# Creator 3.x
& $editorExe --project $project --build "configPath=$buildConfig"
# Creator 2.x
& $editorExe --path $project --build "platform=playable;buildPath=./build-ai-check;debug=false;sourceMaps=false;md5Cache=false;encryptJs=false;embedWebDebugger=false"
```

2.x 先在项目副本的 `settings/playable.json` 保存形如 `{"channels":{...}}` 的配置，渠道字段沿用上面的示例。AppLovin 的示例链接用于本地测试。质量和压缩模式见 [交付参数](DELIVERY.md)。

检查本轮 Playable 钩子日志、新文件的时间和 `playable-<渠道>/report.json`。按需核对压缩参数、SHA-256、CRC 和超限标记。Creator 退出码需与日志和新产物一起判断。版本矩阵串行构建，每版可在一次构建中生成三个渠道。当前实测范围见 [验证记录](../VALIDATION.md)。

## 本地预览和自动验收

```powershell
npm run preview -- "D:/tests/playable-tiktok/tiktok.zip" --mock-api
npm run verify:preview -- "D:/tests/playable-tiktok/tiktok.zip" --expected-version=3.7.3
npm run verify:preview -- --batch=.local/preview-cases.json
```

把示例路径和预期版本换成实际测试数据。批量清单是 JSON 数组，产物路径相对清单文件解析。

```json
[
  { "archive": "build/creator2412/tiktok.zip", "expectedVersion": "2.4.12" },
  { "archive": "build/creator373/applovin.html", "expectedVersion": "3.7.3" }
]
```

自动验收使用 Chrome，可加 `--browser=msedge` 或 `--timeout=30000`。它检查场景、后续两帧、脚本和资源错误，并用引擎版本日志及 `cc.ENGINE_VERSION` 核对预期版本。预期值取自构建计划。批量复用浏览器和 Mock 编译，每个包在独立上下文运行。一项失败仍继续验剩余产物，任意失败返回 1。

`--mock-api` 需要产物的 `data-playable-runtime` 标记与工厂入口。旧产物或渠道接口映射测试可用 `--mock-sdk`。两种模式互斥，Mock 只写入本地预览响应。控制台可用 `window.__playablePreview.setViewable(false)` 模拟隐藏，`setMuted(true)` 模拟静音，`calls` 查看下载与结束调用。URL 加 `?ready=manual&viewable=false` 后，可调用 `ready()`、`setViewable(true)` 模拟容器就绪与展示。

已有试玩构建目录也可通过 `npm run single-html -- <试玩构建目录> 80 base122` 重新封装。先执行 `npm run build`。省略质量参数会保留原图。

本地自动验收适用于带引擎和场景的项目包。SDK Demo 的页面状态和事件日志用于渠道行为检查，见 [Demo 用法](../examples/sdk-demo/README.md)。正式投放验收以渠道和设备结果为准。

## CLI 联调与 cocos-pack 发布

CLI 联调先初始化 cocos-cli，再从插件仓库执行构建和安装。最后切到 cocos-cli 工作目录构建项目。

```powershell
npm run build
npm run install:cli -- D:/code/cocos-cli
Push-Location D:/code/cocos-cli
try {
  node dist/cli.js build -j $project -p playable -c D:/code/cocos-pal-playable/examples/tiktok.build.json
} finally {
  Pop-Location
}
```

CLI 需能按 HTML5 类型选择 SystemJS Web 加载器。需要独立 CLI 插件时，用 `npm run plugin -- generate --host=cli --out=.local/plugin-cli`。生成包携带 Sharp 生产依赖，可作为 `install:cli` 的第二个位置参数。

准备发布时先用 `--dry-run` 查看范围，再执行同步。以下限定为一个目标版本。

```powershell
npm run pack:cocos -- --root=D:/code/cocos-pack 3.5.2 --dry-run
npm run pack:cocos -- --root=D:/code/cocos-pack 3.5.2
```

省略版本处理清单交集，`--from` 和 `--to` 选择闭区间。从 cocos-pack 根目录执行 `npm run pack-playable -- 3.5.2` 可重新封装已有产物。输出、备份和 Dashboard 规则见 [cocos-pack 产物管理](creator-platform.md#cocos-pack-产物与维护边界)。

汇报结果时记录实际版本、命令、产物或日志位置、通过项和失败原因。分别标注模拟测试、真实 Creator 构建与渠道容器验收。
