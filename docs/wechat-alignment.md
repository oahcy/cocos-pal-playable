# 与微信平台插件的对齐

参考本地 cocos-pal-wechat 的 package.json、src/config.ts、src/hooks.ts、
src/share.ts、readme.md 和 docs/migrate-platform-plugin.md（2026-09-28）。

| 微信平台模式 | Playable 对应实现 |
| --- | --- |
| contributes.builder 声明 config / hooks | 同一注册契约，加载 dist/config.cjs、dist/hooks.cjs |
| src / dist 分离 | 保留 CJS 源码，经 esbuild 生成 CommonJS 产物；当前未迁移 TypeScript |
| static/templates | HTML 与 CSS 模板从钩子内移出，随插件分发 |
| i18n/{zh,en}.ts → 生成 .js | 平台名、渠道、方向使用 i18n:playable 命名空间 |
| packages/platforms 内直接开发 | 可直接检出并构建；独立工作目录通过 install:cli 复制产物 |
| 自定义 View 与 host | 后续复杂交互按 PinK-Docs 接入；首版简单字段继续使用 CLI Schema，不声明未实现面板 |

微信迁移文档明确 pinkBuilder.platform 是历史冗余字段，新平台不复制。
不迁移微信专属的 WECHAT 宏、小游戏 adapter、开放数据域、分包和开发工具配置；
试玩继续使用 HTML5 与 Web PAL。

微信仓库提供了开发接入方式，尚不能据此确认产品发布流水线或 npm 访问权限。
Playable 保持源码私有；正式产物发布方式另行落实。
通用 UI 契约遵循微信文档指向的 PinK-Docs；本次未实现或验证 pink UI。
