document$.subscribe(() => {
  const btn = document.createElement("button");
  btn.id = "iy-back-to-top";
  btn.title = "Наверх";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        btn.classList.toggle("show", window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  });
});
