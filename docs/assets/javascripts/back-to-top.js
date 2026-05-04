document$.subscribe(() => {
  const btn = document.createElement("a");
  btn.href = "#";
  btn.id = "back-to-top";
  btn.className = "md-back_to_top";
  btn.title = "Наверх";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
  document.body.appendChild(btn);

  const content = document.querySelector("[data-md-component='container']");
  if (!content) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      btn.classList.toggle("md-back_to_top--active", !entry.isIntersecting);
    });
  }, { threshold: 0.1 });

  observer.observe(content);
});
