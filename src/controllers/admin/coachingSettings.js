import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { CoachingSettings } from "../../models/marketplace/coachingSettings.js";

/**
 * Get coaching settings
 * GET /api/admin/coaching/settings
 * Auth: Admin only
 */
export const getSettings = TryCatchFunction(async (req, res) => {
  let settings = await CoachingSettings.findOne();

  if (!settings) {
    // Create default settings if none exist
    settings = await CoachingSettings.create({
      price_per_hour: 10.0,
      currency: "NGN",
      default_duration_minutes: 60,
      warning_threshold_minutes: 10,
      auto_end_enabled: true,
    });
  }

  res.json({
    success: true,
    data: {
      id: settings.id,
      price_per_hour: parseFloat(settings.price_per_hour),
      currency: settings.currency,
      default_duration_minutes: settings.default_duration_minutes,
      warning_threshold_minutes: settings.warning_threshold_minutes,
      auto_end_enabled: settings.auto_end_enabled,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
    },
  });
});

/**
 * Update coaching settings
 * PUT /api/admin/coaching/settings
 * Body: { price_per_hour?, currency?, default_duration_minutes?, warning_threshold_minutes?, auto_end_enabled? }
 * Auth: Admin only
 */
export const updateSettings = TryCatchFunction(async (req, res) => {
  const { price_per_hour, currency, default_duration_minutes, warning_threshold_minutes, auto_end_enabled } =
    req.body;

  let settings = await CoachingSettings.findOne();

  if (!settings) {
    settings = await CoachingSettings.create({
      price_per_hour: price_per_hour || 10.0,
      currency: currency || "NGN",
      default_duration_minutes: default_duration_minutes || 60,
      warning_threshold_minutes: warning_threshold_minutes || 10,
      auto_end_enabled: auto_end_enabled !== undefined ? auto_end_enabled : true,
    });
  } else {
    const updateData = {};
    if (price_per_hour !== undefined) {
      if (price_per_hour < 0) {
        throw new ErrorClass("price_per_hour must be a positive number", 400);
      }
      updateData.price_per_hour = price_per_hour;
    }
    if (currency !== undefined) {
      updateData.currency = currency;
    }
    if (default_duration_minutes !== undefined) {
      if (default_duration_minutes < 1) {
        throw new ErrorClass("default_duration_minutes must be at least 1", 400);
      }
      updateData.default_duration_minutes = default_duration_minutes;
    }
    if (warning_threshold_minutes !== undefined) {
      if (warning_threshold_minutes < 0) {
        throw new ErrorClass("warning_threshold_minutes must be a non-negative number", 400);
      }
      updateData.warning_threshold_minutes = warning_threshold_minutes;
    }
    if (auto_end_enabled !== undefined) {
      updateData.auto_end_enabled = auto_end_enabled;
    }

    await settings.update(updateData);
  }

  res.json({
    success: true,
    message: "Coaching settings updated successfully",
    data: {
      id: settings.id,
      price_per_hour: parseFloat(settings.price_per_hour),
      currency: settings.currency,
      default_duration_minutes: settings.default_duration_minutes,
      warning_threshold_minutes: settings.warning_threshold_minutes,
      auto_end_enabled: settings.auto_end_enabled,
      updated_at: settings.updated_at,
    },
  });
});

