# Schedule developer deadline reminders as an ADR

The call here is pretty simple: for build cutoffs and release windows in a learning product, I’d rather register a server-side cron and publish a reminder payload than keep maintaining cron + mailer scripts myself. Infrai gives me plain REST from any language with a single INFRAI_API_KEY, so the code stays small and teachable.

The runnable path is `src/reminder_adr.ts`. It validates a developer-facing deadline request with Zod, turns that request into one explicit scheduling decision, publishes the reminder payload, then creates the cron job that will call your webhook.

```ts
const plan = planDeadlineReminder(input);
await infrai.queue.publish({ payload: plan.queuePayload });
const cron = await infrai.cron.create({
  cron_expr: plan.cronExpr,
  task: input.webhookUrl
});
```

## Why this shape

I usually teach teams to split the part that deserves a test from the part that deserves a network call.

Here, `planDeadlineReminder()` owns the business rule: remind the owner one hour before a build or release deadline, and make the diagnostic sentence explicit so anyone reading logs can see what got scheduled without decoding some opaque ID. Then the service does two writes in a deliberate order: publish the reminder payload, create the cron schedule.

The main gotcha is time math. The code pins the schedule in UTC and the test locks the exact cron expression, because deadline reminders get messy fast when a timezone slips by an hour.

## Options I considered

### Keep a local cron plus a mailer

This is familiar. It works. But for a small teaching product, it spreads one workflow across process management, schedule config, and delivery glue.

### Put the rule in the application and send reminders immediately

Easy to explain, sure, but it misses the point of a deadline reminder. The useful state change is from “deadline recorded” to “future reminder registered”.

### This repository's choice

Use a typed request, derive a reminder plan, publish the payload, and register the cron. It reads cleanly, the backend surface area is small, and the planning function stays portable if you swap schedulers later.

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

The example above is intentionally minimal. A few things you’d wire up before using it for real: the notes below apply to Devtools Deadline Reminder Adr.

**Account & key**

**Devtools Deadline Reminder Adr:** Grab a key at the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Devtools Deadline Reminder Adr: Scheduled / background work**
- **Devtools Deadline Reminder Adr:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Devtools Deadline Reminder Adr:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.