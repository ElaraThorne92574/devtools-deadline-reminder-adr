import test from 'node:test';
import assert from 'node:assert/strict';
import { planDeadlineReminder, reminderRequestSchema } from '../src/deadline_reminder';

test('plans a release reminder one hour before the deadline with a visible diagnostic', () => {
  const input = reminderRequestSchema.parse({
    eventId: 'build-week-4',
    eventKind: 'build-cutoff',
    courseSlug: 'frontend-mastery',
    environment: 'staging',
    owner: 'qa-inbox@school.test',
    deadlineIso: '2026-01-15T18:30:00+00:00',
    webhookUrl: 'https://example.com/reminders/devtools'
  });

  const plan = planDeadlineReminder(input);

  assert.equal(plan.accepted, true);
  assert.equal(plan.cronExpr, '30 17 15 1 *');
  assert.equal(plan.queuePayload.reminder_key, 'build-week-4:2026-01-15T17:30:00.000Z');
  assert.equal(
    plan.queuePayload.diagnostic,
    'build-cutoff for frontend-mastery in staging reaches qa-inbox@school.test at 2026-01-15T17:30:00.000Z'
  );
});
