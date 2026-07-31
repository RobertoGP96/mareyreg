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
    <section className="border-b border-line px-5 pt-[58px] pb-[46px] text-center md:px-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-display mt-5 text-[42px] leading-none text-navy-900 md:text-[66px]">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-[470px] text-[14px] leading-[1.65] text-pretty text-slate-500">
        {description}
      </p>
    </section>
  );
}
