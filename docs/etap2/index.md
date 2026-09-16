# Этап №2 — Сведение и VST Плагины

<div class="hero-section etap2">
<h1>Этап №2</h1>
<p class="hero-subtitle">
Освойте основы сведения: EQ, компрессия, реверберация, делэй, сатурация и другие VST-плагины для профессионального микса.
</p>

</div>

<style>
/* ===== Этап №2 (главная): без фоновых анимаций + glassy hero ===== */
.md-main { animation: none !important; }
.md-main::before,
.md-container::after { animation: none !important; }
.hero-section.etap2::before { animation: none !important; }

/* Матовая текстура поверх стекла */
.hero-section.etap2::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.18;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}

/* --- Тёмная тема: прозрачное стекло с синим оттенком --- */
[data-md-color-scheme="slate"] .hero-section.etap2 {
  background: rgba(13, 71, 161, 0.16) !important;
  border: 1px solid rgba(144, 202, 249, 0.28) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}
[data-md-color-scheme="slate"] .hero-section.etap2 h1 {
  background: linear-gradient(135deg, #BBDEFB 0%, #64B5F6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* --- Светлая тема: белое матовое стекло --- */
[data-md-color-scheme="default"] .hero-section.etap2 {
  background: rgba(255, 255, 255, 0.42) !important;
  border: 1px solid rgba(33, 150, 243, 0.30) !important;
  box-shadow: 0 8px 32px rgba(33, 150, 243, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}
</style>

## Что в этом этапе

1. **Основные понятия** — что такое сведение, микс, мастер-канал
2. **EQ / Эквализация** — частоты, полосы, фильтрация, тональный баланс
3. **Saturation / Сатурация** — тёплый звук, гармонические искажения
4. **Reverb / Реверберация** — пространство, глубина, типы реверба
5. **Delay / Делэй** — эхо, тайминг, ритмические эффекты
6. **Chorus / Хорус** — ширина, объём, модуляция
7. **Как понять плагин** — осцилоскоп ShaperBox 3, визуальная форма волны
8. **Compression / Компрессия** — атака, релиз, ratio, threshold
9. **Limiter и Clipper** — контроль пиков, громкость
10. **Стилизация сэмплов** — индивидуальная обработка звуков
11. **Автоматизация плагинов** — динамический микс, изменения во времени
12. **Последовательность обработки** — порядок плагинов в цепочке
13. **Мастер-канал** — финальная обработка, сумма микса
14. **Работа с референсами** — сравнение с профессиональными треками
15. **Слух и его характеристики** — развитие музыкального слуха
16. **Психоакустика** — как мозг воспринимает звук
17. **Сведение (mixing)** — практическое применение всех техник
18. **Мастеринг** — финальная подготовка трека

!!! important
    **Главная цель этапа:** освоить все основные VST-плагины и научиться сводить треки до профессионального уровня. Практикуйтесь на каждом упражнении.

## Проверь себя — тест по этапу

!!! success "Тест Этапа №2"
    54 вопроса по всем темам этапа: EQ, сатурация, реверберация, делэй, хорус, компрессия, лимитер, стилизация сэмплов, автоматизация, порядок плагинов, мастер-канал, референсы, слух и психоакустика, сведение и мастеринг. Закрепи знания и навыки этапа — после каждого ответа мгновенный разбор: почему верно или где ошибся.

    [<i data-lucide="crosshair"></i> **Пройти тест**](../tools/quiz/index.html?stage=etap2)

---

[**Далее: Основные понятия →**](osnovnye-ponyatiya.md)
