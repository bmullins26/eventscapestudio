import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: () => (
    <SectionStub
      eyebrow="Platform"
      title="Subscriptions"
      description="Subscription tiers, billing status, and MRR across all organizations."
      icon={CreditCard}
      emptyTitle="No subscriptions yet"
      emptyDescription="Once paid tiers launch, subscription data will land here."
    />
  ),
});
