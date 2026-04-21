<div align="center">

<img src="client/public/favicon.svg" width="80" height="80" alt="Trip Planner Logo" />

# Trip Planner

**AI 驱动的旅行行程规划工具**

用自然语言描述你的旅行期望，结合高德地图与大语言模型，智能生成城市、景点与每日路线。

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

## ✨ 功能亮点

- 🗺️ **地图可视化** — 基于高德地图 JS API 2.0，城市标记、景点标注、每日路线连线一目了然
- 🤖 **AI 智能推荐** — 接入 DeepSeek / OpenAI 兼容 LLM，根据你的行程上下文生成景点、住宿、注意事项
- 🔍 **高德 POI 搜索** — 关键词搜索 + AI 自然语言解析，从高德数据库精准匹配景点
- 📋 **按天行程管理** — 可视化创建每日计划，拖拽景点顺序，自动计算城际距离
- 🧪 **旅行性格测试** — 8 道趣味问题，生成个性化旅行画像，融入 AI 推荐上下文
- 💾 **本地持久化** — 基于 Zustand Persist，行程数据自动保存，刷新不丢失
- ⚡ **智能同步** — 修改行程后自动防抖更新 AI 推荐，一键触发地图重绘 + 合理性检查 + AI 分析

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  React UI │──│ Zustand  │──│ AMap JS API  │  │
│  │ + Tailwind│  │  Store   │  │   2.0 地图    │  │
│  └─────┬─────┘  └──────────┘  └──────────────┘  │
│        │ fetch                                    │
├────────┼────────────────────────────────────────-─┤
│        ▼                                          │
│  ┌─────────────────┐                              │
│  │  Express Server  │──── /api/ai/*  ──→ LLM API │
│  │   (Node.js)      │──── /api/amap/* ──→ 高德 API│
│  └─────────────────┘                              │
└───────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) **18+**（推荐 LTS 版本）
- [高德开放平台](https://console.amap.com/) Key（需开通 Web 端 + Web 服务）
- LLM API Key（DeepSeek / OpenAI 兼容接口）

### 安装

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner
npm install
cd client && npm install && cd ..
```

### 配置

```bash
# 后端配置
cp .env.example .env

# 前端地图配置
cp client/.env.example client/.env
```

编辑 `.env`：

```env
LLM_API_KEY=sk-your-llm-key
AMAP_KEY=your-amap-web-service-key
```

编辑 `client/.env`：

```env
VITE_AMAP_KEY=your-amap-js-api-key
```

> **💡 也可以不配置 `.env`** — 启动后在浏览器界面右上角 ⚙️ 设置中直接填入 Key，存储在本地浏览器中。

### 开发

```bash
npm run dev
```

| 服务 | 地址 |
|:---|:---|
| 前端界面 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |

### 生产部署

```bash
npm run build
NODE_ENV=production npm start
# → http://localhost:3001（Express 托管前端静态资源 + API）
```

## 🔐 环境变量

### 根目录 `.env`（后端）

| 变量 | 必填 | 默认值 | 说明 |
|:---|:---:|:---|:---|
| `LLM_API_KEY` | * | — | LLM API Key（支持浏览器端填入） |
| `AMAP_KEY` | * | — | 高德 Web 服务 Key（支持浏览器端填入） |
| `LLM_BASE_URL` | | `https://api.deepseek.com/v1` | LLM 接口地址 |
| `LLM_MODEL` | | `deepseek-chat` | 模型名称 |
| `PORT` | | `3001` | 服务端口 |
| `CORS_ORIGINS` | | — | 生产环境允许的域名（逗号分隔） |

### `client/.env`（前端）

| 变量 | 必填 | 说明 |
|:---|:---:|:---|
| `VITE_AMAP_KEY` | 建议 | 高德 Web 端 JS API Key |
| `VITE_AMAP_SECURITY_CODE` | | 高德安全密钥（如启用） |

> \* 标记的变量可通过浏览器端设置面板代替，无需写入 `.env` 文件。

## 📡 API 接口

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| `GET` | `/api/config/status` | 查询服务端 Key 配置状态 |
| `POST` | `/api/ai/recommend` | 基于行程上下文的 AI 结构化推荐 |
| `POST` | `/api/ai/poi-query` | 自然语言 → 高德 POI 搜索参数 |
| `GET` | `/api/amap/poi` | 高德 POI 关键词搜索（代理） |
| `GET` | `/api/amap/poi/detail` | 高德 POI 详情查询（代理） |

## 📁 项目结构

```
trip-planner/
├── server.js                    # Express 后端入口
├── .env.example                 # 后端环境变量模板
├── package.json
├── docs/screenshots/            # README 截图
└── client/                      # 前端 (React + Vite)
    ├── src/
    │   ├── api/                 # API 请求层（AI、高德）
    │   ├── components/          # UI 组件
    │   │   └── modals/          # 弹窗组件
    │   ├── constants/           # 常量（测验题库等）
    │   ├── lib/                 # 纯函数（Prompt 构建、地理计算、画像生成）
    │   ├── map/                 # 地图上下文与类型声明
    │   ├── store/               # Zustand 状态管理
    │   ├── App.tsx              # 应用根组件
    │   └── types.ts             # 全局类型定义
    ├── .env.example             # 前端环境变量模板
    └── vite.config.ts           # Vite 配置（开发代理）
```

## 🧩 技术栈

| 层级 | 技术 |
|:---|:---|
| **前端框架** | React 19 · TypeScript 5.9 |
| **构建工具** | Vite 8 |
| **样式** | Tailwind CSS v4 |
| **状态管理** | Zustand 5（含 Persist 中间件） |
| **地图** | 高德地图 JS API 2.0 |
| **后端** | Node.js · Express |
| **AI** | DeepSeek / OpenAI 兼容接口 |

## 🧠 AI 设计理念

<details>
<summary>点击展开详细设计说明</summary>

### 单一上下文原则

每次调用 AI 推荐时，前端会将完整行程信息（城市、景点、每日计划、用户偏好）一次性写入 Prompt。模型将其视为唯一可信上下文，不会臆造未出现的航班号或时刻信息。

### 一键智能同步

顶栏「智能同步」依次执行：地图重绘 → 合理性检查 → AI 推荐。减少重复按钮，避免同一上下文被割裂请求。

### 被动自动更新

修改行程后防抖约 1.5 秒自动触发 AI 推荐更新，支持 AbortController 取消过时请求，无需手动刷新。

### 结构化输出

AI 返回标准 JSON 格式，包含 `spots`（景点）、`lodging`（住宿）、`other`（建议提示）三类结构化数据。

### POI 查询分流

- `/api/ai/recommend` — 长上下文结构化攻略推荐
- `/api/ai/poi-query` — 自然语言转高德搜索参数

两条 API 职责不同，互不干扰。

</details>

## 📄 License

[MIT](LICENSE)

---

<div align="center">
  <sub>Built with ❤️ using React, Vite, and AI</sub>
</div>
