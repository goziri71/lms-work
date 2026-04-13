/**
 * WPU / Pinnacle migrated book catalog (read-only list + pdf_url).
 * Returns the full catalog for any authenticated user (paginated).
 * Optional query filters: book_no, course_level, course_semester, search, page, limit.
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import {
  WpuBookUpload,
  buildWpuBookPdfUrl,
} from "../../models/wpu/wpuBookUpload.js";
import { Op } from "sequelize";

export const listWpuBooks = TryCatchFunction(async (req, res) => {
  const {
    book_no,
    course_level,
    course_semester,
    search,
    page = 1,
    limit = 20,
  } = req.query;

  const parts = [{ type: "book" }];
  if (book_no) {
    parts.push({
      book_no: { [Op.iLike]: `%${String(book_no).trim()}%` },
    });
  }
  if (course_level) {
    parts.push({ course_level: String(course_level).trim() });
  }
  if (course_semester) {
    parts.push({
      course_semester: { [Op.iLike]: `%${String(course_semester).trim()}%` },
    });
  }
  if (search) {
    const q = `%${String(search).trim()}%`;
    parts.push({
      [Op.or]: [
        { title: { [Op.iLike]: q } },
        { book_no: { [Op.iLike]: q } },
        { file: { [Op.iLike]: q } },
      ],
    });
  }

  const where = parts.length === 1 ? parts[0] : { [Op.and]: parts };

  const lim = Math.min(parseInt(limit, 10) || 20, 200);
  const off = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

  const { count, rows } = await WpuBookUpload.findAndCountAll({
    where,
    order: [
      ["course_level", "ASC NULLS LAST"],
      ["book_no", "ASC NULLS LAST"],
      ["id", "ASC"],
    ],
    limit: lim,
    offset: off,
  });

  const books = rows.map((r) => {
    const j = r.toJSON();
    return {
      ...j,
      pdf_url: buildWpuBookPdfUrl(j.file),
    };
  });

  res.json({
    success: true,
    data: {
      books,
      pagination: {
        total: count,
        page: parseInt(page, 10) || 1,
        limit: lim,
        totalPages: Math.ceil(count / lim) || 0,
      },
    },
  });
});
