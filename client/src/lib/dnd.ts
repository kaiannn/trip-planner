/** Shared HTML5 DnD payload for dragging a pool spot into a day. */
export const SPOT_DND_MIME = 'application/x-trip-spot'
/** Reorder a spot already on a day list (organizer panel). */
export const DAY_ITEM_DND_MIME = 'application/x-trip-day-item'

export function setSpotDragData(dt: DataTransfer, spotId: string) {
  dt.setData(SPOT_DND_MIME, spotId)
  dt.setData('text/plain', spotId)
  dt.effectAllowed = 'copy'
}

export function getSpotDragData(dt: DataTransfer): string | null {
  return dt.getData(SPOT_DND_MIME) || dt.getData('text/plain') || null
}

export function isSpotDrag(dt: DataTransfer): boolean {
  const types = Array.from(dt.types ?? [])
  return types.includes(SPOT_DND_MIME) || types.includes('text/plain')
}

export function setDayItemDragData(dt: DataTransfer, spotId: string) {
  dt.setData(DAY_ITEM_DND_MIME, spotId)
  dt.effectAllowed = 'move'
}

export function getDayItemDragData(dt: DataTransfer): string | null {
  return dt.getData(DAY_ITEM_DND_MIME) || null
}

export function isDayItemDrag(dt: DataTransfer): boolean {
  return Array.from(dt.types ?? []).includes(DAY_ITEM_DND_MIME)
}
