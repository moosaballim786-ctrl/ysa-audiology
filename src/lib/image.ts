/** Compress a photo on the device: max 2000px on the long edge, JPEG ~0.8. */
export async function compressImage(
  file: File,
  maxEdge = 2000,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap) bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", quality),
  );
  return { blob, width, height };
}
