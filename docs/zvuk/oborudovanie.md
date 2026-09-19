# Оборудование для домашней студии

Правильное оборудование — фундамент качества вашего звука. В этом разделе
мы разберём, что нужно купить в первую очередь, а на чём можно сэкономить.

## Минимальный набор

Для начала работы вам понадобится:

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
</style>
<div class="eqk-grid">
  <div class="eqk-card" style="--pc:#F2994A;--pb:rgba(242,153,74,0.4);--pg:rgba(242,153,74,0.35)">
    <span class="eqk-ico"><i data-lucide="monitor"></i></span>
    <h3>Компьютер</h3>
    <p>DAW, плагины и весь продакшн живут здесь.</p>
  </div>
  <div class="eqk-card" style="--pc:#22D3EE;--pb:rgba(34,211,238,0.4);--pg:rgba(34,211,238,0.35)">
    <span class="eqk-ico"><i data-lucide="cable"></i></span>
    <h3>Аудиоинтерфейс</h3>
    <p>Мост между аналоговым звуком и компьютером.</p>
  </div>
  <div class="eqk-card" style="--pc:#C084FC;--pb:rgba(192,132,252,0.4);--pg:rgba(192,132,252,0.35)">
    <span class="eqk-ico"><i data-lucide="mic-vocal"></i></span>
    <h3>Микрофон</h3>
    <p>Вокал, голос и живые инструменты.</p>
  </div>
  <div class="eqk-card" style="--pc:#60A5FA;--pb:rgba(96,165,250,0.4);--pg:rgba(96,165,250,0.35)">
    <span class="eqk-ico"><i data-lucide="headphones"></i></span>
    <h3>Мониторы или наушники</h3>
    <p>Контроль звука: студийные мониторы или хорошие наушники.</p>
  </div>
</div>
## 1. Аудиоинтерфейс

Аудиоинтерфейс — это мост между аналоговым миром (микрофоны, инструменты)
и цифровым миром (ваш компьютер).

### Ключевые характеристики

| Параметр | Что означает | На что смотреть |
|----------|-------------|----------------|
| **Входы** | Количество одновременных записей | Минимум 2 XLR |
| **Конвертеры** | Качество A/D и D/A | 24-bit / 96 кГц+ |
| **Latency** | Задержка звука | < 10 мс |
| **Preamp** | Чистота усиления | Низкий шум (< 1 дБА EIN) |
| **Подключение** | USB, Thunderbolt, PCIe | USB 3.0 для совместимости |

### Сравнение популярных интерфейсов

| Модель | Входы | Цена | Плюсы | Минусы |
|--------|-------|------|-------|--------|
| **Focusrite Scarlett 2i2** | 2× XLR/TRS | ~$180 | Надёжный, удобный софт | Средний preamp |
| **Universal Audio Volt 2** | 2× XLR/TRS | ~$170 | Встроенные плагины | Нет MIDI |
| **Behringer U-Phoria UM2** | 2× XLR/TRS | ~$60 | Дёшево | Шумный preamp |
| **Audient iD14** | 4× XLR/TRS | ~$450 | Отличные преампы и конвертеры | Больше габаритов |
| **RME Babyface Pro FS** | 4× XLR | ~$1400 | Лучший на рынке | Цена |

!!! tip
    Для старта достаточно **Focusrite Scarlett 2i2 (3-го или 4-го поколения)**.
    Это «рабочая лошадка» домашней студии.

## 2. Микрофоны

Тип микрофона определяет, что вы можете записывать.

### Типы микрофонов

| Тип | Принцип | Лучше всего для | Примеры |
|-----|---------|-----------------|---------|
| **Конденсаторный** | Ёмкостная мембрана | Вокал, акустические инструменты | Neumann U87, Rode NT1 |
| **Динамический** | Катушка в магнитном поле | Гитара, барабаны, громкие источники | Shure SM57, SM58 |

### Полярные диаграммы

- **Кардиоида (Cardioid)** — принимает звук спереди, подавляет сзади
- **Восьмёрка (Figure-8)** — принимает спереди и сзади
- **Всенаправленная (Omnidirectional)** — принимает со всех сторон

!!! warning
    Конденсаторные микрофоны требуют **фантомного питания +48V**.
    Убедитесь, что ваш аудиоинтерфейс поддерживает эту функцию.

### Бюджетные рекомендации

| Бюджет | Микрофон | Применение |
|--------|----------|-----------|
| $50–100 | Audio-Technica ATR2100x | Универсальный (USB/XLR) |
| $100–200 | Rode NT1 (5th gen) | Вокал, студийный |
| $200–400 | sE Electronics X1 | Профессиональный вокал |
| $400+ | Neumann TLM 102 | Референсный вокал |

## 3. Мониторы и наушники

### Студийные мониторы

| Модель | Тип | Цена | Особенности |
|--------|-----|------|------------|
| **Yamaha HS5** | Active, 5" | ~$200/шт | Референсный стандарт |
| **KRK ROKIT 5** | Active, 5" | ~$170/шт | Бюджетный, тёплый |
| **Adam Audio T5V** | Active, 5" | ~$300/шт | Tweeter, детализация |
| **Focal Shape 65** | Active, 6.5" | ~$500/шт | Премиум за деньги |

### Студийные наушники

| Модель | Тип | Цена | Применение |
|--------|-----|------|-----------|
| **Audio-Technica ATH-M50x** | Closed-back | ~$150 | Запись, мониторинг |
| **Beyerdynamic DT 770 Pro** | Closed-back | ~$150 | Комфорт, изоляция |
| **Sennheiser HD 600** | Open-back | ~$300 | Сведение, референс |
| **Beyerdynamic Amiron** | Open-back, планарные | ~$500 | Критический слух |

!!! note
    **Closed-back** (закрытые) — лучше для записи, изолируют звук.
    **Open-back** (открытые) — лучше для сведения, естественная сцена.

## 4. Аксессуары

Неочевидные, но важные вещи:

| Аксессуар | Зачем | Бюджет |
|-----------|-------|--------|
| **Поп-фильтр** | Убирает щелчки при вокале | $10–20 |
| **Кабели XLR** | Подключение микрофонов | $15–30/шт |
| **Обработка комнаты** | Акустические панели | $200–500 |

## Схема подключения

<div class="sm-map">
  <div class="sm-side sm-in">
    <div class="sm-node" style="--pc:#F2994A;--pb:rgba(242,153,74,0.4);--pg:rgba(242,153,74,0.35)"><i data-lucide="mic-vocal"></i><span>Микрофон</span></div>
    <div class="sm-node" style="--pc:#22D3EE;--pb:rgba(34,211,238,0.4);--pg:rgba(34,211,238,0.35)"><i data-lucide="guitar"></i><span>Гитара</span></div>
  </div>
  <div class="sm-wires" aria-hidden="true">
    <div class="sm-wire" style="--d:0s"><span class="sm-cable">XLR кабель</span></div>
    <div class="sm-wire" style="--d:1.3s"><span class="sm-cable">1/4 дюйм</span></div>
  </div>
  <div class="sm-hub"><i data-lucide="cable"></i><span>Аудиоинтерфейс</span></div>
  <div class="sm-wires" aria-hidden="true">
    <div class="sm-wire" style="--d:0.6s"><span class="sm-cable">USB</span></div>
    <div class="sm-wire" style="--d:1.9s"><span class="sm-cable">TRS кабель</span></div>
    <div class="sm-wire" style="--d:0.2s"><span class="sm-cable">Jack 1/4"</span></div>
  </div>
  <div class="sm-side sm-out">
    <div class="sm-node" style="--pc:#60A5FA;--pb:rgba(96,165,250,0.4);--pg:rgba(96,165,250,0.35)"><i data-lucide="monitor"></i><span>Компьютер с DAW</span></div>
    <div class="sm-node" style="--pc:#C084FC;--pb:rgba(192,132,252,0.4);--pg:rgba(192,132,252,0.35)"><i data-lucide="monitor-speaker"></i><span>Мониторы</span></div>
    <div class="sm-node" style="--pc:#34D399;--pb:rgba(52,211,153,0.4);--pg:rgba(52,211,153,0.35)"><i data-lucide="headphones"></i><span>Наушники</span></div>
  </div>
</div>
<script>
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
</script>
## Чек-лист для покупки

- [ ] Аудиоинтерфейс с минимум 2 входами XLR
- [ ] Конденсаторный микрофон для вокала
- [ ] Динамический микрофон для гитары/барабанов
- [ ] Студийные наушники (closed-back)
- [ ] Мониторы (если есть бюджет)
- [ ] XLR кабели (минимум 2 шт)
- [ ] Поп-фильтр
- [ ] Стенд для микрофона
