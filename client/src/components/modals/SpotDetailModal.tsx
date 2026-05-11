import { useEffect, useMemo, useState } from 'react'
import { useTripStore } from '../../store/tripStore'
import { Btn, Field, SpotImg, inputClass } from '../ui'

/**
 * Spot detail + full editor.
 *
 * Opens whenever spotDetailSpot is set in the store. Shows every field
 * as an editable input. Save writes back via updateSpot(). "Re-capture
 * on map" button sets pendingMapCoords and hints the user to right-click
 * the map — same coord-capture flow used by the add-spot form.
 */
export function SpotDetailModal() {
  const spot = useTripStore((s) => s.spotDetailSpot)
  const cities = useTripStore((s) => s.cities)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const removeSpot = useTripStore((s) => s.removeSpot)
  const updateSpot = useTripStore((s) => s.updateSpot)
  const pendingMapCoords = useTripStore((s) => s.pendingMapCoords)
  const setPendingMapCoords = useTripStore((s) => s.setPendingMapCoords)
  const pushLog = useTripStore((s) => s.pushLog)

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.order - b.order),
    [cities],
  )

  // Editable local state — synced from the spot whenever a different
  // spot is opened. Keeps edits out of the global store until Save.
  const [draft, setDraft] = useState(() => spot)
  useEffect(() => {
    setDraft(spot)
  }, [spot?.id])

  if (!spot || !draft) return null

  const setField = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(spot)

  const handleSave = () => {
    if (!draft) return
    // Clean up: treat empty strings as undefined so we don't store "" in Zustand.
    const cleaned = {
      name: draft.name.trim(),
      cityId: draft.cityId,
      location: draft.location,
      description: draft.description?.trim() || undefined,
      visitTimeText: draft.visitTimeText?.trim() || undefined,
      innerTransport: draft.innerTransport?.trim() || undefined,
      guideUrl: draft.guideUrl?.trim() || undefined,
      imageUrl: draft.imageUrl?.trim() || undefined,
      videoUrl: draft.videoUrl?.trim() || undefined,
      xiaohongshuUrls: draft.xiaohongshuUrls?.length ? draft.xiaohongshuUrls : undefined,
    }
    if (!cleaned.name) {
      pushLog('景点名称不能为空。', 'warn')
      return
    }
    updateSpot(spot.id, cleaned)
    pushLog(`已更新景点：${cleaned.name}`)
    setSpotDetail(null)
  }

  const handleApplyPendingCoords = () => {
    if (!pendingMapCoords) return
    setField('location', pendingMapCoords)
    setPendingMapCoords(null)
    pushLog(
      `已替换坐标为 (${pendingMapCoords.lat.toFixed(4)}, ${pendingMapCoords.lng.toFixed(4)})`,
    )
  }

  // Video preview unchanged from the old read-only version.
  let videoPreview: React.ReactNode = null
  if (draft.videoUrl) {
    const url = draft.videoUrl.trim()
    const bvMatch = url.match(/(BV[\w]+)/i)
    const avMatch = url.match(/video\/av(\d+)/i)
    if (/bilibili|b23\.tv/i.test(url) && (bvMatch || avMatch)) {
      videoPreview = (
        <iframe
          title="video"
          className="aspect-video w-full rounded-xl"
          src={
            bvMatch
              ? `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}`
              : `https://player.bilibili.com/player.html?aid=${avMatch![1]}`
          }
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      )
    }
  }

  const xhsJoined = (draft.xiaohongshuUrls ?? []).join('\n')

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setSpotDetail(null)}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              编辑景点
            </h3>
            <p className="truncate text-[11px] text-slate-500">
              {dirty ? '有未保存的修改' : '所有字段均为已保存值'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Btn
              variant="secondary"
              className="!text-xs text-red-700"
              onClick={() => {
                if (!window.confirm(`确认删除景点「${spot.name}」?`)) return
                removeSpot(spot.id)
                setSpotDetail(null)
              }}
            >
              删除
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => {
                if (dirty && !window.confirm('有未保存修改,确认放弃?')) return
                setSpotDetail(null)
              }}
            >
              取消
            </Btn>
            <Btn
              variant="primary"
              onClick={handleSave}
              className={dirty ? '' : 'opacity-50'}
            >
              保存
            </Btn>
          </div>
        </header>

        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <Field label="景点名称 *" className="sm:col-span-2">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </Field>

          <Field label="所属城市">
            <select
              className={inputClass}
              value={draft.cityId}
              onChange={(e) => setField('cityId', e.target.value)}
            >
              {sortedCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="建议游玩时长">
            <input
              className={inputClass}
              placeholder="例:2-3 小时"
              value={draft.visitTimeText ?? ''}
              onChange={(e) => setField('visitTimeText', e.target.value)}
            />
          </Field>

          <Field label="介绍" className="sm:col-span-2">
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="景点简要介绍"
              value={draft.description ?? ''}
              onChange={(e) => setField('description', e.target.value)}
            />
          </Field>

          <Field label="图片链接">
            <input
              className={inputClass}
              placeholder="https://..."
              value={draft.imageUrl ?? ''}
              onChange={(e) => setField('imageUrl', e.target.value)}
            />
          </Field>

          <Field label="攻略链接">
            <input
              className={inputClass}
              placeholder="https://..."
              value={draft.guideUrl ?? ''}
              onChange={(e) => setField('guideUrl', e.target.value)}
            />
          </Field>

          <Field label="视频链接">
            <input
              className={inputClass}
              placeholder="B站 / YouTube"
              value={draft.videoUrl ?? ''}
              onChange={(e) => setField('videoUrl', e.target.value)}
            />
          </Field>

          <Field label="交通方式">
            <input
              className={inputClass}
              placeholder="例:地铁1号线"
              value={draft.innerTransport ?? ''}
              onChange={(e) => setField('innerTransport', e.target.value)}
            />
          </Field>

          <Field label="小红书(一行一条)" className="sm:col-span-2">
            <textarea
              rows={2}
              className={`${inputClass} resize-y`}
              placeholder="每行贴一个链接"
              value={xhsJoined}
              onChange={(e) => {
                const list = e.target.value
                  .split(/[\n,]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                setField(
                  'xiaohongshuUrls',
                  list.length > 0 ? list : undefined,
                )
              }}
            />
          </Field>

          {/* Coords — read-only display + "right-click map to re-capture" helper */}
          <div className="sm:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] text-slate-600">
                  <span className="font-medium text-slate-700">坐标</span>{' '}
                  <span className="font-mono text-slate-500">
                    {draft.location.lat.toFixed(5)}, {draft.location.lng.toFixed(5)}
                  </span>
                </div>
                {pendingMapCoords ? (
                  <Btn
                    variant="primary"
                    className="!py-1 !text-[11px]"
                    onClick={handleApplyPendingCoords}
                  >
                    用右键选中的 ({pendingMapCoords.lat.toFixed(3)},{' '}
                    {pendingMapCoords.lng.toFixed(3)})
                  </Btn>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    地图上右键可重新取点
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Previews */}
        {(draft.imageUrl || videoPreview) && (
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 p-4">
            {draft.imageUrl && (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-400">
                  图片预览
                </h4>
                <SpotImg
                  src={draft.imageUrl}
                  alt={draft.name}
                  aspectClassName="max-h-48"
                  className="rounded-xl"
                />
              </section>
            )}
            {videoPreview && (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-400">
                  视频预览
                </h4>
                {videoPreview}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
