---
name: Newsletter send timeout
description: Sequential email delivery must not block the HTTP response — respond immediately and deliver in background
---

## Rule

When a route sends emails to multiple recipients sequentially, the total time can exceed browser/Playwright timeouts (typically 3–5 s), causing the UI to receive no response and stay stuck in "pending" state.

## Fix pattern

```typescript
// 1. Mark as sent and respond immediately
const updated = await storage.markNewsletterSent(newsletter.id, recipients.length);
res.json({ newsletter: updated, sent: recipients.length, total: recipients.length });

// 2. Deliver in background (non-blocking)
(async () => {
  let successCount = 0;
  for (const recipient of recipients) {
    const ok = await sendEmail(...);
    if (ok) successCount++;
  }
  await storage.markNewsletterSent(newsletter.id, successCount); // update real count
})().catch(err => console.error("Background delivery error:", err));
```

**Why:** The HTTP response must return before the client's timeout. Marking "sent" upfront is safe because the newsletter can't be re-sent (status check at top of route), and the actual delivery count is corrected once background work finishes.

**How to apply:** Any bulk-send route where per-item async work (email, SMS, webhooks) could take longer than a few seconds total.
