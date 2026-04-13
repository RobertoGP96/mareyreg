"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAllNavigationRoutes } from "@/lib/module-registry";

export function Header() {
  const pathname = usePathname();
  const navRoutes = getAllNavigationRoutes();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-black shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <img
              src="/truck-white.svg"
              alt="MareyReg Logo"
              className="h-8 w-8 mr-2"
            />
            <h1 className="text-2xl font-bold text-white roadway-font">
              MAREYreg
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navRoutes.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 ${
                  isActive(item.href)
                    ? "bg-white text-black"
                    : "text-white hover:text-black hover:bg-gray-100"
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
