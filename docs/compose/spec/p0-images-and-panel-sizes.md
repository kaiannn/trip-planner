---
feature: p0-images-and-panel-sizes
status: delivered
updated: 2026-08-22
branch: feat/map-panels-photos-and-day-branches
commits: 1d94b19..e84a83e
---

# P0: POI 图片 + 浮层默认尺寸

## Report

**What was built** — 高德 POI 图片链路补全：`SpotImg` 使用 `referrerpolicy="no-referrer"`；`convertAmapPois` 写入 `amapId` 与列表图；入池后对无图 POI 限流调用 `place/detail` 回填 `imageUrl`；`pickPoiPhoto` 优先 https。浮层默认尺寸按内容抬高：景点池 ~400、日程 168（展开决策树 ≥280）、整理 ~520；`sizeId` 升 v2 丢弃旧 localStorage 小窗；`minBodyHeight` 抬升时自动撑高面板。最大尺寸仍相对地图容器比例。

**Verification** — `npm test -- --run` PASS (70 tests) · `npx tsc -b` PASS · `npm run lint` PASS · `npm run build` PASS

**Journey log**
1. 子代理评审因沙箱无法访问 trip-planner 路径，改为本机对照 spec 审 diff。
2. 发现 `utils` ↔ `logStore` 循环依赖，已把补图日志挪到调用方。
3. `pickPoiPhoto` 原接受任意 http；改为优先 https 以降低混合内容/防盗链问题。
4. 旧 `sizeId`（无 v2）会锁死用户已保存的小高度，必须升 key 而不是只改 default。
5. `defaultBodyHeight` 实际是整窗高（含标题栏），估算列表时要按整窗算。

## [S1] Problem

1. 高德 POI 入池后，详情/列表图仍是「暂无图片」：列表接口可能无 `photos`，直链可能被防盗链拒绝，且无图 POI 未用 `place/detail` 二次补全。
2. 景点池 / 日程等浮层默认高度偏小，列表被裁，用户必须先拖大才能看清容器内节点与数据。旧 localStorage 尺寸会锁死小窗口。

## [S2] Design

### 图片链路（#34）

- 搜索优先 v5 `place/text?show_fields=photos,business`，失败回退 v3 `extensions=all`。
- `Spot.amapId`：`convertAmapPois` 写入高德 POI id，供详情补图。
- 入池后对「有 amapId、无 imageUrl/imageBlobId」的景点限流调用 `fetchAmapPoiDetail`，把 photo url 写回 `imageUrl`（并发 ≤4，每批最多 12 个）。
- `<img>` 统一 `referrerpolicy="no-referrer"`。
- 无图 POI 仍显示占位。已有本地景点若无 `amapId` 不自动猜测补图。

### 默认尺寸（#39）

- 景点池：默认整窗高约 400，`sizeId` → `spot-pool-v2`。
- 日程：无树约 168；展开决策树时 ≥280–320，`sizeId` → `day-timeline-v2`。
- 整理面板：`sizeId` → `day-organizer-v2`，默认约 520。
- max 仍用相对地图容器比例。
- `FloatingPanel`：`minBodyHeight` 抬升且当前更矮时自动抬高。

### 契约

| 接口 | 行为 |
|------|------|
| `Spot.amapId?: string` | 高德 poi id，可选 |
| `pickPoiPhoto` | 优先 https，否则首个 http(s) |
| `fetchAmapPoiDetail(id)` | v5 detail 优先，v3 回退 |
| `enrichSpotPhotos` | 返回补图条数；日志由调用方写 |
| `usePanelSize` storage | key 含在 `sizeId`；升 v2 即重置默认 |

## [S3] Out of Scope

- P1/P2（#32 手势、#33 统一规范、#30 引导、#29 地图精致化等）
- 图片代理/下载进 IndexedDB 的完整 CDN 方案
- 按名称反向搜索补图
- Commit / push（除非用户明确要求）

## Tasks

- [x] T1: `SpotImg` 加 `referrerpolicy="no-referrer"` (covers: S2)
- [x] T2: `Spot.amapId` + `convertAmapPois` 写入 (covers: S2)
- [x] T3: 入池后异步详情补图（限流）(covers: S2)
- [x] T4: 池/日程/整理默认尺寸与 sizeId 升级 (covers: S2)
- [x] T5: 决策树展开时抬高日程面板 (covers: S2)
- [x] T6: tsc / lint / test / build 全绿 (covers: S2)
