---
name: 旅程攻略
description: Map-driven trip planner — sky/white chrome, orange accents, Chinese UI
colors:
  primary: "#0284C7"
  primary-deep: "#0369A1"
  primary-soft: "#E0F2FE"
  page-bg: "#F0F9FF"
  surface: "#FFFFFF"
  text: "#0F172A"
  text-muted: "#64748B"
  border: "#E2E8F0"
  accent: "#EA580C"
  accent-soft: "#FFF7ED"
  success: "#059669"
  danger: "#DC2626"
typography:
  body:
    fontFamily: "Inter, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  ui:
    fontFamily: "Inter, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
  meta:
    fontFamily: "Inter, Noto Sans SC, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
---

# DESIGN.md

## Overview

旅程攻略 is an Operate-mode map desk: the map owns the viewport; floating panels dock to corners. Visual language is flat sky-blue + white chrome (not kraft paper). Orange is a sparse accent for AI / day highlights. Chinese is the product language.

## Colors

| Role | Token | Value |
|------|--------|--------|
| Primary | sky-600 | `#0284C7` |
| Primary hover | sky-700 | `#0369A1` |
| Page background | sky-50 | `#F0F9FF` |
| Surface | white | `#FFFFFF` |
| Text | slate-900 | `#0F172A` |
| Muted text | slate-500/600 | `#64748B` / `#475569` |
| Border | slate-200 | `#E2E8F0` |
| Accent | amber-600 | `#EA580C` |
| Danger | red-600 | `#DC2626` |

Tailwind scales are remapped in `client/src/index.css`: `teal-*` → sky primary, `amber-*` → orange accent, `slate-*` → cool neutrals. Prefer `sky-*` / `white` in new code rather than raw hex.

## Typography

- Family: Inter + Noto Sans SC (no fake serif).
- Body 16px; UI controls 13px; meta/hints **≥11px** (no 9–10px type).
- Hierarchy by weight and tracking (`tracking-tight` on headings), not by family swap.

## Layout

- Map-first: `MapLayout` fills the remaining viewport under a sticky white header.
- Floating panels: white surface, slate border, soft shadow; size/position persist.
- Modals: shared `Modal` shell — `z-[5000]`, `role="dialog"`, Escape, focus trap.
- Toasts: bottom-right stack, `z-[10050]`, aria-live.

## Elevation & Depth

- Soft multi-stop shadows (`shadow-sm` / `shadow-lg`), not hard offset blocks.
- Map overlay chips use white/95 + backdrop blur sparingly.

## Shapes

- Radius: controls `6px`, cards `12px`, dialogs `16px`.
- Borders do most of the separation; avoid decorative colored side borders.

## Components

- **Btn**: primary sky-600, secondary white+border, ghost sky text.
- **Input**: white bg, sky focus ring (`focus-visible` global outline also sky).
- **Panel / Modal**: white surface; cycling route book is full-screen sky-50 shell.
- **Day chips / pool rows**: compact Chinese labels; status not color-only.
- **Markers**: white pills + sky focus ring (`mapMarker.ts`).

## Do's and Don'ts

- **Do** use theme utilities (`bg-white`, `bg-sky-600`, `text-slate-*`).
- **Don't** reintroduce kraft hexes (`#ede3cf`, `#f8f2e4`, `#fdfaf3`, `#f3ecdc`).
- **Do** put destructive actions in Settings → 危险操作; export JSON nearby.
- **Don't** put gesture curriculum only in `title=` tooltips; prefer visible CTAs.
- **Do** push user-visible feedback through `logStore` → ToastHost.
- **Don't** ship UI copy that points at GitHub issues or env-var essays as the primary error path.
