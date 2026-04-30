Parse.Cloud.define('addTransaction', async (request) => {
  const { userId, type, amount, category, transactionDate, note } = request.params;

  if (!userId || !category || !transactionDate) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'userId, category, and transactionDate are required.'
    );
  }

  if (!['INCOME', 'EXPENSE'].includes(type)) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      "type must be 'INCOME' or 'EXPENSE'."
    );
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'amount must be a positive number.'
    );
  }

  const transaction = new Parse.Object('Transactions');

  transaction.set('userId', userId);
  transaction.set('type', type);
  transaction.set('amount', amount);
  transaction.set('category', category);
  transaction.set('transactionDate', new Date(transactionDate));
  if (note !== undefined) transaction.set('note', note);

  const saved = await transaction.save(null, { useMasterKey: true });

  return { success: true, transactionId: saved.id };
});
