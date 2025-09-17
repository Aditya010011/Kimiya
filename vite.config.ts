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
  console.warn(`⚠️  Could not get frontend port from config: ${error instanceof Error ? error.message : 'Unknown error'}. Using default: ${frontendPort}`);
}

console.log(`🎨 Frontend development server will use port ${frontendPort} (${environment} environment)`);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::", // Listen on all interfaces (IPv4 and IPv6)
    port: frontendPort,
    strictPort: true, // Fail if port is already in use

    // Hot Module Replacement (HMR) configuration
    // Disable WebSocket HMR for development domain to avoid connection issues
    hmr: environment === 'development' ? false : {
      port: frontendPort + 1,
      host: 'localhost'
    },

    // Development server options
    open: false, // Don't auto-open browser (we use nginx proxy)
    cors: true, // Enable CORS for development

    // Watch options for better file change detection
    watch: {
      usePolling: true, // Better for Docker/VM environments
      interval: 100, // Check for changes every 100ms
    },
  },

  preview: {
    port: 4173, // Vite preview port from centralized config
    strictPort: true,
    host: "::",
  },

  // Build configuration
  build: {
    // Generate source maps for better debugging
    sourcemap: mode === 'development',

    // Optimize for development builds
    minify: mode === 'production',

    // Output directory
    outDir: mode === 'development' ? 'dist-dev' : 'dist',
  },

  plugins: [
    react({
      // React SWC plugin options - fastRefresh is enabled by default in development
      // No additional configuration needed for Fast Refresh
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Development-specific optimizations
  ...(mode === 'development' && {
    // Optimize dependency pre-bundling for faster dev server startup
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        'lucide-react',
      ],
    },

    // Enable CSS source maps in development
    css: {
      devSourcemap: true,
    },
  }),
}));
