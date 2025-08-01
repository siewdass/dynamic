import { defineConfig } from 'vite'
import reactHmr from '@vitejs/plugin-react'
import path from 'path'
import fg from 'fast-glob';
import fs from 'fs'
import esbuild from 'esbuild'
import vite from 'vite'

async function generateManifiest(pattern) {
  const files = await fg('src/**/*.{js,jsx,ts,tsx}');
  const entries = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (pattern.test(content)) {
      entries.push(`./${file.replace(/\\/g, '/')}`);
    }
  }

  const routes = {};

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (pattern.test(content)) {
      // Obtener ruta limpia (para la key del manifest)
      const routeKey = file
        .replace(/^src\//, '/')
        .replace(/\/index\.(jsx|tsx|js|ts)$/, '')
        .replace(/\.(jsx|tsx|js|ts)$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/\/+$/, '') || '/';

        routes[routeKey] = `./${file}`
    }
  }

  return { entries, routes }
}

async function generateBundle(manifest, bundle, base) {
  manifest.routes = {}
  manifest.runtime = ''
  manifest.chunks = []
  for (const [name, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk') {
      if (chunk.name == 'html') continue
      if (chunk.fileName.startsWith('chunks')) {
        manifest.chunks = [ ...manifest.chunks, chunk.fileName ]
        continue
      }
      if (chunk.name == 'runtime') {
        manifest.runtime = name
        continue
      }

      let k = chunk.name.replace(/\/index$/, '').replace(/_([^_]+)_/g, ':$1').toLowerCase();
      
      if (k === 'index') k = '';

      k = k.replace(/\/+$/, '').replace(/^$/, '/'); 

      if (!k.startsWith('/')) k = `/${k}`;

      manifest.routes[`${base}${k}`] = `/${name.replace(/\/index$/, '')}`;
    }
  }
} /// al server le falta api

export default defineConfig(({ }) => {
  let manifest = { client: {}, server: {} }
  // para backend puedo usarlo aqui
  return {
    plugins: [
      reactHmr(),
      {
        name: 'vite-plugin-fullstack-inject-dev',
        apply: 'serve',
        transformIndexHtml() {
          return {
            tags: [
              {
                tag: 'script',
                attrs: { type: 'module', src: '/runtime.js' },
                injectTo: 'body'
              }
            ]
          };
        }
      },
      {
        name: 'vite-plugin-fullstack-inject-build',
        apply: 'build', 
        transformIndexHtml(_, { bundle }) {
          const file = Object.keys(bundle).filter(k => k.startsWith('runtime'))[0]
          return {
            tags: [
              {
                tag: 'script',
                attrs: { type: 'module', src: `/${file}` },
                injectTo: 'body'
              }
            ]
          };
        }
      },
      {
        name: 'vite-plugin-fullstack-dev',
        apply: 'serve',
        async configureServer(viteServer) {
          let { routes } = await generateManifiest(/export\s+(const|function)\s+Request\s*(=|\()/)

          const loadRoutes = async (routes) => {
            return (await viteServer.ssrLoadModule(`server.js?t=${Date.now()}`)).default(routes);
          };

          let { router, express } = await loadRoutes(routes);

          const app = express();
          app.use(express.json());
          app.use('/api', router);

          viteServer.middlewares.use(async (req, res, next) => {
            if (req.url.startsWith('/api')) return app(req, res, next);
            
            if (req.url === '/runtime.js') {
              const mainPath = path.resolve(viteServer.config.root, '/client.js');
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
            
            viteServer.config.logger.info(
              `\x1b[32mhmr ${event}\x1b[0m ${file.replace(viteServer.config.root, '')}`,
              { timestamp: true }
            );

            if (file.startsWith(path.join(viteServer.config.root, 'src'))) {
              if (event !== 'change') viteServer.ws.send({ type: 'full-reload', path: '*' });
              let { routes } = await generateManifiest(/export\s+(const|function)\s+Request\s*(=|\()/)
              
              let { router } = await loadRoutes(routes);
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
          const { entries } = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/)

          return {
            build: {
              target: 'esnext',
              ssr: false,
              outDir: 'dist/client',
              minify: false,
              //emptyOutDir: true,
              //manifest: true,
              rollupOptions: {
                input: {
                  html: path.resolve(__dirname, 'index.html'),
                  runtime: path.resolve(__dirname, 'client.js'),
                  ...Object.fromEntries(
                    entries.map(route => {
                      const entry = route.replace(/^\.\/src\/|\.([jt])sx$/g, '');
                      return [entry, route]; 
                    })
                  )
                },
                output: {
                  format: 'es',
                  chunkFileNames: 'chunks/[name]-[hash].js',
                  entryFileNames: '[name]-[hash].js',
                }
              }
            },
          };
        },
        generateBundle(options, bundle) { generateBundle(manifest.client, bundle, base='') },
        async closeBundle() {
          const { entries } = await generateManifiest(/export\s+(const|function)\s+Request\s*(=|\()/)

          await vite.build({
            configFile: false,
            ssr: {
              noExternal: true,
              external: [],
              target: 'node',
            },
            build: {
              ssr: true,
              outDir: 'dist/server',
              //emptyOutDir: false,
              rollupOptions: {
                input: {
                  runtime: path.resolve(__dirname, 'server.js'),
                  ...Object.fromEntries(
                    entries.map(route => {
                      const entry = route.replace(/^\.\/src\/|\.([jt])s$/g, '');
                      return [entry, route]; 
                    })
                  )
                },
                output: {
                  format: 'cjs',
                  //chunkFileNames: 'chunks/[name]-[hash].js',
                  entryFileNames: '[name]-[hash].js',
                },
                external: [],
                plugins: [{
                  name: 'vite-plugin-ssr-manifest',
                  generateBundle(options, bundle) { generateBundle(manifest.server, bundle, base='/api') }
                }],
              },
            },
          });

          const filePath = path.resolve('dist', 'manifest.json');
          fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2))

          esbuild.build({
            entryPoints: ['index.js'],
            bundle: true,
            platform: 'node',
            target: 'node16',
            format: 'cjs',
            outfile: 'dist/main.js',
            external: [], 
          }).then(() => {
            //console.log('Build completado exitosamente');
          }).catch(() => process.exit(1));
          
        }
      },
    ],
  }
});