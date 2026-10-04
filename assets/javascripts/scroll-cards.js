// Lightweight scroll-reveal for grid cards
document$.subscribe(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cards = document.querySelectorAll(
    ".grid.cards > .md-typeset__scrollwrap, .grid.cards > li"
  );

  if (!cards.length) return;

  if (prefersReduced) {
    cards.forEach((c) => c.classList.add("scroll-card-visible"));
    return;
  }

  cards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 60}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("scroll-card-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  cards.forEach((card) => observer.observe(card));
});
