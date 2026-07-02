import { describe, expect, it } from "vitest";
import { getBreadcrumbs } from "./breadcrumb-utils";

const hrefs = (pathname: string) =>
  getBreadcrumbs(pathname).map((item) => item.href);

describe("getBreadcrumbs", () => {
  it("devuelve solo Inicio sin enlace en la raiz", () => {
    const items = getBreadcrumbs("/");
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Inicio");
    expect(items[0].href).toBeUndefined();
  });

  it("enlaza segmentos intermedios que si tienen pagina", () => {
    // /pacas y /settings existen como page.tsx y estan en el registry
    expect(hrefs("/pacas/categorias")).toEqual(["/", "/pacas", undefined]);
    expect(hrefs("/settings/security")).toEqual(["/", "/settings", undefined]);
  });

  it("no enlaza segmentos agrupadores sin pagina (evita 404)", () => {
    // /envios, /inventory, /reports y /webstore no tienen page.tsx
    expect(hrefs("/envios/monedas")).toEqual(["/", undefined, undefined]);
    expect(hrefs("/inventory/dashboard")).toEqual(["/", undefined, undefined]);
    expect(hrefs("/reports/kardex")).toEqual(["/", undefined, undefined]);
    expect(hrefs("/webstore/ordenes")).toEqual(["/", undefined, undefined]);
  });

  it("enlaza paginas de detalle [id] cuando el listado padre existe", () => {
    expect(hrefs("/purchase-orders/17/receipt")).toEqual([
      "/",
      "/purchase-orders",
      "/purchase-orders/17",
      undefined,
    ]);
    expect(hrefs("/envios/grupos/3")).toEqual([
      "/",
      undefined,
      "/envios/grupos",
      undefined,
    ]);
  });

  it("el ultimo segmento nunca lleva enlace", () => {
    const items = getBreadcrumbs("/envios/dashboard");
    expect(items.at(-1)?.href).toBeUndefined();
  });

  it("usa el nombre del registry cuando la ruta esta registrada", () => {
    const items = getBreadcrumbs("/envios/monedas");
    expect(items.at(-1)?.label).toBe("Monedas");
  });
});
