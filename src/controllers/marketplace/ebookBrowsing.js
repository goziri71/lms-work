import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { EBooks, EBookPurchase } from "../../models/marketplace/index.js";
import { SoleTutor, Organization } from "../../models/marketplace/index.js";
import { Op } from "sequelize";

/**
 * Browse all published e-books
 * GET /api/marketplace/ebooks
 */
export const browseEBooks = TryCatchFunction(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    owner_id,
    owner_type,
    min_price,
    max_price,
    sort = "newest", // newest, oldest, price_low, price_high, popular
  } = req.query;

  const where = {
    status: "published",
  };

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { author: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (category) {
    where.category = category;
  }

  if (owner_id && owner_type) {
    where.owner_id = parseInt(owner_id);
    where.owner_type = owner_type;
  }

  if (min_price || max_price) {
    where.price = {};
    if (min_price) {
      where.price[Op.gte] = parseFloat(min_price);
    }
    if (max_price) {
      where.price[Op.lte] = parseFloat(max_price);
    }
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Determine sort order
  let order = [["id", "DESC"]];
  if (sort === "oldest") {
    order = [["id", "ASC"]];
  } else if (sort === "price_low") {
    order = [["price", "ASC"]];
  } else if (sort === "price_high") {
    order = [["price", "DESC"]];
  } else if (sort === "popular") {
    order = [["sales_count", "DESC"]];
  }

  const { count, rows: ebooks } = await EBooks.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order,
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email"],
        required: false,
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
  });

  // Format response
  const ebooksData = ebooks.map((ebook) => {
    const ebookJson = ebook.toJSON();
    const owner = ebookJson.soleTutor || ebookJson.organization;
    
    return {
      id: ebookJson.id,
      title: ebookJson.title,
      description: ebookJson.description,
      author: ebookJson.author,
      pages: ebookJson.pages,
      price: parseFloat(ebookJson.price || 0),
      currency: ebookJson.currency,
      cover_image: ebookJson.cover_image,
      category: ebookJson.category,
      tags: ebookJson.tags || [],
      sales_count: ebookJson.sales_count,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
            type: ebookJson.owner_type,
          }
        : null,
      created_at: ebookJson.created_at,
    };
  });

  res.status(200).json({
    success: true,
    message: "E-books retrieved successfully",
    data: {
      ebooks: ebooksData,
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
 * Get single e-book details
 * GET /api/marketplace/ebooks/:id
 */
export const getEBookById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  const ebook = await EBooks.findOne({
    where: {
      id,
      status: "published",
    },
    include: [
      {
        model: SoleTutor,
        as: "soleTutor",
        attributes: ["id", "fname", "lname", "email", "bio"],
        required: false,
      },
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "email", "description"],
        required: false,
      },
    ],
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found or not available", 404);
  }

  // Check if student has purchased this e-book
  let is_purchased = false;
  if (studentId && req.user?.userType === "student") {
    const purchase = await EBookPurchase.findOne({
      where: {
        ebook_id: id,
        student_id: studentId,
      },
    });
    is_purchased = !!purchase;
  }

  const ebookJson = ebook.toJSON();
  const owner = ebookJson.soleTutor || ebookJson.organization;

  res.status(200).json({
    success: true,
    message: "E-book retrieved successfully",
    data: {
      ebook: {
        id: ebookJson.id,
        title: ebookJson.title,
        description: ebookJson.description,
        author: ebookJson.author,
        pages: ebookJson.pages,
        price: parseFloat(ebookJson.price || 0),
        currency: ebookJson.currency,
        cover_image: ebookJson.cover_image,
        category: ebookJson.category,
        tags: ebookJson.tags || [],
        sales_count: ebookJson.sales_count,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name || `${owner.fname || ""} ${owner.lname || ""}`.trim(),
              type: ebookJson.owner_type,
              bio: owner.bio || owner.description || null,
            }
          : null,
        is_purchased,
        created_at: ebookJson.created_at,
      },
    },
  });
});

/**
 * Get student's purchased e-books
 * GET /api/marketplace/ebooks/my-ebooks
 */
export const getMyEBooks = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  const {
    page = 1,
    limit = 20,
    search,
  } = req.query;

  const where = {
    student_id: studentId,
  };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: purchases } = await EBookPurchase.findAndCountAll({
    where,
    include: [
      {
        model: EBooks,
        as: "ebook",
        attributes: [
          "id",
          "title",
          "description",
          "author",
          "pages",
          "cover_image",
          "category",
          "tags",
          "pdf_url",
        ],
        required: true,
      },
    ],
    limit: parseInt(limit),
    offset,
    order: [["created_at", "DESC"]],
  });

  const ebooksData = purchases.map((purchase) => {
    const purchaseJson = purchase.toJSON();
    const ebook = purchaseJson.ebook;
    
    return {
      id: ebook.id,
      title: ebook.title,
      description: ebook.description,
      author: ebook.author,
      pages: ebook.pages,
      cover_image: ebook.cover_image,
      category: ebook.category,
      tags: ebook.tags || [],
      pdf_url: ebook.pdf_url,
      purchased_at: purchaseJson.created_at,
      purchase_price: parseFloat(purchaseJson.price || 0),
      purchase_currency: purchaseJson.currency,
    };
  });

  res.status(200).json({
    success: true,
    message: "Purchased e-books retrieved successfully",
    data: {
      ebooks: ebooksData,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

