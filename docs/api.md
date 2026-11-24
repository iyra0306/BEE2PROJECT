# API reference

The React app calls the Express API on the same origin. Market requests accept `mode=demo` or `mode=real`. Use explicit demo mode to test without provider credentials.

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Service and provider status |
| `GET /api/market/overview` | Index cards, market chart, and movers. Supports `market`, `range`, `indexId`, and `symbols`. |
| `GET /api/stocks` | Search and filter the screener. Supports `q`, `market`, `exchange`, `sector`, `priceTier`, `performance`, `sortBy`, `sortDir`, and `symbols`. |
| `GET /api/stocks/:symbol` | Quote and company details |
| `GET /api/stocks/:symbol/history` | OHLCV candles for the requested `range` |
| `GET /api/news` | News, with optional `category`, `q`, and `ticker` filters |
| `GET /api/predictions/:symbol` | Forecast for `horizon=7D`, `14D`, `30D`, or `90D` |

## Accounts and watchlists

The account endpoints use an HttpOnly session cookie. Watchlist endpoints require a signed-in session.

| Method and path | Purpose |
| --- | --- |
| `GET /api/auth/status` | Account service readiness |
| `POST /api/auth/register` | Create an account |
| `POST /api/auth/login` | Start a session |
| `GET /api/auth/me` | Read the current session |
| `POST /api/auth/logout` | Clear the session |
| `GET /api/user/watchlist` | Read saved tickers |
| `PUT /api/user/watchlist` | Replace the ordered watchlist |
| `POST /api/user/watchlist` | Add a ticker |
| `DELETE /api/user/watchlist/:ticker` | Remove a ticker |

## Quick checks

```powershell
Invoke-RestMethod 'http://localhost:3000/api/health?mode=demo'
Invoke-RestMethod 'http://localhost:3000/api/stocks/TCS/history?range=6M&mode=demo'
Invoke-RestMethod 'http://localhost:3000/api/predictions/TCS?horizon=7D&mode=demo'
```
