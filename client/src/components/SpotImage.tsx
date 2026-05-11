import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { getImageBlob } from '../lib/imageStorage'
import { SpotImg } from './ui'

/**
 * Smart spot image. Prefers the IndexedDB blob (if blobId given) over
 * the imageUrl. Manages the URL.createObjectURL lifecycle so we don't
 * leak object URLs.
 */
export function SpotImage({
  blobId,
  imageUrl,
  alt,
  className,
  aspectClassName,
}: {
  blobId?: string
  imageUrl?: string | null
  alt?: string
  className?: string
  aspectClassName?: string
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blobId) {
      setBlobUrl(null)
      return
    }
    let revoke: string | null = null
    let cancelled = false
    getImageBlob(blobId)
      .then((blob) => {
        if (cancelled) return
        if (blob) {
          const u = URL.createObjectURL(blob)
          revoke = u
          setBlobUrl(u)
        } else {
          setBlobUrl(null)
        }
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null)
      })
    return () => {
      cancelled = true
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [blobId])

  // Blob wins. Fall back to imageUrl. Both null → SpotImg shows placeholder.
  const src = blobUrl ?? imageUrl ?? null
  return (
    <SpotImg
      src={src}
      alt={alt}
      className={clsx(className)}
      aspectClassName={aspectClassName}
    />
  )
}
