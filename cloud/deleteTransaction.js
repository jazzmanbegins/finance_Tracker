Parse.Cloud.define('deleteTransaction', async (request) => {
  const { transactionId } = request.params;

  if (!transactionId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'transactionId is required.');
  }

  const query = new Parse.Query('Transactions');
  const obj = await query.get(transactionId, { useMasterKey: true });
  await obj.destroy({ useMasterKey: true });

  return { success: true };
});
