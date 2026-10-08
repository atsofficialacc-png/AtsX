# AtsX GitHub Pages setup

1. Upload all files in this folder to the repository root on the `main` branch.
2. GitHub Settings → Pages → Source: **Deploy from a branch**.
3. Branch: **main**, folder: **/(root)** → Save.
4. Do **not** put the GitHub Pages URL into Custom domain. Leave Custom domain empty unless you own a real domain.
5. The homepage is now `index.html`.

## Telegram Approve / Reject
GitHub Pages can host the HTML/CSS/JS but cannot run `server.js`. The Telegram bot and `/api/*` endpoints require the Node.js server to run on a server host.

After deploying the Node server, set the backend URL in `config.js`:

```js
window.ATSX_API_BASE = 'https://YOUR-BACKEND-DOMAIN';
```

Never upload `.env` or a real Telegram bot token to GitHub.
