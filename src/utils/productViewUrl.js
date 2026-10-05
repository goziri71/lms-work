import { joinFrontendUrl } from "./frontendUrl.js";

export function productViewPath(type, { id, slug } = {}) {
  const ident = slug || id;
  if (ident == null) return null;
  switch (type) {
    case "course":
      return `courses/${ident}`;
    case "digital_download":
      return `digital-downloads/${ident}`;
    case "ebook":
      return `ebooks/${ident}`;
    case "coaching":
    case "coaching_session":
      return `coaching/sessions/${ident}`;
    case "community":
      return `communities/${ident}`;
    case "membership":
      return `memberships/${ident}`;
    case "event":
      return `events/${ident}`;
    default:
      return `store/${type}/${ident}`;
  }
}

export function productViewUrl(type, product) {
  const path = productViewPath(type, product || {});
  if (!path) return null;
  return {
    view_path: `/${path}`,
    view_url: joinFrontendUrl(process.env.FRONTEND_URL, path),
  };
}

export function attachViewUrl(type, product) {
  if (!product || typeof product !== "object") return product;
  return { ...product, ...productViewUrl(type, product) };
}
