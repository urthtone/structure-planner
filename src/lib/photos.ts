export const MAX_PHOTOS = 10;
export const MAX_IMAGE_DATA_LENGTH = 650_000;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Shared by file picker and drop handler. SVG and other active formats excluded. */
export function selectImageFiles(incoming: readonly File[], existing: number) {
  const files: File[] = [];
  const errors: string[] = [];
  for (const file of incoming) {
    if (!TYPES.has(file.type)) {
      errors.push("Only JPEG, PNG, WebP and GIF images are accepted.");
      continue;
    }
    if (file.size > 20 * 1024 * 1024) {
      errors.push("An image exceeded the 20 MB source limit.");
      continue;
    }
    if (existing + files.length >= MAX_PHOTOS) {
      errors.push("Maximum 10 photos; remove one before adding more.");
      continue;
    }
    files.push(file);
  }
  return { files, errors };
}

/** Decode before storage; Promise.allSettled in the UI preserves selection order. */
export async function compressImage(file: File): Promise<string> {
  if (!selectImageFiles([file], 0).files.length)
    throw new Error("Unsupported image.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 50_000_000
    )
      throw new Error("Image dimensions are too large.");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image processing is unavailable in this browser.");
    let ratio = Math.min(
      1,
      1280 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/jpeg", 0.78 - attempt * 0.1);
      if (
        result.length <= MAX_IMAGE_DATA_LENGTH &&
        result.startsWith("data:image/jpeg;base64,")
      )
        return result;
      ratio *= 0.8;
    }
    throw new Error("Could not compress this image below 650 KB.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
