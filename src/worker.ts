import { scalebox } from "./scalebox.js";
import { sshExecWithRetry, scpToVM } from "./ssh.js";
import { config } from "./config.js";
import { resolve } from "path";

interface ProcessResult {
  success: boolean;
  output: string;
  error?: string;
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
    console.log(`[worker] VM created: ${vmId} on port ${vm.ssh_port}`);

    // 2. Copy scripts into VM
    console.log("[worker] Copying scripts to VM...");
    await scpToVM(config.scalebox.host, vm.ssh_port, SCRIPTS_DIR, "/scripts");

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

      # Clone knowledge repo (data only)
      git clone --branch ${config.knowledgeRepo.branch} ${config.knowledgeRepo.url} /knowledge 2>/dev/null

      # Run process-input from copied scripts, working in knowledge repo
      cd /knowledge
      echo '${escapedContent}' | /scripts/process-input.sh
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
