# Roteirizador Injedil

Site para montar o roteiro de entregas: você informa a cidade de saída e as cidades com entrega, e ele devolve a melhor ordem de visita, com a volta à origem.

**Acesse:** https://mariomanj.github.io/roteirizador-injedil/

## Como usar

1. Digite a **cidade de saída**.
2. Em **cidades com entrega**, digite 3 letras em cada campo e escolha a cidade na lista. Use **+ Adicionar cidade** para abrir outro campo e **×** para remover. Se tiver uma lista pronta, cole em um campo: cada cidade ganha o seu.
3. Clique em **Gerar roteiro**. Se uma cidade digitada sem escolher na lista existir em mais de um estado ou não for encontrada, o site pede para você confirmar.
4. Use a relação de cidades, com os km e o tempo de cada trecho. Dá para copiar, imprimir ou abrir no Google Maps.

Cada roteiro aceita até 99 cidades, além da saída.

## Como a rota é escolhida

O critério é a **menor distância total** em km, contando a volta.

| Cidades de entrega | Método | Resultado na tela |
| --- | --- | --- |
| Até 15 | Compara todas as ordens possíveis (Held-Karp) | Menor distância garantida |
| De 16 a 99 | Busca local iterada (2-opt e Or-opt) | Melhor rota encontrada, muito boa, mas sem garantia de ser a menor possível |

## Limitações

- Distâncias e tempos são calculados **para carro**, de centro a centro de cada cidade. Não consideram restrições para caminhões, pedágios, paradas ou trânsito. Confira o trajeto antes de sair.
- O roteiro é para um veículo por vez, sem capacidade de carga, horários de entrega ou prioridades.
- As distâncias vêm do servidor público de demonstração do [OSRM](https://project-osrm.org/), que não tem garantia de disponibilidade. Se ele falhar, o site avisa e usa uma estimativa pela linha reta. Para uso intenso, o ideal é trocar por um serviço próprio ou contratado (constante `OSRM` em `js/app.js`).
- O texto digitado não é salvo em lugar nenhum. As coordenadas das cidades são enviadas ao OSRM para calcular a rota. O Google só as recebe se você clicar no link do Google Maps.

## Para desenvolver

É um site estático, sem etapa de compilação. Para rodar no computador:

```
python -m http.server 8000
```

Depois, abra `http://localhost:8000`. Os testes ficam em `http://localhost:8000/testes.html`.

| Caminho | Conteúdo |
| --- | --- |
| `js/rotas.js` | Otimização da ordem das cidades |
| `js/cidades.js` | Busca, leitura de listas e identificação dos municípios |
| `js/campo-cidade.js` | Campo de cidade com sugestões |
| `js/app.js` | Tela, consulta de distâncias e mapa |
| `dados/municipios.js` | Municípios, gerados por `ferramentas/gerar_municipios.py` |

## Créditos

- Municípios: [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) (licença MIT)
- Rotas: [OSRM](https://project-osrm.org/)
- Mapa: [Leaflet](https://leafletjs.com/) e © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright)
