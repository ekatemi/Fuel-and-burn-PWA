// Food photos are made small on the phone before they go anywhere: ~768 px is enough to tell foods apart.
const MAX_SIDE = 768
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
