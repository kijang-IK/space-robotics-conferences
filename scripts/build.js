// Generates README.md, data/editions.csv and data/upcoming.csv from data/conferences/*.json.
// Usage: node scripts/build.js [YYYY-MM-DD]   (reference date for open/closed; default: today)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'conferences');
const AS_OF = process.argv[2] || new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORY_LABEL = {
  space: '우주 / Space',
  aerospace: '항공우주 종합 / Aerospace',
  'space-robotics': '우주 로봇 / Space Robotics',
  robotics: '로봇 / Robotics',
  control: '제어 / Control',
};

const confs = fs
  .readdirSync(DATA)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')));

const iso = (s) => (typeof s === 'string' && ISO.test(s) ? s : null);
const md = (s) => (s == null || s === '' ? '–' : String(s).replace(/\|/g, '\\|').replace(/\n/g, ' '));
const place = (e) => [e.city, e.country].filter(Boolean).join(', ') || 'TBA';
const dates = (e) => {
  const s = iso(e.start_date), t = iso(e.end_date);
  if (!s) return e.start_date || 'TBA';
  return t && t !== s ? `${s} ~ ${t.slice(5)}` : s;
};
const link = (text, url) => (url ? `[${md(text)}](${url})` : md(text));

// Next edition = earliest edition ending on/after AS_OF; falls back to next_edition (e.g. venue not yet announced).
function nextEdition(c) {
  const upcoming = c.editions.filter((e) => (iso(e.end_date) || iso(e.start_date) || `${e.year}-12-31`) >= AS_OF);
  return upcoming[0] || c.next_edition || null;
}
// Earliest deadline still ahead of AS_OF across all editions.
function nextDeadline(c) {
  const all = [...c.editions, c.next_edition].filter(Boolean);
  const ahead = all.filter((e) => iso(e.abstract_deadline) && e.abstract_deadline >= AS_OF);
  ahead.sort((a, b) => a.abstract_deadline.localeCompare(b.abstract_deadline));
  return ahead[0] || null;
}
function status(e) {
  if (!e || !iso(e.abstract_deadline)) return 'TBA';
  return e.abstract_deadline >= AS_OF ? 'OPEN' : 'CLOSED';
}

// ---- CSV ----
const csvCell = (v) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const EDITION_COLS = ['id', 'short_name', 'category', 'year', 'city', 'region', 'country', 'continent', 'venue',
  'start_date', 'end_date', 'abstract_deadline', 'source'];
const editionRows = confs.flatMap((c) =>
  c.editions.map((e) => EDITION_COLS.map((k) => csvCell(k in e ? e[k] : c[k]))),
);
editionRows.sort((a, b) => a[0].localeCompare(b[0]) || Number(a[3]) - Number(b[3]));
fs.writeFileSync(path.join(ROOT, 'data', 'editions.csv'),
  [EDITION_COLS.join(','), ...editionRows.map((r) => r.join(','))].join('\n') + '\n');

const UP_COLS = ['id', 'short_name', 'category', 'next_year', 'next_place', 'next_dates', 'next_deadline_for',
  'next_deadline', 'status', 'official_url'];
const upRows = confs.map((c) => {
  const ne = nextEdition(c), nd = nextDeadline(c);
  const target = nd || ne;
  return {
    c, ne, nd, deadline: target ? target.abstract_deadline : null, st: nd ? 'OPEN' : status(ne),
    row: [c.id, c.short_name, c.category, ne && ne.year, ne && place(ne), ne && dates(ne), target && target.year,
      target && target.abstract_deadline, nd ? 'OPEN' : status(ne), c.official_url],
  };
});
fs.writeFileSync(path.join(ROOT, 'data', 'upcoming.csv'),
  [UP_COLS.join(','), ...upRows.map((u) => u.row.map(csvCell).join(','))].join('\n') + '\n');

// ---- README ----
const out = [];
const nEd = confs.reduce((n, c) => n + c.editions.length, 0);
out.push('# 우주 · 로봇 분야 주요 국제학회 정리 / Space & Robotics Conferences');
out.push('');
out.push('우주·항공우주·로봇·제어 분야 주요 국제학회의 **역대 개최지, 일정, abstract/논문 마감일**을 모아둔 저장소입니다.  ');
out.push('A curated list of major international conferences in **space, aerospace, robotics and control** — past venues, dates, and abstract/paper deadlines.');
out.push('');
out.push(`> **기준일 / As of: ${AS_OF}** · 학회 ${confs.length}개 conferences · 개최 기록 ${nEd}건 editions  `);
out.push('> 모든 값에는 출처 URL이 붙어 있습니다 / Every value has a source URL (`data/conferences/*.json`).  ');
out.push('> 마감일은 자주 연장되니 **제출 전 반드시 공식 사이트를 확인하세요.** / Deadlines change often — **always check the official site before submitting.**');
out.push('');
out.push('- `OPEN` 공지된 마감일이 기준일 이후 / announced deadline is still ahead · `CLOSED` 마감 지남 / passed · `TBA` 미공지 / not announced');
out.push('- abstract 단계가 없는 학회(ICRA, IROS 등)는 **full paper 마감일**을 표기합니다. / For full-paper venues (ICRA, IROS, …) the **paper deadline** is shown.');
out.push('');

out.push('## 📅 다가오는 마감 / Upcoming Deadlines');
out.push('');
out.push('| 마감 Deadline | 학회 Conference | 회차 Edition | 개최지 Location | 일정 Dates |');
out.push('|---|---|---|---|---|');
upRows
  .filter((u) => u.nd)
  .sort((a, b) => a.nd.abstract_deadline.localeCompare(b.nd.abstract_deadline))
  .forEach(({ c, nd }) => {
    out.push(`| **${nd.abstract_deadline}** | ${link(c.short_name, c.official_url)} | ${nd.year} | ${md(place(nd))} | ${md(dates(nd))} |`);
  });
out.push('');

out.push('## 🗂️ 학회 목록 / Conference List');
out.push('');
for (const cat of Object.keys(CATEGORY_LABEL)) {
  const list = upRows.filter((u) => u.c.category === cat).sort((a, b) => a.c.short_name.localeCompare(b.c.short_name));
  if (!list.length) continue;
  out.push(`### ${CATEGORY_LABEL[cat]}`);
  out.push('');
  out.push('| 학회 Conference | 주기·시기 Frequency | 제출 방식 Submission | 통상 마감 Typical deadline | 다음 회차 Next | 마감 Deadline | 상태 Status |');
  out.push('|---|---|---|---|---|---|---|');
  for (const { c, ne, nd, deadline, st } of list) {
    const name = `${link(c.short_name, c.official_url)}<br><sub>${md(c.full_name)}</sub>`;
    const when = `${md(c.frequency)}<br><sub>${md(c.typical_month)}</sub>`;
    const nextTxt = ne && ne.year ? `${ne.year} ${md(place(ne))}<br><sub>${md(dates(ne))}</sub>` : 'TBA';
    out.push(`| ${name} | ${when} | ${md(short(c.submission && c.submission.type))} | ${md(short(c.submission && c.submission.typical_abstract_deadline))} | ${nextTxt} | ${md(deadline)}${nd && ne && nd.year !== ne.year ? ` <sub>(${nd.year})</sub>` : ''} | ${st} |`);
  }
  out.push('');
}

out.push('## 🌏 역대 개최지 / Past Venues');
out.push('');
for (const cat of Object.keys(CATEGORY_LABEL)) {
  for (const c of confs.filter((c) => c.category === cat).sort((a, b) => a.short_name.localeCompare(b.short_name))) {
    out.push(`<details><summary><b>${md(c.short_name)}</b> — ${md(c.full_name)} (${c.editions.length})</summary>`);
    out.push('');
    out.push('| 연도 Year | 개최지 Location | 장소 Venue | 일정 Dates | 마감 Deadline |');
    out.push('|---|---|---|---|---|');
    for (const e of [...c.editions].sort((a, b) => b.year - a.year)) {
      out.push(`| ${link(e.year, e.source)} | ${md(place(e))} | ${md(e.venue)} | ${md(dates(e))} | ${md(e.abstract_deadline)} |`);
    }
    out.push('');
    out.push('</details>');
    out.push('');
  }
}

out.push('## 📁 데이터 구조 / Data Layout');
out.push('');
out.push('```');
out.push('data/conferences/<id>.json   학회별 원본 데이터 (출처·노트 포함) / per-conference source of truth, with sources & notes');
out.push('data/organizations/*.json    주최 기관 정보 / organizing bodies (e.g. IAA)');
out.push('data/editions.csv            개최 기록 평탄화 / flattened editions (for diff & cross-check)');
out.push('data/upcoming.csv            다음 회차·마감 요약 / next edition & deadline per conference');
out.push('scripts/build.js             JSON → README & CSV');
out.push('scripts/compare.js           다른 조사 결과와 교차검증 / cross-check against another dataset');
out.push('```');
out.push('');
out.push('## 🤝 기여 / Contributing');
out.push('');
out.push('1. `data/conferences/<id>.json`을 수정합니다 (출처 URL 필수). / Edit the JSON (a source URL is required).');
out.push('2. `node scripts/build.js`로 README와 CSV를 다시 생성합니다. / Regenerate README & CSV.');
out.push('3. 같은 스키마의 다른 조사 결과가 있으면 `node scripts/compare.js other.json`으로 불일치를 확인합니다. / Cross-check another dataset in the same schema.');
out.push('');
out.push('확인되지 않은 값은 `null`로 두고 `notes`에 이유를 적습니다. 오류 제보는 Issue/PR로 부탁드립니다.  ');
out.push('Unverified values are `null` with the reason in `notes`. Corrections via Issues/PRs are welcome.');
out.push('');
out.push('## 📜 라이선스 / License');
out.push('');
out.push('[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — 출처 표시 후 자유롭게 사용 가능 / free to share and adapt with attribution.');
out.push('');

fs.writeFileSync(path.join(ROOT, 'README.md'), out.join('\n'));
console.log(`README.md, data/editions.csv, data/upcoming.csv built (as of ${AS_OF}, ${confs.length} conferences)`);

function short(s, n = 90) {
  if (!s) return s;
  const first = String(s);
  return first.length > n ? first.slice(0, n - 1) + '…' : first;
}
