/* ========================================
   Bookmarks — Персональные закладки
   ======================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'potok_bookmarks_v1';
  var MAX_BOOKMARKS = 100;

  var widgetEl = null;
  var fabEl = null;

  // ========================
  // URL helpers
  // ========================

  function normalizeUrl() {
    var path = window.location.pathname;
    // Remove site prefix
    path = path.replace(/^\/potoksite/, '');
    // Remove trailing slash
    path = path.replace(/\/$/, '');
    if (!path) path = '/';
    return path;
  }

  function getCurrentUrl() {
    var path = normalizeUrl();
    var search = window.location.search;
    return path + search;
  }

  function getPageTitle() {
    var title = document.title;
    // Remove site suffix
    title = title.replace(/\s*\|\s*18 ПОТОК.*$/, '').trim();
    return title;
  }

  // ========================
  // LocalStorage
  // ========================

  function loadBookmarks() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      var parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[PotokBookmarks] Ошибка чтения LocalStorage:', e);
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('[PotokBookmarks] Ошибка записи LocalStorage:', e);
    }
  }

  function isBookmarked(url) {
    var bookmarks = loadBookmarks();
    return bookmarks.some(function (b) { return b.url === url; });
  }

  function addBookmark(url, title) {
    var bookmarks = loadBookmarks();
    if (isBookmarked(url)) return bookmarks;

    bookmarks.unshift({
      url: url,
      title: title,
      timestamp: Date.now()
    });

    if (bookmarks.length > MAX_BOOKMARKS) {
      bookmarks = bookmarks.slice(0, MAX_BOOKMARKS);
    }

    saveBookmarks(bookmarks);
    return bookmarks;
  }

  function removeBookmark(url) {
    var bookmarks = loadBookmarks().filter(function (b) { return b.url !== url; });
    saveBookmarks(bookmarks);
    return bookmarks;
  }

  function clearAllBookmarks() {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }

  // ========================
  // FAB (floating action button)
  // ========================

  function createFAB() {
    if (fabEl) fabEl.remove();

    var svgFilled = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    var svgOutline = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

    fabEl = document.createElement('button');
    fabEl.className = 'potok-bookmark-fab';
    fabEl.setAttribute('aria-label', 'Добавить закладку');
    fabEl.setAttribute('type', 'button');
    fabEl.innerHTML = svgFilled;

    fabEl.addEventListener('click', handleFABClick);

    document.body.appendChild(fabEl);
    updateFABState();
    fabEl.classList.add('show');
  }

  function updateFABState() {
    if (!fabEl) return;
    var url = getCurrentUrl();
    var bookmarked = isBookmarked(url);

    var svgFilled = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    var svgOutline = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

    fabEl.innerHTML = bookmarked ? svgFilled : svgOutline;
    fabEl.setAttribute('aria-label', bookmarked ? 'Удалить закладку' : 'Добавить закладку');
  }

  function handleFABClick() {
    var url = getCurrentUrl();
    var title = getPageTitle();

    if (isBookmarked(url)) {
      removeBookmark(url);
      showToast('Закладка удалена');
    } else {
      addBookmark(url, title);
      showToast('Закладка добавлена');
    }

    updateFABState();
    renderBookmarksList();
  }

  // ========================
  // Sidebar widget
  // ========================

  function createBookmarkWidget() {
    if (widgetEl) widgetEl.remove();

    var sidebar = document.querySelector('.md-sidebar--primary');
    if (!sidebar) return;

    var nav = sidebar.querySelector('.md-nav--primary');
    var bookmarks = loadBookmarks();

    var widget = document.createElement('div');
    widget.className = 'potok-bookmarks-widget';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Закладки');

    var headerHTML =
      '<div class="potok-bookmarks-widget__header">' +
        '<span class="potok-bookmarks-widget__title"><i data-lucide="bookmark" class="potok-bookmark-widget-icon"></i> Закладки</span>' +
        '<span class="potok-bookmarks-widget__count">' + bookmarks.length + '</span>' +
      '</div>';

    var listHTML = '';
    var emptyHTML = '';

    if (bookmarks.length === 0) {
      emptyHTML = '<div class="potok-bookmark-empty"><i data-lucide="bookmark-x" class="potok-bookmark-empty-icon"></i><span>Нет сохранённых закладок</span></div>';
    } else {
      // Sort by timestamp DESC (newest first)
      var sorted = bookmarks.slice().sort(function (a, b) { return b.timestamp - a.timestamp; });
      listHTML = '<ul class="potok-bookmarks-list">';
      sorted.forEach(function (bm) {
        var displayName = bm.title || bm.url;
        var displayUrl = bm.url;
        listHTML +=
          '<li class="potok-bookmark-item">' +
            '<a href="' + displayUrl + '" class="potok-bookmark-item__link">' +
              '<i data-lucide="file-text" class="potok-bookmark-item__icon"></i>' +
              '<span class="potok-bookmark-item__title">' + displayName + '</span>' +
            '</a>' +
            '<a href="' + displayUrl + '" class="potok-bookmark-item__url">' + displayUrl + '</a>' +
            '<button class="potok-bookmark-item__remove" type="button" data-url="' + bm.url + '" aria-label="Удалить закладку"><i data-lucide="x" class="potok-bookmark-item__remove-icon"></i></button>' +
          '</li>';
      });
      listHTML += '</ul>';
    }

    var footerHTML = '';
    if (bookmarks.length > 0) {
      footerHTML = '<button class="potok-bookmarks-clear" type="button" aria-label="Очистить все закладки">Очистить все</button>';
    }

    widget.innerHTML = headerHTML + listHTML + emptyHTML + footerHTML;

    if (nav) {
      nav.parentNode.insertBefore(widget, nav.nextSibling);
    } else {
      sidebar.appendChild(widget);
    }

    widgetEl = widget;

    // Bind remove buttons
    widget.querySelectorAll('.potok-bookmark-item__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var url = btn.getAttribute('data-url');
        removeBookmark(url);
        renderBookmarksList();
        updateFABState();
        showToast('Закладка удалена');
      });
    });

    // Bind clear button
    var clearBtn = widget.querySelector('.potok-bookmarks-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!confirm('Удалить все закладки?')) return;
        clearAllBookmarks();
        renderBookmarksList();
        updateFABState();
        showToast('Все закладки удалены');
      });
    }

    // Re-init lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({
        attrs: {
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          width: 18,
          height: 18,
        },
        callback: function (el) {
          if (el.tagName === 'svg') {
            el.querySelectorAll('path[fill="currentColor"], rect[fill="currentColor"], circle[fill="currentColor"], ellipse[fill="currentColor"], polygon[fill="currentColor"], polyline[fill="currentColor"]').forEach(function (node) {
              node.removeAttribute('fill');
            });
          }
        },
      });
    }
  }

  function renderBookmarksList() {
    var bookmarks = loadBookmarks();
    var countEl = widgetEl ? widgetEl.querySelector('.potok-bookmarks-widget__count') : null;
    if (countEl) countEl.textContent = bookmarks.length;

    var emptyEl = widgetEl ? widgetEl.querySelector('.potok-bookmark-empty') : null;
    var listEl = widgetEl ? widgetEl.querySelector('.potok-bookmarks-list') : null;
    var clearBtn = widgetEl ? widgetEl.querySelector('.potok-bookmarks-clear') : null;

    if (bookmarks.length === 0) {
      if (!emptyEl) {
        var emptyHTML = '<div class="potok-bookmark-empty"><i data-lucide="bookmark-x" class="potok-bookmark-empty-icon"></i><span>Нет сохранённых закладок</span></div>';
        widgetEl.insertAdjacentHTML('beforeend', emptyHTML);
      }
      if (clearBtn) clearBtn.remove();
    } else {
      if (emptyEl) emptyEl.remove();
      if (!clearBtn) {
        widgetEl.insertAdjacentHTML('beforeend', '<button class="potok-bookmarks-clear" type="button" aria-label="Очистить все закладки">Очистить все</button>');
        var newClearBtn = widgetEl.querySelector('.potok-bookmarks-clear');
        if (newClearBtn) {
          newClearBtn.addEventListener('click', function () {
            if (!confirm('Удалить все закладки?')) return;
            clearAllBookmarks();
            renderBookmarksList();
            updateFABState();
            showToast('Все закладки удалены');
          });
        }
      }
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons({
        attrs: {
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          width: 18,
          height: 18,
        },
        callback: function (el) {
          if (el.tagName === 'svg') {
            el.querySelectorAll('path[fill="currentColor"], rect[fill="currentColor"], circle[fill="currentColor"], ellipse[fill="currentColor"], polygon[fill="currentColor"], polyline[fill="currentColor"]').forEach(function (node) {
              node.removeAttribute('fill');
            });
          }
        },
      });
    }
  }

  // ========================
  // Toast
  // ========================

  function showToast(message) {
    var existing = document.querySelector('.potok-bookmark-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'potok-bookmark-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 1800);
  }

  // ========================
  // Init
  // ========================

  function init() {
    createFAB();
    createBookmarkWidget();
  }

  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
