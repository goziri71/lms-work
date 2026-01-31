import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Op, Sequelize } from "sequelize";

/**
 * Browse available coaching sessions
 * GET /api/marketplace/coaching/sessions
 * Auth: Student only (or public)
 */
export const browseSessions = TryCatchFunction(async (req, res) => {
  const { category, pricing_type, page = 1, limit = 20, search } = req.query;
  // Optional auth - req.user may be undefined for public browsing
  const studentId = req.user?.userType === "student" ? req.user?.id : null;

  const now = new Date();
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

  // Base filter: status scheduled/active AND (starts > 10min from now OR already active)
  const where = {
    status: { [Op.in]: ["scheduled", "active"] },
    [Op.or]: [
      { start_time: { [Op.gt]: tenMinutesFromNow } },
      { status: "active" },
    ],
  };

  if (category) {
    where.category = category;
  }

  if (pricing_type) {
    where.pricing_type = pricing_type;
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    const pattern = `%${term.toLowerCase()}%`;
    // Dialect-safe case-insensitive search (works on PostgreSQL and MySQL)
    const searchCondition = {
      [Op.or]: [
        Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("title")), {
          [Op.like]: pattern,
        }),
        Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("description")), {
          [Op.like]: pattern,
        }),
      ],
    };
    where[Op.and] = [
      { status: { [Op.in]: ["scheduled", "active"] } },
      {
        [Op.or]: [
          { start_time: { [Op.gt]: tenMinutesFromNow } },
          { status: "active" },
        ],
      },
      searchCondition,
    ];
    delete where.status;
    delete where[Op.or];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const { count, rows: sessions } = await CoachingSession.findAndCountAll({
    where,
    include: [
      {
        model: SoleTutor,
        as: "soleTutorOwner",
        attributes: ["id", "fname", "lname", "email"],
        required: false,
      },
      {
        model: Organization,
        as: "organizationOwner",
        attributes: ["id", "name", "email"],
        required: false,
      },
    ],
    order: [["start_time", "ASC"]],
    limit: limitNum,
    offset,
  });

  // Check if student has purchased (if authenticated)
  const sessionIds = Array.isArray(sessions)
    ? sessions.map((s) => s.id).filter((id) => id != null)
    : [];
  const purchasedSessionIds =
    studentId && sessionIds.length > 0
      ? (
          await CoachingSessionPurchase.findAll({
            where: {
              student_id: studentId,
              session_id: { [Op.in]: sessionIds },
            },
            attributes: ["session_id"],
          })
        ).map((p) => p.session_id)
      : [];

  const tenMinutesInMs = 10 * 60 * 1000;
  const sessionsList = Array.isArray(sessions) ? sessions : [];

  res.json({
    success: true,
    data: {
      sessions: sessionsList.map((s) => {
        const startTime = s.start_time ? new Date(s.start_time) : null;
        const timeUntilStart =
          startTime && !isNaN(startTime.getTime())
            ? startTime.getTime() - now.getTime()
            : Infinity;

        // Determine display status
        let displayStatus = s.status || "scheduled";
        let canPurchase = true;

        if (s.status === "active") {
          displayStatus = "in_session";
          canPurchase = false;
        } else if (timeUntilStart <= 0) {
          displayStatus = "in_session";
          canPurchase = false;
        } else if (timeUntilStart <= tenMinutesInMs) {
          displayStatus = "starting_soon";
          canPurchase = false;
        }

        const tutorName = s.soleTutorOwner
          ? `${s.soleTutorOwner.fname || ""} ${s.soleTutorOwner.lname || ""}`.trim() ||
            null
          : s.organizationOwner
            ? s.organizationOwner.name || null
            : null;

        return {
          id: s.id,
          title: s.title,
          description: s.description,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_minutes: s.duration_minutes,
          pricing_type: s.pricing_type,
          price: s.price != null ? parseFloat(s.price) : null,
          currency: s.currency,
          category: s.category,
          image_url: s.image_url,
          tags: s.tags || null,
          tutor:
            s.soleTutorOwner || s.organizationOwner
              ? {
                  id: (s.soleTutorOwner || s.organizationOwner).id,
                  name: tutorName,
                  type: s.soleTutorOwner ? "sole_tutor" : "organization",
                }
              : null,
          purchased: studentId ? purchasedSessionIds.includes(s.id) : false,
          status: s.status,
          display_status: displayStatus,
          can_purchase:
            canPurchase &&
            s.pricing_type === "paid" &&
            !(studentId ? purchasedSessionIds.includes(s.id) : false),
        };
      }),
      pagination: {
        total: Number(count) || 0,
        page: pageNum,
        limit: limitNum,
        pages: limitNum > 0 ? Math.ceil((Number(count) || 0) / limitNum) : 0,
      },
    },
  });
});

/**
 * Get session details (Student view)
 * GET /api/marketplace/coaching/sessions/:id
 * Auth: Student only (or public)
 */
export const getSessionDetails = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  // Optional auth - req.user may be undefined for public viewing
  const studentId = req.user?.userType === "student" ? req.user.id : null;

  const session = await CoachingSession.findByPk(id, {
    include: [
      {
        model: SoleTutor,
        as: "soleTutorOwner",
        attributes: ["id", "fname", "lname", "email", "profile_image", "bio"],
        required: false,
      },
      {
        model: Organization,
        as: "organizationOwner",
        attributes: ["id", "name", "email", "logo", "description"],
        required: false,
      },
    ],
  });

  if (!session) {
    throw new ErrorClass("Coaching session not found", 404);
  }

  // Check if student has purchased (if authenticated and session is paid)
  let hasPurchased = false;
  if (studentId && session.pricing_type === "paid") {
    const purchase = await CoachingSessionPurchase.findOne({
      where: {
        session_id: id,
        student_id: studentId,
      },
    });
    hasPurchased = !!purchase;
  }

  // Determine display status and purchase availability
  const now = new Date();
  const startTime = new Date(session.start_time);
  const timeUntilStart = startTime.getTime() - now.getTime();
  const tenMinutesInMs = 10 * 60 * 1000;

  let displayStatus = session.status;
  let canPurchase = true;

  if (session.status === "active") {
    displayStatus = "in_session";
    canPurchase = false;
  } else if (timeUntilStart <= 0) {
    // Session has started but not marked as active yet
    displayStatus = "in_session";
    canPurchase = false;
  } else if (timeUntilStart <= tenMinutesInMs) {
    // Within 10 minutes of start
    displayStatus = "starting_soon";
    canPurchase = false;
  }

  res.json({
    success: true,
    data: {
      id: session.id,
      title: session.title,
      description: session.description,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_minutes: session.duration_minutes,
      pricing_type: session.pricing_type,
      price: session.price ? parseFloat(session.price) : null,
      currency: session.currency,
      category: session.category,
      image_url: session.image_url,
      tags: session.tags,
      status: session.status,
      display_status: displayStatus, // "scheduled", "starting_soon", "in_session", "ended", "cancelled"
      tutor: session.soleTutorOwner
        ? {
            id: session.soleTutorOwner.id,
            name: `${session.soleTutorOwner.fname || ""} ${session.soleTutorOwner.lname || ""}`.trim(),
            email: session.soleTutorOwner.email,
            profile_image: session.soleTutorOwner.profile_image,
            bio: session.soleTutorOwner.bio,
            type: "sole_tutor",
          }
        : session.organizationOwner
          ? {
              id: session.organizationOwner.id,
              name: session.organizationOwner.name,
              email: session.organizationOwner.email,
              logo: session.organizationOwner.logo,
              description: session.organizationOwner.description,
              type: "organization",
            }
          : null,
      has_purchased: hasPurchased,
      can_join: session.pricing_type === "free" || hasPurchased,
      can_purchase:
        canPurchase && session.pricing_type === "paid" && !hasPurchased,
    },
  });
});

/**
 * Get my purchased coaching sessions
 * GET /api/marketplace/coaching/my-sessions
 * Auth: Student only
 */
export const getMySessions = TryCatchFunction(async (req, res) => {
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can view their sessions", 403);
  }

  const { page = 1, limit = 20, status } = req.query;

  const where = {
    student_id: studentId,
  };

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { count, rows: purchases } =
    await CoachingSessionPurchase.findAndCountAll({
      where,
      include: [
        {
          model: CoachingSession,
          as: "coachingSession",
          where: status ? { status } : {},
          include: [
            {
              model: SoleTutor,
              as: "soleTutorOwner",
              attributes: ["id", "fname", "lname", "email"],
              required: false,
            },
            {
              model: Organization,
              as: "organizationOwner",
              attributes: ["id", "name", "email"],
              required: false,
            },
          ],
        },
      ],
      order: [["purchased_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

  res.json({
    success: true,
    data: {
      sessions: purchases.map((p) => ({
        purchase_id: p.id,
        session: p.coachingSession
          ? {
              id: p.coachingSession.id,
              title: p.coachingSession.title,
              description: p.coachingSession.description,
              start_time: p.coachingSession.start_time,
              end_time: p.coachingSession.end_time,
              duration_minutes: p.coachingSession.duration_minutes,
              status: p.coachingSession.status,
              stream_call_id: p.coachingSession.stream_call_id,
              view_link: p.coachingSession.view_link,
              tutor: p.coachingSession.soleTutorOwner
                ? {
                    id: p.coachingSession.soleTutorOwner.id,
                    name: `${p.coachingSession.soleTutorOwner.fname || ""} ${p.coachingSession.soleTutorOwner.lname || ""}`.trim(),
                    type: "sole_tutor",
                  }
                : p.coachingSession.organizationOwner
                  ? {
                      id: p.coachingSession.organizationOwner.id,
                      name: p.coachingSession.organizationOwner.name,
                      type: "organization",
                    }
                  : null,
            }
          : null,
        price_paid: parseFloat(p.price_paid),
        currency: p.currency,
        purchased_at: p.purchased_at,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});
