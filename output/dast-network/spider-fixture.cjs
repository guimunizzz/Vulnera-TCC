// Serve páginas e recursos locais para comprovar descoberta real pelo Spider sem depender do colega.
// Registra métodos/caminhos e uma origem externa controlada; consumido pela validação da apresentação.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const folder = path.resolve('output/dast-network/spider');
fs.mkdirSync(folder, { recursive: true });
const traffic = [];
function save(origin, req) {
  traffic.push({ origin, method: req.method, url: req.url });
  fs.writeFileSync(path.join(folder, 'fixture-traffic.json'), JSON.stringify(traffic, null, 2));
}
const html = `<!doctype html><html lang="pt-BR"><head><title>Vulnera · Prova do Spider</title>
<script src="/assets/site.js"></script></head><body><h1>Descoberta autorizada</h1>
<a href=/page>Link sem aspas</a><iframe src="/iframe-only" title="Recurso"></iframe>
<a href="/logout">Sair (excluído)</a><a href="/delete-item">Ação excluída</a>
<a href="/search?q=teste">Query excluída</a>
<a href="http://host.docker.internal:18174/outside">Outra origem (excluída)</a>
<form method="POST" action="/submit"><input name="value"><button>Enviar</button></form>
</body></html>`;
const pages = {
  '/': ['text/html; charset=utf-8', html],
  '/robots.txt': ['text/plain', 'User-agent: *\nAllow: /robots-only\nSitemap: http://host.docker.internal:18173/sitemap.xml\n'],
  '/sitemap.xml': ['application/xml', '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://host.docker.internal:18173/sitemap-only</loc></url></urlset>'],
  '/page': ['text/html', '<h1>Página descoberta</h1><a href="/deep/a">Segundo nível</a>'],
  '/deep/a': ['text/html', '<h1>Segundo nível</h1><a href="/deep/b">Terceiro nível</a>'],
  '/deep/b': ['text/html', '<h1>Além da profundidade configurada</h1>'],
  '/robots-only': ['application/json', '{"discovered":"robots"}'],
  '/sitemap-only': ['application/json', '{"discovered":"sitemap"}'],
  '/iframe-only': ['text/html', '<h1>Recurso em iframe</h1>'],
  '/assets/site.js': ['application/javascript', 'console.log("recurso público da fixture");'],
};
const primary = http.createServer((req, res) => {
  save('target', req);
  const entry = pages[req.url];
  if (req.method !== 'GET' || !entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Fora do conjunto esperado');
  }
  res.writeHead(200, { 'Content-Type': entry[0] });
  res.end(entry[1]);
});
const outside = http.createServer((req, res) => {
  save('outside', req);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Origem externa controlada');
});
primary.listen(18173, '0.0.0.0', () => console.log('Fixture local disponível em :18173'));
outside.listen(18174, '0.0.0.0', () => console.log('Origem externa controlada em :18174'));
const shutdown = () => { primary.close(); outside.close(); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
