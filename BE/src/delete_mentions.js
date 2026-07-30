import fs from 'fs';
import Database from 'better-sqlite3';

const db = new Database('../data/ourcrowd.db');
db.pragma('foreign_keys = ON');
const before = { mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.exec('DELETE FROM mentions');
const after = { mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c };
db.close();

fs.writeFileSync('../data/mentions.json', '[]\n');

console.log('Before:', before);
console.log('After:', after);
console.log('Cleared data/mentions.json');
