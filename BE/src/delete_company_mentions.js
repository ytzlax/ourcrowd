import fs from 'fs';
import Database from 'better-sqlite3';

const companyName = process.argv[2]?.trim();
if (!companyName) {
  console.error('Usage: node src/delete_company_mentions.js "Air EV"');
  process.exit(1);
}

const db = new Database('../data/ourcrowd.db');
db.pragma('foreign_keys = ON');

const company = db
  .prepare('SELECT id, name FROM companies WHERE LOWER(name) = LOWER(?)')
  .get(companyName);

if (!company) {
  console.error(`Company not found: "${companyName}"`);
  db.close();
  process.exit(1);
}

const before = {
  mentions: db
    .prepare('SELECT COUNT(*) as c FROM mentions WHERE companyId = ?')
    .get(company.id).c,
  q_mentions: db
    .prepare('SELECT COUNT(*) as c FROM q_mentions WHERE companyId = ?')
    .get(company.id).c,
};

db.prepare('DELETE FROM mentions WHERE companyId = ?').run(company.id);
db.prepare('DELETE FROM q_mentions WHERE companyId = ?').run(company.id);
db.prepare(`
  UPDATE companies
  SET lastMentionedAt = NULL,
      status = 'NO_COVERAGE_FOUND',
      updatedAt = ?
  WHERE id = ?
`).run(new Date().toISOString(), company.id);

const after = {
  mentions: db
    .prepare('SELECT COUNT(*) as c FROM mentions WHERE companyId = ?')
    .get(company.id).c,
  q_mentions: db
    .prepare('SELECT COUNT(*) as c FROM q_mentions WHERE companyId = ?')
    .get(company.id).c,
};

// Point fetch cursor at this company so fetch-cron:now runs it next
const companies = db
  .prepare('SELECT id, name FROM companies ORDER BY name ASC')
  .all();
const companyIndex = companies.findIndex((row) => row.id === company.id);
const cursorBefore = db
  .prepare('SELECT lastCompanyIndex FROM mention_fetch_cursor WHERE id = 1')
  .get()?.lastCompanyIndex ?? null;

db.prepare(`
  UPDATE mention_fetch_cursor
  SET lastCompanyIndex = ?, updatedAt = ?
  WHERE id = 1
`).run(companyIndex, new Date().toISOString());

const cursorAfter = db
  .prepare('SELECT lastCompanyIndex FROM mention_fetch_cursor WHERE id = 1')
  .get()?.lastCompanyIndex ?? null;

db.close();

const mentionsPath = '../data/mentions.json';
const mentions = JSON.parse(fs.readFileSync(mentionsPath, 'utf8'));
const filtered = mentions.filter((m) => m.companyId !== company.id);
fs.writeFileSync(mentionsPath, `${JSON.stringify(filtered, null, 2)}\n`);

console.log(`Company: ${company.name} (${company.id})`);
console.log('Before:', before);
console.log('After:', after);
console.log(
  `Fetch cursor: ${cursorBefore} -> ${cursorAfter} ` +
    `(next fetch: ${company.name}, index ${companyIndex + 1}/${companies.length})`,
);
console.log(
  `Updated data/mentions.json (${mentions.length} -> ${filtered.length})`,
);
