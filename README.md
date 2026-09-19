<div align="center">

<img src="client/public/favicon.svg" width="72" height="72" alt="Trip Planner" />

# 旅程攻略 · Trip Planner

地图驱动的旅行规划工具。用一句话描述行程，AI 给候选，你在地图上拖拽安排行程；另有独立的骑行路书模块。

**纯前端** — 无后端，LLM 与高德接口均在浏览器内调用。

[在线演示](https://kaiannn.github.io/trip-planner) · [快速开始](#快速开始) · [部署](#部署)

</div>

---

<p align="center">
  <img src="docs/screenshots/01-main.png" alt="主界面" width="900" />
</p>

## 它能做什么

### 旅行规划（主应用）

1. **AI 推荐** — 用自然语言描述行程（如「杭州 3 天，喜欢安静的地方」），AI 流式返回候选景点
2. **高德打点** — 候选经地理编码落到地图上，进入景点池
3. **按天安排行** — 把景点拖进每日行程；地图自动画路线、算距离
4. **交通分段** — 同一天内每段可单独设驾车 / 步行 / 骑行 / 公交
5. **景点类型** — 景点 / 酒店 / 餐厅，字段各自独立
6. **天气** — 行程卡可查目的地预报（受预报天数限制）
7. **照片** — 可上传压缩后存浏览器 IndexedDB；高德 POI 图片也会自动补链
8. **持久化** — 行程存在 localStorage，刷新不丢
9. **示例数据** — 顶栏「旅程攻略」连点三次，加载杭州演示行程（可一键退出）

AI 只负责起步候选；地点增删改、路线、交通都由你手动控制。

### 骑行路书（独立模块）

顶栏 **「骑行路书」** 打开全屏路书：

- 设置起终点与途经点（高德地点搜索 / 周边 POI）
- 调用高德骑行路径规划，分段累加里程与时间
- 设置**均速**（5–40 km/h）与出发时刻，估算到达时间
- 导出 Markdown 路书

演示站已通过 GitHub Secrets 预填 Web 服务 Key；本地开发请在 `client/.env` 或「设置」中配置。

## 快速开始

### 1. 克隆并安装

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner
npm install --prefix client
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。

根目录脚本会转发到 `client/`：

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器（默认 5173） |
| `npm run build` | 类型检查 + 构建到 `client/dist/` |
| `npm run test` | Vitest 单次跑测 |
| `npm run lint` | ESLint |
| `npm run preview` | 预览构建产物 |

类型检查也可在 `client/` 下单独执行：`npx tsc -b`。

### 2. 配置 Key

本项目需要 **两类高德 Key + 一类 LLM Key**，不要混用。

| 用途 | 变量 / 配置项 | 从哪里来 | 放在哪里 |
|------|---------------|----------|----------|
| 地图 JS SDK | `VITE_AMAP_KEY` | 高德控制台 → 应用管理 → 添加 Key → **Web端（JS API）** | `client/.env`（本地） / GitHub Secrets（Pages） |
| 地图安全密钥 | `VITE_AMAP_SECURITY_CODE` | 同上应用下的「安全密钥」（2021-12 后新建的 JS Key 必配） | 同上 |
| POI / 路径 / 骑行规划 | `VITE_AMAP_WEBSERVICE_KEY` 或设置面板 | 同上 → 添加 Key → **Web服务** | `client/.env` 或应用内「设置」 |
| AI 推荐 | 设置面板「LLM API Key」 | DeepSeek 或 OpenAI 兼容服务 | 仅存浏览器 localStorage，不进仓库 |

复制示例并填入真实值（**不要提交** `.env`，仓库已 gitignore）：

```bash
cp client/.env.example client/.env
```

`client/.env` 示例：

```bash
# 高德「Web端」Key —— 只给地图 SDK 用
VITE_AMAP_KEY=your_js_api_key
# 若控制台为该 Key 开启了安全密钥，一并填写
VITE_AMAP_SECURITY_CODE=your_security_code
# 高德「Web服务」Key —— POI / 路径 / 骑行；与上面不是同一个
VITE_AMAP_WEBSERVICE_KEY=your_webservice_key
```

**两种高德 Key 不能互换**：用 JS Key 打 `restapi.amap.com` 会返回 `USERKEY_PLAT_NOMATCH`；用 Web 服务 Key 加载地图 SDK 也不对。代码统一从 `client/src/lib/amapKey.ts` 读取，Web 服务 Key **不会**回退到 JS Key。

应用内「设置」可运行时填写 LLM Key 与高德 Web 服务 Key（覆盖/补充 env）。若 env 里已有 Web 服务 Key 且设置为空，启动时会自动预填。

### 3. 关于高德控制台「域名绑定」

控制台 UI 会改版，有时找不到单独的「绑定域名」入口，可按下面理解：

- **Web端（JS API）Key**  
  常见是「域名白名单 / Referer 校验」。若控制台提供了该配置，建议同时写上：
  - `kaiannn.github.io`（线上演示）
  - `localhost`（本地开发，一般不写端口）  
  若**没有**域名限制选项，则该 Key 在任意站点都可调用——更要避免泄露。

- **Web服务 Key**  
  常见是 **IP 白名单**，不是域名。本项目在浏览器里直连 `restapi.amap.com`，请求来自**访客本机公网 IP**，不是 GitHub 服务器 IP。  
  因此：前端直连场景下 IP 白名单通常**留空**；若强行绑定固定 IP，本地与演示站都容易被误伤。

- **本地 vs 演示**  
  可以同一套 Key 两边用；更稳妥是开发用一套、演示用另一套。演示站 Key 经 Secrets 注入构建产物，**不会出现在 git 仓库**，但 Vite 会把 `VITE_*` 打进前端 JS，线上仍可被查看——这是纯前端方案的固有特点。

## 部署

### GitHub Pages（推荐）

- 地址：[https://kaiannn.github.io/trip-planner](https://kaiannn.github.io/trip-planner)
- 推送到 `main` 后由 `.github/workflows/pages.yml` 自动构建部署
- 子路径由 `VITE_BASE_PATH=/trip-planner/` 注入

在仓库 **Settings → Secrets and variables → Actions** 配置（**不要**把明文写进代码）：

| Secret | 说明 |
|--------|------|
| `VITE_AMAP_KEY` | 地图 JS Key |
| `VITE_AMAP_SECURITY_CODE` | JS Key 安全密钥 |
| `VITE_AMAP_WEBSERVICE_KEY` | Web 服务 Key（演示站自动预填用） |

工作流里只出现 `${{ secrets.* }}` 引用。LLM Key **不会**打进 Pages 产物，演示访客需在「设置」里自填，或你自己本地演示时填好。

### 静态托管

```bash
npm run build --prefix client
# 上传 client/dist/；若部署在子路径，构建时设置 VITE_BASE_PATH=/你的前缀/
```

### Docker

```bash
# 需要本地已有 VITE_AMAP_KEY（构建参数）
export VITE_AMAP_KEY=your_js_api_key
docker compose up --build
# → http://localhost:8080
```

## 项目结构

```
trip-planner/
├── client/                    # 全部前端代码与依赖
│   ├── src/
│   │   ├── App.tsx            # 根组件：地图布局 + 各弹层
│   │   ├── types.ts           # Spot / DailyPlan / City 等领域类型
│   │   ├── store/             # Zustand（persist 到 localStorage）
│   │   │   ├── slices/        # tripCore / ai / amapPoi / ui / quiz
│   │   │   ├── settingsStore  # API Key（不进主行程持久化）
│   │   │   └── utils.ts       # POI 转换、图片补链等
│   │   ├── lib/               # 纯函数：aiPrompt / amapKey / geo / amapRouting …
│   │   ├── api/               # 浏览器直调 LLM（SSE）与高德 REST
│   │   ├── cycling/           # 骑行路书模块（独立 store + 地图 + 路书）
│   │   ├── components/        # 地图、浮动面板、各 Modal
│   │   └── map/               # AMap 类型与 MapContext
│   └── .env.example
├── .github/workflows/         # CI + Pages 部署
├── docker-compose.yml
├── AGENTS.md                  # 给编码代理的项目说明
└── package.json               # 仅转发脚本到 client/
```

## 技术栈

| 层 | 选型 |
|----|------|
| UI | React 19 + TypeScript 5.9 |
| 构建 | Vite 8（`@tailwindcss/vite`，Tailwind CSS v4） |
| 状态 | Zustand 5 + persist |
| 拖拽 | @dnd-kit |
| 地图 / 路径 / POI | 高德 JS API 2.0 + Web 服务 REST |
| AI | 浏览器直调 OpenAI 兼容接口，SSE 流式 |
| 图片 | 浏览器压缩 → IndexedDB（`idb`） |
| 测试 | Vitest（`client/src/__tests__/`） |

## 数据与隐私

- 行程、设置中的 Key 存在**当前浏览器**（localStorage / IndexedDB）
- 无账号、无自建服务端；刷新或换浏览器不会同步
- 调用 LLM 时，行程上下文会发给你配置的模型服务商
- 调用高德时，地点名称与坐标会发给高德
- 请勿把含真实 Key 的 `.env` 提交到 git

## 开发说明

- **CI 顺序**：lint → `tsc -b` → test → build（见 `.github/workflows/ci.yml`）
- **严格 TypeScript**：`noUnusedLocals` / `noUnusedParameters` / `verbatimModuleSyntax`；类型导入请用 `import type`
- **Zustand persist**：变更持久化字段形状时，记得改 `store/index.ts` 的 `migrate`
- **组件测试**：当前以 `lib/` / 纯逻辑测试为主
- **Issues 与 PR**：[github.com/kaiannn/trip-planner](https://github.com/kaiannn/trip-planner)

## License

未附带开源许可证文件。若需对外开源，请自行补充 `LICENSE` 并更新本节。
