# cocos-pack 产物接入

## 维护边界

TypeScript 源码、测试、版本 adapter 和文档统一维护于独立仓库 cocos-pal-playable。cocos-pack 只接收生成的 Creator 插件目录，不再保留第二份开发源码。原迁入期间的变更可从 cocos-pack Git 历史追溯。

```text
cocos-pal-playable/src + runtime + scripts
    → 按 compatibility.json 编译
    → cocos-pack/v<版本>/playable/
    → cocos-pack/CocosPack/v<版本>-playable.zip
    → Dashboard 下发安装
```

同适配 profile 本轮只编译一次，再输出各版本目录。生成包记录逐文件 SHA-256，cocos-pack 中的产物应提交版本管理；CocosPack ZIP 和 .local 备份不提交。禁止手改产物后反向同步。

## 从源码仓库生成

开发环境使用 Node.js 22，在本仓库安装锁定依赖后执行：

```powershell
npm ci
npm test
npm run pack:cocos -- --root=D:/code/cocos-pack --dry-run
npm run pack:cocos -- --root=D:/code/cocos-pack
# 或只更新一个版本
npm run pack:cocos -- --root=D:/code/cocos-pack 3.5.2
```

省略 --root 时，默认使用本仓库旁边的 cocos-pack。版本选择取 cocos-pack/cocos-engine-ccbuild.txt 与 compatibility.json 精确映射的交集；--from / --to 可限制闭区间。未适配版本拒绝输出，不修改引擎或 ccbuild 清单。

发布前校验旧目录归属、清单和哈希。新目录在目标盘暂存并验证后替换；旧目录保存在 cocos-pack/.local/cocos-pack-*/backup-<版本>/。旧 ZIP 由发布工具备份到 CocosPack/backup-*，生成差异清单。不自动删除旧版本产物。

cocos-pack 根目录的 pack-playable 命令只校验并重新封装已有产物，不调用本源码仓库、不编译、无需安装 Playable 的开发依赖。ZIP 根目录直接是 package.json、dist 等文件。没有产物时应先从源码仓库生成。

## 单独生成与验证

```powershell
npm run plugin -- generate --host=creator --creator-version=3.5.2 --out=.local/plugin-352
npm run plugin -- pack --input=.local/plugin-352 --out=.local/playable-352.zip
npm run plugin -- verify --input=.local/playable-352.zip
```

CLI 包通过 --host=cli 生成，携带 sharp 生产依赖；Creator 包复用宿主 sharp。平台和架构验证边界见 README 与 VALIDATION.md。生成失败没有有效清单，不可发布。哈希校验保证完整性，不是签名认证。

## Dashboard 热更约定

Creator 包同时保留 editor 和 engines.creator，由同一适配版本列表生成。Dashboard 使用 engines.creator 判断适用 Creator，使用标准 version 判断更新；package_version: 2 不作为递增发布版本。发布新版时手动递增本仓库 package.json 的 version。

插件与平台名称均为 playable。Dashboard 负责下载、安装，插件不实现自更新。白名单、正式云端下发及更新后构建进程缓存仍需联调。安装在已获准入的目录；当前建议重启已打开的 Creator 刷新缓存。
