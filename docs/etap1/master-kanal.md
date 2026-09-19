# Мастер канал

## Что такое мастер канал

**Мастер канал (Master Channel)** — это финальная шина, на которую сводятся все дорожки проекта. Всё, что вы слышите в наушниках, проходит через мастер.

## Сумма всех звуков в проекте

Мастер канал суммирует сигналы со всех дорожек микшера:

<style>
.mk-map{display:grid;grid-template-columns:minmax(150px,1fr) minmax(56px,.7fr) 208px minmax(56px,.7fr) minmax(140px,1fr) minmax(52px,.6fr) minmax(150px,1fr);align-items:center;margin-top:1.4rem;padding-bottom:.9rem}
.mk-side{display:grid;grid-template-rows:repeat(5,64px);gap:22px}
.mk-node{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45rem;padding:.55rem .5rem;border:1px solid var(--border-default);border-radius:12px;background:var(--bg-card);color:var(--text-main);font-size:.8rem;font-weight:600;text-align:center;line-height:1.3;transition:opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1),border-color .3s ease,box-shadow .3s ease}
.mk-node svg{width:22px;height:22px;color:var(--pc)}
.mk-map.mk-js .mk-node,.mk-map.mk-js .mk-hub{opacity:0;transform:translateY(14px)}
.mk-map.mk-js .mk-node.in,.mk-map.mk-js .mk-hub.in{opacity:1;transform:none}
.mk-node:hover{border-color:var(--pb);box-shadow:0 10px 24px -14px var(--pg)}
.mk-wires{display:grid;grid-template-rows:repeat(5,64px);gap:22px}
.mk-wire{position:relative}
.mk-wire::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;border-radius:2px;background:var(--border-default)}
.mk-wire::after{content:"";position:absolute;top:50%;left:0;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(242,153,74,.9);animation:mk-run 2.6s linear infinite;animation-delay:var(--d,0s)}
@keyframes mk-run{0%{left:-2%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:calc(100% - 6px);opacity:0}}
.mk-hub{grid-row:1/6;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;padding:1.1rem .8rem;border-radius:14px;background:linear-gradient(160deg,rgba(242,153,74,.14),rgba(59,130,246,.14)),var(--bg-card);border:1px solid rgba(242,153,74,.35);color:var(--text-heading);font-size:.85rem;font-weight:700;text-align:center;line-height:1.3;animation:mk-hub-glow 2.6s ease-in-out infinite}
.mk-hub svg{width:26px;height:26px;color:#F2994A}
.mk-hub-sub{font-size:.68rem;font-weight:500;color:var(--text-secondary);letter-spacing:.04em}
@keyframes mk-hub-glow{0%,100%{box-shadow:0 0 18px -6px rgba(242,153,74,.4)}50%{box-shadow:0 0 30px -4px rgba(242,153,74,.65)}}
.mk-link{position:relative;height:2px;margin-top:-1px;background:var(--border-default);align-self:center;border-radius:2px}
.mk-link::after{content:"";position:absolute;top:50%;left:0;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(242,153,74,.9);animation:mk-run 2.6s linear infinite;animation-delay:var(--d,0s)}
.mk-link-label{position:absolute;top:10px;left:50%;transform:translateX(-50%);font-family:"JetBrains Mono",monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);background:var(--bg-main);border:1px solid var(--border-subtle);border-radius:999px;padding:.2rem .5rem;white-space:nowrap}
.mk-down{display:none}
@media(max-width:900px){
 .mk-map{display:block;padding-bottom:0}
 .mk-side{grid-template-rows:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-bottom:0}
 .mk-wires,.mk-link{display:none}
 .mk-hub{margin:0 auto;max-width:300px}
 .mk-mid,.mk-out{margin:0 auto;max-width:260px}
 .mk-down{display:flex;justify-content:center;color:var(--text-secondary);padding:.4rem 0}
 .mk-down svg{width:18px;height:18px}
}
@media(prefers-reduced-motion:reduce){
 .mk-map.mk-js .mk-node,.mk-map.mk-js .mk-hub{opacity:1;transform:none;transition:none}
 .mk-wire::after,.mk-link::after,.mk-hub{animation:none!important}
}
</style>

<div class="mk-map">
  <div class="mk-side mk-in">
    <div class="mk-node" style="--pc:#F2994A;--pb:rgba(242,153,74,.4);--pg:rgba(242,153,74,.35)"><i data-lucide="drum"></i><span>Кик</span></div>
    <div class="mk-node" style="--pc:#22D3EE;--pb:rgba(34,211,238,.4);--pg:rgba(34,211,238,.35)"><i data-lucide="drumstick"></i><span>Снейр</span></div>
    <div class="mk-node" style="--pc:#C084FC;--pb:rgba(192,132,252,.4);--pg:rgba(192,132,252,.35)"><i data-lucide="disc-3"></i><span>Хэты</span></div>
    <div class="mk-node" style="--pc:#60A5FA;--pb:rgba(96,165,250,.4);--pg:rgba(96,165,250,.35)"><i data-lucide="waves"></i><span>Бас</span></div>
    <div class="mk-node" style="--pc:#34D399;--pb:rgba(52,211,153,.4);--pg:rgba(52,211,153,.35)"><i data-lucide="music-2"></i><span>Мелодия</span></div>
  </div>
  <div class="mk-wires" aria-hidden="true">
    <div class="mk-wire" style="--d:0s"></div>
    <div class="mk-wire" style="--d:.5s"></div>
    <div class="mk-wire" style="--d:1s"></div>
    <div class="mk-wire" style="--d:1.5s"></div>
    <div class="mk-wire" style="--d:2s"></div>
  </div>
  <div class="mk-hub"><i data-lucide="mixer-vertical"></i><span>Мастер канал</span><span class="mk-hub-sub">Сумма всех дорожек</span></div>
  <div class="mk-down" aria-hidden="true"><i data-lucide="chevron-down"></i></div>
  <div class="mk-link" style="--d:.3s"><span class="mk-link-label">USB</span></div>
  <div class="mk-mid">
    <div class="mk-node" style="--pc:#60A5FA;--pb:rgba(96,165,250,.4);--pg:rgba(96,165,250,.35)"><i data-lucide="audio-lines"></i><span>Аудиоинтерфейс</span></div>
  </div>
  <div class="mk-down" aria-hidden="true"><i data-lucide="chevron-down"></i></div>
  <div class="mk-link" style="--d:1.2s"><span class="mk-link-label">Jack 1/4"</span></div>
  <div class="mk-out">
    <div class="mk-node" style="--pc:#C084FC;--pb:rgba(192,132,252,.4);--pg:rgba(192,132,252,.35)"><i data-lucide="headphones"></i><span>Наушники / Колонки</span></div>
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
 init(document.querySelector('.mk-map'), '.mk-node, .mk-hub', 'mk');
})();
</script>

## Главный принцип

!!! important
    **Не перегружайте мастер канал.** На этапе микширования мастер должен оставаться «чистым» — без плагинов или с минимальной обработкой.

### Что можно ставить на мастер

| Плагин | Назначение | Когда |
|--------|-----------|-------|
| Limiter | Защита от клиппинга | Всегда |
| Multiband Compressor | Контроль динамики | На этапе мастеринга |
| EQ | Коррекция баланса | На этапе мастеринга |

### Что НЕ должно быть на мастере во время микширования

- Агрессивные компрессоры
- Яркие EQ-коррекции
- Реверберация и дилей

## Уровень мастер-канала

- Целевой пик: **-3 to -1 dB** (headroom)
- Средний уровень (RMS): **-14 to -9 LUFS** для стриминговых платформ
- Никогда не допускайте клиппинга (красная зона)

!!! tip
    Если мастер «уходит в красную» — уменьшайте громкость отдельных дорожек, а не мастер в целом.
