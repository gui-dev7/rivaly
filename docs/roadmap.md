# Roteiro da RIVALY

O que já existe, o que a V2 e a V3 entregaram e o que continua no futuro. As fases estão ordenadas por dependência técnica: quase tudo o que falta depende de um backend.

## Entregue na V2 (comunidade simulada)

A V2 trouxe a camada social, **sem backend**. Os outros jogadores são perfis semeados e o comportamento deles sai de um motor determinístico que explica cada decisão (`js/domain/community.js`).

- [x] Sessão de squad: escolher de 2 a 4 jogadores ou sortear, com o placar e a conta do resultado.
- [x] Pós-partida: Aliado, Rival ou Neutro, elogios e ações contextuais.
- [x] Arena: duelo, squad e Clã vs Clã, rating no estilo Elo, temporada semanal, ranking e histórico.
- [x] Clãs: explorar com compatibilidade, entrar, candidatar-se, criar, gerenciar elenco e meta semanal.
- [x] Feed: posts, reações (GG, Respeito, Rivalidade), comentários e abas por clã, aliados, rivais e Arena.
- [x] Centro de convites: convites de clã, respostas de candidatura e desafios.
- [x] Bootstrap 5.3 local como infraestrutura visual, mapa do site, página 404 e CSP.

## Entregue na V3 (organização, matemática e agenda)

- [x] `js/` em pastas por responsabilidade (`pages`, `core`, `domain`, `ui`).
- [x] `formulas.js`: funções de 1º e 2º grau, Bhaskara e bônus de equilíbrio da Arena, com testes.
- [x] Agenda da semana: matriz 7 × 5, mapa de calor do squad e melhor horário.
- [x] Início com o nível em destaque (HUD).

## Fase 1: fundação técnica, dados e autenticação

- [ ] Backend com contas reais, amigos e mensagens.
- [ ] Banco de dados para usuários, perfis, conquistas, XP e progresso.
- [ ] Login com Google ou Microsoft (OAuth).
- [ ] APIs próprias para arte de jogos (hoje a Steam CDN é consumida direto) e para um chatbot.

## Fase 2: perfis e conexões sociais reais

- [ ] Edição completa do perfil: background, jogo favorito, posição favorita e outras preferências.
- [ ] Música do perfil e links de canais e redes sociais.
- [ ] Ver o perfil de outras pessoas reais, com amigos e jogos em comum.
- [ ] Lista de amigos de verdade (hoje: aliados simulados).
- [ ] Feedback entre amigos sobre jogo, função e o porquê (hoje: elogios no pós-partida simulado).

## Fase 3: comunicação e tempo real (multiplayer real)

- [ ] Infraestrutura em tempo real.
- [ ] Status ao vivo: qual jogo a pessoa está jogando e há quanto tempo.
- [ ] Lobby ao vivo entre amigos.
- [ ] Chat em tempo real com tradução automática.
- [ ] Arena, clãs e Feed com outras pessoas reais, sincronizados entre dispositivos.

## Fase 4: conteúdo e avaliações

- [ ] Clipes de jogadas no Feed.
- [ ] Divisão do conteúdo em Feed, Highlights e conteúdo cômico.
- [ ] Avaliações de jogos no estilo Letterboxd.

## Fase 5: integrações com plataformas

- [ ] Sincronização de biblioteca com Steam, PlayStation e Xbox.
- [ ] Contas Riot, Epic, EA, Discord e Twitch.

## Fase 6: internacionalização e suporte inteligente

- [ ] Outros idiomas na plataforma.
- [ ] IA contextual: recomendações que leem o Passaporte e sugerem o próximo jogo.
- [ ] Pesos da compatibilidade aprendidos (aprendizado supervisionado) a partir das avaliações pós-partida: hoje os 7 pesos são fixos; com jogadores reais, "Aliado" e "Rival" viram rótulos para ajustar os pesos.
- [ ] Moderação de texto no Feed com processamento de linguagem natural, sempre com revisão humana.
- [ ] Chatbot de dúvidas.
