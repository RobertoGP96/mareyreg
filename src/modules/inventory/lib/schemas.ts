export const PRODUCT_IMAGE_ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const PRODUCT_IMAGE_ACCEPT_ATTR = PRODUCT_IMAGE_ACCEPTED_MIME.join(",");
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function isProductImageMime(mime: string): boolean {
  return (PRODUCT_IMAGE_ACCEPTED_MIME as readonly string[]).includes(mime);
}
