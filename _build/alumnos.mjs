// Cifra las fichas de los alumnos para el área de alumnos.
//
// Uso:  node _build/alumnos.mjs
//
// Lee cada _build/alumnos/<usuario>.json (texto plano, NO se sube a GitHub: está en .gitignore)
// y escribe alumnos/data/<id>.json cifrado con la clave del alumno.
// Sin la clave correcta el archivo publicado es ruido: nadie puede leer la rutina de otro.
//
// Cifrado: PBKDF2-SHA256 (250.000 vueltas, sal al azar) -> AES-GCM 256.
// El nombre del archivo es un hash del usuario, así ni la lista de alumnos queda a la vista.

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, '_build', 'alumnos');
const outDir = path.join(root, 'alumnos', 'data');
const ITER = 250000;
const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');

export async function fileId(usuario) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('lefc:' + usuario.trim().toLowerCase()));
  return Buffer.from(h).toString('hex').slice(0, 32);
}

async function seal(data, clave) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.json'));
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const f of files) {
  const src = JSON.parse(await readFile(path.join(srcDir, f), 'utf8'));
  const { usuario, clave, ...ficha } = src;
  if (!usuario || !clave) { console.warn('Falta usuario o clave en', f); continue; }
  if (clave.length < 8) { console.warn('Clave muy corta (mínimo 8) en', f); continue; }
  const id = await fileId(usuario);
  await writeFile(path.join(outDir, id + '.json'), JSON.stringify(await seal({ usuario, ...ficha }, clave)));
  console.log('ok', usuario.padEnd(18), '->', id + '.json');
}
