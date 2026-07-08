# Full Manual Vendor Form + Photo/Scan Auto-Fill

Right now the Vendors → "Add vendor" dialog collects the basics but has two gaps:

1. **Document fields are URL text inputs.** An organizer can't actually upload the insurance PDF, food license, resale certificate, tax document, or business photos from their phone/computer — they'd have to host the files elsewhere first.
2. **No way to scan a paper vendor intake form.** Applications already have "Scan with AI" but Vendors don't, so paper intake forms have to be retyped by hand.

This plan closes both gaps without redesigning the page.

## What you'll be able to do

- Open **Add vendor** and see the same full intake form (business, contact, docs, emergency contact) — unchanged in layout but with real uploads
- **Take a picture / upload a photo or PDF of a paper vendor intake form** — AI extracts the fields and pre-fills the dialog for review before saving
- Upload actual files for **Insurance, Tax Document, Food License, Resale Certificate** — each row shows filename + Replace / Remove
- Upload up to 8 **Business photos** with thumbnail previews and remove buttons
- Add **social links** (Facebook, Instagram, TikTok, Website) as proper fields instead of one free-text URL
- Edit an existing vendor and see already-uploaded docs / photos rendered as chips with signed download links

Existing behavior (search, favorite, invite to portal, disable, delete) is untouched.

## Where changes go

**Storage** — reuse existing private `application-uploads` bucket for vendor files under prefix `vendor-intake/<org_id>/<vendor_profile_id>/…`. No new bucket, no schema migration; RLS on the bucket already scopes to org members.

**`src/lib/studio.functions.ts`** — add one server function:
- `scanVendorIntake({ fileDataUrl })` — mirrors `scanApplicationImage`. Sends the image/PDF to Lovable AI Gateway with `google/gemini-2.5-pro`, returns a Zod-validated `VendorIntakeExtraction` shape (business_name, contact_name, email, phone, website, business_description, product_categories[], emergency_contact_name, emergency_contact_phone, social_links{facebook,instagram,tiktok}, notes). No DB writes — extraction only; user reviews before save.

**`src/routes/_authenticated/studio.vendors.tsx`** — enhance the existing dialog:
- Header actions: keep **Add vendor**; add secondary **Scan intake** button that opens a file picker (`accept="image/*,application/pdf"` + `capture="environment"` on mobile so it opens the camera)
- After scan, populate the dialog with extracted values and show a small "Reviewing AI extraction from `filename.jpg`" banner at the top; on save, `entry_method`-style is not stored on the profile (profiles are permanent) but we set `intake_completed_at = now()` and attach the source image to `business_photos` if user keeps it
- Replace each of the 4 document URL inputs with a `<DocumentUploadField>` that:
  - shows current filename (parsed from URL) if present
  - has a hidden `<input type="file">` for choosing/replacing
  - uploads via `supabase.storage.from("application-uploads").upload(...)`, saves the object path into the respective column
  - Remove button clears the value
- Replace `business_photos` (currently unmanaged) with a `<PhotoGrid>` — up to 8 thumbnails with add/remove, same bucket
- Split the current single `website` field into a small **Links** section: Website + Facebook + Instagram + TikTok, stored together in `social_links` jsonb (website stays on its own column)
- Product categories input keeps its comma-separated UX

## Non-goals

- No changes to Applications page (already has scan)
- No new routes, no schema changes
- No changes to Vendor Portal-side experience
- Social platforms limited to the four listed; more can be added later without schema changes since `social_links` is jsonb

## Technical notes

- AI extraction prompt lists the exact fields and instructs "return null for anything not clearly on the form" — same pattern already used for applications
- Signed URLs used for displaying previously-uploaded docs (1-hour expiry, generated on demand when rendering the dialog)
- File uploads happen on save (not on file pick) so canceling the dialog doesn't leave orphans; scanned source image is uploaded only if the user checks "keep source image" (default off)
- Mobile-friendly: `capture="environment"` triggers the rear camera on iOS/Android when tapping "Scan intake"
- Validation stays client-side (business_name required); server RLS remains the source of truth
