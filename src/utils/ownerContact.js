export function formatOwnerContact(owner, ownerType) {
  if (!owner) return null;
  if (ownerType === "sole_tutor") {
    const name = `${owner.fname || ""} ${owner.lname || ""}`.trim();
    return {
      id: owner.id,
      owner_type: "sole_tutor",
      name: name || null,
      email: owner.email || null,
      phone: owner.phone || null,
      image: owner.profile_image || null,
    };
  }
  return {
    id: owner.id,
    owner_type: "organization",
    name: owner.name || null,
    email: owner.email || null,
    phone: owner.phone || null,
    website: owner.website || null,
    image: owner.logo || null,
  };
}

export const PUBLIC_SOLE_TUTOR_CONTACT_ATTRS = [
  "id",
  "fname",
  "lname",
  "mname",
  "slug",
  "profile_image",
  "bio",
  "specialization",
  "email",
  "phone",
];

export const PUBLIC_ORG_CONTACT_ATTRS = [
  "id",
  "name",
  "slug",
  "logo",
  "description",
  "email",
  "phone",
  "website",
];
