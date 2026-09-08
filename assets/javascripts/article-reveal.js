// Scroll-reveal for article blocks and homepage surfaces
document$.subscribe(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const blocks = document.querySelectorAll([
    ".md-typeset > h2",
    ".md-typeset > .admonition",
    ".md-typeset > details",
    ".md-typeset > .md-typeset__scrollwrap",
    ".md-typeset > blockquote",
    ".home-path__step",
    ".home-chat",
    ".stage-card"
  ].join(", "));

  if (!blocks.length) return;

  blocks.forEach((el, i) => {
    if (el.classList.contains("reveal-visible") || el.classList.contains("scroll-card-visible")) {
      return;
    }
    el.classList.add("reveal-pending");
    el.style.transitionDelay = Math.min(i * 40, 240) + "ms";
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal-visible");
        entry.target.classList.remove("reveal-pending");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -20px 0px" }
  );

  blocks.forEach((el) => observer.observe(el));

  setTimeout(() => {
    document.querySelectorAll(".reveal-pending").forEach((el) => {
      el.classList.add("reveal-visible");
      el.classList.remove("reveal-pending");
    });
  }, 1400);
});
