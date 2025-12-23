import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { EBooks } from "../../models/marketplace/ebooks.js";
import { Op } from "sequelize";

/**
 * Get all e-books created by tutor
 * GET /api/marketplace/tutor/ebooks
 */
export const getMyEBooks = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    page = 1,
    limit = 20,
    status,
    search,
  } = req.query;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const where = {
    owner_type: ownerType,
    owner_id: ownerId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { author: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows: ebooks } = await EBooks.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["id", "DESC"]],
  });

  res.status(200).json({
    success: true,
    message: "E-books retrieved successfully",
    data: {
      ebooks: ebooks.map((ebook) => ({
        id: ebook.id,
        title: ebook.title,
        author: ebook.author,
        pages: ebook.pages,
        price: parseFloat(ebook.price || 0),
        currency: ebook.currency,
        cover_image: ebook.cover_image,
        category: ebook.category,
        tags: ebook.tags || [],
        status: ebook.status,
        sales_count: ebook.sales_count,
        created_at: ebook.created_at,
        updated_at: ebook.updated_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

/**
 * Get single e-book details
 * GET /api/marketplace/tutor/ebooks/:id
 */
export const getEBookById = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const ebook = await EBooks.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "E-book retrieved successfully",
    data: {
      ebook: {
        id: ebook.id,
        title: ebook.title,
        description: ebook.description,
        author: ebook.author,
        pages: ebook.pages,
        price: parseFloat(ebook.price || 0),
        currency: ebook.currency,
        pdf_url: ebook.pdf_url,
        cover_image: ebook.cover_image,
        category: ebook.category,
        tags: ebook.tags || [],
        status: ebook.status,
        sales_count: ebook.sales_count,
        created_at: ebook.created_at,
        updated_at: ebook.updated_at,
      },
    },
  });
});

/**
 * Create new e-book
 * POST /api/marketplace/tutor/ebooks
 */
export const createEBook = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const {
    title,
    description,
    author,
    pages,
    price,
    currency = "NGN",
    pdf_url,
    cover_image,
    category,
    tags = [],
    status = "draft",
  } = req.body;

  // Validation
  if (!title || !pdf_url) {
    throw new ErrorClass("Title and PDF URL are required", 400);
  }

  if (status === "published" && (!price || parseFloat(price) < 0)) {
    throw new ErrorClass("Published e-books must have a price >= 0", 400);
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  // Create e-book
  const ebook = await EBooks.create({
    title: title.trim(),
    description: description || null,
    author: author || null,
    pages: pages ? parseInt(pages) : null,
    price: parseFloat(price || 0),
    currency: currency,
    pdf_url: pdf_url,
    cover_image: cover_image || null,
    category: category || null,
    tags: Array.isArray(tags) ? tags : [],
    owner_type: ownerType,
    owner_id: ownerId,
    status: status,
  });

  res.status(201).json({
    success: true,
    message: "E-book created successfully",
    data: {
      ebook: {
        id: ebook.id,
        title: ebook.title,
        author: ebook.author,
        price: parseFloat(ebook.price || 0),
        status: ebook.status,
      },
    },
  });
});

/**
 * Update e-book
 * PUT /api/marketplace/tutor/ebooks/:id
 */
export const updateEBook = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const ebook = await EBooks.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found", 404);
  }

  const {
    title,
    description,
    author,
    pages,
    price,
    currency,
    pdf_url,
    cover_image,
    category,
    tags,
    status,
  } = req.body;

  // Validation for published status
  if (status === "published") {
    const newPrice = price ? parseFloat(price) : parseFloat(ebook.price || 0);
    if (newPrice < 0) {
      throw new ErrorClass("Published e-books must have a price >= 0", 400);
    }
  }

  // Update e-book
  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description;
  if (author !== undefined) updateData.author = author;
  if (pages !== undefined) updateData.pages = pages ? parseInt(pages) : null;
  if (price !== undefined) updateData.price = parseFloat(price);
  if (currency !== undefined) updateData.currency = currency;
  if (pdf_url !== undefined) updateData.pdf_url = pdf_url;
  if (cover_image !== undefined) updateData.cover_image = cover_image;
  if (category !== undefined) updateData.category = category;
  if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
  if (status !== undefined) updateData.status = status;

  await ebook.update(updateData);

  res.status(200).json({
    success: true,
    message: "E-book updated successfully",
    data: {
      ebook: {
        id: ebook.id,
        title: ebook.title,
        author: ebook.author,
        price: parseFloat(ebook.price || 0),
        status: ebook.status,
      },
    },
  });
});

/**
 * Delete e-book
 * DELETE /api/marketplace/tutor/ebooks/:id
 */
export const deleteEBook = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const ebook = await EBooks.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found", 404);
  }

  // Check if e-book has sales
  if (ebook.sales_count > 0) {
    throw new ErrorClass(
      "Cannot delete e-book with existing sales. Unpublish the e-book instead.",
      400
    );
  }

  await ebook.destroy();

  res.status(200).json({
    success: true,
    message: "E-book deleted successfully",
  });
});

/**
 * Update e-book status (publish/unpublish)
 * PATCH /api/marketplace/tutor/ebooks/:id/status
 */
export const updateEBookStatus = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const tutor = req.tutor;
  const userType = req.user.userType;
  const tutorId = tutor.id;

  if (!["draft", "published"].includes(status)) {
    throw new ErrorClass("Invalid status. Must be 'draft' or 'published'", 400);
  }

  const ownerType = userType === "sole_tutor" ? "sole_tutor" : "organization";
  const ownerId = tutorId;

  const ebook = await EBooks.findOne({
    where: {
      id,
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });

  if (!ebook) {
    throw new ErrorClass("E-book not found", 404);
  }

  // Validation for publishing
  if (status === "published") {
    const price = parseFloat(ebook.price || 0);
    if (price < 0) {
      throw new ErrorClass("Cannot publish e-book with invalid price", 400);
    }
    if (!ebook.pdf_url) {
      throw new ErrorClass("Cannot publish e-book without PDF file", 400);
    }
  }

  await ebook.update({ status });

  res.status(200).json({
    success: true,
    message: `E-book ${status === "published" ? "published" : "unpublished"} successfully`,
    data: {
      ebook: {
        id: ebook.id,
        title: ebook.title,
        status: ebook.status,
      },
    },
  });
});

