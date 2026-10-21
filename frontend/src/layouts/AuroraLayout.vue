<script setup lang="ts">
/**
 * 外壳：aurora 极光分栏（插件最初的样式，为四种样式之一）。
 * 左侧动态极光圆斑 + 超大双行品牌标题，右侧毛玻璃卡片；视觉与响应式三档沿用 2026-07-09～07-11
 * 历次 Figma 定稿返工结论（注释原样保留）。改动只有两处：
 *   ① 卡片不再 min-height 463 + 垂直居中（会随内容高度跳动），改为「高度由内容决定、顶部位置固定」：
 *      顶部 = max(24, (视口高 − 卡片默认高) / 2)，卡片默认高 = 外框 168 + 表单默认高（视觉规范 curTop）；
 *      出现验证码时只向下生长。
 *   ② logo → 表单间距 54 → 40，卡片上下内边距 48 / 48（视觉规范）。
 * 本外壳只负责画面，不承载任何认证逻辑；表单区经默认插槽传入。
 */
import { computed } from 'vue';

defineOptions({ name: 'KimpoLayoutAurora' });

const props = defineProps<{
  slogan?: string;
  logoSrc: string;
  /** 图形标（仅 ring 外壳使用）；声明出来避免作为未知属性透传到根节点。 */
  markSrc?: string;
  logoAlt: string;
  /** 表单区默认高度（不含验证码行），用于计算卡片固定顶部位置。 */
  baseFormHeight: number;
}>();

const emit = defineEmits<{ (e: 'logo-error'): void }>();

/** 卡片外框高度：上内边距 48 + logo 30 + 间距 40 + 下内边距 48 + 上下描边 2。 */
const CARD_FRAME_HEIGHT = 168;
const cardVars = computed(() => ({ '--klp-card-h': `${CARD_FRAME_HEIGHT + props.baseFormHeight}px` }));
</script>

<template>
  <div class="klp-root klp-style-aurora klp-layout-aurora" :style="cardVars">
    <!--
      动态极光层（规则 2，2026-07-09 二次真机对照返工）：定稿 ref-1495 的光晕其实是
      **单枚独立圆形光斑**（Figma 图层 Ellipse8），不是整页/整个左栏弥漫的矩形色块——
      挂在根节点只是为了不受 .klp-aside 的 padding/flex 布局影响，容器自身就是
      一个固定尺寸的圆（border-radius:50% + overflow:hidden 双重裁切，见 <style>），
      圆外没有任何色晕。双层伪元素在圆内异速漂移实现"流动"，动画绝不越出圆边界。
    -->
    <div class="klp-aurora" aria-hidden="true"></div>

    <!-- 左侧品牌区（规则 1/4）：超大双行标题，纯视觉。手机档（≤640px）标题隐藏。 -->
    <aside class="klp-aside">
      <h1 class="klp-brand-title">
        <span v-if="slogan" class="klp-slogan klp-brand-slogan">{{ slogan }}</span>
        <template v-else>
          <!-- 「Sign In / to Kimpo」是品牌语，非系统文本，不随语言切换。 -->
          <span class="klp-brand-title-line">Sign In</span>
          <span class="klp-brand-title-line">to Kimpo</span>
        </template>
      </h1>
    </aside>

    <!-- 右侧毛玻璃登录卡片（规则 1/3）。 -->
    <div class="klp-card-outer">
      <div class="klp-card">
        <div class="klp-lang-slot"><slot name="lang" /></div>
        <div class="klp-card-inner">
          <div class="klp-logo-row">
            <img :src="logoSrc" :alt="logoAlt" class="klp-logo" @error="emit('logo-error')" />
          </div>
          <main class="klp-main">
            <slot />
          </main>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 布局根：左右分栏（规则 1），左品牌区 + 右卡片 ─────────────────────────────────────── */
.klp-layout-aurora {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: row;
  position: relative; /* 供手机档 .klp-aside 全页铺底做绝对定位基准 */
  overflow-x: hidden; /* 规则 6：任何档位都不得出现横向滚动 */
  box-sizing: border-box;
  /* 整页底色渐变（缺省视觉，不依赖任何品牌资产）；brand.background 存在时由内联样式覆盖。 */
  background: var(--klp-page-bg);
  --klp-page-bg: linear-gradient(
    188deg,
    rgb(var(--primary-50-color, 230 241 254)) 5%,
    rgb(var(--container-bg-color, 255 255 255)) 66%
  );
  --klp-card-bg: rgba(255, 255, 255, 0.6);
  --klp-card-border: #ffffff; /* 定稿 border-white：1px 纯白描边 */
  --klp-card-shadow: 15px 0 56.8px rgba(9, 217, 238, 0.03), 0 29px 85.8px rgba(8, 119, 244, 0.1);
}

html.dark .klp-layout-aurora {
  --klp-page-bg: linear-gradient(188deg, #0f1420 5%, #0b0d12 66%);
  --klp-card-bg: rgba(24, 24, 28, 0.55);
  --klp-card-border: rgba(255, 255, 255, 0.12);
  --klp-card-shadow: 0 29px 70px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35);
}

/* ── 左侧品牌区（规则 1/4）：极光已上移到整页根层，这里只承载大标题 ───────────────────── */
.klp-aside {
  position: relative;
  z-index: 1; /* 压在整页极光层之上 */
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  /* 标题属于 Group 15：Figma 1920×1080 画布中左缘为 385.923px，与光斑使用相同的双轴缩放比。 */
  padding-left: min(20.100169vw, 35.733633vh);
  padding-right: 24px;
  box-sizing: border-box;
}

/*
 * 极光层（规则 2；2026-07-10/11 多次返工定版，详细试错记录见 git 历史）：
 * 单枚独立圆形光斑（Figma Ellipse8），border-radius:50% + overflow:hidden 双重裁切；
 * 双层 217° repeating-linear-gradient 定向流动 + 36px 高斯模糊，圆缘融入靠静态 radial mask。
 * 尺寸按 Figma Group 15（1920×1080 画布内为 700×700）等比缩放。
 */
.klp-aurora {
  --klp-aurora-inner-blur: 36px;
  position: absolute;
  /* Group 15：直径 700px、left 289px（1920×1080）；两轴共同限制，1440×900 为 525px。 */
  --klp-aurora-size: min(36.458333vw, 64.814815vh);
  width: var(--klp-aurora-size);
  height: var(--klp-aurora-size);
  left: min(15.052083vw, 26.759259vh);
  top: 50%;
  transform: translateY(-50%);
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  -webkit-mask-image: radial-gradient(closest-side, #000 62%, transparent 100%);
  mask-image: radial-gradient(closest-side, #000 62%, transparent 100%);
  /* 底衬（用户指定色）：极浅蓝→薰衣草→浅青→奶油黄的 217° 线性渐变。 */
  background: linear-gradient(217deg, #def2ff 13.43%, #eddfff 39.69%, #c2f9ff 65.9%, #fff5dc 82.12%);
}

.klp-aurora::before,
.klp-aurora::after {
  content: '';
  position: absolute;
  /* -55% ≈ 210% 容器宽的方形渐变场，任意平移位置都完整盖住圆形裁切区。 */
  inset: -55%;
  will-change: background-position;
}

/* 217° 定向流动渐变波：周期 600px，位移 (-361px, 479px) 与周期严格对齐→无缝循环；
   双层同向异速（4s / 6.5s + 半周期错相）叠加混色。 */
.klp-aurora::before {
  background-image: repeating-linear-gradient(
    217deg,
    #def2ff 0,
    #eddfff 150px,
    #c2f9ff 300px,
    #fff5dc 450px,
    #def2ff 600px
  );
  opacity: 0.85;
  filter: blur(var(--klp-aurora-inner-blur));
  animation: klp-aurora-flow 4s linear infinite;
}

.klp-aurora::after {
  inset: -40%;
  background-image: repeating-linear-gradient(
    217deg,
    #fff5dc 0,
    #c2f9ff 150px,
    #eddfff 300px,
    #def2ff 450px,
    #fff5dc 600px
  );
  opacity: 0.65;
  filter: blur(var(--klp-aurora-inner-blur));
  animation: klp-aurora-flow 6.5s linear infinite;
}

html.dark .klp-aurora {
  background: linear-gradient(217deg, #16233a 13.43%, #241a3a 39.69%, #10303a 65.9%, #2e2a1c 82.12%);
}

html.dark .klp-aurora::before {
  background-image: repeating-linear-gradient(
    217deg,
    #1d3a55 0,
    #3a2d5c 150px,
    #144a55 300px,
    #4a4228 450px,
    #1d3a55 600px
  );
}

html.dark .klp-aurora::after {
  background-image: repeating-linear-gradient(
    217deg,
    #4a4228 0,
    #144a55 150px,
    #3a2d5c 300px,
    #1d3a55 450px,
    #4a4228 600px
  );
}

@keyframes klp-aurora-flow {
  0% {
    background-position: 0px 0px;
  }
  100% {
    background-position: -361px 479px;
  }
}

/* 无障碍降级：减弱动效偏好下必须静止，但保留静态极光观感。 */
@media (prefers-reduced-motion: reduce) {
  .klp-aurora::before,
  .klp-aurora::after {
    animation: none;
  }
}

/* 大标题：两行英文品牌口号（规则 4），两行右缘对齐、行距 1.44（定稿 ref-1495）。 */
.klp-brand-title {
  position: relative;
  z-index: 1;
  margin: 0;
  width: fit-content;
  text-align: right;
  /* 品牌语大标题使用系统字体栈。 */
  font-family: Roboto, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 900;
  /* Figma 设计字号 114.872px@1920；与 Group 15 同比缩放。 */
  font-size: min(5.982917vw, 10.636296vh);
  line-height: 1.44;
  color: var(--klp-text-primary);
}

.klp-brand-title-line {
  display: block;
}

/* 自定义标语：最长 40 字，限制宽度避免挤压右侧卡片。 */
.klp-brand-slogan {
  display: block;
  max-width: 40vw;
}

/* ── 右侧毛玻璃卡片（规则 1/3）───────────────────────────────────────────────────────── */
.klp-card-outer {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  /* 顶部固定：按默认态在视口内居中后不再变化（视觉规范 curTop = (900 − 168 − f) / 2）。 */
  padding: max(24px, calc((100vh - var(--klp-card-h, 468px)) / 2)) 76px 24px 24px;
  box-sizing: border-box;
}

.klp-card {
  position: relative;
  width: 440px;
  max-width: calc(100vw - 48px);
  box-sizing: border-box;
  padding: 48px 0;
  border-radius: 4px;
  background: var(--klp-card-bg);
  backdrop-filter: blur(17.1px);
  -webkit-backdrop-filter: blur(17.1px);
  border: 1px solid var(--klp-card-border);
  box-shadow: var(--klp-card-shadow);
}

.klp-lang-slot {
  position: absolute;
  top: 24px;
  left: 24px;
}

.klp-card-inner {
  width: 298px; /* 卡片内容列宽（居中） */
  max-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.klp-logo-row {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px; /* logo 行 → 表单 gap（视觉规范 40） */
}

.klp-logo {
  height: 30px; /* 规则 3：锁定高度，宽度按比例缩放 */
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.klp-main {
  display: flex;
  flex-direction: column;
}

/* ── 响应式三档（规则 6）：641–1024 上下堆叠；≤640 标题隐藏、卡片铺满 ───────────────────── */
@media (min-width: 641px) and (max-width: 1024px) {
  .klp-layout-aurora {
    flex-direction: column;
  }

  .klp-aside {
    flex: 0 0 auto;
    min-height: 220px;
    justify-content: center;
    padding: 48px 24px 24px;
    text-align: center;
  }

  .klp-brand-title {
    font-size: clamp(36px, 6vw, 56px);
    text-align: center;
  }

  .klp-brand-slogan {
    max-width: 80vw;
  }

  /* inline 两个 <span> 之间补显式空格，避免连读成 "Sign Into Kimpo"。 */
  .klp-brand-title-line {
    display: inline;
  }

  .klp-brand-title-line:not(:last-child)::after {
    content: ' ';
  }

  .klp-card-outer {
    justify-content: center;
    padding: 16px 24px 40px;
  }

  .klp-card {
    width: 100%;
    max-width: 440px;
  }
}

@media (max-width: 640px) {
  .klp-layout-aurora {
    display: block;
  }

  .klp-aside {
    display: none;
  }

  .klp-aurora {
    /* 小屏收窄圆径并挪到左上角做点缀，避免遮住卡片。 */
    --klp-aurora-inner-blur: 26px;
    width: min(80vw, 480px);
    height: min(80vw, 480px);
    left: -18vw;
    top: -12vw;
    transform: none;
  }

  .klp-card-outer {
    position: relative;
    width: 100%;
    padding: 16px;
    justify-content: center;
  }

  .klp-card {
    width: 100%;
    max-width: 100%;
    padding: 24px 0 32px;
  }

  .klp-card-inner {
    width: 100%;
    padding: 0 20px;
  }

  .klp-logo-row {
    margin-bottom: 36px;
  }
}
</style>
