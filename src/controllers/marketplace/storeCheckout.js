/**
 * Store Checkout Controller
 * Handles checkout flow - redirects to login/register if not authenticated
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { StoreCart } from "../../models/marketplace/storeCart.js";
import { StoreCartItem } from "../../models/marketplace/storeCartItem.js";

/**
 * Initiate checkout
 * POST /api/marketplace/store/checkout
 * 
 * If user is not authenticated, returns redirect URLs for login/register
 * If authenticated, proceeds with checkout
 */
export const initiateCheckout = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  const userType = req.user?.userType;
  let sessionId = req.headers["x-session-id"] || req.body.session_id;

  // If not authenticated, redirect to login/register
  if (!userId || userType !== "student") {
    return res.status(200).json({
      success: true,
      requires_auth: true,
      message: "Please login or register to complete checkout",
      data: {
        login_url: "/api/auth/login",
        register_url: "/api/auth/register/student",
        cart_session_id: sessionId,
      },
    });
  }

  // User is authenticated - get cart
  if (!sessionId) {
    // Try to get user's active cart
    const userCart = await StoreCart.findOne({
      where: {
        user_id: userId,
        status: "active",
      },
      include: [
        {
          model: StoreCartItem,
          as: "items",
        },
      ],
    });

    if (!userCart || userCart.items.length === 0) {
      throw new ErrorClass("Cart is empty", 400);
    }

    return res.status(200).json({
      success: true,
      requires_auth: false,
      message: "Checkout ready",
      data: {
        cart_id: userCart.id,
        items_count: userCart.items.length,
        checkout_url: `/api/marketplace/store/checkout/process`,
      },
    });
  }

  // User has session ID - merge cart first
  const guestCart = await StoreCart.findOne({
    where: {
      session_id: sessionId,
      status: "active",
    },
    include: [
      {
        model: StoreCartItem,
        as: "items",
      },
    ],
  });

  if (!guestCart || guestCart.items.length === 0) {
    throw new ErrorClass("Cart is empty", 400);
  }

  // Get or create user cart
  const userCart = await StoreCart.findOne({
    where: {
      user_id: userId,
      status: "active",
    },
  }) || await StoreCart.create({
    user_id: userId,
    session_id: null,
    expires_at: null,
    status: "active",
  });

  // Merge guest cart items into user cart
  const transaction = await db.transaction();

  try {
    for (const guestItem of guestCart.items) {
      const existingItem = await StoreCartItem.findOne({
        where: {
          cart_id: userCart.id,
          product_type: guestItem.product_type,
          product_id: guestItem.product_id,
        },
        transaction,
      });

      if (existingItem) {
        await existingItem.update(
          {
            quantity: existingItem.quantity + guestItem.quantity,
          },
          { transaction }
        );
      } else {
        await StoreCartItem.create(
          {
            cart_id: userCart.id,
            product_type: guestItem.product_type,
            product_id: guestItem.product_id,
            quantity: guestItem.quantity,
            price: guestItem.price,
            currency: guestItem.currency,
          },
          { transaction }
        );
      }
    }

    await guestCart.update({ status: "converted" }, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  res.status(200).json({
    success: true,
    requires_auth: false,
    message: "Cart merged and checkout ready",
    data: {
      cart_id: userCart.id,
      items_count: guestCart.items.length,
      checkout_url: `/api/marketplace/store/checkout/process`,
    },
  });
});
