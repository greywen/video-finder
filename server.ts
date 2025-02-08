import { parse } from 'url';
import next from 'next';
import express from "express"
import path from 'path';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  server.use(express.static(path.join(__dirname, 'public')));

  server.all('*', (req, res) => {
    const parsedUrl = parse(req.url!, true);
    return handle(req, res, parsedUrl);
  });

  server.listen(port, (error) => {
    if (error) throw error;
    console.log(
      `> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV
      }`
    );
  })
});
