# -*- coding: utf-8 -*-
"""Generate animated workflow pipeline components for potoksite pages."""
import re, sys

SITE = r"C:/Users/IYBETOS/potoksite/site"

# ---------- base CSS extracted from etap6 (single source of truth) ----------
etap6 = open(SITE + "/etap6/index.html", encoding="utf-8").read()
m = re.search(r"<style>\n/\* ===== Live Production Workflow.*?</style>", etap6, re.S)
BASE_CSS = m.group(0)[len("<style>"):-len("</style>")]

EXTRA_CSS = """
/* --- fork chips (etap9) --- */
.lw-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;margin-top:.7rem}
.lw-chip{display:flex;align-items:center;gap:.55rem;padding:.6rem .75rem;border:1px solid var(--border-subtle);border-radius:10px;background:rgba(255,255,255,.02);font-size:.83rem;font-weight:600;color:var(--text-main);transition:border-color .3s ease,transform .3s ease}
.lw-chip svg{width:17px;height:17px;flex:0 0 auto;color:var(--pc)}
.lw-step:hover .lw-chip{border-color:var(--pb);transform:translateX(3px)}
@media (max-width:30em){.lw-chips{grid-template-columns:1fr}}

/* --- equipment kit grid (zvuk/oborudovanie) --- */
.eqk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem;margin-top:1.2rem}
.eqk-card{position:relative;display:flex;flex-direction:column;gap:.4rem;padding:1.1rem 1.15rem;border:1px solid var(--border-subtle);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.03),transparent 45%),var(--bg-card);transition:opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1),border-color .3s ease,box-shadow .3s ease}
.eqk-grid.eqk-js .eqk-card{opacity:0;transform:translateY(16px)}
.eqk-grid.eqk-js .eqk-card.in{opacity:1;transform:none}
.eqk-card:hover{border-color:var(--pb);box-shadow:0 12px 30px -16px var(--pg)}
.eqk-ico{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.03);border:2px solid var(--pb);color:var(--pc)}
.eqk-ico svg{width:21px;height:21px}
.eqk-card h3{margin:0;font-size:.95rem;font-weight:700;color:var(--text-heading)}
.eqk-card p{margin:0;font-size:.84rem;line-height:1.5;color:var(--text-secondary)}
@media (max-width:30em){.eqk-grid{grid-template-columns:1fr}}

/* --- signal map (zvuk/oborudovanie) --- */
.sm-map{display:grid;grid-template-columns:minmax(140px,1fr) minmax(64px,.85fr) 172px minmax(64px,.85fr) minmax(140px,1fr);align-items:center;margin-top:1.4rem;padding-bottom:.9rem}
.sm-side{display:grid;grid-template-rows:repeat(3,72px);gap:1.9rem}
.sm-node{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45rem;padding:.6rem .5rem;border:1px solid var(--border-default);border-radius:12px;background:var(--bg-card);color:var(--text-main);font-size:.8rem;font-weight:600;text-align:center;line-height:1.3;transition:opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1),border-color .3s ease,box-shadow .3s ease}
.sm-node svg{width:22px;height:22px;color:var(--pc)}
.sm-map.sm-js .sm-node,.sm-map.sm-js .sm-hub{opacity:0;transform:translateY(14px)}
.sm-map.sm-js .sm-node.in,.sm-map.sm-js .sm-hub.in{opacity:1;transform:none}
.sm-node:hover{border-color:var(--pb);box-shadow:0 10px 24px -14px var(--pg)}
.sm-wires{display:grid;grid-template-rows:repeat(3,72px);gap:1.9rem}
.sm-wire{position:relative}
.sm-wire::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;border-radius:2px;background:var(--border-default)}
.sm-wire::after{content:"";position:absolute;top:50%;left:0;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(34,211,238,.9);animation:sm-run 2.6s linear infinite;animation-delay:var(--d,0s)}
@keyframes sm-run{0%{left:-2%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:calc(100% - 6px);opacity:0}}
.sm-cable{position:absolute;bottom:-1.45rem;left:50%;transform:translateX(-50%);font-family:"JetBrains Mono",monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);background:var(--bg-main);border:1px solid var(--border-subtle);border-radius:999px;padding:.2rem .5rem;white-space:nowrap}
.sm-hub{grid-row:1/4;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;padding:1.1rem .8rem;border-radius:14px;background:linear-gradient(160deg,rgba(242,153,74,.14),rgba(59,130,246,.14)),var(--bg-card);border:1px solid rgba(242,153,74,.35);color:var(--text-heading);font-size:.85rem;font-weight:700;text-align:center;line-height:1.3;animation:sm-hub-glow 2.6s ease-in-out infinite}
.sm-hub svg{width:24px;height:24px;color:#F2994A}
@keyframes sm-hub-glow{0%,100%{box-shadow:0 0 18px -6px rgba(242,153,74,.4)}50%{box-shadow:0 0 30px -4px rgba(242,153,74,.65)}}
@media (max-width:56em){
 .sm-map{display:block;padding-bottom:0}
 .sm-side{grid-template-rows:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-bottom:1rem}
 .sm-wires{display:none}
 .sm-hub{margin:0 auto 1rem;max-width:260px}
}
@media (prefers-reduced-motion:reduce){
 .eqk-grid.eqk-js .eqk-card,.sm-map.sm-js .sm-node,.sm-map.sm-js .sm-hub{opacity:1;transform:none;transition:none}
 .sm-wire::after,.sm-hub{animation:none!important}
}
"""

FULL_CSS = re.sub(r"\n\s*\n", "\n", (BASE_CSS + EXTRA_CSS))  # no blank lines: keeps markdown HTML blocks intact

# ---------- helpers ----------
def rgba(hexcolor, a):
    h = hexcolor.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return "rgba(%d,%d,%d,%s)" % (r, g, b, a)

def step_vars(color):
    return "--pc:%s;--pb:%s;--pg:%s" % (color, rgba(color, .4), rgba(color, .35))

_PIPE_JS_RAW = """<script>
(function(){
 'use strict';
 var root = document.querySelector('.lw-wrap');
 if(!root) return;
 root.classList.add('lw-js');
 var stepsBox = root.querySelector('.lw-flow');
 var steps = Array.prototype.slice.call(root.querySelectorAll('.lw-step'));
 var fill = root.querySelector('.lw-fill');
 var dot = root.querySelector('.lw-dot');
 var countEl = root.querySelector('.lw-count b');
 var SPINE_TOP = 24, lastIdx = -1;

 function nodeCenter(step){
   var n = step.querySelector('.lw-node');
   return n.getBoundingClientRect().top - stepsBox.getBoundingClientRect().top + n.offsetHeight/2;
 }
 function paint(i){
   if(i < 0) return;
   var c = nodeCenter(steps[i]);
   fill.style.height = Math.max(0, c - SPINE_TOP) + 'px';
   dot.style.top = c + 'px';
   dot.classList.add('on');
 }
 function reveal(i){
   steps[i].classList.add('lw-in');
   lastIdx = i;
   paint(i);
   if(countEl) countEl.textContent = String(i+1).padStart(2,'0');
 }

 var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced || !('IntersectionObserver' in window)){
   steps.forEach(function(s){ s.classList.add('lw-in'); });
   fill.style.height = 'calc(100% - 48px)';
   dot.style.display = 'none';
   if(countEl) countEl.textContent = String(steps.length).padStart(2,'0');
   return;
 }

 var io = new IntersectionObserver(function(entries){
   entries.forEach(function(e){
     if(!e.isIntersecting) return;
     reveal(steps.indexOf(e.target));
     io.unobserve(e.target);
   });
 }, {threshold: 0.35, rootMargin: '0px 0px -8% 0px'});

 steps.forEach(function(s){ io.observe(s); });

 var rt;
 window.addEventListener('resize', function(){
   clearTimeout(rt);
   rt = setTimeout(function(){ if(lastIdx > -1) paint(lastIdx); }, 150);
 });
})();
</script>"""
PIPE_JS = re.sub(r"\n\s*\n", "\n", _PIPE_JS_RAW)

def build_pipeline(label, steps):
    """steps: list of dicts: icon,title,tag,color,desc,num(optional),final(bool),chips(list[(icon,label)])"""
    total = len(steps)
    assert "\n\n" not in FULL_CSS
    out = []
    out.append("<style>%s</style>" % FULL_CSS)
    out.append('<div class="lw-wrap">')
    out.append('  <div class="lw-head">')
    out.append('    <span class="lw-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>')
    out.append('    <span class="lw-head__label">%s</span>' % label)
    out.append('    <span class="lw-count"><b>00</b>/%02d</span>' % total)
    out.append('  </div>')
    out.append('  <div class="lw-flow">')
    out.append('    <div class="lw-spine" aria-hidden="true"></div>')
    out.append('    <div class="lw-fill" aria-hidden="true"></div>')
    out.append('    <div class="lw-dot" aria-hidden="true"></div>')
    out.append('    <ol class="lw-steps">')
    for s in steps:
        cls = "lw-step" + (" lw-step--final" if s.get("final") else "")
        num = s.get("num", "—")
        chips = ""
        if s.get("chips"):
            items = "".join(
                '<span class="lw-chip"><i data-lucide="%s"></i>%s</span>' % (ci, cl)
                for ci, cl in s["chips"])
            chips = '<div class="lw-chips">%s</div>' % items
        out.append('    <li class="%s" style="%s">' % (cls, step_vars(s["color"])))
        out.append('      <div class="lw-node"><i data-lucide="%s"></i></div>' % s["icon"])
        out.append('      <div class="lw-card">')
        eqmini = '<span class="lw-eq--mini" aria-hidden="true"><i></i><i></i><i></i></span>' if s.get("final") else ""
        out.append('        <div class="lw-top"><span class="lw-num">%s</span><h3>%s%s</h3><span class="lw-tag">%s</span></div>' % (num, s["title"], eqmini, s["tag"]))
        out.append('        <p>%s</p>' % s["desc"])
        if chips:
            out.append(chips)
        out.append('      </div>')
        out.append('    </li>')
    out.append('    </ol>')
    out.append('  </div>')
    out.append('</div>')
    out.append(PIPE_JS)
    return "\n".join(out)

# ---------- page data ----------
ORANGE, CYAN, VIOLET, BLUE, GREEN = "#F2994A", "#22D3EE", "#C084FC", "#60A5FA", "#34D399"

PAGES = {}

PAGES["etap5/index.html"] = build_pipeline("Pipeline · EDM-продакшн", [
 dict(icon="lightbulb", title="Идея + Референсы", tag="Подготовка", color=ORANGE, num="01", desc="Собираем референсы и определяем характер трека."),
 dict(icon="audio-lines", title="Синтез звука / Сэмплирование", tag="Создание", color=CYAN, num="02", desc="Генерируем звуки с нуля или находим готовые сэмплы."),
 dict(icon="piano", title="Создание синтов в Serum", tag="Создание", color=CYAN, num="03", desc="Пишем свои пресеты: осцилляторы, фильтры, LFO."),
 dict(icon="scissors", title="Слайс и чоп семплов", tag="Создание", color=CYAN, num="04", desc="Режем сэмплы на части и собираем из них новые ритмы."),
 dict(icon="drum", title="Построение драмки по жанру", tag="Структура", color=VIOLET, num="05", desc="Кик, снейр, хэты — ритмический каркас EDM."),
 dict(icon="sparkles", title="Саунд-дизайн и атмосфера", tag="Структура", color=VIOLET, num="06", desc="Дропы, переходы и текстуры, которые несут энергию."),
 dict(icon="activity", title="Сайдчейн и лее-ринг", tag="Финализация", color=BLUE, num="07", desc="Бас «качает» под кик, лее-ринг ведёт слушателя в дроп."),
 dict(icon="sliders-horizontal", title="Сведение + Мастеринг", tag="Финализация", color=BLUE, num="08", desc="Баланс, громкость и финальный полир."),
 dict(icon="headphones", title="Финальный EDM-трек", tag="Релиз", color=GREEN, num="09", final=True, desc="Готовый трек: слушаем на разных системах и публикуем."),
])

PAGES["etap7/index.html"] = build_pipeline("Pipeline · сведение вокала", [
 dict(icon="mic-vocal", title="Запись вокала", tag="Запись", color=ORANGE, num="01", desc="Чистая запись голоса — фундамент всего сведения."),
 dict(icon="scissors", title="Редакция: ритмика, нарезка", tag="Редакция", color=CYAN, num="02", desc="Выравниваем тайминг и режем лишние куски."),
 dict(icon="sliders-horizontal", title="Тюнинг: Melodyne / Auto-Tune", tag="Редакция", color=CYAN, num="03", desc="Правим интонацию — от естественной к автотуневой."),
 dict(icon="eraser", title="Очистка: шум, реставрация", tag="Редакция", color=CYAN, num="04", desc="Убираем шумы, щелчки и дефекты записи."),
 dict(icon="audio-lines", title="EQ: срез и яркость", tag="Обработка", color=VIOLET, num="05", desc="Срезаем грязь внизу и добавляем воздуха сверху."),
 dict(icon="gauge", title="Компрессия: контроль динамики", tag="Обработка", color=VIOLET, num="06", desc="Выравниваем громкость фраз — вокал «сидит» в миксе."),
 dict(icon="flame", title="Сатурация: плотность", tag="Обработка", color=VIOLET, num="07", desc="Лёгкая перегрузка делает голос плотнее и ближе."),
 dict(icon="waves", title="Пространство: реверб и делэй", tag="Обработка", color=VIOLET, num="08", desc="Глубина и пространство — вокал перестаёт быть «сухим»."),
 dict(icon="volume-x", title="DeEsser и финальные штрихи", tag="Обработка", color=VIOLET, num="09", desc="Приручаем сibilанты («с», «ц») и доводим детали."),
 dict(icon="sliders-vertical", title="Сведение с битом", tag="Сведение", color=BLUE, num="10", desc="Голос встаёт на своё место относительно бита."),
 dict(icon="headphones", title="Бэки и панорама", tag="Сведение", color=BLUE, num="11", desc="Раскладываем бэк-вокал по стерео-картине."),
 dict(icon="disc-3", title="Мастер: Soothe2, LUFS", tag="Сведение", color=BLUE, num="12", desc="Финальный мастер: резонансы и громкость под стандарт."),
 dict(icon="badge-check", title="Финальный чек микса", tag="Финал", color=GREEN, num="13", desc="Проверяем на разных системах и в наушниках."),
 dict(icon="rocket", title="Рендер трека", tag="Финал", color=GREEN, num="14", final=True, desc="Экспортируем готовый трек."),
])

PAGES["etap7/osnovnye-obrabotki/index.html"] = build_pipeline("Pipeline · сигнальная цепочка", [
 dict(icon="sliders-horizontal", title="EQ: срез", tag="Цепочка", color=ORANGE, num="01", desc="Убираем низкие частоты, которые мешают биту."),
 dict(icon="gauge", title="Компрессия", tag="Цепочка", color=CYAN, num="02", desc="Контроль динамики и плотность фраз."),
 dict(icon="flame", title="Сатурация", tag="Цепочка", color=VIOLET, num="03", desc="Тепло и аналоговый характер голоса."),
 dict(icon="volume-x", title="DeEsser", tag="Цепочка", color=BLUE, num="04", desc="Сглаживаем сibilанты после компрессии."),
 dict(icon="sun", title="EQ: яркость", tag="Цепочка", color=ORANGE, num="05", desc="Верхние частоты — воздух и присутствие."),
 dict(icon="waves", title="Реверб", tag="Цепочка", color=CYAN, num="06", desc="Пространство и глубина микса."),
 dict(icon="timer", title="Делэй", tag="Цепочка", color=VIOLET, num="07", desc="Эхо-эффекты и ширина стерео."),
 dict(icon="layers", title="Хорус/Даблер", tag="Цепочка", color=GREEN, num="08", final=True, desc="Утолщаем голос без бэков."),
])

PAGES["etap7/final-chek-miksa/index.html"] = build_pipeline("Pipeline · глубина микса", [
 dict(icon="mic-vocal", title="Вперёд: Вокал", tag="Вперёд", color=ORANGE, num="01", desc="Главный голос — ближе всех к слушателю."),
 dict(icon="drum", title="Середина: Бит, Бас", tag="Середина", color=CYAN, num="02", desc="Кик, снейр и бас держат ритмический фундамент."),
 dict(icon="music", title="Сзади: Мелодии, FX", tag="Сзади", color=VIOLET, num="03", desc="Мелодические слои и эффекты — позади ритма."),
 dict(icon="cloud-fog", title="Фон: Атмосфера, Реверб", tag="Фон", color=BLUE, num="04", desc="Атмосферные текстуры создают глубину микса."),
])

PAGES["etap8/index.html"] = build_pipeline("Pipeline · саундтрек", [
 dict(icon="clipboard-list", title="Бриф и референсы", tag="Подготовка", color=ORANGE, num="01", desc="Задача, настроение и референсы от заказчика."),
 dict(icon="library", title="Подбор библиотеки Kontakt", tag="Подготовка", color=ORANGE, num="02", desc="Оркестровые сэмпл-библиотеки под масштаб картины."),
 dict(icon="palette", title="Настроение и тема", tag="Подготовка", color=ORANGE, num="03", desc="Эмоциональная палитра: мажор/минор, темп, цвет."),
 dict(icon="music", title="Гармония и прогрессии", tag="Написание", color=CYAN, num="04", desc="Аккордовые основы музыкальной истории."),
 dict(icon="guitar", title="Оркестровка инструментов", tag="Написание", color=CYAN, num="05", desc="Какой инструмент несёт какую роль."),
 dict(icon="pen-line", title="Аранжировка и динамика", tag="Написание", color=CYAN, num="06", desc="Структура: вступление, развитие, кульминация."),
 dict(icon="trending-up", title="Развитие темы", tag="Написание", color=CYAN, num="07", desc="Вариации главной темы на протяжении фильма."),
 dict(icon="sliders-horizontal", title="Сведение оркестра", tag="Сведение", color=BLUE, num="08", desc="Баланс секций и инструментов."),
 dict(icon="waves", title="Пространство и реверб", tag="Сведение", color=BLUE, num="09", desc="Зал, пространство и масштаб звучания."),
 dict(icon="disc-3", title="Мастеринг", tag="Финал", color=GREEN, num="10", desc="Громкость и тон под стандарт кино/стриминга."),
 dict(icon="film", title="Подача под картинку", tag="Финал", color=GREEN, num="11", desc="Синхронизация сцены: музыка работает на кадр."),
 dict(icon="headphones", title="Финальный саундтрек", tag="Финал", color=GREEN, num="12", final=True, desc="Готовый трек — в картину или альбом."),
])

PAGES["etap9/index.html"] = build_pipeline("Pipeline · путь продюсера", [
 dict(icon="target", title="Навыки продакшна", tag="База", color=ORANGE, num="01", desc="Синтез, сведение, мастеринг — база уже есть."),
 dict(icon="briefcase", title="Свой звук и портфолио", tag="База", color=ORANGE, num="02", desc="Портфолио треков, которые показывают ваш уровень."),
 dict(icon="git-branch", title="Выбор пути", tag="Ветвление", color=VIOLET, num="—",
      desc="Четыре направления — их можно совмещать.",
      chips=[("disc-3","Битмейкер / Продакшн"),("mic-vocal","Артист / Исполнитель"),
             ("sliders-horizontal","Сведение / Мастеринг"),("sparkles","Саунд-дизайнер")]),
 dict(icon="megaphone", title="Соцсети и продвижение", tag="Карьера", color=BLUE, num="03", desc="Контент, аудитория и первые слушатели."),
 dict(icon="store", title="Площадки и стоки", tag="Карьера", color=BLUE, num="04", desc="Продажа битов на площадках и в стоках."),
 dict(icon="send", title="Дистрибуция на стриминги", tag="Карьера", color=BLUE, num="05", desc="Трек попадает в Spotify, Apple Music и другие."),
 dict(icon="users", title="Работа с клиентами", tag="Карьера", color=BLUE, num="06", desc="Артисты, бренды и заказчики."),
 dict(icon="scale", title="Договоры и права", tag="Карьера", color=BLUE, num="07", desc="Авторские права, роялти и контракты."),
 dict(icon="trending-up", title="Постоянное развитие", tag="Рост", color=GREEN, num="08", desc="Новые техники, оборудование и коллаборации."),
 dict(icon="crown", title="Бренд и медийный образ", tag="Рост", color=GREEN, num="09", final=True, desc="Ваше имя становится брендом в индустрии."),
])

# ---------- zvuk/oborudovanie: equipment kit + signal map ----------
_EQK_JS_RAW = """<script>
(function(){
 'use strict';
 var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function init(root, sel, cls){
   if(!root) return;
   root.classList.add(cls + '-js');
   var items = Array.prototype.slice.call(root.querySelectorAll(sel));
   if(reduced || !('IntersectionObserver' in window)){
     items.forEach(function(i){ i.classList.add('in'); });
     return;
   }
   var io = new IntersectionObserver(function(es){
     es.forEach(function(e){
       if(!e.isIntersecting) return;
       e.target.classList.add('in');
       io.unobserve(e.target);
     });
   }, {threshold: 0.3, rootMargin: '0px 0px -8% 0px'});
   items.forEach(function(i, idx){ i.style.transitionDelay = (idx * 70) + 'ms'; io.observe(i); });
 }
 init(document.querySelector('.eqk-grid'), '.eqk-card', 'eqk');
 init(document.querySelector('.sm-map'), '.sm-node, .sm-hub', 'sm');
})();
</script>"""
EQK_JS = re.sub(r"\n\s*\n", "\n", _EQK_JS_RAW)

def build_oborudovanie_kit():
    assert "\n\n" not in FULL_CSS
    out = []
    out.append("<style>%s</style>" % FULL_CSS)
    # --- equipment kit ---
    out.append('<div class="eqk-grid">')
    for icon, title, desc, color in [
        ("monitor", "Компьютер", "DAW, плагины и весь продакшн живут здесь.", ORANGE),
        ("cable", "Аудиоинтерфейс", "Мост между аналоговым звуком и компьютером.", CYAN),
        ("mic-vocal", "Микрофон", "Вокал, голос и живые инструменты.", VIOLET),
        ("headphones", "Мониторы или наушники", "Контроль звука: студийные мониторы или хорошие наушники.", BLUE),
    ]:
        out.append('  <div class="eqk-card" style="%s">' % step_vars(color))
        out.append('    <span class="eqk-ico"><i data-lucide="%s"></i></span>' % icon)
        out.append('    <h3>%s</h3>' % title)
        out.append('    <p>%s</p>' % desc)
        out.append('  </div>')
    out.append('</div>')
    return "\n".join(out)

def build_oborudovanie_map():
    out = []
    # --- signal map (CSS already injected with the kit component) ---
    out.append('<div class="sm-map">')
    out.append('  <div class="sm-side sm-in">')
    for icon, label, color in [("mic-vocal", "Микрофон", ORANGE), ("guitar", "Гитара", CYAN)]:
        out.append('    <div class="sm-node" style="%s"><i data-lucide="%s"></i><span>%s</span></div>' % (step_vars(color), icon, label))
    out.append('  </div>')
    out.append('  <div class="sm-wires" aria-hidden="true">')
    for d, cable in [("0s", "XLR кабель"), ("1.3s", "1/4 дюйм")]:
        out.append('    <div class="sm-wire" style="--d:%s"><span class="sm-cable">%s</span></div>' % (d, cable))
    out.append('  </div>')
    out.append('  <div class="sm-hub"><i data-lucide="cable"></i><span>Аудиоинтерфейс</span></div>')
    out.append('  <div class="sm-wires" aria-hidden="true">')
    for d, cable in [("0.6s", "USB"), ("1.9s", "TRS кабель"), ("0.2s", 'Jack 1/4"')]:
        out.append('    <div class="sm-wire" style="--d:%s"><span class="sm-cable">%s</span></div>' % (d, cable))
    out.append('  </div>')
    out.append('  <div class="sm-side sm-out">')
    for icon, label, color in [("monitor", "Компьютер с DAW", BLUE), ("monitor-speaker", "Мониторы", VIOLET), ("headphones", "Наушники", GREEN)]:
        out.append('    <div class="sm-node" style="%s"><i data-lucide="%s"></i><span>%s</span></div>' % (step_vars(color), icon, label))
    out.append('  </div>')
    out.append('</div>')
    out.append(EQK_JS)
    return "\n".join(out)

# ---------- inject ----------
MERMAID_RE = re.compile(r'<pre class="mermaid"><code>.*?</code></pre>', re.S)

OBORU = "zvuk/oborudovanie/index.html"
PAGES[OBORU] = None  # handled separately (two diagrams)

MD_MAP = {
    "etap5/index.html": "etap5/index.md",
    "etap7/index.html": "etap7/index.md",
    "etap7/osnovnye-obrabotki/index.html": "etap7/osnovnye-obrabotki.md",
    "etap7/final-chek-miksa/index.html": "etap7/final-chek-miksa.md",
    "etap8/index.html": "etap8/index.md",
    "etap9/index.html": "etap9/index.md",
}

def docs_replacements():
    """Mapping: docs/*.md relative path -> list of component HTML blocks (in order)."""
    out = {}
    for rel, replacement in PAGES.items():
        if replacement is None:
            continue
        out[MD_MAP[rel]] = [replacement]
    out["zvuk/oborudovanie.md"] = [
        build_oborudovanie_kit(), build_oborudovanie_map()]
    return out

if __name__ == "__main__":
    for rel, replacement in list(PAGES.items()):
        path = SITE + "/" + rel
        html = open(path, encoding="utf-8").read()
        blocks = MERMAID_RE.findall(html)
        if not blocks:
            print("!! no mermaid found:", rel); continue
        if len(blocks) == 1:
            html2 = MERMAID_RE.sub(lambda m: replacement, html, count=1)
        else:
            # oborudovanie: diagram1 -> equipment kit (with CSS), diagram2 -> signal map
            assert rel == OBORU and len(blocks) == 2, "unexpected multi-block page: " + rel
            kit = build_oborudovanie_kit()
            smap = build_oborudovanie_map()
            html2 = MERMAID_RE.sub(lambda m: kit, html, count=1)
            html2 = MERMAID_RE.sub(lambda m: smap, html2, count=1)
        assert html2 != html, "no change in " + rel
        open(path, "w", encoding="utf-8").write(html2)
        print("OK %-40s replaced %d mermaid block(s)" % (rel, len(blocks)))
