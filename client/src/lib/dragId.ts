export const POOL_DROP_ID = 'pool-drop-zone'

export function encodePoolDragId(spotId: string) {
  return `pool::${spotId}`
}

export function encodeDayDragId(dayId: string, spotId: string) {
  return `day::${dayId}::${spotId}`
}

export function encodeDaySortId(dayId: string) {
  return `day-sort::${dayId}`
}

export function decodeDragId(id: string):
  | { kind: 'pool'; spotId: string }
  | { kind: 'day'; dayId: string; spotId: string }
  | { kind: 'day-sort'; dayId: string }
  | null {
  if (id.startsWith('pool::')) {
    return { kind: 'pool', spotId: id.slice('pool::'.length) }
  }
  if (id.startsWith('day-sort::')) {
    return { kind: 'day-sort', dayId: id.slice('day-sort::'.length) }
  }
  if (id.startsWith('day::')) {
    const rest = id.slice('day::'.length)
    const sep = rest.indexOf('::')
    if (sep < 0) return null
    return {
      kind: 'day',
      dayId: rest.slice(0, sep),
      spotId: rest.slice(sep + 2),
    }
  }
  return null
}

export function decodeDropId(id: string):
  | { kind: 'pool' }
  | { kind: 'day'; dayId: string }
  | { kind: 'day-row'; dayId: string; spotId: string }
  | null {
  if (id === POOL_DROP_ID) return { kind: 'pool' }
  if (id.startsWith('day-drop::')) {
    return { kind: 'day', dayId: id.slice('day-drop::'.length) }
  }
  if (id.startsWith('day::')) {
    const rest = id.slice('day::'.length)
    const sep = rest.indexOf('::')
    if (sep < 0) return null
    return {
      kind: 'day-row',
      dayId: rest.slice(0, sep),
      spotId: rest.slice(sep + 2),
    }
  }
  return null
}
