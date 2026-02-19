import { execSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

  const tmpDir = mkdtempSync(join(tmpdir(), "ssh-"));
  const keyPath = join(tmpDir, "id_ed25519");

  try {
    execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -q`);

    cachedKeyPair = {
      privateKey: readFileSync(keyPath, "utf-8"),
      publicKey: readFileSync(`${keyPath}.pub`, "utf-8").trim(),
    };

    console.log("[keygen] Keypair ready");
    return cachedKeyPair;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
