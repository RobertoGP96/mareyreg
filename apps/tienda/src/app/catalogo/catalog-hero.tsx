interface CatalogHeroProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function CatalogHero({
  eyebrow,
  title,
  description,
}: CatalogHeroProps) {
  return (
    <section className="border-b border-line bg-canvas px-5 pt-12 pb-10 text-center md:pt-14 md:pb-12">
      <p className="eyebrow text-[12px] tracking-[.12em] text-gold-600">
        {eyebrow}
      </p>
      <h1 className="font-display mt-5 text-[34px] leading-[1.05] text-navy-900 md:text-[52px]">
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>
    </section>
  );
}
