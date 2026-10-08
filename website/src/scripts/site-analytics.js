// Docs-site analytics (not part of the npm package). Plain fetch to Mixpanel EU:
// no cookies, no localStorage, random per-page-load ID, IP geolocation off.
// The token placeholder below is replaced at build time from MIXPANEL_TOKEN; if empty, nothing is sent.
(function () {
  var TOKEN = '__TOKEN__';
  if (!TOKEN) return;
  var id =
    (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
  function send(event, props) {
    var p = {
      token: TOKEN,
      distinct_id: id,
      time: Math.floor(Date.now() / 1000),
      app: 'docs',
      path: location.pathname,
    };
    for (var k in props) p[k] = props[k];
    try {
      fetch('https://api-eu.mixpanel.com/track?ip=0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(JSON.stringify([{ event: event, properties: p }])),
        keepalive: true,
      })
        .then(function (r) {
          return r.text();
        })
        .then(function (t) {
          if (t.indexOf('"error"') !== -1 && window.console) console.warn('[analytics]', t);
        })
        .catch(function () {});
    } catch (e) {}
  }
  var trunc = function (s) {
    return String(s || '')
      .trim()
      .slice(0, 100);
  };
  var pathOf = function (href) {
    try {
      return new URL(href, location.href).pathname;
    } catch (e) {
      return href;
    }
  };
  var query = function () {
    var i = document.querySelector('site-search input[type="search"], site-search input');
    return i ? trunc(i.value) : '';
  };

  // Menu clicks (top nav, sidebar) and prev/next pagination.
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest && e.target.closest('a');
      if (!a) return;
      var to = pathOf(a.href);
      var pager = a.closest('.pagination-links');
      if (pager) {
        send('page_nav', {
          direction: a.getAttribute('rel') === 'prev' ? 'back' : 'next',
          from_page: location.pathname,
          to_page: to,
        });
        return;
      }
      if (a.closest('site-search')) {
        var item = a.closest('.pagefind-ui__result, li') || a;
        var t = item.querySelector && item.querySelector('.pagefind-ui__result-title, h3, h2');
        send('search_result_click', {
          query: query(),
          result_title: trunc(t ? t.textContent : a.textContent),
          result_page: to,
        });
        return;
      }
      var where = a.closest('.sidebar-content, #starlight__sidebar')
        ? 'sidebar'
        : a.closest('.top-nav')
          ? 'top-nav'
          : null;
      if (where) send('menu_click', { menu: where, item: trunc(a.textContent), to_page: to });
    },
    true
  );

  // Searches: fire once when the visitor pauses typing; empty queries are ignored.
  var timer;
  document.addEventListener(
    'input',
    function (e) {
      if (!(e.target && e.target.closest && e.target.closest('site-search'))) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = query();
        if (q) send('search', { query: q });
      }, 1000);
    },
    true
  );
})();
