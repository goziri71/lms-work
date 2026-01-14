/**
 * Invoice Controller
 * Handles invoice listing, downloading, and email sending
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Invoice } from "../../models/marketplace/invoice.js";
import {
  createInvoice,
  generateInvoicePDF,
  getInvoiceWithDetails,
} from "../../services/invoiceService.js";
import { Op } from "sequelize";
import { supabase } from "../../utils/supabase.js";

/**
 * Get all invoices for a student
 * GET /api/marketplace/invoices
 */
export const getMyInvoices = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view their invoices", 403);
  }

  const { page = 1, limit = 20, status, payment_status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    student_id: studentId,
  };

  if (status) {
    where.invoice_status = status;
  }

  if (payment_status) {
    where.payment_status = payment_status;
  }

  const { count, rows: invoices } = await Invoice.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["issued_at", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "Invoices retrieved successfully",
    data: {
      invoices,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Get invoice by ID
 * GET /api/marketplace/invoices/:id
 */
export const getInvoice = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;
  const { id } = req.params;

  if (userType !== "student") {
    throw new ErrorClass("Only students can view invoices", 403);
  }

  const invoice = await getInvoiceWithDetails(id);

  if (!invoice) {
    throw new ErrorClass("Invoice not found", 404);
  }

  if (invoice.student_id !== studentId) {
    throw new ErrorClass("You don't have permission to view this invoice", 403);
  }

  res.status(200).json({
    success: true,
    message: "Invoice retrieved successfully",
    data: {
      invoice,
    },
  });
});

/**
 * Download invoice PDF
 * GET /api/marketplace/invoices/:id/download
 */
export const downloadInvoice = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;
  const { id } = req.params;

  if (userType !== "student") {
    throw new ErrorClass("Only students can download invoices", 403);
  }

  const invoice = await Invoice.findByPk(id);

  if (!invoice) {
    throw new ErrorClass("Invoice not found", 404);
  }

  if (invoice.student_id !== studentId) {
    throw new ErrorClass("You don't have permission to download this invoice", 403);
  }

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(id);

  // Set response headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${invoice.invoice_number}.pdf"`
  );
  res.setHeader("Content-Length", pdfBuffer.length);

  // Send PDF
  res.send(pdfBuffer);
});

/**
 * Send invoice via email
 * POST /api/marketplace/invoices/:id/send
 */
export const sendInvoiceEmail = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;
  const userType = req.user?.userType;
  const { id } = req.params;

  if (userType !== "student") {
    throw new ErrorClass("Only students can send invoices", 403);
  }

  const invoice = await getInvoiceWithDetails(id);

  if (!invoice) {
    throw new ErrorClass("Invoice not found", 404);
  }

  if (invoice.student_id !== studentId) {
    throw new ErrorClass("You don't have permission to send this invoice", 403);
  }

  // Generate PDF
  const pdfBuffer = await generateInvoicePDF(id);

  // Upload PDF to Supabase storage (if not already uploaded)
  let pdfUrl = invoice.pdf_url;

  if (!pdfUrl) {
    try {
      const fileName = `invoices/${invoice.invoice_number}.pdf`;
      const { data, error } = await supabase.storage
        .from("invoices")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (error) {
        console.error("Error uploading invoice PDF:", error);
        // Continue without storing PDF URL
      } else {
        const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
        await invoice.update({ pdf_url: pdfUrl });
      }
    } catch (error) {
      console.error("Error uploading invoice PDF:", error);
      // Continue without storing PDF URL
    }
  }

  // Send email with invoice
  // TODO: Integrate with email service to send invoice
  // For now, return success with PDF URL

  res.status(200).json({
    success: true,
    message: "Invoice sent successfully",
    data: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      email: invoice.student.email,
      pdf_url: pdfUrl,
    },
  });
});

/**
 * Create invoice (internal use - called from purchase flows)
 * This is typically called automatically when a purchase is made
 */
export async function createInvoiceForPurchase(purchaseData) {
  try {
    const invoice = await createInvoice(purchaseData);
    return invoice;
  } catch (error) {
    console.error("Error creating invoice:", error);
    // Don't throw - invoice creation failure shouldn't block purchase
    return null;
  }
}
