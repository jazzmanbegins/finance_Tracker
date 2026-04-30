Parse.Cloud.define('getTransactions', async (request) => {
  const { userId, month, year } = request.params;

  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId is required.');
  }

  if (typeof month !== 'number' || month < 1 || month > 12) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'month must be a number between 1 and 12.');
  }

  if (typeof year !== 'number' || year < 2000) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'year must be a valid 4-digit year.');
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const query = new Parse.Query('Transactions');
  query.equalTo('userId', userId);
  query.greaterThanOrEqualTo('transactionDate', startDate);
  query.lessThan('transactionDate', endDate);
  query.descending('transactionDate');

  const results = await query.find({ useMasterKey: true });

  return results.map((t) => ({
    id: t.id,
    userId: t.get('userId'),
    type: t.get('type'),
    amount: t.get('amount'),
    category: t.get('category'),
    transactionDate: t.get('transactionDate'),
    note: t.get('note') ?? null,
  }));
});
