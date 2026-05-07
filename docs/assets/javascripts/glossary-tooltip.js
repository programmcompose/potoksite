(function() {
  var glossaryData = null;
  var tooltipEl = null;
  var currentTerm = null;
  var debounceTimer = null;

  function loadGlossary() {
    var baseUrl = '/potoksite';
    return fetch(baseUrl + '/glossary.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        glossaryData = data;
        buildTermMap();
        highlightTerms();
      })
      .catch(function(err) {
        console.warn('[glossary-tooltip] Failed to load glossary:', err);
      });
  }

  var termMap = {};

  function buildTermMap() {
    if (!glossaryData) return;
    for (var i = 0; i < glossaryData.length; i++) {
      var entry = glossaryData[i];
      var lower = entry.term.toLowerCase();
      // Skip very short terms (1-2 chars) to avoid false positives
      if (lower.length > 2) {
        termMap[lower] = entry;
      }
    }
  }

  function highlightTerms() {
    if (!glossaryData) return;

    var contentAreas = document.querySelectorAll('.md-content__inner, .md-typeset');
    if (!contentAreas.length) return;

    // Sort terms by length descending to match longer terms first
    var sortedTerms = Object.keys(termMap).sort(function(a, b) {
      return b.length - a.length;
    });

    for (var c = 0; c < contentAreas.length; c++) {
      var area = contentAreas[c];
      var walker = document.createTreeWalker(area, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          // Skip nodes inside code blocks, pre, script, style, and existing tooltips
          var parent = node.parentElement;
          while (parent) {
            if (['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TOOLTIP', 'SPAN'].indexOf(parent.nodeName) !== -1) {
              if (parent.nodeName === 'SPAN' && parent.classList.contains('glossary-term')) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      var textNodes = [];
      var node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      for (var t = 0; t < textNodes.length; t++) {
        var textNode = textNodes[t];
        var text = textNode.textContent;

        for (var s = 0; s < sortedTerms.length; s++) {
          var term = sortedTerms[s];
          var entry = termMap[term];
          var regex = new RegExp('(^|[^a-zA-Zа-яёА-ЯЁ0-9])' + escapeRegex(term) + '([^a-zA-Zа-яёА-ЯЁ0-9]|$)', 'gi');

          if (regex.test(text)) {
            var replaced = false;
            var result = text.replace(regex, function(match, p1, p2) {
              var inner = match.replace(/^([^a-zA-Zа-яёА-ЯЁ0-9])|([^a-zA-Zа-яёА-ЯЁ0-9])$/g, '');
              p1 += '<span class="glossary-term" data-term="' + entry.term + '">' + inner + '</span>';
              return p1 + p2;
            });
            var span = document.createElement('span');
            span.innerHTML = result;
            textNode.parentNode.replaceChild(span, textNode);
            break;
          }
        }
      }
    }

    // Add hover handlers to glossary-term spans
    document.addEventListener('mouseover', handleTermHover);
    document.addEventListener('mouseout', handleTermOut);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function createTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'glossary-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(entry, targetEl, x, y) {
    if (!tooltipEl) createTooltip();

    tooltipEl.innerHTML =
      '<div class="glossary-tooltip__card">' +
        '<div class="glossary-tooltip__term">' +
          '<i data-lucide="book-a"></i> ' + entry.term +
        '</div>' +
        '<div class="glossary-tooltip__def">' + entry.definition + '</div>' +
      '</div>';

    // Position tooltip
    var rect = targetEl.getBoundingClientRect();
    var tooltipRect = tooltipEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var left = rect.right + 10;
    var top = rect.top;

    // If tooltip would go off right edge, show on left
    if (left + tooltipRect.width > vw - 16) {
      left = rect.left - tooltipRect.width - 10;
    }

    // If tooltip would go off bottom edge, show above
    if (top + tooltipRect.height > vh - 16) {
      top = vh - tooltipRect.height - 16;
    }

    // If tooltip would go off top edge, show below
    if (top < 16) {
      top = rect.bottom + 10;
    }

    // If tooltip would go off left edge, show at left edge
    if (left < 16) {
      left = 16;
    }

    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.classList.add('visible');

    // Initialize lucide icons in tooltip
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
    currentTerm = null;
  }

  function handleTermHover(e) {
    var termEl = e.target.closest('.glossary-term');
    if (!termEl) return;

    var termName = termEl.getAttribute('data-term');
    if (!termName) return;

    var entry = termMap[termName.toLowerCase()];
    if (!entry) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      currentTerm = entry;
      showTooltip(entry, termEl, e.clientX, e.clientY);
    }, 200);
  }

  function handleTermOut(e) {
    var termEl = e.target.closest('.glossary-term');
    if (!termEl) return;

    var relatedTarget = e.relatedTarget;
    if (relatedTarget && relatedTarget.closest && relatedTarget.closest('.glossary-tooltip')) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      hideTooltip();
    }, 150);
  }

  // Move tooltip on mouse move
  document.addEventListener('mousemove', function(e) {
    if (!tooltipEl || !tooltipEl.classList.contains('visible')) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var left = parseFloat(tooltipEl.style.left);
    var top = parseFloat(tooltipEl.style.top);
    var rect = tooltipEl.getBoundingClientRect();

    // Keep tooltip within viewport
    if (left + rect.width > vw - 16) {
      tooltipEl.style.left = (vw - rect.width - 16) + 'px';
    }
    if (top + rect.height > vh - 16) {
      tooltipEl.style.top = (vh - rect.height - 16) + 'px';
    }
    if (top < 16) {
      tooltipEl.style.top = '16px';
    }
  });

  // MkDocs Material integration
  document$.subscribe(function() {
    loadGlossary();
  });

  // Also load on initial DOMContentLoaded as fallback
  document.addEventListener('DOMContentLoaded', function() {
    loadGlossary();
  });
})();
