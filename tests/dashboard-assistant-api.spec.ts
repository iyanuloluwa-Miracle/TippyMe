import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { H3Event } from 'h3';
import handler from '../server/api/ai/dashboard-assistant.post';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), readBody: vi.fn(), setHeader: vi.fn(), rateLimit: vi.fn(),
  getDashboard: vi.fn(), answer: vi.fn(),
}));
vi.mock('h3', () => ({ readBody: mocks.readBody, setHeader: mocks.setHeader }));
vi.mock('../server/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('../server/lib/define-api', () => ({ defineApiHandler: (handler: unknown) => handler }));
vi.mock('../server/lib/rate-limit', () => ({ assertRateLimit: mocks.rateLimit }));
vi.mock('../server/services/creators/creators.service', () => ({
  CreatorsService: class { getDashboard = mocks.getDashboard; },
}));
vi.mock('../server/services/ai/dashboard-assistant', () => ({
  answerDashboardQuestion: mocks.answer, assistantTopics: ['payout', 'help'],
}));

describe('dashboard assistant account boundary', () => {
  const event = {} as H3Event;
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireUser.mockResolvedValue({ sub: 'signed-in-user' });
    mocks.readBody.mockResolvedValue({ question: 'My payout?', userId: 'someone-else' });
    mocks.getDashboard.mockResolvedValue({ displayName: 'Ada' });
    mocks.answer.mockReturnValue({ answer: 'Account answer' });
  });
  it('uses only the signed-in identity and prevents response caching', async () => {
    await handler(event);
    expect(mocks.getDashboard).toHaveBeenCalledExactlyOnceWith('signed-in-user');
    expect(mocks.setHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store');
    expect(mocks.rateLimit).toHaveBeenCalledWith('dashboard-assistant:signed-in-user', 30, 60_000);
  });
  it('does not load account data when authentication fails', async () => {
    mocks.requireUser.mockRejectedValue(new Error('Unauthorized'));
    await expect(handler(event)).rejects.toThrow('Unauthorized');
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });
  it('stops before loading private data when rate limited', async () => {
    mocks.rateLimit.mockRejectedValue(new Error('Rate limited'));
    await expect(handler(event)).rejects.toThrow('Rate limited');
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });
  it('does not invent account answers when loading fails', async () => {
    mocks.getDashboard.mockRejectedValue(new Error('Unavailable'));
    await expect(handler(event)).rejects.toThrow('Unavailable');
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it.each([null, [], { question: '' }, { question: 1 }, { question: 'a'.repeat(1001) }, { question: 'hi', previousTopic: 'invalid' }])('rejects malformed input: %j', async (body) => {
    mocks.readBody.mockResolvedValue(body);
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });
});
