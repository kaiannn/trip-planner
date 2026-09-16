---
feature: demo-user-isolation
status: delivered
updated: 2026-09-16
branch: feat/demo-user-isolation
commits: f511ac5..f0986b7
---

# Demo / User Trip Isolation (#42)

## Report

**What was built** — 行程数据增加 `dataSource: empty | demo | user` 并 persist（version 3 migrate：旧数据若含 `demo_*` spot 则标为 demo）。`loadDemoData` 写入 demo；用户改动城市/景点/日程/AI 生成会 `markUserTrip` 升为 user；`clearTrip` 回 empty。AI 面板「加载示例数据」仅 `import.meta.env.DEV` 可见；Header 在 demo 态显示琥珀色「示例数据 / 退出」徽章。示例加载后会按名称尝试补图。

**Verification** — `tsc` / `lint` / `vitest 70` / `build` 全绿

**Journey log**
1. 无双模式，只有同一 persist 里的整包覆盖——必须用 `dataSource` 标记而不是第二套 store。
2. migrate 要识别历史 `demo_*` id，否则老用户仍无徽章。
3. 补图依赖 Web 服务 Key；无 Key 时静默跳过。

## [S1] Problem

示例数据通过标题三连点或 AI 面板按钮整包写入同一 `trip-planner-storage`，与用户行程无隔离、无标识；普通用户容易误加载并当成自己的数据。示例景点也没有图。

## [S2] Design

### 状态

- `TripCoreState.dataSource: 'empty' | 'demo' | 'user'`，persist version 3。
- `loadDemoData` → `demo`；用户改动 → `user`；`clearTrip` → `empty`。
- migrate：有 `demo_*` spot → `demo`；有数据 → `user`；否则 `empty`。

### 入口

- AI 面板示例按钮仅 DEV。
- 标题三连点彩蛋保留。

### UI

- demo 时 Header 徽章 + 退出（`clearTrip`）。

### 示例补图

- `fillDemoPhotosByName`：有 Key 时按名称 `place/text` 补 `imageUrl`/`amapId`。

## [S3] Out of Scope

- 多行程档案 / 云同步 / 完整 onboarding（#30）/ #41 启动回填

## Tasks

- [x] T1: store `dataSource` + migrate + markUserTrip (covers: S2)
- [x] T2: loadDemoData/clearTrip + 示例补图 (covers: S2)
- [x] T3: AI 面板隐藏生产示例按钮 (covers: S2)
- [x] T4: Header 示例徽章 + 退出示例 (covers: S2)
- [x] T5: tsc/lint/test/build 全绿 (covers: S2)
