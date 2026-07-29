import Database from 'better-sqlite3';
const db = new Database('../data/ourcrowd.db');
db.pragma('foreign_keys = ON');
const before = { companies: db.prepare('SELECT COUNT(*) as c FROM companies').get().c, mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.exec('DELETE FROM companies');
const after = { companies: db.prepare('SELECT COUNT(*) as c FROM companies').get().c, mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.close();
console.log('Before:', before);
console.log('After:', after);