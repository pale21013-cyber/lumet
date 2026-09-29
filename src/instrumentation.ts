/**
 * Wird einmal beim Server-Start ausgeführt und darf den Start NIE abbrechen.
 * Node-spezifischer Code liegt in instrumentation-node.ts; die Bedingung auf
 * NEXT_RUNTIME wird beim Build aufgelöst, sodass er nie im Edge-Bundle landet.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initializeNodeRuntime } = await import("./instrumentation-node");
      initializeNodeRuntime();
    } catch (err) {
      console.error("[ZyklusSync] Start-Initialisierung unvollständig:", err);
    }
  }
}
