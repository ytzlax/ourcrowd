import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('../data/ourcrowd.db');
db.pragma('foreign_keys = ON');
const before = { companies: db.prepare('SELECT COUNT(*) as c FROM companies').get().c, mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.exec('DELETE FROM companies');
const after = { companies: db.prepare('SELECT COUNT(*) as c FROM companies').get().c, mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.close();
fs.writeFileSync('../data/mentions.json', '[]\n');
fs.writeFileSync('../data/companies.json', '[]\n');

console.log('Before:', before);
console.log('After:', after);