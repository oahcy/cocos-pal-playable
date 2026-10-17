# Creator 3.8.3 实验适配

当前采用独立构建插件：在 Web Mobile 构建面板中启用试玩打包，不注册新平台，不依赖平台白名单，不修改 Creator、引擎或 CLI 主体。

## 生成和安装

```powershell
npm run plugin -- generate --host=creator --creator-version=3.8.3 --out=.local/creator-383
npm run plugin -- pack --input=.local/creator-383 --out=.local/releases/3.8.3-playable.zip
```

将生成目录复制到项目的 `extensions/playable/`，或在 Creator 扩展管理器中安装生成的插件 ZIP，启用后重新打开构建面板。插件清单使用 Creator 的 `package_version: 2` 和 `contributions.builder`。

1. 选择 Web Mobile。
2. 关闭 Source Maps、MD5 Cache；第一版暂不处理旧入口哈希文件的清理。
3. 在 Playable 插件选项中勾选 Enable playable packaging，选择渠道、格式、图片压缩及内嵌编码。
4. 构建。输出位于 Web 输出目录旁的 `<输出目录>-delivery/`。

默认不启用，不影响普通 Web 构建。启用时会替换本次 Web 输出中的页面和入口，注入渠道 SDK 与统一运行时；在共享核心中压缩、校验并生成广告包。不要与另一套修改同一页面的构建插件同时启用。

## 代码边界

- `src/adapters/creator-383/config.ts`：Creator 构建面板配置。
- `src/adapters/creator-383/hooks.ts`：读取插件参数、使用最终路径与 Build.Utils.transformCode，转换为共享模板和打包核心输入。
- `src/template.ts`、`src/package.ts`、`src/packaging/`：与 CLI 复用，不复制。
- `compatibility.json`：只开放精确的 3.8.3 实验配置；其他版本需独立验证。

发布 JavaScript 语法目标为 Node 16.14；Creator 版不携带 sharp，由适配层从 Editor.App.path/node_modules/sharp 加载宿主版本；CLI 仍携带自身依赖。构建目标不是实际宿主兼容证明，历史版本仍需分别验证。

## 验证边界

自动测试覆盖：默认不启用、非法参数拒绝、独立插件清单/依赖加载、原型 getter 路径、SystemJS 编译回调、TikTok ZIP 与 Base122 单 HTML、远程资源拒绝。测试使用受控 Web 文件与模拟的 Creator 编译接口，不能替代编辑器端构建。

2026-10-17 已通过 Creator 3.8.3 构建面板完成真实 demo 打包：有损压缩质量 80，38 张图片压缩成功，TikTok ZIP 为 3,396,587 字节（118 个文件），ZIP CRC 和报告 SHA-256 校验通过。36 项自动测试通过。命令行启动仍以 -1 退出；游戏运行、真实广告容器和 Creator 单 HTML 端到端验证尚未完成。隔离测试项目在 `.local/creator-383-smoke/`，原 demo 未改动。

Creator 2.x、独立 playable 平台入口、热更发布和 cocos-pack 批量调度不在这次范围内。

## 压缩兼容修复

已通过源码及安装目录确认 Creator 自带 sharp。Creator 产物构建时将 sharp 导入映射到独立宿主适配文件，复用编辑器版本；未修改全局 require，也不修改共享压缩算法。不提供回退到插件私有 sharp 的路径，以免再次同时加载两份原生库。自动测试覆盖无私有 sharp 的独立插件实际 PNG 压缩；本次真实 Creator 有损压缩构建已成功，未再发生之前的崩溃。
