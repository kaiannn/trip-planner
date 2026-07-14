import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '../../store'
import { useSortedCities } from '../../hooks/useTripData'
import { Btn, Field, inputClass } from '../ui'
import { SpotImage } from '../SpotImage'
import { resizeImage } from '../../lib/imageResize'
import { saveImageBlob, deleteImageBlob, getImageBlob } from '../../lib/imageStorage'
import {
  SPOT_KIND_ICON,
  SPOT_KIND_LABEL,
  spotKind,
} from '../../lib/spotKind'
import type { Spot, SpotKind } from '../../types'

/**
 * Spot detail + full editor.
 *
 * Opens whenever spotDetailSpot is set in the store. Renders fields
 * conditionally based on spot.kind: hotels show price, restaurants show
 * link, sights keep all the existing content fields.
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

  const sortedCities = useSortedCities(cities)

  // Editable local state — synced from the spot whenever a different
  // spot is opened. Stored as a "draft Spot" with extra optional fields
  // so we don't have to re-narrow on every change.
  type DraftSpot = Spot & {
    visitTimeText?: string
    innerTransport?: string
    imageUrl?: string
    imageBlobId?: string
    description?: string
    guideUrl?: string
    videoUrl?: string
    xiaohongshuUrls?: string[]
    price?: string
    link?: string
  }
  const [draft, setDraft] = useState<DraftSpot | null>(() =>
    spot ? (spot as DraftSpot) : null,
  )
  // 只在切换不同 spot 时重置草稿，不响应 spot 对象内部属性变化
  useEffect(() => {
    setDraft(spot ? (spot as DraftSpot) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id])

  if (!spot || !draft) return null

  const kind = spotKind(draft)

  const setField = <K extends keyof DraftSpot>(key: K, value: DraftSpot[K]) => {
    setDraft((d) => (d ? ({ ...d, [key]: value } as DraftSpot) : d))
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(spot)

  const handleKindChange = (newKind: SpotKind) => {
    if (newKind === kind) return
    setDraft((d) => {
      if (!d) return d
      // Build a fresh object that only carries fields valid for the new kind.
      // Common fields (name, location, description, image, innerTransport)
      // always survive; kind-specific ones are dropped to keep the type clean.
      const base: DraftSpot = {
        kind: newKind,
        id: d.id,
        cityId: d.cityId,
        name: d.name,
        location: d.location,
        description: d.description,
        innerTransport: d.innerTransport,
        imageUrl: d.imageUrl,
        imageBlobId: d.imageBlobId,
      } as DraftSpot
      if (newKind === 'sight') {
        return {
          ...base,
          visitTimeText: d.visitTimeText,
          guideUrl: d.guideUrl,
          videoUrl: d.videoUrl,
          xiaohongshuUrls: d.xiaohongshuUrls,
        } as DraftSpot
      }
      if (newKind === 'hotel') {
        return { ...base, price: d.price } as DraftSpot
      }
      return { ...base, link: d.link } as DraftSpot
    })
  }

  const handleSave = () => {
    if (!draft) return
    const cleanedCommon = {
      kind,
      name: draft.name.trim(),
      cityId: draft.cityId,
      location: draft.location,
      description: draft.description?.trim() || undefined,
      innerTransport: draft.innerTransport?.trim() || undefined,
      imageUrl: draft.imageUrl?.trim() || undefined,
      imageBlobId: draft.imageBlobId,
    }
    let cleaned: Partial<Spot>
    if (kind === 'sight') {
      cleaned = {
        ...cleanedCommon,
        kind: 'sight',
        visitTimeText: draft.visitTimeText?.trim() || undefined,
        guideUrl: draft.guideUrl?.trim() || undefined,
        videoUrl: draft.videoUrl?.trim() || undefined,
        xiaohongshuUrls: draft.xiaohongshuUrls?.length
          ? draft.xiaohongshuUrls
          : undefined,
      }
    } else if (kind === 'hotel') {
      cleaned = {
        ...cleanedCommon,
        kind: 'hotel',
        price: draft.price?.trim() || undefined,
      }
    } else {
      cleaned = {
        ...cleanedCommon,
        kind: 'restaurant',
        link: draft.link?.trim() || undefined,
      }
    }
    if (!cleaned.name) {
      pushLog('景点名称不能为空。', 'warn')
      return
    }
    updateSpot(spot.id, cleaned)
    pushLog(`已更新${SPOT_KIND_LABEL[kind]}:${cleaned.name}`)
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
  if (kind === 'sight' && draft.videoUrl) {
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
              {SPOT_KIND_ICON[kind]} 编辑{SPOT_KIND_LABEL[kind]}
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
                if (!window.confirm(`确认删除「${spot.name}」?`)) return
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
          <Field label="类型" className="sm:col-span-2">
            <div className="flex gap-1.5">
              {(['sight', 'hotel', 'restaurant'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKindChange(k)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${
                    k === kind
                      ? 'border-teal-400 bg-teal-50 text-teal-800 ring-2 ring-teal-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <span>{SPOT_KIND_ICON[k]}</span>
                  <span>{SPOT_KIND_LABEL[k]}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="名称 *" className="sm:col-span-2">
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

          {kind === 'sight' && (
            <Field label="建议游玩时长">
              <input
                className={inputClass}
                placeholder="例:2-3 小时"
                value={draft.visitTimeText ?? ''}
                onChange={(e) => setField('visitTimeText', e.target.value)}
              />
            </Field>
          )}

          {kind === 'hotel' && (
            <Field label="价格">
              <input
                className={inputClass}
                placeholder="例:¥400/晚"
                value={draft.price ?? ''}
                onChange={(e) => setField('price', e.target.value)}
              />
            </Field>
          )}

          {kind === 'restaurant' && (
            <Field label="链接(预订 / 点评 / 菜单)" className="sm:col-span-2">
              <input
                className={inputClass}
                placeholder="https://..."
                value={draft.link ?? ''}
                onChange={(e) => setField('link', e.target.value)}
              />
            </Field>
          )}

          <Field
            label={kind === 'sight' ? '介绍' : '备注'}
            className="sm:col-span-2"
          >
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder={
                kind === 'sight'
                  ? '景点简要介绍'
                  : kind === 'hotel'
                    ? '房型、是否含早、关注点等'
                    : '招牌菜、人均、注意事项等'
              }
              value={draft.description ?? ''}
              onChange={(e) => setField('description', e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <ImagePicker
              spotId={spot.id}
              blobId={draft.imageBlobId}
              onSetBlob={(id) => setField('imageBlobId', id)}
              pushLog={pushLog}
            />
          </div>

          <Field label="图片链接(或直接粘贴 / 拖拽上方)">
            <input
              className={inputClass}
              placeholder="https://..."
              value={draft.imageUrl ?? ''}
              onChange={(e) => setField('imageUrl', e.target.value)}
            />
          </Field>

          {kind === 'sight' && (
            <Field label="攻略链接">
              <input
                className={inputClass}
                placeholder="https://..."
                value={draft.guideUrl ?? ''}
                onChange={(e) => setField('guideUrl', e.target.value)}
              />
            </Field>
          )}

          {kind === 'sight' && (
            <Field label="视频链接">
              <input
                className={inputClass}
                placeholder="B站 / YouTube"
                value={draft.videoUrl ?? ''}
                onChange={(e) => setField('videoUrl', e.target.value)}
              />
            </Field>
          )}

          <Field label="交通方式">
            <input
              className={inputClass}
              placeholder="例:地铁1号线 / 距景区步行 5 分钟"
              value={draft.innerTransport ?? ''}
              onChange={(e) => setField('innerTransport', e.target.value)}
            />
          </Field>

          {kind === 'sight' && (
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
          )}

          {/* Coords */}
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

        {(draft.imageBlobId || draft.imageUrl || videoPreview) && (
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 p-4">
            {(draft.imageBlobId || draft.imageUrl) && (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase text-slate-400">
                  图片预览
                </h4>
                <SpotImage
                  blobId={draft.imageBlobId}
                  imageUrl={draft.imageUrl}
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

/**
 * Click / drag / paste image picker. Resizes via canvas before saving
 * to IndexedDB. Stores under `spotId` so each spot has at most one
 * blob; the spot record only carries the blobId reference.
 */
function ImagePicker({
  spotId,
  blobId,
  onSetBlob,
  pushLog,
}: {
  spotId: string
  blobId?: string
  onSetBlob: (id: string | undefined) => void
  pushLog: (msg: string, level?: 'info' | 'warn' | 'error') => void
}) {
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [stats, setStats] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setThumbUrl(null)
    if (!blobId) return
    let revoke: string | null = null
    let cancelled = false
    getImageBlob(blobId).then((blob) => {
      if (cancelled || !blob) return
      const u = URL.createObjectURL(blob)
      revoke = u
      setThumbUrl(u)
    })
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [blobId])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      pushLog('请选择图片文件。', 'warn')
      return
    }
    setBusy(true)
    try {
      const originalSize = file.size
      const resized = await resizeImage(file)
      await saveImageBlob(spotId, resized)
      onSetBlob(spotId)
      const ratio =
        originalSize > 0 ? Math.round((resized.size / originalSize) * 100) : 0
      const fmtKB = (n: number) => `${(n / 1024).toFixed(0)} KB`
      const note = `${fmtKB(originalSize)} → ${fmtKB(resized.size)}${
        ratio > 0 ? ` (${ratio}%)` : ''
      }`
      setStats(note)
      pushLog(`图片已保存到本地:${note}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      pushLog(`图片处理失败:${msg}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((it) =>
      it.type.startsWith('image/'),
    )
    if (!item) return
    const file = item.getAsFile()
    if (file) {
      e.preventDefault()
      void handleFile(file)
    }
  }

  const handleClear = async () => {
    if (!blobId) {
      onSetBlob(undefined)
      return
    }
    try {
      await deleteImageBlob(blobId)
    } catch {
      /* ignore */
    }
    onSetBlob(undefined)
    setThumbUrl(null)
    setStats(null)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className={`relative flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition focus:outline-none ${
        dragOver
          ? 'border-teal-400 bg-teal-50/60'
          : blobId
            ? 'border-teal-200 bg-teal-50/30'
            : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
      }`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt="预览"
          className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-white text-2xl text-slate-300 ring-1 ring-slate-200">
          📷
        </div>
      )}

      <div className="min-w-0 flex-1 text-[12px] text-slate-600">
        <div className="font-medium text-slate-800">
          {blobId ? '已保存到本地' : '上传图片'}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">
          {busy
            ? '处理中…'
            : blobId
              ? stats || '存在 IndexedDB,自动压缩到 1280px'
              : '点击选择 / 拖拽 / Cmd+V 粘贴'}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Btn
          variant="secondary"
          className="!py-1 !text-[11px]"
          onClick={() => inputRef.current?.click()}
        >
          {blobId ? '换一张' : '选择图片'}
        </Btn>
        {blobId && (
          <Btn
            variant="ghost"
            className="!py-1 !text-[11px] text-red-600"
            onClick={handleClear}
          >
            清除
          </Btn>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
