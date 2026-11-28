<!-- Registra a origem e a geometria da arte da Vuvu para preservar a personagem; consumido pela manutenção do player web. -->

# Arte da Vuvu

`spritesheet.png` é uma cópia sem alteração de pixels de `final/spritesheet-extended.png`, fornecida pelo responsável em `output/visual-agent-ai/Vuvu-Animada.zip`.

- PNG RGBA transparente, 1536 × 2288, 1.893.688 bytes.
- SHA-256: `b39a95177f8df53c072846d23654a5b029dad35a21632b0df08e9abb9e4af734`.
- Grade 8 × 11; células de 192 × 208.
- Linhas 0–8: repouso (6), direita (8), esquerda (8), aceno (4), salto (5), problema (8), espera (6), pensamento (6) e resposta (6).
- Linhas 9–10: 16 olhares, em passos de 22,5°, no sentido horário a partir do alto.

O player usa somente quadros válidos. A animação é uma reprodução do atlas fornecido, não uma geração 3D ao vivo. Timers e listeners são interrompidos em pausa, movimento reduzido, aba oculta e desmontagem. Nenhum serviço externo recebe eventos do cursor. ZIP, prompts de geração e demais arquivos de trabalho ficam fora da entrega.

## Six seven — 2026-11-16

`six-seven.png` preserva sem alteração os pixels de `final/spritesheet.png` do arquivo fornecido `Vuvu-Six-Seven-Original.zip`.

- PNG RGBA, 2048 × 1024, 1.884.533 bytes; grade 4 × 2, células 512 × 512.
- SHA-256: `265e90dea0a6f4b8885c0c7506fe7c7a21a159f2c9533b2a0568f6463b630565`.
- Oito poses, três ciclos, 120 ms por quadro: 2.880 ms em cada interação explícita.
- Disparo escolhido pelo usuário: duplo clique na personagem; alternativa por Shift+Enter. Não abre o chat nem envia uma pergunta. Não se repete automaticamente.

Usamos o atlas estático em vez do APNG/GIF de repetição infinita, para respeitar movimento reduzido, aba oculta e modais. Arrastar usa a linha 6 do atlas original; a dança permanece separada. Repouso não agenda um loop e a personagem não passeia nem flutua sozinha. As restrições contextuais substituem o controle manual de pausa, removido a pedido do usuário.
