// Wrap text content in span for strikethrough styling
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.md-typeset .task-list-item');
    items.forEach(function (item) {
      if (item.querySelector('.task-text')) return;
      var firstChild = item.children[0];
      if (!firstChild || firstChild.tagName !== 'LABEL') return;
      var textNodes = [];
      for (var i = 0; i < item.childNodes.length; i++) {
        var node = item.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          textNodes.push(node);
        }
      }
      if (textNodes.length === 0) return;
      var span = document.createElement('span');
      span.className = 'task-text';
      textNodes.forEach(function (node) {
        span.appendChild(document.createTextNode(node.textContent));
      });
      textNodes.forEach(function (node) {
        node.parentNode.removeChild(node);
      });
      item.appendChild(span);
    });
  });
})();
