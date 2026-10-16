export default defineEventHandler(async (event) => {
  const { n } = (await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users"))!;
  const user = await getSessionUser(event);
  return {
    setupRequired: n === 0,
    registrationOpen: n > 0 && (await registrationOpen()),
    loggedIn: !!user,
    username: user?.username ?? null,
    role: user?.role ?? null,
  };
});
