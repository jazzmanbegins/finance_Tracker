Parse.Cloud.define('getYearlySummary', async (request) => {
  const { userId, year } = request.params;

  if (!userId) throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId is required.');
  if (typeof year !== 'number' || year < 2000) throw new Parse.Error(Parse.Error.INVALID_QUERY, 'year must be valid.');

  const startDate = new Date(year, 0, 1);
  const endDate   = new Date(year + 1, 0, 1);

  const query = new Parse.Query('Transactions');
  query.equalTo('userId', userId);
  query.greaterThanOrEqualTo('transactionDate', startDate);
  query.lessThan('transactionDate', endDate);
  query.limit(10000);

  const results = await query.find({ useMasterKey: true });

  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));

  for (const t of results) {
    const date   = t.get('transactionDate');
    const m      = date.getMonth();
    const amount = t.get('amount');
    if (t.get('type') === 'INCOME') months[m].income += amount;
    else months[m].expense += amount;
  }

  const summary = months
    .filter(m => m.income > 0 || m.expense > 0)
    .map(m => ({ ...m, balance: m.income - m.expense }));

  const totalIncome  = summary.reduce((s, m) => s + m.income, 0);
  const totalExpense = summary.reduce((s, m) => s + m.expense, 0);

  return { months: summary, totalIncome, totalExpense, totalBalance: totalIncome - totalExpense };
});
