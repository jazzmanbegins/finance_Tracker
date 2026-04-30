Parse.Cloud.define('getAllTimeTotal', async (request) => {
  const { userId } = request.params;
  if (!userId) throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId is required.');

  const query = new Parse.Query('Transactions');
  query.equalTo('userId', userId);
  query.limit(100000);

  const results = await query.find({ useMasterKey: true });

  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of results) {
    if (t.get('type') === 'INCOME') totalIncome += t.get('amount');
    else totalExpense += t.get('amount');
  }

  return { totalIncome, totalExpense, totalBalance: totalIncome - totalExpense };
});
