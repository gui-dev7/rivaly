/**
 * clan-ui.js — diálogos de clã usados em mais de uma tela.
 *
 *   openClanDetail(clanId)         elenco, requisitos, estatísticas e ação
 *   openClanCompatibility(clanId)  a conta da compatibilidade do clã com você
 *   openApplicationForm(clanId)    candidatura com validação inline
 *
 * Toda decisão vem de clans-store.js / community.js; aqui só há DOM.
 */

import { escapeHtml, icon, formatNumber, formatRelativeTime } from './ui.js';
import { openModal, closeModal } from './modal.js';
import { toast } from './notifications.js';
import { CLAN_POLICIES, CLAN_CAPACITY, PLAYSTYLES, rankLabel, regionLabel } from './data.js';
import {
    getClan, myClan, clanCompatibility, clanStats, clanRequirements, joinClan, applyToClan, applicationRules,
    emblemSvg, resolveEmblem, setClanEmblem, EMBLEM_SHAPES, EMBLEM_PATTERNS, EMBLEM_PALETTES,
} from './clans-store.js';
import { buildFeed } from './feed-store.js';
import { getActivity } from './storage.js';
import {
    emblemMarkup, playerChipMarkup, roleLabel, focusGamesText, reasonsListMarkup, simulatedBadgeMarkup,
} from './community-ui.js';
import { validateForm, bindLiveValidation, focusFirstInvalid, showFeedback } from './validation.js';
import { refreshNavigationProgress } from './navigation.js';
import { initTooltips } from './app.js';

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

const changed = () => {
    refreshNavigationProgress();
    document.dispatchEvent(new CustomEvent('rivaly:community-changed'));
    document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
};

/* ============================================================
   SELETOR DE EMBLEMA
   Três grupos de opções (formato, padrão, cores). Cada opção é um
   rádio de verdade (btn-check) com a miniatura do escudo, então dá
   para escolher com teclado e leitor de tela.
   ============================================================ */

function emblemGroupMarkup({ id, name, legend, options, current, preview }) {
    return `
        <fieldset class="emblem-picker__group">
            <legend class="form-label">${escapeHtml(legend)}</legend>
            <div class="emblem-options" id="${id}" data-group="radio">
                ${Object.entries(options).map(([value, option]) => `
                    <input class="btn-check" type="radio" name="${name}" id="${id}-${value}" value="${value}"${value === current ? ' checked' : ''}>
                    <label class="emblem-option" for="${id}-${value}">
                        ${emblemSvg('', { size: 40, showTag: false, emblem: preview(value) })}
                        <span class="emblem-option__label">${escapeHtml(option.label)}</span>
                    </label>`).join('')}
            </div>
        </fieldset>`;
}

/**
 * @param {string} prefix  prefixo dos ids (ex.: "clan", "edit")
 * @param {{shape:string, pattern:string, palette:string}} emblem  escolha atual
 */
export function emblemPickerMarkup(prefix, emblem) {
    return `<div class="emblem-picker">
        ${emblemGroupMarkup({ id: `${prefix}EmblemShape`, name: `${prefix}-shape`, legend: 'Formato do escudo', options: EMBLEM_SHAPES, current: emblem.shape, preview: (shape) => ({ shape, pattern: 'plain', palette: emblem.palette }) })}
        ${emblemGroupMarkup({ id: `${prefix}EmblemPattern`, name: `${prefix}-pattern`, legend: 'Padrão', options: EMBLEM_PATTERNS, current: emblem.pattern, preview: (pattern) => ({ shape: 'heater', pattern, palette: emblem.palette }) })}
        ${emblemGroupMarkup({ id: `${prefix}EmblemPalette`, name: `${prefix}-palette`, legend: 'Cores', options: EMBLEM_PALETTES, current: emblem.palette, preview: (palette) => ({ shape: 'heater', pattern: 'base', palette }) })}
    </div>`;
}

/** Lê a escolha marcada no seletor. */
export function readEmblemPicker(root, prefix) {
    const value = (group) => root.querySelector(`#${prefix}Emblem${group} input:checked`)?.value ?? '';
    return { shape: value('Shape'), pattern: value('Pattern'), palette: value('Palette') };
}

/** O líder escolhe um novo emblema para o clã que criou. */
export function openEmblemEditor() {
    const clan = myClan();
    if (!clan) return;
    const current = resolveEmblem(clan.tag, clan.emblem);

    const { root, close } = openModal({
        title: `Emblema do [${clan.tag}]`,
        subtitle: 'Formato, padrão e cores. A tag fica no centro do escudo.',
        wide: true,
        body: `
            <form id="emblemForm" novalidate>
                <div class="row g-4">
                    <div class="col-12 col-md-4">
                        <div class="emblem-preview">
                            <p class="eyebrow">Prévia</p>
                            <div class="emblem-preview__art" id="editEmblemPreview">${emblemSvg(clan.tag, { size: 140, emblem: current, title: 'Prévia do emblema' })}</div>
                            <p class="emblem-preview__name">[${escapeHtml(clan.tag)}] ${escapeHtml(clan.name)}</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-8">${emblemPickerMarkup('edit', current)}</div>
                </div>
            </form>
        `,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Manter o emblema atual</button>
            <button type="submit" form="emblemForm" class="btn btn-primary">Salvar emblema</button>
        `,
    });

    const form = root.querySelector('#emblemForm');
    form.addEventListener('change', () => {
        root.querySelector('#editEmblemPreview').innerHTML = emblemSvg(clan.tag, { size: 140, emblem: readEmblemPicker(root, 'edit'), title: 'Prévia do emblema' });
    });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const result = setClanEmblem(readEmblemPicker(root, 'edit'));
        if (!result.ok) {
            showFeedback(form, { type: 'error', message: result.reason });
            return;
        }
        close();
        toast({ title: 'Emblema atualizado.', message: `O novo escudo do [${clan.tag}] já aparece em todo o site.`, type: 'success' });
        changed();
    });
}

/* ============================================================
   AÇÃO PRINCIPAL DE UM CLÃ (entrar / candidatar / só convite)
   ============================================================ */

export function clanActionMarkup(clan, { size = '' } = {}) {
    const sm = size === 'sm' ? ' btn-sm' : '';
    const mine = myClan();
    if (mine?.id === clan.id) return `<a class="btn btn-outline-light${sm}" href="clans.html#myClanTitle">Ver meu clã</a>`;
    if (mine) return `<p class="clan-action-note">Você já está no [${escapeHtml(mine.tag)}].</p>`;
    if (clan.policy === 'open') return `<button type="button" class="btn btn-primary${sm}" data-clan-action="join" data-clan="${escapeHtml(clan.id)}">Entrar no clã</button>`;
    if (clan.policy === 'application') return `<button type="button" class="btn btn-primary${sm}" data-clan-action="apply" data-clan="${escapeHtml(clan.id)}">Candidatar-me</button>`;
    return `<p class="clan-action-note">${icon('lock', { size: 12 })} Só por convite. Jogue uma sessão com alguém do clã.</p>`;
}

/** Executa a ação de um botão [data-clan-action]. */
export function runClanAction(action, clanId) {
    if (action === 'join') {
        const result = joinClan(clanId);
        if (result.ok) {
            closeModal();
            toast({ title: `Você entrou no [${result.clan.tag}].`, message: result.clan.motto || 'Bem-vindo ao clã.', type: 'success' });
            changed();
        } else {
            toast({ title: 'Ainda não deu para entrar', message: result.reason, type: 'warning' });
        }
    } else if (action === 'apply') {
        openApplicationForm(clanId);
    } else if (action === 'detail') {
        openClanDetail(clanId);
    } else if (action === 'compat') {
        openClanCompatibility(clanId);
    }
}

/* ============================================================
   DETALHE DO CLÃ
   ============================================================ */

/**
 * Atividade recente do clã: o que os membros postaram no Feed (posts da
 * comunidade simulada, os mesmos que aparecem lá) e o seu histórico com
 * o clã (entrou, candidatou-se, convidou alguém). Mais recentes primeiro.
 */
function clanActivity(clan) {
    const memberIds = new Set(clan.roster.map((entry) => entry.id));
    const own = getActivity()
        .filter((entry) => entry.meta?.clanId === clan.id)
        .map((entry) => ({ text: entry.message, at: entry.at }));
    const posts = buildFeed()
        .filter((item) => item.type === 'post' && memberIds.has(item.author.id))
        .map((item) => ({ text: `${item.author.isSelf ? 'Você' : item.author.name}: ${item.text}`, at: item.at }));
    return [...own, ...posts]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 4);
}

export function openClanDetail(clanId) {
    const clan = getClan(clanId);
    if (!clan) return;
    const stats = clanStats(clan);
    const compat = clanCompatibility(clan);
    const requirements = clanRequirements(clan);
    const activity = clanActivity(clan);

    const roster = clan.roster.map((entry) => `
        <li class="roster__item">
            ${entry.id === 'self'
                ? '<span class="player-chip player-chip--self"><span class="player-chip__name">Você</span></span>'
                : playerChipMarkup(entry.id)}
            <span class="badge role-badge role-badge--${escapeHtml(entry.role)}">${escapeHtml(roleLabel(entry.role))}</span>
        </li>`).join('');

    const { root } = openModal({
        title: `[${clan.tag}] ${clan.name}`,
        subtitle: clan.motto || CLAN_POLICIES[clan.policy].hint,
        wide: true,
        body: `
            <div class="clan-detail">
                <div class="clan-detail__head">
                    ${emblemMarkup(clan, 72)}
                    <dl class="clan-facts">
                        <div><dt>Jogos foco</dt><dd>${escapeHtml(focusGamesText(clan))}</dd></div>
                        <div><dt>Estilo</dt><dd>${escapeHtml(labelOf(PLAYSTYLES, clan.playstyle))}</dd></div>
                        <div><dt>Região</dt><dd>${escapeHtml(regionLabel(clan.region))}</dd></div>
                        <div><dt>Entrada</dt><dd>${escapeHtml(CLAN_POLICIES[clan.policy].label)}</dd></div>
                    </dl>
                </div>

                <div class="row row-cols-2 row-cols-md-4 g-2 clan-detail__stats">
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Compatibilidade</span><span class="mini-stat__value numeric">${compat.total}%</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Rating médio</span><span class="mini-stat__value numeric">${formatNumber(stats.averageRating)}</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Vitórias na temporada</span><span class="mini-stat__value numeric">${stats.seasonWins}</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Nível</span><span class="mini-stat__value numeric">${stats.level.level}</span></div></div>
                </div>

                <div class="clan-goal">
                    <div class="clan-goal__head"><span>Meta semanal</span><span class="numeric">${stats.weekPoints} / ${stats.goal} pts</span></div>
                    <div class="progress" role="progressbar" aria-label="Meta semanal do clã" aria-valuenow="${stats.goalPercent}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${stats.goalPercent}%"></div>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-12 col-md-6">
                        <h3 class="clan-detail__title">Elenco · ${clan.roster.length} de ${CLAN_CAPACITY}</h3>
                        <ul class="roster">${roster}</ul>
                    </div>
                    <div class="col-12 col-md-6">
                        <h3 class="clan-detail__title">Requisitos para você</h3>
                        ${reasonsListMarkup(requirements.map(({ ok, text }) => ({ ok, text })))}
                        <p class="clan-detail__min">Rank mínimo ${escapeHtml(rankLabel(clan.minRank))} · reputação ${clan.minReputation}+</p>
                        <h3 class="clan-detail__title mt-3">Atividade recente</h3>
                        ${activity.length
                            ? `<ul class="clan-log">${activity.map((item) => `<li><span>${escapeHtml(item.text)}</span><time datetime="${escapeHtml(item.at)}">${escapeHtml(formatRelativeTime(item.at))}</time></li>`).join('')}</ul>`
                            : '<p class="clan-detail__min">Nenhum post dos membros nesta semana ainda. Os posts aparecem aqui e no Feed.</p>'}
                    </div>
                </div>
                <p class="clan-detail__sim">${simulatedBadgeMarkup()}</p>
            </div>
        `,
        footer: `
            <button type="button" class="btn btn-ghost" data-clan-action="compat" data-clan="${escapeHtml(clan.id)}">Ver a conta da compatibilidade</button>
            ${clanActionMarkup(clan)}
        `,
    });

    initTooltips(root);
    root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-clan-action]');
        if (button) runClanAction(button.dataset.clanAction, button.dataset.clan);
    });
}

/* ============================================================
   CONTA DA COMPATIBILIDADE
   ============================================================ */

export function openClanCompatibility(clanId) {
    const clan = getClan(clanId);
    if (!clan) return;
    const compat = clanCompatibility(clan);

    const factors = compat.factors.map((factor) => `
        <tr>
            <th scope="row">${escapeHtml(factor.label)}</th>
            <td class="numeric">${factor.weight}%</td>
            <td class="numeric">${factor.earned.toLocaleString('pt-BR')}</td>
        </tr>`).join('');

    const members = compat.perMember.map((entry) => `
        <li class="compat-member">${playerChipMarkup(entry.player.id)} <span class="numeric">${entry.result.total}%</span></li>`).join('');

    const { root } = openModal({
        title: `Compatibilidade com [${clan.tag}]: ${compat.total}%`,
        subtitle: 'Média do motor de 7 fatores entre você e cada membro.',
        wide: true,
        body: `
            <div class="table-responsive">
                <table class="table table-sm">
                    <caption>Pontos médios por fator, usando ${escapeHtml(focusGamesText(clan).split(',')[0])} como jogo da busca.</caption>
                    <thead><tr><th scope="col">Fator</th><th scope="col">Peso</th><th scope="col">Média ganha</th></tr></thead>
                    <tbody>${factors}</tbody>
                </table>
            </div>
            <h3 class="clan-detail__title mt-3">Por membro</h3>
            <ul class="compat-members">${members}</ul>
            <p class="clan-detail__min">Total = média das notas de cada membro = ${compat.total}%.</p>
        `,
        footer: `
            <button type="button" class="btn btn-ghost" data-clan-action="detail" data-clan="${escapeHtml(clan.id)}">Voltar ao clã</button>
            <button type="button" class="btn btn-primary" data-modal-close data-autofocus>Entendi</button>
        `,
    });

    root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-clan-action]');
        if (button) runClanAction(button.dataset.clanAction, button.dataset.clan);
    });
}

/* ============================================================
   CANDIDATURA
   ============================================================ */

export function openApplicationForm(clanId) {
    const clan = getClan(clanId);
    if (!clan) return;
    const failed = clanRequirements(clan).filter((check) => !check.ok);

    const { root, close } = openModal({
        title: `Candidatura ao [${clan.tag}]`,
        subtitle: 'O clã lê sua mensagem e responde em instantes. A resposta chega no centro de convites.',
        body: `
            ${failed.length ? `
                <div class="form-status form-status--warning" role="note">
                    ${icon('alert', { size: 13 })} Atenção: hoje você não cumpre um requisito. A candidatura será recusada com o motivo.
                </div>
                ${reasonsListMarkup(failed.map(({ ok, text }) => ({ ok, text })))}
            ` : ''}
            <form id="applicationForm" novalidate>
                <label class="form-label" for="applicationMessage">Por que você quer entrar?</label>
                <textarea class="form-control" id="applicationMessage" rows="4" maxlength="280"
                    aria-describedby="applicationHelp applicationCount"
                    placeholder="Ex.: Jogo ${escapeHtml(focusGamesText(clan).split(',')[0])} toda noite, de suporte, e quero treinar com um time fixo."></textarea>
                <div class="form-meta">
                    <p class="form-text mb-0" id="applicationHelp">De 20 a 280 caracteres. Citar o clã ou os jogos foco ajuda.</p>
                    <p class="form-text mb-0 numeric" id="applicationCount" aria-live="polite">0/280</p>
                </div>
            </form>
        `,
        footer: `
            <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
            <button type="submit" form="applicationForm" class="btn btn-primary">Candidatar-me ao [${escapeHtml(clan.tag)}]</button>
        `,
    });

    const form = root.querySelector('#applicationForm');
    const textarea = root.querySelector('#applicationMessage');
    const counter = root.querySelector('#applicationCount');
    const schema = { applicationMessage: applicationRules() };

    // Contador ao vivo: o número muda a cada tecla, sem recarregar nada.
    textarea.addEventListener('input', () => {
        const length = textarea.value.trim().length;
        counter.textContent = `${length}/280`;
        counter.classList.toggle('is-short', length > 0 && length < 20);
    });

    bindLiveValidation(form, schema);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const result = validateForm(form, schema);
        if (!result.valid) {
            focusFirstInvalid(result);
            return;
        }
        const outcome = applyToClan(clanId, textarea.value);
        if (!outcome.ok) {
            showFeedback(form, { type: 'error', message: outcome.reason ?? Object.values(outcome.errors ?? {})[0]?.[0] ?? 'Revise a mensagem.' });
            return;
        }
        close();
        toast({
            title: `Candidatura enviada ao [${clan.tag}]`,
            message: 'A resposta chega no centro de convites (sino, no topo) em alguns segundos.',
            type: 'success',
        });
        changed();
    });
}
