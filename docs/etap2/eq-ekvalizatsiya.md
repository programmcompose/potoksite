# EQ / Эквализация

EQ (Equalizer) — инструмент для управления амплитудой отдельных частот. Главный инструмент сведения.

## Типы EQ-операций

### Срез частот (Cut)

Удаление ненужных частот — основа чистого микса.

| Техника | Что делает | Когда применять |
|---|---|---|
| **High-Pass фильтр** (Low-Cut) | Срезает всё ниже выбранной частоты | На всех треках, кроме kick и bass. Типично: 80–150 Гц |
| **Low-Pass фильтр** (High-Cut) | Срезает всё выше выбранной частоты | На басах, киках, для lo-fi эффекта |
| **Саб-срез** | Убирает суб-низы (ниже 30–40 Гц) | На всем, кроме sub-bass — частоты, которые слышно не, а чувствовать |
| **Bell-срез** | Ослабляет конкретный диапазон | Убрать «мутность» (200–300 Гц), «резкость» (2–4 кГц) |

**Lo-fi эффект:** Low-pass фильтр на 8–12 кГц + High-pass на 200–300 Гц = звук «из радио».

### Добавление частот (Boost)

Усиление нужных диапазонов для формирования характера звука.

| Диапазон | Эффект | Применение |
|---|---|---|
| **200–500 Гц** | Основа и плотность | Добавить «тела» тонкому звуку |
| **500 Гц – 2 кГц** | Середина, присутствие | Сделать инструмент «ближе» |
| **> 5 кГц** | Яркость | Добавить чёткости и «искры» |
| **> 10 кГц** | «Песок» / Air | Добавить «воздуха» и прозрачности |

!!! tip "Золотое правило"
    **Режьте, а не усиливайте.** Если звук мутный — срезайте мутные частоты, а не приподнимайте чистые. Boost используйте точечно и аккуратно (±2–4 dB).

## Примеры плагинов

| Плагин | Тип | Характер |
|---|---|---|
| **FabFilter Pro-Q 3** | Parametric EQ | Точность, визуализация спектра в реальном времени, динамические полосы |
| **Waves SSL E-Channel** | Channel Strip EQ | Характер консоль SSL — «режь и иди», тёплая середина |

---

## Динамическая эквализация

Обычный EQ действует на весь сигнал одинаково. **Dynamic EQ** срабатывает только когда сигнал превышает порог — как компрессор, но для частот.

| Ситуация | Обычный EQ | Dynamic EQ |
|---|---|---|
| Вокал конфликтует с гитарой в 1 кГц | Режем 1 кГц всегда → вокал тонкий | Режем 1 кГц только когда вокал громкий → остальное время гитара живая |
| Бас «прорывается» на пиках | Срез низов → бас всегда тонкий | Срез низов только на пиках → остальное время бас полный |

**Мягкая эквализация:** Dynamic EQ даёт более естественный результат, потому что не «калечит» звук постоянно, а вмешивается только когда нужно.

## Практический чек-лист EQ

- [ ] High-pass на всех треках (кроме kick/bass)
- [ ] Срез проблемных частот (мутность, резкость)
- [ ] Точечный boost для характера (±2–4 dB)
- [ ] Air-полка (+10 кГц) на вокале/мелодии
- [ ] Проверка: каждый инструмент слышен в соло и в миксе

---

## Попробуй на кривой

Сравни «до» и «после» без DAW — это та же логика, что в Pro-Q: режешь мутность, а не «красишь» всё подряд.

<div class="eq-mini" data-preset="mud-cut" markdown="0">
  <div class="eq-mini__header">
    <p class="eq-mini__title" data-eq-title>Срез мутности</p>
    <div class="eq-mini__mode">
      <button type="button" data-eq-mode="before">До</button>
      <button type="button" data-eq-mode="after" class="is-active">После</button>
      <button type="button" data-eq-mode="both">Оба</button>
    </div>
  </div>
  <div class="eq-mini__canvas-wrap">
    <canvas></canvas>
  </div>
  <div class="eq-mini__labels">
    <span>20 Hz</span><span>100</span><span>1 k</span><span>10 k</span><span>20 k</span>
  </div>
  <div class="eq-mini__controls">
    <div class="eq-mini__field">
      <label>Gain</label>
      <input type="range" data-eq-gain min="-12" max="6" step="0.5" value="-4" />
      <span class="eq-mini__value" data-eq-gain-val>−4.0 dB</span>
    </div>
    <div class="eq-mini__field">
      <label>Частота</label>
      <input type="range" data-eq-freq min="80" max="800" step="10" value="250" />
      <span class="eq-mini__value" data-eq-freq-val>250 Hz</span>
    </div>
  </div>
  <p class="eq-mini__caption" data-eq-caption></p>
  <div class="eq-mini__legend">
    <span class="eq-before">До (плоско)</span>
    <span class="eq-after">После (EQ)</span>
  </div>
</div>

<div class="eq-mini" data-preset="lofi" markdown="0">
  <div class="eq-mini__header">
    <p class="eq-mini__title" data-eq-title>Lo-fi</p>
    <div class="eq-mini__mode">
      <button type="button" data-eq-mode="before">До</button>
      <button type="button" data-eq-mode="after" class="is-active">После</button>
      <button type="button" data-eq-mode="both">Оба</button>
    </div>
  </div>
  <div class="eq-mini__canvas-wrap">
    <canvas></canvas>
  </div>
  <div class="eq-mini__labels">
    <span>20 Hz</span><span>100</span><span>1 k</span><span>10 k</span><span>20 k</span>
  </div>
  <p class="eq-mini__caption" data-eq-caption></p>
  <div class="eq-mini__legend">
    <span class="eq-before">До</span>
    <span class="eq-after">После</span>
  </div>
</div>

Полный тренажёр со звуком: [EQ-тренажёр →](../tools/) (если путь другой — поправьте ссылку).

---

## Задание

<div class="potok-challenge" data-challenge-id="etap2-eq-hpf-mud" data-xp="20" markdown="0">
  <div class="potok-challenge__header">
    <span class="potok-challenge__badge">Практика</span>
    <h3 class="potok-challenge__title">Чистый микс за 10 минут</h3>
  </div>
  <div class="potok-challenge__body">
    <p>Открой любой бит (или черновик). Сделай только EQ — без компрессии и сатурации.</p>
  </div>
  <ol class="potok-challenge__steps">
    <li>High-pass на всех треках, кроме kick и bass (80–150 Hz).</li>
    <li>На мелодии / падах: bell-срез 200–300 Hz на −3…−5 dB.</li>
    <li>На вокале или лиде: air-полка +2…+3 dB от ~8–10 kHz.</li>
    <li>Сохрани проект. Послушай A/B (bypass всех EQ).</li>
  </ol>
  <p class="potok-challenge__hint">Если стало «тонко» — верни 1–2 dB на срезе. Режь, пока не станет чище, не громче.</p>
  <div class="potok-challenge__actions">
    <button type="button" class="potok-challenge__btn"
      data-challenge-toggle
      data-todo-label="Отметить выполненным"
      data-done-label="Сделано">Отметить выполненным</button>
    <span class="potok-challenge__meta" data-challenge-meta></span>
  </div>
</div>

---

**← [Назад: Основные понятия](osnovnye-ponyatiya.md)** | **[Далее: Saturation / Сатурация →](saturation-saturatsiya.md)**
