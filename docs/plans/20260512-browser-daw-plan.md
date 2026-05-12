# План: Браузерная DAW

> **Дата:** 2026-05-12
> **Требования:** `docs/brainstorms/20260512-browser-daw-requirements.md`
> **Язык:** JavaScript (HTML/CSS, Tone.js)
> **Статус:** ✅ Готов к реализации
> **Handoff:** → 03-work

---

## Обзор

Создать браузерную DAW в стиле Ableton Live как интерактивный учебный инструмент. 6 дорожек (4 drum + bass + melody), step sequencer + piano roll, микшер, transport.

## Архитектура

```
docs/tools/browser-daw/
├── index.html          # Основная страница (HTML + CSS + JS)
├── samples/            # Драм-сэмплы
│   ├── kick.wav
│   ├── snare.wav
│   ├── hihat-closed.wav
│   └── hihat-open.wav
└── (future: split into separate files if too large)
```

**Технологии:** Tone.js 14.x (Web Audio API), чистый JS, CSS Grid/Flexbox.

**Стиль:** Ableton Live тёмная тема (серо-синие тона, оранжевый playhead, цветные дорожки).

---

## Implementation Units

### Unit 1: Foundation — HTML-каркас + CSS-макет Ableton

**Цель:** Базовая структура страницы с Ableton-style layout.

**Файлы:**
- `docs/tools/browser-daw/index.html` (создать)
- `docs/tools/browser-daw/samples/` (создать директорию)

**Задачи:**
- [ ] HTML-структура: header (transport bar), main (track lanes), footer (mixer)
- [ ] CSS: Ableton-style тёмная тема (фон #1a1a2e, дорожки с цветовой кодировкой)
- [ ] CSS Grid layout: transport сверху, track lanes по центру, mixer снизу
- [ ] Tone.js подключение (CDN, как в wavetable)
- [ ] AudioContext bootstrap (play-on-user-gesture)
- [ ] Theme toggle (dark/light, как в других инструментах)
- [ ] Back link на tools/index.html

**Acceptance:**
- Страница открывается, пустой макет с transport bar, track lanes, mixer
- Tone.js загружен и AudioContext инициализируется по клику

---

### Unit 2: Drum Samples + Tone.js Players

**Цель:** Драм-звук через Tone.js с реальными сэмплами.

**Файлы:**
- `docs/tools/browser-daw/index.html`
- `docs/tools/browser-daw/samples/kick.wav`
- `docs/tools/browser-daw/samples/snare.wav`
- `docs/tools/browser-daw/samples/hihat-closed.wav`
- `docs/tools/browser-daw/samples/hihat-open.wav`

**Задачи:**
- [ ] Найти/скачать короткие WAV-сэмплы (kick, snare, hi-hat closed, hi-hat open)
  - Источники: Freesound.org, или использовать Tone.js MembraneSynth/MetalSynth как fallback
  - Критерий: < 200KB суммарно, mono, 44.1kHz
- [ ] Создать Tone.js `Player` для каждого сэмпла
- [ ] Превью-кнопки (нажал на дорожку = услышал звук)
- [ ] Обработка CORS (сэмплы в том же домене, нет проблем)

**Acceptance:**
- Клик по drum-дорожке воспроизводит соответствующий звук
- Все 4 сэмпла загружаются и играют без задержек

---

### Unit 3: Step Sequencer (16-step Grid) для драмов

**Цель:** Grid-based секвенсор для драмов (16 шагов × 4 дорожки).

**Файлы:**
- `docs/tools/browser-daw/index.html`

**Задачи:**
- [ ] Рендер grid: 4 строки (kick, snare, hh-closed, hh-open) × 16 колонок
- [ ] Клик по клетке = toggle (вкл/выкл)
- [ ] Визуальная индикация: активные клетки подсвечены, текущий шаг (playhead) анимирован
- [ ] Playhead синхронизирован с Tone.js Transport
- [ ] 4/4 тактовая сетка (группировка по 4 с разделителями)
- [ ] Touch-friendly (минимум 32px клетки)

**Acceptance:**
- Пользователь может нарисовать бит на grid
- При нажатии Play — playhead бежит, активные клетки срабатывают и играют звуки
- Визуальная группировка по тактам

---

### Unit 4: Synth Tracks — Bass + Melody (Tone.js)

**Цель:** Синтезированные дорожки Bass и Melody через Tone.js.

**Файлы:**
- `docs/tools/browser-daw/index.html`

**Задачи:**
- [ ] Tone.js `MonoSynth` для Bass (низкий диапазон, C2-C4)
- [ ] Tone.js `MonoSynth` для Melody (средний диапазон, C4-C7)
- [ ] Настройка пресетов: bass (sine/triangle wave, short release), melody (sawtooth, medium attack/release)
- [ ] Превью-кнопки на дорожках (играет базовую ноту)

**Acceptance:**
- Клик по bass-дорожке = басовая нота
- Клик по melody-дорожке = мелодическая нота
- Звук отличается (bass — тёплый низкий, melody — яркий средний)

---

### Unit 5: Piano Roll (drag-and-drop) для Bass + Melody

**Цель:** Piano Roll с drag-and-drop для мелодических инструментов.

**Файлы:**
- `docs/tools/browser-daw/index.html`

**Задачи:**
- [ ] Piano Roll grid: вертикаль = ноты (октавы), горизонталь = время (16 шагов)
- [ ] Piano keyboard слева (октавы C2-C4 для bass, C4-C7 для melody)
- [ ] Клик по клетке = добавить ноту
- [ ] Drag-and-drop: перемещение нот (изменение pitch)
- [ ] Изменение длины ноты (тянуть за край)
- [ ] Snap to grid (quarter, eighth, sixteenth)
- [ ] Переключение между Bass и Melody piano roll (tabs или toggle)
- [ ] Синхронизация с Tone.js Transport (playback нот)

**Acceptance:**
- Пользователь может расставить ноты кликом
- Перетаскивание нот меняет высоту
- Изменение длины ноты работает
- При Play — ноты воспроизводятся в правильном порядке с правильными pitch и duration

---

### Unit 6: Transport — Play/Stop, Tempo, Metronome, Loop

**Цель:** Transport controls для управления воспроизведением.

**Файлы:**
- `docs/tools/browser-daw/index.html`

**Задачи:**
- [ ] Play / Stop кнопки (синхронизация с Tone.Transport)
- [ ] Tempo slider: 60-180 BPM (default 120), real-time изменение
- [ ] Metronome toggle (Tone.js `Tone.MetalSynth` или `Tone.NoiseSynth` на каждый 1-й beat)
- [ ] Loop toggle (повтор паттерна, Tone.Transport.loop)
- [ ] Визуальный BPM дисплей
- [ ] Time signature display (4/4)

**Acceptance:**
- Play запускает воспроизведение, Stop останавливает
- Изменение tempo в реальном времени работает
- Metronome щёлкает на каждом 1-м beat
- Loop зацикливает паттерн

---

### Unit 7: Mixer — Volume, Pan, Mute + Master

**Цель:** Микшер с элементами управления для каждой дорожки.

**Файлы:**
- `docs/tools/browser-daw/index.html`

**Задачи:**
- [ ] Fader (Volume) для каждой дорожки (6 шт.) — vertical slider
- [ ] Pan knob (L-R) для каждой дорожки
- [ ] Mute кнопка для каждой дорожки
- [ ] Master канал: Volume + Mute
- [ ] Связь с Tone.js `Tone.Destination` и `Tone.Gain` per track
- [ ] Визуальная индикация mute (красная подсветка)

**Acceptance:**
- Изменение volume на дорожке меняет громкость
- Pan перемещает звук в L/R
- Mute полностью отключает дорожку
- Master volume влияет на все дорожки

---

### Unit 8: Integration — Связывание всех компонентов

**Цель:** Финальная интеграция, полировка UI, добавление карточки в tools index.

**Файлы:**
- `docs/tools/browser-daw/index.html`
- `docs/tools/index.html`

**Задачи:**
- [ ] Интеграция Transport + Step Sequencer + Piano Roll + Synth playback
- [ ] Playhead синхронизирован между step sequencer и piano roll
- [ ] Mute/Volume/Pan влияют на playback в реальном времени
- [ ] Полировка UI: hover-эффекты, active states, transitions
- [ ] Mobile адаптация: уменьшенные элементы, scroll для grid
- [ ] Карточка в `docs/tools/index.html` (Drum Machine → Browser DAW)
- [ ] Тестирование: полный цикл (play → edit → stop → play)

**Acceptance:**
- Полный цикл работы: нарисовал бит → нажал Play → слышу → редактирую → снова Play
- Все компоненты синхронизированы
- Мобильная версия работает (базово)
- Карточка в tools index ведёт на DAW

---

## Зависимости между Unit

```
Unit 1 (Foundation)
    ↓
Unit 2 (Drum Samples) ──→ Unit 3 (Step Sequencer)
Unit 4 (Synth Tracks) ──→ Unit 5 (Piano Roll)
    ↓                       ↓
Unit 6 (Transport) ←── Unit 3, Unit 5
    ↓
Unit 7 (Mixer)
    ↓
Unit 8 (Integration)
```

**Параллелизм:**
- Unit 2 и Unit 4 независимы (можно параллельно)
- Unit 3 и Unit 5 независимы (можно параллельно)
- Unit 6 зависит от Unit 3 + Unit 5
- Unit 7 зависит от Unit 6
- Unit 8 зависит от всех

---

## Риски

| Риск | Митигация |
|------|-----------|
| AudioContext policy (автоплей) | Play по user gesture (кнопка) |
| CORS для сэмплов | Сэмплы в том же домене |
| Piano Roll сложность | Упростить если не влезает в бюджет |
| Производительность на мобильных | CSS Grid + requestAnimationFrame для playhead |
