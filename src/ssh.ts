import { Client } from "ssh2";
import { config } from "./config.js";
import { getKeyPair } from "./keygen.js";

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
