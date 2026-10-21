// hostBridge 防御性调用 helper —— 保证 bridge 缺席/自身抛错时不影响插件其余流程。
// 与 kimpo-records-view 的 log()/notify() 包装同款风格，收窄到 AuthLoginHostBridge 的形状。
import type { AuthLoginHostBridge } from '@kimposoft/plugin-sdk';

/**
 * 分级日志上报（§11）：日志参数里永不出现密码/captcha 答案/challengeToken 原文
 * ——本文件只做转发，敏感字段过滤的责任在各调用点（组件内组装 fields 时自行把关）。
 * bridge.log 缺席或调用自身抛错时降级 console，保证日志动作永不影响业务流程。
 */
export function safeLog(
  bridge: AuthLoginHostBridge | undefined,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  fields?: Record<string, unknown>
): void {
  try {
    if (bridge && typeof bridge.log === 'function') {
      bridge.log(level, message, fields);
      return;
    }
  } catch {
    /* 日志桥自身异常静默，转 console 兜底 */
  }
  // eslint-disable-next-line no-console
  console[level]('[login-page]', message, fields ?? '');
}

/** 消息提示（防御性包装）：宿主 message 桥缺席时降级 console，保证提示动作永不抛出打断流程。 */
export function safeMessage(
  bridge: AuthLoginHostBridge | undefined,
  kind: 'success' | 'error' | 'info',
  msg: string
): void {
  try {
    const fn = bridge?.message?.[kind];
    if (typeof fn === 'function') {
      fn(msg);
      return;
    }
  } catch {
    /* 消息桥自身异常静默 */
  }
  // eslint-disable-next-line no-console
  console.info('[login-page]', kind, msg);
}
