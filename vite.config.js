import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/norloworld-Breakdowndashboard/",
  build: {
    outDir: "docs",
    emptyOutDir: true
  }
})
