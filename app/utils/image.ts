// PRD 3.5.2：在手機端把照片壓縮到長邊約 1024px 再上傳
const MAX_EDGE = 1024
const JPEG_QUALITY = 0.8

export async function compressImage(file: File): Promise<Blob> {
  // imageOrientation 讓手機照片依 EXIF 方向轉正
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('照片壓縮失敗'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
