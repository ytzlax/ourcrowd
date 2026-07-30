import fs from 'fs';
import Database from 'better-sqlite3';

const db = new Database('../data/ourcrowd.db');
db.pragma('foreign_keys = ON');
const before = {
  mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c,
  q_mentions: db.prepare('SELECT COUNT(*) as c FROM q_mentions').get().c,
  mention_fetch_cursor: db
    .prepare('SELECT lastCompanyIndex FROM mention_fetch_cursor WHERE id = 1')
    .get()?.lastCompanyIndex ?? null,
};
db.exec('DELETE FROM mentions');
db.exec('DELETE FROM q_mentions');
db.prepare(`
  UPDATE mention_fetch_cursor
  SET lastCompanyIndex = 0, updatedAt = ?
  WHERE id = 1
`).run(new Date().toISOString());
const after = {
  mentions: db.prepare('SELECT COUNT(*) as c FROM mentions').get().c,
  q_mentions: db.prepare('SELECT COUNT(*) as c FROM q_mentions').get().c,
  mention_fetch_cursor: db
    .prepare('SELECT lastCompanyIndex FROM mention_fetch_cursor WHERE id = 1')
    .get()?.lastCompanyIndex ?? null,
};
db.close();

fs.writeFileSync('../data/mentions.json', '[]\n');

console.log('Before:', before);
console.log('After:', after);
console.log('Cleared data/mentions.json');
