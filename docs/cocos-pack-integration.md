# cocos-pack 接入准备

当前工程已提供 CLI 发布和 Creator 3.8.3–3.8.5 共用适配；尚未迁入 cocos-pack。

## 维护与产物边界

迁移后以 `cocos-pack/playable/` 为唯一源码；本仓库迁移前仍是源码来源。所有路径基于工程位置解析，无需固定 `D:/code`。

- `src/adapters/cli`：现有 CLI 宿主接口，原发布入口不变。
- `src/packaging`、`src/package.ts`：广告素材打包核心，与插件自身发布分开。
- `runtime`：渠道运行时和当前 SystemJS 启动、内嵌资源加载。
- `compatibility.json`：适配方案；包含 Node 22 的 CLI 配置和 Creator 3.8.3–3.8.5 共用配置（Node 16.14 语法目标）；未映射版本仍会失败。
- `scripts/release`：配置选择、编译、依赖收集、文件清单、ZIP 组装和校验。

现有 `npm run build` 仍输出本地 `dist` 和 `i18n/*.js`，供开发、测试和旧 `install:cli` 使用。
独立插件生成到显式指定的新目录，拒绝覆盖已有目录。失败产物没有有效清单，不能发布；改用新目录重试。

## 独立插件生成

```powershell
npm run plugin -- generate --host=cli --out=.local/plugin-cli-001 --dry-run
npm run plugin -- generate --host=cli --out=.local/plugin-cli-001
```

生成阶段编译代码，携带 `dist/`、`static/`、`i18n/`、声明、文档、清单及所需原生依赖。
不复制本工程的 `src/`、测试或无关未跟踪文件。保留第三方依赖许可文件和必要 JS/原生二进制。
此阶段需要开发依赖已安装；安装生成的插件则不需要 npm install。

CLI 产物中的 `sharp` 及其生产依赖按实际嵌套版本收集，包含当前系统/架构的原生文件。Creator 产物不携带 sharp，通过适配层使用编辑器版本。
产物记录 `platform`、`arch`、Node 构建目标；当前只验证生成环境，不能跨系统/架构或直接装进历史 Electron。
生成结束在产物目录加载 hooks/config；CLI 额外实际调用打包的 sharp。Creator 宿主原生库通过独立适配测试及编辑器构建验证。

## 发布组装与校验

```powershell
npm run plugin -- pack --input=.local/plugin-cli-001 --out=.local/releases/playable-cli.zip --dry-run
npm run plugin -- pack --input=.local/plugin-cli-001 --out=.local/releases/playable-cli.zip
npm run plugin -- verify --input=.local/releases/playable-cli.zip
```

pack 只读取已生成产物，不触发编译、安装或下载。
ZIP 根目录直接为 package.json、dist 等插件文件，没有多余目录层。
`playable-release.json` 记录插件版本、宿主、平台以及逐文件 SHA-256；校验缺失、多余文件和内容变化。
哈希是完整性校验，不是签名或来源认证。
覆盖已有有效发布包前在同目录创建唯一的 backup-* 目录，备份旧 ZIP；同时输出文件增删改 `.diff.json`。
旧包无法校验则拒绝覆盖。插件版本来自本工程 package.json，不自动修改 package_version。

安装准备好的 CLI 插件：

```powershell
npm run install:cli -- D:/code/cocos-cli .local/plugin-cli-001
```

不传第二个参数仍使用原有本地开发安装方式。安装脚本会检查独立产物完整性和系统/架构。

## 后续并入 cocos-pack

1. 原样迁入 `playable/`，先验证 CLI。
2. 从 `cocos-engine-ccbuild.txt` 读取目标 Creator 版本；不在本工程另存目标版本列表。
3. 实现实际 Creator 宿主入口、插件清单、运行时兼容及依赖配置后，才在 creatorVersions 建立精确版本映射。
4. 生成对应 `v<version>/playable/`，根仓库发布调度调用组装函数，输出 `CocosPack/v<version>-playable.zip`。
5. 如需主包白名单或旧按钮接口补丁，单独管理前置补丁，并验证实际加载路径/版本。

版本范围筛选、批量生成、自动升级版本号和 2.x modify 安装布局留待后续。Creator 插件清单已用于 3.8.3、3.8.4、3.8.5。
2.x 不写入现有同名版本 ZIP；需要与 cocos-pack 的安装流程先确定合并规则。
当前提供 Creator 3.8.3–3.8.5 共用入口，参阅 [适配说明](creator-383_385.md)。后续接口兼容的版本复用同一个 profile；接口变化时才增加适配目录及 profile。打包核心保持共用。
