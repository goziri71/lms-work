import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { EBooks, EBookPurchase } from "../../models/marketplace/index.js";
import { supabase } from "../../utils/supabase.js";

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

  // Verify student has purchased this e-book
  const purchase = await EBookPurchase.findOne({
    where: {
      ebook_id: id,
      student_id: studentId,
    },
    include: [
      {
        model: EBooks,
        as: "ebook",
        attributes: ["id", "pdf_url"],
        required: true,
      },
    ],
  });

  if (!purchase) {
    throw new ErrorClass("E-book not found or you haven't purchased it", 404);
  }

  const ebook = purchase.ebook;
  if (!ebook.pdf_url) {
    throw new ErrorClass("E-book PDF not available", 404);
  }

  // Extract file path from URL
  // URL format: https://{supabase-url}/storage/v1/object/public/{bucket}/{path}
  // or: https://{supabase-url}/storage/v1/object/sign/{bucket}/{path}?token=...
  const urlParts = ebook.pdf_url.split("/storage/v1/object/");
  if (urlParts.length < 2) {
    throw new ErrorClass("Invalid PDF URL format", 400);
  }

  const pathPart = urlParts[1].split("?")[0]; // Remove query params if any
  const pathParts = pathPart.split("/");
  const bucket = pathParts[0];
  const objectPath = pathParts.slice(1).join("/");

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

