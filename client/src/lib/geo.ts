export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function isDuplicateSpot(
  spots: { cityId: string; name: string; location: { lat: number; lng: number } }[],
  cityId: string,
  name: string,
  lat: number,
  lng: number,
): boolean {
  const nameLower = (name || '').trim().toLowerCase()
  return spots.some((s) => {
    if (s.cityId !== cityId) return false
    const sNameLower = (s.name || '').trim().toLowerCase()
    const sameName = sNameLower && sNameLower === nameLower
    const hasLoc =
      s.location &&
      typeof s.location.lat === 'number' &&
      typeof s.location.lng === 'number'
    if (!hasLoc) return sameName
    const d = distanceInMeters(
      s.location.lat,
      s.location.lng,
      lat,
      lng,
    )
    return sameName || d < 100
  })
}
