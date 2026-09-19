/* ========================================
   Lucide Icons — Init script
   ======================================== */

(function () {
  'use strict';

  function clearFills(svg) {
    svg.querySelectorAll('path[fill="currentColor"], rect[fill="currentColor"], circle[fill="currentColor"], ellipse[fill="currentColor"], polygon[fill="currentColor"], polyline[fill="currentColor"]').forEach(function (el) {
      el.removeAttribute('fill');
    });
  }

  function initLucide() {
    if (typeof lucide === 'undefined') {
      setTimeout(initLucide, 100);
      return;
    }
    lucide.createIcons({
      attrs: {
        'stroke-width': 1.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        width: 18,
        height: 18,
      },
      callback: clearFills,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLucide);
  } else {
    initLucide();
  }

  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () {
      lucide.createIcons({
        attrs: {
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          width: 18,
          height: 18,
        },
        callback: clearFills,
      });
    });
  }
})();