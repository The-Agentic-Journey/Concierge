import { generateKeyPairSync } from "crypto";

interface KeyPair {
  privateKey: string;
  publicKey: string;
}

let cachedKeyPair: KeyPair | null = null;

export function getKeyPair(): KeyPair {
  if (cachedKeyPair) {
    return cachedKeyPair;
  }

  console.log("[keygen] Generating ephemeral SSH keypair...");

  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Convert public key from PEM to OpenSSH format
  const publicKeyOpenSSH = pemToOpenSSH(publicKey);

  cachedKeyPair = {
    privateKey,
    publicKey: publicKeyOpenSSH,
  };

  console.log("[keygen] Keypair ready");
  return cachedKeyPair;
}

function pemToOpenSSH(pemPublicKey: string): string {
  // Extract the base64 part from PEM
  const base64 = pemPublicKey
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  // Decode the PEM (it's in SPKI format)
  const der = Buffer.from(base64, "base64");

  // Ed25519 SPKI has a fixed 12-byte header, the key is the last 32 bytes
  const keyData = der.slice(-32);

  // Build OpenSSH format: "ssh-ed25519" + key
  const typeTag = "ssh-ed25519";
  const typeBuffer = Buffer.alloc(4 + typeTag.length);
  typeBuffer.writeUInt32BE(typeTag.length, 0);
  typeBuffer.write(typeTag, 4);

  const keyBuffer = Buffer.alloc(4 + keyData.length);
  keyBuffer.writeUInt32BE(keyData.length, 0);
  keyData.copy(keyBuffer, 4);

  const blob = Buffer.concat([typeBuffer, keyBuffer]);

  return `ssh-ed25519 ${blob.toString("base64")} ingest-gateway`;
}
