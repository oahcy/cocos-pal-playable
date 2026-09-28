# 首版验证记录

日期：2026-09-28。

- 私有源码目录：D:/code/cocos-pal-playable，远端 oahcy/cocos-pal-playable。
- 插件成功安装到 cocos-cli/packages/platforms/playable，并由 CLI 注册。
- 8 项 Node 测试通过：ZIP 根目录、文件筛选、外部引用/缺失资源/远程配置/MRAID 拦截、失败清理旧 ZIP、压缩包超限、下载代理、静音和退订、配置校验。
- 普通文件名构建成功；MD5 文件名 + portrait 构建成功。
- 初版浏览器验证时的隔离场景 ZIP：2,548,662 字节，45 个文件。
- 初版浏览器验证时的 ZIP SHA-256：9768ea357f8f5da7ad452e492c43450d21f9a6d3aa9e3e697a3d21fe470af78a。
- ZIP 直接通过本地 HTTP 服务在浏览器加载，SDK 使用明确的预览 mock。修复后日志记录 LoadScene db://assets/scene.scene 成功，空场景背景已渲染。
- cocos-cli 通用修复：SystemJS 生成时按 HTML5 平台类型选择 Web 加载器；原先按 playable 名称选择到非浏览器加载器导致黑屏。CLI 的 tsc -b 通过。
- npm pack --dry-run 验证分发文件仅包含 dist、运行时类型声明、package.json、README；不包含 src、测试、隔离工程或源映射。

本次没有上传官方 TikTok 预览，也没有验证设备容器、音频业务接入、真实商店跳转和广告安全区。浏览器 smoke 不等于平台合规验收。
Google Ads、AppLovin、pink 专用配置面板以及正式发布流水线尚未实现。
本记录描述本地验证结果；不代表已发布或推送远端。

隔离工程及构建日志位于 .local/，已被 Git 忽略。


## 微信平台结构对齐后的复验

- 已分离 static/templates 和 i18n，并随安装与分发携带。
- 8 项测试、插件编译、安装与完整 MD5/竖屏构建通过。
- 当前 ZIP 为 2,548,671 字节；SHA-256：609e210d47f37fe9113414faf780b23580cb58c11e5965f17e96cc2183c48b97。
- npm pack --dry-run 确认模板、多语言文件和类型声明已包含，src 与测试未包含。
- 本轮未重复浏览器检查；前述浏览器记录对应初版产物。

## 无配置文件的 demo 构建回归

修复：CLI 公共 sourceMaps 默认值为 inline，插件在 onBeforeInit 自动归一为 false，替代直接拒绝。
9 项测试通过。原命令 `node dist/cli.js build -j D:/prj/playable-demo -p playable` 实测构建成功（42 秒）。
产物 D:/prj/playable-demo/build/playable-delivery/tiktok.zip，4,846,723 字节。
SHA-256：ff4fe02c2ce08cc1e3b3ba5a783858eca783048c7ac49bee53b7c28c55318e0c。
构建 JS 未检出内联或外置 Source Map 引用；此次未做浏览器或官方预览验证。
