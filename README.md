# kimpo-login-page

Kimpo 官方「标准登录页」插件的源码。插件 ID：`com.kimpo.login-page`。

它是一个纯前端插件，挂在宿主登录页插槽（`page-slot`，`slot = auth.login`）上渲染登录界面：

- 账号密码登录（宿主下发多个密码类登录方式时出现「登录方式」下拉）、短信验证码登录、扫码登录、单点登录跳转按钮；
- 图形验证码、首次登录强制改密等续步（challenge）；
- 四种外观样式：`split`（默认）/ `aurora` / `ring` / `glass`，以及自定义标语，由插件配置 `login_style`、`slogan` 选择（见 `config.schema.json`）；
- 中文简体 / 繁体、英文、日文四种语言。

插件只通过 SDK 提供的 `hostBridge` 调用宿主认证接口，不直接请求宿主 API；Vue 与 naive-ui 由宿主以全局变量提供，不打进 bundle。

## 依赖

- Node.js 18+ 与 npm
- Kimpo 插件 SDK 前端包 [`@kimposoft/plugin-sdk`](https://www.npmjs.com/package/@kimposoft/plugin-sdk) `1.1.0-tp.20`（预览版，见 `frontend/package.json`）
- 打包与预检：`zip`，以及 SDK 的签名 / 预检工具 `kimpo-plugin-sign`（Go 工具；没有 Go 时可跳过预检）

## 从源码构建 .kpp

```sh
# 可选：先装好预检工具（不装时 build.sh 会用 go run 临时编译，需要 Go ≥ 1.23）
GOWORK=off go install github.com/kimposoft/kimpo-plugin-sdk/cmd/kimpo-plugin-sign@v1.1.0-tp.20

bash build.sh
```

`build.sh` 依次执行 `npm ci` → `npm test`（vitest）→ `vite build`（单个 UMD 文件 `frontend/dist/plugin.umd.js`，样式内联）→ 组装 `.kpp` → `kimpo-plugin-sign lint`，产物在 `release/<插件ID>-<版本>.kpp`。前端开发时也可以在 `frontend/` 下直接用 `npm test`、`npm run typecheck`、`npm run build`。

包内结构：`manifest.json`、`config.schema.json`、`frontend/plugin.umd.js`、`frontend/locales/`、`frontend/previews/`（配置界面里各样式的缩略图）。

## 关于签名与插件 ID

- `com.kimposoft.*` / `com.kimpo.*` 是 Kimposoft 保留命名空间。**官方签名的安装包只由 Kimposoft 发布**，本仓库不含任何签名私钥。
- 用本仓库源码自行构建的包没有官方签名，宿主会按官方命名空间拦截安装；`kimpo-plugin-sign lint` 也会报 `reserved_plugin_namespace` 错误。
- 如需安装自己构建的版本，请把 `manifest.json` 的 `plugin_id`、`i18n.namespace` 改成你自己的插件 ID（如 `com.example.login-page`），并按需修改 `capabilities.frontend.global_name` 与 `frontend/vite.config.ts` 里的 UMD 全局名（两者必须一致），以第三方插件身份安装；第三方前端一律在宿主沙箱框架（iframe）里运行。签名用你自己的密钥（`KIMPO_PLUGIN_SIGNING_KEY_FILE=<私钥文件> bash build.sh`），流程见 SDK 文档 `docs/third-party/`。

## 许可证

源码以 [Apache License 2.0](LICENSE) 发布，Copyright 2026 金宝量行（无锡）软件有限公司，附加声明见 [NOTICE](NOTICE)。

Kimpo 名称与 logo 图形是金宝量行（无锡）软件有限公司的商标标识，Apache-2.0 不授予商标使用权。
