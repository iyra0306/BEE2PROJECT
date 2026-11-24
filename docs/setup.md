# Setup and troubleshooting

## Accounts and watchlists

1. In MongoDB Atlas, create a cluster and a database user with read and write access to the `bullsight` database.
2. Under **Connect → Drivers**, copy the Node.js connection string. Replace the password placeholder with the URL-encoded database user password. Set the database path to `/bullsight` and preserve any query options.
3. Allow the BullSight server's outbound IP in Atlas **Network Access**. For local development, use the network address from which your computer reaches Atlas.
4. Generate a signing secret. This PowerShell command copies it to the clipboard.

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" | Set-Clipboard
   ```

5. Set `MONGODB_URI` and `JWT_SECRET` in the local root `.env` file or in the deployment's server-side secret manager. In Google AI Studio, use **Settings → Secrets → Add secret**, then select **Apply changes**. Keep credential values out of Git and Build chat.
6. Restart the server and check `GET /api/auth/status`. When the service is ready, register a test account, save a stock, sign out, and sign back in. To inspect the saved record, open Atlas **Data Explorer → bullsight → users**.

The account service is optional at startup. Guest browsing and local watchlists work while the database is disconnected. Password recovery requires a separate integration.

## Market feeds

| Feature | Server configuration |
| --- | --- |
| Global Datafeeds (Indian equities and indices) | `GFDL_API_KEY`, `GFDL_REST_URL`. For streaming, also set `GFDL_STREAMING_ENABLED=true` and `GFDL_WS_URL`. |
| Twelve Data (US equities) | `TWELVE_DATA_API_KEY`. Index and freshness coverage depend on your plan. |
| News | `NEWS_API_URL` and `NEWS_API_KEY` for the configured provider. |
| Forecasts | `PYTHON_PREDICTION_URL` for the external model service. Set `PYTHON_PREDICTION_API_KEY` if required. |

Use the URLs and exchange identifiers supplied by your provider. See [the environment template](../.env.example) for additional provider options. Confirm display rights and feed freshness before making real data public.

For real NSE closing prices in a private prototype, extract one or more official NSE CM-UDiFF Bhavcopy CSVs and select **Settings → Import Bhavcopy CSV(s)**. The files are stored in the current browser. Use **Real** data mode and choose an imported symbol. Imported prices are end-of-day. Technical indicators need multiple trading days of history.

## Production and troubleshooting

Build the frontend and run the Express server using the repository's start command. Configure `PORT` if required by your host. Keep the frontend and API on the same origin and use HTTPS for deployed account sessions.

| Symptom | Check |
| --- | --- |
| Empty real data panels | Check provider settings or CSV imports. Choose Demo mode to use the fixtures. |
| Invalid MongoDB connection string | Paste only the URI into the secret, replace the password placeholder, and encode special characters in the password. |
| MongoDB authentication error | Check the Atlas database user's credentials and database permissions. |
| MongoDB timeout | Check the cluster state and Atlas IP access list. |
| Forecast service unavailable | Confirm the Python service URL and credentials. Demo mode uses illustrative forecasts. |
