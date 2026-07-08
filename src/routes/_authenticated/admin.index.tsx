import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Building2, Users, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform Administration"
        title="Overview"
        description="Cross-platform health, growth, and support signals for every EventScape organization."
      />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Organizations" value={0} icon={Building2} tone="primary" />
        <StatCard label="Active Users" value={0} icon={Users} tone="default" />
        <StatCard label="Paying Subs" value={0} icon={CreditCard} tone="success" />
        <StatCard label="Open Tickets" value={0} icon={ShieldCheck} tone="warning" />
      </section>
      <EmptyState icon={ShieldCheck} title="Platform metrics arrive here" description="Analytics rollups and health signals will populate as organizations onboard." />
    </div>
  ),
});
