import { Client, SFTPWrapper } from "ssh2";
import { config } from "./config.js";
import { getKeyPair } from "./keygen.js";
import { readdir, readFile, stat } from "fs/promises";
import { join, basename } from "path";

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function sshExec(
  host: string,
  port: number,
  command: string,
  timeoutMs: number = config.execution.timeoutMs
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(new Error(`SSH execution timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          settled = true;
          conn.end();
          reject(err);
          return;
        }

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            conn.end();
            resolve({ stdout, stderr, code });
          }
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    const { privateKey } = getKeyPair();
    conn.connect({
      host,
      port,
      username: config.ssh.user,
      privateKey,
      readyTimeout: 10000,
    });
  });
}

// Retry SSH connection (VM might need a moment to boot)
export async function sshExecWithRetry(
  host: string,
  port: number,
  command: string,
  maxRetries: number = 5,
  retryDelayMs: number = 1000
): Promise<ExecResult> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sshExec(host, port, command);
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  throw lastError;
}

// Copy a local directory to the VM via SFTP
export async function scpToVM(
  host: string,
  port: number,
  localDir: string,
  remoteDir: string
): Promise<void> {
  const { privateKey } = getKeyPair();

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on("ready", () => {
      conn.sftp(async (err, sftp) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        try {
          await uploadDir(sftp, localDir, remoteDir);
          conn.end();
          resolve();
        } catch (uploadErr) {
          conn.end();
          reject(uploadErr);
        }
      });
    });

    conn.on("error", reject);

    conn.connect({
      host,
      port,
      username: config.ssh.user,
      privateKey,
      readyTimeout: 10000,
    });
  });
}

async function uploadDir(
  sftp: SFTPWrapper,
  localDir: string,
  remoteDir: string
): Promise<void> {
  // Create remote directory
  await new Promise<void>((res, rej) => {
    sftp.mkdir(remoteDir, (err) => {
      if (err && (err as NodeJS.ErrnoException).code !== "EEXIST") {
        rej(err);
      } else {
        res();
      }
    });
  });

  const entries = await readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`;

    if (entry.isDirectory()) {
      await uploadDir(sftp, localPath, remotePath);
    } else if (entry.isFile()) {
      const content = await readFile(localPath);
      const localStat = await stat(localPath);

      await new Promise<void>((res, rej) => {
        const writeStream = sftp.createWriteStream(remotePath, {
          mode: localStat.mode,
        });
        writeStream.on("error", rej);
        writeStream.on("close", () => res());
        writeStream.end(content);
      });
    }
  }
}
