# Creator 历史版本适配

## 版本和实现

发布版本严格来自 compatibility.json 的 creatorVersions，与 cocos-pack 的版本清单取交集。目录范围不等于自动开放所有版本，不包含 2.0～2.2 或 2.3.0/2.3.1。

| 版本组 | 构建适配 | 启动与资源 |
| --- | --- | --- |
| 232_234 | Creator 2 simple-build-target，继承 web-mobile | 保留 Web boot，包装 cc.loader 的非 UUID 下载处理器，保留 pack 路由 |
| 240_2415 | 同一 2.x 构建实现 | 使用 assetManager 管线，将 _preprocessPipe 映射到共享协议 |
| 300_352 | 旧式 Creator Web 钩子，Node 12 输出 | createApplication 工厂协议、扁平 settings |
| 360_374 | 旧式 Web 钩子 | 适配工厂和 Application 两种导出协议 |
| 380_382 | 旧式 Web 钩子 | 同一协议适配层 |
| 383_384 | 现代独立平台，Node 14.16 输出 | Application 类协议 |
| 385_389 | 现代独立平台，Node 20 输出 | Application 类协议 |

2.x 生成的 package.json 使用 simple-build-target 和项目 profiles；3.x 使用 contributions.builder 与 package_version: 2。两者均声明 name=playable、version、engines.creator 和 editor。旧 Node 的语法由构建目标转换，原生图片处理复用宿主 sharp；旧宿主具体 sharp 能力仍需验收，PNG 压缩默认关闭。

## 共用与隔离

渠道定义、资源收集、PNG 压缩、ZIP、Base64/Base122 单 HTML、报告和超限保留策略共用。2.x 只增加专用 Web 启动脚本清单，不要求 SystemJS；宿主入口差异位于 src/adapters。

不替换全局 XMLHttpRequest，不改宿主引擎文件，不重新注册已有平台。SDK 及运行时桥接只进入广告页面。

2.x 保留原 main.js 和引擎脚本。settings.js 必须是 Creator 生成的 JSON 赋值，构建进程不执行它；未知格式明确失败。远程资源不支持。2.3 UUID/pack 下载仍由引擎处理；其他下载先取内嵌 Blob，再交给原解析器。2.4 复用现有 assetManager 内嵌适配。

## 验证边界

- 自动回归覆盖版本映射、生成包、两种 3.x Application 协议、2.3 下载处理器、2.x Web 样例的 TikTok ZIP 和 AppLovin 单 HTML。
- 本机 3.7.3 使用隔离的 3.5.2 样例工程完成真实构建，三渠道产物已生成。为借用原版白名单，仅本地测试副本使用 openpaas 名称和较高测试版本；正式包始终为 playable。样例未压缩，三个产物均超限，按约定保留；不代表可投放。
- 既有 3.5.2 和现代版本的验收记录见 VALIDATION.md；不自动扩展到同版本的不同重打包客户端。
- 本机没有 Creator 2.x 安装包，2.x 尚未完成真实 Editor 加载、面板、引擎编译、游戏画面或官方容器验证。3.0～3.5.1、3.6、3.8.0～3.8.2 等未逐个安装包实测；历史接口不匹配时会明确报错，需要对应宿主补充回归。

发布前需为目标客户端完成对应实机验收。平台白名单与正式 Creator/Dashboard 发布由 Editor 团队负责；插件可生成不等于客户端已准入。
