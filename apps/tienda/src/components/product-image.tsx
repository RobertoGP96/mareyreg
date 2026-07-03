"use client";

import Image from "next/image";
import { useState } from "react";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  label?: string;
  /** true solo para imágenes above-the-fold (LCP): las precarga en vez de lazy-load. */
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  sizes,
  label = "FOTO",
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
  return <span aria-hidden>{label}</span>;
}
