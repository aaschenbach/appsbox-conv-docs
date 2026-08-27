#!/usr/bin/env node
// Lê as 12 métricas AFM vendorizadas em public/vendor/afm/ e gera
// src/afm-widths.ts — para cada fonte, um vetor de 256 larguras (unidades de
// 1/1000 de em) indexado por code-point WinAnsiEncoding, que é a codificação
// usada por src/pdf.ts. Nenhum contorno de fonte é lido nem embutido; só as
// larguras de glifo, para permitir quebra de linha proporcional.
//
//   node scripts/build-afm.mjs
//
// Rodar de novo só se as AFM mudarem (não mudam). O resultado é commitado.
// Ver AGENTS.md e o PRD (Parte "PDF proporcional").
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AFM_DIR = path.join(ROOT, 'public', 'vendor', 'afm');
const OUT = path.join(ROOT, 'src', 'afm-widths.ts');

// WinAnsiEncoding (PDF 32000-1, Anexo D.2): code-point -> nome de glifo
// PostScript. 32..126 é ASCII; 128..255 segue o CP1252. Posições sem glifo
// ficam ausentes (largura 0).
const WINANSI = {
  32: 'space', 33: 'exclam', 34: 'quotedbl', 35: 'numbersign', 36: 'dollar', 37: 'percent',
  38: 'ampersand', 39: 'quotesingle', 40: 'parenleft', 41: 'parenright', 42: 'asterisk', 43: 'plus',
  44: 'comma', 45: 'hyphen', 46: 'period', 47: 'slash', 48: 'zero', 49: 'one', 50: 'two', 51: 'three',
  52: 'four', 53: 'five', 54: 'six', 55: 'seven', 56: 'eight', 57: 'nine', 58: 'colon', 59: 'semicolon',
  60: 'less', 61: 'equal', 62: 'greater', 63: 'question', 64: 'at',
  65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J', 75: 'K',
  76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T', 85: 'U', 86: 'V',
  87: 'W', 88: 'X', 89: 'Y', 90: 'Z', 91: 'bracketleft', 92: 'backslash', 93: 'bracketright',
  94: 'asciicircum', 95: 'underscore', 96: 'grave',
  97: 'a', 98: 'b', 99: 'c', 100: 'd', 101: 'e', 102: 'f', 103: 'g', 104: 'h', 105: 'i', 106: 'j',
  107: 'k', 108: 'l', 109: 'm', 110: 'n', 111: 'o', 112: 'p', 113: 'q', 114: 'r', 115: 's', 116: 't',
  117: 'u', 118: 'v', 119: 'w', 120: 'x', 121: 'y', 122: 'z', 123: 'braceleft', 124: 'bar',
  125: 'braceright', 126: 'asciitilde',
  128: 'Euro', 130: 'quotesinglbase', 131: 'florin', 132: 'quotedblbase', 133: 'ellipsis',
  134: 'dagger', 135: 'daggerdbl', 136: 'circumflex', 137: 'perthousand', 138: 'Scaron',
  139: 'guilsinglleft', 140: 'OE', 142: 'Zcaron', 145: 'quoteleft', 146: 'quoteright',
  147: 'quotedblleft', 148: 'quotedblright', 149: 'bullet', 150: 'endash', 151: 'emdash',
  152: 'tilde', 153: 'trademark', 154: 'scaron', 155: 'guilsinglright', 156: 'oe', 158: 'zcaron',
  159: 'Ydieresis', 160: 'space', 161: 'exclamdown', 162: 'cent', 163: 'sterling', 164: 'currency',
  165: 'yen', 166: 'brokenbar', 167: 'section', 168: 'dieresis', 169: 'copyright', 170: 'ordfeminine',
  171: 'guillemotleft', 172: 'logicalnot', 173: 'hyphen', 174: 'registered', 175: 'macron',
  176: 'degree', 177: 'plusminus', 178: 'twosuperior', 179: 'threesuperior', 180: 'acute', 181: 'mu',
  182: 'paragraph', 183: 'periodcentered', 184: 'cedilla', 185: 'onesuperior', 186: 'ordmasculine',
  187: 'guillemotright', 188: 'onequarter', 189: 'onehalf', 190: 'threequarters', 191: 'questiondown',
  192: 'Agrave', 193: 'Aacute', 194: 'Acircumflex', 195: 'Atilde', 196: 'Adieresis', 197: 'Aring',
  198: 'AE', 199: 'Ccedilla', 200: 'Egrave', 201: 'Eacute', 202: 'Ecircumflex', 203: 'Edieresis',
  204: 'Igrave', 205: 'Iacute', 206: 'Icircumflex', 207: 'Idieresis', 208: 'Eth', 209: 'Ntilde',
  210: 'Ograve', 211: 'Oacute', 212: 'Ocircumflex', 213: 'Otilde', 214: 'Odieresis', 215: 'multiply',
  216: 'Oslash', 217: 'Ugrave', 218: 'Uacute', 219: 'Ucircumflex', 220: 'Udieresis', 221: 'Yacute',
  222: 'Thorn', 223: 'germandbls', 224: 'agrave', 225: 'aacute', 226: 'acircumflex', 227: 'atilde',
  228: 'adieresis', 229: 'aring', 230: 'ae', 231: 'ccedilla', 232: 'egrave', 233: 'eacute',
  234: 'ecircumflex', 235: 'edieresis', 236: 'igrave', 237: 'iacute', 238: 'icircumflex',
  239: 'idieresis', 240: 'eth', 241: 'ntilde', 242: 'ograve', 243: 'oacute', 244: 'ocircumflex',
  245: 'otilde', 246: 'odieresis', 247: 'divide', 248: 'oslash', 249: 'ugrave', 250: 'uacute',
  251: 'ucircumflex', 252: 'udieresis', 253: 'yacute', 254: 'thorn', 255: 'ydieresis',
};

const FONTS = {
  helv: 'Helvetica', 'helv-b': 'Helvetica-Bold', 'helv-i': 'Helvetica-Oblique', 'helv-bi': 'Helvetica-BoldOblique',
  times: 'Times-Roman', 'times-b': 'Times-Bold', 'times-i': 'Times-Italic', 'times-bi': 'Times-BoldItalic',
  cour: 'Courier', 'cour-b': 'Courier-Bold', 'cour-i': 'Courier-Oblique', 'cour-bi': 'Courier-BoldOblique',
};

function widthsByName(afmText) {
  const map = new Map();
  for (const line of afmText.split('\n')) {
    if (!line.startsWith('C ')) continue;
    const wx = line.match(/WX\s+(-?\d+)/);
    const name = line.match(/N\s+(\S+)\s*;/);
    if (wx && name) map.set(name[1], Number(wx[1]));
  }
  return map;
}

const table = {};
for (const [key, base] of Object.entries(FONTS)) {
  const byName = widthsByName(readFileSync(path.join(AFM_DIR, `${base}.afm`), 'utf8'));
  const row = new Array(256).fill(0);
  for (let code = 32; code < 256; code += 1) {
    const glyph = WINANSI[code];
    if (glyph && byName.has(glyph)) row[code] = byName.get(glyph);
  }
  table[key] = row;
}

const keys = Object.keys(FONTS);
const body =
  `// GERADO por scripts/build-afm.mjs a partir de public/vendor/afm/*.afm — não editar à mão.\n` +
  `// Largura de glifo (unidades de 1/1000 em) por code-point WinAnsiEncoding, para\n` +
  `// as 12 variantes padrão de Helvetica/Times/Courier. Sem contornos de fonte.\n` +
  `export type AfmFontKey =\n  ${keys.map((k) => `| '${k}'`).join('\n  ')};\n\n` +
  `export const AFM_WIDTHS: Record<AfmFontKey, readonly number[]> = {\n` +
  keys.map((k) => `  '${k}': [${table[k].join(',')}],`).join('\n') +
  `\n};\n`;

writeFileSync(OUT, body);
console.log(`src/afm-widths.ts gerado (${keys.length} fontes, ${body.length} bytes).`);
