"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_NAME,
  STORE_PHONE,
} from "@/lib/config";
import { BrandLogo } from "@/components/brand-logo";

interface FooterColumn {
  title: string;
  links: { href: string; label: string }[];
}

// Solo rutas que existen: un enlace a una página inventada es un 404 servido
// desde el footer de todas las pantallas.
const COLUMNS: FooterColumn[] = [
  {
    title: "Tienda",
    links: [
      { href: "/catalogo", label: "Catálogo" },
      { href: "/catalogo?ofertas=1", label: "Ofertas" },
      { href: "/catalogo?destacados=1", label: "Destacados" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/perfil", label: "Mi perfil" },
      { href: "/perfil/pedidos", label: "Mis pedidos" },
      { href: "/perfil/datos", label: "Mis datos" },
    ],
  },
  {
    title: "Atajos",
    links: [
      { href: "/favoritos", label: "Favoritos" },
      { href: "/carrito", label: "Bolsa" },
      { href: "/login", label: "Iniciar sesión" },
    ],
  },
];

const LINK =
  "text-[13px] text-footer-fg/90 transition-colors duration-150 hover:text-white";

// El bloque informativo (marca, columnas de enlaces y contacto) solo tiene
// sentido en el inicio; en el resto de pantallas queda únicamente la barra
// del copyright para no alargar páginas de flujo (carrito, checkout, perfil).
export function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const hasContact = Boolean(STORE_EMAIL || STORE_PHONE || STORE_ADDRESS);

  return (
    <footer className="mt-auto bg-footer text-footer-fg">
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-6">
        {isHome && (
          <div className="grid gap-9 pt-12 pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="lg:pr-8">
              <BrandLogo tone="inverse" asLink={false} />
              <p className="mt-5 max-w-[280px] text-[13px] leading-[1.65] text-pretty text-footer-muted">
                Despensa escogida pieza a pieza. Productos frescos, marcas de
                confianza y precios claros.
              </p>
            </div>

            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="eyebrow text-gold-500">{column.title}</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        )}

        {isHome && hasContact && (
          <div className="flex flex-col gap-3 border-t border-footer-line py-6 md:flex-row md:gap-10">
            {STORE_PHONE && (
              <a
                href={`tel:${STORE_PHONE.replace(/\s+/g, "")}`}
                className={`tabular ${LINK}`}
              >
                {STORE_PHONE}
              </a>
            )}
            {STORE_EMAIL && (
              <a href={`mailto:${STORE_EMAIL}`} className={LINK}>
                {STORE_EMAIL}
              </a>
            )}
            {STORE_ADDRESS && (
              <p className="text-[13px] text-footer-muted">{STORE_ADDRESS}</p>
            )}
          </div>
        )}

        <div className={isHome ? "border-t border-footer-line py-6" : "py-6"}>
          <p className="text-[12px] text-footer-muted">
            © {new Date().getFullYear()} {STORE_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
