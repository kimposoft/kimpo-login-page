<script setup lang="ts">
/**
 * challenge 续步表单（手册 §7.5，目前仅 type='password_change'）。
 * challengeToken 短 TTL 且一次性：answerChallenge() 返回 ok:false 时视为 token 失效/过期，
 * 上抛 done(false) 由 LoginPage 回到登录表单重新登录——本组件不重试、不刷新 token。
 * passwordRuleHint 仅做即时强度提示（UX），权威校验永远在宿主。
 *
 * 2026-10-18 高度对齐：整块压到与登录表单同高——
 *   头部 56（标题 24 + 4 + 说明 20 + 8，对应 Tab 区）/ 主体 192（新密码 40 + 36 + 确认 40 + 40 + 按钮 36）/
 *   底部 52（「返回登录」，对应「其他方式」行）。强度提示与校验红字绝对定位在既有间距里。
 * answerChallenge 调用与成功/失败处理逻辑未改动。
 */
import { computed, reactive, ref } from 'vue';
import { NButton, NInput } from 'naive-ui';
import type { AuthLoginHostBridge } from '@kimposoft/plugin-sdk';
import { resolveErrorKey } from '../errorMessages';
import { safeLog, safeMessage } from '../hostUtils';
import { useLoginI18n } from '../useLoginI18n';
// 与 PasswordForm 同款左侧内嵌图标：两个字段都是密码类输入，复用同一把锁图标。
import iconPassRaw from '../assets/brand/icon-pass.svg?raw';

defineOptions({ name: 'KimpoChallengeForm' });

const props = withDefaults(
  defineProps<{
    bridge?: AuthLoginHostBridge;
    challengeToken: string;
    passwordRuleHint?: { minLength?: number; requireClasses?: number };
    /** 输入框左侧是否显示内嵌图标（ring 样式按视觉规范不显示）。 */
    showIcons?: boolean;
  }>(),
  { showIcons: true }
);

const emit = defineEmits<{
  /** ok:true 由本组件内部调 redirectFromLogin 后仍上抛，便于父级清空 challenge 态；ok:false 父级回登录表单。 */
  (e: 'done', ok: boolean): void;
  /** 用户点「返回登录」主动放弃改密，父级回登录表单。 */
  (e: 'back'): void;
}>();

const { t } = useLoginI18n();

const model = reactive({ newPassword: '', confirmPassword: '' });
const loading = ref(false);
/** 本地校验错误（未填 / 两次不一致），展示在确认框下方。 */
const errorMessage = ref('');

const minLength = computed(() => props.passwordRuleHint?.minLength ?? 8);

/** 仅 UX 即时提示，不作为提交闸门权威依据（权威校验在宿主，见文件头注释）。 */
const strengthHint = computed(() => {
  if (!model.newPassword) return '';
  if (model.newPassword.length < minLength.value) {
    return t('login.challenge.hintTooShort', { minLength: minLength.value });
  }
  return '';
});

/** 确认框下方红字：提交时的校验错误优先，其次是两次输入不一致的即时提示。 */
const confirmError = computed(() => {
  if (errorMessage.value) return errorMessage.value;
  if (model.confirmPassword && model.newPassword !== model.confirmPassword) return t('login.challenge.mismatch');
  return '';
});

const canSubmit = computed(
  () =>
    model.newPassword.length > 0 &&
    model.confirmPassword.length > 0 &&
    model.newPassword === model.confirmPassword &&
    !loading.value
);

async function handleSubmit() {
  if (loading.value) return;
  if (!model.newPassword || !model.confirmPassword) {
    errorMessage.value = t('login.challenge.validationRequired');
    return;
  }
  if (model.newPassword !== model.confirmPassword) {
    errorMessage.value = t('login.challenge.mismatch');
    return;
  }
  if (!props.bridge) {
    errorMessage.value = t('login.err.bridgeMissing');
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const outcome = await props.bridge.answerChallenge({
      challengeToken: props.challengeToken,
      type: 'password_change',
      newPassword: model.newPassword
    });
    if (outcome.ok) {
      props.bridge.redirectFromLogin();
      emit('done', true);
      return;
    }
    // ok:false：token 失效/一次性已耗尽（或宿主拒绝的其余情形）——按 §7.5 回到登录表单重新登录。
    safeMessage(props.bridge, 'error', t(resolveErrorKey(outcome.errorCode)));
    emit('done', false);
  } catch (err) {
    safeLog(props.bridge, 'warn', 'challenge form answerChallenge() rejected', { error: String(err) });
    safeMessage(props.bridge, 'error', t('login.err.unknown'));
    emit('done', false);
  } finally {
    model.newPassword = '';
    model.confirmPassword = '';
    loading.value = false;
  }
}

function handleBack() {
  if (loading.value) return;
  model.newPassword = '';
  model.confirmPassword = '';
  safeLog(props.bridge, 'info', 'challenge form cancelled by user, back to login');
  emit('back');
}

function clearError() {
  errorMessage.value = '';
}
</script>

<template>
  <div class="klp-challenge">
    <!-- 头部 56：与登录表单的 Tab 区同高。 -->
    <div class="klp-challenge-head">
      <div class="klp-challenge-title">{{ t('login.challenge.title') }}</div>
      <p class="klp-challenge-hint" :title="t('login.challenge.mustChangeHint')">
        {{ t('login.challenge.mustChangeHint') }}
      </p>
    </div>

    <form class="klp-form klp-form-body" novalidate @submit.prevent="handleSubmit">
      <div class="klp-fields">
        <div class="klp-field">
          <label class="klp-label-visually-hidden" for="klp-new-password">
            {{ t('login.challenge.newPassword') }}
          </label>
          <NInput
            id="klp-new-password"
            v-model:value="model.newPassword"
            type="password"
            show-password-on="click"
            size="large"
            autocomplete="new-password"
            :placeholder="t('login.challenge.newPasswordPlaceholder')"
            :aria-label="t('login.challenge.newPassword')"
            :disabled="loading"
            class="klp-input"
            @update:value="clearError"
          >
            <template v-if="showIcons" #prefix>
              <span class="klp-input-icon" v-html="iconPassRaw"></span>
            </template>
          </NInput>
          <p v-if="strengthHint" class="klp-field-hint klp-field-hint--muted">{{ strengthHint }}</p>
        </div>
        <div class="klp-field">
          <label class="klp-label-visually-hidden" for="klp-confirm-password">
            {{ t('login.challenge.confirmPassword') }}
          </label>
          <NInput
            id="klp-confirm-password"
            v-model:value="model.confirmPassword"
            type="password"
            show-password-on="click"
            size="large"
            autocomplete="new-password"
            :status="confirmError ? 'error' : undefined"
            :placeholder="t('login.challenge.confirmPasswordPlaceholder')"
            :aria-label="t('login.challenge.confirmPassword')"
            :disabled="loading"
            class="klp-input"
            @update:value="clearError"
            @keyup.enter="handleSubmit"
          >
            <template v-if="showIcons" #prefix>
              <span class="klp-input-icon" v-html="iconPassRaw"></span>
            </template>
          </NInput>
          <p v-if="confirmError" class="klp-field-error" role="alert" aria-live="polite">{{ confirmError }}</p>
        </div>
      </div>
      <NButton
        attr-type="submit"
        type="primary"
        size="large"
        block
        :loading="loading"
        :disabled="!canSubmit"
        class="klp-submit-btn"
      >
        {{ t('login.challenge.submit') }}
      </NButton>
    </form>

    <!-- 底部 52：与「其他方式」行同高。 -->
    <div class="klp-footer-row">
      <button type="button" class="klp-challenge-back" :disabled="loading" @click="handleBack">
        {{ t('login.challenge.back') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.klp-challenge {
  display: flex;
  flex-direction: column;
}

/* 24 + 4 + 20 + 8 = 56。 */
.klp-challenge-head {
  height: 56px;
  box-sizing: border-box;
  padding-bottom: 8px;
}

.klp-challenge-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 24px;
  color: var(--klp-text-primary, #1f1f1f);
}

.klp-challenge-hint {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--klp-text-secondary, #666666);
}

.klp-challenge-back {
  height: 32px;
  border: 0;
  background: transparent;
  padding: 0 8px;
  font: inherit;
  font-size: 13px;
  color: var(--klp-text-secondary, #666666);
  cursor: pointer;
}

.klp-challenge-back:hover:not(:disabled),
.klp-challenge-back:focus-visible {
  color: var(--klp-brand-primary, #0877f4);
}
</style>
