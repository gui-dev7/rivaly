/**
 * agenda-ui.js — desenha as matrizes da Agenda da semana.
 *
 * Duas tabelas com a mesma forma (7 dias × 5 períodos):
 *   - editor: cada célula é um botão com aria-pressed (sua agenda);
 *   - mapa de calor: cada célula mostra quantas pessoas do squad estão
 *     livres; a intensidade da cor vai de 0 a 4 níveis.
 * As regras (somar, cruzar, achar o melhor horário) ficam em
 * domain/availability.js.
 */

import { DAYS, PERIODS } from '../domain/availability.js';
import { escapeHtml } from './ui.js';

const SHORT_PERIOD = {
    morning: 'Manhã',
    afternoon: 'Tarde',
    evening: 'Noite',
    night: 'Madrug.',
    latenight: 'Alta madr.',
};

const headMarkup = () => `
    <thead>
        <tr>
            <th scope="col"><span class="visually-hidden">Dia</span></th>
            ${PERIODS.map((period) => `
                <th scope="col" title="${escapeHtml(`${period.label} · ${period.hint}`)}">
                    <span aria-hidden="true">${escapeHtml(SHORT_PERIOD[period.id] ?? period.label)}</span>
                    <span class="visually-hidden">${escapeHtml(period.label)}</span>
                </th>`).join('')}
        </tr>
    </thead>`;

/** Sua agenda: uma matriz de botões liga/desliga. */
export function agendaEditorMarkup(matrix) {
    let body = '';
    for (let r = 0; r < DAYS.length; r += 1) {
        let cells = '';
        for (let c = 0; c < PERIODS.length; c += 1) {
            const on = matrix[r][c] === 1;
            cells += `
                <td>
                    <button type="button" class="agenda__cell${on ? ' is-on' : ''}" data-agenda-cell="${r}-${c}" aria-pressed="${on}"
                            aria-label="${escapeHtml(`${DAYS[r].label}, ${PERIODS[c].label}: ${on ? 'livre' : 'ocupado'}`)}"></button>
                </td>`;
        }
        body += `<tr><th scope="row">${escapeHtml(DAYS[r].short)}</th>${cells}</tr>`;
    }
    return `
        <table class="agenda agenda--editor">
            <caption class="visually-hidden">Sua agenda. Cada botão marca ou desmarca um período.</caption>
            ${headMarkup()}
            <tbody>${body}</tbody>
        </table>`;
}

/** Mapa de calor do squad: a soma das matrizes, célula a célula. */
export function agendaHeatMarkup({ heat, size, best }) {
    const top = best[0];
    let body = '';
    for (let r = 0; r < DAYS.length; r += 1) {
        let cells = '';
        for (let c = 0; c < PERIODS.length; c += 1) {
            const value = heat[r][c];
            const level = value === 0 ? 0 : Math.max(1, Math.round((value / size) * 4));
            const isBest = top && top.row === r && top.col === c;
            cells += `
                <td class="agenda__heat${isBest ? ' is-best' : ''}" data-level="${level}">
                    <span aria-hidden="true">${value || ''}</span>
                    <span class="visually-hidden">${escapeHtml(`${DAYS[r].label}, ${PERIODS[c].label}: ${value} de ${size} livres`)}</span>
                </td>`;
        }
        body += `<tr><th scope="row">${escapeHtml(DAYS[r].short)}</th>${cells}</tr>`;
    }
    return `
        <table class="agenda agenda--heat">
            <caption class="visually-hidden">Quantas pessoas do squad estão livres em cada período, de ${size}.</caption>
            ${headMarkup()}
            <tbody>${body}</tbody>
        </table>`;
}

/** Frase do melhor horário (ou do motivo de não haver um). */
export function bestSlotText({ best, size, everyone }) {
    if (best.length === 0) return 'Ninguém marcou horário ainda. Comece pela sua agenda.';
    const top = best[0];
    const when = `${top.day.label} · ${top.period.label}`;
    if (everyone.length > 0) return `${when}: todo o squad (${size} de ${size}) está livre.`;
    return `${when}: ${top.value} de ${size} estão livres. Não há um horário em que todos coincidam.`;
}
