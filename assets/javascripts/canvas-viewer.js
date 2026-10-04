/* ========================================
   JSON Canvas 1.0 viewer for MkDocs
   <div class="potok-canvas" data-src="canvases/foo.canvas" data-height="520"></div>
   ======================================== */

(function () {
  'use strict';

  var PRESET = {
    '1': '#c74a4a',
    '2': '#d97706',
    '3': '#ca8a04',
    '4': '#16a34a',
    '5': '#0891b2',
    '6': '#9333ea',
  };

  function siteBase() {
    var base = document.querySelector('base');
    if (base && base.href) {
      try {
        var u = new URL(base.href);
        return u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
      } catch (e) { /* */ }
    }
    var m = location.pathname.match(/^(\/[^/]+\/)/);
    if (m && /potoksite/i.test(m[1])) return m[1];
    return '/';
  }

  function resolveSrc(src) {
    if (!src) return null;
    if (/^https?:\/\//i.test(src)) return src;
    if (src.charAt(0) === '/') return src;
    return siteBase() + src.replace(/^\.\//, '');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Minimal markdown → HTML for text nodes */
  function mdLite(text) {
    if (!text) return '';
    var lines = String(text).split('\n');
    var html = [];
    var inList = false;
    lines.forEach(function (line) {
      var t = line.trim();
      if (/^###\s+/.test(t)) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<h3>' + inline(t.replace(/^###\s+/, '')) + '</h3>');
      } else if (/^##\s+/.test(t)) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<h2>' + inline(t.replace(/^##\s+/, '')) + '</h2>');
      } else if (/^#\s+/.test(t)) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<h1>' + inline(t.replace(/^#\s+/, '')) + '</h1>');
      } else if (/^[-*]\s+/.test(t)) {
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push('<li>' + inline(t.replace(/^[-*]\s+/, '')) + '</li>');
      } else if (!t) {
        if (inList) { html.push('</ul>'); inList = false; }
      } else {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<p>' + inline(t) + '</p>');
      }
    });
    if (inList) html.push('</ul>');
    return html.join('');
  }

  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
      var h = href;
      if (!/^https?:\/\//i.test(h) && h.indexOf('.md') !== -1) {
        h = mdToUrl(h);
        if (h.charAt(0) !== '/' && h.indexOf('http') !== 0) {
          h = siteBase() + h.replace(/^\.\//, '');
        }
      }
      return '<a href="' + escapeHtml(h) + '">' + label + '</a>';
    });
    return s;
  }

  /** .md path → MkDocs URL: foo/index.md -> foo/, foo/bar.md -> foo/bar/ */
  function mdToUrl(p) {
    p = String(p || '');
    if (/^https?:\/\//i.test(p)) return p;
    var out = p.replace(/index\.md$/i, '').replace(/\.md$/i, '/');
    return out || '/';
  }

  function colorCss(c) {
    if (!c) return null;
    if (PRESET[c]) return PRESET[c];
    if (/^#/.test(c)) return c;
    return null;
  }

  function sidePoint(node, side) {
    var x = node.x;
    var y = node.y;
    var w = node.width;
    var h = node.height;
    switch (side) {
      case 'top': return { x: x + w / 2, y: y };
      case 'bottom': return { x: x + w / 2, y: y + h };
      case 'left': return { x: x, y: y + h / 2 };
      case 'right': return { x: x + w, y: y + h / 2 };
      default: return { x: x + w / 2, y: y + h / 2 };
    }
  }

  function autoSides(a, b) {
    var acx = a.x + a.width / 2;
    var acy = a.y + a.height / 2;
    var bcx = b.x + b.width / 2;
    var bcy = b.y + b.height / 2;
    var dx = bcx - acx;
    var dy = bcy - acy;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? ['right', 'left'] : ['left', 'right'];
    }
    return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  }

  function edgePath(x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1) * 0.4;
    var c1x = x1 + (x2 > x1 ? dx : -dx);
    var c2x = x2 + (x2 > x1 ? -dx : dx);
    return 'M ' + x1 + ' ' + y1 + ' C ' + c1x + ' ' + y1 + ', ' + c2x + ' ' + y2 + ', ' + x2 + ' ' + y2;
  }

  function fitBounds(nodes) {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function initCanvas(root) {
    if (root.__potokCanvas) return;
    root.__potokCanvas = true;

    var src = root.getAttribute('data-src');
    var height = parseInt(root.getAttribute('data-height') || '480', 10);
    if (height > 0) root.style.height = height + 'px';

    root.classList.add('is-loading');

    var url = resolveSrc(src);
    if (!url) {
      root.classList.remove('is-loading');
      root.classList.add('is-error');
      root.setAttribute('data-error', 'Укажите data-src к .canvas файлу');
      return;
    }

    fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        root.classList.remove('is-loading');
        render(root, data);
      })
      .catch(function (err) {
        root.classList.remove('is-loading');
        root.classList.add('is-error');
        root.setAttribute('data-error', 'Не удалось загрузить canvas: ' + (err.message || err));
      });
  }

  function render(root, data) {
    var nodes = data.nodes || [];
    var edges = data.edges || [];
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });

    root.innerHTML = '';

    var viewport = document.createElement('div');
    viewport.className = 'potok-canvas__viewport';

    var world = document.createElement('div');
    world.className = 'potok-canvas__world';

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'potok-canvas__edges');
    // large canvas space
    var bounds = fitBounds(nodes);
    var pad = 200;
    var svgW = Math.max(1200, bounds.maxX - bounds.minX + pad * 2);
    var svgH = Math.max(800, bounds.maxY - bounds.minY + pad * 2);
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.style.left = (bounds.minX - pad) + 'px';
    svg.style.top = (bounds.minY - pad) + 'px';

    var defs = document.createElementNS(svgNS, 'defs');
    var marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'potok-arrow-' + Math.random().toString(36).slice(2, 8));
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    var mpath = document.createElementNS(svgNS, 'path');
    mpath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    mpath.setAttribute('fill', 'currentColor');
    marker.appendChild(mpath);
    defs.appendChild(marker);
    svg.appendChild(defs);
    var markerId = marker.getAttribute('id');

    // groups first (bottom)
    var ordered = nodes.slice().sort(function (a, b) {
      var za = a.type === 'group' ? 0 : 1;
      var zb = b.type === 'group' ? 0 : 1;
      return za - zb;
    });

    ordered.forEach(function (n) {
      var el = document.createElement('div');
      el.className = 'potok-canvas__node potok-canvas__node--' + (n.type || 'text');
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.style.width = n.width + 'px';
      el.style.height = n.height + 'px';
      if (n.color) {
        el.setAttribute('data-color', n.color);
        var c = colorCss(n.color);
        if (c) el.style.borderColor = c;
      }

      var inner = document.createElement('div');
      inner.className = 'potok-canvas__node-inner';

      if (n.type === 'group') {
        inner.textContent = n.label || '';
      } else if (n.type === 'file') {
        var file = n.file || '';
        var href = mdToUrl(file);
        if (href && href.charAt(0) !== '/' && !/^https?:/i.test(href)) {
          href = siteBase() + href.replace(/^\.\//, '');
        }
        var title = file.split('/').pop().replace(/\.md$/i, '');
        inner.innerHTML = '<a href="' + escapeHtml(href) + '">' + escapeHtml(title) + '</a>';
        if (n.subpath) {
          inner.innerHTML += '<div style="opacity:.65;font-size:11px">' + escapeHtml(n.subpath) + '</div>';
        }
      } else if (n.type === 'link') {
        var url = n.url || '#';
        inner.innerHTML = '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>';
      } else {
        inner.innerHTML = mdLite(n.text || '');
      }

      el.appendChild(inner);
      world.appendChild(el);
    });

    edges.forEach(function (e) {
      var a = byId[e.fromNode];
      var b = byId[e.toNode];
      if (!a || !b) return;
      var sides = [e.fromSide, e.toSide];
      if (!sides[0] || !sides[1]) {
        var auto = autoSides(a, b);
        sides[0] = sides[0] || auto[0];
        sides[1] = sides[1] || auto[1];
      }
      var p1 = sidePoint(a, sides[0]);
      var p2 = sidePoint(b, sides[1]);
      // svg is offset by bounds
      var ox = bounds.minX - pad;
      var oy = bounds.minY - pad;
      var path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', edgePath(p1.x - ox, p1.y - oy, p2.x - ox, p2.y - oy));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-width', '2');
      var ec = colorCss(e.color);
      path.setAttribute('stroke', ec || 'currentColor');
      path.style.color = ec || '';
      path.style.opacity = '0.75';
      var toEnd = e.toEnd !== undefined ? e.toEnd : 'arrow';
      if (toEnd === 'arrow') {
        path.setAttribute('marker-end', 'url(#' + markerId + ')');
      }
      svg.appendChild(path);

      if (e.label) {
        var midX = (p1.x + p2.x) / 2 - ox;
        var midY = (p1.y + p2.y) / 2 - oy - 6;
        var label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', midX);
        label.setAttribute('y', midY);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'potok-canvas__edge-label');
        label.textContent = e.label;
        svg.appendChild(label);
      }
    });

    world.appendChild(svg);
    viewport.appendChild(world);
    root.appendChild(viewport);

    var toolbar = document.createElement('div');
    toolbar.className = 'potok-canvas__toolbar';
    toolbar.innerHTML =
      '<button type="button" data-act="in" title="Zoom in">+</button>' +
      '<button type="button" data-act="out" title="Zoom out">−</button>' +
      '<button type="button" data-act="fit" title="Fit">⊡</button>';
    root.appendChild(toolbar);

    var hint = document.createElement('div');
    hint.className = 'potok-canvas__hint';
    hint.textContent = 'Перетаскивание · колёсико — зум';
    root.appendChild(hint);

    // transform state
    var scale = 1;
    var tx = 0;
    var ty = 0;

    function apply() {
      world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }

    function fit() {
      var rect = root.getBoundingClientRect();
      var bw = bounds.maxX - bounds.minX || 1;
      var bh = bounds.maxY - bounds.minY || 1;
      var s = Math.min(rect.width / (bw + 80), rect.height / (bh + 80), 1.2);
      scale = Math.max(0.15, Math.min(s, 2));
      tx = (rect.width - bw * scale) / 2 - bounds.minX * scale;
      ty = (rect.height - bh * scale) / 2 - bounds.minY * scale;
      apply();
    }

    fit();

    toolbar.addEventListener('click', function (ev) {
      var act = ev.target.getAttribute('data-act');
      if (act === 'in') { scale = Math.min(3, scale * 1.2); apply(); }
      if (act === 'out') { scale = Math.max(0.12, scale / 1.2); apply(); }
      if (act === 'fit') fit();
    });

    // pan
    var dragging = false;
    var lx = 0, ly = 0;
    viewport.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('a,button')) return;
      dragging = true;
      viewport.classList.add('is-dragging');
      lx = ev.clientX;
      ly = ev.clientY;
      viewport.setPointerCapture(ev.pointerId);
    });
    viewport.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      tx += ev.clientX - lx;
      ty += ev.clientY - ly;
      lx = ev.clientX;
      ly = ev.clientY;
      apply();
    });
    viewport.addEventListener('pointerup', function () {
      dragging = false;
      viewport.classList.remove('is-dragging');
    });
    viewport.addEventListener('pointercancel', function () {
      dragging = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var rect = root.getBoundingClientRect();
      var mx = ev.clientX - rect.left;
      var my = ev.clientY - rect.top;
      var prev = scale;
      var factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      scale = Math.max(0.12, Math.min(3, scale * factor));
      // zoom toward cursor
      tx = mx - (mx - tx) * (scale / prev);
      ty = my - (my - ty) * (scale / prev);
      apply();
    }, { passive: false });
  }

  function initAll() {
    document.querySelectorAll('.potok-canvas').forEach(initCanvas);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(initAll);
  }
})();
