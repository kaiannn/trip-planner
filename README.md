<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="Trip Planner Logo" />

# Trip Planner

用地图做旅行规划。描述行程，AI 给候选，你拖拽安排。

[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-35-2EA44F?style=flat-square)](#技术栈)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[在线体验](https://kaiannn.github.io/trip-planner) · [本地开发](#快速开始) · [部署](#部署)

</div>

---

<p align="center">
  <img src="docs/screenshots/01-main.png" alt="Trip Planner 主界面" width="900" />
</p>

## 这是什么

一个地图驱动的旅行规划工具。流程：

1. 你用自然语言描述行程（比如"杭州 4 天，喜欢安静的地方"）
2. AI 返回一批候选景点，高德地理编码后打到地图上
3. 你把景点拖到每天的卡片里，地图自动画路线、算距离、查天气

景点可以手动加/改/删，也可以右键地图直接添加，或者用高德搜索。AI 只负责起步，后面都是你来调。

```
① Collect（景点池）                              ② Arrange（按天安排）

  "杭州 4 天，喜欢安静"                              把池子里的景点
        │                                           拖到任意一天
        ▼                                                │
  AI 返回候选                                            ▼
  → 高德地理编码                                   每天一张卡片
  → 地图打点                                       地图画路线
  → 丢进景点池                                     自动算距离
                                                   自动查天气
```

## 功能

- **AI 填景点池** — 描述行程，AI 返回候选，高德地理编码打点
- **每段路线独立交通** — 同一天 A→B 开车、B→C 步行、C→D 地铁，分别调高德
- **三种景点类型** — 景点 / 酒店 / 餐厅，各有不同字段
- **景点照片** — 浏览器端压缩，存 IndexedDB
- **天气** — 每天卡片可选（≤4 天预报）
- **流式推荐** — AI 边生成边渲染
- **持久化** — localStorage，刷新不丢
- **Demo 数据** — 内置杭州 3 天示例

已知问题见 [Issues](https://github.com/kaiannn/trip-planner/issues)。

## 快速开始

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner/client
npm install
npm run dev
```

打开 http://localhost:5173，设置面板会自动弹出，填入：

- **LLM API Key** — DeepSeek 或 OpenAI 兼容
- **高德 Web 服务 Key** — 高德开放平台 → 应用管理 → 添加 Key → 选「Web 服务」

Key 存在浏览器本地，不会上传。

> 地图还需要一个高德 JS API Key。本地开发写到 `client/.env` 的 `VITE_AMAP_KEY`；GitHub Pages 通过 Secrets 注入。

## 部署

纯前端，部署到任何静态托管。

**GitHub Pages**：https://kaiannn.github.io/trip-planner （push to main 自动部署）

**静态托管**（Vercel / Netlify / Cloudflare Pages）：

```bash
cd client && npm install && npm run build
# 上传 client/dist/
```

**Docker**：

```bash
docker compose up --build
# → http://localhost:8080
```

## 项目结构

```
client/src/
├── components/          # UI 组件 + map/ 子目录（hooks、子组件）
├── store/
│   ├── slices/          # Zustand slices（ui / tripCore / ai / amapPoi / quiz）
│   ├── logStore.ts
│   └── index.ts
├── lib/                 # 纯函数（aiPrompt / geo / amapRouting / imageStorage）
├── api/                 # LLM + 高德 API 直调
├── map/                 # AMap 类型声明 + MapContext
└── types.ts
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS v4 |
| 状态 | Zustand + persist |
| 拖拽 | @dnd-kit |
| 地图 | 高德 JS API 2.0 |
| AI | 浏览器直调 LLM，SSE 流式 + 自动重试 |
| 测试 | Vitest |

## License

[MIT](LICENSE)
