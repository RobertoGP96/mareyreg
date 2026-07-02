import { db } from "@/lib/db";

export type CompanyData = {
  name: string;
  rfc: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  timezone: string;
  currency: string;
  language: string;
};

const DEFAULT_COMPANY: CompanyData = {
  name: "GR Technology",
  rfc: null,
  phone: null,
  address: null,
  description:
    "Plataforma operativa de logística, pacas, inventario y ventas — integrados en un solo sistema.",
  timezone: "America/Mexico_City",
  currency: "MXN",
  language: "es-MX",
};

export async function getCompany(): Promise<CompanyData> {
  const row = await db.company.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_COMPANY;
  return {
    name: row.name,
    rfc: row.rfc,
    phone: row.phone,
    address: row.address,
    description: row.description,
    timezone: row.timezone,
    currency: row.currency,
    language: row.language,
  };
}
