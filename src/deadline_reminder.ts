import { z } from 'zod';

export const reminderRequestSchema = z.object({
  eventId: z.string().min(1),
  eventKind: z.enum(['build-cutoff', 'release-window']),
  courseSlug: z.string().min(1),
  environment: z.enum(['staging', 'production']),
  owner: z.string().min(1),
  deadlineIso: z.string().datetime({ offset: true }),
  webhookUrl: z.string().url()
});

export type ReminderRequest = z.infer<typeof reminderRequestSchema>;

export type ReminderPlan = {
  accepted: boolean;
  cronExpr: string;
  queuePayload: {
    reminder_key: string;
    event_id: string;
    course_slug: string;
    event_kind: ReminderRequest['eventKind'];
    owner: string;
    environment: ReminderRequest['environment'];
    deadline_iso: string;
    diagnostic: string;
  };
  reason: string;
};

function utcCronOneHourBefore(deadlineIso: string): string {
  const deadline = new Date(deadlineIso);
  const reminder = new Date(deadline.getTime() - 60 * 60 * 1000);
  const minute = reminder.getUTCMinutes();
  const hour = reminder.getUTCHours();
  const day = reminder.getUTCDate();
  const month = reminder.getUTCMonth() + 1;
  return `${minute} ${hour} ${day} ${month} *`;
}

export function planDeadlineReminder(input: ReminderRequest): ReminderPlan {
  const deadline = new Date(input.deadlineIso);
  const reminderAt = new Date(deadline.getTime() - 60 * 60 * 1000);
  const diagnostic = `${input.eventKind} for ${input.courseSlug} in ${input.environment} reaches ${input.owner} at ${reminderAt.toISOString()}`;

  return {
    accepted: true,
    cronExpr: utcCronOneHourBefore(input.deadlineIso),
    queuePayload: {
      reminder_key: `${input.eventId}:${reminderAt.toISOString()}`,
      event_id: input.eventId,
      course_slug: input.courseSlug,
      event_kind: input.eventKind,
      owner: input.owner,
      environment: input.environment,
      deadline_iso: input.deadlineIso,
      diagnostic
    },
    reason: 'schedule one reminder one hour before the deadline so a course release still has room for a final check'
  };
}
