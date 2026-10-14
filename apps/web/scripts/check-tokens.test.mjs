import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Guardia de la capa de estilos: los valores transversales viven SOLO en `_tokens.scss` (CSS) y
 * `_breakpoints.scss` (Sass). Si un componente escribe un valor suelto, o usa un token que no existe,
 * este test falla antes que el rediseño. (Node puro: `node --test "scripts/*.test.mjs"`.)
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');
/** Archivo donde viven los tokens: es el único que puede escribir valores sueltos. */
const TOKENS = join(SRC, 'styles/_tokens.scss');

/**
 * Lista todos los `.scss` bajo `dir`, sin contar `_tokens.scss` ni `_breakpoints.scss` (los dueños de los valores).
 */
function scssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return scssFiles(path);
    return path.endsWith('.scss') && path !== TOKENS && !path.endsWith('_breakpoints.scss')
      ? [path]
      : [];
  });
}

/**
 * Lee un archivo y le saca los comentarios, para que una cita dentro de un comentario no dispare una falsa alarma.
 */
const read = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // comentarios /* … */
    .replace(/^\s*\/\/.*$/gm, ''); // comentarios //

/** Los componentes vigilados, con su contenido ya sin comentarios. */
const FILES = scssFiles(SRC).map((path) => ({ name: relative(SRC, path), css: read(path) }));
/** Contenido de `_tokens.scss` sin comentarios. */
const tokensCss = read(TOKENS);
/** Todos los tokens (`--algo`) que `_tokens.scss` define. */
const defined = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

/** Reglas: lo que NO puede aparecer sin pasar por un token. */
const FORBIDDEN = [
  ['color literal', /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/],
  ['font-size literal', /font-size:\s*(?!var\(|inherit|\d*\.?\d*em\b)[\d.]+(rem|px)/],
  ['font-weight numérico', /font-weight:\s*\d/],
  ['line-height literal', /line-height:\s*(?!var\(|0\b|1\b)[\d.]+/],
  ['letter-spacing literal', /letter-spacing:\s*[\d.-]/],
  ['border-radius literal', /border-radius:\s*(?!var\(|0\b|inherit)[\d.]+/],
  ['box-shadow literal', /box-shadow:\s*(?!var\(|none)[\d.-]/],
  ['z-index literal', /z-index:\s*-?\d/],
  ['opacity literal', /opacity:\s*[\d.]+\s*;/],
  ['duración literal', /(animation|transition)[\w-]*:[^;]*\b(0\.\d+|[1-9]\d*(\.\d+)?)m?s\b/],
  ['grosor de borde literal', /(border|outline)[\w-]*:\s*[^;]*\b\d+px\b/],
  ['media query con ancho literal', /@(media|container)[^{]*\(\s*(min|max)-width:\s*[\d.]+/],
];

describe('capa de estilos (tokens)', () => {
  it('encuentra los componentes que debe vigilar', () => {
    assert.ok(FILES.length > 25);
  });

  for (const [rule, pattern] of FORBIDDEN) {
    it(`ningún .scss escribe ${rule} fuera de _tokens.scss`, () => {
      const hits = FILES.flatMap(({ name, css }) =>
        css
          .split('\n')
          .filter((line) => pattern.test(line))
          .map((line) => `${name}: ${line.trim()}`),
      );
      assert.deepEqual(hits, []);
    });
  }

  it('todo var(--token) usado existe en _tokens.scss o es una propiedad local del componente', () => {
    const local = new Set(
      FILES.flatMap(({ css }) => [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])),
    );
    const missing = FILES.flatMap(({ name, css }) =>
      [...css.matchAll(/var\((--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((token) => !token.endsWith('-') && !defined.has(token) && !local.has(token)) // `--type-#{$t}-bg` se valida aparte
        .map((token) => `${name}: ${token}`),
    );
    assert.deepEqual(missing, []);
  });

  it('los tokens de tipo cubren los 18 tipos (fondo y texto)', () => {
    const types = readFileSync(join(SRC, 'app/ui/atoms/type-chip/type-chip.scss'), 'utf8')
      .match(/\$types:([^;]+);/)[1]
      .split(',')
      .map((t) => t.trim());
    assert.equal(types.length, 18);
    for (const type of types) {
      assert.ok(defined.has(`--type-${type}-bg`), type);
      assert.ok(defined.has(`--type-${type}-fg`), type);
    }
  });

  it('el modo oscuro redefine los mismos colores que el claro', () => {
    const [light, dark] = tokensCss.split('@media (prefers-color-scheme: dark)');
    const lightColors = new Set(
      [...light.matchAll(/(--(?:color|shadow|stat)[\w-]*|--select-arrow)\s*:/g)].map((m) => m[1]),
    );
    const darkColors = new Set(
      [...dark.matchAll(/(--(?:color|shadow|stat)[\w-]*|--select-arrow)\s*:/g)].map((m) => m[1]),
    );
    assert.deepEqual(
      [...lightColors].filter((token) => !darkColors.has(token)),
      [],
    );
  });

  it('manifest e index.html usan el color de marca y de fondo de los tokens', () => {
    const value = (token) =>
      tokensCss.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))[1].toLowerCase();
    const manifest = JSON.parse(readFileSync(join(SRC, '../public/manifest.webmanifest'), 'utf8'));
    const html = readFileSync(join(SRC, 'index.html'), 'utf8');
    assert.equal(manifest.theme_color.toLowerCase(), value('--color-accent'));
    assert.equal(manifest.background_color.toLowerCase(), value('--color-bg'));
    assert.ok(html.includes(`name="theme-color" content="${value('--color-accent')}"`));
  });
});
