import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { EBooks } from "../../models/marketplace/index.js";
import { supabase } from "../../utils/supabase.js";
import { checkProductAccess } from "../../services/membershipAccessService.js";

function parseSupabaseObjectUrl(fileUrl) {
  const urlParts = fileUrl.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    throw new ErrorClass("Invalid PDF URL format", 400);
  }

  const pathPart = urlParts[1].split("?")[0];
  const pathParts = pathPart.split("/").filter((p) => p);
  if (pathParts.length < 2) {
    throw new ErrorClass("Invalid PDF URL format", 400);
  }

  const hasPrefix = pathParts[0] === "public" || pathParts[0] === "sign";
  const bucket = hasPrefix ? pathParts[1] : pathParts[0];
  const objectPath = hasPrefix
    ? pathParts.slice(2).join("/")
    : pathParts.slice(1).join("/");

  if (!bucket || !objectPath) {
    throw new ErrorClass("Invalid PDF URL format", 400);
  }

  return { bucket, objectPath };
}

/**
 * Get signed URL for purchased e-book PDF
 * POST /api/marketplace/ebooks/:id/signed-url
 * 
 * For private buckets - generates a signed URL for student to access purchased e-book PDF
 */
export const getEBookSignedUrl = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access e-book signed URLs", 403);
  }

  const ebook = await EBooks.findByPk(id, {
    attributes: ["id", "pdf_url", "status"],
  });
  if (!ebook || ebook.status !== "published") {
    throw new ErrorClass("E-book not found", 404);
  }

  const accessInfo = await checkProductAccess(studentId, "ebook", Number(id));
  if (!accessInfo?.has_access) {
    throw new ErrorClass(
      "E-book not found or you don't have access through purchase or membership",
      403
    );
  }

  if (!ebook.pdf_url) {
    throw new ErrorClass("E-book PDF not available", 404);
  }

  const { bucket, objectPath } = parseSupabaseObjectUrl(ebook.pdf_url);

  // Generate new signed URL (expires in 1 hour for security)
  const { data: signedUrlData, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 3600); // 1 hour expiration

  if (error) {
    throw new ErrorClass(`Failed to generate signed URL: ${error.message}`, 500);
  }

  res.status(200).json({
    success: true,
    message: "Signed URL generated successfully",
    data: {
      ebook_id: id,
      signed_url: signedUrlData.signedUrl,
      expires_in: 3600, // seconds
    },
  });
});

