export function bootstrapWorker(): void {
  console.log('FlowForge worker scaffold initialized. No queue processors configured.');
}

try {
  bootstrapWorker();
} catch (err: unknown) {
  console.error('Failed to initialize FlowForge worker:', err);
  process.exit(1);
}
