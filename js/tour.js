/**
 * tour.js — tutorial guiado da RIVALY.
 *
 * O tour atravessa varias paginas, entao ele nao pode viver na memoria de
 * uma so. O progresso fica em sessionStorage: cada pagina que carrega
 * pergunta "o tour esta ativo e ha passo meu aqui?" e continua de onde
 * parou. Terminar ou pular grava a conclusao nas configuracoes, para o
 * tutorial nao reaparecer a cada login.
 *
 * Passos cujo alvo nao existe sao pulados em silencio: a Biblioteca vazia
 * nao tem card de jogo, e travar o tutorial por causa disso seria pior do
 * que omitir uma explicacao.
 */

import { getSettings, saveSettings } from './storage.js';
import { prefersReducedMotion } from './animations.js';

const STATE_KEY = 'rivaly:tour';

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
        text: 'Este é um tour completo pelo produto. São alguns passos, e você pode sair quando quiser — vamos começar pelo Início, que resume tudo o que o seu Passaporte já sabe sobre você.',
    },
    {
        page: 'dashboard.html', target: '.sidebar__nav',
        title: 'A navegação',
        text: 'Todas as áreas ficam aqui: Passaporte, Biblioteca, Descobrir, Squads, Conquistas e Configurações. A seção atual aparece destacada.',
    },
    {
        page: 'dashboard.html', target: '[data-topbar] .level-pill, .level-pill',
        title: 'Nível e XP',
        text: 'Quase tudo o que você faz rende XP: montar o Passaporte, adicionar jogos, zerar títulos e buscar squad. A barra mostra quanto falta para o próximo nível.',
    },
    {
        page: 'dashboard.html', target: '#overviewStats',
        title: 'Visão geral',
        text: 'Seis indicadores do seu perfil: nível, experiência, Pontuação Gamer, reputação, jogos registrados e medalhas. Todos são calculados a partir dos seus dados reais — nada aqui é enfeite.',
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
        text: 'Este cartão é a sua identidade dentro da RIVALY: apelido, arquétipo, nível e os jogos do momento. Todo o resto do produto lê ou escreve neste registro.',
    },
    {
        page: 'passport.html', target: '.identity__actions, #editPassportBtn',
        title: 'Editar e trocar o avatar',
        text: 'Aqui você ajusta apelido, rank, região, plataformas, idiomas, horários e função. O botão de avatar abre a galeria do DiceBear, com centenas de opções ou o envio da sua própria imagem.',
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
        text: 'Cada card guarda plataforma, horas e sua nota. Passe o mouse para editar ou remover — e você também pode arrastar o card para outra aba para trocar o status.',
    },
    {
        page: 'library.html', target: '#addGameBtn, .page__header .btn--primary',
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
        text: 'Cada resultado da busca traz três botões: Já joguei, Jogando e Quero jogar. Marcar um deles cria uma entrada diretamente na sua Biblioteca, valendo XP e conquistas como qualquer outro jogo — e o que você registrou aparece resumido aqui.',
    },

    /* ---------- SQUADS ---------- */
    {
        page: 'squads.html', target: '#squadForm',
        title: 'Encontrar squad',
        text: 'Escolha o jogo, o rank, o horário e a função que falta no seu time. Deixe em "Complementar meu Passaporte" para o motor usar as suas próprias preferências.',
    },
    {
        page: 'squads.html', target: '.squad-card, .squads__results',
        title: 'Como a nota é calculada',
        text: 'Sete fatores ponderados formam a compatibilidade, e cada resultado mostra a conta inteira. Sem aleatoriedade: a mesma busca devolve sempre o mesmo ranking.',
    },

    /* ---------- CONQUISTAS ---------- */
    {
        page: 'achievements.html', target: '.achv-progress, .badge',
        title: 'Conquistas',
        text: 'Vinte medalhas em cinco raridades. Cada uma está ligada a algo que você realmente fez — nenhuma é dada de graça, e as bloqueadas mostram o que falta.',
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
        text: 'Tudo o que a RIVALY sabe sobre você fica neste navegador, e aqui você vê exatamente o que está guardado. Dá para exportar ou apagar quando quiser.',
    },

    /* ---------- EM BREVE ---------- */
    {
        page: 'settings.html', target: null,
        title: 'O que vem por aí',
        soon: true,
        text: 'Estas áreas ainda não existem — e, por isso, aparecem marcadas como "em breve" no menu, nunca como botão que não faz nada.',
    },
];

/* ============================================================
   ESTADO
   ============================================================ */

const readState = () => {
    try {
        return JSON.parse(window.sessionStorage.getItem(STATE_KEY) ?? 'null');
    } catch {
        return null;
    }
};

const writeState = (state) => {
    try {
        if (state) window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
        else window.sessionStorage.removeItem(STATE_KEY);
    } catch { /* modo privado: o tour so nao sobrevive a navegacao */ }
};

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

const SOON = [
    ['Arena', 'Torneios, chaveamento e acompanhamento de partidas ao vivo.'],
    ['Feed de destaques', 'Clipes, posts e os melhores momentos de quem joga com você.'],
    ['Clãs', 'Times permanentes, com identidade, elenco e estatísticas próprias.'],
    ['IA contextual', 'Recomendações que leem o seu Passaporte e sugerem o próximo jogo.'],
    ['Sincronização de plataformas', 'Importe sua biblioteca real da Steam, PlayStation e Xbox.'],
];

function soonMarkup() {
    return `
        <ul class="tour__soon">
            ${SOON.map(([name, text]) => `
                <li class="tour__soon-item">
                    <span class="tour__soon-name">${name}</span>
                    <span class="tour__soon-text">${text}</span>
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
                <button type="button" class="btn btn--ghost btn--sm" data-tour-skip>Pular tutorial</button>
                <div class="tour__nav">
                    <button type="button" class="btn btn--secondary btn--sm" data-tour-prev>Voltar</button>
                    <button type="button" class="btn btn--primary btn--sm" data-tour-next>Próximo</button>
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
        text.innerHTML = `<p>${step.text}</p>${step.soon ? soonMarkup() : ''}`;
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
