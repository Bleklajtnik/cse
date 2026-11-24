/*
 * Piksel Meta + baner zgody na ciasteczka marketingowe.
 *
 * Piksel (fbevents.js) wczytuje się DOPIERO po kliknięciu "Akceptuję" (art. 399 PKE, RODO).
 * Wybór zapisujemy w localStorage; "Ustawienia cookies" (window.csConsent.open()) pozwala go zmienić.
 * Dodatkowe zdarzenia strony: ustaw przed tym skryptem np. window.csPixelEvents = ['Schedule'];
 * Link do polityki z podstron: <script src="../assets/pixel-consent.js" data-policy="../polityka-prywatnosci.html">
 */
(function () {
  var PIXEL_ID = '1878520939697938';
  var KEY = 'cs-cookie-consent'; // 'granted' | 'denied'
  var POLICY_URL = (document.currentScript && document.currentScript.dataset.policy) || 'polityka-prywatnosci.html';

  function getChoice() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function setChoice(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  var loaded = false;
  function loadPixel() {
    if (loaded) return;
    loaded = true;
    /* Oficjalny kod Meta Pixel */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    (window.csPixelEvents || []).forEach(function (ev) {
      fbq('track', ev);
    });
  }

  var banner = null;
  function closeBanner() {
    if (banner) banner.remove();
    banner = null;
  }
  function decide(v) {
    setChoice(v);
    closeBanner();
    if (v === 'granted') loadPixel();
    else if (loaded) location.reload(); // wycofanie zgody: przeładowanie usuwa piksel ze strony
  }

  function showBanner() {
    if (banner) return;
    if (!document.getElementById('cs-consent-style')) {
      var style = document.createElement('style');
      style.id = 'cs-consent-style';
      style.textContent =
        '#cs-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;' +
        'background:#1a2744;color:#fff;border:1px solid rgba(201,168,76,.35);border-radius:16px;padding:18px 20px;' +
        'box-shadow:0 18px 50px -18px rgba(0,0,0,.55);font:14px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif}' +
        '#cs-consent p{margin:0 0 14px;color:rgba(255,255,255,.8)}' +
        '#cs-consent strong{color:#fff}' +
        '#cs-consent a{color:#d9bc72;text-decoration:underline}' +
        '#cs-consent .cs-row{display:flex;gap:10px;flex-wrap:wrap}' +
        '#cs-consent button{flex:1 1 140px;cursor:pointer;border-radius:10px;padding:10px 14px;' +
        'font-family:inherit;font-size:14px;font-weight:600;line-height:1.2}' +
        '#cs-consent .cs-yes{background:#c9a84c;color:#1a2744;border:1px solid #c9a84c}' +
        '#cs-consent .cs-yes:hover{background:#d9bc72}' +
        '#cs-consent .cs-no{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3)}' +
        '#cs-consent .cs-no:hover{border-color:rgba(255,255,255,.6)}' +
        '#cs-consent p{padding-right:22px}' +
        '#cs-consent .cs-x{position:absolute;top:8px;right:8px;flex:none;width:32px;height:32px;padding:0;' +
        'display:flex;align-items:center;justify-content:center;background:transparent;border:0;border-radius:8px;' +
        'color:rgba(255,255,255,.6);font-size:22px;font-weight:400;line-height:1}' +
        '#cs-consent .cs-x:hover{color:#fff;background:rgba(255,255,255,.08)}' +
        '@media(min-width:640px){#cs-consent{left:24px;right:auto;bottom:24px;max-width:380px;margin:0}}';
      document.head.appendChild(style);
    }

    banner = document.createElement('div');
    banner.id = 'cs-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Zgoda na pliki cookies');
    banner.innerHTML =
      '<button type="button" class="cs-x" aria-label="Zamknij i odrzuć cookies marketingowe">&times;</button>' +
      '<p><strong>Pomóż nam docierać do osób, które chcą mówić po angielsku.</strong> Za Twoją zgodą używamy ' +
      'piksela Meta (Facebook), żeby mierzyć skuteczność naszych reklam. Nie chcesz? Po prostu zamknij to okno (×), ' +
      'strona działa tak samo. Zgodę możesz w każdej chwili zmienić. Więcej w ' +
      '<a href="' + POLICY_URL + '">polityce prywatności</a>.</p>' +
      '<div class="cs-row"><button type="button" class="cs-yes">Akceptuję</button></div>';
    banner.querySelector('.cs-yes').addEventListener('click', function () {
      decide('granted');
    });
    banner.querySelector('.cs-x').addEventListener('click', function () {
      decide('denied');
    });
    document.body.appendChild(banner);
  }

  window.csConsent = { open: showBanner };

  function init() {
    var choice = getChoice();
    if (choice === 'granted') loadPixel();
    else if (choice !== 'denied') showBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
