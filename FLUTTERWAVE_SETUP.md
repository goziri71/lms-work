# Flutterwave Setup Guide

## Environment Variables

Add the following to your `.env` file:

```env
# Flutterwave Configuration
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxx-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxxxxxxxxxxxx-X
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com/v3
```

## Getting Your Flutterwave Keys

### Test Mode (Development)
1. Go to [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Navigate to **Settings** → **API Keys**
3. Copy your **Test Secret Key** (starts with `FLWSECK_TEST-`)
4. Copy your **Test Public Key** (starts with `FLWPUBK_TEST-`)

### Live Mode (Production)
1. Go to [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Navigate to **Settings** → **API Keys**
3. Switch to **Live** mode
4. Copy your **Live Secret Key** (starts with `FLWSECK-`)
5. Copy your **Live Public Key** (starts with `FLWPUBK-`)

## Important Notes

1. **Secret Key Format:**
   - Test: `FLWSECK_TEST-xxxxxxxxxxxxx-X`
   - Live: `FLWSECK-xxxxxxxxxxxxx-X`
   - Make sure there are no extra spaces or quotes

2. **Public Key Format:**
   - Test: `FLWPUBK_TEST-xxxxxxxxxxxxx-X`
   - Live: `FLWPUBK-xxxxxxxxxxxxx-X`

3. **Never commit your `.env` file** to version control

4. **Restart your server** after adding/updating environment variables

## Verification

After setting up, test the configuration:

```bash
# Check if environment variables are loaded
node -e "console.log('Secret Key:', process.env.FLUTTERWAVE_SECRET_KEY ? 'SET' : 'NOT SET')"
```

## Troubleshooting

### Error: "Invalid Flutterwave credentials"
- Check that `FLUTTERWAVE_SECRET_KEY` is set in your `.env` file
- Verify the key doesn't have extra spaces or quotes
- Ensure you're using the correct key (test vs live)
- Make sure you restarted the server after adding the key

### Error: "Flutterwave secret key not configured"
- The `FLUTTERWAVE_SECRET_KEY` environment variable is not set
- Check your `.env` file exists and is in the project root
- Verify the variable name is exactly `FLUTTERWAVE_SECRET_KEY`

