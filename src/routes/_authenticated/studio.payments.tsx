import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/studio/payments")({
  component: () => (
    <SectionStub
      eyebrow="Studio"
      title="Payments"
      description="Manually track invoices, mark payments received, and roll up revenue per event."
      icon={DollarSign}
      emptyTitle="No payments logged"
      emptyDescription="Payment records appear here once vendors are approved and invoices are issued."
    />
  ),
});
