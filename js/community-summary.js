/**
 * community-summary.js — o que o Dashboard e o Passaporte mostram da
 * comunidade: clã, Arena, aliados, rivais e o "próximo passo".
 *
 * O próximo passo segue uma ordem fixa e explicável. A primeira regra
 * que se aplica vence:
 *   1. convite ou desafio esperando você
 *   2. resposta de candidatura ou convite que chegou
 *   3. DNA Gamer ainda não mapeado
 *   4. nenhuma sessão de squad jogada
 *   5. sem clã
 *   6. nenhuma partida de Arena
 *   7. nenhum post no Feed
 *   8. meta semanal do clã incompleta
 */

import { getUser, getSessions, getFeed } from './storage.js';
import { myClan, myRole, clanStats } from './clans-store.js';
import { arenaState, tierFor, tierProgress } from './arena-store.js';
import { relationCounts } from './sessions.js';
import { actionableInvites, unseenResponses } from './invites.js';

export function communitySnapshot() {
    const clan = myClan();
    const arena = arenaState();
    return {
        clan,
        role: myRole(),
        clanStats: clan ? clanStats(clan) : null,
        arena,
        tier: tierFor(arena.rating),
        tierProgress: tierProgress(arena.rating),
        relations: relationCounts(),
        sessions: getSessions().length,
        posts: getFeed().posts.length,
    };
}

/**
 * @returns {{ icon:string, title:string, text:string, why:string, cta:{label:string, href?:string, action?:string} }}
 */
export function nextStep() {
    const user = getUser();
    const actionable = actionableInvites();
    const responses = unseenResponses();
    const snapshot = communitySnapshot();

    if (actionable.length) {
        const challenges = actionable.filter((invite) => invite.kind === 'arena-challenge').length;
        return {
            icon: 'bell',
            title: actionable.length === 1 ? 'Você tem 1 convite esperando.' : `Você tem ${actionable.length} convites esperando.`,
            text: challenges ? 'Tem desafio de rival na fila. Desafios valem só até o fim da semana.' : 'Um clã quer você. Veja quem chamou e por quê.',
            why: 'Convites e desafios pedem uma resposta sua e expiram no fim da semana.',
            cta: { label: 'Ver convites', action: 'open-invites' },
        };
    }

    if (responses.length) {
        return {
            icon: 'mail',
            title: 'Chegou uma resposta para você.',
            text: 'Uma candidatura ou um convite que você mandou foi respondido, com o motivo.',
            why: 'Respostas ficam no centro de convites até você ver.',
            cta: { label: 'Ver resposta', action: 'open-invites' },
        };
    }

    if (!user?.dna) {
        return {
            icon: 'dna',
            title: 'Mapeie o seu DNA Gamer.',
            text: 'Dez perguntas definem seu arquétipo e deixam squads, clãs e compatibilidade mais precisos.',
            why: 'Sem DNA, o motor compara você só pelas preferências.',
            cta: { label: 'Começar o DNA', href: 'onboarding.html?stage=dna' },
        };
    }

    if (snapshot.sessions === 0) {
        return {
            icon: 'play',
            title: 'Jogue sua primeira sessão de squad.',
            text: 'Escolha 2 a 4 jogadores compatíveis ou peça um squad sorteado. Depois da partida você marca aliados e rivais.',
            why: 'A sessão é a ponte para Arena, clãs e Feed.',
            cta: { label: 'Jogar uma sessão', href: 'squads.html' },
        };
    }

    if (!snapshot.clan) {
        return {
            icon: 'shield',
            title: 'Encontre um clã compatível.',
            text: 'Os clãs aparecem ordenados pela compatibilidade com o seu DNA. Entre, candidate-se ou funde o seu.',
            why: 'Com clã, cada vitória conta para a meta semanal e libera o Clã vs Clã.',
            cta: { label: 'Ver clãs compatíveis', href: 'clans.html#exploreTitle' },
        };
    }

    if (snapshot.arena.matches === 0) {
        return {
            icon: 'target',
            title: 'Estreie na Arena.',
            text: 'Você começa com 1.000 de rating. Antes de cada partida a Arena mostra sua chance de vitória.',
            why: 'Suas 10 primeiras partidas movem o rating mais rápido (K = 40).',
            cta: { label: 'Ir para a Arena', href: 'arena.html' },
        };
    }

    if (snapshot.posts === 0) {
        return {
            icon: 'globe',
            title: 'Apresente-se no Feed.',
            text: 'Conte o que você está jogando ou procure duo para hoje.',
            why: 'O primeiro post desbloqueia a conquista Voz da Comunidade.',
            cta: { label: 'Escrever no Feed', href: 'feed.html#composerTitle' },
        };
    }

    const stats = snapshot.clanStats;
    if (stats && stats.weekPoints < stats.goal) {
        return {
            icon: 'flag',
            title: `Faltam ${stats.goal - stats.weekPoints} pontos para a meta do [${snapshot.clan.tag}].`,
            text: 'Vitória na Arena vale 20 pontos, Clã vs Clã vale 40 e cada sessão vale 10.',
            why: 'A meta reinicia toda segunda-feira, junto com a temporada.',
            cta: { label: 'Jogar na Arena', href: 'arena.html#playTitle' },
        };
    }

    return {
        icon: 'trophy',
        title: 'Semana redonda.',
        text: 'Meta do clã batida. Que tal subir de tier na Arena ou completar uma conquista rara?',
        why: 'Tudo o que restava para esta semana está feito.',
        cta: { label: 'Ver conquistas', href: 'achievements.html' },
    };
}
