import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Compile the TS parser to JS so we can exercise it directly.
const dir = '/private/tmp/claude-501/-Users-jessi-Downloads-Hot-Truck-Map/ecffbaee-41ac-431a-8988-c4e806f5db15/scratchpad';
execSync(
  `npx tsc /Users/jessi/Downloads/Hot-Truck-Map/lib/festivals-bulk.ts --outDir ${dir}/built --module esnext --target es2022 --moduleResolution bundler`,
  { cwd: '/Users/jessi/Downloads/Hot-Truck-Map', stdio: 'inherit' }
);
writeFileSync(`${dir}/built/package.json`, '{"type":"module"}');

const { parseDateRange, parseFestivalLines } = await import(`${dir}/built/festivals-bulk.js`);

const TODAY = new Date('2026-09-02T12:00:00Z');
let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};

// Date shapes taken from the user's actual September list.
check('Sept 12',        parseDateRange('Sept 12', TODAY),        { start: '2026-09-12', end: '2026-09-12' });
check('September 7',    parseDateRange('September 7', TODAY),    { start: '2026-09-07', end: '2026-09-07' });
check('Sept 18-20',     parseDateRange('Sept 18-20', TODAY),     { start: '2026-09-18', end: '2026-09-20' });
check('Sept 26–27 endash', parseDateRange('Sept 26–27', TODAY),  { start: '2026-09-26', end: '2026-09-27' });
check('Sep 5-7',        parseDateRange('Sep 5-7', TODAY),        { start: '2026-09-05', end: '2026-09-07' });
check('Sept 10 - Oct 12', parseDateRange('Sept 10 - Oct 12', TODAY), { start: '2026-09-10', end: '2026-10-12' });
check('Sept 3–6',       parseDateRange('Sept 3–6', TODAY),       { start: '2026-09-03', end: '2026-09-06' });
check('9/12',           parseDateRange('9/12', TODAY),           { start: '2026-09-12', end: '2026-09-12' });
check('ISO',            parseDateRange('2026-09-12', TODAY),     { start: '2026-09-12', end: '2026-09-12' });
check('ISO range',      parseDateRange('2026-09-12 to 2026-09-13', TODAY), { start: '2026-09-12', end: '2026-09-13' });
check('Sept 12, 2027',  parseDateRange('Sept 12, 2027', TODAY),  { start: '2027-09-12', end: '2027-09-12' });
check('Sept 12th',      parseDateRange('Sept 12th', TODAY),      { start: '2026-09-12', end: '2026-09-12' });
check('to keyword',     parseDateRange('Sept 4 to Sept 6', TODAY), { start: '2026-09-04', end: '2026-09-06' });

// Year rollover: a January date pasted in September belongs to next year.
check('Jan 15 rolls fwd', parseDateRange('Jan 15', TODAY),       { start: '2027-01-15', end: '2027-01-15' });
// But an event that started three weeks ago stays in the current year.
check('Aug 20 stays',   parseDateRange('Aug 20', TODAY),         { start: '2026-08-20', end: '2026-08-20' });
check('Dec 30 - Jan 2', parseDateRange('Dec 30 - Jan 2', TODAY), { start: '2026-12-30', end: '2027-01-02' });

// Bad input must be reported, never guessed.
check('empty',          parseDateRange('', TODAY),               { error: 'date is missing' });
check('Feb 30',         parseDateRange('Feb 30', TODAY),         { error: '"Feb 30" is not a real date' });
check('gibberish',      parseDateRange('sometime soon', TODAY),  { error: 'could not read the date "sometime soon"' });
check('month only',     parseDateRange('September', TODAY),      { error: 'could not read the date "September"' });

// Whole-paste behaviour, in the format the box documents.
const sample = `
# BERGEN COUNTY
Ridgefield PBA 330 Food Truck Festival | Ridgefield | Sept 12 | Veterans Memorial Field, 554 Shaler Blvd | 11 AM-7 PM. Food-truck focused.
Bergen County Fall Harvest Festival | Ridgefield Park | Sept 18-20 | Overpeck County Park
Saddle Brook Street Fair | Saddle Brook | Sept 20

# Bad rows
Missing date row | Newark
Broken date | Newark | sometime in fall
Ridgefield PBA 330 Food Truck Festival | Ridgefield | Sept 12 | dup
`;
const r = parseFestivalLines(sample, TODAY);
check('rows parsed', r.rows.length, 3);
check('issues found', r.issues.length, 3);
check('row 1', r.rows[0], {
  name: 'Ridgefield PBA 330 Food Truck Festival', county: 'Bergen', city: 'Ridgefield',
  venue: 'Veterans Memorial Field, 554 Shaler Blvd',
  description: '11 AM-7 PM. Food-truck focused.',
  start_date: '2026-09-12', end_date: '2026-09-12',
});
check('row 2 no description', r.rows[1].description, null);
check('row 3 no venue', r.rows[2].venue, null);
check('duplicate flagged', r.issues[2].error, 'duplicate of an earlier line in this paste');

// County headings: set the county for everything beneath, in several shapes.
const counties = parseFestivalLines(`
# BERGEN COUNTY
A | Ridgefield | Sept 12
## Essex
B | Livingston | Sept 13
# County: Cape May
C | Wildwood | Sept 14
#
D | Nowhere | Sept 15
`, TODAY);
check('BERGEN COUNTY -> Bergen', counties.rows[0].county, 'Bergen');
check('## Essex -> Essex',       counties.rows[1].county, 'Essex');
check('# County: Cape May',      counties.rows[2].county, 'Cape May');
check('bare # clears county',    counties.rows[3].county, null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
