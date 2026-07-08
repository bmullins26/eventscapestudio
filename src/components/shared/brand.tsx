import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface BrandProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  href?: string;
  className?: string;
}

export function Brand({ size = "md", showTagline = false, href = "/", className }: BrandProps) {
  const sizes = {
    sm: { mark: "h-8 w-8", title: "text-lg", sub: "text-[10px]" },
    md: { mark: "h-10 w-10", title: "text-2xl", sub: "text-[11px]" },
    lg: { mark: "h-16 w-16", title: "text-4xl", sub: "text-xs" },
  }[size];

  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark className={sizes.mark} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display font-semibold text-foreground", sizes.title)}>
          <span className="text-primary italic">Event</span>
          <span>Scape</span>
        </span>
        <span className={cn("mt-0.5 uppercase tracking-[0.32em] text-muted-foreground", sizes.sub)}>
          Studio{showTagline ? " · Plan · Organize · Celebrate" : ""}
        </span>
      </span>
    </span>
  );

  if (!href) return content;
  return <Link to={href}>{content}</Link>;
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border border-primary/40 bg-primary-soft/60",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-[62%] w-[62%] text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
        <path d="M10 12h9M10 17h9M10 22h6" />
        <path d="M14 5.5h3v2h-3z" fill="currentColor" />
      </svg>
    </span>
  );
}
