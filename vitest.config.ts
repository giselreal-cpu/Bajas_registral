import { defineConfig } from "vitest/config";
import path from "path";

// Los tests resuelven el alias "@/..." igual que Next (ver tsconfig.json).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  }
});
