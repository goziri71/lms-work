/**
 * WPU / Pinnacle migrated book catalog (read-only list + pdf_url).
 * Staff (lecturers) see books only for courses they teach; students only for enrolled courses.
 * Admins see the full catalog.
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { WpuBookUpload, buildWpuBookPdfUrl } from "../../models/wpu/wpuBookUpload.js";
import { Courses } from "../../models/course/courses.js";
import { CourseReg } from "../../models/course_reg.js";
import { Op, Sequelize } from "sequelize";

/**
 * Normalize course / book codes so "GNS 101", "GNS101", "gns-101" compare equal.
 */
function normalizeCourseCodeKey(s) {
  if (s == null || s === "") return "";
  return String(s)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * @returns {Promise<null|string[]>} null = no scope (full list); [] = no access; non-empty = filter by keys
 */
async function getScopedBookCodeKeys(user) {
  const userType = user?.userType;
  const userId = Number(user?.id);

  if (userType === "admin" || userType === "super_admin") {
    return null;
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
  }

  if (userType === "staff") {
    const courses = await Courses.findAll({
      where: { staff_id: userId },
      attributes: ["course_code"],
      raw: true,
    });
    const keys = new Set();
    for (const c of courses) {
      const k = normalizeCourseCodeKey(c.course_code);
      if (k) keys.add(k);
    }
    return [...keys];
  }

  if (userType === "student") {
    const rows = await CourseReg.findAll({
      where: {
        student_id: userId,
        [Op.or]: [
          { registration_status: { [Op.is]: null } },
          { registration_status: { [Op.ne]: "cancelled" } },
        ],
      },
      include: [
        {
          model: Courses,
          as: "course",
          attributes: ["course_code"],
          required: true,
        },
      ],
    });
    const keys = new Set();
    for (const row of rows) {
      const code = row.course?.course_code;
      const k = normalizeCourseCodeKey(code);
      if (k) keys.add(k);
    }
    return [...keys];
  }

  return [];
}

/** Uses Sequelize col so the correct table alias is applied in SQL. */
function buildScopeWhere(codeKeys) {
  if (!codeKeys || codeKeys.length === 0) return null;
  return Sequelize.where(
    Sequelize.fn(
      "regexp_replace",
      Sequelize.fn("upper", Sequelize.fn("trim", Sequelize.col("book_no"))),
      "[^A-Z0-9]",
      "",
      "g"
    ),
    { [Op.in]: codeKeys }
  );
}

export const listWpuBooks = TryCatchFunction(async (req, res) => {
  const {
    book_no,
    course_level,
    course_semester,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  const scopedKeys = await getScopedBookCodeKeys(req.user);
  if (scopedKeys && scopedKeys.length === 0) {
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    return res.json({
      success: true,
      data: {
        books: [],
        pagination: {
          total: 0,
          page: parseInt(page, 10) || 1,
          limit: lim,
          totalPages: 0,
        },
      },
    });
  }

  const scopeWhere = scopedKeys ? buildScopeWhere(scopedKeys) : null;

  const parts = [{ type: "book" }];
  if (scopeWhere) {
    parts.push(scopeWhere);
  }
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

  const lim = Math.min(parseInt(limit, 10) || 50, 200);
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
