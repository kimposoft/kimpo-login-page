import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

/**
 * cssInjectInline —— 把构建产出的 CSS 内联进 UMD bundle，运行时自注入 <style>。
 *
 * 缘由：宿主插件加载器只用 <script> 加载 plugin.umd.js，全程不加载伴随的
 * style.css。vite lib 模式会把 .vue 的 <style scoped> 抽成独立 style.css —— 不内联就会导致
 * 插件自有布局/间距/主题样式全丢。让 bundle 自带样式注入：保持插件前端自包含、宿主零改动、
 * 单一产物（plugin.umd.js）。
 */
function cssInjectInline(pluginId: string): Plugin {
  return {
    name: 'kimpo-css-inject-inline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      // 收集并移除所有 CSS 资产，拼成一段样式文本（只剩单一 JS 产物）。
      let css = '';
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && fileName.endsWith('.css')) {
          css += typeof asset.source === 'string'
            ? asset.source
            : Buffer.from(asset.source).toString('utf8');
          delete bundle[fileName];
        }
      }
      if (!css) return;
      // 注入片段：幂等（按 data 标记去重），DOM 就绪后插入 <head>。
      const marker = `kimpo-plugin-style-${pluginId}`;
      const snippet = `\n(function(){try{if(typeof document==="undefined")return;`
        + `if(document.querySelector("style[data-marker=\\"${marker}\\"]"))return;`
        + `var s=document.createElement("style");s.setAttribute("data-marker","${marker}");`
        + `s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}catch(e){}})();`;
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code += snippet;
        }
      }
    }
  };
}

/**
 * 官方标准登录页插件前端 UMD 构建配置。
 *
 * 外部化：vue + naive-ui（宿主通过 window.Vue / window.naive 提供共享全局，插件不打包）。
 * @kimposoft/plugin-sdk 为纯类型 + 零运行时依赖的极小 helper（createPluginI18n/QrCodeRenderer），打进 bundle。
 * 输出路径：frontend/dist/plugin.umd.js。manifest.json 声明的是包内路径
 * frontend/plugin.umd.js——打包时 build.sh 把本产物放到该路径。
 */
export default defineConfig({
  plugins: [vue(), cssInjectInline('loginpage')],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KimpoPlugins.loginpage',
      // 函数形式强制输出 plugin.umd.js，规避 "type":"module" 时 Vite 自动改后缀为 .cjs。
      fileName: () => 'plugin.umd.js',
      formats: ['umd']
    },
    rollupOptions: {
      external: ['vue', 'naive-ui'],
      output: {
        globals: {
          vue: 'Vue',
          'naive-ui': 'naive'
        }
      }
    }
  }
});
