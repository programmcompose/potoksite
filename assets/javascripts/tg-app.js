/* ========================================
   tg-app.js — Инициализация Telegram Mini App
   Подключается в <head> сразу после официального telegram-web-app.js.
   Ставит window.isTelegramMiniApp / window.tgUser / window.TelegramWebApp,
   раскрывает приложение на весь экран, подстраивает тему и кнопку «Назад».
   Вне Telegram — сайт работает как обычный (fallback).
   ======================================== */

(function () {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;

  if (!tg) {
    // Сайт открыт в обычном браузере
    window.isTelegramMiniApp = false;
    window.tgUser = null;
    return;
  }

  // === Инициализация Mini App ===
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}
  if (typeof tg.enableClosingConfirmation === 'function') {
    try { tg.enableClosingConfirmation(); } catch (e) {}
  }

  // === Тема Telegram → CSS-переменные Material ===
  // Стили scoped под схему, совпадающую с темой Telegram:
  // переключатель темы сайта продолжает работать.
  var themeStyleEl = null;

  function applyTelegramTheme() {
    try {
      var tp = tg.themeParams || {};
      if (!tp.bg_color && !tp.text_color) return;

      // Схемы Material на этом сайте: slate (тёмная), default (светлая)
      var selector = tg.colorScheme === 'dark'
        ? '[data-md-color-scheme="slate"]'
        : ':root, [data-md-color-scheme="default"]';

      var css = '';
      if (tp.bg_color) css += '--md-default-bg-color:' + tp.bg_color + ';';
      if (tp.text_color) css += '--md-default-fg-color:' + tp.text_color + ';';
      if (!css) return;

      if (!themeStyleEl || !themeStyleEl.parentNode) {
        themeStyleEl = document.createElement('style');
        themeStyleEl.id = 'tg-theme-override';
        (document.head || document.documentElement).appendChild(themeStyleEl);
      }
      themeStyleEl.textContent = selector + '{' + css + '}';
    } catch (e) {}
  }

  applyTelegramTheme();
  if (typeof tg.onEvent === 'function') {
    try { tg.onEvent('themeChanged', applyTelegramTheme); } catch (e) {}
  }

  // === Кнопка «Назад» Telegram ===
  try {
    tg.BackButton.show();
    tg.BackButton.onClick(function () {
      if (window.history.length > 1) {
        history.back();
      } else {
        tg.close();
      }
    });
  } catch (e) {}

  // === Данные пользователя ===
  window.isTelegramMiniApp = true;
  window.tgUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  window.TelegramWebApp = tg;

  // Событие, чтобы другие скрипты знали, что Mini App готов
  document.dispatchEvent(new CustomEvent('tg-ready', {
    detail: { user: window.tgUser }
  }));
})();
