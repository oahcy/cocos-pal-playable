# Creator 历史版本适配

## 版本和实现

发布版本严格来自 compatibility.json 的 creatorVersions，与 cocos-pack 的版本清单取交集。目录范围不等于自动开放所有版本，不包含 2.0～2.2 或 2.3.0/2.3.1。

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

2.x 生成的 package.json 使用 simple-build-target 和项目 profiles；3.x 使用 contributions.builder 与 package_version: 2。两者均声明 name=playable、version、engines.creator 和 editor。旧 Node 的语法由构建目标转换，3.x 原生图片处理复用宿主 sharp；2.x 通过 Editor.App.path 或 Editor.url("app://") 定位 resources/utils/sharp，复用编辑器工具目录的 Sharp，不携带原生依赖或依赖外部 Node；缺失时明确提示关闭压缩或检查安装。已实测本机 2.4.15，其他 2.x 和 macOS 仍需验证。图片压缩默认关闭，具体宿主仍需实际验收。

## 共用与隔离

渠道定义、资源收集、PNG 压缩、ZIP、Base64/Base122 单 HTML、报告和超限保留策略共用。2.x 只增加专用 Web 启动脚本清单，不要求 SystemJS；宿主入口差异位于 src/adapters。

不替换全局 XMLHttpRequest，不改宿主引擎文件，不重新注册已有平台。SDK 及运行时桥接只进入广告页面。

2.x 保留原 main.js 和引擎脚本。settings.js 必须是 Creator 生成的数据对象赋值（支持 JSON 与 JSON5 的无引号键），构建进程不执行它；未知格式明确失败。远程资源不支持。2.3 UUID/pack 下载仍由引擎处理；其他下载先取内嵌 Blob，再交给原解析器。2.4 复用现有 assetManager 内嵌适配。

## 验证边界

- 2026-11-05 已在本机安装版 2.4.12、2.4.15、3.5.2、3.7.0、3.7.3、3.8.3、3.8.5、3.8.6、3.8.7、3.8.8 完成三渠道真实构建。每版输出 TikTok ZIP、Google Ads ZIP、AppLovin Base64 单 HTML，均使用 WebP quality=80。
- 30 份产物在本地浏览器配合模拟渠道 SDK 完成场景加载和渲染，未捕获 error 日志。产物 SHA-256、ZIP/内嵌 ZIP CRC、浏览器加载器及安装插件文件哈希通过。官方 SDK 行为、渠道审核、真机和构建面板仍需分别验证。
- 3.7.0 一次并发 CLI 重试跳过了 Playable 钩子，保留了上次失败报告。串行重跑后确认钩子执行并生成新产物。验证需同时检查钩子日志、产物更新时间和交付报告，不能只依赖宿主退出码。
- 同日追加十版本随机压缩回归：每版重构建三个渠道，共 30 份新产物；PNG+JPEG 与 WebP 各 15 份，每种模式覆盖 15 档质量（含 1/100）。全部通过报告参数、哈希、ZIP CRC、图片解码和统一 Mock 浏览器版本/场景验收，详情见 VALIDATION.md。
- 其他历史版本及 macOS 尚待实际客户端验收。compatibility.json 的 verifiedVersions 仅记录具体已测版本，验收不自动扩展到同版本的其他重打包客户端。3.8.9 源码版的既有验证见 VALIDATION.md。

平台准入与正式 Creator/Dashboard 发布由 Editor 团队负责。
