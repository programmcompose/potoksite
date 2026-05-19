document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('.md-search__input');
      if (searchInput) {
        searchInput.focus();
        const overlay = document.querySelector('.md-search__overlay');
        if (overlay && overlay.style.display === 'none') {
          overlay.click();
        }
      }
    }
  });
});
