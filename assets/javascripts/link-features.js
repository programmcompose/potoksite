/* ========================================
   Backlinks + Hover link previews
   Depends on /link-graph.json from hooks/link_graph.py
   18 ПОТОК
   ======================================== */

(function () {
  'use strict';

  var GRAPH = null;
  var graphPromise = null;
  var previewEl = null;
  var hideTimer = null;
  var currentAnchor = null;

  function siteBase() {
    // Material sets base on <base href> or we derive from pathname
    var base = document.querySelector('base');
    if (base && base.href) {
      try {
        var u = new URL(base.href);
        return u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      } catch (e) { /* fallthrough */ }
    }
    // potoksite often at /potoksite/
    var m = location.pathname.match(/^(\/[^/]+\/)/);
    if (m && /potoksite/i.test(m[1])) return m[1];
    return '/';
  }

  function graphUrl() {
    return siteBase() + 'link-graph.json';
  }

  function loadGraph() {
    if (GRAPH) return Promise.resolve(GRAPH);
    if (graphPromise) return graphPromise;
    graphPromise = fetch(graphUrl(), { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('link-graph HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        GRAPH = data;
        return data;
      })
      .catch(function (err) {
        console.warn('[link-features]', err);
        GRAPH = { pages: {}, backlinks: {}, outlinks: {} };
        return GRAPH;
      });
    return graphPromise;
  }

  /** Normalize browser path to graph key like etap2/eq-ekvalizatsiya/ */
  function currentPageKey() {
    var path = location.pathname;
    var base = siteBase();
    if (base !== '/' && path.indexOf(base) === 0) {
      path = path.slice(base.length - 1); // keep leading logic
      path = location.pathname.slice(base.length);
    }
    path = path.replace(/^\/+/, '');
    if (!path || path === 'index.html') return '.';
    if (path.endsWith('index.html')) path = path.slice(0, -10);
    else if (path.endsWith('.html')) path = path.slice(0, -5) + '/';
    if (path && !path.endsWith('/')) path += '/';
    return path || '.';
  }

  function hrefToKey(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return null;
      var path = u.pathname;
      var base = siteBase();
      if (base !== '/' && path.indexOf(base) === 0) {
        path = path.slice(base.length);
      } else {
        path = path.replace(/^\/+/, '');
      }
      path = path.replace(/^\/+/, '');
      if (!path || path === 'index.html') return '.';
      if (path.endsWith('index.html')) path = path.slice(0, -10);
      else if (path.endsWith('.html')) path = path.slice(0, -5) + '/';
      if (path && !path.endsWith('/')) path += '/';
      return path || '.';
    } catch (e) {
      return null;
    }
  }

  function pageUrl(key) {
    var base = siteBase();
    if (key === '.' || key === '') return base;
    return base + key.replace(/^\//, '');
  }

  /* ---------- Backlinks ---------- */

  function ensureBacklinksMount() {
    var existing = document.querySelector('.potok-backlinks');
    if (existing) return existing;

    var article =
      document.querySelector('article.md-content__inner') ||
      document.querySelector('.md-content__inner') ||
      document.querySelector('article');

    if (!article) return null;

    var el = document.createElement('section');
    el.className = 'potok-backlinks';
    el.setAttribute('hidden', '');
    el.innerHTML =
      '<h2 class="potok-backlinks__title">Ссылки на эту страницу</h2>' +
      '<ul class="potok-backlinks__list"></ul>';

    // insert before footer nav (prev/next) if present
    var footerNav = article.querySelector('.md-footer-meta, nav.md-footer__link, .md-source-file');
    // better: before last hr or after content — append near end
    var contentKids = article.children;
    var inserted = false;
    for (var i = contentKids.length - 1; i >= 0; i--) {
      var node = contentKids[i];
      if (node.tagName === 'HR' || (node.classList && node.classList.contains('md-source-file'))) {
        article.insertBefore(el, node);
        inserted = true;
        break;
      }
    }
    if (!inserted) article.appendChild(el);
    return el;
  }

  function renderBacklinks() {
    return loadGraph().then(function (g) {
      var key = currentPageKey();
      var list = (g.backlinks && g.backlinks[key]) || [];
      var mount = ensureBacklinksMount();
      if (!mount) return;

      var ul = mount.querySelector('.potok-backlinks__list');
      ul.innerHTML = '';

      if (!list.length) {
        mount.setAttribute('hidden', '');
        return;
      }

      list.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = pageUrl(item.url);
        a.textContent = item.title || item.url;
        li.appendChild(a);
        ul.appendChild(li);
      });
      mount.removeAttribute('hidden');
    });
  }

  /* ---------- Hover preview ---------- */

  function ensurePreviewEl() {
    if (previewEl) return previewEl;
    previewEl = document.createElement('div');
    previewEl.className = 'potok-preview';
    previewEl.setAttribute('role', 'tooltip');
    previewEl.innerHTML =
      '<p class="potok-preview__title"></p>' +
      '<p class="potok-preview__excerpt"></p>' +
      '<p class="potok-preview__path"></p>';
    document.body.appendChild(previewEl);
    return previewEl;
  }

  function positionPreview(anchor) {
    var tip = ensurePreviewEl();
    var rect = anchor.getBoundingClientRect();
    var tipW = tip.offsetWidth || 320;
    var tipH = tip.offsetHeight || 120;
    var gap = 10;

    var left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));

    var top = rect.bottom + gap;
    if (top + tipH > window.innerHeight - 8) {
      top = rect.top - tipH - gap;
    }
    if (top < 8) top = 8;

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function showPreview(anchor, meta, key) {
    var tip = ensurePreviewEl();
    tip.querySelector('.potok-preview__title').textContent = meta.title || key;
    tip.querySelector('.potok-preview__excerpt').textContent = meta.excerpt || '';
    tip.querySelector('.potok-preview__path').textContent = key === '.' ? '/' : key;
    tip.classList.add('is-visible');
    positionPreview(anchor);
  }

  function hidePreview() {
    if (previewEl) previewEl.classList.remove('is-visible');
    currentAnchor = null;
  }

  function onEnter(e) {
    var a = e.currentTarget;
    var key = a.getAttribute('data-potok-key');
    if (!key || !GRAPH || !GRAPH.pages) return;
    var meta = GRAPH.pages[key];
    if (!meta) return;

    clearTimeout(hideTimer);
    currentAnchor = a;
    showPreview(a, meta, key);
  }

  function onLeave() {
    hideTimer = setTimeout(hidePreview, 120);
  }

  function bindPreviews() {
    if (!GRAPH || !GRAPH.pages) return;

    var content =
      document.querySelector('article.md-content__inner') ||
      document.querySelector('.md-content__inner') ||
      document;

    var anchors = content.querySelectorAll('a[href]');
    anchors.forEach(function (a) {
      if (a.closest('.potok-backlinks')) return;
      if (a.closest('.md-nav')) return;
      if (a.closest('header')) return;
      if (a.hasAttribute('data-potok-preview-bound')) return;

      var key = hrefToKey(a.getAttribute('href') || '');
      if (!key || !GRAPH.pages[key]) return;

      a.setAttribute('data-potok-key', key);
      a.setAttribute('data-potok-preview-bound', '1');
      a.classList.add('potok-has-preview');
      a.addEventListener('mouseenter', onEnter);
      a.addEventListener('mouseleave', onLeave);
      a.addEventListener('focus', onEnter);
      a.addEventListener('blur', onLeave);
    });
  }

  function init() {
    loadGraph().then(function () {
      renderBacklinks();
      bindPreviews();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () {
      hidePreview();
      init();
    });
  }

  window.addEventListener('scroll', function () {
    if (currentAnchor && previewEl && previewEl.classList.contains('is-visible')) {
      positionPreview(currentAnchor);
    }
  }, { passive: true });
})();
