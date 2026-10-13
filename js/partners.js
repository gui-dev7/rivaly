/**
 * partners.js — parceiros salvos ("Seu squad").
 *
 * Na V1 isto vivia dentro de squads.js. Na V2 o mesmo "Salvar parceiro"
 * aparece no resultado da busca, no pós-partida e no cartão do jogador,
 * então a regra mora aqui e os três chamam a mesma função.
 */

import { getSquads, saveSquads, getUser } from './storage.js';
import { getPlayerById } from './data.js';
import { compatibilityWith } from './community.js';
import { awardXp, checkAchievements } from './gamification.js';
import { logActivity } from './activity.js';

export const isSavedPartner = (playerId) => getSquads().some((entry) => entry.playerId === playerId);

export const savedPartnerIds = () => new Set(getSquads().map((entry) => entry.playerId));

/**
 * @param {string} playerId
 * @param {{ total?:number, tier?:{id:string} }} [result]  compatibilidade já calculada
 * @param {string} [gameId]
 * @returns {{ ok:boolean, reason?:string, compatibility?:number }}
 */
export function savePartner(playerId, result = null, gameId = null) {
    const player = getPlayerById(playerId);
    if (!player) return { ok: false, reason: 'Esse jogador não existe mais.' };
    if (isSavedPartner(playerId)) return { ok: false, reason: `${player.nickname} já está no seu squad.` };

    const game = gameId ?? player.games[0];
    const match = result ?? compatibilityWith(player, getUser(), game);

    saveSquads([
        {
            playerId,
            compatibility: match.total,
            tier: match.tier?.id ?? 'good',
            gameId: game,
            savedAt: new Date().toISOString(),
        },
        ...getSquads(),
    ]);

    logActivity('squad', `Salvou ${player.nickname} no seu squad (${match.total}% de compatibilidade)`, { xp: 60, playerId });
    awardXp('saveTeammate', { silent: true });
    checkAchievements({ achievementContext: match.total >= 90 ? `${match.total}% de compatibilidade` : '' });
    return { ok: true, compatibility: match.total, player };
}

export function removePartner(playerId) {
    saveSquads(getSquads().filter((entry) => entry.playerId !== playerId));
}
