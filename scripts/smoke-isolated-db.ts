/** Manual smoke test. Always switches the supplied Atlas URI to an isolated DB. */
const sourceUri = process.env.MONGODB_URI ?? '';
if (!/\/cheer(?=\?|$)/.test(sourceUri)) {
  throw new Error('Refusing smoke test: expected a URI with /cheer database');
}
process.env.MONGODB_URI = sourceUri.replace(/\/cheer(?=\?|$)/, '/cheer_codex_test');

const mongoose = (await import('mongoose')).default;
const { UserModel, CreatorProfileModel, OtpChallengeModel, RateLimitModel, connectMongo } = await import('../server/db/index');
const { CreatorsService } = await import('../server/services/creators/creators.service');
const { signAccessToken, verifyAccessToken } = await import('../server/lib/auth');
const { AuthService } = await import('../server/services/auth.service');
const { ConnectService } = await import('../server/services/creators/connect.service');
const { consumeRateLimit } = await import('../server/lib/rate-limit');
const bcrypt = await import('bcryptjs');

const stamp = Date.now();
const userId = `codex_test_${stamp}`;
const profileId = `codex_profile_${stamp}`;
try {
  await connectMongo();
  if (mongoose.connection.name !== 'cheer_codex_test') {
    throw new Error(`Refusing writes to unexpected database: ${mongoose.connection.name}`);
  }
  await UserModel.create([{
    _id: userId,
    email: `codex-${stamp}@example.invalid`,
    passwordHash: await bcrypt.hash('old-password-123', 12),
    emailVerifiedAt: new Date(),
  }]);
  await CreatorProfileModel.create([{
    _id: profileId,
    userId,
    username: `codex_${stamp}`,
    displayName: 'Codex test creator',
    currency: 'NGN',
    payoutCountry: 'NG',
    suggestedTipAmounts: ['1000.00'],
    goalActive: true,
    goalTitle: 'Test goal',
    goalTargetAmount: '50000.00',
  }]);
  const token = await signAccessToken({ sub: userId, email: `codex-${stamp}@example.invalid` });
  const verified = await verifyAccessToken(token);
  if (verified.sub !== userId) throw new Error('Session verification failed');
  const dashboard = await new CreatorsService().getDashboard(userId);
  if (dashboard.username !== `codex_${stamp}` || dashboard.totals.successfulSupport !== '0.00') {
    throw new Error('Dashboard smoke test failed');
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ rate: 0.001 }), { status: 200 });
  try {
    const updated = await new CreatorsService().updateSettings(userId, {
      currency: 'USD',
      payoutCountry: 'NG',
      suggestedTipAmounts: ['1000.00'],
      goalActive: true,
      goalTitle: 'Test goal',
      goalTargetAmount: '50000.00',
    });
    if (updated.suggestedTipAmounts[0] !== '1.00' || updated.goalTargetAmount !== '50.00') {
      throw new Error('Currency settings conversion smoke test failed');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  let code = '';
  const auth = new AuthService({
    notifyOtp: async (params: { code: string }) => {
      code = params.code;
      return { status: 'sent' as const };
    },
  } as unknown as ConstructorParameters<typeof AuthService>[0]);
  await auth.requestPasswordReset(`codex-${stamp}@example.invalid`);
  if (!code) throw new Error('Password reset code was not generated');
  await auth.resetPassword(`codex-${stamp}@example.invalid`, code, 'new-password-123');
  const changed = await UserModel.findOne({ _id: userId });
  if (!changed?.passwordHash || !await bcrypt.compare('new-password-123', changed.passwordHash)) {
    throw new Error('Password reset smoke test failed');
  }
  if (await consumeRateLimit(`codex-smoke:${stamp}`, 1, 60_000) != null ||
      await consumeRateLimit(`codex-smoke:${stamp}`, 1, 60_000) == null) {
    throw new Error('Shared rate limit smoke test failed');
  }
  await CreatorProfileModel.updateOne({ _id: profileId }, { $set: { bachsAccountId: 'acct_codex_test' } });
  const connect = new ConnectService({
    isConfigured: true,
    updateBalanceSettings: async () => { throw new Error('Simulated provider failure'); },
  } as unknown as ConstructorParameters<typeof ConnectService>[0]);
  let failed = false;
  try { await connect.enableFridayPayout(userId); } catch { failed = true; }
  const payoutProfile = await CreatorProfileModel.findOne({ _id: profileId });
  if (!failed || payoutProfile?.fridayPayoutEnabled) throw new Error('Friday payout failure was saved as configured');
  console.info('Isolated user, session, dashboard, currency, reset, rate limit, and payout failure smoke tests passed');
} finally {
  if (mongoose.connection.name === 'cheer_codex_test') {
    await OtpChallengeModel.deleteMany({ email: `codex-${stamp}@example.invalid` });
    await RateLimitModel.deleteMany({ _id: { $regex: `^codex-smoke:${stamp}:` } });
    await CreatorProfileModel.deleteOne({ _id: profileId });
    await UserModel.deleteOne({ _id: userId });
  }
  await mongoose.disconnect();
}
