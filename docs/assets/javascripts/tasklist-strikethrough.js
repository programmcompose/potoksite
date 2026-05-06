// Wrap text content in span for strikethrough styling
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.md-typeset .task-list-item');
    items.forEach(function (item) {
      if (item.querySelector('.task-text')) return;
      var firstChild = item.children[0];
      if (!firstChild || firstChild.tagName !== 'LABEL') return;
      var textNodes = [];
      for (var i = 1; i < item.children.length; i++) {
        textNodes.push(item.children[i]);
      }
      if (textNodes.length === 0) return;
      var span = document.createElement('span');
      span.className = 'task-text';
      textNodes.forEach(function (node) {
        span.appendChild(node.cloneNode(true));
      });
      item.appendChild(span);
    });
  });
})();
