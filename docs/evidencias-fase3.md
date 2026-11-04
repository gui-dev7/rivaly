# Evidências da Fase 3: lógica, estruturas de controle, arrays e funções

Onde cada conteúdo da Fase 3 aparece no código da V3, com o raciocínio e o equivalente em Java.
Os números de linha são da tag `v3.0.0`.

## 1. Estrutura de pastas

| Pasta | Responsabilidade | Exemplos |
|---|---|---|
| `js/pages/` | um controlador por página HTML (DOM e eventos) | `squads.js`, `arena.js`, `dashboard.js` |
| `js/core/` | infraestrutura compartilhada | `storage.js`, `rng.js`, `app.js`, `validation.js`, `site-map.js` |
| `js/domain/` | regras de negócio, **sem DOM** (testáveis no Node) | `formulas.js`, `availability.js`, `compatibility.js`, `arena-store.js` |
| `js/ui/` | componentes visuais reutilizáveis | `modal.js`, `agenda-ui.js`, `arena-ui.js`, `cards.js` |

A regra de dependência é a mesma de um projeto Java em camadas: `pages → ui/domain → core`. Nada em `domain/` toca `document`, por isso os testes rodam com `node --test`.

## 2. Operadores relacionais e lógicos

| Onde | Trecho | Raciocínio |
|---|---|---|
| `js/domain/availability.js` `intersect` | `a[r][c] === 1 && b[r][c] === 1 ? 1 : 0` | E lógico célula a célula: livre só se as duas pessoas estão livres. |
| `js/domain/availability.js` `playerAvailability` | `days.length < MIN_PLAYER_DAYS && attempts < 20` | Condição composta do `do-while`: repete enquanto faltar dia **e** houver tentativas. |
| `js/domain/formulas.js` `kFactor` | `matches < 10 ? 40 : 32` | Relacional + ternário: K maior nas 10 primeiras partidas. |
| `js/domain/formulas.js` `bhaskara` | `if (delta < 0)` | Sem raiz real quando Δ < 0. |

No projeto há cerca de 260 linhas com `&&`/`||` e mais de mil comparações (`===`, `!==`, `>=`, `<=`).
**Em Java:** os operadores são os mesmos, mas `==` entre `String` compara referência; para texto usa-se `.equals()`, que é o papel do `===` aqui.

## 3. Estruturas condicionais

| Estrutura | Onde | Raciocínio |
|---|---|---|
| `if / else if / else` encadeado | `js/domain/compatibility.js:232` (chat de voz) | Quatro combinações de "eu quero voz" × "o jogador usa voz", cada uma com uma nota e um motivo diferentes. |
| `if` com retorno antecipado | `js/pages/dashboard.js` `greetingLine()` | Faixas de horário testadas em ordem (madrugada → manhã → tarde → noite); cada `return` encerra a função, o mesmo efeito de um `else if`. |
| `switch / case` | `js/domain/feed-store.js:158` | A aba do Feed é um valor discreto: um `case` por aba (`clan`, `allies`, `rivals`, `arena`) e `default` para "Tudo". Cada `case` termina em `return`, que faz o papel do `break`. |
| ternário encadeado | `js/ui/arena-ui.js` `balanceMarkup()`; `formulas.js` `kFactor` | Escolher a mensagem do bônus de equilíbrio (equilibrada, adversário mais fraco, mais forte) e o K do Elo numa expressão. |

**Em Java:** a sintaxe de `if/else` e `switch` é idêntica. No `switch` do Java, sem `break` (ou `return`) a execução "cai" no `case` seguinte; o Java 14+ também aceita a forma `case X ->`, que não cai. O desafio "Professor Walduino" do capítulo 10 usa exatamente `switch` dentro de uma função, como `feed-store.js`.

## 4. Laços de repetição

| Laço | Onde | Por que este laço |
|---|---|---|
| `for` clássico | `js/domain/availability.js` (`createMatrix`, `sumMatrices`, `intersect`, `countFilled`, `bestSlots`) | Percorrer uma matriz pelo índice da linha e da coluna: o número de voltas é conhecido (7 × 5). |
| `for` aninhado | `sumMatrices`: `for (matriz) → for (linha) → for (coluna)` | Soma de matrizes célula a célula, O(m × 7 × 5). |
| `for…of` | `availability.js` `matrixFrom`, `squadHeatmap` | Percorrer os itens de uma lista sem precisar do índice. |
| `while` | `js/core/rng.js:83` | Sorteio ponderado sem reposição: repete **enquanto** faltarem itens e houver candidatos; o número de voltas não é conhecido antes. |
| `while` | `js/ui/avatar-picker.js:286` | Gera avatares até completar o lote, com um limite de segurança. |
| `do-while` | `js/domain/availability.js:141` | A agenda de um jogador simulado é sorteada **pelo menos uma vez** e o sorteio se repete enquanto der menos de 2 dias. Só dá para testar a condição depois de sortear: é o caso clássico do `do-while`. |

Também há um `while` nos testes (`tests/formulas.test.mjs`): a busca do nível "subindo de um em um" serve de referência para provar que a fórmula de Bhaskara dá o mesmo resultado sem laço.

**Em Java:** `for`, `while` e `do { } while (cond);` têm a mesma sintaxe. O `for…of` do JavaScript equivale ao `for (Tipo x : lista)` do Java.

## 5. Arrays, vetores e matrizes

| Estrutura | Onde | Uso |
|---|---|---|
| Vetor | `js/domain/compatibility.js` `WEIGHTS` + `formulas.js` `weightedSum` | Vetor de 7 pesos × vetor de 7 notas = soma ponderada. |
| Vetor | `js/domain/data.js` `PLAYERS` (33), `ACHIEVEMENTS` (28), `SCHEDULES` (5) | Coleções do domínio. |
| **Matriz 7 × 5** | `js/domain/availability.js` | Agenda da semana: linha = dia, coluna = período. A soma das matrizes do squad vira o mapa de calor; a interseção (E) mostra quando todos estão livres. |
| Ordenação | `bestSlots` (`sort` por valor, depois linha, depois coluna); rankings da Arena | `Array.prototype.sort` com comparador de vários critérios. |
| Busca | `js/core/site-map.js` + `sitemap.js` | Busca sequencial nas páginas do mapa do site (O(n), n pequeno). |

Métodos de array no projeto: `map` 266×, `filter` 129×, `forEach` 96×, `find` 62×, `some` 25×, `sort` 24×, `reduce` 17×.

**Em Java:** um vetor tem tamanho fixo (`int[] v = new int[7]`) e uma matriz é `int[][] m = new int[7][5]`, com `m.length` linhas e `m[0].length` colunas. Em JavaScript o array é dinâmico, então a matriz é um array de arrays criado com dois `for` (`createMatrix`), e `isValidMatrix` confere o formato porque o tipo não é garantido pelo compilador.

## 6. Funções e modularização

| Antes (V2) | Depois (V3) |
|---|---|
| fórmulas de XP dentro de `gamification.js`, do Elo dentro de `arena-store.js` e do nível do clã dentro de `clans-store.js` | todas em `js/domain/formulas.js`, puras e testadas; os módulos antigos reexportam, então nada que importava deles quebrou |
| compatibilidade somava os pontos já arredondados | `weightedSum(pesos, notas)`, uma função genérica |
| 58 arquivos soltos em `js/` | 4 pastas por responsabilidade |

Funções com retorno (`levelFromXp`, `balanceBonus`, `squadHeatmap`) e funções que só causam efeito (`renderAgenda`, equivalentes ao `void` do Java) ficam separadas. **Em Java**, as funções puras de `formulas.js` seriam métodos `public static` de uma classe utilitária `Formulas`.

## 7. Funções de 1º e 2º grau

| Função | Grau | Onde | Para quê |
|---|---|---|---|
| `step(L) = 500L + 500` | 1º | `formulas.js` `xpStepForLevel` | XP para sair do nível L: cada nível custa 500 a mais. |
| `total(L) = 250L² + 250L − 500` | 2º | `formulas.js` `totalXpForLevel` | XP acumulado até o nível L; é a soma dos passos (somar uma reta dá uma parábola). |
| `250L² + 250L − (500 + xp) = 0` | 2º (Bhaskara) | `formulas.js` `levelFromXp` | Nível a partir do XP em tempo constante, sem laço. |
| `xp(N) = 120(N − 1)²` | 2º | `formulas.js` `clanXpForLevel` | XP do clã por nível. |
| `ΔR = K(S − E)` | 1º em S | `formulas.js` `ratingDelta` | Variação do rating na Arena. |
| `P = 3V + 1D` | 1º | `formulas.js` `seasonPoints` | Pontos da temporada. |
| `Σ pesoᵢ × notaᵢ` | 1º em cada nota | `formulas.js` `weightedSum` | Compatibilidade de 0 a 100. |
| `B(p) = 40 · 4p(1 − p)` | 2º, vértice em p = 0,5 | `formulas.js` `balanceBonus` | **Novo na V3.** Bônus de XP da Arena: partidas equilibradas valem mais; atropelar quem é mais fraco não rende extra. |
| `E = 1 / (1 + 10^((Rb − Ra)/400))` | logística | `formulas.js` `expectedScore` | Chance de vitória. Não é polinômio; serve de contraste. |

**Preços:** a RIVALY não vende nada, então não há função de preço, custo ou ponto de equilíbrio. Se um dia houver um plano pago, o custo por usuário seria de 1º grau (custo fixo de infraestrutura + custo por usuário), e o ponto de equilíbrio sairia do cruzamento de duas retas, como no capítulo 7.

Testes: `tests/formulas.test.mjs` (8) e `tests/availability.test.mjs` (7).

## 8. Eficiência

- `levelFromXp` é O(1): resolve a equação de 2º grau em vez de subir nível por nível (O(n)).
- `sumMatrices` é O(m × 7 × 5) para m pessoas; com no máximo 5 pessoas, são 175 somas.
- A busca do mapa do site é sequencial (pior caso n, caso médio (n + 1)/2); com 14 páginas e 40 seções, um índice ou busca binária não compensaria.
