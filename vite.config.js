import { defineConfig } from 'vite'
import reactHmr from '@vitejs/plugin-react'
import path from 'path'
import fg from 'fast-glob';
import fs from 'fs'
import esbuild from 'esbuild'
import vite from 'vite'
import express from 'express';

async function generateManifiest(pattern, output) {
  const files = await fg('src/**/*.{js,jsx,ts,tsx}');
  const routes = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (pattern.test(content)) {
      routes.push(`./${file.replace(/\\/g, '/')}`);
    }
  }

  const dirPath = path.resolve('node_modules/.vite');
  const filePath = path.resolve(dirPath, output);
  
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  
  const newContent = JSON.stringify({ routes }, null, 2);
  const oldContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  
  if (oldContent !== newContent) fs.writeFileSync(filePath, newContent);
  
  return { routes }
}

export default defineConfig({
  plugins: [
    reactHmr(),
    {
      name: 'vite-plugin-fullstack-inject',
      transformIndexHtml() {
        return {
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module', src: '/client.js' },
              injectTo: 'body'
            }
          ]
        };
      }
    },
    {
      name: 'vite-plugin-fullstack-dev-server',
      apply: 'serve',
      async configureServer(viteServer) {
        await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/, 'manifiest.json')
        let manifest = await generateManifiest(/export\s+(const|function)\s+Request\s*(=|\()/, 'manifiests.json')

        const app = express();
        app.use(express.json());

        const loadRoutes = async () => {
          return (await viteServer.ssrLoadModule(`backend.js?t=${Date.now()}`)).default(manifest);
        };

        let router = await loadRoutes();
        app.use('/api', router);

        viteServer.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api')) {
            return app(req, res, next);
          }

          if (req.url === '/client.js') {
            const mainPath = path.resolve(viteServer.config.root, '/frontend.jsx');
            const { code } = await viteServer.transformRequest(mainPath);
            res.setHeader('Content-Type', 'application/javascript');
            // intentar pasar archivo real
            return res.end(code);
          }
          next();
        });

        viteServer.config.logger.info = ((original) => (msg, opts) => {
          if (msg.includes('page reload') || msg.includes('hmr update')) return;
          original(msg, opts);
        })(viteServer.config.logger.info);

        viteServer.watcher.on('all', async (event, file) => {
          if (fs.existsSync(file) && /\.(js|ts|jsx|tsx)$/.test(file)) {
            const content = fs.readFileSync(file, 'utf-8');
            if (/export\s+(const|function)\s+Request\s*(=|\()/m.test(content)) {
              //para test
            } else if (/export\s+(const|function)\s+View\s*[=\(]/m.test(content)) {
              await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/, 'manifiest.json')
              if (event !== 'change') viteServer.ws.send({ type: 'full-reload', path: '*' });
            }
          }

          viteServer.config.logger.info(
            `\x1b[32mhmr ${event}\x1b[0m ${file.replace(viteServer.config.root, '')}`,
            { timestamp: true }
          );

          if (file.startsWith(path.join(viteServer.config.root, 'src'))) {
            manifest = await generateManifiest(/export\s+(const|function)\s+Request\s*(=|\()/, 'manifiests.json')
            
            router = await loadRoutes(manifest);
            app._router.stack = app._router.stack.filter(
              layer => !(layer.name === 'router' && layer.regexp.test('/api'))
            );
            app.use('/api', router)
          }
        });
      }
    
    },
    {
      name: 'vite-plugin-fullstack-build',
      apply: 'build',
      async config() {
        const manifest = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/, 'manifiest.json')

        return {
          build: {
            target: 'esnext',
            ssr: false,
            outDir: 'dist/client',
            minify: false,
            //emptyOutDir: false,
            rollupOptions: {
              input: {
                client: path.resolve(__dirname, 'frontend.jsx'),
                html: path.resolve(__dirname, 'index.html'),
                ...Object.fromEntries(
                  manifest.routes.map(route => {
                    const entry = route.replace(/^\.\/src\/|\.([jt])sx$/g, '');
                    return [entry, route]; 
                  })
                )
              },
              output: {
                format: 'es',
                //assetFileNames: 'assets/[name][extname]',
                chunkFileNames: 'chunks/[name]-[hash].js',
                entryFileNames: '[name].js',  // Controla el nombre del entry principal
                preserveModules: false  
              }
            }
          },
        };
      },
      async closeBundle() {
        /*await vite.build({
          configFile: false,
          build: {
            ssr: true,
            outDir: 'dist',
            emptyOutDir: false,
            rollupOptions: {
              input: path.resolve(__dirname, 'index.js'),
              output: {
                format: 'es',
                entryFileNames: 'main.js',
              },
              external: [
                'express',
                'path-to-regexp',
                'path',
                'fs',
                'http',
                'url',
                'node:path',
                'node:fs'
              ],
              plugins: [],
            },
          },
        });*/
       esbuild.build({
          entryPoints: ['index.js'],
          bundle: true,
          platform: 'node',
          target: 'node16',
          format: 'cjs',
          outfile: 'dist/main.js',
          external: [], 
        }).then(() => {
            //console.log('✅ Backend bundled successfully!');
        }).catch((e) => {
            //console.error('❌ Build failed:', e);
           // process.exit(1);
        });
      }
    },
  ],
})
