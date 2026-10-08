import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../database/database.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { MarketplaceGuestOrder } from "../models/marketplace/marketplaceGuestOrder.js";
import { Courses } from "../models/course/courses.js";
import { DigitalDownloads } from "../models/marketplace/digitalDownloads.js";
import { DigitalDownloadPurchase } from "../models/marketplace/digitalDownloadPurchase.js";
import { CourseReg } from "../models/course_reg.js";
import { Students } from "../models/auth/student.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { calculateRevenue } from "./revenueSharingService.js";
import { applyLegacyWalletMirror } from "../utils/tutorWallet.js";
import { emailService } from "./emailService.js";
import { joinFrontendUrl } from "../utils/frontendUrl.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionReference,
} from "./flutterwaveService.js";
import { attachPaymentOptions } from "./bvaPaymentService.js";
import { getDigitalSalePricing } from "../utils/coursePricing.js";

export const GUEST_RESERVATION_MINUTES = 15;

export function generateGuestAccessToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function buildGuestOrderTxRef(orderId) {
  return `GST-ORDER-${orderId}-${Date.now()}`;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function loadProduct(productType, productId) {
  if (productType === "course") {
    throw new ErrorClass(
      "Courses cannot be purchased as a guest. Create a student account first.",
      400
    );
  }

  const download = await DigitalDownloads.findByPk(productId);
  if (!download) throw new ErrorClass("Product not found", 404);
  if (download.status !== "published") {
    throw new ErrorClass("This product is not available for purchase", 400);
  }
  const pricing = getDigitalSalePricing(download);
  const price = parseFloat(pricing.sale_price);
  if (price < 0) throw new ErrorClass("Product price is invalid", 400);
  return {
    product_type: "digital_download",
    product_id: download.id,
    title: download.title,
    price,
    currency: (download.currency || "NGN").toUpperCase(),
    owner_type: download.owner_type,
    owner_id: download.owner_id,
    is_free: price === 0,
    enrollment_limit: null,
    download,
  };
}

async function assertNotAlreadyOwned(productType, productId, buyerEmail, studentId) {
  const email = normalizeEmail(buyerEmail);
  if (studentId) {
    if (productType === "course") {
      const reg = await CourseReg.findOne({
        where: {
          student_id: studentId,
          course_id: productId,
          registration_status: "marketplace_purchased",
        },
      });
      if (reg) throw new ErrorClass("You already own this course", 400);
    } else {
      const p = await DigitalDownloadPurchase.findOne({
        where: { student_id: studentId, digital_download_id: productId },
      });
      if (p) throw new ErrorClass("You already own this product", 400);
    }
  }

  const paidGuest = await MarketplaceGuestOrder.findOne({
    where: {
      product_type: productType,
      product_id: productId,
      buyer_email: email,
      status: "paid",
      entitlement_created: true,
    },
  });
  if (paidGuest) {
    throw new ErrorClass(
      "This email already has access. Check your inbox or use the access link we sent.",
      400
    );
  }
}

async function creditOwnerFromGuestOrder(order, productMeta, dbTransaction) {
  const amount = parseFloat(order.total_amount || 0);
  if (amount <= 0) {
    return { platformFee: 0, tutorEarnings: 0, commissionRate: 0 };
  }

  const ownerType = productMeta.owner_type;
  const ownerId = productMeta.owner_id;

  if (ownerType === "wpu" || ownerType === "wsp") {
    const commissionRate = 0;
    const platformFee = amount;
    await order.update(
      {
        commission_rate: commissionRate,
        platform_fee: platformFee,
        tutor_earnings: 0,
      },
      { transaction: dbTransaction }
    );
    return { platformFee, tutorEarnings: 0, commissionRate };
  }

  if (ownerType !== "sole_tutor" && ownerType !== "organization") {
    throw new ErrorClass("Product owner not found for payout", 404);
  }

  const OwnerModel = ownerType === "sole_tutor" ? SoleTutor : Organization;
  const owner = await OwnerModel.findByPk(ownerId, {
    lock: dbTransaction.LOCK.UPDATE,
    transaction: dbTransaction,
  });
  if (!owner) throw new ErrorClass("Product owner not found", 404);

  const commissionRate = parseFloat(owner.commission_rate ?? 15);
  const { wspCommission, tutorEarnings } = calculateRevenue(amount, commissionRate);
  const cur = (order.currency || "NGN").toUpperCase();
  const updates = {
    total_earnings: parseFloat(owner.total_earnings || 0) + amount,
  };

  if (cur === "USD") {
    updates.wallet_balance_usd =
      parseFloat(owner.wallet_balance_usd || 0) + tutorEarnings;
  } else if (cur === "GBP") {
    updates.wallet_balance_gbp =
      parseFloat(owner.wallet_balance_gbp || 0) + tutorEarnings;
  } else {
    const nextPrimary =
      parseFloat(owner.wallet_balance_primary || 0) + tutorEarnings;
    updates.wallet_balance_primary = nextPrimary;
    applyLegacyWalletMirror(updates, nextPrimary);
  }

  await owner.update(updates, { transaction: dbTransaction });
  await order.update(
    {
      commission_rate: commissionRate,
      platform_fee: wspCommission,
      tutor_earnings: tutorEarnings,
    },
    { transaction: dbTransaction }
  );

  return {
    platformFee: wspCommission,
    tutorEarnings,
    commissionRate,
  };
}

export async function createGuestEntitlement(order, studentId, dbTransaction) {
  if (order.entitlement_created) return;

  const product = await loadProduct(order.product_type, order.product_id);

  if (order.product_type === "course") {
    if (product.enrollment_limit != null) {
      const count = await CourseReg.count({
        where: {
          course_id: product.product_id,
          registration_status: "marketplace_purchased",
        },
        transaction: dbTransaction,
      });
      if (count >= product.enrollment_limit) {
        throw new ErrorClass("This course has reached its enrollment limit", 409);
      }
    }

    await CourseReg.create(
      {
        student_id: studentId,
        course_id: product.product_id,
        academic_year: null,
        semester: null,
        date: new Date().toISOString().split("T")[0],
        registration_status: "marketplace_purchased",
        course_reg_id: null,
        program_id: null,
        facaulty_id: null,
        level: null,
        first_ca: 0,
        second_ca: 0,
        third_ca: 0,
        exam_score: 0,
      },
      { transaction: dbTransaction }
    );
  } else {
    const download = product.download;
    const amount = parseFloat(order.total_amount || 0);
    let commissionRate = 15;
    if (product.owner_type === "sole_tutor") {
      const o = await SoleTutor.findByPk(product.owner_id, { transaction: dbTransaction });
      if (o?.commission_rate != null) commissionRate = parseFloat(o.commission_rate);
    } else if (product.owner_type === "organization") {
      const o = await Organization.findByPk(product.owner_id, { transaction: dbTransaction });
      if (o?.commission_rate != null) commissionRate = parseFloat(o.commission_rate);
    }
    const { wspCommission, tutorEarnings } = calculateRevenue(amount, commissionRate);

    await DigitalDownloadPurchase.create(
      {
        digital_download_id: product.product_id,
        student_id: studentId,
        owner_type: product.owner_type,
        owner_id: product.owner_id,
        price: amount,
        currency: order.currency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        transaction_ref: order.transaction_ref || `GUEST-${order.id}`,
      },
      { transaction: dbTransaction }
    );

    await download.update(
      { sales_count: (download.sales_count || 0) + 1 },
      { transaction: dbTransaction }
    );
  }

  await order.update(
    { entitlement_created: true, student_id: studentId },
    { transaction: dbTransaction }
  );
}

async function resolveStudentForGuestOrder(order, dbTransaction) {
  let studentId = order.student_id;
  if (studentId) {
    return studentId;
  }
  const student = await Students.findOne({
    where: { email: normalizeEmail(order.buyer_email) },
    transaction: dbTransaction,
  });
  return student?.id || null;
}

export async function fulfillGuestOrder(orderId, { paymentMethod, transactionRef, flutterwaveId } = {}) {
  const transaction = await db.transaction();
  try {
    const order = await MarketplaceGuestOrder.findByPk(orderId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!order) throw new ErrorClass("Order not found", 404);
    if (order.status === "paid") {
      await transaction.commit();
      return { order, alreadyPaid: true };
    }
    if (order.status !== "pending") {
      throw new ErrorClass(`Order cannot be completed (status: ${order.status})`, 400);
    }

    if (
      order.reservation_expires_at &&
      new Date(order.reservation_expires_at) < new Date()
    ) {
      await order.update({ status: "cancelled" }, { transaction });
      await transaction.commit();
      throw new ErrorClass("Checkout session expired. Please try again.", 410);
    }

    const productMeta = await loadProduct(order.product_type, order.product_id);
    const accessToken = order.access_token || generateGuestAccessToken();

    await order.update(
      {
        status: "paid",
        payment_method: paymentMethod || order.payment_method,
        transaction_ref: transactionRef || order.transaction_ref,
        flutterwave_transaction_id: flutterwaveId || order.flutterwave_transaction_id,
        access_token: accessToken,
        paid_at: new Date(),
        reservation_expires_at: null,
      },
      { transaction }
    );
    await order.reload({ transaction });

    await creditOwnerFromGuestOrder(order, productMeta, transaction);

    const studentId = await resolveStudentForGuestOrder(order, transaction);
    if (studentId) {
      await createGuestEntitlement(order, studentId, transaction);
    }

    await transaction.commit();

    sendGuestOrderConfirmationEmail(order, productMeta).catch((err) =>
      console.error("Guest order email error:", err.message)
    );

    return { order: await MarketplaceGuestOrder.findByPk(orderId), alreadyPaid: false };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function createGuestCheckoutOrder({
  productType,
  productId,
  buyerEmail,
  buyerName,
  buyerPhone,
  idempotencyKey,
  studentId,
}) {
  const email = normalizeEmail(buyerEmail);
  if (!email || !buyerName?.trim()) {
    throw new ErrorClass("buyer_email and buyer_name are required", 400);
  }

  if (idempotencyKey) {
    const existing = await MarketplaceGuestOrder.findOne({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) {
      const isFree = parseFloat(existing.total_amount || 0) <= 0;
      const paid = existing.status === "paid";
      return {
        order: existing,
        isFree,
        payment:
          isFree || paid
            ? null
            : buildGuestFlutterwavePayload(existing),
      };
    }
  }

  const product = await loadProduct(productType, productId);
  await assertNotAlreadyOwned(productType, productId, email, studentId);

  const totalAmount = product.is_free ? 0 : product.price;
  const isFree = totalAmount <= 0;

  const order = await MarketplaceGuestOrder.create({
    product_type: productType,
    product_id: productId,
    product_title: product.title,
    buyer_email: email,
    buyer_name: buyerName.trim(),
    buyer_phone: buyerPhone || null,
    student_id: studentId || null,
    status: "pending",
    total_amount: totalAmount,
    currency: product.currency,
    owner_type: product.owner_type,
    owner_id: product.owner_id,
    access_token: generateGuestAccessToken(),
    payment_method: isFree ? "free" : "flutterwave",
    idempotency_key: idempotencyKey || null,
    reservation_expires_at: isFree
      ? null
      : new Date(Date.now() + GUEST_RESERVATION_MINUTES * 60 * 1000),
  });

  if (!isFree) {
    const txRef = buildGuestOrderTxRef(order.id);
    await order.update({ transaction_ref: txRef });
  }

  if (isFree) {
    const { order: paid } = await fulfillGuestOrder(order.id, {
      paymentMethod: "free",
      transactionRef: `GUEST-FREE-${order.id}`,
    });
    return { order: paid, isFree: true, payment: null };
  }

  return {
    order: await MarketplaceGuestOrder.findByPk(order.id),
    isFree: false,
    payment: buildGuestFlutterwavePayload(await MarketplaceGuestOrder.findByPk(order.id)),
  };
}

export function buildGuestFlutterwavePayload(order) {
  return attachPaymentOptions(
    {
      provider: "flutterwave",
      tx_ref: order.transaction_ref,
      amount: parseFloat(order.total_amount).toFixed(2),
      currency: order.currency,
      public_key: process.env.FLUTTERWAVE_PUBLIC_KEY?.trim() || null,
      meta: {
        order_id: order.id,
        product_type: order.product_type,
        product_id: order.product_id,
        type: "marketplace_guest",
        buyer_email: order.buyer_email,
      },
    },
    { source: "guest_order", order_id: order.id }
  );
}

export async function confirmGuestOrderFlutterwave(orderId, { transactionReference, flutterwaveTransactionId }) {
  const order = await MarketplaceGuestOrder.findByPk(orderId);
  if (!order) throw new ErrorClass("Order not found", 404);
  if (order.status === "paid") {
    return { order, alreadyPaid: true };
  }

  const verifyId = flutterwaveTransactionId || transactionReference || order.transaction_ref;
  if (!verifyId) {
    throw new ErrorClass("transaction_reference or flutterwave_transaction_id required", 400);
  }

  const verification = await verifyTransaction(String(verifyId), {
    maxRetries: 3,
    retryDelayMs: 1500,
  });

  if (!verification.success || !verification.transaction) {
    throw new ErrorClass(verification.message || "Payment verification failed", 400);
  }

  const fw = verification.transaction;
  if (!isTransactionSuccessful(fw)) {
    throw new ErrorClass("Payment was not successful", 400);
  }

  const fwRef = getTransactionReference(fw);
  if (order.transaction_ref && fwRef && fwRef !== order.transaction_ref) {
    throw new ErrorClass("Transaction reference does not match order", 400);
  }

  const paidAmount = parseFloat(getTransactionAmount(fw));
  const expected = parseFloat(order.total_amount);
  if (Math.abs(paidAmount - expected) > 0.02) {
    throw new ErrorClass(
      `Payment amount mismatch. Expected ${expected}, received ${paidAmount}`,
      400
    );
  }

  return fulfillGuestOrder(orderId, {
    paymentMethod: "flutterwave",
    transactionRef: fwRef || order.transaction_ref,
    flutterwaveId: fw.id?.toString(),
  });
}

export async function fulfillGuestOrderFromWebhook(txRef, transactionData) {
  const order = await MarketplaceGuestOrder.findOne({
    where: { transaction_ref: txRef },
  });
  if (!order || order.status === "paid") {
    return { handled: !!order, order };
  }
  if (!isTransactionSuccessful(transactionData)) {
    return { handled: false, order };
  }
  const paidAmount = parseFloat(getTransactionAmount(transactionData));
  if (Math.abs(paidAmount - parseFloat(order.total_amount)) > 0.02) {
    console.error(`Guest order ${order.id} amount mismatch on webhook`);
    return { handled: false, order };
  }

  const result = await fulfillGuestOrder(order.id, {
    paymentMethod: "flutterwave",
    transactionRef: txRef,
    flutterwaveId: transactionData.id?.toString(),
  });
  return { handled: true, order: result.order };
}

export async function claimGuestOrdersForStudent(studentId, email) {
  const normalized = normalizeEmail(email);
  const orders = await MarketplaceGuestOrder.findAll({
    where: {
      buyer_email: normalized,
      status: "paid",
      entitlement_created: false,
    },
  });

  let claimed = 0;
  for (const order of orders) {
    const t = await db.transaction();
    try {
      const locked = await MarketplaceGuestOrder.findByPk(order.id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!locked || locked.entitlement_created || locked.status !== "paid") {
        await t.commit();
        continue;
      }
      await createGuestEntitlement(locked, studentId, t);
      await locked.update({ student_id: studentId }, { transaction: t });
      await t.commit();
      claimed += 1;
    } catch (e) {
      await t.rollback();
      console.error("Claim guest order error:", e.message);
    }
  }
  return claimed;
}

async function sendGuestOrderConfirmationEmail(order, productMeta) {
  const accessUrl = joinFrontendUrl(
    process.env.FRONTEND_URL,
    `access/purchase/${order.access_token}`
  );

  const productLabel =
    order.product_type === "course" ? "course" : "digital product";

  const html = `
    <h2>Your ${productLabel} is ready</h2>
    <p>Hi ${order.buyer_name},</p>
    <p>Thanks for your purchase of <strong>${order.product_title || productMeta.title}</strong>.</p>
    <p>Amount: ${parseFloat(order.total_amount).toFixed(2)} ${order.currency}</p>
    <p><a href="${accessUrl}">Open your purchase</a></p>
    <p>If you create an account with this email later, it will appear in your library automatically.</p>
    <p style="font-size:12px;color:#6b7280">Nomada</p>
  `;

  await emailService.sendEmail({
    to: order.buyer_email,
    name: order.buyer_name,
    subject: `Your purchase: ${order.product_title || productMeta.title}`,
    htmlBody: html,
    useTutorLearnerBranding: true,
  });
}

export async function resendGuestOrderEmail(accessToken) {
  const order = await MarketplaceGuestOrder.findOne({
    where: { access_token: accessToken, status: "paid" },
  });
  if (!order) throw new ErrorClass("Order not found", 404);
  const productMeta = await loadProduct(order.product_type, order.product_id);
  await sendGuestOrderConfirmationEmail(order, productMeta);
}

export async function getGuestDownloadUrlForOrder(order) {
  if (order.product_type !== "digital_download") {
    throw new ErrorClass("Download is only for digital products", 400);
  }
  if (order.status !== "paid") {
    throw new ErrorClass("Order is not paid", 400);
  }

  const download = await DigitalDownloads.findByPk(order.product_id);
  if (!download?.file_url) throw new ErrorClass("Product file not available", 404);
  if (!download.download_enabled) {
    throw new ErrorClass("Download is not enabled for this product", 400);
  }

  const urlParts = download.file_url.split("/storage/v1/object/");
  if (urlParts.length < 2) throw new ErrorClass("Invalid file URL", 400);
  const pathPart = urlParts[1].split("?")[0];
  const pathParts = pathPart.split("/").filter(Boolean);
  const hasPrefix = pathParts[0] === "public" || pathParts[0] === "sign";
  const bucket = hasPrefix ? pathParts[1] : pathParts[0];
  const objectPath = hasPrefix
    ? pathParts.slice(2).join("/")
    : pathParts.slice(1).join("/");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 604800);

  if (error) {
    throw new ErrorClass(`Failed to generate download URL: ${error.message}`, 500);
  }

  return {
    download_url: data.signedUrl,
    expires_in: 604800,
    digital_download_id: download.id,
  };
}
