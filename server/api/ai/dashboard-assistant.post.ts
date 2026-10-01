import { readBody, setHeader } from 'h3';
import { requireUser } from '../../lib/auth';
import { defineApiHandler } from '../../lib/define-api';
import { ApiError } from '../../lib/errors';
import { assertRateLimit } from '../../lib/rate-limit';
import { CreatorsService } from '../../services/creators/creators.service';
import { answerDashboardQuestion, assistantTopics } from '../../services/ai/dashboard-assistant';
import type { AssistantTopic } from '../../../types/assistant';

export default defineApiHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store');
  const user = await requireUser(event);
  await assertRateLimit(`dashboard-assistant:${user.sub}`, 30, 60_000);
  const body: unknown = await readBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_INPUT', 'Please enter a question.');
  }
  const { question, previousTopic } = body as Record<string, unknown>;
  if (typeof question !== 'string' || !question.trim() || question.length > 1000) {
    throw new ApiError(400, 'INVALID_INPUT', 'Enter a question between 1 and 1,000 characters.');
  }
  if (previousTopic !== undefined && !assistantTopics.includes(previousTopic as AssistantTopic)) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid conversation topic.');
  }
  // Account identity comes exclusively from the session, never from request fields.
  const dashboard = await new CreatorsService().getDashboard(user.sub);
  return answerDashboardQuestion(question.trim(), dashboard, previousTopic as AssistantTopic | undefined);
});
