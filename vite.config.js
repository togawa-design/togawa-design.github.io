import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.VITE_BASE || '/',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lp: resolve(__dirname, 'lp.html'),
        admin: resolve(__dirname, 'admin.html'),
        jobs: resolve(__dirname, 'jobs.html'),
        jobDetail: resolve(__dirname, 'job-detail.html'),
        company: resolve(__dirname, 'company.html'),
        companyEdit: resolve(__dirname, 'company-edit.html'),
        jobManage: resolve(__dirname, 'job-manage.html'),
        location: resolve(__dirname, 'location.html'),
        mypage: resolve(__dirname, 'mypage.html'),
        applicants: resolve(__dirname, 'applicants.html')
      },
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false
      }
    }
  },

  server: {
    port: 3000,
    open: true
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
});
