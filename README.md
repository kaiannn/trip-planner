<div align="center">

# 行程规划助手 · Trip Planner

**用自然语言描述旅行期望，结合高德地图 POI 与 LLM，整理城市、景点与路线。**

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

</div>

---

## ✨ 功能概览

| | |
| :--- | :--- |
| **行程草稿** | 填写标题、日期、旅行期望，一键 **AI 生成攻略草稿** |
| **城市与景点** | 添加城市、从景点池选点，支持地图与路线规划 |
| **高德数据** | 后端代理 [高德开放平台](https://lbs.amap.com/) POI 搜索与详情（需 Key） |
| **AI 能力** | 兼容 OpenAI 格式的 LLM（默认 DeepSeek），用于攻略结构化与自然语言 → 搜索参数 |

前端为静态页面 + 原生 JS，由 **Express** 同时托管并与 `/api` **同源**，本地只需一条启动命令。

---

## 🖼 预览

> 启动后浏览器打开 `http://localhost:3001` 即可使用完整界面。

（可将应用截图放在此处，替换本段说明。）

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) **18+**（推荐当前 LTS）

### 安装与运行

```bash
git clone https://github.com/<你的用户名>/trip-planner.git
cd trip-planner
npm install
cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY 与 AMAP_KEY（见下表）
npm start
```

浏览器访问：**http://localhost:3001**

---

## 🔐 环境变量

在项目根目录创建 `.env`（可参考 `.env.example`）：

| 变量 | 必填 | 说明 |
| :--- | :---: | :--- |
| `LLM_API_KEY` | **建议** | 大模型 API Key（OpenAI 兼容接口，如 DeepSeek、豆包等） |
| `AMAP_KEY` | **建议** | [高德开放平台](https://console.amap.com/) Key，需开通 **「Web 服务」** |
| `LLM_BASE_URL` | 否 | 默认 `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 否 | 默认 `deepseek-chat` |
| `PORT` | 否 | 服务端口，默认 `3001` |

未配置 `LLM_API_KEY` 时，AI 相关接口会返回提示；未配置 `AMAP_KEY` 时，高德 POI 相关功能不可用。

---

## 🧩 技术栈

- **运行时**：Node.js · ES Modules  
- **后端**：Express · CORS · dotenv · node-fetch  
- **前端**：原生 HTML / CSS / JS（`index.html`、`styles.css`、`src/app.js`）

---

## 📡 后端 API 摘要

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/ai/recommend` | 根据用户 `prompt` 返回结构化攻略 `sections`（JSON） |
| `POST` | `/api/ai/poi-query` | 自然语言 → 高德 POI 搜索参数（`keywords` / `types` / `quality`） |
| `GET` | `/api/amap/poi` | 高德关键词搜索（代理，需 `AMAP_KEY`） |
| `GET` | `/api/amap/poi/detail` | 高德 POI 详情（代理，需 `AMAP_KEY`） |

静态资源由同一进程托管，无需单独配置前端构建。

---

## 📁 目录结构

```
trip-planner/
├── server.js          # Express 入口与 API
├── index.html         # 页面入口
├── styles.css         # 样式
├── src/app.js         # 前端逻辑
├── package.json
├── .env.example       # 环境变量模板（勿提交真实密钥）
└── README.md
```

---

## 📄 许可证

MIT © 你或你的组织（可按需修改）

---

<div align="center">

**如果这个项目对你有帮助，欢迎 Star ⭐**

</div>
