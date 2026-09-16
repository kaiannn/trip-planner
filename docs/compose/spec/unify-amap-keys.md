---
feature: unify-amap-keys
status: designed
updated: 2026-09-16
branch: fix/unify-amap-keys
commits: 
---

# Unify AMap Key Access

## Report

## [S1] Problem

地图 JS Key（`VITE_AMAP_KEY`）与 Web 服务 Key（设置 `amapWebServiceKey`）分散读取；用户误以为本地默认 Key 可打 `restapi`，实际会 `USERKEY_PLAT_NOMATCH`，POI 图片永远空。

## [S2] Design

- 唯一入口 `lib/amapKey.ts`：`getAmapJsKey` / `getAmapWebServiceKey` / `requireAmapWebServiceKey` / `seedWebServiceKeyFromEnv`
- Web 服务优先级：设置 > `VITE_AMAP_WEBSERVICE_KEY`；**绝不**回退到 JS Key
- `api/amap.ts`、`cycling/amapCycling.ts`、`useAmapScript` 全部走该模块
- 设置文案标明两种 Key 不同

## [S3] Out of Scope

图片补链（#41/#43）

## Tasks

- [x] T1: amapKey 模块 + 全站替换 (covers: S2)
- [x] T2: env.example / 设置说明 (covers: S2)
- [x] T3: 测试与 tsc/lint/build (covers: S2)
