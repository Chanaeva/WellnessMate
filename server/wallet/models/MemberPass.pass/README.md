# Apple Wallet Pass Template

This directory contains the template for generating Apple Wallet passes for Wolf Mother Wellness members.

## Required Files

### Images (Required)
You need to add the following image files to this directory:

1. `icon.png` - 29x29 pixels
2. `icon@2x.png` - 58x58 pixels  
3. `icon@3x.png` - 87x87 pixels
4. `logo.png` - 160x50 pixels
5. `logo@2x.png` - 320x100 pixels
6. `logo@3x.png` - 480x150 pixels

All images should be PNG format with transparent background.

### Certificates (Required)
You need Apple Developer certificates in the `server/wallet/certs/` directory:

1. `signerCert.pem` - Pass Type Certificate
2. `signerKey.pem` - Private key for the certificate
3. `wwdr.pem` - Apple WWDR (Worldwide Developer Relations) Certificate

## How to Get Certificates

1. Go to https://developer.apple.com/account
2. Navigate to Certificates, Identifiers & Profiles
3. Create a Pass Type ID (e.g., pass.com.wolfmother.memberpass)
4. Generate a certificate and download as .p12
5. Convert to PEM format:
   ```bash
   openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out signerCert.pem
   openssl pkcs12 -in certificate.p12 -nocerts -out signerKey.pem
   ```
6. Download WWDR certificate from https://www.apple.com/certificateauthority/
7. Convert to PEM:
   ```bash
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```

## Environment Variables

Set these in your Replit Secrets:

- `APPLE_PASS_TYPE_ID` - Your pass type identifier (e.g., pass.com.wolfmother.memberpass)
- `APPLE_TEAM_ID` - Your Apple Developer Team ID
- `APPLE_CERT_PASSPHRASE` - Password for the .p12 certificate (if you set one)
