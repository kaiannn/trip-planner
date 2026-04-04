import { useEffect, useMemo, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { Btn, Field } from '../ui'

export function SpotPoolModal() {
  const open = useTripStore((s) => s.spotPoolOpen)
  const setSpotPoolOpen = useTripStore((s) => s.setSpotPoolOpen)
  const cities = useTripStore((s) => s.cities)
  const spots = useTripStore((s) => s.spots)
  const poolCityFilter = useTripStore((s) => s.poolCityFilter)
  const setPoolCityFilter = useTripStore((s) => s.setPoolCityFilter)
  const amapCityName = useTripStore((s) => s.amapCityName)
  const setAmapCityName = useTripStore((s) => s.setAmapCityName)
  const amapKeywords = useTripStore((s) => s.amapKeywords)
  const setAmapKeywords = useTripStore((s) => s.setAmapKeywords)
  const amapNatural = useTripStore((s) => s.amapNatural)
  const setAmapNatural = useTripStore((s) => s.setAmapNatural)
  const pendingMapCoords = useTripStore((s) => s.pendingMapCoords)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const addSpot = useTripStore((s) => s.addSpot)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const fetchAmapPoi = useTripStore((s) => s.fetchAmapPoi)
  const fetchAmapPoiByAI = useTripStore((s) => s.fetchAmapPoiByAI)

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )

  const [spotCityId, setSpotCityId] = useState('')
  const [spotName, setSpotName] = useState('')
  const [spotLat, setSpotLat] = useState('')
  const [spotLng, setSpotLng] = useState('')
  const [guideUrl, setGuideUrl] = useState('')
  const [timeText, setTimeText] = useState('')
  const [transport, setTransport] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [xhs, setXhs] = useState('')

  useEffect(() => {
    if (open && sortedCities.length && !amapCityName) {
      setAmapCityName(sortedCities[0].name)
    }
  }, [open, sortedCities, amapCityName, setAmapCityName])

  useEffect(() => {
    if (pendingMapCoords && open) {
      setSpotLat(pendingMapCoords.lat.toFixed(6))
      setSpotLng(pendingMapCoords.lng.toFixed(6))
    }
  }, [pendingMapCoords, open])

  useEffect(() => {
    if (sortedCities.length && !spotCityId) setSpotCityId(sortedCities[0].id)
  }, [sortedCities, spotCityId])

  const filtered = useMemo(() => {
    if (!poolCityFilter) return spots
    return spots.filter((s) => s.cityId === poolCityFilter)
  }, [spots, poolCityFilter])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setSpotPoolOpen(false)}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-800">景点池</h2>
          <Btn variant="secondary" onClick={() => setSpotPoolOpen(false)}>
            × 关闭
          </Btn>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <details className="mb-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <summary className="cursor-pointer font-medium text-slate-800">添加景点</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="所属城市">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={spotCityId}
                  onChange={(e) => setSpotCityId(e.target.value)}
                >
                  {sortedCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="景点名称">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                />
              </Field>
              <Field label="纬度">
                <input
                  type="number"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={spotLat}
                  onChange={(e) => setSpotLat(e.target.value)}
                />
              </Field>
              <Field label="经度">
                <input
                  type="number"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={spotLng}
                  onChange={(e) => setSpotLng(e.target.value)}
                />
              </Field>
              <Field label="图片链接">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </Field>
              <Field label="攻略链接">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={guideUrl}
                  onChange={(e) => setGuideUrl(e.target.value)}
                />
              </Field>
              <Field label="介绍" className="sm:col-span-2">
                <textarea
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label="视频链接">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </Field>
              <Field label="小红书（逗号分隔）">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={xhs}
                  onChange={(e) => setXhs(e.target.value)}
                />
              </Field>
              <Field label="访问时间">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                />
              </Field>
              <Field label="交通">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                />
              </Field>
            </div>
            <Btn
              variant="secondary"
              className="mt-3"
              onClick={() => {
                const lat = parseFloat(spotLat)
                const lng = parseFloat(spotLng)
                if (!spotCityId || !spotName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) return
                const xhsUrls = xhs.trim()
                  ? xhs.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
                  : undefined
                const ok = addSpot({
                  cityId: spotCityId,
                  name: spotName.trim(),
                  location: { lat, lng },
                  guideUrl: guideUrl.trim() || undefined,
                  visitTimeText: timeText.trim() || undefined,
                  innerTransport: transport.trim() || undefined,
                  imageUrl: imageUrl.trim() || undefined,
                  description: description.trim() || undefined,
                  videoUrl: videoUrl.trim() || undefined,
                  xiaohongshuUrls: xhsUrls,
                })
                if (ok) {
                  setSpotName('')
                  setGuideUrl('')
                  setTimeText('')
                  setTransport('')
                  setImageUrl('')
                  setDescription('')
                  setVideoUrl('')
                  setXhs('')
                  setPendingMapCoords(null)
                }
              }}
            >
              加入景点池
            </Btn>
          </details>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">高德 POI</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1"
              value={amapCityName}
              onChange={(e) => setAmapCityName(e.target.value)}
            >
              <option value="">请选择城市</option>
              {sortedCities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-slate-200 px-2 py-1"
              value={amapKeywords}
              onChange={(e) => setAmapKeywords(e.target.value)}
              placeholder="关键词"
            />
            <Btn variant="secondary" className="!py-1 !text-xs" onClick={() => fetchAmapPoi()}>
              获取推荐
            </Btn>
            <input
              className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1"
              value={amapNatural}
              onChange={(e) => setAmapNatural(e.target.value)}
              placeholder="自然语言描述…"
            />
            <Btn variant="secondary" className="!py-1 !text-xs" onClick={() => fetchAmapPoiByAI()}>
              AI 帮我找
            </Btn>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            需在根目录 .env 配置 AMAP_KEY 与 LLM_API_KEY。
          </p>

          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-slate-600">筛选</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              value={poolCityFilter}
              onChange={(e) => setPoolCityFilter(e.target.value)}
            >
              <option value="">全部城市</option>
              {sortedCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {filtered.map((spot) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => setSpotDetail(spot)}
                className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-left shadow-sm transition hover:shadow-md"
              >
                {spot.imageUrl ? (
                  <img
                    src={spot.imageUrl}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="aspect-[4/3] w-full bg-slate-200" />
                )}
                <div className="p-2 text-center text-xs font-medium text-slate-800">{spot.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
