/**
 * settings.js — controller for the Settings page.
 *
 * Preferences, storage transparency, data export and the demo reset.
 * Every switch here has a real effect; nothing is decorative.
 */

import { bootApp, applySettings, haltModule } from './app.js';
import {
    KEYS, getSettings, saveSettings, resetAll, read, isPersistent,
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
        title: 'Sair?',
        message: 'Seus dados ficam neste navegador. Você pode entrar novamente com o mesmo e-mail quando quiser.',
        confirmLabel: 'Sair',
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
    toast({ title: 'Tema aplicado', message: THEME_NAMES[chosen], type: 'success' });
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
            toast({ title: 'Notificações desativadas', message: 'Você pode reativá-las aqui quando quiser.', type: 'info' });
        } else {
            toast({
                title: `${label}: ${input.checked ? 'ativo' : 'inativo'}`,
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
};

function describe(value) {
    if (value === null || value === undefined) return 'vazio';
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
    if (typeof value === 'object') return `${Object.keys(value).length} campo${Object.keys(value).length === 1 ? '' : 's'}`;
    return String(value);
}

function sizeOf(key) {
    // Accessing localStorage can throw outright in restricted contexts.
    let raw = null;
    try {
        raw = window.localStorage.getItem(key);
    } catch {
        return '—';
    }
    if (!raw) return '0 B';
    const bytes = new Blob([raw]).size;
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function renderStorage() {
    const rows = Object.entries(KEYS).map(([name, key]) => {
        const value = read(key, null);
        return `
            <div class="storage-row">
                <code class="storage-row__key">${escapeHtml(key)}</code>
                <span class="storage-row__label">${escapeHtml(STORAGE_LABELS[name] ?? name)}</span>
                <span class="storage-row__value">${escapeHtml(describe(value))}</span>
                <span class="storage-row__size numeric">${escapeHtml(sizeOf(key))}</span>
            </div>
        `;
    }).join('');

    render($('#storageTable'), `
        <div class="storage-row storage-row--head">
            <span>Chave</span><span>Conteúdo</span><span>Valor</span><span>Tamanho</span>
        </div>
        ${rows}
        ${isPersistent()
            ? ''
            : '<p class="storage-warning">O armazenamento local não está disponível neste navegador. O app roda em memória e nada persiste após o recarregamento.</p>'}
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

    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2)], {
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
        message: 'Seu Passaporte, sua Biblioteca, suas conquistas e atividades foram exportados — as credenciais da conta não foram incluídas.',
        type: 'success',
    });
});

/* ============================================================
   CLEAR ACTIVITY
   ============================================================ */

$('#clearActivityBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
        title: 'Limpar o histórico de atividades?',
        message: 'Apenas o registro de atividades será removido. Seu Passaporte, sua Biblioteca, seu XP e suas conquistas permanecerão intactos.',
        confirmLabel: 'Limpar histórico',
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
        title: 'Resetar todos os dados demo?',
        message: 'Seu Passaporte, DNA Gamer, Biblioteca, conquistas, atividades e squad salvo serão apagados definitivamente deste navegador. Sua conta de acesso será mantida.',
        confirmLabel: 'Resetar tudo',
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
    ['Versão', 'V1 — Vanilla'],
    ['Tecnologias', 'HTML5 · CSS3 · JavaScript (módulos ES)'],
    ['Dependências em tempo de execução', 'Nenhuma'],
    ['Recursos de imagem', 'Nenhum — avatares e capas são gerados'],
    ['Persistência', 'localStorage (com namespace)'],
    ['Backend', 'Nenhum'],
    ['Próxima versão', 'React + Tailwind CSS'],
];

render($('#aboutList'), ABOUT.map(([term, value]) => `
    <div class="about-list__row">
        <dt>${escapeHtml(term)}</dt>
        <dd>${escapeHtml(value)}</dd>
    </div>
`).join(''));
