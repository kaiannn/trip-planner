<div align="center">

<img src="client/public/favicon.svg" width="64" height="64" alt="旅程攻略" />

# 旅程攻略

**把想去的地方，变成一张能出发的地图行程。**

[打开在线版](https://kaiannn.github.io/trip-planner)

</div>

---

<p align="center">
  <img src="docs/screenshots/01-main.png" alt="旅程攻略主界面" width="880" />
</p>

## 这是给谁用的

- **正在计划一次旅行的人**：心里有城市和大致天数，想把景点、住宿、吃饭排进每天，并在地图上看路线
- **喜欢骑行、要整理路书的人**：需要起终点、途经点、里程和预估时间，方便出发前心里有数
- **不想被复杂表格绑住的人**：更习惯「在地图上拖一拖」，而不是在空白文档里列清单

这不是订票平台，也不会替你决定必须去哪。你来选点，它负责在地图上排清楚。

## 怎么使用

### 1. 打开应用

访问 **[在线版](https://kaiannn.github.io/trip-planner)**，或在本地启动（见下文）。

首次使用需要配置 Key（见「开始之前」）。配置一次即可，之后会存在你的浏览器里。

### 2. 规划旅行

1. **命名行程**，设定出发和结束日期  
2. 点 **「AI 推荐」**，用一句话描述需求，例如：  
   「杭州三天，喜欢安静的地方，不想太赶」  
3. AI 返回候选后，地点会出现在**景点池**和地图上  
4. 把景点**拖进某一天**，路线会画在地图上，距离自动计算  
5. 需要时可：手动加点、改类型（景点 / 酒店 / 餐厅）、单独设置某一段的交通方式（驾车 / 步行 / 骑行 / 公交）、查看天气  

行程会自动保存在本机浏览器中，刷新不会丢。

> 想快速感受效果：连点三次顶栏 **「旅程攻略」**，可加载一份杭州示例行程。

### 3. 整理骑行路书

1. 顶栏点 **「骑行路书」**  
2. 设置起点、终点，需要的话添加途经点（可搜索地点或周边补给）  
3. 点 **「规划路线」**，查看分段距离与高德预估时间  
4. 调整 **均速** 和 **出发时刻**，得到更贴自己的时间估算  
5. 需要时 **导出 Markdown**，方便发给同行的人  

## 开始之前：需要哪些配置

本工具在浏览器里直接调用高德地图和你选择的 AI 服务，因此需要你自己准备：

| 配置项 | 用来做什么 | 怎么获取 |
|--------|------------|----------|
| 高德 **Web端（JS API）** Key + 安全密钥 | 显示地图 | [高德开放平台](https://console.amap.com/) → 应用管理 → 添加 Key → 选「Web端」 |
| 高德 **Web服务** Key | 搜地点、算路线、骑行规划 | 同上 → 另添加 Key → 选「Web服务」（**不要**和上面的 Key 混用） |
| **LLM API Key** | AI 推荐候选行程 | DeepSeek 或其他 OpenAI 兼容服务 |

在线版已预填地图与 Web 服务 Key；若 AI 推荐不可用，请在右上角 **设置** 中填入自己的 LLM Key。  
本地开发时，把高德 Key 写入 `client/.env`（可复制 `client/.env.example`），LLM Key 同样在设置面板填写。

Key 只存在你的浏览器本地，不会上传到本项目的服务器（项目没有后端）。

## 在本地运行

```bash
git clone https://github.com/kaiannn/trip-planner.git
cd trip-planner
cp client/.env.example client/.env
# 编辑 client/.env，填入高德 Key
npm install --prefix client
npm run dev
```

浏览器打开提示的地址（默认 [http://localhost:5173](http://localhost:5173)），在设置里补全 LLM Key 即可。

构建产物在 `client/dist/`，可部署到任意静态站点；推送到 `main` 会自动更新 GitHub Pages。

## 说明与限制

- 数据保存在**当前设备的浏览器**里，换电脑或清理浏览器数据会丢失  
- AI 推荐只是起点，最终行程由你拖拽决定  
- 天气等能力受第三方接口条件限制  
- 问题与需求请提 [Issue](https://github.com/kaiannn/trip-planner/issues)  

开发说明见仓库内 [AGENTS.md](AGENTS.md)。
