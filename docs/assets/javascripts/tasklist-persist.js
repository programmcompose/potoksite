// Persist task-list checkbox states via localStorage
(function () {
  function getPageKey() {
    return 'tasklist:' + location.pathname;
  }

  function saveState() {
    var items = document.querySelectorAll('.md-typeset .task-list-item-checkbox');
    var state = {};
    items.forEach(function (cb, i) {
      state[i] = cb.checked;
    });
    localStorage.setItem(getPageKey(), JSON.stringify(state));
  }

  function restoreState() {
    var raw = localStorage.getItem(getPageKey());
    if (!raw) return;
    try {
      var state = JSON.parse(raw);
      var items = document.querySelectorAll('.md-typeset .task-list-item-checkbox');
      items.forEach(function (cb, i) {
        if (state[i]) cb.checked = true;
      });
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    restoreState();
    var items = document.querySelectorAll('.md-typeset .task-list-item-checkbox');
    items.forEach(function (cb) {
      cb.addEventListener('change', saveState);
    });
  });
})();
