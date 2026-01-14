/**
 * Invoice Service
 * Handles invoice generation, PDF creation, and invoice management
 */

import { Invoice } from "../models/marketplace/invoice.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import PDFDocument from "pdfkit";
import { Op } from "sequelize";

/**
 * Generate unique invoice number
 * Format: INV-YYYY-MMDD-XXXXX (e.g., INV-2024-1201-00001)
 */
export function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}${day}`;

  // Get count of invoices for today
  return Invoice.count({
    where: {
      invoice_number: {
        [Op.like]: `INV-${dateStr}-%`,
      },
    },
  })
    .then((count) => {
      const sequence = String(count + 1).padStart(5, "0");
      return `INV-${dateStr}-${sequence}`;
    })
    .catch(() => {
      // Fallback if count fails
      const random = Math.floor(Math.random() * 10000);
      return `INV-${dateStr}-${String(random).padStart(5, "0")}`;
    });
}

/**
 * Create invoice for a purchase
 */
export async function createInvoice(invoiceData) {
  const {
    student_id,
    product_type,
    product_id,
    product_name,
    quantity = 1,
    unit_price,
    subtotal,
    tax_amount = 0,
    discount_amount = 0,
    total_amount,
    currency = "NGN",
    payment_method,
    payment_reference,
    payment_status = "completed",
    tutor_id,
    tutor_type,
    billing_address,
    notes,
  } = invoiceData;

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  // Create invoice
  const invoice = await Invoice.create({
    invoice_number: invoiceNumber,
    student_id,
    product_type,
    product_id,
    product_name,
    quantity,
    unit_price: parseFloat(unit_price),
    subtotal: parseFloat(subtotal),
    tax_amount: parseFloat(tax_amount),
    discount_amount: parseFloat(discount_amount),
    total_amount: parseFloat(total_amount),
    currency,
    payment_method,
    payment_reference,
    payment_status,
    invoice_status: payment_status === "completed" ? "paid" : "sent",
    issued_at: new Date(),
    paid_at: payment_status === "completed" ? new Date() : null,
    tutor_id,
    tutor_type,
    billing_address,
    notes,
  });

  return invoice;
}

/**
 * Generate PDF invoice
 * Returns PDF buffer
 */
export async function generateInvoicePDF(invoiceId) {
  const invoice = await Invoice.findByPk(invoiceId, {
    include: [
      {
        model: Students,
        as: "student",
        attributes: ["id", "fname", "lname", "mname", "email", "phone"],
      },
    ],
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Get tutor info if applicable
  let tutor = null;
  if (invoice.tutor_id && invoice.tutor_type) {
    if (invoice.tutor_type === "sole_tutor") {
      tutor = await SoleTutor.findByPk(invoice.tutor_id, {
        attributes: ["id", "fname", "lname", "mname", "email", "phone"],
      });
    } else if (invoice.tutor_type === "organization") {
      tutor = await Organization.findByPk(invoice.tutor_id, {
        attributes: ["id", "name", "email", "phone"],
      });
    }
  }

  // Create PDF
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => {});

  // Header
  doc.fontSize(20).text("INVOICE", { align: "right" });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice #: ${invoice.invoice_number}`, { align: "right" });
  doc.text(`Date: ${new Date(invoice.issued_at).toLocaleDateString()}`, { align: "right" });
  doc.moveDown(2);

  // Company/Seller Info
  doc.fontSize(14).text("From:", { underline: true });
  doc.fontSize(10);
  if (tutor) {
    if (invoice.tutor_type === "sole_tutor") {
      doc.text(`${tutor.fname} ${tutor.lname || ""}`.trim());
      if (tutor.email) doc.text(`Email: ${tutor.email}`);
      if (tutor.phone) doc.text(`Phone: ${tutor.phone}`);
    } else {
      doc.text(tutor.name);
      if (tutor.email) doc.text(`Email: ${tutor.email}`);
      if (tutor.phone) doc.text(`Phone: ${tutor.phone}`);
    }
  } else {
    doc.text("WPU Learning Management System");
    doc.text("Email: support@wpu.edu");
  }
  doc.moveDown();

  // Bill To
  doc.fontSize(14).text("Bill To:", { underline: true });
  doc.fontSize(10);
  doc.text(`${invoice.student.fname} ${invoice.student.lname || ""}`.trim());
  if (invoice.student.email) doc.text(`Email: ${invoice.student.email}`);
  if (invoice.student.phone) doc.text(`Phone: ${invoice.student.phone}`);
  if (invoice.billing_address) {
    doc.moveDown(0.5);
    const address = invoice.billing_address;
    if (address.street) doc.text(address.street);
    if (address.city) doc.text(`${address.city}${address.state ? `, ${address.state}` : ""}`);
    if (address.country) doc.text(address.country);
    if (address.postal_code) doc.text(`Postal Code: ${address.postal_code}`);
  }
  doc.moveDown(2);

  // Invoice Items Table
  const tableTop = doc.y;
  doc.fontSize(12).text("Item", 50, tableTop);
  doc.text("Quantity", 300, tableTop);
  doc.text("Unit Price", 380, tableTop, { align: "right" });
  doc.text("Amount", 480, tableTop, { align: "right" });

  const itemY = tableTop + 20;
  doc.fontSize(10);
  doc.text(invoice.product_name, 50, itemY);
  doc.text(String(invoice.quantity), 300, itemY);
  doc.text(`${invoice.currency} ${invoice.unit_price.toFixed(2)}`, 380, itemY, { align: "right" });
  doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 480, itemY, { align: "right" });

  // Totals
  const totalsY = itemY + 40;
  doc.fontSize(10);
  doc.text("Subtotal:", 380, totalsY, { align: "right" });
  doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, 480, totalsY, { align: "right" });

  if (invoice.discount_amount > 0) {
    doc.text("Discount:", 380, totalsY + 20, { align: "right" });
    doc.text(`-${invoice.currency} ${invoice.discount_amount.toFixed(2)}`, 480, totalsY + 20, { align: "right" });
  }

  if (invoice.tax_amount > 0) {
    doc.text("Tax:", 380, totalsY + (invoice.discount_amount > 0 ? 40 : 20), { align: "right" });
    doc.text(`${invoice.currency} ${invoice.tax_amount.toFixed(2)}`, 480, totalsY + (invoice.discount_amount > 0 ? 40 : 20), { align: "right" });
  }

  const totalY = totalsY + (invoice.discount_amount > 0 ? 60 : 40) + (invoice.tax_amount > 0 ? 20 : 0);
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total:", 380, totalY, { align: "right" });
  doc.text(`${invoice.currency} ${invoice.total_amount.toFixed(2)}`, 480, totalY, { align: "right" });

  // Payment Info
  doc.moveDown(3);
  doc.fontSize(10).font("Helvetica");
  doc.text("Payment Information:", { underline: true });
  doc.text(`Status: ${invoice.payment_status.toUpperCase()}`);
  if (invoice.payment_method) doc.text(`Method: ${invoice.payment_method}`);
  if (invoice.payment_reference) doc.text(`Reference: ${invoice.payment_reference}`);
  if (invoice.paid_at) doc.text(`Paid: ${new Date(invoice.paid_at).toLocaleDateString()}`);

  // Notes
  if (invoice.notes) {
    doc.moveDown();
    doc.text("Notes:", { underline: true });
    doc.text(invoice.notes);
  }

  // Footer
  doc.fontSize(8).text(
    "Thank you for your business!",
    50,
    doc.page.height - 50,
    { align: "center" }
  );

  doc.end();

  // Wait for PDF to finish generating
  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);
  });
}

/**
 * Get invoice with related data
 */
export async function getInvoiceWithDetails(invoiceId) {
  const invoice = await Invoice.findByPk(invoiceId);
  
  if (!invoice) {
    return null;
  }

  // Get student details
  const student = await Students.findByPk(invoice.student_id, {
    attributes: ["id", "fname", "lname", "mname", "email", "phone"],
  });

  // Attach student to invoice object
  invoice.student = student;

  return invoice;
}
