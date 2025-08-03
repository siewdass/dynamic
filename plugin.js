import reactHmr from '@vitejs/plugin-react'
import path from 'path'
import fg from 'fast-glob';
import fs from 'fs'
import vite from 'vite'

const replace = (text) => {
  return text.replace(/^src\//, '/')
        .replace(/\/index\.(jsx|tsx|js|ts)$/, '')
        .replace(/\.(jsx|tsx|js|ts)$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/\/+$/, '') || '/';
}

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
      const routeKey = replace(file)
      routes[routeKey] = `./${file}`
    }
  }

  return { entries, routes }
}

async function generateBundle(manifest, bundle, base = '') {
  manifest.routes = {}
  manifest.runtime = ''
  manifest.chunks = []

  for (const [name, chunk] of Object.entries(bundle)) {
    if (chunk.type === 'chunk') {
      if (chunk.name === 'html') continue
      if (chunk.fileName.startsWith('chunks')) {
        manifest.chunks.push(chunk.fileName)
        continue
      }
      if (chunk.name === 'runtime') {
        manifest.runtime = name
        continue
      }

      let k = chunk.name.replace(/\/index$/, '').replace(/_([^_]+)_/g, ':$1').toLowerCase()
      if (k === 'index') k = ''
      k = k.replace(/\/+$/, '').replace(/^$/, '/')
      if (!k.startsWith('/')) k = `/${k}`

      manifest.routes[`${base}${ base == '/api' && k == '/' ? '' : k}`] = `/${name.replace(/\/index$/, '')}`
    }
  }
}

export const vitePluginFullStack = ({ envPrefix = ['CLIENT_', 'SERVER_'], build }) => {
  let manifest = { client: {}, server: {} }

  return [
    reactHmr(),
    {
      name: 'vite-plugin-fullstack-inject',
      async transformIndexHtml(_, { bundle }) {
        let { routes } = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/)
        let file = 'runtime.js'
        if (bundle) {
          file = Object.keys(bundle).filter(k => k.startsWith('runtime'))[0]
          routes = Object.values(bundle).reduce((acc, chunk) => {
            if (chunk.facadeModuleId && chunk.name !== 'html' && chunk.name !== 'runtime' ) {
              const key = replace(path.relative(__dirname, chunk.facadeModuleId).replace(/\\/g, '/'));
              acc[key] = `/${chunk.fileName}`;
            }
            return acc;
          }, {});
        }

        return {
          tags: [
            {
              tag: 'script',
              attrs: { type: 'module' },
              children: `window.__ROUTES__ = ${JSON.stringify(routes)};`,
              injectTo: 'head'
            },
            {
              tag: 'script',
              attrs: { type: 'module', src: `/${file}` },
              injectTo: 'body'
            }
          ]
        };
      },
    },
    {
      name: 'vite-plugin-fullstack-env',
      config(config, { mode }) {
        const env = vite.loadEnv(mode, process.cwd(), envPrefix);
        const filteredEnv = mode === 'production' 
          ? Object.fromEntries(
              Object.entries(env).filter(([key]) => 
                envPrefix.some(prefix => key.startsWith(prefix)) && 
                key.startsWith('CLIENT_')
              )
            )
          : env;
        return {
          define: {
            ...Object.entries(filteredEnv).reduce((acc, [key, value]) => {
              acc[`import.meta.env.${key}`] = JSON.stringify(value);
              return acc;
            }, {}),
          }
        };
      }
    },
    {
      name: 'vite-plugin-fullstack-dev',
      apply: 'serve',
      async configureServer(viteServer) {
        let { routes } = await generateManifiest(/export\s+(const|function)\s+Rest\s*(=|\()/)
        let { routes: middlewares } = await generateManifiest(/export\s+(const|function)\s+Middleware\s*(=|\()/)

        const loadRoutes = async (r, m) => {
          return (await viteServer.ssrLoadModule(`server.js?t=${Date.now()}`)).default(r, m);
        };

        let { router, express } = await loadRoutes(routes, middlewares);
        
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

        let { routes: oldRoutes } = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/)

        viteServer.watcher.on('all', async (event, file) => {
          if (file.startsWith(path.join(viteServer.config.root, 'src'))) {

            viteServer.config.logger.info(
              `\x1b[32mhmr ${event}\x1b[0m ${file.replace(viteServer.config.root, '')}`,
              { timestamp: true }
            );

            let { routes: newRoutes } = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/)

            if (JSON.stringify(oldRoutes) !== JSON.stringify(newRoutes)) {
              oldRoutes = newRoutes
              viteServer.ws.send({ type: 'full-reload', path: '*' });
            }

            if (event !== 'change') {}

            let { routes } = await generateManifiest(/export\s+(const|function)\s+Rest\s*(=|\()/)
            let { routes: middlewares } = await generateManifiest(/export\s+(const|function)\s+Middleware\s*(=|\()/)

            let { router } = await loadRoutes(routes, middlewares);

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
        
        const defineEnv = {
          'process.env.PORT': build.port || 5173
        };

        if (build.crt && build.key) {
          const crtPath = path.resolve(__dirname, build.crt);
          const keyPath = path.resolve(__dirname, build.key);

          if (fs.existsSync(crtPath) && fs.existsSync(keyPath)) {
            defineEnv['process.env.CRT'] = JSON.stringify(fs.readFileSync(crtPath, 'utf-8'));
            defineEnv['process.env.KEY'] = JSON.stringify(fs.readFileSync(keyPath, 'utf-8'));
          }
        }

        await vite.build({
          configFile: false,
          publicDir: false,
          ssr: {
            noExternal: true,
            external: [],
            target: 'node',
          },
          define: defineEnv,
          build: {
            ssr: true,
            emptyOutDir: true,
            outDir: 'dist',
            rollupOptions: {
              external: [],
              input: {
                main: path.resolve(__dirname, 'index.js'),
              },
              output: {
                format: 'cjs',
                entryFileNames: 'main.js',
              }
            }
          }
        });

        const { entries } = await generateManifiest(/export\s+(const|function)\s+View\s*[=\(]/)

        return {
          build: {
            target: 'esnext',
            ssr: false,
            outDir: 'dist/client',
            minify: false,
            emptyOutDir: true,
            //manifest: true,
            rollupOptions: {
              plugins: [],
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
        const { entries } = await generateManifiest(/export\s+(const|function)\s+Rest\s*(=|\()/)
        const { routes, entries: middlewares } = await generateManifiest(/export\s+(const|function)\s+Middleware\s*(=|\()/)

        await vite.build({
          configFile: false,
          publicDir: false,
          ssr: {
            noExternal: true,
            external: [],
            target: 'node',
          },
          plugins: [{
            name: 'vite-plugin-fullstack-env',
            config(config, { mode }) {
              const env = vite.loadEnv(mode, process.cwd(), envPrefix);
              const filteredEnv = mode === 'production' 
                ? Object.fromEntries(
                    Object.entries(env).filter(([key]) => 
                      envPrefix.some(prefix => key.startsWith(prefix)) && 
                      key.startsWith('SERVER_')
                    )
                  )
                : env;
              return {
                define: {
                  ...Object.entries(filteredEnv).reduce((acc, [key, value]) => {
                    acc[`import.meta.env.${key}`] = JSON.stringify(value);
                    return acc;
                  }, {}),
                }
              };
            }
          }],
          build: {
            ssr: true,
            outDir: 'dist/server',
            emptyOutDir: true,
            rollupOptions: {
              input: {
                runtime: path.resolve(__dirname, 'server.js'),
                ...Object.fromEntries(
                  entries.map(route => {
                    const entry = route.replace(/^\.\/src\/|\.([jt])s$/g, '');
                    return [entry, route]; 
                  })
                ),
                ...Object.fromEntries(
                  middlewares.map(route => {
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
              plugins: [
                {
                  name: 'vite-plugin-manifest',
                  generateBundle(options, bundle) {
                    generateBundle(manifest.server, bundle, '/api');

                    manifest.server.middlewares = {};
                    for (const [key, val] of Object.entries(manifest.server.routes)) {
                      if (Object.entries(routes).map(r => `/api${r[0] === '/' ? '' : r[0]}`).includes(key)) {
                        manifest.server.middlewares[key] = val;
                        delete manifest.server.routes[key];
                      }
                    }
                  }
                },
              ],
            },
          },
        })

        const filePath = path.resolve('dist', 'manifest.json');
        fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2))
      }
    },
  ]
}
