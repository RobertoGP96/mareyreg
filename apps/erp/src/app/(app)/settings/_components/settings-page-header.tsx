import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
};

export function SettingsPageHeader({ title, subtitle, badge, actions }: Props) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {badge && (
          <div className="mb-2">
            <Badge variant="brand">{badge}</Badge>
          </div>
        )}
        <h1 className="font-headline text-2xl font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
