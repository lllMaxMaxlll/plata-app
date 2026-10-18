/**
 * Recorta y comprime una foto de perfil en el navegador antes de subirla.
 *
 * Una foto de celular pesa varios MB y se muestra en un círculo de 56 px: se
 * recorta al cuadrado central y se reduce a 256 px (alcanza para pantallas 3x),
 * en WebP. Safari viejo no codifica WebP y devuelve PNG en su lugar; en ese
 * caso se usa JPEG, que el bucket también acepta.
 */

export const AVATAR_SIZE = 256
const QUALITY = 0.85

export async function compressAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Elegí una imagen.")

  // createImageBitmap respeta la orientación EXIF: la foto no queda acostada.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("No pude leer esa imagen. Probá con otra (JPG o PNG).")
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(AVATAR_SIZE, side)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.")

  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  )
  bitmap.close()

  const webp = await toBlob(canvas, "image/webp")
  if (webp?.type === "image/webp") return webp
  const jpeg = await toBlob(canvas, "image/jpeg")
  if (!jpeg) throw new Error("No pude comprimir la imagen.")
  return jpeg
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}
