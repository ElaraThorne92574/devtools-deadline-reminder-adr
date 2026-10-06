import { infrai } from './infrai';
import { planDeadlineReminder, reminderRequestSchema, type ReminderRequest } from './deadline_reminder';

const REMINDER_QUEUE = 'developer-deadline-reminders';

async function scheduleDeadlineReminder(raw: unknown) {
  const input = reminderRequestSchema.parse(raw);
  const plan = planDeadlineReminder(input);

  await infrai.queue.publish({
    queue: REMINDER_QUEUE,
    payload: {
      reminder_key: plan.queuePayload.reminder_key,
      event_id: plan.queuePayload.event_id,
      course_slug: plan.queuePayload.course_slug,
      event_kind: plan.queuePayload.event_kind,
      owner: plan.queuePayload.owner,
      environment: plan.queuePayload.environment,
      deadline_iso: plan.queuePayload.deadline_iso,
      diagnostic: plan.queuePayload.diagnostic
    }
  });

  const cron = await infrai.cron.create({
    cron_expr: plan.cronExpr,
    task: input.webhookUrl
  });

  return {
    decision: plan.reason,
    jobId: cron.data.job_id,
    reminderKey: plan.queuePayload.reminder_key,
    diagnostic: plan.queuePayload.diagnostic
  };
}

async function runReminderDispatch() {
  const consumed = await infrai.queue.consume({
    queue: REMINDER_QUEUE,
    max_messages: 5,
    visibility_timeout: 60
  });

  const messages = consumed.data.messages ?? [];
  const delivered: Array<{ messageId: string; diagnostic: string }> = [];

  for (const message of messages) {
    const payload = message.payload ?? {};
    const diagnostic = typeof payload.diagnostic === 'string' ? payload.diagnostic : 'deadline reminder ready';

    await infrai.queue.ack({ queue: REMINDER_QUEUE, message_id: message.message_id });
    delivered.push({ messageId: message.message_id, diagnostic });
  }

  return delivered;
}

const sampleInput: ReminderRequest = {
  eventId: 'release-lesson-7',
  eventKind: 'release-window',
  courseSlug: 'typescript-foundations',
  environment: 'production',
  owner: 'release-teacher@school.test',
  deadlineIso: '2026-03-10T15:00:00+00:00',
  webhookUrl: 'https://example.com/reminders/devtools'
};

async function main() {
  const scheduled = await scheduleDeadlineReminder(sampleInput);
  console.log('scheduled reminder', scheduled);

  const delivered = await runReminderDispatch();
  console.log('dispatched diagnostics', delivered);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
