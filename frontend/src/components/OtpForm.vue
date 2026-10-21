<script setup lang="ts">
/**
 * otp kind 表单——短信验证码登录。
 *
 * 链路：本组件（kimpo 登录页插件，填报无关、纯登录 UI）→ hostBridge.sendOtp / verifyOtp →
 * 宿主 /api/v1/auth/otp/*。插件不持凭证、不知协议：手机号与验证码只在调用瞬间经桥交给宿主，
 * **不进日志**（日志只记 methodId / 冷却秒数 / 错误码）。
 *
 * 高度与 PasswordForm 一致（主体 192）：手机号 40 + 36 + 验证码 40 + 40 + 按钮 36；
 * 「已发送」灰字、必填红字、宿主业务错误都绝对定位在既有间距里，不改变高度。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { AuthLoginHostBridge, LoginMethod, LoginOutcome } from '@kimposoft/plugin-sdk';
import { isKnownErrorCode, resolveErrorKey } from '../errorMessages';
import { safeLog } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';

defineOptions({ name: 'KimpoOtpForm' });

const props = withDefaults(
  defineProps<{
    bridge?: AuthLoginHostBridge;
    method: LoginMethod;
    /** 输入框左侧是否显示内嵌图标（ring 样式按视觉规范不显示）。 */
    showIcons?: boolean;
  }>(),
  { showIcons: true }
);

const emit = defineEmits<{
  /** verifyOtp() 返回 challenge 时上抛，由 LoginPage 切到 ChallengeForm（§7.5，与密码登录同路径）。 */
  (e: 'challenge', challenge: { type: string; challengeToken: string }): void;
}>();

const { t } = useLoginI18n();

/** 发送成功但返回值没有可用冷却秒数时的兜底（与宿主 OTP_DEFAULT_RETRY_AFTER 同值）。 */
const DEFAULT_RETRY_AFTER = 60;
/** 大陆手机号粗校验（与宿主内置 code-login 的 REG_PHONE 同口径的宽松版：1 开头 11 位）；权威校验在宿主。 */
const PHONE_PATTERN = /^1\d{10}$/;

const model = reactive({ phone: '', code: '' });
const fieldErrors = reactive({ phone: '', code: '' });
/** 宿主返回的业务错误（验证码错 / 限频 / 未开通等），展示在验证码框下方。 */
const errorMessage = ref('');
const sending = ref(false);
const loading = ref(false);
/** 已发送过验证码的手机号（脱敏后展示在「已发送」提示里）；切换号码不清，重新发送时覆盖。 */
const sentTo = ref('');

// ── 重发倒计时 ─────────────────────────────────────────────────────────────────────────
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

function stopCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown(seconds: number) {
  stopCountdown();
  countdown.value = Math.max(1, Math.round(seconds));
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      countdown.value = 0;
      stopCountdown();
    }
  }, 1000);
}

onBeforeUnmount(stopCountdown);

/** 去掉空格 / 短横线后的手机号（用户可能按 138 0013 8000 习惯输入）。 */
const normalizedPhone = computed(() => model.phone.replace(/[\s-]/g, ''));

/** 「获取验证码」按钮文案：发送中 / 倒计时 / 可发送。 */
const sendLabel = computed(() => {
  if (sending.value) return t('login.otp.sending');
  if (countdown.value > 0) return t('login.otp.resend', { seconds: countdown.value });
  return t('login.otp.send');
});
const canSend = computed(() => !sending.value && countdown.value === 0 && !loading.value);

/** 138****8000 形式脱敏展示。 */
function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

/** 校验手机号；不通过时在手机号框下方给红字并返回 false。 */
function validatePhone(): boolean {
  if (!normalizedPhone.value) {
    fieldErrors.phone = t('login.otp.phoneRequired');
    return false;
  }
  if (!PHONE_PATTERN.test(normalizedPhone.value)) {
    fieldErrors.phone = t('login.otp.phoneInvalid');
    return false;
  }
  fieldErrors.phone = '';
  return true;
}

function clearFieldError(field: 'phone' | 'code') {
  fieldErrors[field] = '';
}

/** 宿主错误码 → 文案。OTP 下 AUTH_INVALID_CREDENTIALS 表示验证码错误或过期，不能沿用「用户名或密码错误」。 */
function resolveOtpError(errorCode?: string): string {
  if (errorCode === 'AUTH_INVALID_CREDENTIALS') return t('login.otp.err.codeInvalid');
  return t(resolveErrorKey(errorCode));
}

async function handleSend() {
  if (!canSend.value) return;
  if (!validatePhone()) return;
  if (!props.bridge) {
    errorMessage.value = t('login.err.bridgeMissing');
    return;
  }
  sending.value = true;
  errorMessage.value = '';
  const phone = normalizedPhone.value;
  try {
    const result = await props.bridge.sendOtp(props.method.id, phone);
    const retryAfter = result?.retryAfter && result.retryAfter > 0 ? result.retryAfter : DEFAULT_RETRY_AFTER;
    sentTo.value = maskPhone(phone);
    startCountdown(retryAfter);
    // 日志不带手机号（§11）：只记方式与冷却时长。
    safeLog(props.bridge, 'info', 'otp form sendOtp() succeeded', { methodId: props.method.id, retryAfter });
  } catch (err) {
    const e = err as { errorCode?: string; retryAfter?: number } | undefined;
    errorMessage.value = resolveOtpError(e?.errorCode);
    // 被限频时宿主可能附带建议冷却秒数，直接进入倒计时，避免用户反复点击。
    if (e?.retryAfter && e.retryAfter > 0) startCountdown(e.retryAfter);
    safeLog(props.bridge, 'warn', 'otp form sendOtp() rejected', {
      methodId: props.method.id,
      errorCode: e?.errorCode,
      retryAfter: e?.retryAfter,
      error: String(err)
    });
  } finally {
    sending.value = false;
  }
}

async function handleSubmit() {
  if (loading.value) return; // 防双击
  const phoneOk = validatePhone();
  fieldErrors.code = model.code.trim() ? '' : t('login.otp.codeRequired');
  if (!phoneOk || fieldErrors.code) {
    errorMessage.value = ''; // 与必填红字共用验证码框下方间距，先清掉旧业务错误
    return;
  }
  if (!props.bridge) {
    errorMessage.value = t('login.err.bridgeMissing');
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const outcome = await props.bridge.verifyOtp(props.method.id, normalizedPhone.value, model.code.trim());
    handleOutcome(outcome);
  } catch (err) {
    errorMessage.value = t('login.err.unknown');
    safeLog(props.bridge, 'warn', 'otp form verifyOtp() rejected', { methodId: props.method.id, error: String(err) });
  } finally {
    loading.value = false;
  }
}

function handleOutcome(outcome: LoginOutcome) {
  if (outcome.challenge) {
    emit('challenge', outcome.challenge);
    return;
  }
  if (outcome.ok) {
    safeLog(props.bridge, 'info', 'otp form verifyOtp() succeeded', { methodId: props.method.id });
    props.bridge?.redirectFromLogin();
    return;
  }
  errorMessage.value = resolveOtpError(outcome.errorCode);
  if (outcome.errorCode && !isKnownErrorCode(outcome.errorCode)) {
    safeLog(props.bridge, 'warn', 'otp form verifyOtp() returned unknown error code', {
      methodId: props.method.id,
      errorCode: outcome.errorCode
    });
  }
}

// 输入框 id 按 method 区分，多 otp 方式并存（各自一个 Tab）时不撞 id。
const phoneId = computed(() => `klp-otp-phone-${props.method.id}`);
const codeId = computed(() => `klp-otp-code-${props.method.id}`);
</script>

<template>
  <form class="klp-form" novalidate @submit.prevent="handleSubmit">
    <div class="klp-fields">
      <div class="klp-field">
        <label class="klp-label-visually-hidden" :for="phoneId">{{ t('login.otp.phone') }}</label>
        <NInput
          :id="phoneId"
          v-model:value="model.phone"
          size="large"
          :maxlength="13"
          :input-props="{ inputmode: 'tel' }"
          :status="fieldErrors.phone ? 'error' : undefined"
          :placeholder="t('login.otp.phonePlaceholder')"
          autocomplete="tel"
          :aria-label="t('login.otp.phone')"
          :disabled="loading"
          class="klp-input"
          @update:value="clearFieldError('phone')"
          @keyup.enter="handleSubmit"
        >
          <!-- 区号目前只支持中国大陆，按视觉规范展示 +86 前缀（不可选，后续多区号再改下拉）。 -->
          <template #prefix>
            <span class="klp-otp-region">+86</span>
          </template>
        </NInput>
        <p v-if="fieldErrors.phone" class="klp-field-error" role="alert">{{ fieldErrors.phone }}</p>
      </div>
      <div class="klp-field">
        <label class="klp-label-visually-hidden" :for="codeId">{{ t('login.otp.code') }}</label>
        <NInput
          :id="codeId"
          v-model:value="model.code"
          size="large"
          :maxlength="8"
          :input-props="{ inputmode: 'numeric' }"
          :status="fieldErrors.code ? 'error' : undefined"
          :placeholder="t('login.otp.codePlaceholder')"
          autocomplete="one-time-code"
          :aria-label="t('login.otp.code')"
          :disabled="loading"
          class="klp-input"
          @update:value="clearFieldError('code')"
          @keyup.enter="handleSubmit"
        >
          <template v-if="showIcons" #prefix>
            <span class="klp-input-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" />
                <path d="M2.8 4.2L8 8.2l5.2-4" stroke="#0877F4" stroke-linecap="round" />
              </svg>
            </span>
          </template>
          <!-- 内嵌「获取验证码」：发送后进入倒计时，倒计时内置灰不可点。 -->
          <template #suffix>
            <button
              type="button"
              class="klp-link-btn klp-otp-send"
              :disabled="!canSend"
              @click="handleSend"
            >
              {{ sendLabel }}
            </button>
          </template>
        </NInput>
        <!-- 验证码框下方一行（互斥）：必填红字 > 宿主业务错误 > 已发送灰字提示。 -->
        <p v-if="fieldErrors.code" class="klp-field-error" role="alert">{{ fieldErrors.code }}</p>
        <p v-else-if="errorMessage" class="klp-biz-error" role="alert" aria-live="polite" :title="errorMessage">
          <svg class="klp-biz-error-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" />
            <path d="M8 4.8v3.8M8 10.6v.6" stroke="currentColor" stroke-linecap="round" />
          </svg>
          <span class="klp-biz-error-text">{{ errorMessage }}</span>
        </p>
        <p v-else-if="sentTo" class="klp-field-hint" aria-live="polite">
          {{ t('login.otp.sent', { phone: sentTo }) }}
        </p>
      </div>
    </div>

    <NButton
      attr-type="submit"
      type="primary"
      size="large"
      block
      :loading="loading"
      :disabled="loading"
      class="klp-submit-btn"
    >
      {{ t('login.form.submit') }}
    </NButton>
  </form>
</template>

<style scoped>
/* +86 前缀：右侧细分隔线（视觉规范 border-right #e4e7ed）。 */
.klp-otp-region {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding-right: 8px;
  margin-right: 4px;
  border-right: 1px solid var(--klp-input-border, #e4e7ed);
  font-size: 14px;
  color: var(--klp-text-primary, #1f1f1f);
}

/* 内嵌发送按钮：左侧细分隔线，倒计时置灰。 */
.klp-otp-send {
  height: 18px;
  padding-left: 10px;
  border-left: 1px solid var(--klp-input-border, #e4e7ed);
  font-size: 14px;
  line-height: 18px;
  white-space: nowrap;
}
</style>
