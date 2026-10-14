/**
 * Guardia de documentación (se corre con `npm run docs:check` y también dentro de `npm run lint`).
 * Revisa todo el TypeScript del repo, tests y utilidades incluidos, con la API del compilador:
 *  1. Cobertura: toda función, método, constructor con lógica, clase, interfaz, tipo y constante
 *     exportada (o que guarde una función) tiene su comentario de responsabilidad.
 *  2. Voz: los comentarios van en español de Chile; si aparece un peninsularismo (vosotros, ordenador,
 *     coger…) o un comentario entero en inglés, la guardia falla y dice dónde.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = [
  "apps/bff/src",
  "apps/bff/test",
  "apps/web/src",
  "apps/web/test-support",
  "apps/web/e2e",
  "packages/contracts/src",
];
const SKIP = new Set(["node_modules", "dist", ".angular"]);

/** Lista los `.ts` y `.mts` bajo una carpeta (sin las declaraciones `.d.ts`). */
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (SKIP.has(name)) return [];
    if (statSync(path).isDirectory()) return walk(path);
    return /\.m?ts$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });

/** Palabras que delatan español de España (no de Chile). */
const PENINSULAR =
  /\b(vosotros|vuestr[oa]s?|ordenador(?:es)?|coger|cogemos|guay|chaval|currar|enchufar|molar|tío)\b/i;
/** Palabras funcionales del inglés que no existen en español: si hay varias, el comentario está en inglés. */
const ENGLISH =
  /\b(the|and|of|to|is|are|for|with|this|that|when|from|will|should|used|returns)\b/gi;

const problems = [];
let declarations = 0;
let comments = 0;

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    const where = (pos) =>
      `${relative(ROOT, file)}:${source.getLineAndCharacterOfPosition(pos).line + 1}`;

    /** ¿El nodo trae un comentario `/** … *\/` o `//` justo antes (arriba de sus decoradores)? */
    const documented = (node) =>
      (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []).some((r) =>
        /^\/(\*\*|\/)/.test(text.slice(r.pos, r.end)),
      );
    const isFn = (init) =>
      init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
    const expect = (node, label) => {
      declarations++;
      if (!documented(node))
        problems.push(`sin comentario → ${where(node.getStart())} ${label}`);
    };

    const visit = (node, depth) => {
      if (ts.isFunctionDeclaration(node) && node.name)
        expect(node, `function ${node.name.text}`);
      else if (ts.isClassDeclaration(node) && node.name)
        expect(node, `class ${node.name.text}`);
      else if (ts.isInterfaceDeclaration(node))
        expect(node, `interface ${node.name.text}`);
      else if (ts.isTypeAliasDeclaration(node))
        expect(node, `type ${node.name.text}`);
      else if (
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessor(node) ||
        ts.isSetAccessor(node)
      )
        expect(node, `método ${node.name.getText()}`);
      else if (
        ts.isConstructorDeclaration(node) &&
        node.body?.statements.length
      )
        expect(node, "constructor");
      else if (ts.isVariableStatement(node)) {
        const exported = node.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword,
        );
        const top = ts.isSourceFile(node.parent);
        for (const d of node.declarationList.declarations) {
          if (
            (top && (exported || isFn(d.initializer))) ||
            (isFn(d.initializer) && depth < 3)
          )
            expect(node, `const ${d.name.getText()}`);
        }
      } else if (ts.isPropertyDeclaration(node) && isFn(node.initializer))
        expect(node, `propiedad ${node.name.getText()}`);
      ts.forEachChild(node, (child) =>
        visit(
          child,
          depth + (ts.isBlock(child) || ts.isClassDeclaration(child) ? 1 : 0),
        ),
      );
    };
    visit(source, 0);

    // Voz: se revisan todos los comentarios del archivo (no las directivas de herramientas).
    const seen = new Set();
    const grab = (pos) => {
      for (const r of [
        ...(ts.getLeadingCommentRanges(text, pos) ?? []),
        ...(ts.getTrailingCommentRanges(text, pos) ?? []),
      ]) {
        if (seen.has(r.pos)) continue;
        seen.add(r.pos);
        const body = text.slice(r.pos, r.end);
        if (/eslint-|prettier-|@ts-|istanbul|c8 /.test(body)) continue;
        comments++;
        const plain = body
          .replace(/^\/\*+|\*+\/$|^\/\/+|^\s*\*/gm, " ")
          .replace(/`[^`]*`/g, " ");
        if (PENINSULAR.test(plain))
          problems.push(
            `léxico de España → ${where(r.pos)} «${plain.trim().slice(0, 70)}»`,
          );
        else if ((plain.match(ENGLISH) ?? []).length >= 3)
          problems.push(
            `¿comentario en inglés? → ${where(r.pos)} «${plain.trim().slice(0, 70)}»`,
          );
      }
    };
    const scan = (node) => {
      grab(node.getFullStart());
      grab(node.getEnd());
      ts.forEachChild(node, scan);
    };
    scan(source);
  }
}

console.log(
  `docs:check → ${declarations} declaraciones y ${comments} comentarios revisados, ${problems.length} problemas.`,
);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
