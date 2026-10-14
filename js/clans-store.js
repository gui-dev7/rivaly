/**
 * clans-store.js — regras de Clãs.
 *
 * Os clãs semeados vivem em data.js e não mudam; os clãs criados pelo
 * usuário vivem no storage. O vínculo do usuário (um clã por vez) fica em
 * `clanMembership`. Tudo o que muda estado passa pelas funções nomeadas
 * abaixo (createClan, joinClan, applyToClan, inviteToClan, leaveClan...),
 * que validam, gravam e devolvem { ok, reason | errors }.
 *
 * O "outro lado" (o clã responder uma candidatura, um jogador aceitar um
 * convite) é decidido em community.js; aqui só se aplica o resultado.
 */

import {
    CLANS, CLAN_CAPACITY, CLAN_POLICIES, PLAYSTYLES, RANK_LADDER, SQUAD_GAMES, GAMES,
    getPlayerById,
} from './data.js';
import {
    getClans, saveClans, getClanMembership, saveClanMembership, getClanProgress, saveClanProgress,
    getUser, getLibrary, getRelations, getArena,
} from './storage.js';
import {
    compatibilityWith, requirementChecks, decideApplication, decideInviteResponse,
    simulatedClanWeekPoints, simulatedClanXp, ratingOf,
} from './community.js';
import { addInvite, registerInviteHandler, RESPONSE_DELAY_MS, listInvites } from './invites.js';
import { awardOnce, awardOnceFor, buildContext, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';
import { currentWeekKey } from './rng.js';
import { hashString, escapeHtml } from './ui.js';
import {
    validateData, required, minLength, maxLength, pattern, unique, oneOf, noHtml, sanitizeText,
} from './validation.js';

/* ============================================================
   LEITURA
   ============================================================ */

/** Monta o elenco (líder, oficiais, membros) com os dados de cada um. */
function resolveRoster(clan, membership) {
    const entries = [];
    const push = (id, role) => {
        if (!id || entries.some((entry) => entry.id === id)) return;
        entries.push({ id, role, player: id === 'self' ? null : getPlayerById(id) });
    };
    push(clan.leaderId, 'leader');
    (clan.officers ?? []).forEach((id) => push(id, 'officer'));
    (clan.members ?? []).forEach((id) => push(id, 'member'));
    // Nos clãs semeados, o usuário entra pelo vínculo, não pelo dado fixo.
    if (clan.seeded && membership?.clanId === clan.id) push('self', membership.role ?? 'member');
    return entries.filter((entry) => entry.id === 'self' || entry.player);
}

const withRoster = (clan, membership) => ({ ...clan, roster: resolveRoster(clan, membership) });

/** Todos os clãs (semeados + criados pelo usuário), já com o elenco. */
export function allClans() {
    const membership = getClanMembership();
    return [...CLANS, ...getClans()].map((clan) => withRoster(clan, membership));
}

export const getClan = (clanId) => allClans().find((clan) => clan.id === clanId) ?? null;

/** O clã de um jogador semeado (ou null). */
export function clanOfPlayer(playerId) {
    return allClans().find((clan) => clan.roster.some((entry) => entry.id === playerId)) ?? null;
}

export function myClan() {
    const membership = getClanMembership();
    return membership?.clanId ? getClan(membership.clanId) : null;
}

/** 'leader' | 'officer' | 'member' | null */
export function myRole() {
    const clan = myClan();
    return clan?.roster.find((entry) => entry.id === 'self')?.role ?? null;
}

export const canManage = () => ['leader', 'officer'].includes(myRole());
export const isLeader = () => myRole() === 'leader';

export const ROLE_LABELS = { leader: 'Líder', officer: 'Oficial', member: 'Membro' };

/** Jogos do usuário: o Passaporte e a Biblioteca. */
export function userGameIds(user = getUser()) {
    const fromLibrary = getLibrary().map((entry) => entry.gameId);
    return [...new Set([...(user?.currentGames ?? []), ...fromLibrary])];
}

/* ============================================================
   COMPATIBILIDADE DO CLÃ COM VOCÊ
   Média do motor de 7 fatores entre você e cada membro, usando o
   primeiro jogo foco do clã como jogo da busca.
   ============================================================ */

export function clanCompatibility(clan, user = getUser()) {
    const members = clan.roster.filter((entry) => entry.player);
    if (members.length === 0) return { total: 0, perMember: [], factors: [] };

    const perMember = members.map((entry) => ({
        player: entry.player,
        role: entry.role,
        result: compatibilityWith(entry.player, user, clan.focusGames[0]),
    }));

    const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const factors = perMember[0].result.breakdown.map((part, index) => ({
        key: part.key,
        label: part.label,
        weight: part.weight,
        earned: Math.round(average(perMember.map((entry) => entry.result.breakdown[index].earned)) * 10) / 10,
    }));

    return {
        total: Math.round(average(perMember.map((entry) => entry.result.total))),
        perMember,
        factors,
    };
}

/* ============================================================
   NÍVEL, META SEMANAL E ESTATÍSTICAS
   ============================================================ */

/** XP necessário para chegar ao nível N: 120 × (N − 1)². */
export function clanLevel(xp) {
    const level = 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 120));
    const floor = 120 * (level - 1) ** 2;
    const ceiling = 120 * level ** 2;
    return {
        level,
        xp,
        into: xp - floor,
        span: ceiling - floor,
        percent: Math.min(100, ((xp - floor) / (ceiling - floor)) * 100),
    };
}

/** Meta semanal: 60 pontos por integrante. */
export const weeklyGoalFor = (clan) => 60 * Math.max(1, clan.roster.length);

/** O que o usuário somou para um clã (XP total e pontos desta semana). */
export function userContribution(clanId, week = currentWeekKey()) {
    const entry = getClanProgress()[clanId];
    if (!entry) return { xp: 0, weekPoints: 0 };
    return { xp: entry.xp ?? 0, weekPoints: entry.week === week ? entry.weekPoints ?? 0 : 0 };
}

/**
 * Registra a contribuição do usuário para o clã atual: vitórias na Arena,
 * sessões e posts. Vira XP do clã e pontos da meta semanal.
 */
export function addClanContribution(points, { xp = points } = {}) {
    const membership = getClanMembership();
    if (!membership?.clanId || points <= 0) return null;
    const week = currentWeekKey();
    const progress = getClanProgress();
    const current = progress[membership.clanId] ?? { xp: 0, week, weekPoints: 0 };
    const weekPoints = current.week === week ? current.weekPoints : 0;
    progress[membership.clanId] = { xp: current.xp + xp, week, weekPoints: weekPoints + points };
    saveClanProgress(progress);
    return progress[membership.clanId];
}

export function clanStats(clan) {
    const week = currentWeekKey();
    const arena = getArena();
    const ratings = clan.roster.map((entry) => (entry.id === 'self' ? arena.rating : ratingOf(entry.id)));
    const sorted = [...ratings].sort((a, b) => b - a);
    const top3 = sorted.slice(0, 3);
    const average = (values) => (values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0);

    const contribution = userContribution(clan.id, week);
    const baseXp = clan.seeded ? simulatedClanXp(clan) : 0;
    const xp = baseXp + contribution.xp + (clan.seeded ? 0 : simulatedClanXp(clan) / 4);

    const goal = weeklyGoalFor(clan);
    const weekPoints = simulatedClanWeekPoints(clan, week) + contribution.weekPoints;

    // Vitórias da temporada: as simuladas dos membros + as reais do usuário.
    const userInClan = clan.roster.some((entry) => entry.id === 'self');
    const seasonWins = Math.round(weekPoints / 18) + (userInClan && arena.season.week === week ? arena.season.wins : 0);

    return {
        averageRating: average(ratings),
        top3Rating: average(top3),
        level: clanLevel(Math.round(xp)),
        goal,
        weekPoints,
        goalPercent: Math.min(100, Math.round((weekPoints / goal) * 100)),
        seasonWins,
        vacancies: CLAN_CAPACITY - clan.roster.length,
    };
}

/** Requisitos do clã contra o usuário (com a reputação calculada). */
export function clanRequirements(clan) {
    const context = buildContext();
    return requirementChecks({ clan, user: context.user, reputation: context.reputation });
}

/* ============================================================
   EMBLEMA
   Personalizável: formato do escudo, padrão e cores. As cores são só
   as da marca (preto, amarelo e neutros), aplicadas por classe, então o
   emblema acompanha o tema. Quem não escolhe recebe um emblema derivado
   da tag (hash), sempre o mesmo para a mesma tag.
   ============================================================ */

export const EMBLEM_SHAPES = {
    classic: { label: 'Clássico', path: 'M32 4 58 13v18c0 15-11 25-26 29C17 56 6 46 6 31V13z' },
    heater: { label: 'Reto', path: 'M6 4h52v30L32 60 6 34z' },
    kite: { label: 'Pipa', path: 'M32 2 58 18 32 62 6 18z' },
    crest: { label: 'Torre', path: 'M6 6h9v7h7V6h7v7h6V6h7v7h7V6h9v28L32 60 6 34z' },
    banner: { label: 'Estandarte', path: 'M8 4h48v56L32 46 8 60z' },
    pennant: { label: 'Flâmula', path: 'M6 6h52v34L32 60 6 40z' },
    hex: { label: 'Hexágono', path: 'M32 4 57 18v28L32 60 7 46V18z' },
    octagon: { label: 'Medalhão', path: 'M20 4h24l16 16v24L44 60H20L4 44V20z' },
    diamond: { label: 'Losango', path: 'M32 3 61 32 32 61 3 32z' },
    square: { label: 'Quadrado', path: 'M6 6h52v52H6z' },
};

export const EMBLEM_PATTERNS = {
    plain: { label: 'Liso', svg: '' },
    base: { label: 'Faixa inferior', svg: '<rect x="0" y="40" width="64" height="24" class="emblem__accent"/>' },
    diagonal: { label: 'Diagonal', svg: '<path d="M0 64 64 0v16L16 64z" class="emblem__accent"/>' },
    half: { label: 'Metade', svg: '<rect x="0" y="0" width="32" height="64" class="emblem__accent emblem__accent--soft"/>' },
    bars: { label: 'Duas faixas', svg: '<rect x="0" y="0" width="64" height="10" class="emblem__accent"/><rect x="0" y="54" width="64" height="10" class="emblem__accent"/>' },
    cross: { label: 'Cruz', svg: '<rect x="27" y="0" width="10" height="64" class="emblem__accent"/><rect x="0" y="27" width="64" height="10" class="emblem__accent"/>' },
    chevron: { label: 'Chevron', svg: '<path d="M0 30 32 54 64 30v14L32 68 0 44z" class="emblem__accent"/>' },
    quarters: { label: 'Quartos', svg: '<rect x="0" y="0" width="32" height="32" class="emblem__accent emblem__accent--soft"/><rect x="32" y="32" width="32" height="32" class="emblem__accent emblem__accent--soft"/>' },
};

export const EMBLEM_PALETTES = {
    classic: { label: 'Amarelo no preto' },
    inverse: { label: 'Preto no amarelo' },
    bone: { label: 'Osso no preto' },
    steel: { label: 'Grafite e amarelo' },
};

/** Emblema padrão de uma tag: o hash escolhe as peças, sempre igual. */
export function defaultEmblem(tag) {
    const clean = String(tag ?? '').toUpperCase().slice(0, 4) || '??';
    const hash = hashString(`emblem:${clean}`);
    const shapes = Object.keys(EMBLEM_SHAPES);
    const patterns = Object.keys(EMBLEM_PATTERNS).filter((id) => id !== 'plain');
    return { shape: shapes[hash % shapes.length], pattern: patterns[(hash >> 3) % patterns.length], palette: 'classic' };
}

/** Completa uma escolha parcial ou inválida com o padrão da tag. */
export function resolveEmblem(tag, emblem = null) {
    const base = defaultEmblem(tag);
    return {
        shape: EMBLEM_SHAPES[emblem?.shape] ? emblem.shape : base.shape,
        pattern: EMBLEM_PATTERNS[emblem?.pattern] ? emblem.pattern : base.pattern,
        palette: EMBLEM_PALETTES[emblem?.palette] ? emblem.palette : base.palette,
    };
}

// O mesmo emblema pode aparecer várias vezes na página (card, ranking,
// Passaporte); cada cópia ganha o próprio id de recorte, sem id repetido.
let emblemSeq = 0;

/**
 * @param {string} tag
 * @param {{size?:number, title?:string, emblem?:object, showTag?:boolean}} [options]
 */
export function emblemSvg(tag, { size = 56, title = '', emblem = null, showTag = true } = {}) {
    const clean = String(tag ?? '').toUpperCase().slice(0, 4) || '??';
    const { shape, pattern, palette } = resolveEmblem(clean, emblem);
    const path = EMBLEM_SHAPES[shape].path;
    const id = `em-${hashString(clean).toString(36)}-${(emblemSeq += 1).toString(36)}`;

    const fontSize = clean.length >= 4 ? 17 : clean.length === 3 ? 21 : 25;
    const a11y = title ? `role="img" aria-label="${escapeHtml(title)}"` : 'aria-hidden="true" focusable="false"';
    const label = showTag
        ? `<text x="32" y="${32 + fontSize * 0.36}" text-anchor="middle" class="emblem__tag" font-size="${fontSize}">${escapeHtml(clean)}</text>`
        : '';

    return `<svg class="emblem emblem--${palette}" ${a11y} viewBox="0 0 64 64" width="${size}" height="${size}">
        <defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs>
        <path d="${path}" class="emblem__base"/>
        <g clip-path="url(#${id})">${EMBLEM_PATTERNS[pattern].svg}</g>
        <path d="${path}" class="emblem__edge"/>
        ${label}
    </svg>`;
}

/* ============================================================
   VALIDAÇÃO DO "CRIAR CLÃ"
   O mesmo esquema serve ao formulário (js/clans.js) e ao domínio.
   ============================================================ */

// Letras (com acento), números e espaço. Os intervalos pulam × e ÷.
export const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ]+$/;
export const TAG_PATTERN = /^[A-Z0-9]+$/;

export const existingTags = () => allClans().map((clan) => clan.tag);

export function clanSchema() {
    return {
        name: [
            required('Dê um nome ao clã.'),
            minLength(3, 'O nome precisa ter pelo menos 3 caracteres.'),
            maxLength(24, 'O nome pode ter no máximo 24 caracteres.'),
            pattern(NAME_PATTERN, 'Use só letras, números e espaços no nome.'),
        ],
        tag: [
            required('Escolha uma tag de 2 a 4 letras ou números. Ex.: RVLY.'),
            minLength(2, 'A tag precisa ter de 2 a 4 letras ou números. Ex.: RVLY.'),
            maxLength(4, 'A tag precisa ter de 2 a 4 letras ou números. Ex.: RVLY.'),
            pattern(TAG_PATTERN, 'Na tag, use só letras de A a Z e números, sem acento. Ex.: RVLY.'),
            unique(existingTags, 'Essa tag já é de outro clã. Tente outra combinação.'),
        ],
        focusGame: [
            required('Escolha o jogo foco do clã.'),
            oneOf(SQUAD_GAMES.map((game) => game.id).concat(GAMES.map((game) => game.id)), 'Escolha um jogo da lista.'),
        ],
        playstyle: [required('Escolha o estilo do clã.'), oneOf(PLAYSTYLES.map((style) => style.id))],
        policy: [required('Escolha como as pessoas entram.'), oneOf(Object.keys(CLAN_POLICIES))],
        motto: [maxLength(80, 'O lema pode ter no máximo 80 caracteres.'), noHtml()],
        minRank: [required('Escolha o rank mínimo.'), oneOf(RANK_LADDER)],
        emblemShape: [required('Escolha o formato do escudo.'), oneOf(Object.keys(EMBLEM_SHAPES), 'Escolha um formato da lista.')],
        emblemPattern: [required('Escolha o padrão do escudo.'), oneOf(Object.keys(EMBLEM_PATTERNS), 'Escolha um padrão da lista.')],
        emblemPalette: [required('Escolha as cores do escudo.'), oneOf(Object.keys(EMBLEM_PALETTES), 'Escolha uma combinação de cores da lista.')],
    };
}

/* ============================================================
   AÇÕES
   ============================================================ */

function joinAs(clan, role = 'member', via = 'join') {
    saveClanMembership({ clanId: clan.id, role, joinedAt: new Date().toISOString(), via });
    logActivity('clan', `Entrou no clã [${clan.tag}] ${clan.name}`, { clanId: clan.id, xp: 150 });
    awardOnceFor('joinClan', clan.id, { detail: `Bem-vindo ao [${clan.tag}]` });
    checkAchievements({ achievementContext: `[${clan.tag}] ${clan.name}` });
}

/** Clã aberto: entra na hora, se cumprir os requisitos. */
export function joinClan(clanId) {
    const clan = getClan(clanId);
    if (!clan) return { ok: false, reason: 'Esse clã não existe mais.' };
    if (myClan()) return { ok: false, reason: 'Você já está em um clã. Saia do atual para entrar em outro.' };
    if (clan.policy !== 'open') {
        return { ok: false, reason: clan.policy === 'invite' ? 'Esse clã só aceita quem for convidado.' : 'Esse clã avalia candidaturas. Envie uma mensagem.' };
    }
    const failed = clanRequirements(clan).find((check) => !check.ok);
    if (failed) return { ok: false, reason: failed.text };

    joinAs(clan, 'member', 'open');
    return { ok: true, clan };
}

/** Candidatura: valida a mensagem e cria o pedido com resposta adiada. */
export function applyToClan(clanId, message) {
    const clan = getClan(clanId);
    if (!clan) return { ok: false, reason: 'Esse clã não existe mais.' };
    if (myClan()) return { ok: false, reason: 'Você já está em um clã. Saia do atual para se candidatar a outro.' };
    if (clan.policy === 'invite') return { ok: false, reason: 'Esse clã só aceita quem for convidado.' };

    const { valid, errors } = validateData({ message }, { message: applicationRules() });
    if (!valid) return { ok: false, errors };

    const pendingSame = listInvites().some((invite) => invite.kind === 'application' && invite.clanId === clanId && invite.status === 'pending');
    if (pendingSame) return { ok: false, reason: 'Você já tem uma candidatura esperando resposta deste clã.' };

    const invite = addInvite({
        id: `app-${clanId}-${Date.now().toString(36)}`,
        kind: 'application',
        clanId,
        message: sanitizeText(message, 280),
        resolveAt: new Date(Date.now() + RESPONSE_DELAY_MS).toISOString(),
    });
    logActivity('clan', `Enviou candidatura para [${clan.tag}] ${clan.name}`, { clanId });
    return { ok: true, invite, clan };
}

export const applicationRules = () => [
    required('Escreva por que você quer entrar no clã.'),
    minLength(20, 'A mensagem precisa ter pelo menos 20 caracteres.'),
    maxLength(280, 'A mensagem pode ter no máximo 280 caracteres.'),
    noHtml(),
];

/** Escolha de emblema em campos planos, para validar com o esquema. Sem escolha, vale o da tag. */
function emblemFields(tag, emblem) {
    const chosen = emblem ?? defaultEmblem(String(tag ?? '').trim().toUpperCase());
    return { emblemShape: chosen.shape, emblemPattern: chosen.pattern, emblemPalette: chosen.palette };
}

/** Cria um clã e coloca o usuário como líder. */
export function createClan(data) {
    if (myClan()) return { ok: false, reason: 'Você já está em um clã. Saia do atual para criar outro.' };

    const payload = {
        name: sanitizeText(data.name, 24),
        tag: String(data.tag ?? '').trim().toUpperCase(),
        focusGame: data.focusGame,
        playstyle: data.playstyle,
        policy: data.policy,
        motto: sanitizeText(data.motto, 80),
        minRank: data.minRank,
        ...emblemFields(data.tag, data.emblem),
    };
    const { valid, errors } = validateData(payload, clanSchema());
    if (!valid) return { ok: false, errors };

    const user = getUser();
    const clan = {
        id: `u-${Date.now().toString(36)}`,
        name: payload.name,
        tag: payload.tag,
        focusGames: [payload.focusGame],
        playstyle: payload.playstyle,
        region: user?.region || 'Global',
        languages: user?.languages?.length ? user.languages : ['pt'],
        minRank: payload.minRank,
        minReputation: 50,
        policy: payload.policy,
        leaderId: 'self',
        officers: [],
        members: [],
        motto: payload.motto,
        emblem: { shape: payload.emblemShape, pattern: payload.emblemPattern, palette: payload.emblemPalette },
        createdAt: new Date().toISOString(),
        seeded: false,
    };

    saveClans([...getClans(), clan]);
    saveClanMembership({ clanId: clan.id, role: 'leader', joinedAt: clan.createdAt, via: 'create' });
    logActivity('clan', `Fundou o clã [${clan.tag}] ${clan.name}`, { clanId: clan.id, xp: 200 });
    awardOnce('createClan', { detail: `Clã [${clan.tag}] fundado` });
    checkAchievements({ achievementContext: `[${clan.tag}] ${clan.name}` });
    return { ok: true, clan: getClan(clan.id) };
}

/** Convite enviado pelo usuário (líder/oficial) a um jogador semeado. */
export function inviteToClan(playerId) {
    const clan = myClan();
    const player = getPlayerById(playerId);
    if (!clan || !player) return { ok: false, reason: 'Convite indisponível agora.' };
    if (!canManage()) return { ok: false, reason: 'Só líder ou oficial pode convidar.' };
    if (clan.roster.some((entry) => entry.id === playerId)) return { ok: false, reason: `${player.nickname} já está no seu clã.` };

    const pendingSame = listInvites().some((invite) => invite.kind === 'outgoing-invite' && invite.playerId === playerId && invite.status === 'pending');
    if (pendingSame) return { ok: false, reason: `Você já convidou ${player.nickname}. A resposta está a caminho.` };

    const invite = addInvite({
        id: `out-${clan.id}-${playerId}-${Date.now().toString(36)}`,
        kind: 'outgoing-invite',
        clanId: clan.id,
        playerId,
        resolveAt: new Date(Date.now() + RESPONSE_DELAY_MS * 0.6).toISOString(),
    });
    logActivity('clan', `Convidou ${player.nickname} para o [${clan.tag}]`, { clanId: clan.id, playerId });
    return { ok: true, invite, player, clan };
}

/* --- Gestão do clã criado pelo usuário --- */

function editOwnClan(mutator) {
    const clan = myClan();
    if (!clan || clan.seeded) return { ok: false, reason: 'A gestão só vale para o clã que você criou.' };
    const clans = getClans();
    const index = clans.findIndex((item) => item.id === clan.id);
    if (index < 0) return { ok: false, reason: 'Clã não encontrado.' };
    const draft = {
        ...clans[index],
        officers: [...(clans[index].officers ?? [])],
        members: [...(clans[index].members ?? [])],
    };
    const result = mutator(draft, clan);
    if (result && result.ok === false) return result;
    clans[index] = draft;
    saveClans(clans);
    // O papel do usuário pode ter mudado (transferência de liderança).
    const role = draft.leaderId === 'self' ? 'leader' : draft.officers.includes('self') ? 'officer' : 'member';
    saveClanMembership({ ...getClanMembership(), role });
    return { ok: true, clan: getClan(clan.id) };
}

const removeFromArrays = (draft, id) => {
    draft.officers = draft.officers.filter((item) => item !== id);
    draft.members = draft.members.filter((item) => item !== id);
};

export function promoteMember(playerId) {
    if (!isLeader()) return { ok: false, reason: 'Só o líder promove membros.' };
    return editOwnClan((draft) => {
        if (!draft.members.includes(playerId)) return { ok: false, reason: 'Só membros podem ser promovidos a oficial.' };
        removeFromArrays(draft, playerId);
        draft.officers.push(playerId);
        return { ok: true };
    });
}

export function demoteMember(playerId) {
    if (!isLeader()) return { ok: false, reason: 'Só o líder rebaixa oficiais.' };
    return editOwnClan((draft) => {
        if (!draft.officers.includes(playerId)) return { ok: false, reason: 'Só oficiais podem ser rebaixados.' };
        removeFromArrays(draft, playerId);
        draft.members.push(playerId);
        return { ok: true };
    });
}

export function removeMember(playerId) {
    const role = myRole();
    return editOwnClan((draft) => {
        if (playerId === draft.leaderId) return { ok: false, reason: 'O líder não pode ser removido.' };
        if (role === 'officer' && draft.officers.includes(playerId)) return { ok: false, reason: 'Oficiais só removem membros. Peça ao líder.' };
        if (!['leader', 'officer'].includes(role)) return { ok: false, reason: 'Só líder ou oficial remove membros.' };
        removeFromArrays(draft, playerId);
        return { ok: true };
    });
}

export function transferLeadership(playerId) {
    if (!isLeader()) return { ok: false, reason: 'Só o líder transfere a liderança.' };
    return editOwnClan((draft) => {
        if (![...draft.officers, ...draft.members].includes(playerId)) return { ok: false, reason: 'Escolha alguém do elenco.' };
        removeFromArrays(draft, playerId);
        draft.leaderId = playerId;
        draft.officers.push('self');
        return { ok: true };
    });
}

export function setClanPolicy(policy) {
    if (!isLeader()) return { ok: false, reason: 'Só o líder muda a política do clã.' };
    if (!CLAN_POLICIES[policy]) return { ok: false, reason: 'Escolha uma política válida.' };
    return editOwnClan((draft) => {
        draft.policy = policy;
        return { ok: true };
    });
}

/** O líder troca o emblema do clã que criou. */
export function setClanEmblem(emblem) {
    if (!isLeader()) return { ok: false, reason: 'Só o líder muda o emblema do clã.' };
    const fields = emblemFields('', emblem ?? {});
    const schema = clanSchema();
    const { valid, errors } = validateData(fields, {
        emblemShape: schema.emblemShape, emblemPattern: schema.emblemPattern, emblemPalette: schema.emblemPalette,
    });
    if (!valid) return { ok: false, reason: Object.values(errors)[0][0], errors };
    return editOwnClan((draft) => {
        draft.emblem = { shape: fields.emblemShape, pattern: fields.emblemPattern, palette: fields.emblemPalette };
        return { ok: true };
    });
}

/** Sai do clã. Líder com membros precisa transferir antes. */
export function leaveClan() {
    const clan = myClan();
    if (!clan) return { ok: false, reason: 'Você não está em um clã.' };

    if (!clan.seeded) {
        const others = clan.roster.filter((entry) => entry.id !== 'self');
        if (myRole() === 'leader' && others.length > 0) {
            return { ok: false, reason: 'Transfira a liderança para alguém do elenco antes de sair.' };
        }
        const clans = getClans();
        if (others.length === 0) {
            // Sozinho no clã: sair desfaz o clã.
            saveClans(clans.filter((item) => item.id !== clan.id));
        } else {
            saveClans(clans.map((item) => (item.id === clan.id
                ? { ...item, officers: item.officers.filter((id) => id !== 'self'), members: item.members.filter((id) => id !== 'self') }
                : item)));
        }
    }

    saveClanMembership(null);
    logActivity('clan', `Saiu do clã [${clan.tag}] ${clan.name}`, { clanId: clan.id });
    return { ok: true, clan };
}

/* ============================================================
   HANDLERS DA CAIXA DE CONVITES
   ============================================================ */

registerInviteHandler('application', {
    resolve(invite) {
        const clan = getClan(invite.clanId);
        if (!clan) return { status: 'expired', decision: { decision: 'declined', reasons: [{ ok: false, text: 'O clã não existe mais.' }], summary: 'O clã não existe mais.' } };
        if (myClan()) return { status: 'expired', decision: { decision: 'declined', reasons: [{ ok: false, text: 'Você entrou em outro clã antes da resposta.' }], summary: 'Candidatura encerrada: você já entrou em outro clã.' } };

        const context = buildContext();
        const decision = decideApplication({
            clan,
            user: context.user,
            reputation: context.reputation,
            compatibility: clanCompatibility(clan, context.user).total,
            message: invite.message,
            userGames: userGameIds(context.user),
            week: invite.week ?? currentWeekKey(),
        });

        if (decision.decision === 'accepted') joinAs(clan, 'member', 'application');
        logActivity('invite', `[${clan.tag}] ${decision.decision === 'accepted' ? 'aceitou' : 'recusou'} sua candidatura`, { clanId: clan.id });
        return { status: decision.decision === 'accepted' ? 'accepted' : 'declined', decision };
    },
});

registerInviteHandler('outgoing-invite', {
    resolve(invite) {
        const clan = getClan(invite.clanId);
        const player = getPlayerById(invite.playerId);
        if (!clan || !player || myClan()?.id !== clan.id) {
            return { status: 'expired', decision: { decision: 'declined', reasons: [{ ok: false, text: 'Você não está mais nesse clã.' }], summary: 'Convite encerrado.' } };
        }
        const playerClan = clanOfPlayer(player.id);
        const decision = decideInviteResponse({
            player,
            clan,
            user: getUser(),
            relation: getRelations()[player.id]?.type ?? null,
            playerClan: playerClan && playerClan.id !== clan.id ? playerClan : null,
            week: invite.week ?? currentWeekKey(),
        });

        if (decision.decision === 'accepted') {
            const clans = getClans();
            saveClans(clans.map((item) => (item.id === clan.id ? { ...item, members: [...item.members, player.id] } : item)));
            logActivity('clan', `${player.nickname} entrou no [${clan.tag}]`, { clanId: clan.id, playerId: player.id });
        } else {
            logActivity('invite', `${player.nickname} recusou o convite para o [${clan.tag}]`, { clanId: clan.id, playerId: player.id });
        }
        return { status: decision.decision === 'accepted' ? 'accepted' : 'declined', decision };
    },
});

registerInviteHandler('clan-invite', {
    accept(invite) {
        const clan = getClan(invite.clanId);
        if (!clan) return { ok: false, reason: 'Esse clã não existe mais.' };
        if (myClan()) return { ok: false, reason: 'Você já está em um clã. Saia do atual para aceitar.' };
        const failed = clanRequirements(clan).find((check) => !check.ok);
        if (failed) return { ok: false, reason: failed.text };
        joinAs(clan, 'member', 'invite');
        return { ok: true, clan, message: `Você entrou no [${clan.tag}] ${clan.name}.` };
    },
});

/** Quantos jogadores o usuário recrutou para o próprio clã. */
export const recruitedCount = () => {
    const clan = myClan();
    return clan && !clan.seeded ? clan.roster.filter((entry) => entry.id !== 'self').length : 0;
};
