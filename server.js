const express = require('express');
const { ParseServer } = require('parse-server');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

const APP_ID = 'finance-app';
const MASTER_KEY = 'master-key-local';
const PORT = 1337;

async function startServer() {
  const dataDir = path.join(__dirname, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  console.log('Starting local MongoDB...');
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbPath: path.join(__dirname, '.data'),
      storageEngine: 'wiredTiger',
    },
  });
  const mongoUri = mongod.getUri();
  console.log(`MongoDB ready (data saved to .data/)`);

  const api = new ParseServer({
    databaseURI: mongoUri,
    appId: APP_ID,
    masterKey: MASTER_KEY,
    serverURL: `http://localhost:${PORT}/parse`,
    cloud: path.join(__dirname, 'cloud/main.js'),
    allowClientClassCreation: true,
    enforcePrivateUsers: false,
    encodeParseObjectInCloudFunction: true,
  });

  await api.start();

  const app = express();
  app.use('/parse', api.app);
  app.use(express.static(path.join(__dirname, 'public')));

  app.post('/shutdown', (req, res) => {
    res.json({ ok: true });
    console.log('\nFinance Tracker หยุดทำงานแล้ว');
    setTimeout(() => process.exit(0), 400);
  });

  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`  Finance Tracker พร้อมใช้งาน!`);
    console.log(`  เปิด browser ไปที่:`);
    console.log(`  http://localhost:${PORT}`);
    console.log('========================================\n');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
