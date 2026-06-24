<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="Trip Planner Logo" />

# Trip Planner

**地图为核，AI 起步，你来拍板。**

[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[30 秒跑通](#-快速开始) · [设计思路](#-设计思路) · [功能清单](#-功能) · [部署](#-部署)

</div>

---

<p align="center">
  <img src="docs/screenshots/01-main.png" alt="Trip Planner 主界面" width="900" />
</p>

## 设计思路

核心想法：**地图就是界面**。

AI 负责起点 —— 你说"杭州 4 天，喜欢安静的地方"，它给你一批候选景点，高德自动地理编码打到地图上。然后你看着地图拖拖拽拽，把景点安排到每一天，行程是自己调出来的。

AI 不替你做决定，只是帮你不从零开始。

### 工作流

两步，没有第三步：

```
① Collect（景点池）                              ② Arrange（按天安排）

  "杭州 4 天，和伴侣，                              把池子里的景点
   喜欢安静的地方"                                   拖到任意一天
        │                                                │
        ▼                                                ▼
  ┌─────────────┐                                  ┌─────────────┐
  │  AI 返回     │                                  │  每天一张卡片 │
  │  10-20 个    │                                  │  拖进去就行   │
  │  候选景点    │                                  │              │
  └──────┬──────┘                                  │  地图自动画路线│
         │                                         │  自动算距离    │
         ▼                                         │  自动查天气    │
  高德地理编码                                       └─────────────┘
  → 地图上打点
  → 丢进景点池
```

景点不是 AI 单方面拍板的。你能手动加、改、删，能右键地图任意位置"添加为景点"，能从高德搜关键词。**AI 只是个起点，你才是行程的作者。**

---

## 功能

| 功能 | 说明 |
|---|---|
| **AI 填景点池** | 描述你的行程 → AI 返回候选 → 高德地理编码 → 地图打点。基于完整行程上下文推荐，不只是单条 prompt |
| **每段路线独立交通** | 同一天里 A→B 开车、B→C 步行、C→D 地铁，各自调用对应的高德路线服务，点击路线可切换 |
| **三种景点类型** | 景点 / 酒店 / 餐厅，TypeScript discriminated union，各自字段不同（餐厅有链接，酒店有价格） |
| **景点照片** | 浏览器端 canvas 缩到 1280px、JPEG 0.8，存 IndexedDB，不污染服务端 |
| **天气** | 每天卡片可选显示天气（高德 Weather，实测 ≤4 天预报） |
| **SSE 流式推荐** | AI 推荐边生成边渲染，不用等全部返回 |
| **指数退避重试** | LLM 调用失败自动重试 3 次，带 jitter，区分瞬态/终端错误 |
| **持久化** | Zustand persist 到 localStorage，刷新不丢，有版本迁移 |
| **目的地小测** | 没头绪时点一下，生成旅行画像写进 AI 期望 |
| **Demo 数据** | 内置杭州 3 天示例，点一下就能体验完整流程 |

### 已知限制

- LLM key 缺失时，AI 功能静默失败 —— 但手动操作完整可用
- 天气预报超过 4 天没有数据，远期天气 chip 会安静消失
- AI 偶尔推荐高德定位不到的虚构地名 —— 直接跳过，不挂在城市中心糊弄

---

## 快速开始

### 你需要

- [Node.js](https://nodejs.org/) 18+
- [高德开放平台](https://console.amap.com/) Key（Web 端 JS API + Web 服务，两个）
- LLM API Key（DeepSeek 或任意 OpenAI 兼容接口）

### 跑起来

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner
npm install && cd client && npm install && cd ..

# 配置
cp .env.example .env
cp client/.env.example client/.env
# 填入你的 key（见下方环境变量）

# 启动
npm run dev
```

| 服务 | 地址 |
|---|---|
| 前端 (Vite) | http://localhost:5173 |
| 后端 (Express) | http://localhost:3001 |

> 不想写 `.env` 文件也行 —— 浏览器右上角齿轮里能填同样的 key，存在 localStorage。

---

## 环境变量

<details>
<summary>展开查看全部变量</summary>

**后端 `.env`**

| 变量 | 必填 | 默认 | 说明 |
|---|:---:|---|---|
| `LLM_API_KEY` | * | — | DeepSeek / OpenAI 兼容 key |
| `AMAP_KEY` | * | — | 高德 Web 服务 key |
| `LLM_BASE_URL` | | `https://api.deepseek.com/v1` | LLM endpoint |
| `LLM_MODEL` | | `deepseek-chat` | 模型名 |
| `PORT` | | `3001` | 后端端口 |
| `CORS_ORIGINS` | | — | 生产环境允许的域（逗号分隔） |

**前端 `client/.env`**

| 变量 | 必填 | 说明 |
|---|:---:|---|
| `VITE_AMAP_KEY` | 建议 | 高德 JS API key |
| `VITE_AMAP_SECURITY_CODE` | | 高德安全密钥（如果启用了） |

带 `*` 的可以不写文件，改成在浏览器设置面板里填。

</details>

---

## 部署

### Docker（推荐）

一行跑起来，不需要装 Node.js：

```bash
cp .env.example .env
# 填入 LLM_API_KEY、AMAP_KEY、VITE_AMAP_KEY

docker compose up --build
# → http://localhost:3001
```

### 单服务（Railway / Render）

```bash
npm install && cd client && npm install && npm run build && cd ..
NODE_ENV=production npm start
# → http://localhost:3001
```

环境变量：`LLM_API_KEY`、`AMAP_KEY`、`VITE_AMAP_KEY`（build 时需要）、`CORS_ORIGINS`（你的域名）

### 前后端分离（Vercel + Railway）

| 层 | 平台 | 配置 |
|---|---|---|
| 前端 | Vercel | 项目根 `client/`，build `npm run build`，output `dist`，env `VITE_AMAP_KEY` |
| 后端 | Railway | 项目根 `./`，env `LLM_API_KEY` / `AMAP_KEY` / `CORS_ORIGINS=https://your-app.vercel.app` |

> `.env` 和 `client/.env` 都在 `.gitignore` 里。不要往里面塞真 key，用平台的 env-var UI。

---

## API

后端就这几条，纯代理 + AI 编排：

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/config/status` | key 配置状态 |
| `POST` | `/api/ai/recommend` | 结构化推荐（spots / lodging / other） |
| `POST` | `/api/ai/recommend/stream` | 同上，SSE 流式 |
| `POST` | `/api/ai/seed-pool` | 自然语言 → 候选景点列表 |
| `POST` | `/api/ai/poi-query` | 自然语言 → 高德搜索参数 |
| `GET` | `/api/amap/poi` | 高德 POI 搜索代理 |
| `GET` | `/api/amap/poi/detail` | 高德 POI 详情代理 |

---

## 项目结构

```
trip-planner/
├── server.js                 # Express 启动 + 中间件 + 路由挂载
├── server/
│   ├── routes/               # 5 个路由模块（config / ai-recommend / ai-pool / ai-poi-query / amap）
│   ├── lib/                  # llm-client.js / amap-client.js（共享调用逻辑）
│   └── middleware/            # rate-limit.js
├── client/src/
│   ├── components/            # UI 组件（Header / MapPanel / 各种 Modal）
│   │   └── map/               # 地图 hooks + 子组件（useAmapScript / MapLegend / MapErrorOverlay）
│   ├── store/
│   │   ├── slices/            # 5 个 Zustand slice（ui / tripCore / ai / amapPoi / quiz）
│   │   ├── logStore.ts        # 独立日志 store
│   │   └── index.ts           # compose → useTripStore
│   ├── lib/                   # 纯函数（aiPrompt / geo / amapRouting / imageStorage / spotKind）
│   ├── api/                   # 后端 API 调用层（ai.ts / amap.ts）
│   ├── map/                   # AMap 类型声明 + MapContext
│   └── types.ts               # 全局类型（Spot discriminated union）
└── docs/screenshots/
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript 5.9 |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4（`@theme` token swap） |
| 状态 | Zustand 5 + persist + version migration |
| 拖拽 | @dnd-kit（core + sortable） |
| 图片 | idb（IndexedDB 包装）+ canvas 缩放 |
| 地图 | 高德 JS API 2.0（Driving / Walking / Transfer / Riding / Weather / Geocoder / AutoComplete） |
| 后端 | Node 18 + Express |
| AI | DeepSeek / OpenAI 兼容，SSE 流式 + 指数退避重试 |
| 测试 | Vitest（35 tests） |

---

## License

[MIT](LICENSE)
