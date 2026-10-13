/**
 * squads.js — controller de Squads: busca, sessão e pós-partida.
 *
 * Fluxo:
 *   1. busca: o Motor de Compatibilidade pontua todo o grupo simulado
 *      em sete fatores e mostra a conta de cada resultado;
 *   2. sessão: o usuário escolhe de 2 a 4 jogadores (resultados ou squad
 *      salvo) ou pede um squad sorteado, ponderado pela compatibilidade;
 *   3. pós-partida: para cada colega, Aliado / Rival / Neutro, elogios e
 *      as ações que fazem sentido (pedir para entrar no clã, convidar,
 *      salvar parceiro, desafiar na Arena).
 *
 * As regras ficam em compatibility.js, sessions.js, partners.js e
 * clans-store.js. Aqui ficam o DOM e os eventos.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import {
    SQUAD_GAMES, PLAYSTYLES, RANK_LADDER, SCHEDULES, ROLES, PLAYERS, PRAISES, RELATION_TYPES,
    getGameById, getPlayerById, rankLabel,
} from './data.js';
import { findMatches, WEIGHTS } from './compatibility.js';
import { getUser, getSquads, saveSquads } from './storage.js';
import { updateUser } from './profile.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { toast } from './notifications.js';
import { openModal, confirmDialog } from './modal.js';
import { refreshNavigationProgress } from './navigation.js';
import { squadCardMarkup } from './cards.js';
import { savePartner, removePartner, savedPartnerIds } from './partners.js';
import {
    playSession, randomSquad, ratePlayer, relationOf, scoreLabel, MIN_TEAMMATES, MAX_TEAMMATES,
} from './sessions.js';
import { clanOfPlayer, myClan, canManage, inviteToClan } from './clans-store.js';
import {
    simulatedBadgeMarkup, playerChipMarkup, reasonsListMarkup, chanceMeterMarkup, openDecisionDialog,
} from './community-ui.js';
import {
    $, render, escapeHtml, icon, emptyStateMarkup, avatarMarkup, formatRelativeTime,
} from './ui.js';
import { runSequence, countUp, prefersReducedMotion, wait } from './animations.js';

const user = bootApp({
    page: 'squads',
    title: 'Squads',
    subtitle: 'Motor de Compatibilidade · 7 fatores ponderados',
});
if (!user) await haltModule();

render($('[data-sim-badge]'), simulatedBadgeMarkup());

const resultsHost = $('#resultsHost');
const savedHost = $('#savedHost');
const resultsMeta = $('#resultsMeta');

let lastResults = [];
let lastCriteria = null;
let busy = false;

/** Jogadores marcados para a próxima sessão (resultados + squad salvo). */
const selection = new Set();

$('#poolSize').textContent = String(PLAYERS.length);

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

/* ============================================================
   FORMULÁRIO
   Os valores iniciais vêm do Passaporte, então a primeira busca
   já é personalizada.
   ============================================================ */

const optionsHtml = (items, selected) => items
    .map((item) => `<option value="${escapeHtml(item.value)}"${item.value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`)
    .join('');

const params = new URLSearchParams(window.location.search);
const preferredGame = params.get('game')
    ?? user.currentGames?.find((gameId) => SQUAD_GAMES.some((game) => game.id === gameId))
    ?? SQUAD_GAMES[0].id;

render($('#filterGame'), optionsHtml(
    SQUAD_GAMES.map((game) => ({ value: game.id, label: game.title })),
    preferredGame
));

render($('#filterPlaystyle'), optionsHtml(
    [{ value: 'any', label: 'Tanto faz' }, ...PLAYSTYLES.map((style) => ({ value: style.id, label: style.label }))],
    user.playstyle || 'any'
));

render($('#filterRank'), optionsHtml(
    [{ value: 'any', label: 'Qualquer rank' }, ...RANK_LADDER.map((rank) => ({ value: rank, label: rankLabel(rank) }))],
    user.rank ?? 'any'
));

render($('#filterSchedule'), optionsHtml(
    [{ value: 'any', label: 'Qualquer horário' }, ...SCHEDULES.map((slot) => ({ value: slot.id, label: `${slot.label} · ${slot.hint}` }))],
    user.schedules?.[0] ?? 'any'
));

render($('#filterRole'), optionsHtml(
    [{ value: 'any', label: 'Completar meu Passaporte' }, ...ROLES.map((role) => ({ value: role.id, label: role.label }))],
    'any'
));

$('#filterVoice').value = user.voiceChat === false ? 'false' : 'true';

function readCriteria() {
    const voice = $('#filterVoice').value;
    return {
        gameId: $('#filterGame').value,
        playstyle: $('#filterPlaystyle').value,
        rank: $('#filterRank').value,
        schedule: $('#filterSchedule').value,
        role: $('#filterRole').value,
        voiceChat: voice === 'any' ? 'any' : voice === 'true',
    };
}

/* ============================================================
   VARREDURA
   Cada linha nomeia um fator que o motor realmente avalia, na
   ordem em que avalia. O "loading" é um preenchimento reto.
   ============================================================ */

const SCAN_STEPS = [
    { label: 'Lendo o grupo de jogadores…', weight: null },
    { label: 'Comparando os jogos…', weight: WEIGHTS.game },
    { label: 'Medindo a distância de rank…', weight: WEIGHTS.rank },
    { label: 'Cruzando os horários…', weight: WEIGHTS.schedule },
    { label: 'Comparando o estilo de jogo…', weight: WEIGHTS.playstyle },
    { label: 'Avaliando as funções no time…', weight: WEIGHTS.role },
    { label: 'Pesando comunicação e reputação…', weight: WEIGHTS.communication + WEIGHTS.reputation },
    { label: 'Calculando a compatibilidade…', weight: null },
];

async function playScan() {
    render(resultsHost, `
        <div class="scan card">
            <p class="scan__title">Analisando jogadores…</p>
            <div class="progress scan__bar" role="progressbar" aria-label="Progresso da análise" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="scanProgress">
                <div class="progress-bar" id="scanBar" style="width:0%"></div>
            </div>
            <ul class="scan__log" id="scanLog"></ul>
        </div>
    `);

    const log = $('#scanLog');
    const bar = $('#scanBar');

    await runSequence(SCAN_STEPS.map((step, index) => ({
        run: () => {
            const item = document.createElement('li');
            item.className = 'scan__line';
            item.innerHTML = `
                <span class="scan__tick">${icon('check', { size: 11 })}</span>
                <span>${escapeHtml(step.label)}</span>
                ${step.weight ? `<span class="scan__weight numeric">${step.weight}%</span>` : ''}
            `;
            log.appendChild(item);
            const pct = Math.round(((index + 1) / SCAN_STEPS.length) * 100);
            bar.style.width = `${pct}%`;
            $('#scanProgress').setAttribute('aria-valuenow', String(pct));
        },
        wait: 160,
    })));

    await wait(prefersReducedMotion() ? 0 : 200);
}

/* ============================================================
   RESULTADOS
   ============================================================ */

function renderResults(matches, criteria) {
    const game = getGameById(criteria.gameId);
    const saved = savedPartnerIds();

    resultsMeta.textContent = `${matches.length} jogadores · ${game.title}`;

    if (matches.length === 0) {
        render(resultsHost, emptyStateMarkup({
            iconName: 'users',
            title: 'Ninguém combina com esta busca.',
            text: 'Amplie o rank ou o horário: o grupo de demonstração é pequeno de propósito.',
        }));
        return;
    }

    render(resultsHost, `<div class="row row-cols-1 row-cols-xl-2 g-3 squad-results">${
        matches.map(({ player, result }) => `<div class="col">${squadCardMarkup(player, result, {
            saved: saved.has(player.id),
            selectable: true,
            selected: selection.has(player.id),
        })}</div>`).join('')
    }</div>`);

    const cards = Array.from(resultsHost.querySelectorAll('.squad-card'));
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 60}ms`;
        card.classList.add('is-entering');
    });

    afterRender(resultsHost);
    syncPickControls();

    resultsHost.querySelectorAll('[data-count]').forEach((node, index) => {
        window.setTimeout(() => countUp(node, Number(node.dataset.count), { duration: 700, suffix: '%' }), index * 60);
    });
}

/* ============================================================
   BUSCA
   ============================================================ */

$('#squadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;

    const button = $('#findBtn');
    button.classList.add('is-loading');
    button.disabled = true;

    const criteria = readCriteria();
    lastCriteria = criteria;

    await playScan();

    const matches = findMatches(criteria, getUser(), { limit: 8 });
    lastResults = matches;
    renderResults(matches, criteria);

    button.classList.remove('is-loading');
    button.disabled = false;
    busy = false;

    // --- Progressão ---
    const current = getUser();
    const best = matches[0]?.result.total ?? 0;
    const game = getGameById(criteria.gameId);

    updateUser({
        squadSearches: (current.squadSearches ?? 0) + 1,
        bestMatch: Math.max(current.bestMatch ?? 0, best),
    });

    logActivity('squad', `Buscou squad de ${game.title}: melhor resultado ${best}%`, { xp: 150 });
    awardXp('squadSearch', { silent: true });
    toast({
        title: 'Busca concluída.',
        message: `${matches.length} jogadores ranqueados · melhor resultado ${best}%`,
        type: 'success',
        xp: 150,
    });

    if (best >= 90) {
        awardXp('perfectMatch', { silent: true });
        checkAchievements({ achievementContext: `${best}% de compatibilidade` });
    } else {
        checkAchievements();
    }

    refreshNavigationProgress();
});

/* ============================================================
   A CONTA DE UM RESULTADO
   ============================================================ */

function openBreakdown(playerId) {
    const match = lastResults.find((entry) => entry.player.id === playerId);
    if (!match) return;

    const { player, result } = match;

    const rows = result.breakdown.map((part) => `
        <li class="breakdown__row ${part.positive ? 'is-positive' : ''}">
            <div class="breakdown__head">
                <span class="breakdown__label">${escapeHtml(part.label)}</span>
                <span class="breakdown__weight numeric">${part.weight}%</span>
            </div>
            <div class="breakdown__meter">
                <span class="breakdown__fill" data-progress="${part.score}"></span>
            </div>
            <p class="breakdown__reason">${escapeHtml(part.reason)}</p>
            <p class="breakdown__math numeric">
                ${part.score} / 100 × ${part.weight} = <strong>${part.earned}</strong> pts
                ${part.lost >= 0.1 ? `<span class="breakdown__lost">−${part.lost} perdidos</span>` : ''}
            </p>
        </li>
    `).join('');

    openModal({
        title: `${player.nickname}: ${result.total}% de compatibilidade`,
        subtitle: `${result.tier.label} · cada fator pontuado separadamente`,
        wide: true,
        body: `
            <div class="breakdown">
                <p class="breakdown__intro">${escapeHtml(player.bio)}</p>
                <ul class="breakdown__list">${rows}</ul>
                <p class="breakdown__total">
                    <span>Total</span>
                    <span class="numeric">${result.breakdown.map((part) => part.earned).join(' + ')} = <strong>${result.total}%</strong></span>
                </p>
            </div>
        `,
        footer: '<button type="button" class="btn btn-primary" data-modal-close data-autofocus>Entendi</button>',
        onMount: ({ root }) => afterRender(root),
    });
}

/* ============================================================
   SQUAD SALVO
   ============================================================ */

function renderSaved() {
    const squads = getSquads();
    $('#clearSquadBtn').hidden = squads.length === 0;

    if (squads.length === 0) {
        render(savedHost, emptyStateMarkup({
            iconName: 'shield',
            title: 'Seu squad está vazio.',
            text: 'Faça uma busca e salve os jogadores com quem você jogaria de verdade. Eles ficam aqui para a próxima sessão.',
            action: '<a class="btn btn-outline-light btn-sm" href="#searchTitle">Encontrar jogadores</a>',
        }));
        return;
    }

    render(savedHost, `<ul class="saved-list">${squads.map((entry) => {
        const player = getPlayerById(entry.playerId);
        if (!player) return '';
        const game = getGameById(entry.gameId);
        const clan = clanOfPlayer(player.id);
        return `
            <li class="saved-item tier-${escapeHtml(entry.tier)}">
                <div class="form-check saved-item__pick">
                    <input class="form-check-input" type="checkbox" id="savedPick-${escapeHtml(player.id)}" data-pick="${escapeHtml(player.id)}"${selection.has(player.id) ? ' checked' : ''}>
                    <label class="visually-hidden" for="savedPick-${escapeHtml(player.id)}">Chamar ${escapeHtml(player.nickname)} para a sessão</label>
                </div>
                ${avatarMarkup(player.nickname + player.id, { size: 'md' })}
                <div class="saved-item__body">
                    <p class="saved-item__nick">
                        <button type="button" class="link-reset" data-player-card="${escapeHtml(player.id)}">${escapeHtml(player.nickname)}</button>
                        ${clan ? `<span class="clan-tag">[${escapeHtml(clan.tag)}]</span>` : ''}
                    </p>
                    <p class="saved-item__meta">
                        ${escapeHtml(game?.title ?? 'Jogo removido')} · ${escapeHtml(rankLabel(player.rank))} · salvo ${escapeHtml(formatRelativeTime(entry.savedAt))}
                    </p>
                </div>
                <span class="saved-item__score numeric">${entry.compatibility}%</span>
                <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="unsave" data-player="${escapeHtml(player.id)}"
                        aria-label="Remover ${escapeHtml(player.nickname)} do seu squad">
                    ${icon('close', { size: 14 })}
                </button>
            </li>
        `;
    }).join('')}</ul>`);
}

function saveTeammate(playerId) {
    const match = lastResults.find((entry) => entry.player.id === playerId);
    const result = savePartner(playerId, match?.result ?? null, lastCriteria?.gameId ?? null);
    if (!result.ok) {
        toast({ title: 'Nada mudou', message: result.reason, type: 'info' });
        return;
    }

    toast({
        title: `${result.player.nickname} salvo no seu squad.`,
        message: `${result.compatibility}% de compatibilidade`,
        type: 'success',
        xp: 60,
    });

    // Só este botão muda; os outros cards ficam como estão.
    document.querySelectorAll(`[data-action="save"][data-player="${CSS.escape(playerId)}"]`).forEach((button) => {
        button.disabled = true;
        button.classList.replace('btn-primary', 'btn-secondary');
        button.textContent = 'Salvo no squad';
    });

    renderSaved();
    refreshNavigationProgress();
}

async function unsaveTeammate(playerId) {
    const player = getPlayerById(playerId);
    const confirmed = await confirmDialog({
        title: `Remover ${player?.nickname ?? 'este jogador'} do squad?`,
        message: 'Ele sai do seu squad salvo. O XP e a reputação que você já ganhou continuam.',
        confirmLabel: 'Remover do squad',
        cancelLabel: 'Manter no squad',
        danger: true,
    });
    if (!confirmed) return;

    removePartner(playerId);
    selection.delete(playerId);
    renderSaved();
    syncPickControls();

    document.querySelectorAll(`[data-action="save"][data-player="${CSS.escape(playerId)}"]`).forEach((button) => {
        button.disabled = false;
        button.classList.replace('btn-secondary', 'btn-primary');
        button.textContent = 'Salvar parceiro';
    });

    toast({ title: 'Removido do seu squad.', message: player?.nickname ?? '', type: 'info' });
}

$('#clearSquadBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Limpar o seu squad inteiro?',
        message: 'Todos os parceiros salvos saem da lista. Nível, XP e conquistas não mudam.',
        confirmLabel: 'Limpar squad',
        cancelLabel: 'Manter meu squad',
        danger: true,
    });
    if (!confirmed) return;
    saveSquads([]);
    selection.clear();
    renderSaved();
    if (lastResults.length && lastCriteria) renderResults(lastResults, lastCriteria);
    syncPickControls();
    toast({ title: 'Squad limpo.', type: 'info' });
});

/* ============================================================
   SELEÇÃO PARA A SESSÃO (2 a 4)
   ============================================================ */

function syncPickControls() {
    const count = selection.size;
    const full = count >= MAX_TEAMMATES;

    document.querySelectorAll('[data-pick]').forEach((input) => {
        const picked = selection.has(input.dataset.pick);
        input.checked = picked;
        // Com 4 escolhidos, os outros ficam travados até alguém sair.
        input.disabled = full && !picked;
        input.closest('.squad-card')?.classList.toggle('is-selected', picked);
    });

    const button = $('#playChosenBtn');
    button.disabled = count < MIN_TEAMMATES || count > MAX_TEAMMATES;

    const hint = $('#sessionHint');
    if (count === 0) hint.textContent = `Marque de ${MIN_TEAMMATES} a ${MAX_TEAMMATES} jogadores nos resultados ou no seu squad salvo.`;
    else if (count < MIN_TEAMMATES) hint.textContent = `${count} escolhido. Falta pelo menos mais ${MIN_TEAMMATES - count}.`;
    else if (full) hint.textContent = `Squad cheio: ${count} jogadores. Desmarque alguém para trocar.`;
    else hint.textContent = `Squad pronto: ${count} jogadores. Pode chamar mais ${MAX_TEAMMATES - count}.`;

    button.textContent = count >= MIN_TEAMMATES ? `Jogar com este squad (${count})` : 'Jogar com este squad';
}

document.getElementById('main-content').addEventListener('change', (event) => {
    const input = event.target.closest('[data-pick]');
    if (!input) return;
    if (input.checked) selection.add(input.dataset.pick);
    else selection.delete(input.dataset.pick);
    syncPickControls();
});

/* ============================================================
   SESSÃO
   ============================================================ */

const sessionSection = $('#sessionSection');
const sessionHost = $('#sessionHost');

const SESSION_STEPS = [
    'Montando o squad…',
    'Calculando a força do squad e a química entre vocês…',
    'Sorteando o adversário desta sessão…',
    'Partida em andamento…',
];

async function runSessionFlow({ gameId, teammateIds, mode, randomPicks = null }) {
    if (busy) return;
    busy = true;
    const game = getGameById(gameId);

    sessionSection.hidden = false;
    $('#sessionMeta').textContent = `${game.title} · ${mode === 'random' ? 'squad sorteado' : 'squad escolhido'}`;

    render(sessionHost, `
        <div class="card session-loading">
            <div class="card-body">
                ${randomPicks ? `
                    <p class="eyebrow">Sorteio ponderado pela compatibilidade</p>
                    <ul class="random-picks">${randomPicks.map((pick) => `
                        <li>${playerChipMarkup(pick.player.id)} <span class="numeric">${pick.compatibility}% · chance de ser sorteado ${pick.weight.toLocaleString('pt-BR')}%</span></li>`).join('')}
                    </ul>
                    <p class="form-text">Peso = compatibilidade ao quadrado. Quem combina mais tem mais chance, mas ninguém é garantido.</p>
                ` : `<div class="squad-chips">${teammateIds.map((id) => playerChipMarkup(id)).join('')}</div>`}
                <div class="straight-fill mt-3" aria-hidden="true"><span></span></div>
                <ul class="scan__log mt-2" id="sessionLog" aria-live="polite"></ul>
            </div>
        </div>
    `);
    $('#sessionTitle').focus({ preventScroll: true });
    sessionSection.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    const log = $('#sessionLog');
    await runSequence(SESSION_STEPS.map((label) => ({
        run: () => {
            const item = document.createElement('li');
            item.className = 'scan__line';
            item.textContent = label;
            log.append(item);
        },
        wait: 280,
    })));

    const outcome = playSession({ gameId, teammateIds, mode });
    busy = false;

    if (!outcome.ok) {
        render(sessionHost, emptyStateMarkup({ iconName: 'alert', title: 'A sessão não começou.', text: outcome.reason }));
        return;
    }

    renderSessionResult(outcome.session);
    refreshNavigationProgress();
    document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
    toast({
        title: outcome.session.won ? 'Vitória na sessão!' : 'Sessão concluída.',
        message: `${scoreLabel(outcome.session.score)}. Agora avalie quem jogou com você.`,
        type: outcome.session.won ? 'success' : 'info',
        xp: 120,
    });
}

$('#playChosenBtn').addEventListener('click', () => {
    if (selection.size < MIN_TEAMMATES || selection.size > MAX_TEAMMATES) return;
    runSessionFlow({ gameId: (lastCriteria ?? readCriteria()).gameId, teammateIds: [...selection], mode: 'chosen' });
});

$('#playRandomBtn').addEventListener('click', () => {
    const criteria = lastCriteria ?? readCriteria();
    const picks = randomSquad(criteria, getUser(), 3);
    if (picks.length < MIN_TEAMMATES) {
        toast({ title: 'Poucos jogadores para sortear', message: 'Amplie os filtros e tente de novo.', type: 'warning' });
        return;
    }
    runSessionFlow({ gameId: criteria.gameId, teammateIds: picks.map((pick) => pick.player.id), mode: 'random', randomPicks: picks });
});

/* ============================================================
   RESULTADO + PÓS-PARTIDA
   ============================================================ */

function sessionMath(session) {
    const s = session.strength;
    return [
        { text: `Poder de cada jogador = degrau do rank × 10 + reputação × 0,5.` },
        ...s.members.map((member) => ({ text: `${member.name}: poder ${member.power.toLocaleString('pt-BR')}` })),
        { text: `Média do squad: ${s.average.toLocaleString('pt-BR')}.` },
        { text: `Química = (compatibilidade média ${s.avgCompat}% − 60) × 0,3 = ${s.chemistry >= 0 ? '+' : ''}${s.chemistry.toLocaleString('pt-BR')}.`, ok: s.chemistry >= 0 },
        { text: `Força do squad: ${s.total.toLocaleString('pt-BR')}. Adversário: ${s.total.toLocaleString('pt-BR')} ${s.offset >= 0 ? '+' : '−'} ${Math.abs(s.offset)} = ${s.opponent.toLocaleString('pt-BR')}.` },
        { text: `Chance = 1 / (1 + e^(−(${s.total.toLocaleString('pt-BR')} − ${s.opponent.toLocaleString('pt-BR')}) / 6)) = ${(s.chance * 100).toFixed(1)}%.` },
        { text: `Sorteio determinístico: ${s.draw.toFixed(3)} ${session.won ? '<' : '≥'} ${s.chance.toFixed(3)} → ${session.won ? 'vitória' : 'derrota'}.`, ok: session.won },
    ];
}

function inviteBannerMarkup(session) {
    const invite = session.clanInvite;
    if (!invite) return '';
    if (invite.invited) {
        const player = getPlayerById(invite.playerId);
        const clan = clanOfPlayer(invite.playerId);
        return `
            <div class="session-invite is-invited" role="status">
                <p class="session-invite__title">${icon('shield', { size: 14 })} ${escapeHtml(player?.nickname ?? '')} convidou você para o [${escapeHtml(clan?.tag ?? '')}] ${escapeHtml(clan?.name ?? '')}.</p>
                <p class="session-invite__text">${escapeHtml(invite.decision.summary)} O convite está no centro de convites (sino, no topo).</p>
                <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary btn-sm" data-session-action="open-invites">Ver convite</button>
                    <button type="button" class="btn btn-link btn-sm" data-session-action="invite-why">Por que fui convidado?</button>
                </div>
            </div>`;
    }
    return `
        <div class="session-invite" role="status">
            <p class="session-invite__title">${icon('info', { size: 14 })} Nenhum convite de clã desta vez.</p>
            <p class="session-invite__text">${escapeHtml(invite.summary)}</p>
            ${invite.decision ? '<button type="button" class="btn btn-link btn-sm px-0" data-session-action="invite-why">Ver a conta</button>' : ''}
        </div>`;
}

function contextualActions(player, relation) {
    const clan = clanOfPlayer(player.id);
    const mine = myClan();
    const actions = [];

    if (clan && !mine && clan.policy !== 'invite') {
        actions.push(`<button type="button" class="btn btn-outline-light btn-sm" data-session-action="${clan.policy === 'open' ? 'join' : 'apply'}" data-clan="${escapeHtml(clan.id)}">Pedir para entrar no [${escapeHtml(clan.tag)}]</button>`);
    }
    if (mine && canManage() && !clan) {
        actions.push(`<button type="button" class="btn btn-outline-light btn-sm" data-session-action="invite" data-player="${escapeHtml(player.id)}">Convidar para o [${escapeHtml(mine.tag)}]</button>`);
    }
    if (!savedPartnerIds().has(player.id)) {
        actions.push(`<button type="button" class="btn btn-outline-light btn-sm" data-action="save" data-player="${escapeHtml(player.id)}">Salvar parceiro</button>`);
    }
    if (relation === 'rival') {
        actions.push(`<button type="button" class="btn btn-primary btn-sm" data-session-action="duel" data-player="${escapeHtml(player.id)}">${icon('target', { size: 13 })} Desafiar na Arena</button>`);
    }
    return actions.join('');
}

function rateCardMarkup(session, playerId) {
    const player = getPlayerById(playerId);
    const relation = session.ratings?.[playerId]?.relation ?? relationOf(playerId) ?? 'neutral';
    const praises = session.ratings?.[playerId]?.praises ?? [];
    const clan = clanOfPlayer(playerId);
    const perf = session.performance[playerId];
    const name = escapeHtml(player.nickname);

    return `
        <div class="col">
            <article class="card h-100 rate-card" data-rate="${escapeHtml(playerId)}">
                <div class="card-body">
                    <div class="rate-card__head">
                        ${playerChipMarkup(playerId, { size: 'md' })}
                        ${clan ? `<span class="clan-tag">[${escapeHtml(clan.tag)}]</span>` : '<span class="rate-card__noclan">Sem clã</span>'}
                        <span class="rate-card__perf numeric" title="Desempenho na sessão">${perf}<small>/100</small></span>
                    </div>

                    <fieldset class="rate-card__group">
                        <legend class="form-label">Como foi jogar com ${name}?</legend>
                        <div class="btn-group w-100" role="group" aria-label="Relação com ${name}">
                            ${Object.entries(RELATION_TYPES).map(([id, type]) => `
                                <input type="radio" class="btn-check" name="rel-${escapeHtml(playerId)}" id="rel-${escapeHtml(playerId)}-${id}" value="${id}" autocomplete="off" data-relation${relation === id ? ' checked' : ''}>
                                <label class="btn btn-outline-light btn-sm" for="rel-${escapeHtml(playerId)}-${id}">${escapeHtml(type.label)}</label>`).join('')}
                        </div>
                        <p class="form-text">Aliado: quero jogar junto de novo. Rival: quero enfrentar de novo.</p>
                    </fieldset>

                    <fieldset class="rate-card__group">
                        <legend class="form-label">Elogios</legend>
                        <div class="praise-set">
                            ${PRAISES.map((praise) => `
                                <input type="checkbox" class="btn-check" id="praise-${escapeHtml(playerId)}-${praise.id}" value="${praise.id}" autocomplete="off" data-praise${praises.includes(praise.id) ? ' checked' : ''}>
                                <label class="btn btn-outline-light btn-sm praise" for="praise-${escapeHtml(playerId)}-${praise.id}">${escapeHtml(praise.label)}</label>`).join('')}
                        </div>
                    </fieldset>

                    <p class="rate-card__status" data-rate-status aria-live="polite"></p>
                </div>
                <div class="card-footer rate-card__actions" data-rate-actions>${contextualActions(player, relation)}</div>
            </article>
        </div>`;
}

let currentSession = null;

function renderSessionResult(session) {
    currentSession = session;
    const game = getGameById(session.gameId);
    const standout = session.standoutId === 'self' ? 'Você' : getPlayerById(session.standoutId)?.nickname;

    render(sessionHost, `
        <article class="card session-result ${session.won ? 'is-win' : 'is-loss'}">
            <div class="card-body">
                <div class="row g-4 align-items-center">
                    <div class="col-12 col-md-5">
                        <p class="eyebrow">${escapeHtml(game.title)} · ${session.mode === 'random' ? 'squad sorteado' : 'squad escolhido'}</p>
                        <p class="session-result__outcome">${session.won ? 'Vitória' : 'Derrota'}</p>
                        <p class="session-result__score numeric">${escapeHtml(scoreLabel(session.score))}</p>
                        <p class="card-text">Destaque da partida: <strong>${escapeHtml(standout ?? '')}</strong> (${session.performance[session.standoutId]} de desempenho). Seu desempenho: <strong class="numeric">${session.performance.self}</strong>.</p>
                    </div>
                    <div class="col-12 col-md-7">
                        ${chanceMeterMarkup(session.strength.chance, { label: 'Chance do seu squad' })}
                        <button class="btn btn-link btn-sm px-0" type="button" data-bs-toggle="collapse" data-bs-target="#sessionMath" aria-expanded="false" aria-controls="sessionMath">
                            ${icon('chevron-down', { size: 12 })} Ver a conta do resultado
                        </button>
                        <div class="collapse" id="sessionMath">${reasonsListMarkup(sessionMath(session))}</div>
                    </div>
                </div>
                ${inviteBannerMarkup(session)}
            </div>
            <div class="card-footer d-flex flex-wrap gap-2 justify-content-between">
                <p class="form-text mb-0">Esta sessão pode ir uma vez para a Arena, com o mesmo time.</p>
                <button type="button" class="btn btn-outline-light btn-sm" data-session-action="arena">Levar este squad para a Arena</button>
            </div>
        </article>

        <h3 class="postmatch__title" id="postMatchTitle">Avalie quem jogou com você</h3>
        <p class="section-intro">Cada escolha é salva na hora e vai para o Passaporte (contadores de aliados e rivais). Marcar alguém pela primeira vez rende XP.</p>
        <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3" id="rateCards">
            ${session.teammates.map((id) => rateCardMarkup(session, id)).join('')}
        </div>
    `);
    afterRender(sessionHost);
}

/** Aplica a avaliação de um card na hora em que algo muda. */
function applyRating(card) {
    const playerId = card.dataset.rate;
    const relation = card.querySelector('[data-relation]:checked')?.value ?? 'neutral';
    const praises = Array.from(card.querySelectorAll('[data-praise]:checked')).map((input) => input.value);
    const result = ratePlayer(currentSession.id, playerId, { relation, praises });
    if (!result.ok) return;

    const player = getPlayerById(playerId);
    const status = card.querySelector('[data-rate-status]');
    status.textContent = relation === 'neutral'
        ? `Salvo: ${player.nickname} fica como neutro.`
        : `Salvo: ${player.nickname} agora é seu ${RELATION_TYPES[relation].label.toLowerCase()}.`;

    // As ações mudam com a relação (ex.: "Desafiar" só aparece para rival).
    card.querySelector('[data-rate-actions]').innerHTML = contextualActions(player, relation);
    refreshNavigationProgress();
}

sessionHost.addEventListener('change', (event) => {
    const card = event.target.closest('[data-rate]');
    if (card && (event.target.matches('[data-relation]') || event.target.matches('[data-praise]'))) applyRating(card);
});

sessionHost.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-session-action]');
    if (!button) return;
    const action = button.dataset.sessionAction;

    if (action === 'open-invites') {
        const toggle = document.querySelector('.invites__toggle');
        if (toggle) window.bootstrap?.Dropdown.getOrCreateInstance(toggle).show();
    }
    if (action === 'invite-why' && currentSession?.clanInvite?.decision) {
        openDecisionDialog({ kind: 'clan-invite', playerId: currentSession.clanInvite.playerId, clanId: currentSession.clanInvite.clanId, decision: currentSession.clanInvite.decision });
    }
    if (action === 'join' || action === 'apply') {
        const { runClanAction } = await import('./clan-ui.js');
        runClanAction(action, button.dataset.clan);
    }
    if (action === 'invite') {
        const result = inviteToClan(button.dataset.player);
        toast(result.ok
            ? { title: `Convite enviado para ${result.player.nickname}`, message: 'A resposta, com o motivo, chega no centro de convites.', type: 'success' }
            : { title: 'Convite não enviado', message: result.reason, type: 'warning' });
        if (result.ok) {
            button.disabled = true;
            button.textContent = 'Convite enviado';
            document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
        }
    }
    if (action === 'duel') {
        const { openDuelConfirm } = await import('./arena-ui.js');
        openDuelConfirm(button.dataset.player);
    }
    if (action === 'arena' && currentSession) {
        const { openSquadMatchConfirm } = await import('./arena-ui.js');
        openSquadMatchConfirm(currentSession.id, {
            onDone: () => {
                button.disabled = true;
                button.textContent = 'Squad já jogou na Arena';
            },
        });
    }
});

// Quando o clã muda (entrou, saiu), as ações dos cards se atualizam.
document.addEventListener('rivaly:community-changed', () => {
    if (!currentSession) return;
    document.querySelectorAll('#rateCards [data-rate]').forEach((card) => {
        const player = getPlayerById(card.dataset.rate);
        const relation = card.querySelector('[data-relation]:checked')?.value ?? 'neutral';
        card.querySelector('[data-rate-actions]').innerHTML = contextualActions(player, relation);
    });
});

/* ============================================================
   DELEGAÇÃO GERAL
   ============================================================ */

document.getElementById('main-content').addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const { action, player } = trigger.dataset;
    if (action === 'breakdown') openBreakdown(player);
    if (action === 'save') saveTeammate(player);
    if (action === 'unsave') unsaveTeammate(player);
});

/* ============================================================
   BOOT
   ============================================================ */

render(resultsHost, emptyStateMarkup({
    iconName: 'target',
    title: 'Pronto quando você estiver.',
    text: 'Ajuste os filtros e encontre jogadores. O motor pontua cada pessoa do grupo em sete fatores e mostra a conta. Ou peça um squad aleatório agora mesmo.',
}));

renderSaved();
syncPickControls();
afterRender(document);
