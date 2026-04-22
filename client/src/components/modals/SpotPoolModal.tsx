import { useMemo, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { Btn, Field, SpotImg } from '../ui'

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

  const [appliedCoordsKey, setAppliedCoordsKey] = useState<object | null>(null)

  if (open && sortedCities.length && !amapCityName) {
    setAmapCityName(sortedCities[0].name)
  }

  const coordsObj = pendingMapCoords
  if (coordsObj && open && coordsObj !== appliedCoordsKey) {
    setAppliedCoordsKey(coordsObj)
    setSpotLat(coordsObj.lat.toFixed(6))
    setSpotLng(coordsObj.lng.toFixed(6))
  }

  if (sortedCities.length && !spotCityId) {
    setSpotCityId(sortedCities[0].id)
  }

  const filtered = useMemo(() => {
    if (!poolCityFilter) return spots
    return spots.filter((s) => s.cityId === poolCityFilter)
  }, [spots, poolCityFilter])

  const hasCoords = spotLat !== '' && spotLng !== ''
  const inputCls = 'rounded-lg border border-slate-200 px-3 py-1.5 text-sm'

  const resetForm = () => {
    setSpotName('')
    setSpotLat('')
    setSpotLng('')
    setGuideUrl('')
    setTimeText('')
    setTransport('')
    setImageUrl('')
    setDescription('')
    setVideoUrl('')
    setXhs('')
    setPendingMapCoords(null)
  }

  const handleAdd = () => {
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
    if (ok) resetForm()
  }

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
          {/* ── 手动添加景点 ── */}
          <details className="mb-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <summary className="cursor-pointer font-medium text-slate-800">手动添加景点</summary>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="所属城市">
                <select
                  className={inputCls}
                  value={spotCityId}
                  onChange={(e) => setSpotCityId(e.target.value)}
                >
                  {sortedCities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="景点名称 *">
                <input
                  className={inputCls}
                  placeholder="例：西湖"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 self-end pb-0.5">
                {hasCoords ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                    坐标已获取
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path fillRule="evenodd" d="m7.539 14.841.003.003.002.002a.755.755 0 0 0 .912 0l.002-.002.003-.003.012-.009a5.57 5.57 0 0 0 .19-.153 15.588 15.588 0 0 0 2.046-2.082c1.101-1.362 2.291-3.342 2.291-5.597A5 5 0 0 0 3 7c0 2.255 1.19 4.235 2.291 5.597a15.591 15.591 0 0 0 2.236 2.235l.012.01ZM8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                    </svg>
                    请在地图上点击取坐标
                  </span>
                )}
              </div>
            </div>

            <details className="mt-3 rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">
                更多信息（选填）
              </summary>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <Field label="介绍" className="sm:col-span-2">
                  <textarea
                    rows={2}
                    className={inputCls}
                    placeholder="景点简要介绍"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <Field label="图片链接">
                  <input className={inputCls} placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </Field>
                <Field label="攻略链接">
                  <input className={inputCls} placeholder="https://..." value={guideUrl} onChange={(e) => setGuideUrl(e.target.value)} />
                </Field>
                <Field label="视频链接">
                  <input className={inputCls} placeholder="B站/YouTube 链接" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                </Field>
                <Field label="小红书（逗号分隔）">
                  <input className={inputCls} placeholder="多个链接用逗号隔开" value={xhs} onChange={(e) => setXhs(e.target.value)} />
                </Field>
                <Field label="建议游玩时长">
                  <input className={inputCls} placeholder="例：2-3小时" value={timeText} onChange={(e) => setTimeText(e.target.value)} />
                </Field>
                <Field label="交通方式">
                  <input className={inputCls} placeholder="例：地铁1号线西湖站" value={transport} onChange={(e) => setTransport(e.target.value)} />
                </Field>
              </div>
            </details>

            <div className="mt-3 flex items-center gap-2">
              <Btn
                variant="primary"
                onClick={handleAdd}
                className={!spotName.trim() || !hasCoords ? 'opacity-50' : ''}
              >
                加入景点池
              </Btn>
              {!spotName.trim() && (
                <span className="text-[11px] text-slate-400">请填写景点名称并在地图上点选坐标</span>
              )}
            </div>
          </details>

          {/* ── 高德 POI 搜索 ── */}
          <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <h3 className="mb-2 text-sm font-medium text-slate-700">高德 POI 搜索</h3>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <Field label="城市">
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1"
                  value={amapCityName}
                  onChange={(e) => setAmapCityName(e.target.value)}
                >
                  <option value="">请选择城市</option>
                  {sortedCities.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="关键词">
                <input
                  className="rounded-lg border border-slate-200 px-2 py-1"
                  value={amapKeywords}
                  onChange={(e) => setAmapKeywords(e.target.value)}
                  placeholder="景点"
                />
              </Field>
              <Btn variant="secondary" className="!py-1.5 !text-xs" onClick={() => fetchAmapPoi()}>
                搜索
              </Btn>
              <div className="mx-1 h-5 w-px bg-slate-200" />
              <Field label="自然语言描述">
                <input
                  className="min-w-[180px] rounded-lg border border-slate-200 px-2 py-1"
                  value={amapNatural}
                  onChange={(e) => setAmapNatural(e.target.value)}
                  placeholder="例：适合亲子的安静公园"
                />
              </Field>
              <Btn variant="secondary" className="!py-1.5 !text-xs" onClick={() => fetchAmapPoiByAI()}>
                AI 帮我找
              </Btn>
            </div>
          </div>

          {/* ── 景点列表 ── */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-slate-600">筛选</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              value={poolCityFilter}
              onChange={(e) => setPoolCityFilter(e.target.value)}
            >
              <option value="">全部城市</option>
              {sortedCities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400">{filtered.length} 个景点</span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {filtered.map((spot) => (
              <button
                key={spot.id}
                type="button"
                onClick={() => setSpotDetail(spot)}
                className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-left shadow-sm transition hover:shadow-md"
              >
                <SpotImg src={spot.imageUrl} alt={spot.name} />
                <div className="p-2 text-center text-xs font-medium text-slate-800">{spot.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
