/**
 * Resize a user-supplied image (File or Blob) down to a max dimension
 * via canvas, then encode as JPEG. Used before persisting to IndexedDB
 * so the user's original 4MB iPhone photos become ~250KB.
 *
 * The image is centered if the source has weird aspect; we just scale
 * to fit max-dim on the longer side, preserving aspect ratio.
 */
export async function resizeImage(
  source: Blob,
  opts: { maxDim?: number; quality?: number; mimeType?: string } = {},
): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1280
  const quality = opts.quality ?? 0.8
  const mimeType = opts.mimeType ?? 'image/jpeg'

  // Decode to an ImageBitmap (faster + no DOM Image load dance).
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source)
  } catch (e) {
    throw new Error(
      `无法解码图片(可能格式不支持):${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const longer = Math.max(bitmap.width, bitmap.height)
  const scale = longer > maxDim ? maxDim / longer : 1
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('无法获取 canvas 2D 上下文')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('canvas.toBlob 返回 null'))
        else resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}
