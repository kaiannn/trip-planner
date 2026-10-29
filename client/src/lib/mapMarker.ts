/** Shared HTML/CSS for AMap spot & city markers — white pills + sky accent. */

const STYLE_ID = 'tp-amap-marker-styles'

const CSS = `
.tp-mk, .tp-city {
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
  line-height: 1;
}
.tp-mk-label {
  margin-bottom: 4px;
  max-width: 148px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.55);
  color: #0f172a;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-mk-label[hidden] { display: none; }
.tp-mk-pin {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  box-sizing: border-box;
}
.tp-mk-stem {
  width: 0;
  height: 0;
  margin-top: -1px;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 6px solid #fff;
  filter: drop-shadow(0 1px 1px rgba(15, 23, 42, 0.2));
}
.tp-mk[data-focused='1'] .tp-mk-pin {
  width: 26px;
  height: 26px;
  font-size: 11px;
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #0284c7, 0 4px 12px rgba(2, 132, 199, 0.35);
}
.tp-mk[data-ghost='1'] .tp-mk-pin {
  opacity: 0.65;
  border-style: dashed;
}
.tp-mk[data-pool='1'] .tp-mk-pin {
  width: 16px;
  height: 16px;
  font-size: 8px;
  opacity: 0.88;
}
.tp-mk[data-pool='1'] .tp-mk-stem {
  border-left-width: 3px;
  border-right-width: 3px;
  border-top-width: 5px;
}
.tp-city-chip {
  margin-bottom: 4px;
  padding: 3px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(100, 116, 139, 0.35);
  color: #1e293b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.1);
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tp-city-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #334155;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.28);
}
.tp-label-text {
  background: #ffffff;
  border-radius: 6px;
  padding: 2px 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.35;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  white-space: nowrap;
  border: 1px solid rgba(148, 163, 184, 0.45);
}
`

export function injectMapMarkerStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

/** Clip long spot names so pills stay uniform. */
export function truncateMapLabel(name: string, max = 10): string {
  const s = name.trim()
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

export type SpotPinState = {
  fill: string
  /** Glyph inside the pin: day/order number, 宿/食, or · */
  glyph: string
  label: string | null
  focused?: boolean
  ghost?: boolean
  pool?: boolean
}

export function spotMarkerHtml(state: SpotPinState): string {
  const labelHtml = state.label
    ? `<div class="tp-mk-label">${escapeHtml(state.label)}</div>`
    : '<div class="tp-mk-label" hidden></div>'
  return (
    `<div class="tp-mk" data-focused="${state.focused ? 1 : 0}" data-ghost="${state.ghost ? 1 : 0}" data-pool="${state.pool ? 1 : 0}">` +
    labelHtml +
    `<div class="tp-mk-pin" style="background:${state.fill}">${escapeHtml(state.glyph)}</div>` +
    '<div class="tp-mk-stem"></div>' +
    '</div>'
  )
}

export function cityMarkerHtml(name: string): string {
  return (
    '<div class="tp-city">' +
    `<div class="tp-city-chip">${escapeHtml(name)}</div>` +
    '<div class="tp-city-dot"></div>' +
    '</div>'
  )
}

/** White chip style for AMap.Text (route distance labels). */
export function routeLabelTextStyle(borderColor: string): Record<string, string> {
  return {
    'background-color': '#ffffff',
    'border-radius': '6px',
    padding: '2px 8px',
    'font-size': '10px',
    'font-weight': '600',
    border: `1px solid ${borderColor}`,
    color: borderColor,
    'box-shadow': '0 1px 3px rgba(15,23,42,0.08)',
    'white-space': 'nowrap',
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
