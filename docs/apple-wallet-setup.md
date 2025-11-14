# Apple Wallet Pass Setup Guide

## Overview

Wolf Mother Wellness uses Apple Wallet passes to provide members with QR codes for check-in. To enable this feature, you need to obtain certificates from Apple Developer Program.

## Prerequisites

- **Apple Developer Program membership** ($99/year)
- **Required role**: Account Holder or Admin
- **Mac computer** (for Keychain Access) or Linux/Windows with OpenSSL

## Step 1: Create a Pass Type ID

1. Go to [Apple Developer Portal](https://developer.apple.com) → **Account**
2. Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**
3. Click the **+ (Add)** button
4. Select **Pass Type IDs** from the list
5. Fill in:
   - **Description**: "Wolf Mother Wellness Member Pass"
   - **Identifier**: Must start with `pass.` followed by reverse domain notation
     - Example: `pass.com.wolfmotherwellness.member`
6. Click **Continue** → Review → **Register**

## Step 2: Create a Certificate Signing Request (CSR)

### Option A: On Mac (Using Keychain Access)

1. Open **Keychain Access** (Applications → Utilities)
2. Menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Fill in:
   - **User Email Address**: Your Apple ID email
   - **Common Name**: "Wolf Mother Wellness Pass Certificate"
   - **CA Email Address**: Leave empty
   - **Request is**: Select "Saved to disk"
4. Click **Continue** and save the `.certSigningRequest` file

### Option B: On Linux/Windows (Using OpenSSL)

```bash
# Generate private key and CSR
openssl genrsa -out Private.key 2048
openssl req -new -key Private.key -out Request.csr -subj "/C=US/ST=Oklahoma/L=Tulsa/O=Wolf Mother Wellness"
```

**Important**: Save both `Private.key` and `Request.csr` securely.

## Step 3: Generate the Pass Type ID Certificate

1. In Apple Developer Portal, go to **Certificates, Identifiers & Profiles** → **Identifiers**
2. Click on your **Pass Type ID**
3. Under **Production Certificates**, click **Create Certificate**
4. Click **Continue** and review the CSR instructions
5. Click **Choose File** and upload your `.certSigningRequest` (or `.csr`) file
6. Click **Continue**
7. **Download** the certificate (saved as `pass.cer`)

## Step 4: Export Certificate to .p12 Format

### On Mac:

1. Double-click `pass.cer` to add it to **Keychain Access**
2. In Keychain Access, find the certificate (starts with "Pass Type ID:")
3. **Right-click** the certificate → **Export**
4. Choose:
   - **File Format**: Personal Information Exchange (.p12)
   - **Name**: `wolfmother-pass.p12`
5. Click **Save** and enter a **password** (save this password securely!)
6. Enter your Mac login password when prompted

### On Linux/Windows:

```bash
# Convert .cer to .pem
openssl x509 -in pass.cer -inform DER -out pass.pem -outform PEM

# Create .p12 with private key
openssl pkcs12 -export -inkey Private.key -in pass.pem -out wolfmother-pass.p12
```

When prompted, enter a password for the .p12 file.

## Step 5: Install Apple WWDR Intermediate Certificate

For signing passes, you need the Apple Worldwide Developer Relations (WWDR) G4 certificate:

1. Download **AppleWWDRCAG4.cer** from [Apple's website](https://www.apple.com/certificateauthority/)
2. Double-click to install (Mac) or import via OpenSSL (Linux/Windows)
3. Verify:
   - Expiration date: 2030
   - Organization field: G4

## Step 6: Configure Environment Variables

Once you have your certificates, configure these environment variables in Replit:

1. Go to your Replit project → **Secrets** (lock icon in left sidebar)
2. Add the following secrets:

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `APPLE_PASS_TYPE_ID` | Your Pass Type ID | Example: `pass.com.wolfmotherwellness.member` |
| `APPLE_TEAM_ID` | Your Team ID | Found in Apple Developer Account or Keychain Access |
| `APPLE_PASS_CERT` | Base64 encoded .p12 file | See encoding instructions below |
| `APPLE_PASS_CERT_PASSWORD` | Password for .p12 file | The password you set when exporting |

### Encoding the .p12 Certificate to Base64

#### On Mac/Linux:

```bash
base64 -i wolfmother-pass.p12 -o pass-cert-base64.txt
```

#### On Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("wolfmother-pass.p12")) | Out-File -FilePath pass-cert-base64.txt
```

Copy the contents of `pass-cert-base64.txt` and paste it as the value for `APPLE_PASS_CERT`.

### Finding Your Team ID

#### Option 1: From Keychain Access (Mac)

1. Open the Pass Type ID certificate in Keychain Access
2. Click **Details** or press **⌘I**
3. Look for **Organizational Unit (OU)** field
4. The 10-character value is your Team ID

#### Option 2: From Apple Developer Portal

1. Go to [Apple Developer Account](https://developer.apple.com/account)
2. Your Team ID appears in the **Membership** section

## Step 7: Test Your Configuration

After setting up the environment variables:

1. Restart your Replit application
2. Log in as a member with an active membership
3. Navigate to your dashboard
4. Click "Add to Apple Wallet"
5. The pass should download and install successfully

## Important Notes

### Certificate Expiration

- **Pass certificates expire after 398 days** (approximately 1 year)
- Existing passes on devices continue to work after expiration
- You **cannot** sign new passes or send updates with an expired certificate
- Renew certificates before expiration to avoid service interruption

### Required Files Summary

- **pass.cer**: Certificate from Apple (for reference)
- **pass.p12**: Combined certificate + private key (for signing passes)
- **Certificate password**: Set when creating .p12
- **Pass Type ID**: E.g., `pass.com.wolfmotherwellness.member`
- **Team ID**: Found in Keychain Access or Apple Developer Account

### Security

- Never share your .p12 file or private key
- Store passwords securely in Replit Secrets
- Never commit certificates to version control
- Revoked certificates will break existing passes

## Renewal Process

Certificates expire after ~1 year. To renew:

1. Go to **Certificates, Identifiers & Profiles** → **Certificates**
2. Click **+ (Add)** to create a new certificate
3. Select **Pass Type ID Certificate**
4. Choose the **same Pass Type ID** you're renewing
5. Upload a new CSR (can reuse the old one if saved)
6. Download and export as .p12 (same process as Step 4)
7. Update the `APPLE_PASS_CERT` secret in Replit with the new base64-encoded certificate

Apple sends reminder emails before certificate expiration.

## Troubleshooting

### "Pass could not be created" Error

- Verify all environment variables are set correctly
- Check that the .p12 password matches `APPLE_PASS_CERT_PASSWORD`
- Ensure the base64 encoding is complete (no line breaks or truncation)
- Verify your Apple Developer account is active

### Pass Won't Install on Device

- Check that the Pass Type ID matches your certificate
- Verify the WWDR intermediate certificate is installed
- Ensure the pass JSON is valid (check server logs)

### "Certificate expired" Error

- Check certificate expiration in Keychain Access
- Renew the certificate following the renewal process above

## Additional Resources

- [Official Apple Wallet Developer Guide](https://developer.apple.com/wallet/get-started/)
- [PassKit Framework Documentation](https://developer.apple.com/documentation/passkit)
- [Apple Developer Support](https://developer.apple.com/contact/)
- [passkit-generator NPM Package](https://www.npmjs.com/package/passkit-generator)

## Current Status

⚠️ **Apple Developer Account Pending**: The Apple Wallet feature is fully implemented in the application but requires an approved Apple Developer account to generate the necessary certificates. Once approved, follow this guide to configure the certificates and enable the feature.
