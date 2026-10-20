# Creator 3.8.3–3.8.5 共用适配

当前采用独立构建插件：在 Web Mobile 构建面板中启用试玩打包，不注册新平台，不依赖平台白名单，不修改 Creator、引擎或 CLI 主体。

## 生成和安装

```powershell
npm run plugin -- generate --host=creator --creator-version=3.8.5 --out=.local/creator-383_385
npm run plugin -- pack --input=.local/creator-383_385 --out=.local/releases/3.8.3-3.8.5-playable.zip
```

将 `--creator-version` 换成 `3.8.3` 或 `3.8.4` 会选中同一组源码，生成相同插件内容。目录名用于标识兼容组，实际版本选择以 `compatibility.json` 为准，不根据目录名自动放开整个区间。

将生成目录复制到项目的 `extensions/playable/`，或在 Creator 扩展管理器中安装生成的插件 ZIP，启用后重新打开构建面板。插件清单使用 Creator 的 `package_version: 2` 和 `contributions.builder`。

1. 选择 Web Mobile。
2. 关闭 Source Maps、MD5 Cache；第一版暂不处理旧入口哈希文件的清理。
3. 在 Playable 插件选项中勾选 Enable playable packaging，选择渠道、格式、图片压缩及内嵌编码。
4. 构建。输出位于 Web 输出目录旁的 `<输出目录>-delivery/`。

默认不启用，不影响普通 Web 构建。启用时会替换本次 Web 输出中的页面和入口，注入渠道 SDK 与统一运行时；在共享核心中压缩、校验并生成广告包。不要与另一套修改同一页面的构建插件同时启用。

## 代码边界

- `src/adapters/creator-383_385/config.ts`：Creator 构建面板配置。
- `src/adapters/creator-383_385/hooks.ts`：读取插件参数、使用最终路径与 Build.Utils.transformCode，转换为共享模板和打包核心输入。
- `src/template.ts`、`src/package.ts`、`src/packaging/`：与 CLI 复用，不复制。
- `compatibility.json`：3.8.3、3.8.4、3.8.5 精确映射到同一个 `creator-383_385` 适配组；其他版本需验证后加入映射。

发布 JavaScript 语法目标为 Node 16.14；Creator 版不携带 sharp，由适配层从 Editor.App.path/node_modules/sharp 加载宿主版本；CLI 仍携带自身依赖。构建目标不是实际宿主兼容证明，历史版本仍需分别验证。

## 验证与范围

Creator 面板中的 TikTok 有损压缩打包已验证，具体结果和未完成项统一见 [验证记录](../VALIDATION.md)。配置、压缩语义与游戏 API 见 [交付说明](DELIVERY.md)。

Creator 构建时将 sharp 导入映射到宿主适配文件，不修改全局 require，不回退到插件私有原生库。关闭压缩时不加载 sharp。

Creator 2.x、独立 playable 平台入口、热更发布和 cocos-pack 批量调度尚未接入。
