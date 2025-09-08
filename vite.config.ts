import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Load centralized port configuration
const { getPort } = require("./config/ports.cjs");

// Get environment
const environment = process.env.NODE_ENV || 'development';

// Get frontend development port from centralized configuration
let frontendPort = 3000; // Default fallback
try {
  frontendPort = getPort('frontend.dev', environment);
} catch (error) {
  console.warn(`⚠️  Could not get frontend port from config: ${error.message}. Using default: ${frontendPort}`);
}

console.log(`🎨 Frontend development server will use port ${frontendPort} (${environment} environment)`);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: frontendPort,
    strictPort: true, // Fail if port is already in use
  },
  preview: {
    port: 4173, // Vite preview port from centralized config
    strictPort: true,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
