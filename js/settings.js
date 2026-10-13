/**
 * settings.js — controller for the Settings page.
 *
 * Preferences, storage transparency, data export and the demo reset.
 * Every switch here has a real effect; nothing is decorative.
 */

import { bootApp, applySettings, haltModule } from './app.js';
import {
    KEYS, SCHEMA_VERSION, getSettings, saveSettings, resetAll, read, isPersistent, rawSize,
} from './storage.js';
import { clearActivity } from './activity.js';
import { currentAccount, logout } from './auth.js';
import { confirmDialog } from './modal.js';
import { toast } from './notifications.js';
import { progressSnapshot } from './gamification.js';
import { $, render, escapeHtml, formatNumber } from './ui.js';
import { userAvatarMarkup } from './avatar-service.js';

const user = bootApp({
    page: 'settings',
    title: 'Configurações',
    subtitle: 'Preferências e dados locais',
});
if (!user) await haltModule();

/* ============================================================
   ACCOUNT
   ============================================================ */

const account = currentAccount();
const snapshot = progressSnapshot();

render($('#accountInfo'), `
    <div class="settings-account__row">
        ${userAvatarMarkup(user, { size: 'lg' })}
        <div>
            <p class="settings-account__nick">${escapeHtml(user.nickname)}</p>
            <p class="settings-account__meta">${escapeHtml(account?.email ?? user.email)}</p>
            <p class="settings-account__meta numeric">${escapeHtml(user.gamerId)} · Nível ${snapshot.level} · ${formatNumber(snapshot.xp)} XP</p>
        </div>
    </div>
`);

$('#signOutBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Sair da conta?',
        message: 'Seus dados ficam neste navegador. Você pode entrar de novo com o mesmo e-mail quando quiser.',
        confirmLabel: 'Sair da conta',
        cancelLabel: 'Continuar aqui',
    });
    if (!confirmed) return;
    logout();
    window.location.href = 'index.html';
});

/* ============================================================
   PREFERENCES
   ============================================================ */

const settings = getSettings();

/* ------------------------------------------------------------
   TUTORIAL
   ------------------------------------------------------------ */
$('#replayTourBtn').addEventListener('click', async () => {
    const { startTour } = await import('./tour.js');
    startTour();
});

/* ------------------------------------------------------------
   TEMA VISUAL
   ------------------------------------------------------------ */
const themePicker = document.getElementById('themePicker');
const THEME_NAMES = {
    'rivaly': 'Preto e amarelo',
    'marrom-rosa': 'Marrom e rosa',
    'azul-verde': 'Azul-bebê e verde',
    'preto-vermelho': 'Preto e vermelho',
};

function markTheme(active) {
    themePicker.querySelectorAll('[data-theme-id]').forEach((btn) => {
        const on = btn.dataset.themeId === active;
        btn.setAttribute('aria-checked', String(on));
        btn.classList.toggle('is-selected', on);
    });
}

markTheme(settings.theme ?? 'rivaly');

themePicker.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-theme-id]');
    if (!btn) return;

    const chosen = btn.dataset.themeId;
    saveSettings({ theme: chosen });
    applySettings();
    markTheme(chosen);
    toast({ title: 'Tema aplicado.', message: THEME_NAMES[chosen], type: 'success' });
});

const toggles = [
    { id: 'reducedMotionToggle', key: 'reducedMotion', label: 'Reduzir animações' },
    { id: 'toastsToggle', key: 'toastsEnabled', label: 'Notificações' },
    { id: 'densityToggle', key: 'compactDensity', label: 'Densidade compacta' },
];

toggles.forEach(({ id, key, label }) => {
    const input = document.getElementById(id);
    input.checked = Boolean(settings[key]);

    input.addEventListener('change', () => {
        saveSettings({ [key]: input.checked });
        applySettings();

        // The toasts switch has to confirm itself before it takes effect.
        if (key === 'toastsEnabled' && !input.checked) {
            toast({ title: 'Notificações desativadas.', message: 'Você pode reativar aqui quando quiser.', type: 'info' });
        } else {
            toast({
                title: `${label}: ${input.checked ? 'ligado' : 'desligado'}`,
                type: 'info',
            });
        }
    });
});

/* ============================================================
   STORAGE TRANSPARENCY
   ============================================================ */

const STORAGE_LABELS = {
    version: 'Versão do schema',
    accounts: 'Contas (simulação de login)',
    session: 'Sessão ativa',
    user: 'Passaporte Gamer',
    library: 'Biblioteca de Jogos',
    externalGames: 'Jogos vindos do GameDB',
    achievements: 'Conquistas desbloqueadas',
    activity: 'Registro de atividade',
    squads: 'Squad salvo',
    settings: 'Preferências de interface',
    clans: 'Clãs que você criou',
    clanMembership: 'Seu vínculo com um clã',
    clanProgress: 'Sua contribuição para o clã',
    arena: 'Rating, temporada e histórico da Arena',
    feed: 'Seus posts, reações e comentários',
    invites: 'Convites, candidaturas e desafios',
    sessions: 'Sessões de squad jogadas',
    relations: 'Aliados e rivais',
};

function describe(value) {
    if (value === null || value === undefined) return 'vazio';
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
    if (typeof value === 'object') return `${Object.keys(value).length} campo${Object.keys(value).length === 1 ? '' : 's'}`;
    return String(value);
}

/** Tamanho legível. A leitura passa pelo storage.js, a única porta. */
function sizeOf(key) {
    const bytes = rawSize(key);
    if (!bytes) return '0 B';
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1).replace('.', ',')} KB` : `${bytes} B`;
}

function renderStorage() {
    const rows = Object.entries(KEYS).map(([name, key]) => {
        const value = read(key, null);
        return `
            <tr>
                <td><code>${escapeHtml(key)}</code></td>
                <td>${escapeHtml(STORAGE_LABELS[name] ?? name)}</td>
                <td>${escapeHtml(describe(value))}</td>
                <td class="numeric text-end">${escapeHtml(sizeOf(key))}</td>
            </tr>
        `;
    }).join('');

    render($('#storageTable'), `
        <div class="table-responsive">
            <table class="table table-sm table-hover align-middle storage-table__table">
                <caption>Schema ${SCHEMA_VERSION}. Chaves da V1 continuam iguais; as da comunidade entraram na V2.</caption>
                <thead><tr><th scope="col">Chave</th><th scope="col">Conteúdo</th><th scope="col">Valor</th><th scope="col" class="text-end">Tamanho</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        ${isPersistent()
            ? ''
            : '<p class="storage-warning">O armazenamento local não está disponível neste navegador. O app roda em memória e nada fica salvo depois de recarregar.</p>'}
    `);
}

renderStorage();

/* ============================================================
   EXPORT
   ============================================================ */

$('#exportBtn').addEventListener('click', () => {
    const payload = Object.fromEntries(
        Object.entries(KEYS)
            .filter(([name]) => name !== 'accounts' && name !== 'session') // never export credentials
            .map(([name, key]) => [name, read(key, null)])
    );

    const blob = new Blob([JSON.stringify({ app: 'RIVALY V2', schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...payload }, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `rivaly-${user.nickname.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
        title: 'Dados exportados.',
        message: 'Passaporte, Biblioteca, conquistas, atividade e comunidade (clã, Arena, Feed, convites, sessões e relações) foram exportados. As credenciais da conta ficaram de fora.',
        type: 'success',
    });
});

/* ============================================================
   CLEAR ACTIVITY
   ============================================================ */

$('#clearActivityBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Limpar o histórico de atividades?',
        message: 'Só o registro de atividades sai. Passaporte, Biblioteca, XP, conquistas e comunidade continuam intactos.',
        confirmLabel: 'Limpar histórico',
        cancelLabel: 'Manter o histórico',
        danger: true,
    });
    if (!confirmed) return;

    clearActivity();
    renderStorage();
    toast({ title: 'Histórico de atividades limpo.', type: 'info' });
});

/* ============================================================
   RESET
   ============================================================ */

$('#resetBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Apagar todos os dados deste navegador?',
        message: 'Passaporte, DNA Gamer, Biblioteca, conquistas, atividade, squad salvo, clã, Arena, Feed, convites, sessões e relações serão apagados para sempre deste navegador. Sua conta de acesso fica, para você recomeçar com o mesmo e-mail.',
        confirmLabel: 'Apagar tudo e recomeçar',
        cancelLabel: 'Manter meus dados',
        danger: true,
    });
    if (!confirmed) return;

    resetAll({ keepAccounts: true });
    window.location.href = 'login.html?mode=signin';
});

/* ============================================================
   ABOUT
   ============================================================ */

const ABOUT = [
    ['Versão', 'V2 · Arena, Feed e Clãs'],
    ['Tecnologias', 'HTML5 · CSS3 · JavaScript (ES Modules) · Bootstrap 5.3.8'],
    ['Bootstrap', 'Servido localmente de vendor/bootstrap, sem CDN'],
    ['Imagens', 'Capas da Steam e do IGDB, avatares do DiceBear; emblemas e fallbacks gerados no navegador'],
    ['Persistência', `localStorage com o namespace rivaly: (schema ${SCHEMA_VERSION})`],
    ['Comunidade', 'Simulada e determinística: os outros jogadores são perfis semeados'],
    ['Backend', 'Nenhum'],
];

render($('#aboutList'), ABOUT.map(([term, value]) => `
    <div class="about-list__row">
        <dt>${escapeHtml(term)}</dt>
        <dd>${escapeHtml(value)}</dd>
    </div>
`).join(''));
