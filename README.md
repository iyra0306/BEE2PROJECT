# BullSight

**See the Bull. Predict the Move.**

BullSight is a stock market research dashboard for Indian and US equities. It brings together a stock screener, candlestick and volume charts, technical indicators, market news, a prediction center, and personal watchlists.

## Run locally

Use Node.js 22.18 or newer in the Node.js 22 line, or a newer supported release. The project includes a Bun lockfile.

```sh
bun install --frozen-lockfile
bun run dev
```

On Windows, you can also use the npm commands below. The peer dependency flag works around the Vite and esbuild version conflict in the exported project.

```powershell
npm.cmd install --no-package-lock --legacy-peer-deps
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Choose **Demo** in Settings to explore the app without credentials.

## Demo walkthrough

1. Open **Explore Stocks** and search for **TCS**.
2. Open **Technical Analysis**, select **TCS**, and choose **6M** to see indicators such as RSI, MACD, and Bollinger Bands.
3. Add TCS to the watchlist and reload. Guest watchlists are saved in the browser. With Atlas configured, sign in and verify the watchlist survives logout and login.
4. Open **AI Predictions**. Demo forecasts and metrics are illustrative.

## Build and verify

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

The lint script runs the TypeScript checker. The build writes the frontend to `dist/`. The production Express server serves the frontend and API on port 3000 by default.

## Data and architecture

| Area | Implementation |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, and Lightweight Charts |
| Server | Express API, provider adapters, and caching |
| Accounts | MongoDB Atlas with Mongoose, bcrypt password hashes, and JWT session cookies |
| Market data | Demo fixtures, optional Global Datafeeds and Twelve Data adapters, and browser-local NSE Bhavcopy imports |
| Forecasts | Demo fixtures and an adapter for a separately configured Python service |

The React app lives in `src/`. The Express entry point is `server.ts`, with provider, account, and market code under `server/`.

See [Setup and troubleshooting](docs/setup.md) for secrets, real data, and deployment settings. See the [API reference](docs/api.md) for routes and example requests.
