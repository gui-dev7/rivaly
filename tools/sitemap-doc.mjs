/**
 * sitemap-doc.mjs — escreve docs/mapa-do-site.md a partir do SITE_MAP.
 *
 *   node tools/sitemap-doc.mjs
 *
 * A mesma árvore que alimenta a navegação e a página sitemap.html vira
 * texto para a documentação. Rodar de novo depois de mudar o SITE_MAP.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_MAP, SITE_PAGES } from '../js/site-map.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const lines = [
    '# Mapa do site da RIVALY',
    '',
    'Gerado a partir de `js/site-map.js` por `tools/sitemap-doc.mjs`. É a mesma árvore usada pela navegação (sidebar, offcanvas, barra inferior e rodapé) e pela página `sitemap.html`.',
    '',
    `Total: ${SITE_PAGES.length} páginas em ${SITE_MAP.length} grupos. Páginas marcadas com (conta) exigem uma conta local; sem sessão, o mapa leva ao login e volta para a página escolhida.`,
    '',
    '## Árvore',
    '',
    '```text',
    'RIVALY',
];

SITE_MAP.forEach((group, groupIndex) => {
    const lastGroup = groupIndex === SITE_MAP.length - 1;
    lines.push(`${lastGroup ? '└──' : '├──'} ${group.title}`);
    group.children.forEach((page, pageIndex) => {
        const lastPage = pageIndex === group.children.length - 1;
        const prefix = `${lastGroup ? '    ' : '│   '}${lastPage ? '└──' : '├──'}`;
        lines.push(`${prefix} ${page.title} (${page.href})${page.auth ? ' (conta)' : ''}`);
        (page.children ?? []).forEach((child, childIndex) => {
            const lastChild = childIndex === page.children.length - 1;
            const childPrefix = `${lastGroup ? '    ' : '│   '}${lastPage ? '    ' : '│   '}${lastChild ? '└──' : '├──'}`;
            lines.push(`${childPrefix} ${child.title}`);
        });
    });
});
lines.push('```', '');

SITE_MAP.forEach((group) => {
    lines.push(`## ${group.title}`, '', group.description, '', '| Página | Arquivo | O que faz |', '|---|---|---|');
    group.children.forEach((page) => {
        lines.push(`| ${page.title}${page.auth ? ' (conta)' : ''} | \`${page.href}\` | ${page.description} |`);
        (page.children ?? []).forEach((child) => {
            lines.push(`| ↳ ${child.title} | \`${child.href}\` | ${child.description} |`);
        });
    });
    lines.push('');
});

lines.push(
    '## Como as áreas se conectam',
    '',
    'Passaporte → DNA Gamer → Squads (compatibilidade e sessão) → Arena e Clãs → Feed → XP e conquistas → Passaporte.',
    '',
    '1. **Passaporte e DNA**: plataformas, horários, funções e jogos; dez perguntas viram seis atributos e um arquétipo.',
    '2. **Squads**: o Motor de Compatibilidade compara o Passaporte com cada jogador em sete fatores; com os melhores, o usuário joga uma sessão.',
    '3. **Pós-partida**: cada colega vira Aliado, Rival ou Neutro; rivais viram desafios na Arena e colegas com clã podem convidar.',
    '4. **Arena e Clãs**: rating no estilo Elo com a chance antes de cada partida; vitórias somam para a meta semanal e o XP do clã.',
    '5. **Feed e XP**: sessões, partidas, clãs e posts aparecem no Feed e rendem XP e conquistas, que voltam para o Passaporte.',
    '',
);

mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/mapa-do-site.md'), lines.join('\n'));
console.log('docs/mapa-do-site.md atualizado.');
