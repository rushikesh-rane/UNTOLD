// Applies the saved (or system) colour theme before first paint so there is no flash.
// This is a file rather than an inline script so the Content-Security-Policy does not need to allow inline scripts for it.
(function () {
  try {
    var t = localStorage.getItem('untold-theme');
    if (t !== 'light' && t !== 'dark') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var d = document.documentElement;
    d.dataset.theme = t;
    d.style.colorScheme = t;
    document.addEventListener('DOMContentLoaded', function () {
      var c = t === 'dark' ? '#121116' : '#f8f7f4';
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
        m.removeAttribute('media');
        m.setAttribute('content', c);
      });
    });
  } catch {
    /* storage unavailable: fall back to the default theme */
  }
})();
