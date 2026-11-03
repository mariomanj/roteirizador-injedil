// Leitura do texto digitado e identificação dos municípios.
const Cidades = (() => {
  const UFS = new Set("AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" "));

  const lista = MUNICIPIOS.map(([nome, uf, lat, lon]) => ({ nome, uf, lat, lon, rotulo: `${nome} - ${uf}` }));

  function normalizar(texto) {
    return texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’`´]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const porNome = new Map();
  for (const municipio of lista) {
    const chave = normalizar(municipio.nome);
    municipio.chave = chave;
    if (!porNome.has(chave)) porNome.set(chave, []);
    porNome.get(chave).push(municipio);
  }

  // Aceita uma cidade por linha, ";" ou vírgulas, além de listas numeradas e colunas coladas de planilhas.
  function separarEntrada(texto) {
    const itens = [];
    for (const linha of texto.split(/[\r\n;]+/)) {
      const daLinha = [];
      for (const bruto of linha.split(",")) {
        const parte = bruto.replace(/^\s*(?:\d+\s*[.)\-]\s*|[-•*]\s*)?/, "").trim();
        if (!parte) continue;
        if (daLinha.length && UFS.has(parte.toUpperCase())) {
          daLinha[daLinha.length - 1] += ` - ${parte.toUpperCase()}`;
        } else {
          daLinha.push(parte);
        }
      }
      itens.push(...daLinha);
    }
    return itens;
  }

  function distanciaEdicao(a, b) {
    let linha = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const nova = [i];
      for (let j = 1; j <= b.length; j++) {
        nova[j] = Math.min(linha[j] + 1, nova[j - 1] + 1, linha[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      linha = nova;
    }
    return linha[b.length];
  }

  function sugerir(chave, uf) {
    const limite = Math.max(2, Math.floor(chave.length / 4));
    return lista
      .filter((m) => Math.abs(m.chave.length - chave.length) <= limite)
      .map((m) => ({ m, d: distanciaEdicao(chave, m.chave) + (uf && m.uf !== uf ? 0.5 : 0) }))
      .filter(({ d }) => d <= limite + 0.5)
      .sort((a, b) => a.d - b.d || a.m.rotulo.localeCompare(b.m.rotulo, "pt-BR"))
      .slice(0, 6)
      .map(({ m }) => m);
  }

  // Nunca corrige por conta própria: dúvidas voltam como "ambiguo" ou "nao_encontrado" para a pessoa escolher.
  function resolver(texto) {
    const chave = normalizar(texto);
    const iguais = porNome.get(chave);
    if (iguais) {
      return iguais.length === 1
        ? { status: "ok", municipio: iguais[0] }
        : { status: "ambiguo", candidatos: iguais };
    }

    const comUf = chave.match(/^(.+) ([a-z]{2})$/);
    const uf = comUf && UFS.has(comUf[2].toUpperCase()) ? comUf[2].toUpperCase() : null;
    if (uf) {
      const mesmoNome = porNome.get(comUf[1]) || [];
      const municipio = mesmoNome.find((m) => m.uf === uf);
      if (municipio) return { status: "ok", municipio };
      if (mesmoNome.length) return { status: "nao_encontrado", candidatos: mesmoNome };
    }
    return { status: "nao_encontrado", candidatos: sugerir(uf ? comUf[1] : chave, uf) };
  }

  return { lista, normalizar, separarEntrada, resolver };
})();
