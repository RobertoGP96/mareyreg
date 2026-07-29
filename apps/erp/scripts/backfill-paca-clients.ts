import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

/**
 * Dedupe key: lowercase phone, else lowercase email, else lowercase name.
 * This matches the heuristic used for inline client creation from the form.
 */
function dedupeKey(name: string, phone: string | null, email: string | null) {
  if (phone && phone.trim()) return `p:${phone.trim().toLowerCase()}`;
  if (email && email.trim()) return `e:${email.trim().toLowerCase()}`;
  return `n:${name.trim().toLowerCase()}`;
}

async function main() {
  const [reservations, sales] = await Promise.all([
    db.pacaReservation.findMany({
      where: { clientId: null },
      select: {
        reservationId: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
      },
    }),
    db.pacaSale.findMany({
      where: { clientId: null },
      select: {
        saleId: true,
        clientName: true,
        clientPhone: true,
      },
    }),
  ]);

  console.log(
    `Found ${reservations.length} reservations and ${sales.length} sales without clientId.`
  );

  // Build unique client candidates
  const candidates = new Map<
    string,
    { name: string; phone: string | null; email: string | null }
  >();

  for (const r of reservations) {
    const key = dedupeKey(r.clientName, r.clientPhone, r.clientEmail);
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: r.clientName,
        phone: r.clientPhone,
        email: r.clientEmail,
      });
    }
  }
  for (const s of sales) {
    const key = dedupeKey(s.clientName, s.clientPhone, null);
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: s.clientName,
        phone: s.clientPhone,
        email: null,
      });
    }
  }

  console.log(`Creating ${candidates.size} unique PacaClient rows...`);

  // Create and map to IDs
  const keyToId = new Map<string, number>();
  for (const [key, data] of candidates) {
    // Try to find an existing active client that matches (idempotent re-runs)
    const existing = await db.pacaClient.findFirst({
      where: {
        name: data.name,
        phone: data.phone,
        email: data.email,
      },
      select: { clientId: true },
    });
    if (existing) {
      keyToId.set(key, existing.clientId);
      continue;
    }
    const created = await db.pacaClient.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
      },
      select: { clientId: true },
    });
    keyToId.set(key, created.clientId);
  }

  // Link reservations
  let linkedRes = 0;
  for (const r of reservations) {
    const id = keyToId.get(dedupeKey(r.clientName, r.clientPhone, r.clientEmail));
    if (id != null) {
      await db.pacaReservation.update({
        where: { reservationId: r.reservationId },
        data: { clientId: id },
      });
      linkedRes++;
    }
  }

  // Link sales
  let linkedSales = 0;
  for (const s of sales) {
    const id = keyToId.get(dedupeKey(s.clientName, s.clientPhone, null));
    if (id != null) {
      await db.pacaSale.update({
        where: { saleId: s.saleId },
        data: { clientId: id },
      });
      linkedSales++;
    }
  }

  console.log(
    `Done. Clients created/reused: ${keyToId.size}. Reservations linked: ${linkedRes}. Sales linked: ${linkedSales}.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
