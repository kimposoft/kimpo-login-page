<script setup lang="ts">
/**
 * qr kind 状态机（手册 §7.3）：
 *   idle → creating → pending →(扫码) scanned →(确认) confirmed → 进系统
 *                        │
 *                        └──(超时)──→ expired →(点击刷新) creating
 *
 * 切换/卸载都必须清理轮询定时器（§7.3 末行）；页面不可见（visibilitychange）时暂停轮询，
 * 恢复可见且未过期/未确认时续开。
 *
 * 扫码并入顶部 Tab——多个 qr 方式时由父级（LoginFormArea）各给一个 Tab、
 * 每个 Tab 挂一个本组件（按 method.id 作 key 重建），本组件不再自带内层 Tab，只服务单个 method。
 * 面板压到与登录表单主体同高 192：二维码 144 + 提示 10 + 20 + 有效期行 18；
 * 生成中 / 过期 / 出错都画在同一 144 方框里，不改变高度。
 * createQr / pollQr / 轮询失败阈值 / 竞态丢弃等状态机逻辑未改动。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { QrCodeRenderer, type AuthLoginHostBridge, type LoginMethod } from '@kimposoft/plugin-sdk';
import { isKnownErrorCode, resolveErrorKey } from '../errorMessages';
import { safeLog } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';

defineOptions({ name: 'KimpoQrPanel' });

const props = defineProps<{
  bridge?: AuthLoginHostBridge;
  method: LoginMethod;
}>();

const { t } = useLoginI18n();

type QrStatus = 'idle' | 'creating' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error';

const status = ref<QrStatus>('idle');
const qrSessionId = ref('');
const qrContent = ref('');
const embedUrl = ref('');
const errorMessage = ref('');
/** 二维码有效期（秒），用于「二维码 N 分钟内有效」提示；0 表示宿主未给。 */
const expiresIn = ref(0);
/** 组件已卸载标记：createQr 未返回时卸载（切 Tab），结果丢弃，避免卸载后又开轮询。 */
let disposed = false;

let pollTimer: ReturnType<typeof setInterval> | null = null;
/** 连续 poll 失败计数：超过阈值判定会话不可用，避免网络硬故障时无限重试。 */
let consecutivePollFailures = 0;
const MAX_POLL_FAILURES = 5;
const POLL_INTERVAL_MS = 2000;

const qrSvg = computed(() => {
  if (!qrContent.value) return '';
  try {
    return QrCodeRenderer(qrContent.value, 200);
  } catch (err) {
    safeLog(props.bridge, 'warn', 'qr panel QrCodeRenderer failed', { error: String(err) });
    return '';
  }
});

const validMinutes = computed(() => (expiresIn.value > 0 ? Math.max(1, Math.ceil(expiresIn.value / 60)) : 0));

const tipText = computed(() => {
  switch (status.value) {
    case 'scanned':
      return t('login.qr.scanned');
    case 'confirmed':
      return t('login.qr.confirmed');
    case 'expired':
      return t('login.qr.expired');
    case 'creating':
    case 'idle':
      return t('login.qr.creating');
    case 'error':
      return errorMessage.value;
    default:
      return t('login.qr.pending');
  }
});

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  consecutivePollFailures = 0;
  pollTimer = setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

async function pollOnce() {
  if (!props.bridge || !qrSessionId.value) return;
  try {
    const result = await props.bridge.pollQr(qrSessionId.value);
    consecutivePollFailures = 0;
    if (result.status === 'expired') {
      status.value = 'expired';
      stopPolling();
      return;
    }
    status.value = result.status;
    if (result.status === 'confirmed' && result.loggedIn) {
      stopPolling();
      props.bridge.redirectFromLogin();
    }
  } catch (err) {
    const errorCode = (err as { errorCode?: string } | undefined)?.errorCode;
    // 宿主对过期 / 不存在的二维码会话回 404 AUTH_QR_SESSION_NOT_FOUND（SDK tp.19 核定词表）。
    if (errorCode === 'AUTH_QR_SESSION_NOT_FOUND') {
      status.value = 'expired';
      stopPolling();
      return;
    }
    consecutivePollFailures++;
    if (!errorCode || !isKnownErrorCode(errorCode)) {
      safeLog(props.bridge, 'warn', 'qr panel pollQr() rejected', { error: String(err), errorCode });
    }
    if (consecutivePollFailures >= MAX_POLL_FAILURES) {
      // 连续失败达到阈值：判定会话不可用，停止轮询并提示用户手动刷新，而不是无限重试。
      status.value = 'error';
      errorMessage.value = t(resolveErrorKey(errorCode));
      stopPolling();
    }
  }
}

async function createSession() {
  const methodId = props.method?.id;
  if (!props.bridge || !methodId) return;
  stopPolling();
  status.value = 'creating';
  errorMessage.value = '';
  qrContent.value = '';
  embedUrl.value = '';
  try {
    const result = await props.bridge.createQr(methodId);
    if (disposed) return; // 生成期间已切走 Tab：丢弃过期响应
    qrSessionId.value = result.qrSessionId;
    qrContent.value = result.qrContent ?? '';
    embedUrl.value = result.embedUrl ?? '';
    expiresIn.value = typeof result.expiresIn === 'number' ? result.expiresIn : 0;
    status.value = 'pending';
    startPolling();
  } catch (err) {
    if (disposed) return;
    const errorCode = (err as { errorCode?: string } | undefined)?.errorCode;
    status.value = 'error';
    errorMessage.value = t(resolveErrorKey(errorCode));
    safeLog(props.bridge, 'warn', 'qr panel createQr() rejected', { error: String(err), errorCode, methodId });
  }
}

function handleRefresh() {
  void createSession();
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    stopPolling();
  } else if (status.value === 'pending' || status.value === 'scanned') {
    startPolling();
  }
}

onMounted(() => {
  void createSession();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  stopPolling();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
});

const showCode = computed(() => status.value === 'pending' || status.value === 'scanned' || status.value === 'confirmed');
const showRefresh = computed(() => status.value === 'expired' || status.value === 'error');
</script>

<template>
  <div class="klp-qr-panel">
    <!-- 144 方框：二维码 / 生成中 / 过期 / 出错共用，不改变高度。 -->
    <div class="klp-qr-code" :class="{ 'klp-qr-code--dim': !showCode }">
      <template v-if="showCode">
        <!-- 第三方官方 iframe（如钉钉）：按同高规则压在 144 框内（见交付说明的疑问项）。 -->
        <iframe v-if="embedUrl" :src="embedUrl" class="klp-qr-iframe" :title="method.displayName" />
        <div v-else-if="qrSvg" class="klp-qr-svg" role="img" :aria-label="t('login.qr.title')" v-html="qrSvg" />
        <img v-if="method.logo && !embedUrl" :src="method.logo" alt="" class="klp-qr-badge" />
      </template>
      <button v-else-if="showRefresh" type="button" class="klp-link-btn klp-qr-refresh" @click="handleRefresh">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.2 8a5.2 5.2 0 1 1-1.52-3.68M13.2 2.6v2.6h-2.6"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ t('login.qr.refresh') }}</span>
      </button>
    </div>
    <p
      class="klp-qr-tip"
      :class="{ 'klp-qr-tip--error': status === 'error' }"
      :role="status === 'error' ? 'alert' : undefined"
      aria-live="polite"
      :title="tipText"
    >
      {{ tipText }}
    </p>
    <p class="klp-qr-sub">
      <template v-if="showCode">
        <template v-if="validMinutes">{{ t('login.qr.validFor', { minutes: validMinutes }) }} · </template>
        <button type="button" class="klp-link-btn klp-qr-sub-link" @click="handleRefresh">
          {{ t('login.qr.refresh') }}
        </button>
      </template>
    </p>
  </div>
</template>

<style scoped>
/* 144 + 10 + 20 + 18 = 192（与登录表单主体同高）。 */
.klp-qr-panel {
  height: 192px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.klp-qr-code {
  position: relative;
  width: 144px;
  height: 144px;
  box-sizing: border-box;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  overflow: hidden;
  /* 二维码必须白底深码才能被扫，暗色模式下也保持白底。 */
  background-color: #ffffff;
  border: 1px solid var(--klp-input-border, #e4e7ed);
}

.klp-qr-code--dim {
  background-color: var(--klp-input-bg, #fafafa);
}

.klp-qr-svg {
  width: 100%;
  height: 100%;
}

.klp-qr-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.klp-qr-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* 方式图标居中压在码上（视觉规范：28 圆 + 3px 白边）。 */
.klp-qr-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 3px solid #ffffff;
  background: #ffffff;
  object-fit: contain;
}

.klp-qr-refresh {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.klp-qr-tip {
  margin: 10px 0 0;
  max-width: 100%;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--klp-text-primary, #1f1f1f);
}

.klp-qr-tip--error {
  color: var(--klp-error, #d03050);
}

.klp-qr-sub {
  margin: 0;
  height: 18px;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  color: var(--klp-text-placeholder, #999999);
}

.klp-qr-sub-link {
  font-size: 12px;
  line-height: 18px;
}
</style>
