import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

interface SectionStubProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function SectionStub({ eyebrow, title, description, icon, emptyTitle, emptyDescription, action, children }: SectionStubProps) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children ?? <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />}
    </div>
  );
}
