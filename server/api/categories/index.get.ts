export default defineEventHandler(async (event) => {
  const { userId } = await requireUserOrApi(event);
  return listCategories(userId);
});
