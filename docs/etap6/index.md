# Этап №6 — Живая Музыка

<div class="hero-section etap6">
<h1>Этап №6</h1>
<p class="hero-subtitle">
Вы освоили битмейкинг и сведение. Теперь пришло время выйти за рамки электроники и освоить живые инструменты.
</p>

</div>

Вы освоили битмейкинг и сведение. Дальше — **живые инструменты** через VST и запись.

## Что в этом этапе

### <i data-lucide="guitar" class="heading-icon"></i> Рок
1. **Основные инструменты** — гитара, бас, драмка: роль каждого в роке
2. **Вариации жанра** — рок нулевых, shoegaze: особенности звучания
3. **Написание с нуля** — подбор библиотеки, гитары, драмка, гармония, структура
4. **Оживление VST** — velocity, humanize, выбор библиотеки, типичные ошибки
5. **Сведение рока** — гитары (кранч/клин, хорус), драмка (плотность, пространство), бас, мастер

### <i data-lucide="heart-crack" class="heading-icon"></i> Пост-Панк
6. **Основные элементы** — гитары, мелодии, драмка, электроника
7. **Атмосферность** — создание мрачной атмосферы
8. **Влияние Панка** — энергия и минимализм
9. **Сведение** — реверб и атмосфера как основа

### <i data-lucide="clouds-rain" class="heading-icon"></i> Гранж
10. **Гаражный звук** — сырой, грязный характер гранжа
11. **Плагины и Сэмпл паки** — инструменты для гранж-продакшна
12. **Модуляционные обработки** — дисторшн, хорус, фазер
13. **Энергетика** — холод, сырость, эмоциональное напряжение

### <i data-lucide="hand" class="heading-icon"></i> Метал
14. **Написание с нуля** — живая гитара, низкий строй, библиотеки (Shreddage 3, Session Guitarist), бас, драмка (Perfect Drums)
15. **Сведение** — гитары (стерео, плотный низ, 3-4 кГц), драмка (комната, кранч, лееринг, Distressor), параллельные обработки
16. **Жанры** — Argent Metal (синты + метал), Nu-Metal и Core

### <i data-lucide="horn" class="heading-icon"></i> Джаз
17. **Основные инструменты** — клавиши, трубы, дабл бас, драмка
18. **Написание с нуля** — джазовые прогрессии (ii-V-I, ступени 7-9-11-13), мягкий звук, импровизация
19. **Вариации жанра** — Noir Jazz, быстрый и фанковый джаз

### <i data-lucide="mic" class="heading-icon"></i> Работа с реальными инструментами
20. **Запись** — микрофон, гитары (провод, звуковуха), шум (заземление), FL Studio и Ableton

!!! important
    **Этот этап — переход от битмейкера к полноценному продюсеру.** Работа с живыми инструментами открывает совершенно новые возможности. Практикуйте запись и сведение после каждой главы.

## Workflow живого продакшна

<style>
/* ===== Live Production Workflow — animated pipeline (etap6) ===== */
.lw-wrap{position:relative;margin:1.8rem 0 2.2rem}
/* --- header bar with equalizer + counter --- */
.lw-head{display:flex;align-items:center;gap:.9rem;padding:.8rem 1.15rem;border:1px solid var(--border-default);border-radius:14px;background:linear-gradient(135deg,rgba(242,153,74,.09),rgba(34,211,238,.05) 55%,rgba(59,130,246,.09))}
.lw-eq{display:flex;align-items:flex-end;gap:3px;height:20px;flex:0 0 auto}
.lw-eq i{width:4px;border-radius:2px;background:linear-gradient(180deg,#FFD9A8,var(--accent-orange));transform-origin:bottom;animation:lw-eq 1.1s ease-in-out infinite}
.lw-eq i:nth-child(1){height:55%;animation-delay:-.9s}
.lw-eq i:nth-child(2){height:90%;animation-delay:-.4s;background:linear-gradient(180deg,#A5F3FC,#22D3EE)}
.lw-eq i:nth-child(3){height:70%;animation-delay:-.7s}
.lw-eq i:nth-child(4){height:100%;animation-delay:-.2s;background:linear-gradient(180deg,#BFDBFE,var(--accent-blue))}
.lw-eq i:nth-child(5){height:60%;animation-delay:-.55s}
@keyframes lw-eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.lw-head__label{font-family:"JetBrains Mono",monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap}
.lw-count{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:.8rem;letter-spacing:.08em;color:var(--text-secondary)}
.lw-count b{color:var(--accent-orange);font-weight:700;transition:color .4s ease}
/* --- spine with traveling signal --- */
.lw-flow{position:relative;margin-top:1.5rem}
.lw-steps{list-style:none;margin:0;padding:0}
.lw-spine,.lw-fill{position:absolute;left:23px;top:24px;width:2px;border-radius:2px;pointer-events:none}
.lw-spine{bottom:24px;background:var(--border-default)}
.lw-fill{height:0;background:linear-gradient(180deg,var(--accent-orange),#22D3EE 55%,var(--accent-blue));box-shadow:0 0 10px rgba(242,153,74,.35);transition:height .7s cubic-bezier(.22,1,.36,1)}
.lw-dot{position:absolute;left:24px;top:24px;width:9px;height:9px;margin-left:-3.5px;border-radius:50%;background:#fff;opacity:0;pointer-events:none;transition:top .7s cubic-bezier(.22,1,.36,1),opacity .4s ease}
.lw-dot.on{opacity:1;animation:lw-pulse 1.8s ease-in-out infinite}
@keyframes lw-pulse{
 0%,100%{box-shadow:0 0 0 4px rgba(242,153,74,.22),0 0 16px rgba(242,153,74,.9)}
 50%{box-shadow:0 0 0 8px rgba(242,153,74,.1),0 0 26px rgba(242,153,74,1)}
}
/* --- step rows --- */
.lw-step{position:relative;display:flex;gap:1.1rem;padding:.55rem 0;transition:opacity .55s ease,transform .55s cubic-bezier(.22,1,.36,1)}
.lw-wrap.lw-js .lw-step{opacity:0;transform:translateX(-16px)}
.lw-wrap.lw-js .lw-step.lw-in{opacity:1;transform:none}
.lw-node{position:relative;z-index:1;flex:0 0 auto;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:2px solid var(--border-default);color:var(--text-secondary);transition:border-color .6s ease,color .6s ease,box-shadow .6s ease,transform .35s ease}
.lw-node svg{width:22px;height:22px}
.lw-step.lw-in .lw-node{border-color:var(--pc);color:var(--pc);box-shadow:0 0 16px -2px var(--pg),inset 0 0 12px -7px var(--pg)}
.lw-step:hover .lw-node{transform:scale(1.08) rotate(-5deg)}
/* --- cards --- */
.lw-card{flex:1;min-width:0;padding:.95rem 1.15rem;border:1px solid var(--border-subtle);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.03),transparent 45%),var(--bg-card);transition:border-color .3s ease,transform .3s ease,box-shadow .3s ease}
.lw-step:hover .lw-card{border-color:var(--pb);transform:translateX(4px);box-shadow:0 12px 30px -16px var(--pg)}
.lw-top{display:flex;align-items:center;gap:.6rem;margin-bottom:.35rem}
.lw-num{font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:700;color:var(--pc);letter-spacing:.1em;flex:0 0 auto}
.lw-top h3{margin:0;font-size:.98rem;font-weight:700;line-height:1.3;color:var(--text-heading)}
.lw-opt{font-family:"JetBrains Mono",monospace;font-size:.62rem;font-style:normal;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);border:1px solid var(--border-default);border-radius:999px;padding:.15rem .45rem;margin-left:.35rem;vertical-align:middle}
.lw-tag{margin-left:auto;flex:0 0 auto;font-family:"JetBrains Mono",monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;padding:.28rem .55rem;border-radius:999px;color:var(--pc);border:1px solid var(--pb)}
.lw-card p{margin:0;font-size:.87rem;line-height:1.55;color:var(--text-secondary)}
/* --- final step --- */
.lw-step--final .lw-card{border-color:rgba(52,211,153,.4);background:linear-gradient(135deg,rgba(52,211,153,.1),rgba(59,130,246,.07)),var(--bg-card)}
.lw-step--final.lw-in .lw-node{animation:lw-final-glow 2.4s ease-in-out infinite}
@keyframes lw-final-glow{
 0%,100%{box-shadow:0 0 16px -2px rgba(52,211,153,.45),inset 0 0 12px -7px rgba(52,211,153,.5)}
 50%{box-shadow:0 0 28px 0 rgba(52,211,153,.75),inset 0 0 14px -6px rgba(52,211,153,.7)}
}
.lw-eq--mini{display:inline-flex;align-items:flex-end;gap:2px;height:12px;margin-left:.4rem;vertical-align:-1px}
.lw-eq--mini i{width:3px;border-radius:1.5px;background:#34D399;transform-origin:bottom;animation:lw-eq 0.9s ease-in-out infinite}
.lw-eq--mini i:nth-child(1){height:60%;animation-delay:-.7s}
.lw-eq--mini i:nth-child(2){height:100%;animation-delay:-.3s}
.lw-eq--mini i:nth-child(3){height:45%;animation-delay:-.5s}
/* --- small screens --- */
@media (max-width:30em){
 .lw-step{gap:.75rem}
 .lw-card{padding:.8rem .9rem}
 .lw-tag{display:none}
 .lw-head__label{font-size:.64rem;letter-spacing:.1em}
}
/* --- reduced motion --- */
@media (prefers-reduced-motion:reduce){
 .lw-wrap.lw-js .lw-step,.lw-step{opacity:1;transform:none;transition:none}
 .lw-eq i,.lw-dot,.lw-step--final.lw-in .lw-node{animation:none!important}
 .lw-fill,.lw-dot{transition:none}
}
</style>
<div class="lw-wrap">
  <div class="lw-head">
    <span class="lw-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="lw-head__label">Pipeline · живой продакшн</span>
    <span class="lw-count"><b>00</b>/09</span>
  </div>
  <div class="lw-flow">
    <div class="lw-spine" aria-hidden="true"></div>
    <div class="lw-fill" aria-hidden="true"></div>
    <div class="lw-dot" aria-hidden="true"></div>
    <ol class="lw-steps">
    <li class="lw-step" style="--pc:#F2994A;--pb:rgba(242,153,74,.4);--pg:rgba(242,153,74,.35)">
      <div class="lw-node"><i data-lucide="compass"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">01</span><h3>Выбор жанра</h3><span class="lw-tag">Подготовка</span></div>
        <p>Определяем референсы, BPM и тональность — от этого зависит всё остальное.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#F2994A;--pb:rgba(242,153,74,.4);--pg:rgba(242,153,74,.35)">
      <div class="lw-node"><i data-lucide="library"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">02</span><h3>Подбор инструментов и библиотек</h3><span class="lw-tag">Подготовка</span></div>
        <p>Сэмпл-паки, виртуальные инструменты и плагины под характер жанра.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#22D3EE;--pb:rgba(34,211,238,.4);--pg:rgba(34,211,238,.35)">
      <div class="lw-node"><i data-lucide="piano"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">03</span><h3>Написание аранжировки</h3><span class="lw-tag">Создание</span></div>
        <p>Аккорды, мелодия, бас и драм-паттерн: собираем скелет трека.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#22D3EE;--pb:rgba(34,211,238,.4);--pg:rgba(34,211,238,.35)">
      <div class="lw-node"><i data-lucide="sparkles"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">04</span><h3>Humanize и оживление MIDI</h3><span class="lw-tag">Создание</span></div>
        <p>Velocity, микро-сдвиги тайминга — MIDI начинает звучать как живой музыкант.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#C084FC;--pb:rgba(192,132,252,.4);--pg:rgba(192,132,252,.35)">
      <div class="lw-node"><i data-lucide="mic-vocal"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">05</span><h3>Запись живых инструментов<em class="lw-opt">опционально</em></h3><span class="lw-tag">Запись</span></div>
        <p>Гитары, вокал и шум через микрофон в FL Studio или Ableton.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#60A5FA;--pb:rgba(96,165,250,.4);--pg:rgba(96,165,250,.35)">
      <div class="lw-node"><i data-lucide="sliders-horizontal"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">06</span><h3>Сведение по жанру</h3><span class="lw-tag">Финализация</span></div>
        <p>Баланс, EQ и компрессия: микс под характер жанра.</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#60A5FA;--pb:rgba(96,165,250,.4);--pg:rgba(96,165,250,.35)">
      <div class="lw-node"><i data-lucide="waves"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">07</span><h3>Атмосфера и пространство</h3><span class="lw-tag">Финализация</span></div>
        <p>Реверб, дилэй и стерео-ширина — трек начинает «дышать».</p>
      </div>
    </li>
    <li class="lw-step" style="--pc:#60A5FA;--pb:rgba(96,165,250,.4);--pg:rgba(96,165,250,.35)">
      <div class="lw-node"><i data-lucide="disc-3"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">08</span><h3>Мастеринг</h3><span class="lw-tag">Финализация</span></div>
        <p>Громкость, тон и финальный полир перед релизом.</p>
      </div>
    </li>
    <li class="lw-step lw-step--final" style="--pc:#34D399;--pb:rgba(52,211,153,.45);--pg:rgba(52,211,153,.4)">
      <div class="lw-node"><i data-lucide="headphones"></i></div>
      <div class="lw-card">
        <div class="lw-top"><span class="lw-num">09</span><h3>Финальный трек<span class="lw-eq--mini" aria-hidden="true"><i></i><i></i><i></i></span></h3><span class="lw-tag">Релиз</span></div>
        <p>Слушаем на разных системах, публикуем и делимся с миром.</p>
      </div>
    </li>
    </ol>
  </div>
</div>
<script>
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
</script>
---

**← [Назад: Этап №3 →](../etap3/index.md)** | **[Далее: Рок — Основные инструменты →](rock-osnovnye-instrumenty.md)**