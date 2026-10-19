// Food photos are made smaller on the phone before they go anywhere: ~1280 px tells foods apart and keeps the
// small print of a nutrition table readable (~768 px wasn't).
const MAX_SIDE = 1280
const QUALITY = 0.8

/** A JPEG data URL of the photo, at most MAX_SIDE px on its longer side. */
export async function shrinkPhoto(file: Blob): Promise<string> {
  // An <img> decodes whatever the browser can show (HEIC on iPhones) and applies the EXIF rotation.
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}
