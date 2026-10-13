/**
 * tour.js — tutorial guiado da RIVALY.
 *
 * O tour atravessa várias páginas, então ele não pode viver na memória de
 * uma só. O progresso fica no sessionStorage (via storage.js): cada página
 * que carrega pergunta "o tour está ativo e há passo meu aqui?" e continua
 * de onde parou. Terminar ou pular grava a conclusão nas configurações,
 * para o tutorial não reaparecer a cada login.
 *
 * Passos cujo alvo não existe ficam centralizados: a Biblioteca vazia não
 * tem card de jogo, e travar o tutorial por causa disso seria pior do que
 * explicar sem apontar.
 */

import { getSettings, saveSettings, sessionRead, sessionWrite } from './storage.js';
import { ACHIEVEMENTS, ROADMAP } from './data.js';
import { prefersReducedMotion } from './animations.js';
import { escapeHtml } from './ui.js';

const STATE_KEY = 'tour';

/* ============================================================
   ROTEIRO
   ============================================================ */

/**
 * `target` e um seletor; `null` centraliza o cartao (usado na abertura e
 * no encerramento). `page` diz em qual tela o passo acontece.
 */
export const TOUR_STEPS = [
    /* ---------- INICIO ---------- */
    {
        page: 'dashboard.html', target: null,
        title: 'Bem-vindo à RIVALY',
        text: 'Um tour rápido pelo produto. Você pode sair quando quiser. Começamos pelo Início, que resume tudo o que o seu Passaporte já sabe sobre você.',
    },
    {
        page: 'dashboard.html', target: '.sidebar__nav',
        title: 'A navegação',
        text: 'As áreas estão agrupadas em Você, Comunidade, Explorar e Conta. A página atual aparece destacada. No celular, o botão Mais da barra inferior abre este mesmo menu.',
    },
    {
        page: 'dashboard.html', target: '[data-topbar] .level-pill, .level-pill',
        title: 'Nível e XP',
        text: 'Quase tudo o que você faz rende XP: montar o Passaporte, adicionar jogos, zerar títulos e buscar squad. A barra mostra quanto falta para o próximo nível.',
    },
    {
        page: 'dashboard.html', target: '#nextStep',
        title: 'Próximo passo',
        text: 'Uma ação só: a que mais faz o seu Passaporte avançar agora. A regra é fixa e aparece no próprio card.',
    },
    {
        page: 'dashboard.html', target: '.invites__toggle',
        title: 'Centro de convites',
        text: 'Convites de clã, respostas de candidatura e desafios da Arena chegam neste sino, com o número de pendências.',
    },
    {
        page: 'dashboard.html', target: '#overviewStats',
        title: 'Visão geral',
        text: 'Seis indicadores do seu perfil: nível, experiência, Pontuação Gamer, reputação, jogos e medalhas. Todos saem dos seus dados; nada aqui é enfeite.',
    },
    {
        page: 'dashboard.html', target: '.dna-summary',
        title: 'Seu DNA Gamer',
        text: 'Dez perguntas produzem seis atributos e um arquétipo. É ele que orienta as recomendações e o peso de cada fator na busca por squad.',
    },
    {
        page: 'dashboard.html', target: '.suggested, .suggested__intro',
        title: 'Squad sugerido',
        text: 'A partir do jogo que você mais joga, o motor já apresenta os jogadores mais compatíveis com você.',
    },

    /* ---------- PASSAPORTE ---------- */
    {
        page: 'passport.html', target: '.passport-card',
        title: 'Seu Passaporte Gamer',
        text: 'Este cartão é a sua identidade na RIVALY: apelido, arquétipo, nível, Arena e clã. Todo o resto do produto lê ou escreve neste registro.',
    },
    {
        page: 'passport.html', target: '.identity__actions, #editPassportBtn',
        title: 'Editar e trocar o avatar',
        text: 'Aqui você ajusta apelido, rank, região, plataformas, idiomas, horários e função. O botão de avatar abre a galeria do DiceBear ou o envio da sua própria imagem.',
    },
    {
        page: 'passport.html', target: '#passportCommunity',
        title: 'Comunidade no Passaporte',
        text: 'Clã, rating de Arena, aliados e rivais. Tudo o que você faz na comunidade volta para cá.',
    },
    {
        page: 'passport.html', target: '.dna-full',
        title: 'Análise completa do DNA',
        text: 'A versão detalhada do seu arquétipo: descrição, traços e as seis barras de atributos com o valor exato de cada uma.',
    },
    {
        page: 'passport.html', target: '.signature',
        title: 'Assinatura da biblioteca',
        text: 'O retrato do que você joga: horas, jogos zerados, gêneros e plataformas favoritas. É o que alimenta a compatibilidade por gênero.',
    },

    /* ---------- BIBLIOTECA ---------- */
    {
        page: 'library.html', target: '#statusTabs',
        title: 'Biblioteca por status',
        text: 'Cada jogo vive em um estado: Jogando, Zerado, Fila, Abandonado ou Lista de desejos. Filtre por aba para ver só o que interessa.',
    },
    {
        page: 'library.html', target: '.game-card',
        title: 'Um jogo na prática',
        text: 'Cada card guarda plataforma, horas e nota. Passe o mouse para editar ou remover, ou arraste o card até outra aba para trocar o status.',
    },
    {
        page: 'library.html', target: '#addGameBtn',
        title: 'Adicionar do catálogo',
        text: 'Adicione um título do catálogo selecionado pela RIVALY. Para qualquer outro jogo do mundo, o próximo passo mostra o caminho.',
    },

    /* ---------- DESCOBRIR ---------- */
    {
        page: 'discover.html', target: '#discoverSearch',
        title: 'Descobrir qualquer jogo',
        text: 'Esta busca consulta a base aberta do LizardByte GameDB, com centenas de milhares de títulos. Digite duas letras ou mais, e os resultados vêm com capa, ano e plataformas.',
    },
    {
        page: 'discover.html', target: '.discover-saved',
        title: 'Do Descobrir para a Biblioteca',
        text: 'Cada resultado traz três botões: Já joguei, Jogando e Quero jogar. Marcar um deles cria a entrada direto na Biblioteca, valendo XP e conquistas, e o que você registrou aparece resumido aqui.',
    },

    /* ---------- SQUADS ---------- */
    {
        page: 'squads.html', target: '#squadForm',
        title: 'Encontrar squad',
        text: 'Escolha o jogo, o rank, o horário e a função que falta no seu time. Em "Completar meu Passaporte", o motor usa as suas próprias funções.',
    },
    {
        page: 'squads.html', target: '#sessionBar',
        title: 'Jogar uma sessão',
        text: 'Marque de 2 a 4 jogadores ou peça um squad aleatório. Depois da partida você marca cada colega como Aliado, Rival ou Neutro, e um colega com clã pode convidar você.',
    },

    /* ---------- ARENA ---------- */
    {
        page: 'arena.html', target: '#arenaSummary',
        title: 'Arena',
        text: 'Seu rating começa em 1.000. Antes de cada partida você vê a chance de vitória e quanto o rating sobe ou cai. Depois, a conta do resultado.',
    },
    {
        page: 'arena.html', target: '#rankingPanel',
        title: 'Ranking da temporada',
        text: 'Cada semana é uma temporada. A tabela mostra jogadores e clãs, com filtro por jogo e a sua linha destacada.',
    },

    /* ---------- CLÃS ---------- */
    {
        page: 'clans.html', target: '#clanGrid',
        title: 'Clãs',
        text: 'Cada card mostra quanto o clã combina com você. Clãs abertos aceitam na hora; os de candidatura leem a sua mensagem e respondem com o motivo.',
    },

    /* ---------- FEED ---------- */
    {
        page: 'feed.html', target: '#composer',
        title: 'Feed',
        text: 'Publique em até 280 caracteres, reaja com GG, Respeito ou Rivalidade e comente. As abas filtram por clã, aliados, rivais e Arena.',
    },

    /* ---------- CONQUISTAS ---------- */
    {
        page: 'achievements.html', target: '.achv-progress, .badge',
        title: 'Conquistas',
        text: `${ACHIEVEMENTS.length} medalhas em cinco raridades. Cada uma está ligada a algo que você fez; as bloqueadas mostram o que falta.`,
    },

    /* ---------- CONFIGURACOES ---------- */
    {
        page: 'settings.html', target: '#themePicker',
        title: 'Temas',
        text: 'Quatro paletas completas. A troca vale para o site inteiro, inclusive a logo e o ícone da aba, e fica guardada neste navegador.',
    },
    {
        page: 'settings.html', target: '#storageTable, .storage-table',
        title: 'Seus dados',
        text: 'Tudo o que a RIVALY sabe sobre você fica neste navegador, e aqui você vê exatamente o que está guardado. Dá para baixar ou apagar quando quiser.',
    },

    /* ---------- ENCERRAMENTO ---------- */
    {
        page: 'settings.html', target: null,
        title: 'Uma comunidade simulada, e o que ainda não existe',
        soon: true,
        text: 'Os outros jogadores são perfis semeados e todo comportamento deles sai de um motor determinístico que mostra o motivo. O que depende de servidor ainda não existe, e por isso não aparece como botão:',
    },
];

/* ============================================================
   ESTADO
   ============================================================ */

// Em modo privado a gravação falha e o tour só não sobrevive à navegação.
const readState = () => sessionRead(STATE_KEY, null);
const writeState = (state) => sessionWrite(STATE_KEY, state ?? null);

/** Marca o tour como comecado no passo zero. */
export function startTour() {
    writeState({ index: 0 });
    const first = TOUR_STEPS[0];
    if (currentPage() !== first.page) {
        window.location.href = first.page;
        return;
    }
    mount();
}

export const tourFinished = () => Boolean(getSettings().tourDone);

function finish({ completed }) {
    writeState(null);
    if (completed) saveSettings({ tourDone: true });
    document.querySelector('.tour')?.remove();
    document.body.classList.remove('is-touring');
}

const currentPage = () =>
    window.location.pathname.split('/').pop() || 'index.html';

/* ============================================================
   RENDER
   ============================================================ */

/** O que ainda não existe vem do mesmo ROADMAP da landing. */
function soonMarkup() {
    return `
        <ul class="tour__soon">
            ${ROADMAP.map((item) => `
                <li class="tour__soon-item">
                    <span class="tour__soon-name">${escapeHtml(item.title)}</span>
                    <span class="tour__soon-text">${escapeHtml(item.text)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function findTarget(step) {
    if (!step.target) return null;
    for (const selector of step.target.split(',')) {
        const node = document.querySelector(selector.trim());
        if (node) return node;
    }
    return null;
}

/** Primeiro passo desta pagina a partir de `from`, ou -1. */
function nextIndexOnPage(from, page) {
    for (let i = from; i < TOUR_STEPS.length; i += 1) {
        if (TOUR_STEPS[i].page === page) return i;
    }
    return -1;
}

function buildShell() {
    const root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = `
        <div class="tour__veil" data-tour-veil></div>
        <div class="tour__spot" data-tour-spot hidden></div>
        <div class="tour__card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" data-tour-card>
            <p class="tour__step" data-tour-count></p>
            <h2 class="tour__title" id="tourTitle" data-tour-title></h2>
            <div class="tour__text" data-tour-text></div>
            <div class="tour__actions">
                <button type="button" class="btn btn-ghost btn-sm" data-tour-skip>Pular tutorial</button>
                <div class="tour__nav">
                    <button type="button" class="btn btn-outline-light btn-sm" data-tour-prev>Voltar</button>
                    <button type="button" class="btn btn-primary btn-sm" data-tour-next>Próximo</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);
    document.body.classList.add('is-touring');
    return root;
}

/** Posiciona o recorte e o cartao em volta do alvo. */
function place(root, node) {
    const spot = root.querySelector('[data-tour-spot]');
    const card = root.querySelector('[data-tour-card]');
    const pad = 8;

    if (!node) {
        spot.hidden = true;
        root.classList.add('tour--flat');
        card.classList.add('tour__card--center');
        card.style.top = '';
        card.style.left = '';
        return;
    }

    card.classList.remove('tour__card--center');
    root.classList.remove('tour--flat');
    const r = node.getBoundingClientRect();

    spot.hidden = false;
    spot.style.top = `${r.top - pad}px`;
    spot.style.left = `${r.left - pad}px`;
    spot.style.width = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;

    // O cartao vai abaixo do alvo; se nao couber, sobe.
    const cardRect = card.getBoundingClientRect();
    const below = r.bottom + 14;
    const fits = below + cardRect.height < window.innerHeight - 12;
    const top = fits ? below : Math.max(12, r.top - cardRect.height - 14);

    let left = r.left + r.width / 2 - cardRect.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - cardRect.width - 12));

    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
}

/* ============================================================
   MOTOR
   ============================================================ */

function mount() {
    const state = readState();
    if (!state) return;

    const page = currentPage();
    let index = nextIndexOnPage(state.index, page);

    // Nada nesta pagina: manda para a pagina do proximo passo.
    if (index === -1) {
        const step = TOUR_STEPS[state.index];
        if (step && step.page !== page) {
            window.location.href = step.page;
            return;
        }
        finish({ completed: true });
        return;
    }

    const root = document.querySelector('.tour') ?? buildShell();
    const title = root.querySelector('[data-tour-title]');
    const text = root.querySelector('[data-tour-text]');
    const count = root.querySelector('[data-tour-count]');
    const next = root.querySelector('[data-tour-next]');
    const prev = root.querySelector('[data-tour-prev]');

    let node = null;

    const render = () => {
        const step = TOUR_STEPS[index];
        writeState({ index });

        title.textContent = step.title;
        text.innerHTML = `<p>${escapeHtml(step.text)}</p>${step.soon ? soonMarkup() : ''}`;
        count.textContent = `Passo ${index + 1} de ${TOUR_STEPS.length}`;
        prev.disabled = index === 0;
        next.textContent = index === TOUR_STEPS.length - 1 ? 'Concluir' : 'Próximo';

        node = findTarget(step);
        if (node) {
            node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
        }
        // Espera o scroll assentar antes de medir a posicao.
        window.setTimeout(() => place(root, node), prefersReducedMotion() ? 0 : 320);
    };

    const go = (delta) => {
        const target = index + delta;
        if (target < 0) return;

        if (target >= TOUR_STEPS.length) {
            finish({ completed: true });
            return;
        }

        const step = TOUR_STEPS[target];
        if (step.page !== page) {
            writeState({ index: target });
            window.location.href = step.page;
            return;
        }

        index = target;
        render();
    };

    next.addEventListener('click', () => go(1));
    prev.addEventListener('click', () => go(-1));
    root.querySelector('[data-tour-skip]').addEventListener('click', () => finish({ completed: true }));

    document.addEventListener('keydown', (event) => {
        if (!document.body.classList.contains('is-touring')) return;
        if (event.key === 'Escape') finish({ completed: true });
        if (event.key === 'ArrowRight') go(1);
        if (event.key === 'ArrowLeft') go(-1);
    });

    const reposition = () => place(root, node);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });

    render();
}

/** Chamado no boot de cada pagina autenticada. */
export function initTour() {
    if (readState()) mount();
}
