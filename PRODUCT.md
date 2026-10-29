# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

自己和朋友：正在规划一次旅行、或需要整理骑行路书的个人用户。不是商业客群，不追求获客转化。

## Product Purpose

把想去的地点变成能出发的地图行程：命名行程、AI 或手动加点、拖进每天、在地图上看路线。骑行路书模块负责起终点、途经、里程与时间估算。成功标准是「打开就能把一次出行排清楚」。

## Positioning

地图驱动的行程整理器，不是订票平台，也不替用户决定必须去哪。用户选点，工具负责在地图上排清楚。

## Operating Context

- 浏览器内直接调用高德地图与用户自备的 LLM API；无后端
- 首次使用需配置高德 JS/Web 服务 Key 与 LLM Key；Key 存本地
- 行程数据 persist 在浏览器 localStorage；换设备或清数据会丢
- 部署为静态站点（GitHub Pages / Docker 静态托管）
- 中文界面与文案

## Capabilities and Constraints

- 行程规划：命名、日期区间、景点池、按天拖拽、分段交通方式、天气
- AI 推荐：一句话描述 → 候选景点（起点，最终以拖拽为准）
- 骑行路书：起终点/途经、路线规划、均速与出发时刻估算、Markdown 导出
- 纯前端：Vite + React + Tailwind + Zustand + 高德 JS API
- 用户明确要求后续改版必须保留：**地图为中心的工作流**（拖景点进日程、路线画在地图上）
- Demo 行程：连点顶栏标题可加载杭州示例

## Brand Commitments

- 产品名：旅程攻略
- 当前实现有天蓝 + 探险橙的旅行风配色（`client/src/index.css`），尚未被用户定为不可变品牌资产

## Evidence on Hand

- README：`README.md`（用户画像、用法、Key 配置说明）
- 截图：`docs/screenshots/01-main.png`
- 代码：`client/src/`（地图布局、时间线、景点池、路书、设置弹窗）

## Product Principles

1. 地图是主画布，列表与面板服务于地图上的行程结构
2. AI 只提供候选，最终排期由用户拖拽决定
3. 无后端、无账号：本机可用即成功
4. 行程与路书两条工作流并列清晰，不互相吞没
5. 给自己和朋友用：顺手优先于营销感

## Accessibility & Inclusion

未建立专项无障碍要求；改版时维持基础对比度与可操作性即可。
