const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateUniqueAccountName(currencyCode: string): string {
  const code = (currencyCode || "CUR").toUpperCase().replace(/[^A-Z0-9]/g, "") || "CUR";
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const date = `${yy}${mm}${dd}`;

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % ALPHABET.length];

  return `${code}-${date}-${rand}`;
}
