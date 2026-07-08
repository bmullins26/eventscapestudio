import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { SectionStub } from "@/components/shared/section-stub";

export const Route = createFileRoute("/_authenticated/portal/payments")({
  component: () => (
    <SectionStub
      eyebrow="Vendor Portal"
      title="Payments"
      description="Invoices and payment history for the events you've participated in."
      icon={DollarSign}
      emptyTitle="No invoices yet"
      emptyDescription="Once you're approved for an event, invoices appear here."
    />
  ),
});
