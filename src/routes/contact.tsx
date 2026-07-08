import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/routes/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact · EventScape" },
      { name: "description", content: "Get in touch with the EventScape team." },
      { property: "og:title", content: "Contact · EventScape" },
      { property: "og:description", content: "We'd love to hear from you." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sending, setSending] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <section className="mx-auto max-w-xl px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">Contact</p>
        <h1 className="mt-5 font-display text-4xl font-semibold sm:text-5xl">Say hello.</h1>
        <p className="mt-4 text-muted-foreground">
          Questions, feedback, or just want to chat about your next event? We'd love to hear from you.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSending(true);
            setTimeout(() => { toast.success("Thanks! We'll be in touch."); setSending(false); }, 600);
          }}
        >
          <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" required /></div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required /></div>
          <div className="space-y-2"><Label htmlFor="msg">Message</Label><Textarea id="msg" rows={5} required /></div>
          <Button type="submit" className="w-full" disabled={sending}>{sending ? "Sending…" : "Send message"}</Button>
        </form>
      </section>
      <PublicFooter />
    </div>
  );
}
