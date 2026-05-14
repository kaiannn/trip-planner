<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="Trip Planner Logo" />

# Trip Planner

A map-first, AI-assisted trip planner. Built because every existing one is either a chatbot pretending to be a planner, or a spreadsheet pretending to be an itinerary.

[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

<br/>

<p align="center">
  <img src="docs/screenshots/01-main.png" alt="Trip Planner 主界面" width="900" />
</p>

> **English:** Describe your trip in natural language → AI seeds a pool of candidate spots → drag them onto days. The AMap (Gaode) JS SDK handles geocoding, routing, and weather. A DeepSeek/OpenAI-compatible LLM handles recommendations. React 19 + Vite + Express. Skip to [Quickstart](#快速开始).

## 思路

工作流分两步:

1. **Collect (景点池)** — 你描述这趟行程("杭州 4 天,和伴侣,喜欢安静的地方"),AI 返回一批候选景点,逐个用高德地理编码,丢进右侧"景点池"。地图上同时打点。
2. **Arrange (按天安排)** — 把池里的景点拖到任意一天。每天卡片显示数量、距离合理性提示、可选天气。地图按"被聚焦的那一天"高亮路线。

景点不是 AI 单方面拍板的:你能手动加 / 改 / 删,可以右键地图任意位置"添加为景点",可以从高德 POI 搜索关键词。AI 只是个起点。

为什么这样: 大部分 AI 旅游产品要么把对话当核心(让你和聊天框反复磨,但你看不见地图),要么把表单当核心(填一堆框,然后弹出一个静态页)。这个项目把地图当核心,AI 当起点,行程是手工调整出来的。

## 它能做什么

- **AI 填景点池** + 自动跑一遍推荐(基于完整行程上下文,不只是单条 prompt)
- **每段路线独立交通方式** — 同一天里 A→B 开车、B→C 步行、C→D 地铁,各自调用对应的高德服务
- **每个景点支持照片** — 浏览器端 canvas 缩到 1280px、JPEG 0.8、存 IndexedDB,不污染服务端
- **三种 spot 类型**(`sight` / `hotel` / `restaurant`) — TypeScript discriminated union,各自字段不同(餐厅有链接,酒店有价格,景点有视频/小红书 URL)
- **持久化** — Zustand persist 到 localStorage,刷新不丢
- **天气** — AMap.Weather,每天卡片可选(实测 ≤4 天预报)
- **目的地小测** — 没头绪时点一下,生成旅行画像写进 AI 期望

## 已知 caveats

- LLM key 缺失时,AI 功能全部静默失败 — 但手动操作完整可用
- AMap.Weather 超过 4 天就没有预报数据,所以远期行程的天气 chip 会安静地不显示
- AI 推荐的景点偶尔会返回高德定位不到的虚构地名 — 现在的策略是直接跳过这条候选,不挂在城市中心糊弄

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- [高德开放平台](https://console.amap.com/) Key — 需要 Web 端 (JS API) 和 Web 服务两个
- LLM API Key — DeepSeek 或任意 OpenAI 兼容接口

### 安装

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner
npm install
cd client && npm install && cd ..
```

### 配置

两个 `.env` 文件,前后端各一个:

```bash
cp .env.example .env
cp client/.env.example client/.env
```

填 `.env`:

```env
LLM_API_KEY=sk-your-llm-key
AMAP_KEY=your-amap-web-service-key
```

填 `client/.env`:

```env
VITE_AMAP_KEY=your-amap-js-api-key
```

不想写文件也行 — 浏览器界面右上角齿轮里能填同样的 key,存在 localStorage。

### 跑起来

```bash
npm run dev
```

| 服务 | 地址 |
|:---|:---|
| 前端 (Vite) | http://localhost:5173 |
| 后端 (Express) | http://localhost:3001 |

### 部署

构建一份静态产物,Express 同时托管 SPA 和 API:

```bash
npm run build
NODE_ENV=production npm start
# → http://localhost:3001
```

详细的两种部署形态(单服务 / 前后端分离)见下方 [部署](#部署)。

## 环境变量

`.env` (后端):

| 变量 | 必填 | 默认 | 说明 |
|:---|:---:|:---|:---|
| `LLM_API_KEY` | * | — | DeepSeek / OpenAI 兼容 key |
| `AMAP_KEY` | * | — | 高德 Web 服务 key |
| `LLM_BASE_URL` | | `https://api.deepseek.com/v1` | LLM endpoint |
| `LLM_MODEL` | | `deepseek-chat` | 模型名 |
| `PORT` | | `3001` | 后端端口 |
| `CORS_ORIGINS` | | — | 生产环境允许的域(逗号分隔) |

`client/.env` (前端):

| 变量 | 必填 | 说明 |
|:---|:---:|:---|
| `VITE_AMAP_KEY` | 建议 | 高德 JS API key |
| `VITE_AMAP_SECURITY_CODE` | | 如果你启用了高德安全密钥 |

带 `*` 的可以不写文件,改成在浏览器设置面板里填。

## API

后端就这几条,纯代理 + AI 编排:

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `GET` | `/api/config/status` | 后端 key 配置状态 |
| `POST` | `/api/ai/recommend` | 长上下文结构化推荐(spots / lodging / other) |
| `POST` | `/api/ai/recommend/stream` | 同上但 SSE 流式输出 |
| `POST` | `/api/ai/seed-pool` | 自然语言 → 候选景点列表 |
| `POST` | `/api/ai/poi-query` | 自然语言 → 高德搜索参数 |
| `GET` | `/api/amap/poi` | 高德 POI 关键词搜索代理 |
| `GET` | `/api/amap/poi/detail` | 高德 POI 详情代理 |

## 项目结构

```
trip-planner/
├── server.js              # Express 后端,纯代理 + AI 编排
├── client/
│   └── src/
│       ├── components/    # UI (面板、卡片、模态框)
│       ├── store/         # Zustand store + persist
│       ├── lib/           # 纯函数:prompt 构建、地理计算、图片缩放、IndexedDB、AMap 路由封装
│       ├── api/           # 后端 API 调用层
│       ├── map/           # AMap 类型声明 + Provider
│       └── types.ts       # 全局类型(Spot 联合类型在这里)
└── docs/screenshots/
```

## 技术栈

| 层 | 技术 |
|:---|:---|
| 前端 | React 19 + TypeScript 5.9 |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4 (`@theme` token swap) |
| 状态 | Zustand 5 + persist + version migration |
| 拖拽 | @dnd-kit (core + sortable) |
| 二进制 | idb (IndexedDB 包装) |
| 地图 | 高德 JS API 2.0 (Driving / Walking / Transfer / Riding / Weather / Geocoder / AutoComplete) |
| 后端 | Node 18 + Express |
| AI | DeepSeek / OpenAI 兼容,SSE 流式 + 退避重试 |

## 部署

### 单服务 (Railway / Render)

Express 在 `NODE_ENV=production` 时直接托管 `client/dist/`:

- **Build:** `npm install && cd client && npm install && npm run build && cd ..`
- **Start:** `NODE_ENV=production npm start`
- **Env:** `LLM_API_KEY`, `AMAP_KEY`, `VITE_AMAP_KEY` (build 时需要), `CORS_ORIGINS` (你的域名)

### 前后端分离 (Vercel + Railway)

- 前端在 Vercel: 项目根设为 `client/`,build `npm run build`,output `dist`,env 写 `VITE_AMAP_KEY`
- 后端在 Railway: 跑 root 的 Express,env 写 `LLM_API_KEY` / `AMAP_KEY` / `CORS_ORIGINS=https://your-app.vercel.app`

### 不要 commit

`.env` 和 `client/.env` 都在 `.gitignore` 里,不要往里面塞真 key。用平台的 env-var UI。

## License

[MIT](LICENSE)
