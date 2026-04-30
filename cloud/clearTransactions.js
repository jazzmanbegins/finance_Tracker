Parse.Cloud.define('clearTransactions', async (request) => {
  const { userId, month, year } = request.params;

  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId is required.');
  }

  if (typeof month !== 'number' || month < 1 || month > 12) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'month must be 1–12.');
  }

  if (typeof year !== 'number' || year < 2000) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'year must be a valid 4-digit year.');
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);

  const query = new Parse.Query('Transactions');
  query.equalTo('userId', userId);
  query.greaterThanOrEqualTo('transactionDate', startDate);
  query.lessThan('transactionDate', endDate);
  query.limit(1000);

  const results = await query.find({ useMasterKey: true });
  await Parse.Object.destroyAll(results, { useMasterKey: true });

  return { success: true, deleted: results.length };
});
