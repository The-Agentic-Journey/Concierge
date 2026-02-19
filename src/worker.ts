import { scalebox } from "./scalebox.js";
import { sshExecWithRetry, scpToVM } from "./ssh.js";
import { config } from "./config.js";
import { resolve } from "path";

interface ProcessResult {
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  vmId: string;
  durationMs: number;
}

// Scripts that need to be copied to the VM
const SCRIPTS_DIR = resolve(import.meta.dirname, "../scripts");

export async function processInVM(content: string, date?: string): Promise<ProcessResult> {
  const startTime = Date.now();
  let vmId: string | undefined;

  try {
    // 1. Create VM
    console.log("[worker] Creating VM...");
    const vm = await scalebox.createVM();
    vmId = vm.id;
    // Parse SSH host from ssh command string (e.g., "ssh user@host -p 22001")
    const sshMatch = vm.ssh.match(/@([^\s]+)/);
    if (!sshMatch) {
      throw new Error(`Cannot parse SSH host from: ${vm.ssh}`);
    }
    const sshHost = sshMatch[1];

    console.log(`[worker] VM created: ${vmId}, SSH at ${sshHost}:${vm.ssh_port}`);

    // 2. Copy scripts into VM (use /tmp - user has write access)
    console.log("[worker] Copying scripts to VM...");
    await scpToVM(sshHost, vm.ssh_port, SCRIPTS_DIR, "/tmp/scripts");

    // 3. Prepend date context if provided
    const fullContent = date
      ? `[Datum dieses Transkripts/dieser Notiz: ${date}]\n\n${content}`
      : content;

    // 4. Escape content for shell
    const escapedContent = fullContent
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "'\"'\"'");

    // 5. Execute in VM
    const command = `
      set -e
      export PATH="$HOME/.local/bin:$PATH"

      echo "[vm] Starting execution..." >&2
      echo "[vm] Listing /tmp/scripts..." >&2
      ls -la /tmp/scripts/ >&2

      echo "[vm] Cloning knowledge repo..." >&2
      git clone --branch ${config.knowledgeRepo.branch} ${config.knowledgeRepo.url} /tmp/knowledge

      echo "[vm] Running process-input.sh..." >&2
      cd /tmp/knowledge
      echo '${escapedContent}' | /tmp/scripts/process-input.sh

      echo "[vm] Done." >&2
    `;

    console.log("[worker] Executing in VM...");
    const result = await sshExecWithRetry(
      sshHost,
      vm.ssh_port,
      command
    );

    const durationMs = Date.now() - startTime;

    // Log full VM output
    console.log(`[worker] Exit code: ${result.code}`);
    if (result.stdout) {
      console.log(`[worker] stdout:\n${result.stdout}`);
    }
    if (result.stderr) {
      console.log(`[worker] stderr:\n${result.stderr}`);
    }
    console.log(`[worker] Completed in ${durationMs}ms`);

    return {
      success: result.code === 0,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.code,
      vmId,
      durationMs,
    };
  } finally {
    // 6. Always cleanup VM
    if (vmId) {
      console.log(`[worker] Deleting VM ${vmId}...`);
      try {
        await scalebox.deleteVM(vmId);
      } catch (err) {
        console.error(`[worker] Failed to delete VM: ${err}`);
      }
    }
  }
}
