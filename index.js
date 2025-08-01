import path from 'path';
import fs from 'fs'

const __dirname = path.dirname(process.argv[1]);

async function bootstrap() {

  const manifest = JSON.parse(fs.readFileSync(`${__dirname}/manifest.json`, 'utf-8'));
  
  try {
    const serverPath = path.join(__dirname, `server/${manifest.server.runtime}`);
    const serverModule = await import(serverPath);
    const routes = Object.entries(manifest.server.routes).reduce((acc, [route, file]) => {
      acc[route.replace(/^\/api/, '') || '/'] = path.join(__dirname, `server/${file}`)
      return acc;
    }, {})
    const { express, router } = await serverModule.default(routes)
    
    const app = express();
    app.use(express.json());

    app.use('/api', router);

    app.use(express.static(path.join(__dirname, 'client'), { redirect: false }))

    app.get('/manifest.json', (req, res) => {
      res.sendFile(path.join(__dirname, 'manifest.json'));
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'client', 'index.html'));
    });

    const PORT = process.env.PORT || 5173;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (e) {
    console.error(e)
  }

}

bootstrap()