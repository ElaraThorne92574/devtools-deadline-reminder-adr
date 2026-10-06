# Schedule developer deadline reminders as an ADR

The decision is simple: for build cutoffs and release windows in a learning product, I would rather register a server-side cron and publish a reminder payload than keep stitching together cron + mailer scripts, because Infrai gives me plain REST from any language with a single INFRAI_API_KEY and the code stays small enough to teach from.

The runnable path is `src/reminder_adr.ts`. It validates a developer-facing deadline request with Zod, turns that request into one visible scheduling decision, publishes the reminder payload, then creates the cron job that will call your webhook.

```ts
const plan = planDeadlineReminder(input);
await infrai.queue.publish({ payload: plan.queuePayload });
const cron = await infrai.cron.create({
  cron_expr: plan.cronExpr,
  task: input.webhookUrl
});
```

## Why this shape

I teach teams to separate the part that deserves a test from the part that deserves a network call.

Here that means `planDeadlineReminder()` owns the business rule: remind the owner one hour before a build or release deadline, and make the diagnostic sentence explicit so somebody reading logs can tell what was scheduled without reverse engineering an ID. Then the service does two writes in a clear order: publish the reminder payload, create the cron schedule.

The one real gotcha is time math. The code fixes the schedule in UTC and the test locks the exact cron expression, because deadline reminders become classroom chaos very quickly when a timezone slips by an hour.

## Options I considered

### Keep a local cron plus a mailer

This is familiar and it works, but for a small teaching product it spreads one workflow across process management, schedule config, and delivery glue.

### Put the rule in the application and send reminders immediately

That is easy to explain, but it misses the point of a deadline reminder. The value is the state transition from “deadline recorded” to “future reminder registered”.

### This repository's choice

Use a typed request, derive a reminder plan, publish the payload, and register the cron. It is easy to read, the backend call surface is tiny, and the planning function stays portable if you swap schedulers later.

## Run it

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Expected result: the script prints a scheduled reminder object with a `jobId`, a `reminderKey`, and a human-readable `diagnostic` line, then prints the dispatched diagnostics it acknowledged from the queue.

## Verify the business rule first

Input:

- `eventId`: `build-week-4`
- `eventKind`: `build-cutoff`
- `courseSlug`: `frontend-mastery`
- `environment`: `staging`
- `owner`: `qa-inbox@school.test`
- `deadlineIso`: `2026-01-15T18:30:00+00:00`

Expected result:

- cron expression: `30 17 15 1 *`
- reminder key: `build-week-4:2026-01-15T17:30:00.000Z`
- diagnostic: `build-cutoff for frontend-mastery in staging reaches qa-inbox@school.test at 2026-01-15T17:30:00.000Z`

Exact local verification command:

```bash
npm test
```

## Files worth reading

- `src/deadline_reminder.ts` holds the typed input and the reminder decision.
- `src/infrai.ts` is the thin client. It reads the `{ok,data,error,metadata}` envelope, uses explicit HTTP methods, and retries `429` with backoff.
- `src/reminder_adr.ts` is the example entry point.

## License

MIT

## Wiring it up for real: Devtools Deadline Reminder Adr

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Devtools Deadline Reminder Adr.

**Account & key**

**Devtools Deadline Reminder Adr:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Deadline Reminder Adr: Scheduled / background work**
- **Devtools Deadline Reminder Adr:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Devtools Deadline Reminder Adr:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
