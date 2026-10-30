import { useTripStore } from '../store'
import { Btn } from './ui'

/**
 * Hotel detail helper: recall walkable POIs around the hotel (AMap around),
 * coarse-filter with TaskBrief, multi-select into the pool. No itinerary write.
 */
export function HotelAroundPanel({
  hotelId,
  hotelName,
}: {
  hotelId: string
  hotelName: string
}) {
  const hotelAroundHotelId = useTripStore((s) => s.hotelAroundHotelId)
  const hotelAroundStatus = useTripStore((s) => s.hotelAroundStatus)
  const hotelAroundPois = useTripStore((s) => s.hotelAroundPois)
  const hotelAroundKeepIds = useTripStore((s) => s.hotelAroundKeepIds)
  const hotelAroundSelected = useTripStore((s) => s.hotelAroundSelected)
  const fetchHotelAround = useTripStore((s) => s.fetchHotelAround)
  const toggleHotelAroundSelected = useTripStore((s) => s.toggleHotelAroundSelected)
  const setHotelAroundSelectedAll = useTripStore((s) => s.setHotelAroundSelectedAll)
  const addSelectedHotelAround = useTripStore((s) => s.addSelectedHotelAround)
  const clearHotelAround = useTripStore((s) => s.clearHotelAround)

  const loading = hotelAroundStatus.includes('正在')
  const active = hotelAroundHotelId === hotelId

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-semibold text-slate-700">
            附近可逛
            <span className="ml-1 font-normal text-slate-500">· {hotelName}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            以酒店为中心 2km 召回真实 POI，按任务简报粗筛后可入池
          </div>
        </div>
        <div className="flex gap-1.5">
          <Btn
            variant="secondary"
            className="!py-1 !text-[11px]"
            disabled={loading}
            onClick={() => void fetchHotelAround(hotelId)}
            title="检索酒店附近景点/餐厅/购物，并用简报兴趣粗筛"
          >
            {active && loading ? '检索中…' : '附近可逛'}
          </Btn>
          {active && hotelAroundPois.length > 0 && (
            <Btn
              variant="ghost"
              className="!py-1 !text-[11px]"
              onClick={() => clearHotelAround()}
            >
              清空
            </Btn>
          )}
        </div>
      </div>

      {active && hotelAroundStatus && (
        <p className="mt-1.5 text-[11px] text-slate-500">{hotelAroundStatus}</p>
      )}

      {active && hotelAroundPois.length > 0 && (
        <div className="mt-2 space-y-1">
          {hotelAroundPois.map((p) => {
            const id = p.id || p.name || ''
            const checked = hotelAroundSelected.includes(id)
            const rating = Number(p.biz_ext?.rating || p.rating || 0)
            const isFood = p.type?.includes('050000')
            return (
              <label
                key={id}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200/80 bg-white px-2 py-1.5 text-[12px] hover:border-sky-300"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => toggleHotelAroundSelected(id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">
                    {p.name}
                    {isFood ? ' · 餐' : ' · 逛'}
                  </span>
                  {rating > 0 && (
                    <span className="ml-1 text-[11px] text-amber-600">
                      ★ {rating.toFixed(1)}
                    </span>
                  )}
                  {p.address && (
                    <span className="block truncate text-[11px] text-slate-400">
                      {p.address}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Btn
              variant="primary"
              className="!py-1 !text-[11px]"
              onClick={() => {
                const n = addSelectedHotelAround()
                if (n > 0) clearHotelAround()
              }}
            >
              加入景点池（{hotelAroundSelected.length}）
            </Btn>
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-700"
              onClick={() => setHotelAroundSelectedAll(hotelAroundPois.map((p) => p.id || p.name || ''))}
            >
              全选
            </button>
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-700"
              onClick={() => setHotelAroundSelectedAll([])}
            >
              清空勾选
            </button>
            {!hotelAroundKeepIds && hotelAroundPois.length > 0 && (
              <span className="text-[10px] text-slate-400">未走 LLM 粗筛</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
