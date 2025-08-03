import path from 'path';
import fs from 'fs'
import https from 'https';

const __dirname = path.dirname(process.argv[1]);

async function bootstrap() {
  try {
    const manifest = JSON.parse(fs.readFileSync(`${__dirname}/manifest.json`, 'utf-8'));
    const serverPath = path.join(__dirname, `server/${manifest.server.runtime}`);
    const serverModule = await import(serverPath);
    const routes = Object.entries(manifest.server.routes).reduce((acc, [route, file]) => {
      acc[route.replace(/^\/api/, '') || '/'] = path.join(__dirname, `server/${file}`)
      return acc;
    }, {})
    
    const middlewares = Object.entries(manifest.server.middlewares).reduce((acc, [middleware, file]) => {
      acc[middleware.replace(/^\/api/, '') || '/'] = path.join(__dirname, `server/${file}`)
      return acc;
    }, {})

    const { express, router } = await serverModule.default(routes, middlewares)
    
    const app = express();
    app.use(express.json());

    app.use('/api', router);

    app.use(express.static(path.join(__dirname, 'client'), { redirect: false }))

    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'client', 'index.html'));
    });

    const crt = process.env.CRT;
    const key = process.env.KEY;

    if (crt && key) {
      https.createServer({ cert: crt, key: key }, app).listen(process.env.PORT, () => {
        console.log(`HTTPS server running on port ${process.env.PORT}`);
      });
    } else {
      app.listen(process.env.PORT, () => {
        console.log(`HTTP server running on port ${process.env.PORT}`);
      });
    }

  } catch (e) {
    console.error(e)
  }
}

bootstrap()