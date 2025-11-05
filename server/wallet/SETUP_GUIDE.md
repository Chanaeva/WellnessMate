# Apple Wallet Pass Setup Guide

This guide will help you configure Apple Wallet passes for Wolf Mother Wellness member check-ins.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at https://developer.apple.com
   - You'll need this to create pass certificates

2. **Image Assets** (PNG files with transparent background)
   - `icon.png` (29x29px)
   - `icon@2x.png` (58x58px)
   - `icon@3x.png` (87x87px)
   - `logo.png` (160x50px)
   - `logo@2x.png` (320x100px)
   - `logo@3x.png` (480x150px)

## Step 1: Create Pass Type ID

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select **Identifiers** → **+** (Add new)
4. Choose **Pass Type IDs**
5. Enter Description: "Wolf Mother Wellness Member Pass"
6. Enter Identifier: `pass.com.wolfmother.memberpass`
7. Click **Register**

## Step 2: Generate Pass Certificate

1. On your Mac, open **Keychain Access**
2. Go to **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Enter your email and name
4. Choose **Save to disk**
5. Save the `.certSigningRequest` file

6. Return to Apple Developer Console
7. Go to **Certificates** → **+** (Add new)
8. Select **Pass Type ID Certificate**
9. Choose your Pass Type ID created in Step 1
10. Upload the `.certSigningRequest` file
11. Download the certificate (`.cer` file)

## Step 3: Convert Certificates to PEM Format

### On Mac/Linux:

```bash
# 1. Import the certificate to Keychain Access (double-click the .cer file)
# 2. Export as .p12 from Keychain Access:
#    - Right-click the certificate → Export
#    - Choose .p12 format
#    - Set a password (remember this!)

# 3. Convert .p12 to PEM files
openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out signerCert.pem
openssl pkcs12 -in certificate.p12 -nocerts -out signerKey.pem

# 4. Download Apple WWDR Certificate
curl -o AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer

# 5. Convert WWDR to PEM
openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
```

## Step 4: Configure Environment Variables

In your Replit project, add these secrets (Tools → Secrets):

```env
# Required for Apple Wallet
APPLE_PASS_TYPE_ID=pass.com.wolfmother.memberpass
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE

# Certificate contents (paste the entire PEM file content)
APPLE_WWDR_CERT=-----BEGIN CERTIFICATE-----
(paste wwdr.pem content here)
-----END CERTIFICATE-----

APPLE_SIGNER_CERT=-----BEGIN CERTIFICATE-----
(paste signerCert.pem content here)
-----END CERTIFICATE-----

APPLE_SIGNER_KEY=-----BEGIN PRIVATE KEY-----
(paste signerKey.pem content here)
-----END PRIVATE KEY-----

# Optional: if you set a password on your .p12
APPLE_CERT_PASSPHRASE=your_password_here
```

### Finding Your Team ID:
1. Go to https://developer.apple.com/account
2. Click on your name/organization
3. Your Team ID is displayed (10 characters, e.g., `AB12CD3456`)

## Step 5: Add Image Assets

Copy your prepared image files to:
```
server/wallet/models/MemberPass.pass/
  ├── icon.png (29x29px)
  ├── icon@2x.png (58x58px)
  ├── icon@3x.png (87x87px)
  ├── logo.png (160x50px)
  ├── logo@2x.png (320x100px)
  └── logo@3x.png (480x150px)
```

**Tips for creating images:**
- Use your Wolf Mother logo
- Transparent background works best
- For icons: simple, recognizable design
- For logo: horizontal orientation preferred

## Step 6: Test the Integration

1. Restart your Replit application
2. Log in as a member with an active membership
3. Navigate to QR Code page
4. You should see an "Add to Wallet" button
5. Click it to download the `.pkpass` file
6. On iPhone: Open the file in Safari to add to Wallet
7. On Mac: Double-click to preview in Wallet

## Troubleshooting

### "Apple Wallet Not Available" error
- Check that all environment variables are set correctly
- Ensure certificate PEM files are complete (include BEGIN/END lines)
- Verify Pass Type ID matches exactly

### Pass won't open on iPhone
- Verify certificate is valid and not expired
- Check Team ID matches your Apple Developer account
- Ensure Pass Type ID is registered in your account

### QR code not showing in pass
- The QR code is generated dynamically with today's date
- It contains the member's check-in information
- Staff can scan it using the kiosk or staff check-in interface

## Security Notes

- **Never commit certificates to Git** - they're in `.gitignore`
- Store certificates only in Replit Secrets
- Certificates are valid for 1 year and must be renewed
- Keep your Team ID and Pass Type ID private

## Support

For additional help:
- Apple Wallet Documentation: https://developer.apple.com/wallet/
- passkit-generator Library: https://github.com/alexandercerutti/passkit-generator
- Wolf Mother Wellness Support: Contact your system administrator
