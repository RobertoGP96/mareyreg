import { db } from "@/lib/db";

const ORDER_HISTORY_LIMIT = 50;

export async function listWebstoreCustomers() {
  const customers = await db.customer.findMany({
    where: { source: "webstore" },
    include: {
      _count: { select: { salesOrders: true } },
      salesOrders: {
        orderBy: { orderDate: "desc" },
        take: 1,
        select: { orderDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return customers.map((c) => ({
    customerId: c.customerId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    isActive: c.isActive,
    currentBalance: Number(c.currentBalance),
    version: c.version,
    createdAt: c.createdAt,
    ordersCount: c._count.salesOrders,
    lastOrderAt: c.salesOrders[0]?.orderDate ?? null,
  }));
}

export async function getWebstoreCustomerKpis() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, active, newThisMonth, withOrders] = await Promise.all([
    db.customer.count({ where: { source: "webstore" } }),
    db.customer.count({ where: { source: "webstore", isActive: true } }),
    db.customer.count({
      where: { source: "webstore", createdAt: { gte: startOfMonth } },
    }),
    db.customer.count({
      where: { source: "webstore", salesOrders: { some: {} } },
    }),
  ]);

  return { total, active, newThisMonth, withOrders };
}

export async function getWebstoreCustomerDetail(customerId: number) {
  const customer = await db.customer.findFirst({
    where: { customerId, source: "webstore" },
  });
  if (!customer) return null;

  const orders = await db.salesOrder.findMany({
    where: { customerId },
    orderBy: { orderDate: "desc" },
    take: ORDER_HISTORY_LIMIT,
    select: {
      orderId: true,
      folio: true,
      orderDate: true,
      status: true,
      total: true,
    },
  });

  return {
    customerId: customer.customerId,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    isActive: customer.isActive,
    currentBalance: Number(customer.currentBalance),
    version: customer.version,
    createdAt: customer.createdAt,
    orders: orders.map((o) => ({
      orderId: o.orderId,
      folio: o.folio,
      orderDate: o.orderDate,
      status: o.status,
      total: Number(o.total),
    })),
  };
}
