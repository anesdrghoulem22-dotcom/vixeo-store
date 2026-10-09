/* =========================================================
   DUKAN — أنيميشن الظهور عند التمرير (Reveal on scroll)
   يعمل كسكربت عادي (defer) ليعمل حتى بدون خادم محلي.
   ========================================================= */
(function () {
  var root = document.documentElement;
  var els = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!els.length) return;

  function showAll() {
    els.forEach(function (el) { el.classList.add("is-visible"); });
  }

  var reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // يُفعّل الحالة المخفية فقط إذا كان السكربت يعمل فعلاً
  root.classList.add("has-reveal");

  if (reduce || !("IntersectionObserver" in window)) {
    showAll();
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach(function (el) { io.observe(el); });

  // شبكة أمان: أي عنصر فوق خط الشاشة يظهر فوراً عند تحميل الصفحة
  window.addEventListener("load", function () {
    setTimeout(function () {
      els.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-visible");
        }
      });
    }, 80);
  });
})();
