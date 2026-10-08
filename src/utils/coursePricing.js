export function getProductSalePricing(product) {
  const listPrice = parseFloat(product?.price || 0) || 0;
  const percent = parseFloat(product?.discount_percent || 0) || 0;
  const now = new Date();
  const starts = product?.discount_starts_at
    ? new Date(product.discount_starts_at)
    : null;
  const ends = product?.discount_ends_at
    ? new Date(product.discount_ends_at)
    : null;
  const startsOk = !starts || Number.isNaN(starts.getTime()) || now >= starts;
  const endsOk = !ends || Number.isNaN(ends.getTime()) || now <= ends;
  const active = percent > 0 && percent <= 100 && startsOk && endsOk && listPrice > 0;
  const salePrice = active
    ? Math.round(listPrice * (1 - percent / 100) * 100) / 100
    : listPrice;

  let salePriceUsd = null;
  const listUsd =
    product?.price_usd != null ? parseFloat(product.price_usd) : null;
  if (listUsd != null && !Number.isNaN(listUsd)) {
    salePriceUsd = active
      ? Math.round(listUsd * (1 - percent / 100) * 100) / 100
      : listUsd;
  }

  return {
    list_price: listPrice.toFixed(2),
    sale_price: salePrice.toFixed(2),
    discount_percent: active ? percent : 0,
    discount_active: active,
    discount_starts_at: product?.discount_starts_at || null,
    discount_ends_at: product?.discount_ends_at || null,
    currency: (product?.currency || "NGN").toUpperCase(),
    list_price_usd: listUsd != null && !Number.isNaN(listUsd) ? listUsd.toFixed(2) : null,
    sale_price_usd: salePriceUsd != null ? salePriceUsd.toFixed(2) : null,
  };
}

export function getCourseSalePricing(course) {
  return getProductSalePricing(course);
}

export function getDigitalSalePricing(download) {
  return getProductSalePricing(download);
}

export function attachCoursePricing(courseData) {
  const pricing = getCourseSalePricing(courseData);
  return {
    ...courseData,
    price: parseFloat(pricing.sale_price),
    list_price: parseFloat(pricing.list_price),
    ...pricing,
  };
}

export function attachDigitalPricing(downloadData) {
  const pricing = getDigitalSalePricing(downloadData);
  return {
    ...downloadData,
    price: parseFloat(pricing.sale_price),
    list_price: parseFloat(pricing.list_price),
    ...pricing,
  };
}

export function parseDiscountPercent(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(value);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new Error("discount_percent must be between 0 and 100");
  }
  return n;
}
