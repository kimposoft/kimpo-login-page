<script setup lang="ts">
/**
 * 外壳：ring 环形卡片（视觉规范样式 A）。
 * 浅蓝渐变底 + 漂移色晕 + 三层同心圆错峰呼吸，中间一张 400 宽白色圆角卡片：
 * Kimpo 图形标 + 「Welcome to Kimpo」（品牌语，不随语言）+ 表单区。
 * 卡片高度由内容决定，顶部按默认态居中后固定（视觉规范 aTop = (900 − 210 − f) / 2）。
 * 本外壳只负责画面，不承载任何认证逻辑。
 */
import { computed } from 'vue';

defineOptions({ name: 'KimpoLayoutRing' });

const props = defineProps<{
  slogan?: string;
  /** 图形标（无字标）：brand.logo 有值时为品牌 logo。 */
  markSrc: string;
  /** 完整 logo（本外壳不用）；声明出来避免作为未知属性透传到根节点。 */
  logoSrc?: string;
  logoAlt: string;
  baseFormHeight: number;
}>();

const emit = defineEmits<{ (e: 'logo-error'): void }>();

/** 卡片外框：上内边距 48 + 图形标 41 + 8 + 标题 41 + 32 + 下内边距 40。 */
const CARD_FRAME_HEIGHT = 210;
const vars = computed(() => ({ '--klp-card-h': `${CARD_FRAME_HEIGHT + props.baseFormHeight}px` }));
</script>

<template>
  <div class="klp-root klp-style-ring klp-layout-ring" :style="vars">
    <!-- 背景装饰（纯视觉）：色晕漂移 + 三层同心圆错峰呼吸 + 右下小圆。 -->
    <div class="klp-ring-wash klp-motion" aria-hidden="true"></div>
    <div class="klp-ring-circle klp-ring-circle--l" aria-hidden="true"><i class="klp-motion"></i></div>
    <div class="klp-ring-circle klp-ring-circle--m" aria-hidden="true"><i class="klp-motion"></i></div>
    <div class="klp-ring-circle klp-ring-circle--s" aria-hidden="true"><i class="klp-motion"></i></div>
    <div class="klp-ring-dot" aria-hidden="true"></div>

    <div class="klp-ring-stage">
      <div class="klp-ring-card">
        <div class="klp-lang-slot"><slot name="lang" /></div>
        <img :src="markSrc" :alt="logoAlt" class="klp-ring-mark" @error="emit('logo-error')" />
        <h1 class="klp-ring-title">
          <span v-if="slogan" class="klp-slogan">{{ slogan }}</span>
          <!-- 品牌语，不随语言切换。 -->
          <template v-else>Welcome to Kimpo</template>
        </h1>
        <main class="klp-ring-main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.klp-layout-ring {
  /* 1440×900 视觉规范单位：按视口短边缩放，保证同心圆在各种宽高比下仍是正圆且铺满视口高。 */
  --klp-ring-u: calc(min(100vh, 100vw) / 900);
  --klp-page-bg: linear-gradient(120deg, #ffffff 2.5%, #ceebff 99.6%);
  --klp-ring-wash: radial-gradient(circle at 28% 30%, rgba(10, 216, 239, 0.16), transparent 40%),
    radial-gradient(circle at 76% 72%, rgba(140, 120, 255, 0.13), transparent 42%);
  --klp-ring-fill-l: rgba(255, 255, 255, 0.22);
  --klp-ring-fill-m: rgba(255, 255, 255, 0.28);
  --klp-ring-fill-s: rgba(255, 255, 255, 0.36);
  --klp-ring-glow: rgba(82, 160, 247, 0.08);
  --klp-ring-card-bg: #ffffff;
  --klp-ring-card-shadow: 3px 4px 11.3px rgba(82, 160, 247, 0.3);
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--klp-page-bg);
}

html.dark .klp-layout-ring {
  --klp-page-bg: linear-gradient(120deg, #0e1118 2.5%, #0f2033 99.6%);
  --klp-ring-wash: radial-gradient(circle at 28% 30%, rgba(10, 216, 239, 0.1), transparent 40%),
    radial-gradient(circle at 76% 72%, rgba(140, 120, 255, 0.09), transparent 42%);
  --klp-ring-fill-l: rgba(255, 255, 255, 0.025);
  --klp-ring-fill-m: rgba(255, 255, 255, 0.035);
  --klp-ring-fill-s: rgba(255, 255, 255, 0.05);
  --klp-ring-glow: rgba(77, 171, 247, 0.06);
  --klp-ring-card-bg: #171b23;
  --klp-ring-card-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.klp-ring-wash {
  position: absolute;
  inset: -20%;
  background: var(--klp-ring-wash);
  animation: klp-ring-wash 18s ease-in-out infinite alternate;
  pointer-events: none;
}

/* 同心圆：外层负责居中定位，内层 <i> 负责呼吸动画（transform 不冲突）。 */
.klp-ring-circle {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.klp-ring-circle i {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: klp-ring-breath 8s ease-in-out infinite;
}

.klp-ring-circle--l {
  width: calc(var(--klp-ring-u) * 900);
  height: calc(var(--klp-ring-u) * 900);
}

.klp-ring-circle--l i {
  background: var(--klp-ring-fill-l);
  box-shadow: 0 0 60px var(--klp-ring-glow);
}

.klp-ring-circle--m {
  width: calc(var(--klp-ring-u) * 700);
  height: calc(var(--klp-ring-u) * 700);
}

.klp-ring-circle--m i {
  background: var(--klp-ring-fill-m);
  box-shadow: 0 0 50px var(--klp-ring-glow);
  animation-delay: -2.6s;
}

.klp-ring-circle--s {
  width: calc(var(--klp-ring-u) * 500);
  height: calc(var(--klp-ring-u) * 500);
}

.klp-ring-circle--s i {
  background: var(--klp-ring-fill-s);
  box-shadow: 0 0 40px var(--klp-ring-glow);
  animation-delay: -5.2s;
}

/* 右下小圆：视觉规范圆心相对视口中心 (+294, +326)，直径 248。 */
.klp-ring-dot {
  position: absolute;
  left: calc(50% + var(--klp-ring-u) * 170);
  top: calc(50% + var(--klp-ring-u) * 202);
  width: calc(var(--klp-ring-u) * 248);
  height: calc(var(--klp-ring-u) * 248);
  border-radius: 50%;
  background: var(--klp-ring-fill-l);
  pointer-events: none;
}

@keyframes klp-ring-breath {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.045);
    opacity: 0.7;
  }
}

@keyframes klp-ring-wash {
  0% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(6%, -4%);
  }
  100% {
    transform: translate(-4%, 5%);
  }
}

/* 卡片舞台：顶部固定 = max(24, (视口高 − 卡片默认高) / 2)。 */
.klp-ring-stage {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding: max(24px, calc((100vh - var(--klp-card-h, 510px)) / 2)) 24px 24px;
  box-sizing: border-box;
}

.klp-ring-card {
  position: relative;
  width: 400px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 48px 51px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 24px;
  background: var(--klp-ring-card-bg);
  box-shadow: var(--klp-ring-card-shadow);
}

.klp-lang-slot {
  position: absolute;
  left: 16px;
  top: 16px;
}

.klp-ring-mark {
  height: 41px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
  margin-bottom: 8px;
}

.klp-ring-title {
  margin: 0 0 32px;
  min-height: 41px;
  font-size: 28px;
  font-weight: 500;
  line-height: 41px;
  text-align: center;
  color: var(--klp-text-primary);
}

.klp-ring-main {
  width: 100%;
}

@media (max-width: 640px) {
  .klp-ring-stage {
    padding-left: 16px;
    padding-right: 16px;
  }

  .klp-ring-card {
    width: 100%;
    padding: 48px 20px 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .klp-motion {
    animation: none !important;
  }
}
</style>
