"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  /** Texto para lectores de pantalla cuando no hay foto. */
  label?: string;
  /** true solo para imágenes above-the-fold (LCP): las precarga en vez de lazy-load. */
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  sizes,
  label = "Sin foto",
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="flex items-center justify-center text-slate-300">
      <ImageIcon className="h-[26px] w-[26px]" strokeWidth={1.5} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
