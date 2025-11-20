import { GeneralSetup } from "../../../models/settings/generalSetup.js";
import { ErrorClass } from "../../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../../utils/tryCatch/index.js";
import { logAdminActivity } from "../../../middlewares/adminAuthorize.js";

/**
 * Get system settings
 */
export const getSystemSettings = TryCatchFunction(async (req, res) => {
  let settings = await GeneralSetup.findOne({
    order: [["id", "DESC"]], // Get the latest settings
  });

  // If no settings exist, return defaults
  if (!settings) {
    settings = {
      id: null,
      name: "Western Pinnacle University",
      address: "",
      rate: "1500",
    };
  }

  res.status(200).json({
    success: true,
    message: "System settings retrieved successfully",
    data: {
      settings,
    },
  });
});

/**
 * Update system settings
 */
export const updateSystemSettings = TryCatchFunction(async (req, res) => {
  const { name, address, rate } = req.body;

  // Get existing settings or create new
  let settings = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });

  const oldData = settings
    ? {
        name: settings.name,
        address: settings.address,
        rate: settings.rate,
      }
    : null;

  if (settings) {
    // Update existing
    if (name !== undefined) settings.name = name.trim();
    if (address !== undefined) settings.address = address?.trim() || "";
    if (rate !== undefined) settings.rate = rate.toString();

    await settings.save();
  } else {
    // Create new
    settings = await GeneralSetup.create({
      name: name?.trim() || "Western Pinnacle University",
      address: address?.trim() || "",
      rate: rate?.toString() || "1500",
    });
  }

  // Log activity
  await logAdminActivity(req.admin.id, "updated_system_settings", "settings", settings.id, {
    changes: {
      before: oldData,
      after: {
        name: settings.name,
        address: settings.address,
        rate: settings.rate,
      },
    },
  });

  res.status(200).json({
    success: true,
    message: "System settings updated successfully",
    data: {
      settings,
    },
  });
});

