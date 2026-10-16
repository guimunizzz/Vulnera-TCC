/**
 * Verifica os arquivos realmente servidos pelo frontend Docker em localhost:8086.
 * Evita confundir o build local com a versão que Rafael acessa no navegador.
 * Consumidores: validação da publicação local e relatório da barra lateral.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const origin='http://127.0.0.1:8086';
const response=await fetch(origin);
assert.equal(response.status,200);
const html=await response.text();
const js=html.match(/src="([^"]+\.js)"/)?.[1];
const css=html.match(/href="([^"]+\.css)"/)?.[1];
assert.ok(js&&css,'Arquivos do frontend não encontrados no HTML servido');
const [scriptResponse,styleResponse]=await Promise.all([fetch(new URL(js,origin)),fetch(new URL(css,origin))]);
const [script,style]=await Promise.all([scriptResponse.text(),styleResponse.text()]);
const current={url:origin,htmlStatus:response.status,js,css,jsStatus:scriptResponse.status,cssStatus:styleResponse.status,hasBrand:script.includes('app-sidebar-brand'),hasGroups:script.includes('Políticas de SLA'),hasStyle:style.includes('.app-sidebar-link')};
process.stdout.write(`${JSON.stringify(current,null,2)}\n`);
if(!process.argv.includes('--inspect')) {
  assert.equal(current.jsStatus,200);
  assert.equal(current.cssStatus,200);
  assert.ok(current.hasBrand&&current.hasGroups&&current.hasStyle,'O frontend servido ainda não contém a barra lateral atualizada');
  await writeFile(new URL('./served-check.md',import.meta.url),`<!-- Evidência do frontend realmente servido; consumida pela revisão local. -->\n# Frontend Docker atualizado\n\nVerificado em ${new Date().toISOString()}.\n\n- URL: http://localhost:8086\n- HTML, JavaScript e CSS: HTTP 200\n- Bundle: ${js}\n- Estilos: ${css}\n- Marca, grupos e estilos da nova barra lateral encontrados nos arquivos servidos.\n- Comando de atualização: docker compose up -d --build --no-deps web\n`,'utf8');
}
