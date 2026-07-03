import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <EmptyState
        icon="⌕"
        title="No encontramos esta página"
        description="El producto o la página que buscas no existe o ya no está disponible."
        ctaLabel="Ir al catálogo"
        ctaHref="/catalogo"
      />
    </div>
  );
}
