import type { ComponentType, ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  label: string;
  description?: string;
  icon: LucideIcon | ComponentType<{ className?: string }>;
  to?: LinkProps["to"];
  params?: LinkProps["params"];
  search?: LinkProps["search"];
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function QuickActionCard({ label, description, icon: Icon, to, params, search, onClick, className, disabled }: QuickActionCardProps) {
  const inner = (
    <Card
      className={cn(
        "card-soft group flex h-full flex-col justify-between gap-4 border-0 p-5 shadow-none transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft transition group-hover:bg-primary-deep">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-foreground">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} params={params as never} search={search as never} className="block h-full">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="block h-full w-full text-left">
      {inner}
    </button>
  );
}
