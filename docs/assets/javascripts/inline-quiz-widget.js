/* ============================================================
   POTOK · Инлайн-квиз виджет (F1)
   <div class="potok-inline-quiz" data-stage="etap2"></div>

   Данные: docs/assets/data/quiz/stages-bundle.js (window.POTOK_QUIZ_STAGES),
   источник — STAGES из docs/tools/quiz/index.html.
   Ленивая загрузка бандла при первом рендере, общий Promise на страницу.
   Прогресс: localStorage potok-inline-{stage}-{hash} = {best,total,runs}.
   Без SFX и конфетти (смол-фича внутри статьи).
   ============================================================ */
(function () {
  'use strict';

  // --- Базовый URL ассетов (для аудио и ссылки на полный тест) ---
  var ASSET_BASE = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src && cs.src.indexOf('/assets/') !== -1) {
      ASSET_BASE = cs.src.slice(0, cs.src.indexOf('/assets/'));
    }
  } catch (e) {}

  // --- Ленивая загрузка бандла (общий Promise) ---
  var bundlePromise = null;
  function loadBundle() {
    if (window.POTOK_QUIZ_STAGES && window.POTOK_QUIZ_STAGES.length) {
      return Promise.resolve(window.POTOK_QUIZ_STAGES);
    }
    if (!bundlePromise) {
      bundlePromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = ASSET_BASE + '/assets/data/quiz/stages-bundle.js';
        s.onload = function () {
          if (window.POTOK_QUIZ_STAGES && window.POTOK_QUIZ_STAGES.length) resolve(window.POTOK_QUIZ_STAGES);
          else reject(new Error('POTOK_QUIZ_STAGES пуст'));
        };
        s.onerror = function () { reject(new Error('stages-bundle.js не загрузился')); };
        document.head.appendChild(s);
      });
    }
    return bundlePromise;
  }

  // --- Хэш вопросов (djb2) — для ключа localStorage ---
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function questionsHash(stage) {
    var parts = [];
    for (var i = 0; i < stage.questions.length; i++) {
      var q = stage.questions[i];
      parts.push(q.q + '|' + q.options.join('|') + '|' + q.correct);
    }
    return djb2(parts.join('##'));
  }

  function storageKey(stage) { return 'potok-inline-' + stage.id + '-' + questionsHash(stage); }

  function loadProgress(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function saveProgress(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }

  // --- SVG-визуалы: общий файл quiz-svg.js (window.POTOK_QUIZ_SVG) ---
  var SVG_RENDERERS = null;
  function getSvgRenderers() {
    if (!SVG_RENDERERS) SVG_RENDERERS = window.POTOK_QUIZ_SVG || {};
    return SVG_RENDERERS;
  }

  function renderImage(img) {
    if (!img) return '';
    if (typeof img === 'string') return img;
    var fn = getSvgRenderers()[img.svg];
    return fn ? fn.apply(null, img.args || []) : '<div class="piq-svg-fallback">🎹 Визуал доступен в <a href="' + ASSET_BASE + '/tools/quiz/index.html">полном тесте</a></div>';
  }

  function audioUrl(p) { return (ASSET_BASE ? ASSET_BASE + '/' : '') + p; }

  // --- Утилиты DOM ---
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ============================================================
  // Виджет
  // ============================================================
  function QuizWidget(root, stageId) {
    this.root = root;
    this.stageId = stageId;
    this.state = 'loading'; // loading | intro | question | result | error
    this.idx = 0;
    this.score = 0;
    this.answered = false;
    this.build();
    loadBundle()
      .then(this.onData.bind(this))
      .catch(this.onError.bind(this));
  }

  QuizWidget.prototype.build = function () {
    var r = this.root;
    r.classList.add('piq');
    r.innerHTML = '';

    this.head = el('div', 'piq-head');
    this.titleEl = el('span', 'piq-title', '🎯 Проверь себя…');
    this.countEl = el('span', 'piq-count');
    this.head.appendChild(this.titleEl);
    this.head.appendChild(this.countEl);
    r.appendChild(this.head);

    // Экран загрузки
    this.loadingEl = el('div', 'piq-screen piq-loading', 'Загружаем вопросы…');
    r.appendChild(this.loadingEl);

    // Интро
    this.introEl = el('div', 'piq-screen piq-intro');
    this.introEl.hidden = true;
    r.appendChild(this.introEl);

    // Вопрос
    this.qEl = el('div', 'piq-screen piq-q');
    this.qEl.hidden = true;
    var prog = el('div', 'piq-progress');
    this.progFill = el('div', 'piq-progress-fill');
    prog.appendChild(this.progFill);
    this.catEl = el('span', 'piq-cat');
    this.textEl = el('div', 'piq-text');
    this.visualEl = el('div', 'piq-visual');
    this.optsEl = el('div', 'piq-opts');
    this.fbEl = el('div', 'piq-feedback');
    this.fbEl.hidden = true;
    this.nextBtn = el('button', 'piq-btn piq-next', 'Далее →');
    this.nextBtn.type = 'button';
    this.nextBtn.hidden = true;
    this.nextBtn.addEventListener('click', this.onNext.bind(this));
    this.qEl.appendChild(prog);
    this.qEl.appendChild(this.catEl);
    this.qEl.appendChild(this.textEl);
    this.qEl.appendChild(this.visualEl);
    this.qEl.appendChild(this.optsEl);
    this.qEl.appendChild(this.fbEl);
    this.qEl.appendChild(this.nextBtn);
    r.appendChild(this.qEl);

    // Результат
    this.resEl = el('div', 'piq-screen piq-res');
    this.resEl.hidden = true;
    r.appendChild(this.resEl);

    // Ошибка
    this.errEl = el('div', 'piq-screen piq-error');
    this.errEl.hidden = true;
    r.appendChild(this.errEl);
  };

  QuizWidget.prototype.showScreen = function (name) {
    var screens = [this.loadingEl, this.introEl, this.qEl, this.resEl, this.errEl];
    for (var i = 0; i < screens.length; i++) screens[i].hidden = true;
    if (name === 'loading') this.loadingEl.hidden = false;
    else if (name === 'intro') this.introEl.hidden = false;
    else if (name === 'question') this.qEl.hidden = false;
    else if (name === 'result') this.resEl.hidden = false;
    else if (name === 'error') this.errEl.hidden = false;
  };

  QuizWidget.prototype.onData = function (stages) {
    var st = null;
    for (var i = 0; i < stages.length; i++) if (stages[i].id === this.stageId) { st = stages[i]; break; }
    if (!st || !st.questions || !st.questions.length) {
      this.onError(new Error('этап ' + this.stageId + ' не найден в данных'));
      return;
    }
    this.stage = st;
    this.key = storageKey(st);
    this.progress = loadProgress(this.key) || { best: 0, total: st.questions.length, runs: 0 };

    var emoji = st.emoji || '🎯';
    this.titleEl.textContent = emoji + ' Проверь себя · Этап ' + (st.short ? st.short.replace(/^№\s*/, '') : '');
    this.countEl.textContent = st.questions.length + ' вопросов';

    // Интро
    var self = this;
    this.introEl.innerHTML = '';
    if (st.desc) this.introEl.appendChild(el('p', 'piq-desc', st.desc));
    if (this.progress.runs > 0 && this.progress.best > 0) {
      var bestLine = el('div', 'piq-best');
      bestLine.innerHTML = '🏆 Лучший результат: <b>' + this.progress.best + '/' + this.progress.total + '</b>';
      this.introEl.appendChild(bestLine);
    }
    var startBtn = el('button', 'piq-btn piq-start', 'Начать тест →');
    startBtn.type = 'button';
    startBtn.addEventListener('click', function () { self.start(); });
    this.introEl.appendChild(startBtn);

    var fullLink = el('a', 'piq-fulllink', 'Полный тест с разбором и рекордами →');
    fullLink.href = ASSET_BASE + '/tools/quiz/index.html';
    this.introEl.appendChild(fullLink);

    this.state = 'intro';
    this.showScreen('intro');
  };

  QuizWidget.prototype.start = function () {
    this.idx = 0;
    this.score = 0;
    this.state = 'question';
    this.renderQuestion();
  };

  QuizWidget.prototype.renderQuestion = function () {
    var st = this.stage, q = st.questions[this.idx];
    this.answered = false;

    this.progFill.style.width = (this.idx / st.questions.length * 100) + '%';
    this.catEl.textContent = q.cat + ' · Вопрос ' + (this.idx + 1) + ' из ' + st.questions.length;
    this.textEl.textContent = q.q;

    // Визуал: SVG-ссылка / аудио
    var self = this;
    this.visualEl.innerHTML = '';
    var imgHtml = renderImage(q.image);
    if (imgHtml) {
      var v = el('div', 'piq-qvisual');
      v.innerHTML = imgHtml; // SVG-генераторы — свой код, безопасно
      this.visualEl.appendChild(v);
    }
    if (q.audios && q.audios.length) {
      var ah = el('div', 'piq-audio');
      ah.appendChild(el('span', 'piq-audio-hint', '🎧 Внимательно послушай оба варианта и сравни'));
      q.audios.forEach(function (a) {
        var row = el('div', 'piq-audio-row');
        row.appendChild(el('b', null, a.label));
        var au = document.createElement('audio');
        au.controls = true;
        au.preload = 'none';
        au.src = audioUrl(a.src);
        row.appendChild(au);
        ah.appendChild(row);
      });
      this.visualEl.appendChild(ah);
    } else if (q.audio) {
      var ah2 = el('div', 'piq-audio');
      ah2.appendChild(el('span', 'piq-audio-hint', '🎧 Внимательно послушай сэмпл перед ответом'));
      var au2 = document.createElement('audio');
      au2.controls = true;
      au2.preload = 'none';
      au2.src = audioUrl(q.audio);
      ah2.appendChild(au2);
      this.visualEl.appendChild(ah2);
    }

    // Варианты
    var LETTERS = ['A', 'B', 'C', 'D'];
    this.optsEl.innerHTML = '';
    q.options.forEach(function (opt, i) {
      var b = el('button', 'piq-opt');
      b.type = 'button';
      b.innerHTML = '<span class="piq-letter">' + LETTERS[i] + '</span><span class="piq-opt-text"></span>';
      b.querySelector('.piq-opt-text').textContent = opt;
      b.addEventListener('click', function () { self.answer(i, b); });
      self.optsEl.appendChild(b);
    });

    this.fbEl.hidden = true;
    this.fbEl.className = 'piq-feedback';
    this.nextBtn.hidden = true;
    this.showScreen('question');
  };

  QuizWidget.prototype.answer = function (i, btn) {
    if (this.answered) return;
    var q = this.stage.questions[this.idx];
    this.answered = true;

    var buttons = this.optsEl.querySelectorAll('.piq-opt');
    for (var k = 0; k < buttons.length; k++) buttons[k].disabled = true;

    var ok = i === q.correct;
    if (ok) {
      btn.classList.add('is-correct');
      this.score++;
    } else {
      btn.classList.add('is-wrong');
      buttons[q.correct].classList.add('is-correct');
    }

    // Разбор: всегда показываем комментарий
    var fb = el('div', 'piq-fb-text');
    if (ok) fb.appendChild(el('span', 'piq-fb-ok', '✅ Верно!'));
    else fb.appendChild(el('span', 'piq-fb-no', '❌ Неверно. Правильный ответ: ' + ['A', 'B', 'C', 'D'][q.correct] + '.'));
    if (q.comment) {
      var c = el('p', 'piq-comment');
      c.textContent = q.comment;
      fb.appendChild(c);
    }
    this.fbEl.innerHTML = '';
    this.fbEl.appendChild(fb);
    this.fbEl.hidden = false;

    var last = this.idx === this.stage.questions.length - 1;
    this.nextBtn.textContent = last ? 'К результатам →' : 'Далее →';
    this.nextBtn.hidden = false;
  };

  QuizWidget.prototype.onNext = function () {
    if (!this.answered) return;
    if (this.idx < this.stage.questions.length - 1) {
      this.idx++;
      this.renderQuestion();
    } else {
      this.finish();
    }
  };

  QuizWidget.prototype.finish = function () {
    var st = this.stage, total = st.questions.length;
    var prevBest = this.progress.best || 0;
    var isRecord = this.score > prevBest && this.score > 0;
    if (this.score > prevBest) this.progress.best = this.score;
    this.progress.total = total;
    this.progress.runs = (this.progress.runs || 0) + 1;
    saveProgress(this.key, this.progress);

    var self = this;
    this.resEl.innerHTML = '';
    if (isRecord) this.resEl.appendChild(el('div', 'piq-record', '🏆 Новый личный рекорд!'));

    var pct = Math.round(this.score / total * 100);
    var scoreBox = el('div', 'piq-scorebox');
    scoreBox.innerHTML = '<span class="piq-score-num">' + this.score + '/' + total + '</span>' +
      '<span class="piq-score-pct">' + pct + '%</span>';
    this.resEl.appendChild(scoreBox);

    var msg;
    if (pct >= 80) msg = 'Отличный результат — этап усвоен!';
    else if (pct >= 50) msg = 'Неплохо, но стоит повторить слабые темы.';
    else msg = 'Перечитай материал этапа и попробуй ещё раз.';
    this.resEl.appendChild(el('p', 'piq-resmsg', msg));

    var retry = el('button', 'piq-btn piq-retry', 'Пройти ещё раз');
    retry.type = 'button';
    retry.addEventListener('click', function () { self.start(); });
    this.resEl.appendChild(retry);

    this.state = 'result';
    this.showScreen('result');
  };

  QuizWidget.prototype.onError = function (err) {
    var self = this;
    this.errEl.innerHTML = '';
    this.errEl.appendChild(el('div', 'piq-errmsg', 'Не удалось загрузить вопросы' + (ASSET_BASE ? '' : '') + '.'));
    var link = el('a', 'piq-fulllink', 'Открыть полный тест →');
    link.href = ASSET_BASE + '/tools/quiz/index.html';
    this.errEl.appendChild(link);
    this.state = 'error';
    this.showScreen('error');
  };

  // ============================================================
  // Boot: Material SPA — пересоздаём виджеты при навигации
  // ============================================================
  var widgets = [];

  function boot() {
    if (window.__potokInlineQuizInited) return;
    window.__potokInlineQuizInited = true;

    document.querySelectorAll('.potok-inline-quiz').forEach(function (root) {
      if (root.__piqInited) return;
      root.__piqInited = true;
      var stageId = root.getAttribute('data-stage') || '';
      if (!stageId) return;
      widgets.push(new QuizWidget(root, stageId));
    });

    // SPA-навигация: останавливаем аудио у виджетов, покинувших DOM
    if (window.document$ && typeof window.document$.subscribe === 'function') {
      window.document$.subscribe(function () {
        for (var i = 0; i < widgets.length; i++) {
          var w = widgets[i];
          if (!document.body.contains(w.root)) continue;
          // останавливаем воспроизведение аудио внутри виджета
          var auds = w.root.querySelectorAll('audio');
          for (var a = 0; a < auds.length; a++) { try { auds[a].pause(); } catch (e) {} }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
