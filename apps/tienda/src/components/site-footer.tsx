import Link from "next/link";
import {
  STORE_ADDRESS,
  STORE_EMAIL,
  STORE_NAME,
  STORE_PHONE,
} from "@/lib/config";

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

export function SiteFooter() {
  const hasContact = Boolean(STORE_EMAIL || STORE_PHONE || STORE_ADDRESS);

  return (
    <footer className="border-t border-line bg-canvas">
      <div className="grid gap-10 px-5 pt-14 pb-10 sm:grid-cols-2 md:px-10 lg:grid-cols-4 lg:gap-8">
        <div className="lg:pr-8">
          <p className="font-display text-2xl leading-none tracking-[.16em] text-navy-900">
            {STORE_NAME}
          </p>
          <p className="mt-5 max-w-[280px] text-[13px] leading-[1.65] text-pretty text-slate-500">
            Despensa escogida pieza a pieza. Productos frescos, marcas de
            confianza y precios claros.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="eyebrow">{column.title}</p>
            <ul className="mt-5 flex flex-col gap-3.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-slate-500 transition-colors duration-150 hover:text-navy-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {hasContact && (
        <div className="flex flex-col gap-3 border-t border-line-soft px-5 py-7 md:flex-row md:gap-10 md:px-10">
          {STORE_PHONE && (
            <a
              href={`tel:${STORE_PHONE.replace(/\s+/g, "")}`}
              className="tabular text-[13px] text-slate-500 transition-colors duration-150 hover:text-navy-900"
            >
              {STORE_PHONE}
            </a>
          )}
          {STORE_EMAIL && (
            <a
              href={`mailto:${STORE_EMAIL}`}
              className="text-[13px] text-slate-500 transition-colors duration-150 hover:text-navy-900"
            >
              {STORE_EMAIL}
            </a>
          )}
          {STORE_ADDRESS && (
            <p className="text-[13px] text-slate-500">{STORE_ADDRESS}</p>
          )}
        </div>
      )}

      <div className="border-t border-line-soft px-5 py-6 md:px-10 md:py-8">
        <p className="text-[11.5px] tracking-[.04em] text-slate-400">
          © {new Date().getFullYear()} {STORE_NAME}
        </p>
      </div>
    </footer>
  );
}
