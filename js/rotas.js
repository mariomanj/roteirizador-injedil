// Otimização da ordem de entregas. A matriz usa o índice 0 para a origem e a rota sempre volta a ela.
const Rotas = (() => {
  const LIMITE_EXATO = 15;
  const EPS = 1e-7;

  function custoCircuito(m, ordem) {
    let total = 0;
    let atual = 0;
    for (const parada of ordem) {
      total += m[atual][parada];
      atual = parada;
    }
    return total + m[atual][0];
  }

  // Programação dinâmica de Held-Karp: garante a rota de menor custo.
  function exato(m) {
    const n = m.length - 1;
    if (n === 0) return [];
    const estados = 1 << n;
    const custo = new Float64Array(estados * n).fill(Infinity);
    const anterior = new Int8Array(estados * n).fill(-1);

    for (let j = 0; j < n; j++) custo[(1 << j) * n + j] = m[0][j + 1];

    for (let visitados = 1; visitados < estados; visitados++) {
      for (let j = 0; j < n; j++) {
        const atual = custo[visitados * n + j];
        if (!(visitados & (1 << j)) || atual === Infinity) continue;
        for (let k = 0; k < n; k++) {
          if (visitados & (1 << k)) continue;
          const proximo = (visitados | (1 << k)) * n + k;
          const novo = atual + m[j + 1][k + 1];
          if (novo < custo[proximo]) {
            custo[proximo] = novo;
            anterior[proximo] = j;
          }
        }
      }
    }

    const todos = estados - 1;
    let ultimo = 0;
    let melhor = Infinity;
    for (let j = 0; j < n; j++) {
      const total = custo[todos * n + j] + m[j + 1][0];
      if (total < melhor) {
        melhor = total;
        ultimo = j;
      }
    }

    const ordem = [];
    for (let visitados = todos, j = ultimo; j !== -1; ) {
      ordem.push(j + 1);
      const antes = anterior[visitados * n + j];
      visitados ^= 1 << j;
      j = antes;
    }
    return ordem.reverse();
  }

  function vizinhoMaisProximo(m) {
    const restantes = new Set(m.keys());
    restantes.delete(0);
    const ordem = [];
    let atual = 0;
    while (restantes.size) {
      let melhor = -1;
      for (const candidato of restantes) {
        if (melhor === -1 || m[atual][candidato] < m[atual][melhor]) melhor = candidato;
      }
      ordem.push(melhor);
      restantes.delete(melhor);
      atual = melhor;
    }
    return ordem;
  }

  // Inverte trechos da rota. As somas acumuladas tornam cada teste O(1), mesmo com ida e volta diferentes.
  function doisOpt(m, t) {
    const n = t.length - 2;
    const ida = new Float64Array(t.length);
    const volta = new Float64Array(t.length);
    const acumular = () => {
      for (let x = 0; x < t.length - 1; x++) {
        ida[x + 1] = ida[x] + m[t[x]][t[x + 1]];
        volta[x + 1] = volta[x] + m[t[x + 1]][t[x]];
      }
    };
    acumular();

    let melhorou = false;
    for (let i = 1; i < n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const antes = m[t[i - 1]][t[i]] + (ida[j] - ida[i]) + m[t[j]][t[j + 1]];
        const depois = m[t[i - 1]][t[j]] + (volta[j] - volta[i]) + m[t[i]][t[j + 1]];
        if (depois - antes < -EPS) {
          for (let a = i, b = j; a < b; a++, b--) [t[a], t[b]] = [t[b], t[a]];
          acumular();
          melhorou = true;
        }
      }
    }
    return melhorou;
  }

  // Move grupos de até 3 cidades vizinhas para outro ponto da rota.
  function orOpt(m, t) {
    const n = t.length - 2;
    let melhorou = false;
    for (let tamanho = 1; tamanho <= Math.min(3, n - 1); tamanho++) {
      for (let i = 1; i <= n - tamanho + 1; i++) {
        const fim = i + tamanho - 1;
        const retirar = m[t[i - 1]][t[i]] + m[t[fim]][t[fim + 1]] - m[t[i - 1]][t[fim + 1]];
        for (let k = 0; k <= n; k++) {
          if (k >= i - 1 && k <= fim) continue;
          const inserir = m[t[k]][t[i]] + m[t[fim]][t[k + 1]] - m[t[k]][t[k + 1]];
          if (inserir - retirar < -EPS) {
            const grupo = t.splice(i, tamanho);
            t.splice(k < i ? k + 1 : k + 1 - tamanho, 0, ...grupo);
            melhorou = true;
            break;
          }
        }
      }
    }
    return melhorou;
  }

  function melhorar(m, ordem) {
    const t = [0, ...ordem, 0];
    let melhorou = true;
    while (melhorou) {
      const a = doisOpt(m, t);
      const b = orOpt(m, t);
      melhorou = a || b;
    }
    return t.slice(1, -1);
  }

  // Busca local iterada, com sorteio fixo para o mesmo pedido sempre dar o mesmo roteiro.
  function heuristica(m, { iteracoes = 1500, tempoMaximo = 2000, semente = 12345 } = {}) {
    let estado = semente >>> 0;
    const sortear = (limite) => {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let z = estado;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) % limite;
    };

    const n = m.length - 1;
    let atual = melhorar(m, vizinhoMaisProximo(m));
    let custoAtual = custoCircuito(m, atual);
    if (n < 4) return atual;

    let melhor = atual;
    let custoMelhor = custoAtual;
    const inicio = performance.now();
    for (let it = 0; it < iteracoes && performance.now() - inicio < tempoMaximo; it++) {
      const a = 1 + sortear(n - 3);
      const b = a + 1 + sortear(n - a - 2);
      const c = b + 1 + sortear(n - b - 1);
      const tentativa = melhorar(m, [...atual.slice(0, a), ...atual.slice(b, c), ...atual.slice(a, b), ...atual.slice(c)]);
      const custo = custoCircuito(m, tentativa);
      if (custo <= custoAtual) {
        atual = tentativa;
        custoAtual = custo;
      }
      if (custo < custoMelhor) {
        melhor = tentativa;
        custoMelhor = custo;
      }
    }
    return melhor;
  }

  function otimizar(m) {
    const garantida = m.length - 1 <= LIMITE_EXATO;
    const ordem = garantida ? exato(m) : heuristica(m);
    return { ordem, custo: custoCircuito(m, ordem), garantida };
  }

  return { LIMITE_EXATO, custoCircuito, exato, heuristica, otimizar };
})();
