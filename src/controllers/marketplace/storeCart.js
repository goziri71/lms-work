/**
 * Store Cart Controller
 * Handles shopping cart operations (guest and authenticated users)
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { StoreCart } from "../../models/marketplace/storeCart.js";
import { StoreCartItem } from "../../models/marketplace/storeCartItem.js";
import { Courses } from "../../models/course/courses.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Community } from "../../models/marketplace/community.js";
import { Membership } from "../../models/marketplace/membership.js";
import { Op } from "sequelize";
import { db } from "../../database/database.js";
import crypto from "crypto";

/**
 * Generate unique session ID for guest carts
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Get or create cart for user/guest
 */
async function getOrCreateCart(userId = null, sessionId = null) {
  let cart;

  if (userId) {
    // User cart - find active cart or create new one
    cart = await StoreCart.findOne({
      where: {
        user_id: userId,
        status: "active",
      },
    });

    if (!cart) {
      cart = await StoreCart.create({
        user_id: userId,
        session_id: null,
        expires_at: null,
        status: "active",
      });
    }
  } else if (sessionId) {
    // Guest cart - find active cart or create new one
    cart = await StoreCart.findOne({
      where: {
        session_id: sessionId,
        status: "active",
      },
    });

    if (!cart) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // 2 days expiration

      cart = await StoreCart.create({
        user_id: null,
        session_id: sessionId,
        expires_at: expiresAt,
        status: "active",
      });
    }
  } else {
    throw new ErrorClass("Either user_id or session_id is required", 400);
  }

  return cart;
}

/**
 * Get product details by type and ID
 */
async function getProductDetails(productType, productId) {
  switch (productType) {
    case "course":
      const course = await Courses.findOne({
        where: {
          id: productId,
          is_marketplace: true,
          marketplace_status: "published",
        },
        attributes: ["id", "title", "price", "currency", "image_url", "description"],
      });
      if (!course) return null;
      return {
        id: course.id,
        title: course.title,
        price: parseFloat(course.price || 0),
        currency: course.currency || "NGN",
        image_url: course.image_url,
        description: course.description,
      };

    case "ebook":
      const ebook = await EBooks.findOne({
        where: {
          id: productId,
          status: "published",
        },
        attributes: ["id", "title", "price", "currency", "cover_image", "description"],
      });
      if (!ebook) return null;
      return {
        id: ebook.id,
        title: ebook.title,
        price: parseFloat(ebook.price || 0),
        currency: ebook.currency || "NGN",
        image_url: ebook.cover_image,
        description: ebook.description,
      };

    case "digital_download":
      const download = await DigitalDownloads.findOne({
        where: {
          id: productId,
          status: "published",
        },
        attributes: ["id", "title", "price", "currency", "cover_image", "description"],
      });
      if (!download) return null;
      return {
        id: download.id,
        title: download.title,
        price: parseFloat(download.price || 0),
        currency: download.currency || "NGN",
        image_url: download.cover_image,
        description: download.description,
      };

    case "community":
      const community = await Community.findOne({
        where: {
          id: productId,
          status: "published",
          visibility: "public",
        },
        attributes: ["id", "name", "price", "currency", "image_url", "description"],
      });
      if (!community) return null;
      return {
        id: community.id,
        title: community.name,
        price: parseFloat(community.price || 0),
        currency: community.currency || "NGN",
        image_url: community.image_url,
        description: community.description,
      };

    case "membership":
      const membership = await Membership.findOne({
        where: {
          id: productId,
          status: "active",
        },
        attributes: ["id", "name", "price", "currency", "image_url", "description"],
      });
      if (!membership) return null;
      return {
        id: membership.id,
        title: membership.name,
        price: parseFloat(membership.price || 0),
        currency: membership.currency || "NGN",
        image_url: membership.image_url,
        description: membership.description,
      };

    default:
      return null;
  }
}

/**
 * Add item to cart
 * POST /api/marketplace/store/cart/add
 */
export const addToCart = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  const userType = req.user?.userType;
  let sessionId = req.headers["x-session-id"] || req.body.session_id;

  // Generate session ID for guest if not provided
  if (!userId && !sessionId) {
    sessionId = generateSessionId();
  }

  // Only students can add to cart
  if (userId && userType !== "student") {
    throw new ErrorClass("Only students can add items to cart", 403);
  }

  const { product_type, product_id, quantity = 1 } = req.body;

  if (!product_type || !product_id) {
    throw new ErrorClass("product_type and product_id are required", 400);
  }

  if (!["course", "ebook", "digital_download", "community", "membership"].includes(product_type)) {
    throw new ErrorClass("Invalid product_type", 400);
  }

  // Get product details
  const product = await getProductDetails(product_type, parseInt(product_id));
  if (!product) {
    throw new ErrorClass("Product not found or not available", 404);
  }

  // Get or create cart
  const cart = await getOrCreateCart(userId, sessionId);

  // Check if item already in cart
  const existingItem = await StoreCartItem.findOne({
    where: {
      cart_id: cart.id,
      product_type,
      product_id: parseInt(product_id),
    },
  });

  const transaction = await db.transaction();

  try {
    if (existingItem) {
      // Update quantity
      await existingItem.update(
        {
          quantity: existingItem.quantity + parseInt(quantity),
          price: product.price, // Update price in case it changed
        },
        { transaction }
      );
    } else {
      // Add new item
      await StoreCartItem.create(
        {
          cart_id: cart.id,
          product_type,
          product_id: parseInt(product_id),
          quantity: parseInt(quantity),
          price: product.price,
          currency: product.currency,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: {
        cart_id: cart.id,
        session_id: cart.session_id,
        product: {
          type: product_type,
          id: parseInt(product_id),
          title: product.title,
          price: product.price,
          currency: product.currency,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get cart contents
 * GET /api/marketplace/store/cart
 */
export const getCart = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  let sessionId = req.headers["x-session-id"] || req.query.session_id;

  if (!userId && !sessionId) {
    return res.status(200).json({
      success: true,
      message: "Cart is empty",
      data: {
        cart: {
          items: [],
          total: 0,
          item_count: 0,
        },
        session_id: null,
      },
    });
  }

  const cart = await StoreCart.findOne({
    where: {
      ...(userId ? { user_id: userId } : { session_id: sessionId }),
      status: "active",
    },
    include: [
      {
        model: StoreCartItem,
        as: "items",
      },
    ],
  });

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: "Cart is empty",
      data: {
        cart: {
          items: [],
          total: 0,
          item_count: 0,
        },
        session_id: cart?.session_id || sessionId,
      },
    });
  }

  // Check if guest cart is expired
  if (cart.expires_at && new Date() > new Date(cart.expires_at)) {
    await cart.update({ status: "expired" });
    return res.status(200).json({
      success: true,
      message: "Cart has expired",
      data: {
        cart: {
          items: [],
          total: 0,
          item_count: 0,
        },
        session_id: cart.session_id,
      },
    });
  }

  // Calculate totals
  let total = 0;
  const items = [];

  for (const item of cart.items) {
    const product = await getProductDetails(item.product_type, item.product_id);
    if (product) {
      const itemTotal = parseFloat(item.price) * item.quantity;
      total += itemTotal;

      items.push({
        id: item.id,
        product_type: item.product_type,
        product_id: item.product_id,
        title: product.title,
        price: parseFloat(item.price),
        currency: item.currency,
        quantity: item.quantity,
        subtotal: itemTotal,
        image_url: product.image_url,
      });
    }
  }

  res.status(200).json({
    success: true,
    message: "Cart retrieved successfully",
    data: {
      cart: {
        id: cart.id,
        items,
        total: parseFloat(total.toFixed(2)),
        item_count: items.length,
        expires_at: cart.expires_at,
      },
      session_id: cart.session_id,
    },
  });
});

/**
 * Remove item from cart
 * DELETE /api/marketplace/store/cart/item/:id
 */
export const removeFromCart = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  let sessionId = req.headers["x-session-id"] || req.query.session_id;
  const { id } = req.params;

  if (!userId && !sessionId) {
    throw new ErrorClass("Cart not found", 404);
  }

  const cart = await StoreCart.findOne({
    where: {
      ...(userId ? { user_id: userId } : { session_id: sessionId }),
      status: "active",
    },
  });

  if (!cart) {
    throw new ErrorClass("Cart not found", 404);
  }

  const item = await StoreCartItem.findOne({
    where: {
      id: parseInt(id),
      cart_id: cart.id,
    },
  });

  if (!item) {
    throw new ErrorClass("Item not found in cart", 404);
  }

  await item.destroy();

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
  });
});

/**
 * Update cart item quantity
 * PUT /api/marketplace/store/cart/item/:id
 */
export const updateCartItem = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  let sessionId = req.headers["x-session-id"] || req.body.session_id;
  const { id } = req.params;
  const { quantity } = req.body;

  if (!userId && !sessionId) {
    throw new ErrorClass("Cart not found", 404);
  }

  if (!quantity || parseInt(quantity) < 1) {
    throw new ErrorClass("Quantity must be at least 1", 400);
  }

  const cart = await StoreCart.findOne({
    where: {
      ...(userId ? { user_id: userId } : { session_id: sessionId }),
      status: "active",
    },
  });

  if (!cart) {
    throw new ErrorClass("Cart not found", 404);
  }

  const item = await StoreCartItem.findOne({
    where: {
      id: parseInt(id),
      cart_id: cart.id,
    },
  });

  if (!item) {
    throw new ErrorClass("Item not found in cart", 404);
  }

  await item.update({ quantity: parseInt(quantity) });

  res.status(200).json({
    success: true,
    message: "Cart item updated",
    data: {
      item: {
        id: item.id,
        quantity: item.quantity,
      },
    },
  });
});

/**
 * Clear cart
 * DELETE /api/marketplace/store/cart
 */
export const clearCart = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id || null;
  let sessionId = req.headers["x-session-id"] || req.query.session_id;

  if (!userId && !sessionId) {
    throw new ErrorClass("Cart not found", 404);
  }

  const cart = await StoreCart.findOne({
    where: {
      ...(userId ? { user_id: userId } : { session_id: sessionId }),
      status: "active",
    },
  });

  if (!cart) {
    throw new ErrorClass("Cart not found", 404);
  }

  await StoreCartItem.destroy({
    where: { cart_id: cart.id },
  });

  res.status(200).json({
    success: true,
    message: "Cart cleared",
  });
});

/**
 * Merge guest cart into user cart on login
 * POST /api/marketplace/store/cart/merge
 */
export const mergeCart = TryCatchFunction(async (req, res) => {
  const userId = req.user?.id;
  const userType = req.user?.userType;
  const sessionId = req.body.session_id || req.headers["x-session-id"];

  if (userType !== "student") {
    throw new ErrorClass("Only students can merge carts", 403);
  }

  if (!sessionId) {
    return res.status(200).json({
      success: true,
      message: "No guest cart to merge",
      data: {
        cart_id: null,
      },
    });
  }

  // Find guest cart
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
    return res.status(200).json({
      success: true,
      message: "No guest cart items to merge",
      data: {
        cart_id: null,
      },
    });
  }

  // Get or create user cart
  const userCart = await getOrCreateCart(userId, null);

  const transaction = await db.transaction();

  try {
    // Merge items from guest cart to user cart
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
        // Update quantity if item already exists
        await existingItem.update(
          {
            quantity: existingItem.quantity + guestItem.quantity,
          },
          { transaction }
        );
      } else {
        // Add new item
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

    // Mark guest cart as converted
    await guestCart.update({ status: "converted" }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Cart merged successfully",
      data: {
        cart_id: userCart.id,
        items_merged: guestCart.items.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});
