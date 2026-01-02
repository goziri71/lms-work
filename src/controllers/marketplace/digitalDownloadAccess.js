import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { DigitalDownloads, DigitalDownloadPurchase } from "../../models/marketplace/index.js";
import { supabase } from "../../utils/supabase.js";

/**
 * Get signed URL for purchased digital download file (for download)
 * POST /api/marketplace/digital-downloads/:id/download-url
 * 
 * For private buckets - generates a signed URL for student to download purchased product
 */
export const getDigitalDownloadUrl = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access download URLs", 403);
  }

  // Verify student has purchased this product
  const purchase = await DigitalDownloadPurchase.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
    },
    include: [
      {
        model: DigitalDownloads,
        as: "digitalDownload",
        attributes: ["id", "file_url", "download_enabled"],
        required: true,
      },
    ],
  });

  if (!purchase) {
    throw new ErrorClass("Product not found or you haven't purchased it", 404);
  }

  const download = purchase.digitalDownload;
  
  if (!download.download_enabled) {
    throw new ErrorClass("Download is not enabled for this product. Please use streaming instead.", 400);
  }

  if (!download.file_url) {
    throw new ErrorClass("Product file not available", 404);
  }

  // Extract file path from URL
  // Handle both formats:
  // - https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
  // - https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
  const urlParts = download.file_url.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    throw new ErrorClass("Invalid file URL format", 400);
  }

  const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
  const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
  
  // Bucket is the second element (first is "public" or "sign")
  if (pathParts.length < 2) {
    throw new ErrorClass("Invalid file URL format: missing bucket or path", 400);
  }
  
  const bucket = pathParts[1]; // Second element is the bucket
  const objectPath = pathParts.slice(2).join("/"); // Path starts from third element

  // Generate new signed URL (expires in 7 days for downloads)
  const { data: signedUrlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 604800); // 7 days expiration

  if (error) {
    throw new ErrorClass(`Failed to generate signed URL: ${error.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "Download URL generated successfully",
    data: {
      digital_download_id: id,
      download_url: signedUrlData.signedUrl,
      expires_in: 604800, // seconds (7 days)
    },
  });
});

/**
 * Get streaming URL for purchased digital download (for videos/podcasts/music)
 * POST /api/marketplace/digital-downloads/:id/stream-url
 * 
 * For streaming products - generates a signed URL for student to stream purchased product
 */
export const getDigitalDownloadStreamUrl = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access streaming URLs", 403);
  }

  // Verify student has purchased this product
  const purchase = await DigitalDownloadPurchase.findOne({
    where: {
      digital_download_id: id,
      student_id: studentId,
    },
    include: [
      {
        model: DigitalDownloads,
        as: "digitalDownload",
        attributes: ["id", "file_url", "streaming_enabled", "product_type"],
        required: true,
      },
    ],
  });

  if (!purchase) {
    throw new ErrorClass("Product not found or you haven't purchased it", 404);
  }

  const download = purchase.digitalDownload;
  
  if (!download.streaming_enabled) {
    throw new ErrorClass("Streaming is not enabled for this product. Please use download instead.", 400);
  }

  // Only allow streaming for video, podcast, and music
  const streamingTypes = ["video", "podcast", "music"];
  if (!streamingTypes.includes(download.product_type)) {
    throw new ErrorClass("Streaming is only available for videos, podcasts, and music", 400);
  }

  if (!download.file_url) {
    throw new ErrorClass("Product file not available", 404);
  }

  // Extract file path from URL
  // Handle both formats:
  // - https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
  // - https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
  const urlParts = download.file_url.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    throw new ErrorClass("Invalid file URL format", 400);
  }

  const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
  const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
  
  // Bucket is the second element (first is "public" or "sign")
  if (pathParts.length < 2) {
    throw new ErrorClass("Invalid file URL format: missing bucket or path", 400);
  }
  
  const bucket = pathParts[1]; // Second element is the bucket
  const objectPath = pathParts.slice(2).join("/"); // Path starts from third element

  // Generate new signed URL (expires in 1 hour for streaming)
  const { data: signedUrlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600); // 1 hour expiration

  if (error) {
    throw new ErrorClass(`Failed to generate streaming URL: ${error.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "Streaming URL generated successfully",
    data: {
      digital_download_id: id,
      stream_url: signedUrlData.signedUrl,
      expires_in: 3600, // seconds (1 hour)
      product_type: download.product_type,
    },
  });
});

/**
 * Get preview URL for digital download (public, no purchase required)
 * GET /api/marketplace/digital-downloads/:id/preview-url
 */
export const getDigitalDownloadPreviewUrl = TryCatchFunction(async (req, res) => {
  const { id } = req.params;

  const download = await DigitalDownloads.findOne({
    where: {
      id,
      status: "published",
    },
    attributes: ["id", "preview_url", "product_type", "streaming_enabled"],
  });

  if (!download) {
    throw new ErrorClass("Digital download not found or not available", 404);
  }

  if (!download.preview_url) {
    throw new ErrorClass("Preview not available for this product", 404);
  }

  // Extract file path from URL
  // Handle both formats:
  // - https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
  // - https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
  const urlParts = download.preview_url.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    // If it's not a Supabase storage URL, return as-is
    return res.status(200).json({
      success: true,
      message: "Preview URL retrieved successfully",
      data: {
        digital_download_id: id,
        preview_url: download.preview_url,
      },
    });
  }

  const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
  const pathParts = pathPart.split("/").filter(p => p); // Remove empty strings
  
  // Bucket is the second element (first is "public" or "sign")
  if (pathParts.length < 2) {
    // If URL format is invalid, return original URL
    return res.status(200).json({
      success: true,
      message: "Preview URL retrieved successfully",
      data: {
        digital_download_id: id,
        preview_url: download.preview_url,
      },
    });
  }
  
  const bucket = pathParts[1]; // Second element is the bucket
  const objectPath = pathParts.slice(2).join("/"); // Path starts from third element

  // Generate signed URL for preview (expires in 1 hour)
  const { data: signedUrlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600);

  if (error) {
    // Fallback to public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);
    
    return res.status(200).json({
      success: true,
      message: "Preview URL retrieved successfully",
      data: {
        digital_download_id: id,
        preview_url: urlData.publicUrl,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: "Preview URL retrieved successfully",
    data: {
      digital_download_id: id,
      preview_url: signedUrlData.signedUrl,
      expires_in: 3600,
    },
  });
});

