const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parseIsoDate(iso: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
}

/** Format YYYY-MM-DD as M/D. Returns raw string on parse failure. */
export function shortDate(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return iso
  return `${p.mo}/${p.d}`
}

/** Format YYYY-MM-DD as "M/D 周X". Returns raw string on parse failure. */
export function formatDayLabel(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return iso
  const dt = new Date(p.y, p.mo - 1, p.d)
  if (Number.isNaN(dt.getTime())) return iso
  return `${p.mo}/${p.d} ${WEEKDAY_CN[dt.getDay()]}`
}
