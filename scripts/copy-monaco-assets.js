#!/usr/bin/env node
// Copia los archivos estáticos de Monaco Editor (node_modules/monaco-editor/min/vs)
// a public/monaco/vs, para que Angular los sirva como assets y el cargador AMD
// de Monaco pueda encontrarlos en tiempo de ejecución sin pasar por el bundler.
// Idempotente: si el destino ya existe, no vuelve a copiar (usar --force para repetir).

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const destination = path.join(__dirname, '..', 'public', 'monaco', 'vs');
const force = process.argv.includes('--force');

function main() {
  if (!fs.existsSync(source)) {
    console.warn('[copy-monaco-assets] No se encontró monaco-editor en node_modules; se omite la copia.');
    return;
  }
  if (fs.existsSync(destination) && !force) {
    return;
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
  console.log(`[copy-monaco-assets] Copiado a ${path.relative(process.cwd(), destination)}`);
}

main();
