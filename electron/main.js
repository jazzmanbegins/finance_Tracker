const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const Datastore = require('@seald-io/nedb');

let mainWindow;
const PORT = 1337;

// ── Helpers: wrap nedb callback API in Promises ──────────────────────────────

function dbFind(db, query, sort) {
  return new Promise((resolve, reject) => {
    const cursor = db.find(query);
    if (sort) cursor.sort(sort);
    cursor.exec((err, docs) => (err ? reject(err) : resolve(docs)));
  });
}

function dbInsert(db, doc) {
  return new Promise((resolve, reject) => {
    db.insert(doc, (err, newDoc) => (err ? reject(err) : resolve(newDoc)));
  });
}

function dbRemove(db, query, options) {
  return new Promise((resolve, reject) => {
    db.remove(query, options || {}, (err, n) => (err ? reject(err) : resolve(n)));
  });
}

// ── Server ───────────────────────────────────────────────────────────────────

async function startServer() {
  const userDataPath = app.getPath('userData');
  const dbFile = path.join(userDataPath, 'transactions.db');

  const db = new Datastore({ filename: dbFile, autoload: true });

  const publicPath = app.isPackaged
    ? path.join(process.resourcesPath, 'public')
    : path.join(__dirname, '..', 'public');

  const srv = express();
  srv.use(express.json());

  // Health check (loading.html polls this)
  srv.get('/parse/health', (_req, res) => res.json({ status: 'ok' }));

  // ── addTransaction ─────────────────────────────────────────────────────────
  srv.post('/parse/functions/addTransaction', async (req, res) => {
    try {
      const { userId, type, amount, category, transactionDate, note } = req.body;

      if (!userId || !category || !transactionDate)
        return res.json({ code: 141, error: 'userId, category, and transactionDate are required.' });

      if (!['INCOME', 'EXPENSE'].includes(type))
        return res.json({ code: 141, error: "type must be 'INCOME' or 'EXPENSE'." });

      if (typeof amount !== 'number' || amount <= 0)
        return res.json({ code: 141, error: 'amount must be a positive number.' });

      const doc = {
        userId,
        type,
        amount,
        category,
        transactionDate: new Date(transactionDate),
        note: note || null,
        createdAt: new Date(),
      };

      const saved = await dbInsert(db, doc);
      res.json({ result: { success: true, transactionId: saved._id } });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── getTransactions ────────────────────────────────────────────────────────
  srv.post('/parse/functions/getTransactions', async (req, res) => {
    try {
      const { userId, month, year } = req.body;

      if (!userId) return res.json({ code: 141, error: 'userId is required.' });
      if (typeof month !== 'number' || month < 1 || month > 12)
        return res.json({ code: 141, error: 'month must be between 1 and 12.' });
      if (typeof year !== 'number' || year < 2000)
        return res.json({ code: 141, error: 'year must be a valid 4-digit year.' });

      const startDate = new Date(year, month - 1, 1);
      const endDate   = new Date(year, month, 1);

      const docs = await dbFind(
        db,
        { userId, transactionDate: { $gte: startDate, $lt: endDate } },
        { transactionDate: -1 }
      );

      res.json({
        result: docs.map((t) => ({
          id:              t._id,
          userId:          t.userId,
          type:            t.type,
          amount:          t.amount,
          category:        t.category,
          transactionDate: t.transactionDate,
          note:            t.note ?? null,
        })),
      });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── getDonutChartData ──────────────────────────────────────────────────────
  srv.post('/parse/functions/getDonutChartData', async (req, res) => {
    try {
      const { userId, month, year } = req.body;

      if (!userId) return res.json({ code: 141, error: 'userId is required.' });

      const startDate = new Date(year, month - 1, 1);
      const endDate   = new Date(year, month, 1);

      const docs = await dbFind(db, {
        userId,
        transactionDate: { $gte: startDate, $lt: endDate },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      const catMap = {};

      for (const t of docs) {
        if (t.type === 'INCOME') {
          totalIncome += t.amount;
        } else {
          totalExpense += t.amount;
          catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        }
      }

      const chartData = Object.entries(catMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }));

      res.json({
        result: {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          chartData,
        },
      });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── getAllTimeTotal ─────────────────────────────────────────────────────────
  srv.post('/parse/functions/getAllTimeTotal', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.json({ code: 141, error: 'userId is required.' });

      const docs = await dbFind(db, { userId });

      let totalIncome = 0;
      let totalExpense = 0;
      for (const t of docs) {
        if (t.type === 'INCOME') totalIncome += t.amount;
        else totalExpense += t.amount;
      }

      res.json({
        result: {
          totalIncome,
          totalExpense,
          totalBalance: totalIncome - totalExpense,
        },
      });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── deleteTransaction ──────────────────────────────────────────────────────
  srv.post('/parse/functions/deleteTransaction', async (req, res) => {
    try {
      const { transactionId } = req.body;
      if (!transactionId) return res.json({ code: 141, error: 'transactionId is required.' });

      const n = await dbRemove(db, { _id: transactionId }, {});
      if (n === 0) return res.json({ code: 141, error: 'Transaction not found.' });

      res.json({ result: { success: true } });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── clearTransactions ──────────────────────────────────────────────────────
  srv.post('/parse/functions/clearTransactions', async (req, res) => {
    try {
      const { userId, month, year } = req.body;

      const startDate = new Date(year, month - 1, 1);
      const endDate   = new Date(year, month, 1);

      const n = await dbRemove(
        db,
        { userId, transactionDate: { $gte: startDate, $lt: endDate } },
        { multi: true }
      );

      res.json({ result: { deleted: n } });
    } catch (e) {
      res.json({ code: 141, error: e.message });
    }
  });

  // ── Shutdown ───────────────────────────────────────────────────────────────
  srv.post('/shutdown', (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => app.quit(), 400);
  });

  // Static frontend
  srv.use(express.static(publicPath));

  await new Promise((resolve, reject) => {
    const server = srv.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: 'Finance Tracker',
    show: false,
    backgroundColor: '#0d1117',
  });

  mainWindow.setMenuBarVisibility(false);

  const loadingPath = app.isPackaged
    ? path.join(process.resourcesPath, 'loading.html')
    : path.join(__dirname, '..', 'loading.html');

  mainWindow.loadFile(loadingPath);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  startServer()
    .then(() => mainWindow.loadURL(`http://localhost:${PORT}`))
    .catch((err) => {
      console.error('Server start failed:', err);
      dialog.showErrorBox(
        'Finance Tracker — เกิดข้อผิดพลาด',
        `ไม่สามารถเริ่มต้นระบบได้\n\n${err.message}\n\nกรุณาปิดและเปิดโปรแกรมใหม่`
      );
      app.quit();
    });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
