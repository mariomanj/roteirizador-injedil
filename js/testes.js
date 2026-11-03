// Testes rodados por testes.html; o resultado aparece na página.
(() => {
  const falhas = [];
  let total = 0;
  const verificar = (nome, condicao, detalhe = "") => {
    total++;
    if (!condicao) falhas.push(`${nome} ${detalhe}`);
  };

  let semente = 42;
  const sortear = () => (semente = (semente * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const matrizAleatoria = (n, simetrica) => {
    const m = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        m[i][j] = simetrica && j < i ? m[j][i] : 1 + sortear() * 1000;
      }
    }
    return m;
  };
  const matrizMapa = (n) => {
    const p = Array.from({ length: n }, () => [sortear() * 2000, sortear() * 2000]);
    return p.map((a) => p.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * (1 + (a[0] > b[0] ? 0.01 : 0))));
  };
  const forcaBruta = (m) => {
    let melhor = Infinity;
    const permutar = (resto, atual) => {
      if (!resto.length) melhor = Math.min(melhor, Rotas.custoCircuito(m, atual));
      resto.forEach((x, i) => permutar(resto.filter((_, k) => k !== i), [...atual, x]));
    };
    permutar([...m.keys()].slice(1), []);
    return melhor;
  };
  const visitaTodas = (ordem, n) => ordem.length === n && new Set(ordem).size === n && ordem.every((x) => x >= 1 && x <= n);

  for (let n = 2; n <= 9; n++) {
    for (const simetrica of [true, false]) {
      const m = matrizAleatoria(n, simetrica);
      const ordem = Rotas.exato(m);
      verificar(`exato visita todas n=${n}`, visitaTodas(ordem, n - 1));
      verificar(`exato igual força bruta n=${n}`, Math.abs(Rotas.custoCircuito(m, ordem) - forcaBruta(m)) < 1e-6);
    }
  }
  verificar("sem paradas", Rotas.otimizar([[0]]).ordem.length === 0);
  verificar("uma parada", Rotas.otimizar([[0, 5], [7, 0]]).custo === 12);

  let piorDiferenca = 0;
  for (let i = 0; i < 40; i++) {
    const m = matrizMapa(6 + (i % 10));
    const otimo = Rotas.custoCircuito(m, Rotas.exato(m));
    const ordem = Rotas.heuristica(m);
    const custo = Rotas.custoCircuito(m, ordem);
    verificar("heurística visita todas", visitaTodas(ordem, m.length - 1));
    verificar("heurística não supera o ótimo", custo >= otimo - 1e-6);
    piorDiferenca = Math.max(piorDiferenca, custo / otimo - 1);
  }
  verificar("heurística perto do ótimo", piorDiferenca < 0.01, `pior=${(piorDiferenca * 100).toFixed(2)}%`);

  const mQuinze = matrizMapa(16);
  const t0 = performance.now();
  const quinze = Rotas.otimizar(mQuinze);
  const tempoExato = performance.now() - t0;
  verificar("15 paradas é exato", quinze.garantida && visitaTodas(quinze.ordem, 15));

  const mGrande = matrizMapa(100);
  const t1 = performance.now();
  const grande = Rotas.otimizar(mGrande);
  const tempoGrande = performance.now() - t1;
  verificar("99 paradas visita todas", !grande.garantida && visitaTodas(grande.ordem, 99));
  verificar("99 paradas dentro do tempo", tempoGrande < 3000, `${tempoGrande | 0} ms`);
  const fixa = matrizMapa(40);
  const opcoes = { tempoMaximo: 1e9, iteracoes: 200 };
  verificar("mesmo pedido, mesma rota", Rotas.heuristica(fixa, opcoes).join() === Rotas.heuristica(fixa, opcoes).join());

  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  verificar("separa linhas", igual(Cidades.separarEntrada("Bauru\nMarília\r\n\nJaú"), ["Bauru", "Marília", "Jaú"]));
  verificar("separa vírgulas com UF", igual(Cidades.separarEntrada("Bauru, SP, Marília, Jaú, sp"), ["Bauru - SP", "Marília", "Jaú - SP"]));
  verificar("lista numerada", igual(Cidades.separarEntrada("1. Bauru\n2) Jaú\n- Lins\n• Tupã"), ["Bauru", "Jaú", "Lins", "Tupã"]));
  verificar("não corta hífen do nome", igual(Cidades.separarEntrada("Embu-Guaçu"), ["Embu-Guaçu"]));

  const rotulo = (texto) => {
    const r = Cidades.resolver(texto);
    return r.status === "ok" ? r.municipio.rotulo : r.status;
  };
  for (const [texto, esperado] of [
    ["Bauru - SP", "Bauru - SP"], ["bauru/sp", "Bauru - SP"], ["BAURU SP", "Bauru - SP"], ["Bauru\tSP", "Bauru - SP"],
    ["Bauru (SP)", "Bauru - SP"], ["marilia", "Marília - SP"], ["Brasilia", "Brasília - DF"], ["sao paulo", "São Paulo - SP"],
    ["Embu Guacu", "Embu-Guaçu - SP"], ["Bom Jesus", "ambiguo"], ["Bom Jesus - PI", "Bom Jesus - PI"],
    ["Bauru - RJ", "nao_encontrado"], ["Cidade Que Nao Existe", "nao_encontrado"],
  ]) {
    verificar(`resolver "${texto}"`, rotulo(texto) === esperado, `obtido=${rotulo(texto)}`);
  }
  verificar("todo rótulo volta ao município", Cidades.lista.every((m) => {
    const r = Cidades.resolver(m.rotulo);
    return r.status === "ok" && r.municipio === m;
  }));
  verificar("sugere Marília", Cidades.resolver("Marilha").candidatos.some((m) => m.rotulo === "Marília - SP"));
  verificar("Bauru-RJ sugere o certo", Cidades.resolver("Bauru - RJ").candidatos[0].rotulo === "Bauru - SP");

  const buscados = (texto) => Cidades.buscar(texto).map((m) => m.rotulo);
  verificar("busca exige 3 letras", buscados("ma").length === 0 && buscados("mar").length > 0);
  verificar("busca ignora acento", buscados("mar").includes("Marília - SP") && buscados("JAÚ")[0] === "Jaú - SP");
  verificar("busca começa pelo prefixo", buscados("bau")[0].startsWith("Bau"));
  verificar("busca por outra palavra", buscados("paulo").includes("São Paulo - SP"));
  verificar("busca por trecho", buscados("rilia").includes("Marília - SP"));
  verificar("busca com UF", buscados("bauru sp")[0] === "Bauru - SP" && buscados("sao jose sp").every((r) => r.endsWith(" - SP")));
  verificar("busca sem resultado", buscados("xyzw").length === 0);
  verificar("toda cidade aparece com 3 letras", Cidades.lista.every((m) => {
    const inicio = m.nome.slice(0, 3);
    return Cidades.normalizar(inicio).length < Cidades.MINIMO_BUSCA || Cidades.buscar(inicio).includes(m);
  }));

  const saida = document.getElementById("resultado");
  saida.textContent = falhas.length
    ? `FALHOU ${falhas.length}/${total}\n${falhas.join("\n")}`
    : `OK ${total}/${total} | heurística pior ${(piorDiferenca * 100).toFixed(2)}% | exato 15: ${tempoExato | 0} ms | 99 paradas: ${tempoGrande | 0} ms`;
})();
