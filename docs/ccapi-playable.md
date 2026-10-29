# ccapi Playable 接口对接设计

更新日期：2026-10-28。本文记录已确认的职责与拟接入接口，供 ccapi 对接使用；尚未完成代码迁移。当前运行时仍注册全局 `window.playable`，现有声明见 [playable.d.ts](../runtime/playable.d.ts)。

## 职责

- ccapi：提供 `api.playable` 的接口声明及统一 register 入口，管理接口注册与访问。不包含渠道 SDK、渠道判断或具体功能实现。
- 试玩插件：按构建选定渠道引入 SDK，创建实现实例，接入渠道事件，并通过 ccapi register 注册。
- 游戏：通过 `import { api } from 'cc'` 使用 `api.playable`，实现下载按钮、结束界面及业务音频控制。

Creator 版本适配继续放在插件 adapter 内，不进入 ccapi。打包格式、资源压缩与内嵌读取也仍由插件负责。

## 接口声明

以下为拟交付 ccapi 的声明，能力与当前插件保持一致。channel 使用 string，新增渠道无需修改 ccapi 枚举。

```ts
export type PlayableUnsubscribe = () => void;

export interface PlayableCapabilities {
    readonly openStore: boolean;
    readonly finishNotification: boolean;
    readonly containerLifecycle: boolean;
}

export interface PlayableAPI {
    /** 构建时选定的渠道，例如 tiktok、google-ads、applovin。 */
    readonly channel: string;
    readonly capabilities: Readonly<PlayableCapabilities>;

    /** 渠道 SDK 已就绪，不代表游戏资源已加载完成。 */
    readonly ready: boolean;
    /** 页面与广告容器当前是否允许展示。 */
    readonly viewable: boolean;

    /** SDK 就绪时调用一次；已就绪则立即调用。 */
    onReady(callback: () => void): PlayableUnsubscribe;
    /** 必须由真实用户点击触发，交由渠道处理商店跳转或转化。 */
    openStore(): void;
    /** 结束通知，仅处理一次；不自动停止游戏、显示结算页或跳转。 */
    finish(): void;

    /** 订阅后续不可见变化；初始状态读取 viewable。 */
    onPause(callback: () => void): PlayableUnsubscribe;
    /** 订阅后续恢复可见变化。 */
    onResume(callback: () => void): PlayableUnsubscribe;
    /** 立即通知当前静音策略，随后通知变化。游戏负责应用到业务音频。 */
    onMuteChange(callback: (muted: boolean) => void): PlayableUnsubscribe;
}
```

- 三个 capability 表示渠道适配器具备对应能力，不表示本次操作成功。`containerLifecycle=false` 时仍使用浏览器页面可见性。
- `finishNotification=false` 时，finish 只记录本地结束状态；支持结束上报的渠道才调用 SDK。当前 TikTok 发送 `finishPlayPlayable`；Google Ads、AppLovin 只作本地标记。
- pause/resume 表示展示状态变化；现有启动适配器据此协调引擎暂停恢复。游戏仍负责自身业务逻辑。
- 静音策略综合首次交互、页面/容器可见性及 SDK 静音状态。不得在恢复时覆盖用户自己的静音设置。
- 返回的取消订阅函数用于移除监听；游戏组件销毁时应调用。
- openStore/finish 返回 void，不承诺商店已打开或平台已接受上报。渠道 SDK 缺失、不可用等错误按当前实现抛出，不伪造成功。

## 实例化与注册时序

1. 插件注入对应渠道 SDK 和运行时代码。
2. 插件创建渠道 adapter 及 PlayableAPI 实例，初始化 SDK 状态监听。
3. ccapi 注册入口可用后，插件注册实例；必须在业务脚本首次访问 api.playable 前完成。
4. 游戏读取 api.playable，使用 onReady 等待 SDK 就绪。接口注册完成与 SDK ready 是两个状态。

现有代码在引擎加载前创建 window.playable。迁移时应保留实例创建逻辑，在引擎 ccapi 可访问、业务启动前完成注册；具体接入位置由各启动 adapter 处理。

下面仅为调用关系示意，**不是已确定的 ccapi register 签名**：

```ts
// 插件侧：createPlayable、channelAdapter 均由插件实现。
const instance: PlayableAPI = createPlayable(channelAdapter);
register('playable', instance);
```

业务侧目标用法：

```ts
import { api } from 'cc';

function onDownloadClick(): void {
    api.playable.openStore();
}

function onGameFinished(): void {
    showEndPanel(); // 游戏实现
    api.playable.finish();
}

const offMute = api.playable.onMuteChange(muted => {
    audioManager.setAdMuted(muted); // 游戏实现，并与用户静音设置合并
});
// 组件销毁时调用 offMute()。
```

## 对接前需确认

- ccapi register 的导出位置、准确签名和类型关联方式。
- 未注册模块如何访问、检测；重复注册如何处理。遵循 ccapi 统一约定，不另造一套注册机制。
- 各 Creator 版本的 ccapi 可用时机，确保注册早于业务模块执行。
- 历史引擎若没有 ccapi，如何保留现有全局入口；window.playable 的兼容周期单独确定，本次不直接删除。

## 实施与验收

ccapi 落地声明和注册约定后，插件复用现有 createPlayable 与渠道 adapter，仅增加注册桥接，避免维护两套实现。若保留全局入口，两处必须引用同一实例。

验收覆盖：业务首次访问前已注册、SDK ready 前后订阅、重复 finish 去重、真实点击触发 openStore、可见性与静音通知、监听清理，以及三个现有渠道和两类 Application 启动适配。普通浏览器预览的模拟 SDK 保持显式启用，不写入正式广告包。

加载完成上报、通用埋点、结算 UI 等不在本次接口范围。打包、SDK 引入和资源处理行为不因 ccapi 对接改变。
