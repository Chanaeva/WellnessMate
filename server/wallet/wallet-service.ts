import { PKPass } from "passkit-generator";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MemberPassData {
  membershipId: string;
  userId: number;
  firstName: string;
  lastName: string;
  status: string;
  qrCodeData: string;
}

export class WalletService {
  private certificatesConfigured: boolean = false;
  private modelPath: string;

  constructor() {
    this.modelPath = path.resolve(__dirname, "./models/MemberPass.pass");
    this.checkCertificates();
  }

  private checkCertificates(): boolean {
    const hasWWDR = !!process.env.APPLE_WWDR_CERT;
    const hasSignerCert = !!process.env.APPLE_SIGNER_CERT;
    const hasSignerKey = !!process.env.APPLE_SIGNER_KEY;
    const hasPassTypeId = !!process.env.APPLE_PASS_TYPE_ID;
    const hasTeamId = !!process.env.APPLE_TEAM_ID;

    this.certificatesConfigured = hasWWDR && hasSignerCert && hasSignerKey && hasPassTypeId && hasTeamId;
    
    if (!this.certificatesConfigured) {
      console.warn("Apple Wallet certificates not configured. See server/wallet/models/MemberPass.pass/README.md for setup instructions.");
    }

    return this.certificatesConfigured;
  }

  public isConfigured(): boolean {
    return this.certificatesConfigured;
  }

  public async generateMemberPass(memberData: MemberPassData): Promise<Buffer> {
    if (!this.certificatesConfigured) {
      throw new Error("Apple Wallet is not configured. Please contact support to enable this feature.");
    }

    try {
      // Load certificates from environment variables
      const certificates = {
        wwdr: Buffer.from(process.env.APPLE_WWDR_CERT || "", 'utf-8'),
        signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT || "", 'utf-8'),
        signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY || "", 'utf-8'),
        signerKeyPassphrase: process.env.APPLE_CERT_PASSPHRASE || undefined
      };

      // Read the pass template
      const passData = JSON.parse(
        fs.readFileSync(path.join(this.modelPath, "pass.json"), "utf-8")
      );

      // Update template with environment variables
      passData.passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
      passData.teamIdentifier = process.env.APPLE_TEAM_ID;

      // Create the pass
      const pass = await PKPass.from({
        model: this.modelPath,
        certificates
      }, {
        serialNumber: `WM-${memberData.membershipId}-${Date.now()}`,
        description: "Wolf Mother Wellness Member Pass",
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier: process.env.APPLE_TEAM_ID
      });

      // Set the QR code barcode
      pass.setBarcodes({
        message: memberData.qrCodeData,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: `Member ID: ${memberData.membershipId}`
      });

      // Update pass fields with member data
      pass.headerFields.push({
        key: "status",
        label: "STATUS",
        value: memberData.status.toUpperCase()
      });

      pass.primaryFields.push({
        key: "member",
        label: "MEMBER",
        value: `${memberData.firstName} ${memberData.lastName}`
      });

      pass.secondaryFields.push({
        key: "membershipId",
        label: "MEMBERSHIP ID",
        value: memberData.membershipId
      });

      pass.auxiliaryFields.push({
        key: "facility",
        label: "FACILITY",
        value: "Wolf Mother Wellness"
      });

      // Generate and return the pass buffer
      const buffer = pass.getAsBuffer();
      return buffer;

    } catch (error) {
      console.error("Error generating Apple Wallet pass:", error);
      throw new Error(`Failed to generate Apple Wallet pass: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const walletService = new WalletService();
