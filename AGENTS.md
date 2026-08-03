# EventScape Studio AI Development Guide

## Project Vision

EventScape Studio is a commercial SaaS platform for event organizers.

Target users:

- Craft Shows
- Festivals
- Farmers Markets
- Vendor Events
- Expos
- Holiday Markets
- Trade Shows

The goal is to become the industry's leading venue and vendor management platform.

This is production software.

Never treat it as a demo.

---

# Core Principles

Always prefer:

- Maintainability
- Scalability
- Reusability
- Performance
- Type Safety

Never sacrifice architecture for short-term fixes.

---

# Development Workflow

Before modifying code:

1. Read all related files.
2. Trace execution completely.
3. Identify the root cause.
4. Explain findings.
5. Design the smallest safe solution.
6. Implement.
7. Verify with a successful build.

Never guess.

---

# Architecture Rules

Do NOT:

- Remove working functionality.
- Introduce duplicate systems.
- Replace production code with placeholder/demo code.
- Change database schema without approval.
- Break existing APIs.
- Ignore TypeScript errors.
- Hide bugs behind fallbacks.

Always:

- Extend existing architecture.
- Reuse existing components.
- Preserve backward compatibility whenever practical.
- Keep changes modular.

---

# Workspace SDK

The Workspace SDK is the production venue designer.

It is the flagship feature.

Future capabilities include:

- Infinite canvas
- Zoom
- Pan
- Rotation
- Snap
- Layers
- Groups
- History
- Autosave
- Inspector
- Collaboration
- Templates
- AI-assisted layout generation

Everything placed on the canvas should derive from a common object model.

Do not build separate systems for rentable objects and infrastructure.

Instead:

Use one editing engine with object-specific inspectors.

---

# Authentication

Uses:

- Supabase Auth
- Google OAuth
- TanStack Router

Do not modify authentication unless necessary.

When debugging auth:

Find the root cause.

Do not bypass errors with loading fallbacks.

---

# Database

Uses Supabase.

Preserve:

- RLS
- Existing server functions
- Existing migrations

Never create duplicate tables.

Never bypass permissions.

---

# UI Philosophy

Professional.

Modern.

Minimal.

Fast.

Responsive.

Built for paying customers.

Avoid clutter.

Favor usability over visual effects.

---

# Coding Standards

TypeScript first.

Strong typing.

Small components.

Reusable hooks.

Single responsibility.

No duplicated logic.

Prefer composition over inheritance.

---

# Bug Fixing

Before fixing:

Explain:

- Root cause
- Why it happened
- Why the proposed solution works

Never guess.

Never mask the issue.

---

# Feature Development

Before implementing:

Explain:

- Which subsystem owns the feature.
- Why it belongs there.
- How it scales.
- Alternatives considered.

Avoid technical debt.

---

# Definition of Done

A task is NOT complete until:

✓ Project builds successfully

✓ TypeScript passes

✓ Existing functionality still works

✓ Risks are documented

✓ Manual testing steps are provided

✓ Files changed are summarized

Do not declare success before verification.
## Repository Awareness

Before making changes:

- Search for existing implementations.
- Prefer extending existing systems over creating new ones.
- Avoid duplicate components, utilities, or business logic.
- If a similar system already exists, improve it instead of replacing it.

When uncertain:

STOP.

Explain the uncertainty.

Ask for clarification before making architectural changes.