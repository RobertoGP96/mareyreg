import Image from "next/image";

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
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    );
  }
  return <span aria-hidden>{label}</span>;
}
