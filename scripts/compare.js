// Cross-checks another research result (e.g. GPT output in the same JSON schema) against data/conferences.
// Usage: node scripts/compare.js <other.json> [report.md]
// <other.json> may be an array of conference objects or { conferences: [...] }.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'conferences');
const [otherPath, reportPath = path.join(ROOT, 'compare-report.md')] = process.argv.slice(2);
if (!otherPath) {
  console.error('usage: node scripts/compare.js <other.json> [report.md]');
  process.exit(1);
}

const FIELDS = ['city', 'country', 'start_date', 'end_date', 'abstract_deadline'];
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const COUNTRY = { usa: 'United States', us: 'United States', unitedstatesofamerica: 'United States', korea: 'South Korea',
  republicofkorea: 'South Korea', uk: 'United Kingdom', uae: 'United Arab Emirates', turkiye: 'Turkey' };
const norm = (f, v) => {
  if (v == null || v === '') return null;
  const s = String(v).trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (f === 'country') return key(COUNTRY[key(s)] || s);
  // Compare the core city name: "Austin, TX" = "Austin", "Jeju (Seogwipo)" = "Jeju".
  if (f === 'city') return key(s.split(/[,(]/)[0]);
  return s;
};
// City names that differ only by a qualifier on one side ("Madrid" vs "Tres Cantos (Madrid)") are not conflicts.
const sameCity = (a, b) => a === b || a.includes(b) || b.includes(a);

const ours = fs.readdirSync(DATA).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')));
let theirs = JSON.parse(fs.readFileSync(otherPath, 'utf8'));
if (!Array.isArray(theirs)) theirs = theirs.conferences;

const find = (o) => ours.find((c) => key(c.id) === key(o.id) || key(c.short_name) === key(o.short_name));

const conflicts = [], fills = [], onlyTheirs = [], onlyOurs = [], unmatched = [];
const matched = new Set();
for (const t of theirs) {
  const c = find(t);
  if (!c) { unmatched.push(t.short_name || t.id); continue; }
  matched.add(c.id);
  const byYear = (list) => new Map((list || []).filter((e) => e && e.year).map((e) => [Number(e.year), e]));
  const oe = byYear(c.editions), te = byYear(t.editions);
  for (const [y, e2] of te) {
    const e1 = oe.get(y);
    if (!e1) { onlyTheirs.push({ id: c.id, year: y, e: e2 }); continue; }
    for (const f of FIELDS) {
      const a = norm(f, e1[f]), b = norm(f, e2[f]);
      const differ = f === 'city' ? !sameCity(a || '', b || '') && !sameCity(key(String(e1[f])), key(String(e2[f]))) : a !== b;
      if (a && b && differ) conflicts.push({ id: c.id, year: y, f, ours: e1[f], theirs: e2[f], oSrc: e1.source, tSrc: e2.source });
      else if (!a && b) fills.push({ id: c.id, year: y, f, theirs: e2[f], tSrc: e2.source });
    }
  }
  // Only count our editions inside the year range the other dataset covers.
  const theirYears = [...te.keys()];
  const lo = Math.min(...theirYears), hi = Math.max(...theirYears);
  for (const y of oe.keys()) if (!te.has(y) && y >= lo && y <= hi) onlyOurs.push({ id: c.id, year: y });
}
const notCovered = ours.filter((c) => !matched.has(c.id)).map((c) => c.short_name);

const md = (s) => (s == null ? '–' : String(s).replace(/\|/g, '\\|'));
const src = (u) => (u ? `[src](${u})` : '–');
const out = [`# 교차검증 리포트`, '', `비교 대상: \`${path.basename(otherPath)}\``, '',
  `- 값 불일치: **${conflicts.length}**건`, `- 우리 쪽 빈칸을 채울 수 있는 값: **${fills.length}**건`,
  `- 상대에만 있는 회차: **${onlyTheirs.length}**건 · 우리에만 있는 회차: ${onlyOurs.length}건`,
  `- 매칭 안 된 학회(상대): ${unmatched.join(', ') || '없음'} · 상대가 다루지 않은 학회: ${notCovered.join(', ') || '없음'}`, ''];

out.push('## ⚠️ 값 불일치 (공식 사이트로 확인 필요)', '', '| 학회 | 연도 | 항목 | 우리 | 상대 | 출처(우리) | 출처(상대) |', '|---|---|---|---|---|---|---|');
conflicts.forEach((x) => out.push(`| ${x.id} | ${x.year} | ${x.f} | ${md(x.ours)} | ${md(x.theirs)} | ${src(x.oSrc)} | ${src(x.tSrc)} |`));
out.push('', '## ➕ 빈칸 보완 후보 (상대 값의 출처 확인 후 반영)', '', '| 학회 | 연도 | 항목 | 상대 값 | 출처 |', '|---|---|---|---|---|');
fills.forEach((x) => out.push(`| ${x.id} | ${x.year} | ${x.f} | ${md(x.theirs)} | ${src(x.tSrc)} |`));
out.push('', '## 🆕 상대에만 있는 회차', '', '| 학회 | 연도 | 개최지 | 일정 | 출처 |', '|---|---|---|---|---|');
onlyTheirs.forEach((x) => out.push(`| ${x.id} | ${x.year} | ${md([x.e.city, x.e.country].filter(Boolean).join(', '))} | ${md(x.e.start_date)} | ${src(x.e.source)} |`));
out.push('', '## 🔍 우리에만 있는 회차 (상대 조사 범위 안)', '', onlyOurs.map((x) => `${x.id} ${x.year}`).join(' · ') || '없음');
out.push('');

fs.writeFileSync(reportPath, out.join('\n'));
console.log(`conflicts=${conflicts.length} fills=${fills.length} onlyTheirs=${onlyTheirs.length} onlyOurs=${onlyOurs.length} -> ${reportPath}`);
