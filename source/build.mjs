// Собирает ../index.html: один самодостаточный файл с прототипом, токенами, React и шрифтом Manrope.
// Запуск: node source/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');
const b64 = (f) => readFileSync(new URL(f, dir)).toString('base64');

function parseDc(file) {
  const src = read(file);
  const xdc = src.split('<x-dc>')[1].split('</x-dc>')[0].replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
  const logic = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  return { xdc, logic };
}

function script(code, label) {
  if (/<\/script/i.test(code)) throw new Error(`${label}: содержит </script>`);
  return code;
}

const main = parseDc('Main.dc.html');
const tokens = parseDc('Tokens.dc.html');

const fonts = [
  ['vendor/manrope-cyrillic-wght-normal.woff2', 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
  ['vendor/manrope-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD']
].map(([file, range]) =>
  `@font-face{font-family:'Manrope';font-style:normal;font-display:swap;font-weight:200 800;src:url(data:font/woff2;base64,${b64(file)}) format('woff2');unicode-range:${range}}`
).join('\n');

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Прототип · ИИ-проверка ДЗ</title>
<meta name="description" content="Кликабельный прототип ИИ-проверки домашних заданий: ученик, куратор, методист. Концепт.">
<style>
${fonts}
body{margin:0}
</style>
</head>
<body>
<div id="app"></div>
<noscript>Для прототипа нужен включённый JavaScript.</noscript>
<template id="tpl-main">${main.xdc}</template>
<template id="tpl-tokens">${tokens.xdc}</template>
<script type="text/plain" id="logic-main">${script(main.logic, 'Main')}</script>
<script type="text/plain" id="logic-tokens">${script(tokens.logic, 'Tokens')}</script>
<script>${script(read('vendor/react.production.min.js'), 'react')}</script>
<script>${script(read('vendor/react-dom.production.min.js'), 'react-dom')}</script>
<script>${script(read('runtime.js'), 'runtime')}</script>
</body>
</html>
`;

writeFileSync(new URL('../index.html', dir), html);
console.log(`index.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} КБ`);
