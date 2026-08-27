// Markup do card do conversor, fonte única usada:
//  - pela home (modo "unlocked": seletor De -> Para visível), injetado em
//    public/index.html entre <!-- converter:start --> e <!-- converter:end -->;
//  - por cada landing page /converter/<par>/ (modo "locked": par fixo).
// O main.js compilado lê #converter-widget[data-locked|data-from|data-to] e os
// elementos abaixo. Mantenha os IDs em sincronia com src/main.ts.
import { FORMATS, INPUT_KINDS, outputsFor } from '../dist/formats.js';

const OUTPUT_TAGLINE = {
  html: 'preservar leitura no navegador',
  txt: 'texto simples',
  md: 'estrutura leve',
  docx: 'documento do Word',
  pdf: 'documento portátil',
  rtf: 'texto formatado',
  odt: 'documento do LibreOffice',
  csv: 'planilha (tabelas)',
  epub: 'livro digital',
};

// Painel de opções embutido: aparece logo abaixo da linha de botões, aberto,
// só quando o destino tem o que configurar (PDF/DOCX). Para os demais formatos
// fica escondido (sanfona fechada). O main.js controla `hidden`/`open` e a
// visibilidade de cada grupo; os valores são lidos a cada `change` e
// persistidos em localStorage — sem botão de confirmar.
const optionsPanel = `
        <details id="options-panel" class="options-panel" hidden>
          <summary>Opções de saída</summary>
          <div class="options-body" id="options-form">
            <div class="options-group" data-for="pdf" hidden>
              <p class="options-group-title">PDF</p>
              <label>Fonte<select id="pdf-fontFamily"><option value="sans">Sans (Helvetica)</option><option value="serif">Serif (Times)</option><option value="mono">Mono (Courier)</option></select></label>
              <label>Corpo<select id="pdf-baseSize"><option value="10">10 pt</option><option value="11">11 pt</option><option value="12">12 pt</option></select></label>
              <label>Entrelinha<select id="pdf-lineSpacing"><option value="1.2">Compacta</option><option value="1.45">Padrão</option><option value="1.7">Solta</option></select></label>
              <label>Página<select id="pdf-pageSize"><option value="a4">A4</option><option value="letter">Carta</option></select></label>
              <label>Margens<select id="pdf-margins"><option value="narrow">Estreitas</option><option value="normal">Normais</option><option value="wide">Largas</option></select></label>
              <label class="options-check"><input type="checkbox" id="pdf-pageNumbers"> Número de página no rodapé</label>
              <label class="options-check"><input type="checkbox" id="pdf-justify"> Justificar o texto</label>
            </div>
            <div class="options-group" data-for="docx" hidden>
              <p class="options-group-title">DOCX</p>
              <label>Fonte<select id="docx-fontFamily"><option>Calibri</option><option>Arial</option><option>Georgia</option><option>Times New Roman</option></select></label>
              <label>Corpo<select id="docx-baseSize"><option value="10">10 pt</option><option value="11">11 pt</option><option value="12">12 pt</option></select></label>
              <label>Página<select id="docx-pageSize"><option value="a4">A4</option><option value="letter">Carta</option></select></label>
              <label>Margens<select id="docx-margins"><option value="narrow">Estreitas</option><option value="normal">Normais</option><option value="wide">Largas</option></select></label>
            </div>
            <button type="button" id="options-reset">Restaurar padrão</button>
          </div>
        </details>`;

const confirmDialog = `
      <dialog id="confirm-dialog" class="options-dialog">
        <form method="dialog" id="confirm-form">
          <h3>Trocar a origem?</h3>
          <p class="muted">Mudar o formato de origem remove os arquivos já adicionados nesta tela.</p>
          <div class="options-actions"><button type="submit" value="cancel" class="secondary">Cancelar</button><button type="submit" value="confirm" class="primary">Trocar e limpar</button></div>
        </form>
      </dialog>`;

function pairControl(locked, from, to) {
  if (locked) {
    return `<p class="pair-fixed" aria-label="Conversão">${FORMATS[from].label} <span aria-hidden="true">→</span> ${FORMATS[to].label}</p>`
      + `<select id="output" hidden><option value="${to}">${FORMATS[to].label}</option></select>`;
  }
  const sourceOptions = INPUT_KINDS
    .map((k) => `<option value="${k}"${k === from ? ' selected' : ''}>${FORMATS[k].label}</option>`)
    .join('');
  const outputOptions = outputsFor(from)
    .map((k) => `<option value="${k}"${k === to ? ' selected' : ''}>${FORMATS[k].label} — ${OUTPUT_TAGLINE[k]}</option>`)
    .join('');
  return `<fieldset class="pair-field"><legend>Conversão</legend>`
    + `<label>De<select id="source">${sourceOptions}</select></label>`
    + `<span class="pair-arrow" aria-hidden="true">→</span>`
    + `<label>Para<select id="output">${outputOptions}</select></label>`
    + `</fieldset>`;
}

/**
 * @param {{ locked?: boolean, from: string, to: string }} opts
 * @returns {string} markup do <section id="converter-widget">
 */
export function converterCardHtml({ locked = false, from, to }) {
  const dataAttrs = locked
    ? ` data-locked="1" data-from="${from}" data-to="${to}"`
    : ` data-locked="0"`;
  const hint = `Arquivos ${FORMATS[from].ext} · vários de uma vez`;
  return `<section class="card" id="converter-widget"${dataAttrs} aria-labelledby="converter-title">
      <div class="card-heading"><h2 id="converter-title">Converter arquivos</h2><p id="file-summary" class="muted">Nenhum arquivo selecionado</p></div>
      <label id="dropzone" class="dropzone" for="files"><span class="drop-icon">＋</span><span><strong>Adicionar arquivos</strong> <em>adiciona à seleção atual</em></span><small id="dropzone-hint">${hint}</small><input id="files" type="file" accept="${FORMATS[from].accept}" multiple></label>
      <div id="queue" class="queue"></div>
      <form id="converter-form">
        ${pairControl(locked, from, to)}
        <div class="actions"><button class="primary" type="submit">Converter</button><button id="reset" type="button" class="secondary" title="Remove os arquivos e resultados desta tela">Limpar</button></div>
${optionsPanel}
      </form>
${locked ? '' : confirmDialog}
      <p id="status" class="status" role="status" aria-live="polite">Pronto para converter.</p><div id="results" class="results" aria-live="polite"></div>
    </section>`;
}
