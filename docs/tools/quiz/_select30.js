const fs = require('fs');
const src = fs.readFileSync('data-etap9.js','utf8');
eval('var STAGES = [' + src + '];');
const all = STAGES[0].questions;

const pick = [
  "Как курс описывает связь коммерции и развития творчества?",
  "Какой стратегией PinkPantheress вышла в индустрию?",
  "Для чего VK лучше всего подходит согласно карте платформ курса?",
  "В чём главное преимущество YouTube Shorts перед TikTok по курсу?",
  "Чем SoundCloud по курсу НЕ является?",
  "Что, по таблице курса, стоит брать с пути Tay Keith?",
  "Как курс определяет «свой звук»?",
  "Когда курс советует задавать вопросы опытному сведущему, чью сессию вы наблюдаете?",
  "Что включает лицензия Premium Lease на BeatStars?",
  "Какой процент продавца на AudioJungle?",
  "Что курс говорит о пассивном доходе со стоковых площадок?",
  "Какой главный урок даёт пример Internet Money?",
  "Что курс говорит о выборе между «битмейкер» и «артист»?",
  "Чем DistroKid отличается от CDBaby по условиям?",
  "Какой из «бесплатных» дистрибьюторов по таблице курса всё же берёт процент с дохода?",
  "Что произойдёт, если ваш трек громче целевого LUFS площадки?",
  "Сколько примерно принесёт 1 000 000 прослушиваний в месяц на Spotify по таблице курса?",
  "Какой урок курс выводит из кейса Flume?",
  "Что иллюстрирует пример Kanye West?",
  "Что показывает кейс Drake?",
  "Что курс говорит о ожидании «идеального момента» для монетизации?",
  "Что такое правило 70/30 из курса?",
  "Что такое второй шаг в пошаговом плане монетизации?",
  "Что нужно уточнить до начала работы над заказом?",
  "Что курс говорит о работе «на доверии»?",
  "Как возникает авторское право на музыку?",
  "Кто получает performance royalties (роялти за публичное исполнение)?",
  "Что такое split sheet и когда его нужно заполнять?",
  "Что означает эксклюзивная лицензия (Exclusive License) на бит?",
  "Что по плану финала нужно сделать в краткосрочной перспективе (1–4 недели)?"
];

const byQ = {};
for (const q of all) byQ[q.q] = q;
const sel = pick.map(t => { const q = byQ[t]; if (!q) throw new Error('NOT FOUND: ' + t); return q; });
if (sel.length !== 30) throw new Error('count ' + sel.length);

// serialize in the same style as existing file
function s(x){ return JSON.stringify(x); }
let out = `/* ============================================================
   ЭТАП №9 — ПРОДВИЖЕНИЕ И ЗАРАБОТОК (черновик вопросов)
   Файл-источник: встраивается в index.html вместо soon:true
   30 вопросов по всем темам этапа
   ============================================================ */

{
  id: "etap9",
  short: ${s(STAGES[0].short)},
  title: ${s(STAGES[0].title)},
  desc: ${s(STAGES[0].desc)},
  questions: [
`;
out += sel.map(q => `    {
      cat: ${s(q.cat)},
      q: ${s(q.q)},
      options: [
${q.options.map(o => '        ' + s(o)).join(',\n')}
      ],
      correct: ${q.correct},
      comment: ${s(q.comment)}
    }`).join(',\n');
out += `\n  ]
}
`;
fs.writeFileSync('data-etap9.js', out);

// replace the etap9 object inside index.html (keep header comment)
let html = fs.readFileSync('index.html','utf8');
const startMarker = '{\n  id: "etap9",';
const st = html.indexOf(startMarker);
if (st < 0) throw new Error('etap9 not found in index.html');
const end = html.indexOf('\n];', st);
if (end < 0) throw new Error('end marker not found');
html = html.slice(0, st) + out.trimEnd() + '\n' + html.slice(end);
fs.writeFileSync('index.html', html);

// validate
const check = fs.readFileSync('index.html','utf8');
const m = check.indexOf(startMarker);
eval('var S2 = [' + (function(){ const a=check.indexOf('{\n  id: "etap9"'), b=check.indexOf('\n];',a); return check.slice(a,b).trim(); })() + '];');
console.log('OK questions:', S2[0].questions.length);
const cats = {};
for (const q of S2[0].questions) { if(q.correct<0||q.correct>=q.options.length) throw new Error('bad idx'); cats[q.cat]=(cats[q.cat]||0)+1; }
console.log(JSON.stringify(cats));
