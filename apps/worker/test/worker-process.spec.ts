import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Worker Process Smoke Test', () => {
  it('launches compiled worker entrypoint, outputs scaffold message, and exits with code 0', async () => {
    const entrypoint = fileURLToPath(new URL('../dist/main.js', import.meta.url));

    const { exitCode, stdout, stderr } = await new Promise<{
      exitCode: number | null;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [entrypoint],
        { timeout: 10000 },
        (error, stdout, stderr) => {
          if (error && typeof error.code !== 'number') {
            reject(error);
            return;
          }
          resolve({
            exitCode: child.exitCode,
            stdout,
            stderr,
          });
        },
      );
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'FlowForge worker scaffold initialized. No queue processors configured.',
    );
    expect(stderr).toBe('');
  }, 15000);
});
