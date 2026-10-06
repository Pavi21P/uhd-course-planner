import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    // Stable library chunks can be cached independently from catalog/app updates.
    rolldownOptions: { output: { codeSplitting: {
      includeDependenciesRecursively: false,
      groups: [
        { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
        { name: 'graph-vendor', test: /node_modules[\\/](@xyflow|d3-[^\\/]+|zustand|use-sync-external-store|classcat)[\\/]/ },
        { name: 'catalog', test: /[\\/]data[\\/](catalog|minor)-2025-2026\.json$/ },
      ],
    } } },
  },
})
