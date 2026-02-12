import crypto from "crypto";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { OrganizationUser } from "../../models/marketplace/organizationUser.js";
import {
  TutorSubscription,
  SUBSCRIPTION_TIERS,
} from "../../models/marketplace/tutorSubscription.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { authService } from "../../service/authservice.js";
import { emailService } from "../../services/emailService.js";
import {
  detectUserCurrency,
  getCurrencyFromCountry,
} from "../../services/currencyService.js";
import { getIPGeolocation } from "../../services/ipGeolocationService.js";
import { EmailLog } from "../../models/email/emailLog.js";

/**
 * Sole Tutor Registration
 */
export const registerSoleTutor = TryCatchFunction(async (req, res) => {
  const {
    email,
    password,
    fname,
    lname,
    mname,
    phone,
    bio,
    specialization,
    qualifications,
    experience_years,
    address,
    country,
  } = req.body;

  if (!email || !password || !fname || !lname) {
    throw new ErrorClass(
      "Email, password, first name, and last name are required",
      400
    );
  }

  // Check if email already exists
  const existingTutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingTutor) {
    throw new ErrorClass("Tutor with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Generate unique slug for public tutor page (from fname + lname)
  const { generateTutorSlug } = await import(
    "../../utils/productSlugHelper.js"
  );
  const slug = await generateTutorSlug(fname.trim(), lname.trim(), null);

  // Auto-detect country and currency from IP if not provided
  let finalCountry = country?.trim() || null;
  let finalCountryCode = null;
  let finalCurrency = "NGN"; // safe fallback

  try {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    const geoData = await getIPGeolocation(clientIp);
    if (geoData.success && geoData.country) {
      if (!finalCountry) finalCountry = geoData.country;
      finalCountryCode = geoData.country_code || null;
      finalCurrency = getCurrencyFromCountry(finalCountry) || "NGN";
    }
  } catch (geoErr) {
    // Geo detection failed - proceed with defaults, don't block registration
    console.warn("Geo detection failed during tutor registration:", geoErr.message);
  }

  // If frontend provided country but geo didn't run, still derive currency
  if (finalCountry && finalCurrency === "NGN" && finalCountry.toLowerCase() !== "nigeria") {
    finalCurrency = getCurrencyFromCountry(finalCountry) || "NGN";
  }

  // Create tutor (auto-approved)
  const tutor = await SoleTutor.create({
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    fname: fname.trim(),
    lname: lname.trim(),
    mname: mname?.trim() || null,
    phone: phone?.trim() || null,
    bio: bio?.trim() || null,
    specialization: specialization?.trim() || null,
    qualifications: qualifications?.trim() || null,
    experience_years: experience_years || 0,
    address: address?.trim() || null,
    country: finalCountry,
    country_code: finalCountryCode,
    currency: finalCurrency,
    local_currency: finalCurrency,
    slug,
    status: "active",
    verification_status: "verified",
  });

  res.status(201).json({
    success: true,
    message:
      "Registration successful! Your account is pending approval. You will be notified once approved.",
    data: {
      tutor: {
        id: tutor.id,
        email: tutor.email,
        fname: tutor.fname,
        lname: tutor.lname,
        status: tutor.status,
      },
    },
  });
});

/**
 * Organization Registration
 */
export const registerOrganization = TryCatchFunction(async (req, res) => {
  const {
    name,
    email,
    password,
    description,
    website,
    phone,
    address,
    country,
    registration_number,
    tax_id,
    contact_person,
    contact_email,
    contact_phone,
  } = req.body;

  if (!name || !email || !password) {
    throw new ErrorClass("Name, email, and password are required", 400);
  }

  // Check if email already exists
  const existingOrg = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (existingOrg) {
    throw new ErrorClass("Organization with this email already exists", 409);
  }

  // Hash password
  const hashedPassword = authService.hashPassword(password);

  // Auto-detect country and currency from IP if not provided
  let finalCountry = country?.trim() || null;
  let finalCountryCode = null;
  let finalCurrency = "NGN"; // safe fallback

  try {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    const geoData = await getIPGeolocation(clientIp);
    if (geoData.success && geoData.country) {
      if (!finalCountry) finalCountry = geoData.country;
      finalCountryCode = geoData.country_code || null;
      finalCurrency = getCurrencyFromCountry(finalCountry) || "NGN";
    }
  } catch (geoErr) {
    console.warn("Geo detection failed during org registration:", geoErr.message);
  }

  // If frontend provided country but geo didn't run, still derive currency
  if (finalCountry && finalCurrency === "NGN" && finalCountry.toLowerCase() !== "nigeria") {
    finalCurrency = getCurrencyFromCountry(finalCountry) || "NGN";
  }

  // Create organization (auto-approved)
  const organization = await Organization.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    description: description?.trim() || null,
    website: website?.trim() || null,
    phone: phone?.trim() || null,
    address: address?.trim() || null,
    country: finalCountry,
    country_code: finalCountryCode,
    currency: finalCurrency,
    local_currency: finalCurrency,
    registration_number: registration_number?.trim() || null,
    tax_id: tax_id?.trim() || null,
    contact_person: contact_person?.trim() || null,
    contact_email: contact_email?.trim() || null,
    contact_phone: contact_phone?.trim() || null,
    status: "active",
    verification_status: "verified",
  });

  res.status(201).json({
    success: true,
    message:
      "Registration successful! Your organization account is pending approval. You will be notified once approved.",
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        status: organization.status,
      },
    },
  });
});

/**
 * Sole Tutor Login
 */
export const soleTutorLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const tutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (!tutor) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check status
  if (tutor.status === "pending") {
    throw new ErrorClass(
      "Your account is pending approval. Please wait for admin approval.",
      403
    );
  }

  if (tutor.status === "rejected") {
    throw new ErrorClass(
      "Your account has been rejected. Please contact support.",
      403
    );
  }

  if (tutor.status === "suspended") {
    throw new ErrorClass(
      "Your account has been suspended. Please contact support.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    tutor.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Detect and update currency if not set
  if (!tutor.currency && tutor.country) {
    const detectedCurrency = getCurrencyFromCountry(tutor.country);
    await tutor.update({
      last_login: new Date(),
      currency: detectedCurrency,
    });
    tutor.currency = detectedCurrency; // Update local object
  } else {
    await tutor.update({ last_login: new Date() });
  }

  // Check and auto-expire subscriptions if needed
  try {
    const { checkSubscriptionExpiration } = await import(
      "./tutorSubscription.js"
    );
    await checkSubscriptionExpiration(tutor.id, "sole_tutor");
  } catch (error) {
    // If subscription tables don't exist, continue without checking
    console.warn("Subscription expiration check failed:", error.message);
  }

  // Get subscription tier
  let subscriptionTier = "free";
  let subscriptionInfo = null;
  try {
    const subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: tutor.id,
        tutor_type: "sole_tutor",
        status: "active",
      },
    });

    if (subscription) {
      subscriptionTier = subscription.subscription_tier;
      const tierInfo =
        SUBSCRIPTION_TIERS[subscriptionTier] || SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: subscriptionTier,
        tier_name: tierInfo.name,
        status: subscription.status,
        unlimited_coaching: subscription.unlimited_coaching,
        courses_limit: subscription.courses_limit,
        communities_limit: subscription.communities_limit,
        digital_downloads_limit: subscription.digital_downloads_limit,
        memberships_limit: subscription.memberships_limit,
      };
    } else {
      // Default free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: "free",
        tier_name: freeTier.name,
        status: "active",
        unlimited_coaching: freeTier.unlimited_coaching,
        courses_limit: freeTier.courses_limit,
        communities_limit: freeTier.communities_limit,
        digital_downloads_limit: freeTier.digital_downloads_limit,
        memberships_limit: freeTier.memberships_limit,
      };
    }
  } catch (error) {
    // If subscription table doesn't exist, use default free tier
    const freeTier = SUBSCRIPTION_TIERS.free;
    subscriptionInfo = {
      tier: "free",
      tier_name: freeTier.name,
      status: "active",
      unlimited_coaching: freeTier.unlimited_coaching,
      courses_limit: freeTier.courses_limit,
      communities_limit: freeTier.communities_limit,
      digital_downloads_limit: freeTier.digital_downloads_limit,
      memberships_limit: freeTier.memberships_limit,
    };
  }

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: tutor.id,
    userType: "sole_tutor",
    email: tutor.email,
    firstName: tutor.fname,
    lastName: tutor.lname,
    status: tutor.status,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      tutor: {
        id: tutor.id,
        fname: tutor.fname,
        lname: tutor.lname,
        email: tutor.email,
        status: tutor.status,
        wallet_balance: tutor.wallet_balance,
        rating: tutor.rating,
      },
      subscription: subscriptionInfo,
      accessToken,
      userType: "sole_tutor",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Organization Login
 */
export const organizationLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const organization = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (!organization) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check status
  if (organization.status === "pending") {
    throw new ErrorClass(
      "Your organization account is pending approval. Please wait for admin approval.",
      403
    );
  }

  if (organization.status === "rejected") {
    throw new ErrorClass(
      "Your organization account has been rejected. Please contact support.",
      403
    );
  }

  if (organization.status === "suspended") {
    throw new ErrorClass(
      "Your organization account has been suspended. Please contact support.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    organization.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Detect and update currency if not set
  if (!organization.currency && organization.country) {
    const detectedCurrency = getCurrencyFromCountry(organization.country);
    await organization.update({
      last_login: new Date(),
      currency: detectedCurrency,
    });
    organization.currency = detectedCurrency; // Update local object
  } else {
    await organization.update({ last_login: new Date() });
  }

  // Check and auto-expire subscriptions if needed
  try {
    const { checkSubscriptionExpiration } = await import(
      "./tutorSubscription.js"
    );
    await checkSubscriptionExpiration(organization.id, "organization");
  } catch (error) {
    // If subscription tables don't exist, continue without checking
    console.warn("Subscription expiration check failed:", error.message);
  }

  // Get subscription tier
  let subscriptionInfo = null;
  try {
    const subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: organization.id,
        tutor_type: "organization",
        status: "active",
      },
    });

    if (subscription) {
      const tierInfo =
        SUBSCRIPTION_TIERS[subscription.subscription_tier] ||
        SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: subscription.subscription_tier,
        tier_name: tierInfo.name,
        status: subscription.status,
        unlimited_coaching: subscription.unlimited_coaching,
        courses_limit: subscription.courses_limit,
        communities_limit: subscription.communities_limit,
        digital_downloads_limit: subscription.digital_downloads_limit,
        memberships_limit: subscription.memberships_limit,
      };
    } else {
      // Default free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: "free",
        tier_name: freeTier.name,
        status: "active",
        unlimited_coaching: freeTier.unlimited_coaching,
        courses_limit: freeTier.courses_limit,
        communities_limit: freeTier.communities_limit,
        digital_downloads_limit: freeTier.digital_downloads_limit,
        memberships_limit: freeTier.memberships_limit,
      };
    }
  } catch (error) {
    // If subscription table doesn't exist, use default free tier
    const freeTier = SUBSCRIPTION_TIERS.free;
    subscriptionInfo = {
      tier: "free",
      tier_name: freeTier.name,
      status: "active",
      unlimited_coaching: freeTier.unlimited_coaching,
      courses_limit: freeTier.courses_limit,
      communities_limit: freeTier.communities_limit,
      digital_downloads_limit: freeTier.digital_downloads_limit,
      memberships_limit: freeTier.memberships_limit,
    };
  }

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: organization.id,
    userType: "organization",
    email: organization.email,
    name: organization.name,
    status: organization.status,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        email: organization.email,
        status: organization.status,
        wallet_balance: organization.wallet_balance,
        rating: organization.rating,
        country: organization.country,
        currency:
          organization.currency ||
          getCurrencyFromCountry(organization.country || "USD"),
      },
      subscription: subscriptionInfo,
      accessToken,
      userType: "organization",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Organization User Login
 */
export const organizationUserLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  const orgUser = await OrganizationUser.findOne({
    where: { email: email.toLowerCase() },
    include: [
      {
        model: Organization,
        as: "organization",
        attributes: ["id", "name", "status"],
      },
    ],
  });

  if (!orgUser) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Check organization status
  if (orgUser.organization.status !== "active") {
    throw new ErrorClass(
      "Your organization account is not active. Please contact your organization admin.",
      403
    );
  }

  // Check user status
  if (orgUser.status === "suspended") {
    throw new ErrorClass(
      "Your account has been suspended. Please contact your organization admin.",
      403
    );
  }

  if (orgUser.status === "inactive") {
    throw new ErrorClass(
      "Your account is inactive. Please contact your organization admin.",
      403
    );
  }

  // Verify password
  const isPasswordValid = await authService.comparePassword(
    password,
    orgUser.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Update last login
  await orgUser.update({ last_login: new Date() });

  // Get subscription tier (for the organization)
  let subscriptionInfo = null;
  try {
    const subscription = await TutorSubscription.findOne({
      where: {
        tutor_id: orgUser.organization_id,
        tutor_type: "organization",
        status: "active",
      },
    });

    if (subscription) {
      const tierInfo =
        SUBSCRIPTION_TIERS[subscription.subscription_tier] ||
        SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: subscription.subscription_tier,
        tier_name: tierInfo.name,
        status: subscription.status,
        unlimited_coaching: subscription.unlimited_coaching,
        courses_limit: subscription.courses_limit,
        communities_limit: subscription.communities_limit,
        digital_downloads_limit: subscription.digital_downloads_limit,
        memberships_limit: subscription.memberships_limit,
      };
    } else {
      // Default free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: "free",
        tier_name: freeTier.name,
        status: "active",
        unlimited_coaching: freeTier.unlimited_coaching,
        courses_limit: freeTier.courses_limit,
        communities_limit: freeTier.communities_limit,
        digital_downloads_limit: freeTier.digital_downloads_limit,
        memberships_limit: freeTier.memberships_limit,
      };
    }
  } catch (error) {
    // If subscription table doesn't exist, use default free tier
    const freeTier = SUBSCRIPTION_TIERS.free;
    subscriptionInfo = {
      tier: "free",
      tier_name: freeTier.name,
      status: "active",
      unlimited_coaching: freeTier.unlimited_coaching,
      courses_limit: freeTier.courses_limit,
      communities_limit: freeTier.communities_limit,
      digital_downloads_limit: freeTier.digital_downloads_limit,
      memberships_limit: freeTier.memberships_limit,
    };
  }

  // Generate JWT token
  const accessToken = await authService.generateAccessToken({
    id: orgUser.id,
    organizationId: orgUser.organization_id,
    userType: "organization_user",
    role: orgUser.role,
    email: orgUser.email,
    firstName: orgUser.fname,
    lastName: orgUser.lname,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: orgUser.id,
        fname: orgUser.fname,
        lname: orgUser.lname,
        email: orgUser.email,
        role: orgUser.role,
        organization: {
          id: orgUser.organization.id,
          name: orgUser.organization.name,
        },
      },
      subscription: subscriptionInfo,
      accessToken,
      userType: "organization_user",
      expiresIn: 14400, // 4 hours
    },
  });
});

/**
 * Unified Login - Auto-detects Sole Tutor or Organization
 */
export const unifiedTutorLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  // Try to find in SoleTutor table first
  let tutor = await SoleTutor.findOne({
    where: { email: email.toLowerCase() },
  });

  if (tutor) {
    // Check status
    if (tutor.status === "pending") {
      throw new ErrorClass(
        "Your account is pending approval. Please wait for admin approval.",
        403
      );
    }

    if (tutor.status === "rejected") {
      throw new ErrorClass(
        "Your account has been rejected. Please contact support.",
        403
      );
    }

    if (tutor.status === "suspended") {
      throw new ErrorClass(
        "Your account has been suspended. Please contact support.",
        403
      );
    }

    // Verify password
    const isPasswordValid = await authService.comparePassword(
      password,
      tutor.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update last login
    await tutor.update({ last_login: new Date() });

    // Check and auto-expire subscriptions if needed
    try {
      const { checkSubscriptionExpiration } = await import(
        "./tutorSubscription.js"
      );
      await checkSubscriptionExpiration(tutor.id, "sole_tutor");
    } catch (error) {
      // If subscription tables don't exist, continue without checking
      console.warn("Subscription expiration check failed:", error.message);
    }

    // Get subscription tier
    let subscriptionInfo = null;
    try {
      const subscription = await TutorSubscription.findOne({
        where: {
          tutor_id: tutor.id,
          tutor_type: "sole_tutor",
          status: "active",
        },
      });

      if (subscription) {
        const tierInfo =
          SUBSCRIPTION_TIERS[subscription.subscription_tier] ||
          SUBSCRIPTION_TIERS.free;
        subscriptionInfo = {
          tier: subscription.subscription_tier,
          tier_name: tierInfo.name,
          status: subscription.status,
          unlimited_coaching: subscription.unlimited_coaching,
          courses_limit: subscription.courses_limit,
          communities_limit: subscription.communities_limit,
          digital_downloads_limit: subscription.digital_downloads_limit,
          memberships_limit: subscription.memberships_limit,
        };
      } else {
        // Default free tier
        const freeTier = SUBSCRIPTION_TIERS.free;
        subscriptionInfo = {
          tier: "free",
          tier_name: freeTier.name,
          status: "active",
          unlimited_coaching: freeTier.unlimited_coaching,
          courses_limit: freeTier.courses_limit,
          communities_limit: freeTier.communities_limit,
          digital_downloads_limit: freeTier.digital_downloads_limit,
          memberships_limit: freeTier.memberships_limit,
        };
      }
    } catch (error) {
      // If subscription table doesn't exist, use default free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: "free",
        tier_name: freeTier.name,
        status: "active",
        unlimited_coaching: freeTier.unlimited_coaching,
        courses_limit: freeTier.courses_limit,
        communities_limit: freeTier.communities_limit,
        digital_downloads_limit: freeTier.digital_downloads_limit,
        memberships_limit: freeTier.memberships_limit,
      };
    }

    // Generate JWT token
    const accessToken = await authService.generateAccessToken({
      id: tutor.id,
      userType: "sole_tutor",
      email: tutor.email,
      firstName: tutor.fname,
      lastName: tutor.lname,
      status: tutor.status,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        tutor: {
          id: tutor.id,
          fname: tutor.fname,
          lname: tutor.lname,
          email: tutor.email,
          status: tutor.status,
          wallet_balance: tutor.wallet_balance,
          rating: tutor.rating,
        },
        subscription: subscriptionInfo,
        accessToken,
        userType: "sole_tutor",
        expiresIn: 14400, // 4 hours
      },
    });
  }

  // If not found in SoleTutor, try Organization
  const organization = await Organization.findOne({
    where: { email: email.toLowerCase() },
  });

  if (organization) {
    // Check status
    if (organization.status === "pending") {
      throw new ErrorClass(
        "Your organization account is pending approval. Please wait for admin approval.",
        403
      );
    }

    if (organization.status === "rejected") {
      throw new ErrorClass(
        "Your organization account has been rejected. Please contact support.",
        403
      );
    }

    if (organization.status === "suspended") {
      throw new ErrorClass(
        "Your organization account has been suspended. Please contact support.",
        403
      );
    }

    // Verify password
    const isPasswordValid = await authService.comparePassword(
      password,
      organization.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update last login
    await organization.update({ last_login: new Date() });

    // Check and auto-expire subscriptions if needed
    try {
      const { checkSubscriptionExpiration } = await import(
        "./tutorSubscription.js"
      );
      await checkSubscriptionExpiration(organization.id, "organization");
    } catch (error) {
      // If subscription tables don't exist, continue without checking
      console.warn("Subscription expiration check failed:", error.message);
    }

    // Get subscription tier
    let subscriptionInfo = null;
    try {
      const subscription = await TutorSubscription.findOne({
        where: {
          tutor_id: organization.id,
          tutor_type: "organization",
          status: "active",
        },
      });

      if (subscription) {
        const tierInfo =
          SUBSCRIPTION_TIERS[subscription.subscription_tier] ||
          SUBSCRIPTION_TIERS.free;
        subscriptionInfo = {
          tier: subscription.subscription_tier,
          tier_name: tierInfo.name,
          status: subscription.status,
          unlimited_coaching: subscription.unlimited_coaching,
          courses_limit: subscription.courses_limit,
          communities_limit: subscription.communities_limit,
          digital_downloads_limit: subscription.digital_downloads_limit,
          memberships_limit: subscription.memberships_limit,
        };
      } else {
        // Default free tier
        const freeTier = SUBSCRIPTION_TIERS.free;
        subscriptionInfo = {
          tier: "free",
          tier_name: freeTier.name,
          status: "active",
          unlimited_coaching: freeTier.unlimited_coaching,
          courses_limit: freeTier.courses_limit,
          communities_limit: freeTier.communities_limit,
          digital_downloads_limit: freeTier.digital_downloads_limit,
          memberships_limit: freeTier.memberships_limit,
        };
      }
    } catch (error) {
      // If subscription table doesn't exist, use default free tier
      const freeTier = SUBSCRIPTION_TIERS.free;
      subscriptionInfo = {
        tier: "free",
        tier_name: freeTier.name,
        status: "active",
        unlimited_coaching: freeTier.unlimited_coaching,
        courses_limit: freeTier.courses_limit,
        communities_limit: freeTier.communities_limit,
        digital_downloads_limit: freeTier.digital_downloads_limit,
        memberships_limit: freeTier.memberships_limit,
      };
    }

    // Generate JWT token
    const accessToken = await authService.generateAccessToken({
      id: organization.id,
      userType: "organization",
      email: organization.email,
      name: organization.name,
      status: organization.status,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          email: organization.email,
          status: organization.status,
          wallet_balance: organization.wallet_balance,
          rating: organization.rating,
        },
        subscription: subscriptionInfo,
        accessToken,
        userType: "organization",
        expiresIn: 14400, // 4 hours
      },
    });
  }

  // If not found in either table, return generic error
  throw new ErrorClass("Invalid email or password", 401);
});

/**
 * Helper: send tutor password reset email and log to EmailLog
 */
async function sendTutorPasswordResetEmailAndLog(
  account,
  resetToken,
  resetUrl,
  accountType
) {
  const recipientEmail = account.email;
  const recipientName =
    accountType === "sole_tutor"
      ? `${account.fname || ""} ${account.lname || ""}`.trim()
      : account.name || "Organization";
  const subject = "Password Reset Request - Knomada";

  let result;
  try {
    result = await emailService.sendPasswordResetEmail(
      { email: recipientEmail, name: recipientName },
      resetToken,
      resetUrl
    );
  } catch (error) {
    console.error("❌ Error sending tutor password reset email:", {
      email: recipientEmail,
      error: error.message,
      stack: error.stack,
    });
    result = { success: false, message: error.message, error: error.message };
  }

  if (!result || !result.success) {
    console.error("❌ Password reset email failed to send:", {
      email: recipientEmail,
      error: result?.message || "Unknown error",
      details: result?.error,
    });
  } else {
    console.log(
      `✅ Password reset email sent successfully to ${recipientEmail}`
    );
  }

  try {
    await EmailLog.create({
      user_id: account.id,
      user_type: "other",
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      email_type: "password_reset",
      subject,
      status: result?.success ? "sent" : "failed",
      error_message: result?.success
        ? null
        : result?.message || (result?.error && String(result.error)),
      sent_at: result?.success ? new Date() : null,
      metadata: result?.success
        ? null
        : { accountType, error_details: result?.error },
    });
  } catch (logErr) {
    console.error(
      "Failed to log tutor password reset email to EmailLog:",
      logErr.message
    );
  }

  return result;
}

/**
 * Request Password Reset - Sole Tutor
 */
export const requestPasswordResetSoleTutor = TryCatchFunction(
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ErrorClass("Email is required", 400);
    }

    const tutor = await SoleTutor.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!tutor) {
      return res.status(200).json({
        success: true,
        message: "If the email exists, a password reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await tutor.update({
      password_reset_token: hashedToken,
    });

    const resetUrl = `${
      process.env.FRONTEND_URL || "https://app.knomada.co"
    }/reset-password?token=${resetToken}&type=sole_tutor`;

    await sendTutorPasswordResetEmailAndLog(
      tutor,
      resetToken,
      resetUrl,
      "sole_tutor"
    );

    res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }
);

/**
 * Request Password Reset - Organization
 */
export const requestPasswordResetOrganization = TryCatchFunction(
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ErrorClass("Email is required", 400);
    }

    const organization = await Organization.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!organization) {
      return res.status(200).json({
        success: true,
        message: "If the email exists, a password reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await organization.update({
      password_reset_token: hashedToken,
    });

    const resetUrl = `${
      process.env.FRONTEND_URL || "https://app.knomada.co"
    }/reset-password?token=${resetToken}&type=organization`;

    await sendTutorPasswordResetEmailAndLog(
      organization,
      resetToken,
      resetUrl,
      "organization"
    );

    res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }
);

/**
 * Request Password Reset - Tutor (unified: sole tutor OR organization)
 * Use this when the user might be either type; checks both and sends one email.
 * POST /api/marketplace/password/reset-request  body: { email }
 */
export const requestPasswordResetTutor = TryCatchFunction(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ErrorClass("Email is required", 400);
  }

  const normalizedEmail = email.toLowerCase();

  const [soleTutor, organization] = await Promise.all([
    SoleTutor.findOne({ where: { email: normalizedEmail } }),
    Organization.findOne({ where: { email: normalizedEmail } }),
  ]);

  if (!soleTutor && !organization) {
    return res.status(200).json({
      success: true,
      message: "If the email exists, a password reset link has been sent.",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const frontendUrl = process.env.FRONTEND_URL || "https://app.knomada.co";

  if (soleTutor) {
    await soleTutor.update({ password_reset_token: hashedToken });
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&type=sole_tutor`;
    await sendTutorPasswordResetEmailAndLog(
      soleTutor,
      resetToken,
      resetUrl,
      "sole_tutor"
    );
  } else {
    await organization.update({ password_reset_token: hashedToken });
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&type=organization`;
    await sendTutorPasswordResetEmailAndLog(
      organization,
      resetToken,
      resetUrl,
      "organization"
    );
  }

  res.status(200).json({
    success: true,
    message: "If the email exists, a password reset link has been sent.",
  });
});

/**
 * Reset Password - Sole Tutor
 */
export const resetPasswordSoleTutor = TryCatchFunction(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ErrorClass("Token and new password are required", 400);
  }

  // Hash the token from URL
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find tutor with this token
  const tutor = await SoleTutor.findOne({
    where: { password_reset_token: hashedToken },
  });

  if (!tutor) {
    throw new ErrorClass(
      "Invalid or expired reset token. Please request a new password reset.",
      400
    );
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  // Update password and clear token
  await tutor.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  res.status(200).json({
    success: true,
    message:
      "Password has been reset successfully. You can now login with your new password.",
  });
});

/**
 * Reset Password - Organization
 */
export const resetPasswordOrganization = TryCatchFunction(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ErrorClass("Token and new password are required", 400);
  }

  // Hash the token from URL
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find organization with this token
  const organization = await Organization.findOne({
    where: { password_reset_token: hashedToken },
  });

  if (!organization) {
    throw new ErrorClass(
      "Invalid or expired reset token. Please request a new password reset.",
      400
    );
  }

  // Hash new password
  const hashedPassword = authService.hashPassword(newPassword);

  // Update password and clear token
  await organization.update({
    password: hashedPassword,
    password_reset_token: null,
  });

  res.status(200).json({
    success: true,
    message:
      "Password has been reset successfully. You can now login with your new password.",
  });
});

/**
 * Tutor Logout
 * POST /api/marketplace/logout
 *
 * Since we're using stateless JWT tokens, logout is primarily handled client-side
 * by removing the token from storage. This endpoint provides a consistent API
 * for logout operations and can be used for future activity logging if needed.
 */
export const tutorLogout = TryCatchFunction(async (req, res) => {
  // Since we're using stateless JWT tokens, logout is handled client-side
  // by simply removing the token from storage
  // Future: Could add activity logging here if needed

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});
