Parse.Cloud.define('getDonutChartData', async (request) => {
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
  query.limit(1000);

  const results = await query.find({ useMasterKey: true });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals = new Map();

  for (const t of results) {
    const type = t.get('type');
    const amount = t.get('amount');
    if (type === 'INCOME') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      const category = t.get('category');
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
    }
  }

  const chartData = totalExpense === 0 ? [] :
    Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalExpense) * 10000) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    chartData,
  };
});
