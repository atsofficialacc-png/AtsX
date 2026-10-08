/* AtsX frontend configuration.
   For GitHub Pages + a separate Node backend, set this to your backend URL.
   Example: window.ATSX_API_BASE = 'https://your-server.example.com';
   Leave empty when the website and Node server share the same origin.
*/
window.ATSX_API_BASE = window.ATSX_API_BASE || '';
(function () {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const base = String(window.ATSX_API_BASE || '').replace(/\/$/, '');
    if (base) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        input = base + input;
      } else if (input instanceof Request && input.url.includes('/api/')) {
        input = new Request(base + new URL(input.url).pathname + new URL(input.url).search, input);
      }
    }
    return nativeFetch(input, init);
  };
})();
