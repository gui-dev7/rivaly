/**
 * formulas.js — a matemática da RIVALY em um lugar só.
 *
 * Funções puras: sem DOM, sem storage, sem acaso. Recebem números e
 * devolvem números, então podem ser testadas uma a uma (tests/formulas.test.mjs)
 * e explicadas na tela ("Ver a conta").
 *
 *   1º grau  f(x) = ax + b          passo de XP por nível, pontos de temporada,
 *                                   variação do rating, soma ponderada da
 *                                   compatibilidade
 *   2º grau  f(x) = ax² + bx + c    XP acumulado por nível, nível do clã,
 *                                   bônus de equilíbrio da Arena (parábola
 *                                   com vértice em 50% de chance)
 *   Bhaskara                        o caminho de volta: XP → nível, sem laço
 *   Logística                       expectativa do Elo (não é polinômio)
 */

/* ============================================================
   FERRAMENTAS GENÉRICAS
   ============================================================ */

/** f(x) = a·x + b. `a` é a taxa de variação; `b`, o valor em x = 0. */
export const linear = (a, b) => (x) => a * x + b;

/** f(x) = a·x² + b·x + c. */
export const quadratic = (a, b, c) => (x) => a * x * x + b * x + c;

/**
 * Raízes de a·x² + b·x + c = 0 pela fórmula de Bhaskara.
 * Δ = b² − 4ac;  x = (−b ± √Δ) / 2a.  Sem raiz real quando Δ < 0.
 */
export function bhaskara(a, b, c) {
    if (a === 0) throw new RangeError('Não é uma equação do 2º grau (a = 0).');
    const delta = b * b - 4 * a * c;
    if (delta < 0) return { delta, roots: [] };
    const sqrt = Math.sqrt(delta);
    const x1 = (-b - sqrt) / (2 * a);
    const x2 = (-b + sqrt) / (2 * a);
    return { delta, roots: delta === 0 ? [x1] : [Math.min(x1, x2), Math.max(x1, x2)] };
}

/** Vértice da parábola: x = −b / 2a, y = f(x). Máximo se a < 0, mínimo se a > 0. */
export function vertex(a, b, c) {
    if (a === 0) throw new RangeError('Não é uma parábola (a = 0).');
    const x = -b / (2 * a);
    return { x, y: quadratic(a, b, c)(x), kind: a < 0 ? 'máximo' : 'mínimo' };
}

/**
 * Soma ponderada Σ wᵢ·sᵢ — é de 1º grau em cada nota sᵢ.
 * `scores` em 0–1; o resultado fica na escala da soma dos pesos.
 */
export function weightedSum(weights, scores) {
    if (weights.length !== scores.length) throw new RangeError('Pesos e notas precisam ter o mesmo tamanho.');
    let total = 0;
    for (let i = 0; i < weights.length; i += 1) total += weights[i] * scores[i];
    return total;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ============================================================
   XP E NÍVEL DO JOGADOR
   ------------------------------------------------------------
   Passo para sair do nível L (1º grau):   step(L)  = 500L + 500
   XP acumulado para chegar ao nível L:     total(L) = 250L² + 250L − 500
   total(L) é a soma dos passos dos níveis 1 … L−1: somar uma função de
   1º grau dá uma de 2º grau. Para ir do XP ao nível, resolve-se
   250L² + 250L − (500 + xp) = 0 por Bhaskara: O(1), nenhum laço.
   ============================================================ */

export const XP_CURVE = { step: { a: 500, b: 500 }, total: { a: 250, b: 250, c: -500 } };

const stepLine = linear(XP_CURVE.step.a, XP_CURVE.step.b);
const totalParabola = quadratic(XP_CURVE.total.a, XP_CURVE.total.b, XP_CURVE.total.c);

export const xpStepForLevel = (level) => stepLine(Math.max(1, level));

export const totalXpForLevel = (level) => totalParabola(Math.max(1, Math.floor(level)));

export function levelFromXp(xp) {
    const safeXp = Math.max(0, Number(xp) || 0);
    const { a, b, c } = XP_CURVE.total;
    const { roots } = bhaskara(a, b, c - safeXp);
    const positive = roots[roots.length - 1];
    // Arredondar a 1e-9 evita que 2.9999999 vire 2 por erro de ponto flutuante.
    return Math.max(1, Math.floor(Math.round(positive * 1e9) / 1e9));
}

/* ============================================================
   NÍVEL DO CLÃ
   ------------------------------------------------------------
   XP do clã para chegar ao nível N (2º grau): xp(N) = 120·(N − 1)²
   Inverso: N = 1 + ⌊√(xp / 120)⌋.
   ============================================================ */

export const CLAN_XP_FACTOR = 120;

export const clanXpForLevel = (level) => CLAN_XP_FACTOR * (Math.max(1, level) - 1) ** 2;

export const clanLevelFromXp = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / CLAN_XP_FACTOR));

/* ============================================================
   ARENA
   ============================================================ */

export const ELO = { start: 1000, kNew: 40, kSettled: 32, newMatches: 10, floor: 100 };

export const kFactor = (matches) => (matches < ELO.newMatches ? ELO.kNew : ELO.kSettled);

/** Expectativa do Elo: E = 1 / (1 + 10^((Rb − Ra) / 400)). Curva logística, não polinômio. */
export const expectedScore = (rating, opponentRating) =>
    1 / (1 + 10 ** ((opponentRating - rating) / 400));

/** Variação do rating: ΔR = K·(S − E). De 1º grau no resultado S (1 vitória, 0 derrota). */
export const ratingDelta = (k, expected, result) => Math.round(k * (result - expected));

/** Pontos de temporada (1º grau em duas variáveis): P = 3·vitórias + 1·derrotas. */
export const SEASON_POINTS = { win: 3, loss: 1 };
export const seasonPoints = (wins, losses) => SEASON_POINTS.win * wins + SEASON_POINTS.loss * losses;

/**
 * Bônus de equilíbrio (2º grau): B(p) = Bmax · 4p(1 − p) = −4Bmax·p² + 4Bmax·p.
 * Parábola com concavidade para baixo e vértice em p = 0,5: a partida mais
 * equilibrada paga o bônus máximo; atropelar alguém muito mais fraco (p → 1)
 * ou encarar alguém muito mais forte (p → 0) paga quase nada. Desestimula
 * "farmar" adversários fracos sem punir quem perde.
 */
export const BALANCE_BONUS_MAX = 40;
export const BALANCE_PARABOLA = { a: -4 * BALANCE_BONUS_MAX, b: 4 * BALANCE_BONUS_MAX, c: 0 };

export function balanceBonus(chance) {
    const p = clamp(Number(chance) || 0, 0, 1);
    const { a, b, c } = BALANCE_PARABOLA;
    return Math.round(quadratic(a, b, c)(p));
}
