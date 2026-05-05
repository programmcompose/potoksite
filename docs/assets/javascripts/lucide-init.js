/* ========================================
   Lucide Icons — Init script
   ======================================== */

(function () {
  'use strict';

  function initLucide() {
    if (typeof lucide === 'undefined') {
      setTimeout(initLucide, 100);
      return;
    }
    lucide.createIcons({
      attrs: {
        width: 18,
        height: 18,
      },
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
          width: 18,
          height: 18,
        },
      });
    });
  }
})();