/**
 * clans.js — controller da página Clãs (DOM + eventos).
 *
 * Três blocos: Meu clã (com gestão para líder/oficial), Explorar clãs
 * (filtros e busca em tempo real) e Criar clã (formulário com validação
 * inline e prévia do emblema). As regras ficam em clans-store.js.
 */

import { bootApp, afterRender, haltModule } from './app.js';
import {
    CLAN_POLICIES, PLAYSTYLES, RANK_LADDER, SQUAD_GAMES, CLAN_CAPACITY, getPlayerById, getGameById, rankLabel,
} from './data.js';
import {
    allClans, myClan, myRole, canManage, isLeader, clanCompatibility, clanStats, clanSchema, createClan,
    emblemSvg, inviteToClan, promoteMember, demoteMember, removeMember, transferLeadership, setClanPolicy,
    leaveClan, ROLE_LABELS, defaultEmblem,
} from './clans-store.js';
import { awaitingResponse } from './invites.js';
import { relationList } from './sessions.js';
import { getSquads } from './storage.js';
import {
    openClanDetail, runClanAction, clanActionMarkup, emblemPickerMarkup, readEmblemPicker, openEmblemEditor,
} from './clan-ui.js';
import {
    simulatedBadgeMarkup, emblemMarkup, playerChipMarkup, focusGamesText,
} from './community-ui.js';
import { confirmDialog } from './modal.js';
import { toast } from './notifications.js';
import { refreshNavigationProgress } from './navigation.js';
import { validateForm, bindLiveValidation, focusFirstInvalid, showFeedback } from './validation.js';
import { $, render, escapeHtml, icon, formatNumber, emptyStateMarkup } from './ui.js';

const user = bootApp({
    page: 'clans',
    title: 'Clãs',
    subtitle: 'Explore, entre, crie e gerencie',
});
if (!user) await haltModule();

render($('[data-sim-badge]'), simulatedBadgeMarkup());

const labelOf = (collection, id) => collection.find((item) => item.id === id)?.label ?? id;

const filters = { query: '', game: '', style: '', policy: '', open: false };

const changed = () => {
    refreshNavigationProgress();
    document.dispatchEvent(new CustomEvent('rivaly:invites-changed'));
    renderAll();
};

/* ============================================================
   MEU CLÃ
   ============================================================ */

function pendingApplicationsMarkup() {
    const pending = awaitingResponse().filter((invite) => invite.kind === 'application');
    if (!pending.length) return '';
    const clans = allClans();
    return `<ul class="pending-list">${pending.map((invite) => {
        const clan = clans.find((item) => item.id === invite.clanId);
        return `<li>${icon('clock', { size: 13 })} Candidatura ao <strong>[${escapeHtml(clan?.tag ?? '?')}]</strong> esperando resposta. Ela chega no centro de convites.</li>`;
    }).join('')}</ul>`;
}

function memberActionsMarkup(entry, clan) {
    if (clan.seeded || entry.id === 'self' || !canManage()) return '';
    const leader = isLeader();
    const items = [];
    if (leader && entry.role === 'member') items.push(`<li><button type="button" class="dropdown-item" data-manage="promote" data-player="${escapeHtml(entry.id)}">Promover a oficial</button></li>`);
    if (leader && entry.role === 'officer') items.push(`<li><button type="button" class="dropdown-item" data-manage="demote" data-player="${escapeHtml(entry.id)}">Rebaixar a membro</button></li>`);
    if (leader && entry.role !== 'leader') items.push(`<li><button type="button" class="dropdown-item" data-manage="transfer" data-player="${escapeHtml(entry.id)}">Transferir liderança</button></li>`);
    if (entry.role !== 'leader' && (leader || entry.role === 'member')) {
        items.push(`<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item text-danger" data-manage="remove" data-player="${escapeHtml(entry.id)}">Remover do clã</button></li>`);
    }
    if (!items.length) return '';
    const name = getPlayerById(entry.id)?.nickname ?? '';
    return `
        <div class="dropdown">
            <button class="btn btn-ghost btn-sm" type="button" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Gerenciar ${escapeHtml(name)}">
                Gerenciar ${icon('chevron-down', { size: 12 })}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">${items.join('')}</ul>
        </div>`;
}

function inviteCandidatesMarkup(clan) {
    if (!canManage()) return '';
    const inClan = new Set(clan.roster.map((entry) => entry.id));
    const pending = new Set(awaitingResponse().filter((invite) => invite.kind === 'outgoing-invite').map((invite) => invite.playerId));
    const ids = [...new Set([...relationList('ally').map((entry) => entry.player.id), ...getSquads().map((entry) => entry.playerId)])]
        .filter((id) => !inClan.has(id) && getPlayerById(id));
    const clans = allClans();
    const clanOf = (id) => clans.find((item) => item.roster.some((entry) => entry.id === id));

    if (ids.length === 0) {
        return `<div class="invite-candidates">
            <h3 class="clan-detail__title">Convidar jogadores</h3>
            <p class="form-text">Seus aliados e parceiros salvos aparecem aqui. Jogue uma sessão em Squads e marque quem você quer de volta.</p>
            <a class="btn btn-outline-light btn-sm" href="squads.html">Encontrar jogadores</a>
        </div>`;
    }

    return `<div class="invite-candidates">
        <h3 class="clan-detail__title">Convidar jogadores · aliados e parceiros salvos</h3>
        <ul class="candidate-list">${ids.map((id) => {
            const other = clanOf(id);
            let action;
            if (pending.has(id)) action = `<span class="candidate-list__state">${icon('clock', { size: 12 })} Resposta a caminho</span>`;
            else if (other) action = `<span class="candidate-list__state">Já está no [${escapeHtml(other.tag)}]</span>`;
            else if (clan.roster.length >= CLAN_CAPACITY) action = '<span class="candidate-list__state">Clã cheio</span>';
            else action = `<button type="button" class="btn btn-primary btn-sm" data-invite-player="${escapeHtml(id)}">Convidar</button>`;
            return `<li>${playerChipMarkup(id)}${action}</li>`;
        }).join('')}</ul>
    </div>`;
}

function renderMyClan() {
    const clan = myClan();
    const host = $('#myClanHost');

    if (!clan) {
        render(host, `${pendingApplicationsMarkup()}${emptyStateMarkup({
            iconName: 'shield',
            title: 'Você ainda não está em um clã.',
            text: 'Clãs compatíveis com o seu DNA estão logo abaixo, do mais compatível para o menos. Ou crie o seu.',
            action: '<a class="btn btn-primary btn-sm" href="#exploreTitle">Ver clãs compatíveis</a> <a class="btn btn-outline-light btn-sm" href="#createTitle">Criar meu clã</a>',
        })}`);
        return;
    }

    const stats = clanStats(clan);
    const role = myRole();
    const own = !clan.seeded;

    const roster = clan.roster.map((entry) => `
        <tr>
            <td>${entry.id === 'self'
                ? `<span class="player-chip player-chip--self"><span class="player-chip__name">${escapeHtml(user.nickname)} (você)</span></span>`
                : playerChipMarkup(entry.id)}</td>
            <td><span class="badge role-badge role-badge--${escapeHtml(entry.role)}">${escapeHtml(ROLE_LABELS[entry.role])}</span></td>
            <td class="numeric">${entry.player ? escapeHtml(rankLabel(entry.player.rank)) : escapeHtml(rankLabel(user.rank))}</td>
            <td class="text-end">${memberActionsMarkup(entry, clan)}</td>
        </tr>`).join('');

    render(host, `
        <article class="card my-clan">
            <div class="card-body">
                <div class="my-clan__head">
                    <div class="my-clan__emblem">
                        ${emblemMarkup(clan, 84)}
                        ${own && isLeader() ? '<button type="button" class="btn btn-outline-light btn-sm" data-edit-emblem>Personalizar emblema</button>' : ''}
                    </div>
                    <div class="my-clan__id">
                        <p class="eyebrow">${escapeHtml(ROLE_LABELS[role] ?? 'Membro')} · ${escapeHtml(CLAN_POLICIES[clan.policy].label)}</p>
                        <h3 class="my-clan__name"><span class="clan-tag">[${escapeHtml(clan.tag)}]</span> ${escapeHtml(clan.name)}</h3>
                        ${clan.motto ? `<p class="my-clan__motto">“${escapeHtml(clan.motto)}”</p>` : ''}
                        <p class="card-text">${escapeHtml(focusGamesText(clan))} · ${escapeHtml(labelOf(PLAYSTYLES, clan.playstyle))}</p>
                    </div>
                </div>

                <div class="row row-cols-2 row-cols-md-4 g-2 mt-1">
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Membros</span><span class="mini-stat__value numeric" data-member-count>${clan.roster.length}/${CLAN_CAPACITY}</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Nível</span><span class="mini-stat__value numeric">${stats.level.level}</span><span class="mini-stat__meta">${formatNumber(stats.level.into)} / ${formatNumber(stats.level.span)} XP</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Rating médio</span><span class="mini-stat__value numeric">${formatNumber(stats.averageRating)}</span></div></div>
                    <div class="col"><div class="mini-stat"><span class="mini-stat__label">Vitórias na semana</span><span class="mini-stat__value numeric">${stats.seasonWins}</span></div></div>
                </div>

                <div class="clan-goal mt-3">
                    <div class="clan-goal__head"><span>Meta semanal</span><span class="numeric">${stats.weekPoints} / ${stats.goal} pts</span></div>
                    <div class="progress" role="progressbar" aria-label="Meta semanal do clã" aria-valuenow="${stats.goalPercent}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${stats.goalPercent}%"></div>
                    </div>
                    <p class="form-text">Vitórias na Arena (20 pts), Clã vs Clã (40), sessões (10) e posts (2) somam para a meta. A parte dos outros membros é simulada.</p>
                </div>

                <div class="clan-goal">
                    <div class="clan-goal__head"><span>XP do clã · nível ${stats.level.level}</span><span class="numeric">${Math.round(stats.level.percent)}%</span></div>
                    <div class="progress" role="progressbar" aria-label="XP até o próximo nível do clã" aria-valuenow="${Math.round(stats.level.percent)}" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width:${stats.level.percent}%"></div>
                    </div>
                </div>

                <h3 class="clan-detail__title mt-3">Elenco</h3>
                <div class="table-responsive">
                    <table class="table align-middle roster-table">
                        <thead><tr><th scope="col">Jogador</th><th scope="col">Papel</th><th scope="col">Rank</th><th scope="col"><span class="visually-hidden">Gerenciar</span></th></tr></thead>
                        <tbody>${roster}</tbody>
                    </table>
                </div>

                ${own && isLeader() ? `
                    <div class="policy-form">
                        <label class="form-label" for="policySelect">Como as pessoas entram</label>
                        <div class="input-group">
                            <select class="form-select" id="policySelect">
                                ${Object.entries(CLAN_POLICIES).map(([id, policy]) => `<option value="${id}"${clan.policy === id ? ' selected' : ''}>${escapeHtml(policy.label)} · ${escapeHtml(policy.hint)}</option>`).join('')}
                            </select>
                            <button type="button" class="btn btn-outline-light" id="savePolicy">Salvar política</button>
                        </div>
                    </div>` : ''}

                ${own ? inviteCandidatesMarkup(clan) : ''}
            </div>
            <div class="card-footer d-flex flex-wrap gap-2 justify-content-between">
                <button type="button" class="btn btn-outline-light btn-sm" data-clan-action="detail" data-clan="${escapeHtml(clan.id)}">Ver detalhes do clã</button>
                <div class="d-flex flex-wrap gap-2">
                    <a class="btn btn-outline-light btn-sm" href="arena.html#playTitle">Jogar Clã vs Clã</a>
                    <button type="button" class="btn btn-danger btn-sm" id="leaveClanBtn">Sair do clã</button>
                </div>
            </div>
        </article>
    `);
}

/* ============================================================
   EXPLORAR
   ============================================================ */

function acceptingMembers(clan) {
    return clan.policy !== 'invite' && clan.roster.length < CLAN_CAPACITY;
}

function filteredClans() {
    const query = filters.query.trim().toLowerCase();
    return allClans()
        .filter((clan) => !query || clan.name.toLowerCase().includes(query) || clan.tag.toLowerCase().includes(query))
        .filter((clan) => !filters.game || clan.focusGames.includes(filters.game))
        .filter((clan) => !filters.style || clan.playstyle === filters.style)
        .filter((clan) => !filters.policy || clan.policy === filters.policy)
        .filter((clan) => !filters.open || acceptingMembers(clan))
        .map((clan) => ({ clan, compat: clanCompatibility(clan) }))
        .sort((a, b) => b.compat.total - a.compat.total);
}

function clanCardMarkup({ clan, compat }) {
    const mine = myClan()?.id === clan.id;
    return `
        <div class="col">
            <article class="card h-100 clan-card ${mine ? 'is-mine' : ''}" data-clan-card="${escapeHtml(clan.id)}">
                <div class="card-body">
                    <div class="clan-card__head">
                        ${emblemMarkup(clan, 56)}
                        <div class="clan-card__id">
                            <h3 class="card-title"><span class="clan-tag">[${escapeHtml(clan.tag)}]</span> ${escapeHtml(clan.name)}</h3>
                            <p class="card-text clan-card__motto">${escapeHtml(clan.motto || CLAN_POLICIES[clan.policy].hint)}</p>
                        </div>
                    </div>
                    <ul class="clan-card__facts">
                        <li>${icon('controller', { size: 12 })} ${escapeHtml(focusGamesText(clan))}</li>
                        <li>${icon('zap', { size: 12 })} ${escapeHtml(labelOf(PLAYSTYLES, clan.playstyle))} · ${escapeHtml(CLAN_POLICIES[clan.policy].label)}</li>
                        <li>${icon('users', { size: 12 })} ${clan.roster.length}/${CLAN_CAPACITY} no elenco · rank ${escapeHtml(rankLabel(clan.minRank))}+</li>
                    </ul>
                    <div class="clan-card__compat">
                        <span class="clan-card__compat-value numeric">${compat.total}%</span>
                        <span class="clan-card__compat-label">compatível com você</span>
                        <button type="button" class="btn btn-link btn-sm" data-clan-action="compat" data-clan="${escapeHtml(clan.id)}">Ver a conta</button>
                    </div>
                    ${mine ? '<span class="badge text-bg-primary">Seu clã</span>' : ''}
                </div>
                <div class="card-footer d-flex flex-wrap gap-2 align-items-center">
                    <button type="button" class="btn btn-outline-light btn-sm" data-clan-action="detail" data-clan="${escapeHtml(clan.id)}">Ver clã</button>
                    ${clanActionMarkup(clan, { size: 'sm' })}
                </div>
            </article>
        </div>`;
}

function renderExplore() {
    const list = filteredClans();
    $('#clanCount').textContent = `${list.length} ${list.length === 1 ? 'clã' : 'clãs'}`;

    if (list.length === 0) {
        render($('#clanGrid'), `<div class="col-12">${emptyStateMarkup({
            iconName: 'filter',
            title: 'Nenhum clã com esses filtros.',
            text: 'Tente outro jogo, desligue "Aceitando membros" ou limpe os filtros. Também dá para fundar o seu.',
            action: '<button type="button" class="btn btn-outline-light btn-sm" data-clear-filters>Limpar filtros</button> <a class="btn btn-primary btn-sm" href="#createTitle">Criar meu clã</a>',
        })}</div>`);
        return;
    }
    render($('#clanGrid'), list.map(clanCardMarkup).join(''));
}

/* Selects dos filtros, gerados a partir dos dados. */
function fillFilterSelects() {
    const gameIds = [...new Set(allClans().flatMap((clan) => clan.focusGames))];
    render($('#filterGame'), ['<option value="">Todos</option>', ...gameIds.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(getGameById(id)?.title ?? id)}</option>`)].join(''));
    render($('#filterStyle'), ['<option value="">Todos</option>', ...PLAYSTYLES.map((style) => `<option value="${style.id}">${escapeHtml(style.label)}</option>`)].join(''));
    render($('#filterPolicy'), ['<option value="">Todas</option>', ...Object.entries(CLAN_POLICIES).map(([id, policy]) => `<option value="${id}">${escapeHtml(policy.label)}</option>`)].join(''));
}

/* ============================================================
   CRIAR CLÃ
   ============================================================ */

const CREATE_FIELDS = {
    clanName: 'name',
    clanTag: 'tag',
    clanGame: 'focusGame',
    clanStyle: 'playstyle',
    clanPolicy: 'policy',
    clanMotto: 'motto',
    clanRank: 'minRank',
    clanEmblemShape: 'emblemShape',
    clanEmblemPattern: 'emblemPattern',
    clanEmblemPalette: 'emblemPalette',
};

/** O mesmo esquema do domínio, com os ids do formulário. */
function createSchema() {
    const schema = clanSchema();
    return Object.fromEntries(Object.entries(CREATE_FIELDS).map(([fieldId, key]) => [fieldId, schema[key]]));
}

function renderCreate() {
    const clan = myClan();
    if (clan) {
        render($('#createHost'), emptyStateMarkup({
            iconName: 'flag',
            title: `Você já está no [${clan.tag}].`,
            text: 'Um clã por vez. Para fundar outro, saia do clã atual. Se você lidera e tem membros, transfira a liderança antes.',
        }));
        return;
    }

    // O formulário já está na tela: redesenhar apagaria o que a pessoa
    // está digitando (ex.: quando uma resposta de candidatura chega).
    if ($('#createClanForm')) return;

    render($('#createHost'), `
        <form class="card create-clan" id="createClanForm" novalidate>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-12 col-lg-8">
                        <div class="row g-3">
                            <div class="col-12 col-md-7">
                                <label class="form-label" for="clanName">Nome do clã</label>
                                <input class="form-control" id="clanName" maxlength="24" autocomplete="off" aria-describedby="clanNameHelp" placeholder="Ex.: Vanguarda Noturna">
                                <p class="form-text" id="clanNameHelp">De 3 a 24 caracteres: letras, números e espaços.</p>
                            </div>
                            <div class="col-12 col-md-5">
                                <label class="form-label" for="clanTag">Tag</label>
                                <input class="form-control text-uppercase" id="clanTag" maxlength="4" autocomplete="off" aria-describedby="clanTagHelp" placeholder="Ex.: RVLY">
                                <p class="form-text" id="clanTagHelp">2 a 4 letras ou números, única entre todos os clãs.</p>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label" for="clanGame">Jogo foco</label>
                                <select class="form-select" id="clanGame">
                                    <option value="">Escolha um jogo</option>
                                    ${SQUAD_GAMES.map((game) => `<option value="${game.id}"${user.currentGames?.[0] === game.id ? ' selected' : ''}>${escapeHtml(game.title)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-12 col-md-6">
                                <label class="form-label" for="clanStyle">Estilo do clã</label>
                                <select class="form-select" id="clanStyle">
                                    ${PLAYSTYLES.map((style) => `<option value="${style.id}"${user.playstyle === style.id ? ' selected' : ''}>${escapeHtml(style.label)} · ${escapeHtml(style.hint)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-12">
                                <fieldset>
                                    <legend class="form-label">Como as pessoas entram</legend>
                                    <div id="clanPolicy" data-group="radio" class="policy-options">
                                        ${Object.entries(CLAN_POLICIES).map(([id, policy], index) => `
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="clanPolicy" id="policy-${id}" value="${id}"${index === 0 ? ' checked' : ''}>
                                                <label class="form-check-label" for="policy-${id}"><strong>${escapeHtml(policy.label)}</strong> · ${escapeHtml(policy.hint)}</label>
                                            </div>`).join('')}
                                    </div>
                                </fieldset>
                            </div>
                            <div class="col-12 col-md-8">
                                <label class="form-label" for="clanMotto">Lema <span class="text-muted">(opcional)</span></label>
                                <input class="form-control" id="clanMotto" maxlength="80" autocomplete="off" aria-describedby="clanMottoCount" placeholder="Ex.: Informação primeiro, troca depois.">
                                <p class="form-text numeric" id="clanMottoCount" aria-live="polite">0/80</p>
                            </div>
                            <div class="col-12 col-md-4">
                                <label class="form-label" for="clanRank">Rank mínimo</label>
                                <select class="form-select" id="clanRank">
                                    ${RANK_LADDER.map((rank) => `<option value="${rank}"${rank === 'Unranked' ? ' selected' : ''}>${escapeHtml(rankLabel(rank))}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-12">
                                <h3 class="clan-detail__title">Emblema</h3>
                                <p class="form-text">Escolha o formato do escudo, o padrão e as cores. A tag vai no centro.</p>
                                ${emblemPickerMarkup('clan', defaultEmblem('RV'))}
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-lg-4">
                        <div class="emblem-preview" aria-live="polite">
                            <p class="eyebrow">Prévia do emblema</p>
                            <div class="emblem-preview__art" id="emblemPreview">${emblemSvg('RV', { size: 140, emblem: defaultEmblem('RV'), title: 'Prévia do emblema' })}</div>
                            <p class="emblem-preview__name" id="emblemName">Seu clã</p>
                            <p class="form-text">A prévia muda na hora: digite a tag e escolha formato, padrão e cores.</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card-footer d-flex flex-wrap gap-2 justify-content-end">
                <button type="submit" class="btn btn-primary">Fundar meu clã</button>
            </div>
        </form>
    `);

    const form = $('#createClanForm');
    const schema = createSchema();
    bindLiveValidation(form, schema);

    const tagInput = $('#clanTag');
    const nameInput = $('#clanName');
    const mottoInput = $('#clanMotto');

    // Prévia ao vivo: tag, formato, padrão e cores viram o emblema na hora.
    const paintPreview = () => {
        $('#emblemPreview').innerHTML = emblemSvg(tagInput.value || 'RV', { size: 140, emblem: readEmblemPicker(form, 'clan'), title: 'Prévia do emblema' });
        $('#emblemName').textContent = `[${tagInput.value || '??'}] ${nameInput.value.trim() || 'Seu clã'}`;
    };
    tagInput.addEventListener('input', () => {
        const caret = tagInput.selectionStart;
        tagInput.value = tagInput.value.toUpperCase();
        tagInput.setSelectionRange(caret, caret);
        paintPreview();
    });
    form.querySelector('.emblem-picker').addEventListener('change', paintPreview);
    nameInput.addEventListener('input', () => {
        $('#emblemName').textContent = `[${tagInput.value || '??'}] ${nameInput.value.trim() || 'Seu clã'}`;
    });
    mottoInput.addEventListener('input', () => {
        $('#clanMottoCount').textContent = `${mottoInput.value.length}/80`;
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const result = validateForm(form, schema);
        if (!result.valid) {
            showFeedback(form, { type: 'error', message: 'Revise os campos marcados. Cada um diz o que ajustar.' });
            focusFirstInvalid(result);
            return;
        }

        const data = Object.fromEntries(Object.entries(CREATE_FIELDS).map(([fieldId, key]) => [key, result.values[fieldId]]));
        data.emblem = { shape: data.emblemShape, pattern: data.emblemPattern, palette: data.emblemPalette };
        const outcome = createClan(data);
        if (!outcome.ok) {
            showFeedback(form, { type: 'error', message: outcome.reason ?? Object.values(outcome.errors ?? {})[0]?.[0] ?? 'Revise os campos.' });
            return;
        }

        toast({ title: `Clã [${outcome.clan.tag}] fundado.`, message: 'Você é o líder. Convide aliados e parceiros salvos.', type: 'success', xp: 200 });
        changed();
        $('#myClanTitle').scrollIntoView({ block: 'start' });
    });
}

/* ============================================================
   EVENTOS
   ============================================================ */

function renderAll() {
    renderMyClan();
    renderExplore();
    renderCreate();
    afterRender(document.getElementById('main-content'));
}

const filterForm = $('#clanFilters');

// "input" para a busca (tempo real) e "change" para selects e o switch.
$('#clanSearch').addEventListener('input', (event) => {
    filters.query = event.target.value;
    renderExplore();
});
filterForm.addEventListener('change', (event) => {
    if (event.target.id === 'filterGame') filters.game = event.target.value;
    if (event.target.id === 'filterStyle') filters.style = event.target.value;
    if (event.target.id === 'filterPolicy') filters.policy = event.target.value;
    if (event.target.id === 'filterOpen') filters.open = event.target.checked;
    renderExplore();
});
filterForm.addEventListener('submit', (event) => event.preventDefault());
filterForm.addEventListener('reset', () => {
    Object.assign(filters, { query: '', game: '', style: '', policy: '', open: false });
    window.setTimeout(renderExplore, 0);
});

document.getElementById('main-content').addEventListener('click', async (event) => {
    const clanButton = event.target.closest('[data-clan-action]');
    if (clanButton) {
        runClanAction(clanButton.dataset.clanAction, clanButton.dataset.clan);
        return;
    }

    if (event.target.closest('[data-edit-emblem]')) {
        openEmblemEditor();
        return;
    }

    if (event.target.closest('[data-clear-filters]')) {
        filterForm.reset();
        return;
    }

    const inviteButton = event.target.closest('[data-invite-player]');
    if (inviteButton) {
        const result = inviteToClan(inviteButton.dataset.invitePlayer);
        if (result.ok) {
            toast({ title: `Convite enviado para ${result.player.nickname}`, message: 'A resposta, com o motivo, chega no centro de convites.', type: 'success' });
            changed();
        } else {
            toast({ title: 'Convite não enviado', message: result.reason, type: 'warning' });
        }
        return;
    }

    const manage = event.target.closest('[data-manage]');
    if (manage) {
        const playerId = manage.dataset.player;
        const name = getPlayerById(playerId)?.nickname ?? 'o jogador';
        let result = null;
        if (manage.dataset.manage === 'promote') result = promoteMember(playerId);
        if (manage.dataset.manage === 'demote') result = demoteMember(playerId);
        if (manage.dataset.manage === 'transfer') {
            const ok = await confirmDialog({
                title: `Transferir a liderança para ${name}?`,
                message: `${name} vira líder e você passa a oficial. Só o líder muda a política e promove membros.`,
                confirmLabel: 'Transferir liderança',
                cancelLabel: 'Manter como está',
            });
            if (!ok) return;
            result = transferLeadership(playerId);
        }
        if (manage.dataset.manage === 'remove') {
            const ok = await confirmDialog({
                title: `Remover ${name} do clã?`,
                message: `${name} sai do elenco e volta a ficar sem clã. Dá para convidar de novo depois.`,
                confirmLabel: 'Remover do clã',
                cancelLabel: 'Manter no clã',
                danger: true,
            });
            if (!ok) return;
            result = removeMember(playerId);
        }
        if (result?.ok) {
            toast({ title: 'Elenco atualizado.', type: 'success' });
            changed();
        } else if (result) {
            toast({ title: 'Nada mudou', message: result.reason, type: 'warning' });
        }
        return;
    }

    if (event.target.closest('#savePolicy')) {
        const result = setClanPolicy($('#policySelect').value);
        toast(result.ok
            ? { title: 'Política salva.', message: CLAN_POLICIES[$('#policySelect').value].hint, type: 'success' }
            : { title: 'Nada mudou', message: result.reason, type: 'warning' });
        if (result.ok) changed();
        return;
    }

    if (event.target.closest('#leaveClanBtn')) {
        const clan = myClan();
        // Líder com elenco não sai direto: o aviso vem antes da confirmação.
        if (clan && !clan.seeded && isLeader() && clan.roster.length > 1) {
            toast({
                title: 'Transfira a liderança antes de sair',
                message: 'No elenco, abra "Gerenciar" ao lado de alguém e escolha "Transferir liderança". Depois disso, você pode sair.',
                type: 'warning',
            });
            return;
        }
        const alone = clan && !clan.seeded && clan.roster.length === 1;
        const ok = await confirmDialog({
            title: `Sair do [${clan?.tag}]?`,
            message: alone
                ? 'Você é o único membro: sair desfaz o clã. O XP e as conquistas que você ganhou continuam no seu Passaporte.'
                : 'Você deixa o elenco agora. O XP e as conquistas continuam no seu Passaporte, e dá para entrar em outro clã em seguida.',
            confirmLabel: alone ? 'Sair e desfazer o clã' : 'Sair do clã',
            cancelLabel: 'Ficar no clã',
            danger: true,
        });
        if (!ok) return;
        const result = leaveClan();
        if (result.ok) {
            toast({ title: `Você saiu do [${result.clan.tag}].`, message: 'Os clãs compatíveis estão logo abaixo.', type: 'info' });
            changed();
        } else {
            toast({ title: 'Ainda não dá para sair', message: result.reason, type: 'warning' });
        }
    }
});

document.addEventListener('rivaly:community-changed', renderAll);

/* ============================================================
   BOOT
   ============================================================ */

fillFilterSelects();
renderAll();

// Atalho vindo de outra tela: clans.html?clan=nox abre o detalhe.
const linkedClan = new URLSearchParams(window.location.search).get('clan');
if (linkedClan) openClanDetail(linkedClan);
