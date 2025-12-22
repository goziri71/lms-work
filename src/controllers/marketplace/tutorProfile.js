import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";

/**
 * Get tutor profile
 * GET /api/marketplace/tutor/profile
 */
export const getProfile = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;

  // Exclude sensitive data
  const profileData = {
    id: tutor.id,
    email: tutor.email,
    status: tutor.status,
    verification_status: tutor.verification_status,
    wallet_balance: parseFloat(tutor.wallet_balance || 0),
    total_earnings: parseFloat(tutor.total_earnings || 0),
    total_payouts: parseFloat(tutor.total_payouts || 0),
    commission_rate: parseFloat(tutor.commission_rate || 15),
    rating: tutor.rating ? parseFloat(tutor.rating) : null,
    total_reviews: tutor.total_reviews || 0,
    last_login: tutor.last_login,
    created_at: tutor.created_at,
    updated_at: tutor.updated_at,
  };

  if (userType === "sole_tutor") {
    profileData.fname = tutor.fname;
    profileData.lname = tutor.lname;
    profileData.mname = tutor.mname;
    profileData.phone = tutor.phone;
    profileData.bio = tutor.bio;
    profileData.specialization = tutor.specialization;
    profileData.qualifications = tutor.qualifications;
    profileData.experience_years = tutor.experience_years;
    profileData.address = tutor.address;
    profileData.country = tutor.country;
    profileData.timezone = tutor.timezone;
    profileData.profile_image = tutor.profile_image;
  } else if (userType === "organization") {
    profileData.name = tutor.name;
    profileData.description = tutor.description;
    profileData.website = tutor.website;
    profileData.logo = tutor.logo;
    profileData.phone = tutor.phone;
    profileData.address = tutor.address;
    profileData.country = tutor.country;
    profileData.registration_number = tutor.registration_number;
    profileData.tax_id = tutor.tax_id;
    profileData.contact_person = tutor.contact_person;
    profileData.contact_email = tutor.contact_email;
    profileData.contact_phone = tutor.contact_phone;
  }

  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      profile: profileData,
    },
  });
});

/**
 * Update tutor profile
 * PUT /api/marketplace/tutor/profile
 */
export const updateProfile = TryCatchFunction(async (req, res) => {
  const tutor = req.tutor;
  const userType = req.user.userType;

  const updateData = {};

  if (userType === "sole_tutor") {
    const {
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
      timezone,
      profile_image,
    } = req.body;

    if (fname !== undefined) updateData.fname = fname?.trim();
    if (lname !== undefined) updateData.lname = lname?.trim();
    if (mname !== undefined) updateData.mname = mname?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;
    if (specialization !== undefined) updateData.specialization = specialization?.trim() || null;
    if (qualifications !== undefined) updateData.qualifications = qualifications?.trim() || null;
    if (experience_years !== undefined) updateData.experience_years = experience_years || 0;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (country !== undefined) updateData.country = country?.trim() || null;
    if (timezone !== undefined) updateData.timezone = timezone?.trim() || "UTC";
    if (profile_image !== undefined) updateData.profile_image = profile_image || null;

    // Validation
    if (fname !== undefined && !fname) {
      throw new ErrorClass("First name is required", 400);
    }
    if (lname !== undefined && !lname) {
      throw new ErrorClass("Last name is required", 400);
    }
  } else if (userType === "organization") {
    const {
      name,
      description,
      website,
      logo,
      phone,
      address,
      country,
      registration_number,
      tax_id,
      contact_person,
      contact_email,
      contact_phone,
    } = req.body;

    if (name !== undefined) updateData.name = name?.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (logo !== undefined) updateData.logo = logo || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (country !== undefined) updateData.country = country?.trim() || null;
    if (registration_number !== undefined) updateData.registration_number = registration_number?.trim() || null;
    if (tax_id !== undefined) updateData.tax_id = tax_id?.trim() || null;
    if (contact_person !== undefined) updateData.contact_person = contact_person?.trim() || null;
    if (contact_email !== undefined) updateData.contact_email = contact_email?.trim() || null;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone?.trim() || null;

    // Validation
    if (name !== undefined && !name) {
      throw new ErrorClass("Organization name is required", 400);
    }
  }

  await tutor.update(updateData);

  // Reload tutor to get updated data
  await tutor.reload();

  const profileData = {
    id: tutor.id,
    email: tutor.email,
    status: tutor.status,
    wallet_balance: parseFloat(tutor.wallet_balance || 0),
    total_earnings: parseFloat(tutor.total_earnings || 0),
    rating: tutor.rating ? parseFloat(tutor.rating) : null,
  };

  if (userType === "sole_tutor") {
    profileData.fname = tutor.fname;
    profileData.lname = tutor.lname;
    profileData.mname = tutor.mname;
    profileData.phone = tutor.phone;
    profileData.bio = tutor.bio;
    profileData.specialization = tutor.specialization;
    profileData.profile_image = tutor.profile_image;
  } else if (userType === "organization") {
    profileData.name = tutor.name;
    profileData.description = tutor.description;
    profileData.logo = tutor.logo;
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      profile: profileData,
    },
  });
});

