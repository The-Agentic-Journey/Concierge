import { scalebox } from "./scalebox.js";
import { sshExecWithRetry } from "./ssh.js";
import { config } from "./config.js";

interface ProcessResult {
  success: boolean;
  output: string;
  error?: string;
  vmId: string;
  durationMs: number;
}

export async function processInVM(content: string): Promise<ProcessResult> {
  const startTime = Date.now();
  let vmId: string | undefined;

  try {
    // 1. Create VM
    console.log("[worker] Creating VM...");
    const vm = await scalebox.createVM();
    vmId = vm.id;
    console.log(`[worker] VM created: ${vmId} on port ${vm.ssh_port}`);

    // 2. Escape content for shell
    const escapedContent = content
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "'\"'\"'");

    // 3. Execute in VM
    const command = `
      set -e
      git clone --depth 1 --branch ${config.repo.branch} ${config.repo.url} /workspace 2>/dev/null
      cd /workspace
      echo '${escapedContent}' | ./process-input.sh
    `;

    console.log("[worker] Executing in VM...");
    const result = await sshExecWithRetry(
      config.scalebox.host,
      vm.ssh_port,
      command
    );

    const durationMs = Date.now() - startTime;
    console.log(`[worker] Completed in ${durationMs}ms`);

    return {
      success: result.code === 0,
      output: result.stdout,
      error: result.stderr || undefined,
      vmId,
      durationMs,
    };
  } finally {
    // 4. Always cleanup VM
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
