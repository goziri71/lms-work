import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSession } from "../../models/marketplace/coachingSession.js";
import { CoachingSessionPurchase } from "../../models/marketplace/coachingSessionPurchase.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { Op } from "sequelize";

/**
 * Browse available coaching sessions
 * GET /api/marketplace/coaching/sessions
 * Auth: Student only (or public)
 */
export const browseSessions = TryCatchFunction(async (req, res) => {
  const { category, pricing_type, page = 1, limit = 20, search } = req.query;
  // Optional auth - req.user may be undefined for public browsing
  const studentId = req.user?.userType === "student" ? req.user.id : null;

  const now = new Date();
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

  const where = {
    status: {
      [Op.in]: ["scheduled", "active"], // Only show available sessions
    },
    // Only show sessions that start more than 10 minutes from now (or are already active)
    [Op.or]: [
      {
        start_time: {
          [Op.gt]: tenMinutesFromNow, // Starts more than 10 minutes from now
        },
      },
      {
        status: "active", // Already active sessions can be shown
      },
    ],
  };

  if (category) {
    where.category = category;
  }

  if (pricing_type) {
    where.pricing_type = pricing_type;
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

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
    limit: parseInt(limit),
    offset,
  });

  // Check if student has purchased (if authenticated)
  const purchasedSessionIds = studentId
    ? (
        await CoachingSessionPurchase.findAll({
          where: {
            student_id: studentId,
            session_id: {
              [Op.in]: sessions.map((s) => s.id),
            },
          },
          attributes: ["session_id"],
        })
      ).map((p) => p.session_id)
    : [];

  const tenMinutesInMs = 10 * 60 * 1000;

  res.json({
    success: true,
    data: {
      sessions: sessions.map((s) => {
        const startTime = new Date(s.start_time);
        const timeUntilStart = startTime.getTime() - now.getTime();
        
        // Determine display status
        let displayStatus = s.status;
        let canPurchase = true;
        
        if (s.status === "active") {
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

        return {
          id: s.id,
          title: s.title,
          description: s.description,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_minutes: s.duration_minutes,
          pricing_type: s.pricing_type,
          price: s.price ? parseFloat(s.price) : null,
          currency: s.currency,
          category: s.category,
          image_url: s.image_url,
          tags: s.tags,
          tutor: s.soleTutorOwner
            ? {
                id: s.soleTutorOwner.id,
                name: `${s.soleTutorOwner.fname || ""} ${s.soleTutorOwner.lname || ""}`.trim(),
                type: "sole_tutor",
              }
            : s.organizationOwner
            ? {
                id: s.organizationOwner.id,
                name: s.organizationOwner.name,
                type: "organization",
              }
            : null,
          purchased: studentId ? purchasedSessionIds.includes(s.id) : false,
          status: s.status,
          display_status: displayStatus, // "scheduled", "starting_soon", "in_session", "ended", "cancelled"
          can_purchase: canPurchase && s.pricing_type === "paid" && !(studentId ? purchasedSessionIds.includes(s.id) : false),
        };
      }),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
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
      can_purchase: canPurchase && session.pricing_type === "paid" && !hasPurchased,
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

  const { count, rows: purchases } = await CoachingSessionPurchase.findAndCountAll({
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

