import { MAX_PHOTO_DATA_URL, MAX_PHOTOS } from "@/lib/plan";

export type Shot = { id: string; dataUrl: string };

export async function fileToShot(file: File): Promise<Shot> {
  const dataUrl = await compress(file);
  if (dataUrl.length > MAX_PHOTO_DATA_URL) {
    throw new Error("That photo is still too large. Take a closer shot or pick a smaller JPEG.");
  }
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dataUrl };
}

function paint(bitmap: ImageBitmap, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare that photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compress(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const raw = await readAsDataUrl(file);
    if (raw.startsWith("data:image/") && raw.length <= MAX_PHOTO_DATA_URL) return raw;
    throw new Error("That photo could not be reduced. Use the camera, or a JPEG from your gallery.");
  }

  try {
    let best = "";
    for (const edge of [1280, 960, 720, 640, 480]) {
      for (const quality of [0.72, 0.58, 0.46, 0.36]) {
        best = paint(bitmap, edge, quality);
        if (best.length <= MAX_PHOTO_DATA_URL) return best;
      }
    }
    return best;
  } finally {
    bitmap.close();
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that photo."));
    };
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}

export function roomFor(count: number): number {
  return Math.max(0, MAX_PHOTOS - count);
}
