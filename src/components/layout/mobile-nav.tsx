"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAllNavigationRoutes } from "@/lib/module-registry";

export function MobileNav() {
  const pathname = usePathname();
  const navRoutes = getAllNavigationRoutes();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {navRoutes.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center justify-center p-2 rounded-md text-sm font-medium transition-all duration-300 ${
              isActive(item.href)
                ? "bg-white text-black"
                : "text-white hover:text-black hover:bg-gray-100"
            }`}
          >
            <item.icon className="h-6 w-6" />
          </Link>
        ))}
      </div>
    </div>
  );
}
