import { useTripStore } from '../../store/tripStore'
import { Btn, SpotImg } from '../ui'

export function SpotDetailModal() {
  const spot = useTripStore((s) => s.spotDetailSpot)
  const setSpotDetail = useTripStore((s) => s.setSpotDetail)
  const removeSpot = useTripStore((s) => s.removeSpot)

  if (!spot) return null

  const urls = spot.xiaohongshuUrls || []
  let video: React.ReactNode = <span className="text-slate-500">暂无视频</span>
  if (spot.videoUrl) {
    const url = spot.videoUrl.trim()
    const bvMatch = url.match(/(BV[\w]+)/i)
    const avMatch = url.match(/video\/av(\d+)/i)
    if (/bilibili|b23\.tv/i.test(url) && (bvMatch || avMatch)) {
      video = (
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
    } else {
      video = (
        <a href={url} target="_blank" rel="noreferrer" className="text-teal-700 underline">
          打开视频链接
        </a>
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && setSpotDetail(null)}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{spot.name}</h3>
          <div className="flex gap-2">
            <Btn
              variant="secondary"
              className="!text-xs text-red-700"
              onClick={() => {
                removeSpot(spot.id)
                setSpotDetail(null)
              }}
            >
              移除
            </Btn>
            <Btn variant="secondary" onClick={() => setSpotDetail(null)}>
              关闭
            </Btn>
          </div>
        </header>
        <div className="space-y-4 p-4 text-sm">
          {spot.imageUrl ? (
            <SpotImg
              src={spot.imageUrl}
              alt={spot.name}
              aspectClassName="max-h-64"
              className="rounded-xl"
            />
          ) : null}
          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400">介绍</h4>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{spot.description || '暂无介绍'}</p>
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400">视频</h4>
            <div className="mt-1">{video}</div>
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400">小红书</h4>
            <div className="mt-1 flex flex-wrap gap-2">
              {urls.length ? (
                urls.map((u, i) => (
                  <a key={i} href={u.trim()} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                    帖子 {i + 1}
                  </a>
                ))
              ) : (
                <span className="text-slate-500">暂无</span>
              )}
            </div>
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase text-slate-400">攻略</h4>
            {spot.guideUrl ? (
              <a href={spot.guideUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                攻略链接
              </a>
            ) : (
              <span className="text-slate-500">暂无</span>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
