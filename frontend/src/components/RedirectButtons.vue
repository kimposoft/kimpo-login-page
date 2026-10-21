<script setup lang="ts">
/**
 * redirect kind 登录入口（手册 §7.2）：点击 startRedirect(method.id) 后页面整跳；同一套代码对任意
 * providerCode 一视同仁——providerCode 只用于选图标，禁止据此写协议分支逻辑（红线②）。
 *
 * 2026-10-18 两种形态：
 *   - icons（默认）：表单区底部一行「其他方式」+ 32px 圆形小图标按钮（method.logo 或通用钥匙图标），
 *     title / aria-label = displayName，悬停显示名称；整行固定 52 高（上边距 20 + 32）。
 *   - buttons：只配置了跳转类方式、没有任何主登录方式（账号 / 短信 / 扫码）时的兜底——
 *     沿用原先的整行大按钮，避免页面上只剩一排看不懂的小图标。
 * startRedirect 调用、逐 method loading、失败提示逻辑未改动。
 */
import { ref } from 'vue';
import { NButton, NSpin } from 'naive-ui';
import type { AuthLoginHostBridge, LoginMethod } from '@kimposoft/plugin-sdk';
import { isKnownErrorCode, resolveErrorKey } from '../errorMessages';
import { safeLog, safeMessage } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';

defineOptions({ name: 'KimpoRedirectButtons' });

const props = withDefaults(
  defineProps<{
    bridge?: AuthLoginHostBridge;
    methods: LoginMethod[];
    mode?: 'icons' | 'buttons';
  }>(),
  { mode: 'icons' }
);

const { t } = useLoginI18n();

/** 逐 method 记录跳转中状态，防止同一按钮被重复点击；不同 method 互不影响（其余按钮置灰）。 */
const redirectingId = ref<string | null>(null);

/** logo 加载失败的 method：回退通用钥匙图标，不裂图。 */
const brokenLogos = ref<Set<string>>(new Set());
function handleLogoError(method: LoginMethod) {
  if (brokenLogos.value.has(method.id)) return;
  brokenLogos.value = new Set([...brokenLogos.value, method.id]);
  safeLog(props.bridge, 'warn', 'redirect method logo load failed, fallback to builtin icon', { methodId: method.id });
}

async function handleRedirect(method: LoginMethod) {
  if (redirectingId.value || !props.bridge) return;
  redirectingId.value = method.id;
  safeLog(props.bridge, 'info', 'redirect login started', { methodId: method.id, providerCode: method.providerCode });
  try {
    await props.bridge.startRedirect(method.id);
    // 正常情况下页面已整体跳转离开，Promise 不会 resolve 到这里；真 resolve 到此说明宿主
    // 实现允许无跳转完成（异常路径），保守起见复位 loading，不强行假设后续行为。
    redirectingId.value = null;
  } catch (err) {
    const errorCode = (err as { errorCode?: string } | undefined)?.errorCode;
    safeMessage(props.bridge, 'error', t(resolveErrorKey(errorCode)));
    if (errorCode && !isKnownErrorCode(errorCode)) {
      safeLog(props.bridge, 'warn', 'redirect button startRedirect() rejected with unknown error code', {
        errorCode,
        methodId: method.id
      });
    }
    redirectingId.value = null;
  }
}
</script>

<template>
  <!-- 底部一行小图标（52 高，样式见 styles/login-form.css .klp-footer-row）。 -->
  <div v-if="mode === 'icons'" class="klp-footer-row">
    <span class="klp-footer-label">{{ t('login.otherMethods') }}</span>
    <button
      v-for="method in methods"
      :key="method.id"
      type="button"
      class="klp-redirect-icon-btn"
      :title="method.displayName"
      :aria-label="method.displayName"
      :aria-busy="redirectingId === method.id ? 'true' : undefined"
      :disabled="redirectingId !== null"
      @click="handleRedirect(method)"
    >
      <NSpin v-if="redirectingId === method.id" :size="16" />
      <img
        v-else-if="method.logo && !brokenLogos.has(method.id)"
        :src="method.logo"
        alt=""
        class="klp-redirect-logo"
        @error="handleLogoError(method)"
      />
      <svg v-else viewBox="0 0 24 24" class="klp-redirect-icon" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 1.5a2 2 0 0 1 2 2v6.25a6.25 6.25 0 1 1-4 .168V3.5a2 2 0 0 1 2-2zm.25 12a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM16.5 4.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H15v-4h1.5z"
        />
      </svg>
    </button>
  </div>

  <!-- 兜底：无主登录方式时的整行大按钮。 -->
  <div v-else class="klp-redirect-list">
    <NButton
      v-for="method in methods"
      :key="method.id"
      size="large"
      round
      block
      :loading="redirectingId === method.id"
      :disabled="redirectingId !== null && redirectingId !== method.id"
      :aria-label="method.displayName"
      @click="handleRedirect(method)"
    >
      <template #icon>
        <img
          v-if="method.logo && !brokenLogos.has(method.id)"
          :src="method.logo"
          :alt="method.displayName"
          class="klp-redirect-logo"
          @error="handleLogoError(method)"
        />
        <svg v-else viewBox="0 0 24 24" class="klp-redirect-icon" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 1.5a2 2 0 0 1 2 2v6.25a6.25 6.25 0 1 1-4 .168V3.5a2 2 0 0 1 2-2zm.25 12a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM16.5 4.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H15v-4h1.5z"
          />
        </svg>
      </template>
      {{ method.displayName }}
    </NButton>
  </div>
</template>

<style scoped>
.klp-redirect-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 32px 圆形小图标按钮（视觉规范 iconBtn）。 */
.klp-redirect-icon-btn {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--klp-icon-btn-border, #e4e7ed);
  background: var(--klp-icon-btn-bg, #ffffff);
  color: var(--klp-brand-primary, #0877f4);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.klp-redirect-icon-btn:hover:not(:disabled),
.klp-redirect-icon-btn:focus-visible {
  border-color: var(--klp-brand-primary, #0877f4);
  box-shadow: var(--klp-focus-ring, 0 0 0 3px rgba(8, 119, 244, 0.12));
  outline: none;
}

.klp-redirect-icon-btn:disabled {
  cursor: not-allowed;
}

.klp-redirect-icon-btn:disabled:not([aria-busy='true']) {
  opacity: 0.5;
}

.klp-redirect-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.klp-redirect-icon {
  width: 18px;
  height: 18px;
}
</style>
