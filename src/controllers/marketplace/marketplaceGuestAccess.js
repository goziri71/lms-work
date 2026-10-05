import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { MarketplaceGuestOrder } from "../../models/marketplace/marketplaceGuestOrder.js";
import { Courses } from "../../models/course/courses.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import {
  getGuestDownloadUrlForOrder,
  resendGuestOrderEmail,
} from "../../services/marketplaceGuestCheckoutService.js";
import { joinFrontendUrl } from "../../utils/frontendUrl.js";
import { productViewUrl } from "../../utils/productViewUrl.js";

export const getGuestPurchaseByToken = TryCatchFunction(async (req, res) => {
  const { accessToken } = req.params;
  const order = await MarketplaceGuestOrder.findOne({
    where: { access_token: accessToken },
  });
  if (!order) throw new ErrorClass("Purchase not found", 404);

  const data = {
    order_id: order.id,
    status: order.status,
    product_type: order.product_type,
    product_id: order.product_id,
    product_title: order.product_title,
    buyer_email: order.buyer_email,
    buyer_name: order.buyer_name,
    total_amount: parseFloat(order.total_amount).toFixed(2),
    currency: order.currency,
    paid_at: order.paid_at,
    entitlement_created: order.entitlement_created,
    access_token: order.access_token,
  };

  if (order.status === "paid") {
    if (order.product_type === "course") {
      const course = await Courses.findByPk(order.product_id, {
        attributes: ["id", "title", "slug", "cover_image_url"],
      });
      data.course = course
        ? {
            id: course.id,
            title: course.title,
            slug: course.slug,
            cover_image_url: course.cover_image_url,
            start_url: joinFrontendUrl(
              process.env.FRONTEND_URL,
              order.entitlement_created
                ? `courses/${course.id}`
                : `login?email=${encodeURIComponent(order.buyer_email)}`
            ),
            needs_account: !order.entitlement_created,
          }
        : null;
    } else {
      const product = await DigitalDownloads.findByPk(order.product_id, {
        attributes: ["id", "title", "slug", "product_type", "download_enabled", "streaming_enabled"],
      });
      data.digital_product = product;
      data.can_download = !!product?.download_enabled;
      data.can_stream = !!product?.streaming_enabled;
      Object.assign(data, productViewUrl("digital_download", product || { id: order.product_id }));
      data.view_url = joinFrontendUrl(
        process.env.FRONTEND_URL,
        `access/purchase/${order.access_token}`
      );
    }
  }

  res.status(200).json({ success: true, data });
});

export const guestPurchaseDownloadUrl = TryCatchFunction(async (req, res) => {
  const { accessToken } = req.params;
  const order = await MarketplaceGuestOrder.findOne({
    where: { access_token: accessToken, status: "paid" },
  });
  if (!order) throw new ErrorClass("Purchase not found", 404);

  const download = await getGuestDownloadUrlForOrder(order);
  res.status(200).json({
    success: true,
    message: "Download URL generated",
    data: download,
  });
});

export const resendGuestPurchaseEmail = TryCatchFunction(async (req, res) => {
  const { accessToken } = req.params;
  await resendGuestOrderEmail(accessToken);
  res.status(200).json({
    success: true,
    message: "Email sent",
  });
});
