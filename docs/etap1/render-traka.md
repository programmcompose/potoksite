# Рендер трека / Выгрузка в MP3

## Что такое рендер

**Рендер (Render / Export)** — процесс экспорта вашего проекта в аудиофайл, который можно воспроизвести вне DAW.

## Проверка громкости

Перед рендером:

- [ ] Мастер не клиппит (не уходит в красную)
- [ ] Кик и бас слышны на низкой громкости
- [ ] Бит звучит сбалансированно на разных устройствах

## Выбор зоны рендера

### Рендер всего проекта

Экспорт всей композиции от начала до конца.

### Рендер выделенной зоны

Экспорт только нужного фрагмента (например, припев или интро).

## Качество рендера

| Формат | Назначение | Качество |
|--------|-----------|----------|
| **WAV 24-bit** | Архив, дальнейшая обработка | Максимальное |
| **WAV 16-bit** | Стандартный экспорт | Высокое |
| **MP3 320 kbps** | Обмен, презентация | Хорошее |
| **MP3 128 kbps** | Быстрый обмен | Приемлемое |

!!! important
    Для финальной версии всегда рендерите в WAV 24-bit. MP3 используйте только для обмена и прослушивания.

## Рендер в FL Studio

<div class="step-cards">
  <div class="step-card">
    <span class="step-num">01</span>
    <h4>Откройте окно экспорта</h4>
    <p>File → Export → MP3/WAV.</p>
    <code class="step-key">Ctrl+R</code>
  </div>
  <div class="step-card">
    <span class="step-num">02</span>
    <h4>Выберите качество</h4>
    <p>Задайте формат и битность в настройках.</p>
  </div>
  <div class="step-card">
    <span class="step-num">03</span>
    <h4>Включите Dithering</h4>
    <p>Обязательно для экспорта в 16-bit.</p>
  </div>
  <div class="step-card">
    <span class="step-num">04</span>
    <h4>Сохраните файл</h4>
    <p>Нажмите Save и дождитесь завершения процесса.</p>
  </div>
</div>

## Рендер в Ableton Live

<div class="step-cards">
  <div class="step-card">
    <span class="step-num">01</span>
    <h4>Откройте экспорт микса</h4>
    <p>Export Audio Mix.</p>
    <code class="step-key">Ctrl+Shift+M</code>
  </div>
  <div class="step-card">
    <span class="step-num">02</span>
    <h4>Выберите формат</h4>
    <p>WAV или MP3.</p>
  </div>
  <div class="step-card">
    <span class="step-num">03</span>
    <h4>Установите Sample Depth</h4>
    <p>Рекомендуется 24-bit.</p>
  </div>
  <div class="step-card">
    <span class="step-num">04</span>
    <h4>Нажмите Export</h4>
    <p>Дождитесь записи файла на диск.</p>
  </div>
</div>

!!! tip
    Сохраняйте проект перед рендером. И иногда DAW падает в процессе экспорта длинных проектов.

---

**← [Назад: Мастер канал](master-kanal.md)** | **[Далее: Бит в FL Studio →**](bit-v-fl-studio.md)
