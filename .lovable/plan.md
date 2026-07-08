## Fix vendor "Save failed"

**Root cause:** The `create_vendor_with_link` RPC casts `(_link->>'account_status')::account_status`, but no enum named `account_status` exists — the correct type is `vendor_account_status`. Postgres raises `type "account_status" does not exist`, the server function throws, and `src/start.ts`'s `errorMiddleware` swallows the message into a generic 500, so the UI only shows "Save failed".

## Change

Ship a migration that replaces `create_vendor_with_link` with the same body, but with the cast fixed to `::vendor_account_status`. No other logic, signature, or RLS changes.

```sql
-- inside INSERT INTO public.organization_vendors(...)
COALESCE((_link->>'account_status')::vendor_account_status, 'no_account'::vendor_account_status),
```

No client code changes required — `src/lib/vendors.functions.ts` and `studio.vendors.tsx` already pass `account_status: "no_account"`, which is a valid `vendor_account_status` value.

## Verification

After the migration runs, click **Add vendor → Save** on `/studio/vendors`. Expected: toast "Saved", the new vendor appears in the list, no Postgres error in logs.