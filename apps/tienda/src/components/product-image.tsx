import Image from "next/image";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  label?: string;
}

export function ProductImage({
  src,
  alt,
  sizes,
  label = "FOTO",
}: ProductImageProps) {
  if (src) {
    return (
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    );
  }
  return <span aria-hidden>{label}</span>;
}
