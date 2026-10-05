import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import {
  createGuestCheckoutOrder,
  confirmGuestOrderFlutterwave,
} from "../../services/marketplaceGuestCheckoutService.js";

function formatGuestOrder(order) {
  return {
    id: order.id,
    status: order.status,
    product_type: order.product_type,
    product_id: order.product_id,
    product_title: order.product_title,
    total_amount: parseFloat(order.total_amount).toFixed(2),
    currency: order.currency,
    buyer_email: order.buyer_email,
    access_token: order.status === "paid" ? order.access_token : null,
    entitlement_created: !!order.entitlement_created,
    reservation_expires_at: order.reservation_expires_at,
  };
}

export const createGuestCheckout = TryCatchFunction(async (req, res) => {
  const {
    product_type,
    product_id,
    buyer_email,
    buyer_name,
    buyer_phone,
  } = req.body;

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }
  if (!["digital_download"].includes(String(product_type))) {
    throw new ErrorClass(
      "Guest checkout is only for digital downloads. Courses require a student account.",
      400
    );
  }

  const studentId =
    req.user?.userType === "student" ? parseInt(req.user.id, 10) : null;

  const idempotencyKey =
    req.get("Idempotency-Key") || req.get("idempotency-key") || null;

  const result = await createGuestCheckoutOrder({
    productType: product_type,
    productId: parseInt(product_id, 10),
    buyerEmail: buyer_email,
    buyerName: buyer_name,
    buyerPhone: buyer_phone,
    idempotencyKey,
    studentId,
  });

  if (result.isFree) {
    return res.status(200).json({
      success: true,
      message: "Purchase confirmed",
      data: {
        order: formatGuestOrder(result.order),
        access_url: `/access/purchase/${result.order.access_token}`,
      },
    });
  }

  res.status(201).json({
    success: true,
    message: "Order created",
    data: {
      order: formatGuestOrder(result.order),
      payment: result.payment,
    },
  });
});

export const confirmGuestCheckoutPayment = TryCatchFunction(async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  const { transaction_reference, flutterwave_transaction_id } = req.body;

  const { order, alreadyPaid } = await confirmGuestOrderFlutterwave(orderId, {
    transactionReference: transaction_reference,
    flutterwaveTransactionId: flutterwave_transaction_id,
  });

  res.status(200).json({
    success: true,
    message: alreadyPaid ? "Order already paid" : "Payment confirmed",
    data: {
      order: formatGuestOrder(order),
      access_url: `/access/purchase/${order.access_token}`,
    },
  });
});
