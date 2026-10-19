// Reads a product barcode from a photo with the browser's own BarcodeDetector (Chrome on Android, not Safari).
// Without it, or when nothing is found, the photo goes on to recognition as usual.

interface Detector {
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>
}
type DetectorClass = { new (options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> }

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** The barcode number in the photo, or null if there is none or the browser can't read barcodes. */
export async function readBarcode(photo: Blob): Promise<string | null> {
  const Barcode = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (!Barcode) return null
  try {
    const supported = await Barcode.getSupportedFormats()
    const formats = FORMATS.filter((f) => supported.includes(f))
    if (!formats.length) return null
    const bitmap = await createImageBitmap(photo)
    try {
      const found = await new Barcode({ formats }).detect(bitmap)
      return found.find((b) => /^\d{8,14}$/.test(b.rawValue))?.rawValue ?? null
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}
