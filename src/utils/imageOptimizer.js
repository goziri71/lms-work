import sharp from "sharp";

/**
 * Resize + compress an uploaded image for web delivery before it's stored.
 * Uploaded photos (especially straight from a phone camera) are commonly
 * 3000-4000px wide and several MB — serving those as-is in a feed is the
 * single biggest reason a feed "feels slow" client-side, independent of how
 * fast the API responds. This shrinks to a sane max width and re-encodes as
 * WebP, which is broadly supported and compresses far better than JPEG/PNG
 * at the same visual quality.
 *
 * Animated images (GIF, animated WebP/PNG) are passed through unchanged —
 * re-encoding would risk collapsing them to a single frame.
 *
 * @param {Buffer} buffer - raw uploaded file bytes
 * @param {string} mimetype - uploaded file's mimetype
 * @param {{ maxWidth?: number, quality?: number }} [opts]
 * @returns {Promise<{ buffer: Buffer, mimetype: string, extension: string }>}
 */
const BASE64_IMAGE_REGEX = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;

/**
 * Strip embedded base64 images out of rich-text HTML, resize/compress each
 * one, upload it to storage, and replace it with a URL — so a post's stored
 * content and the JSON payload of every feed response that includes it
 * aren't bloated with megabytes of inline image data per post.
 *
 * @param {string|null} htmlContent
 * @param {{ supabase: object, bucket: string, pathPrefix: string }} ctx
 * @returns {Promise<string|null>}
 */
export async function extractEmbeddedBase64Images(htmlContent, { supabase, bucket, pathPrefix }) {
  if (!htmlContent) return htmlContent;

  const matches = [...htmlContent.matchAll(BASE64_IMAGE_REGEX)];
  if (matches.length === 0) return htmlContent;

  let processed = htmlContent;

  for (let i = 0; i < matches.length; i++) {
    const [fullMatch, imageType, base64Data] = matches[i];
    try {
      const rawBuffer = Buffer.from(base64Data, "base64");
      const optimized = await optimizeImageForWeb(rawBuffer, `image/${imageType}`);
      const ext = optimized.extension || imageType;
      const objectPath = `${pathPrefix}/embedded_${i}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(objectPath, optimized.buffer, {
        contentType: optimized.mimetype,
        upsert: true,
      });

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        processed = processed.replace(
          fullMatch,
          fullMatch.replace(/src="[^"]*"/, `src="${data.publicUrl}"`)
        );
      } else {
        console.error(`Failed to upload embedded image ${i}:`, error.message);
      }
    } catch (err) {
      console.error(`Error processing embedded image ${i}:`, err.message);
    }
  }

  return processed;
}

export async function optimizeImageForWeb(buffer, mimetype, opts = {}) {
  const { maxWidth = 1600, quality = 82 } = opts;

  if (mimetype === "image/gif") {
    // Could be animated — don't risk breaking it by re-encoding.
    return { buffer, mimetype, extension: "gif" };
  }

  try {
    const image = sharp(buffer, { animated: true });
    const metadata = await image.metadata();

    if (metadata.pages && metadata.pages > 1) {
      // Animated WebP/PNG — pass through unchanged for the same reason as GIF.
      return { buffer, mimetype, extension: metadata.format || "webp" };
    }

    const resized = await image
      .rotate() // apply EXIF orientation before stripping metadata
      .resize({
        width: maxWidth,
        withoutEnlargement: true, // never upscale a smaller image
      })
      .webp({ quality })
      .toBuffer();

    return { buffer: resized, mimetype: "image/webp", extension: "webp" };
  } catch (error) {
    console.error("Image optimization failed, using original upload:", error.message);
    return { buffer, mimetype, extension: null };
  }
}
