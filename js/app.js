// Tela do roteirizador: entrada das cidades, consulta de distâncias e apresentação do roteiro.
(() => {
  const OSRM = "https://router.project-osrm.org";
  const MAXIMO_PARADAS = 99; // A matriz do OSRM aceita 100 pontos, contando a origem.
  const WAYPOINTS_GOOGLE = 9;
  const FATOR_ESTRADA = 1.3;
  const KM_POR_HORA_ESTIMADO = 70;

  const $ = (id) => document.getElementById(id);
  const formulario = $("formulario");
  const campoOrigem = $("origem");
  const listaEntregas = $("lista-entregas");
  const botaoAdicionar = $("adicionar");
  const painelPendencias = $("pendencias");
  const botaoGerar = $("gerar");
  const status = $("status");

  // Escolhas feitas nas dúvidas valem até o texto ser alterado. null significa cidade removida.
  const escolhas = new Map();
  let mapa = null;
  let camadaRota = null;
  let textoRelacao = "";

  const camposEntrega = () => [...listaEntregas.querySelectorAll("input")];

  function aoAlterarCidades() {
    escolhas.clear();
    limparPendencias();
  }

  function renumerarCampos() {
    const itens = [...listaEntregas.children];
    itens.forEach((item, i) => {
      item.querySelector(".ordem-campo").textContent = String(i + 1);
      item.querySelector("input").setAttribute("aria-label", `Cidade ${i + 1}`);
      item.querySelector(".remover").setAttribute("aria-label", `Remover cidade ${i + 1}`);
    });
    botaoAdicionar.disabled = itens.length >= MAXIMO_PARADAS;
  }

  function adicionarCampo(valor = "") {
    const item = document.createElement("li");
    const ordem = document.createElement("span");
    ordem.className = "ordem-campo";
    ordem.setAttribute("aria-hidden", "true");

    const area = document.createElement("div");
    area.className = "campo-cidade";
    const campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = "Digite 3 letras";
    campo.value = valor;
    area.append(campo);

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "secundario remover";
    remover.textContent = "×";
    remover.addEventListener("click", () => removerCampo(item));

    // Uma lista colada em um campo vira um campo para cada cidade.
    campo.addEventListener("paste", (evento) => {
      const itens = Cidades.separarEntrada(evento.clipboardData.getData("text"));
      if (itens.length < 2) return;
      evento.preventDefault();
      if (!campo.value.trim()) campo.value = itens.shift();
      itens.forEach((texto) => adicionarCampo(texto));
      aoAlterarCidades();
      botaoAdicionar.focus();
    });

    item.append(ordem, area, remover);
    listaEntregas.append(item);
    CampoCidade.ativar(campo, { aoAlterar: aoAlterarCidades, aoConcluir: () => botaoAdicionar.focus() });
    renumerarCampos();
    return campo;
  }

  function removerCampo(item) {
    const campo = item.querySelector("input");
    if (campo.value.trim()) aoAlterarCidades();
    if (listaEntregas.children.length === 1) {
      campo.value = "";
      campo.focus();
      return;
    }
    const vizinho = item.nextElementSibling || item.previousElementSibling;
    item.remove();
    renumerarCampos();
    vizinho.querySelector("input").focus();
  }

  const formatarKm = (km) => `${Math.round(km).toLocaleString("pt-BR")} km`;

  function formatarTempo(minutos) {
    const total = Math.round(minutos);
    const horas = Math.floor(total / 60);
    if (!horas) return `${total} min`;
    return total % 60 ? `${horas} h ${total % 60} min` : `${horas} h`;
  }

  function identificarCidades() {
    const origemTexto = campoOrigem.value.trim();
    const textos = camposEntrega().map((campo) => campo.value.trim()).filter(Boolean);
    const primeiroCampo = camposEntrega()[0];
    if (!origemTexto) return { erro: "Informe a cidade de saída.", foco: campoOrigem };
    if (!textos.length) return { erro: "Informe ao menos uma cidade com entrega.", foco: primeiroCampo };

    const pendencias = [];
    const identificar = (texto, ehOrigem) => {
      const chave = Cidades.normalizar(texto);
      if (escolhas.has(chave)) return escolhas.get(chave);
      const r = Cidades.resolver(texto);
      if (r.status === "ok") return r.municipio;
      if (!pendencias.some((p) => p.chave === chave)) pendencias.push({ chave, texto, ehOrigem, ...r });
      return undefined;
    };

    const origem = identificar(origemTexto, true);
    const paradas = [];
    const repetidas = [];
    for (const texto of textos) {
      const municipio = identificar(texto, false);
      if (!municipio) continue;
      if (municipio === origem || paradas.includes(municipio)) repetidas.push(municipio.rotulo);
      else paradas.push(municipio);
    }

    if (pendencias.length) return { pendencias };
    if (!paradas.length) return { erro: "A lista ficou sem cidades diferentes da saída.", foco: primeiroCampo };
    if (paradas.length > MAXIMO_PARADAS) {
      return { erro: `O limite é de ${MAXIMO_PARADAS} cidades por roteiro; a lista tem ${paradas.length}.`, foco: primeiroCampo };
    }
    return { origem, paradas, repetidas };
  }

  function mostrarPendencias(pendencias) {
    painelPendencias.replaceChildren();
    const titulo = document.createElement("p");
    titulo.className = "pendencias-titulo";
    titulo.textContent = "Confirme estas cidades para continuar:";
    painelPendencias.append(titulo);

    for (const pendencia of pendencias) {
      const rotulo = document.createElement("label");
      rotulo.textContent = pendencia.status === "ambiguo"
        ? `“${pendencia.texto}” existe em mais de um estado`
        : `“${pendencia.texto}” não foi encontrada`;

      const seletor = document.createElement("select");
      seletor.dataset.chave = pendencia.chave;
      const vazia = new Option("Escolha…", "");
      seletor.append(vazia);
      pendencia.candidatos.forEach((m, i) => seletor.append(new Option(m.rotulo, String(i))));
      if (!pendencia.ehOrigem) seletor.append(new Option("Remover esta cidade", "remover"));
      if (pendencia.ehOrigem && !pendencia.candidatos.length) seletor.disabled = true;
      seletor.addEventListener("change", () => {
        if (seletor.value === "") return;
        escolhas.set(pendencia.chave, seletor.value === "remover" ? null : pendencia.candidatos[Number(seletor.value)]);
        seletor.classList.remove("faltando");
      });
      rotulo.append(seletor);
      painelPendencias.append(rotulo);
    }
    painelPendencias.hidden = false;
    botaoGerar.textContent = "Confirmar e gerar roteiro";
    painelPendencias.querySelector("select:not(:disabled)")?.focus();
  }

  function limparPendencias() {
    painelPendencias.hidden = true;
    painelPendencias.replaceChildren();
    botaoGerar.textContent = "Gerar roteiro";
  }

  function haversineKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  const coordenadas = (pontos) => pontos.map((p) => `${p.lon},${p.lat}`).join(";");

  async function consultarOsrm(caminho) {
    const resposta = await fetch(`${OSRM}${caminho}`, { signal: AbortSignal.timeout(30000) });
    if (!resposta.ok) throw new Error(`OSRM respondeu ${resposta.status}`);
    const dados = await resposta.json();
    if (dados.code !== "Ok") throw new Error(`OSRM respondeu ${dados.code}`);
    return dados;
  }

  // Quando o serviço falha ou não acha caminho, usa a linha reta com fator de estrada e avisa na tela.
  async function obterMatriz(pontos) {
    const estimarKm = (i, j) => (i === j ? 0 : haversineKm(pontos[i], pontos[j]) * FATOR_ESTRADA);
    let tabela = null;
    try {
      tabela = await consultarOsrm(`/table/v1/driving/${coordenadas(pontos)}?annotations=distance,duration`);
    } catch (erro) {
      console.warn(erro);
    }

    let estimada = !tabela;
    const km = [];
    const minutos = [];
    pontos.forEach((_, i) => {
      km[i] = [];
      minutos[i] = [];
      pontos.forEach((_, j) => {
        const d = tabela?.distances?.[i]?.[j];
        const t = tabela?.durations?.[i]?.[j];
        if (d == null || t == null) {
          estimada = true;
          km[i][j] = estimarKm(i, j);
          minutos[i][j] = (km[i][j] / KM_POR_HORA_ESTIMADO) * 60;
        } else {
          km[i][j] = d / 1000;
          minutos[i][j] = t / 60;
        }
      });
    });
    return { km, minutos, estimada };
  }

  async function obterTrajeto(pontos) {
    try {
      const dados = await consultarOsrm(`/route/v1/driving/${coordenadas(pontos)}?overview=full&geometries=geojson`);
      const rota = dados.routes[0];
      return {
        linha: rota.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        trechos: rota.legs.map((perna) => ({ km: perna.distance / 1000, minutos: perna.duration / 60 })),
      };
    } catch (erro) {
      console.warn(erro);
      return null;
    }
  }

  function linhasGoogleMaps(sequencia) {
    const links = [];
    const passo = WAYPOINTS_GOOGLE + 1;
    for (let inicio = 0; inicio < sequencia.length - 1; inicio += passo) {
      const parte = sequencia.slice(inicio, inicio + passo + 1);
      const nome = (m) => `${m.nome}, ${m.uf}, Brasil`;
      const url = new URL("https://www.google.com/maps/dir/");
      url.searchParams.set("api", "1");
      url.searchParams.set("travelmode", "driving");
      url.searchParams.set("origin", nome(parte[0]));
      url.searchParams.set("destination", nome(parte[parte.length - 1]));
      if (parte.length > 2) url.searchParams.set("waypoints", parte.slice(1, -1).map(nome).join("|"));
      links.push(url.href);
    }
    return links;
  }

  function mostrarAvisos(mensagens) {
    const aviso = $("aviso");
    aviso.replaceChildren(...mensagens.map((texto) => {
      const p = document.createElement("p");
      p.textContent = texto;
      return p;
    }));
    aviso.hidden = !mensagens.length;
  }

  function adicionarLinha(marca, cidade, trecho, acumulado, tempo, classe) {
    const linha = $("linhas").insertRow();
    if (classe) linha.className = classe;
    [marca, cidade, trecho, acumulado, tempo].forEach((valor, i) => {
      const celula = linha.insertCell();
      celula.textContent = valor;
      if (i >= 2) celula.className = "numero";
    });
  }

  function mostrarRoteiro({ origem, sequencia, trechos, garantida, economiaKm, avisos, linhaMapa }) {
    const totalKm = trechos.reduce((soma, t) => soma + t.km, 0);
    const totalMinutos = trechos.reduce((soma, t) => soma + t.minutos, 0);
    const quantidade = sequencia.length - 2;

    $("titulo-roteiro").textContent = `Roteiro saindo de ${origem.rotulo}`;
    $("selo").textContent = garantida ? "Menor distância garantida" : "Melhor rota encontrada";
    $("total-km").textContent = formatarKm(totalKm);
    $("total-tempo").textContent = formatarTempo(totalMinutos);
    $("total-cidades").textContent = String(quantidade);
    $("economia").hidden = economiaKm < 1;
    $("economia").textContent = `${formatarKm(economiaKm)} a menos do que seguir a ordem digitada.`;
    mostrarAvisos(avisos);

    $("linhas").replaceChildren();
    adicionarLinha("Saída", origem.rotulo, "", "", "", "linha-base");
    const relacao = ["Roteiro Injedil", `Saída: ${origem.rotulo}`];
    let acumulado = 0;
    trechos.forEach((trecho, i) => {
      acumulado += trecho.km;
      const ultima = i === trechos.length - 1;
      const cidade = sequencia[i + 1];
      adicionarLinha(ultima ? "Volta" : String(i + 1), cidade.rotulo, formatarKm(trecho.km), formatarKm(acumulado), formatarTempo(trecho.minutos), ultima ? "linha-base" : "");
      relacao.push(ultima
        ? `Retorno: ${cidade.rotulo} (${formatarKm(trecho.km)})`
        : `${i + 1}. ${cidade.rotulo} (${formatarKm(trecho.km)})`);
    });
    relacao.push(`Total: ${formatarKm(totalKm)} | ${formatarTempo(totalMinutos)} ao volante`);
    textoRelacao = relacao.join("\n");

    const links = linhasGoogleMaps(sequencia);
    $("links-mapas").replaceChildren(...links.map((href, i) => {
      const a = document.createElement("a");
      a.className = "botao-link";
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = links.length === 1 ? "Abrir no Google Maps" : `Google Maps: parte ${i + 1} de ${links.length}`;
      return a;
    }));

    $("resultado").hidden = false;
    desenharMapa(sequencia, linhaMapa);
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function desenharMapa(sequencia, linhaMapa) {
    const areaMapa = $("mapa");
    if (typeof L === "undefined") {
      areaMapa.hidden = true;
      return;
    }
    if (!mapa) {
      mapa = L.map(areaMapa);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(mapa);
    }
    mapa.invalidateSize();
    if (camadaRota) camadaRota.remove();
    camadaRota = L.layerGroup().addTo(mapa);

    const linha = L.polyline(linhaMapa || sequencia.map((m) => [m.lat, m.lon]), {
      color: "#1f5f8b",
      weight: 4,
      opacity: 0.85,
      dashArray: linhaMapa ? null : "6 8",
    }).addTo(camadaRota);

    sequencia.slice(0, -1).forEach((m, i) => {
      const icone = L.divIcon({
        className: i === 0 ? "marcador marcador-origem" : "marcador",
        html: i === 0 ? "S" : String(i),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([m.lat, m.lon], { icon: icone, title: m.rotulo, alt: m.rotulo }).addTo(camadaRota);
    });
    mapa.fitBounds(linha.getBounds(), { padding: [32, 32] });
  }

  async function gerar() {
    status.textContent = "";
    status.classList.remove("erro");

    const identificadas = identificarCidades();
    if (identificadas.pendencias) {
      mostrarPendencias(identificadas.pendencias);
      status.textContent = "Escolha uma opção para cada cidade ou corrija o texto.";
      return;
    }
    limparPendencias();
    if (identificadas.erro) {
      status.textContent = identificadas.erro;
      status.classList.add("erro");
      identificadas.foco.focus();
      return;
    }

    const { origem, paradas, repetidas } = identificadas;
    botaoGerar.disabled = true;
    try {
      status.textContent = "Consultando distâncias nas estradas…";
      const pontos = [origem, ...paradas];
      const matriz = await obterMatriz(pontos);

      status.textContent = "Calculando a melhor ordem…";
      await new Promise((continuar) => setTimeout(continuar, 20));
      const { ordem, custo, garantida } = Rotas.otimizar(matriz.km);
      const custoDigitado = Rotas.custoCircuito(matriz.km, paradas.map((_, i) => i + 1));

      status.textContent = "Traçando a rota no mapa…";
      const circuito = [0, ...ordem, 0];
      const sequencia = circuito.map((i) => pontos[i]);
      const trajeto = matriz.estimada ? null : await obterTrajeto(sequencia);
      const trechos = trajeto?.trechos ?? circuito.slice(1).map((destino, i) => ({
        km: matriz.km[circuito[i]][destino],
        minutos: matriz.minutos[circuito[i]][destino],
      }));

      const avisos = [];
      if (matriz.estimada) {
        avisos.push("O serviço de rotas não informou todas as distâncias. Os valores estão estimados pela linha reta e a ordem pode não ser a melhor; tente de novo em alguns minutos.");
      } else if (!trajeto) {
        avisos.push("A ordem usa distâncias reais, mas o desenho da rota não pôde ser carregado: o mapa mostra linhas retas.");
      }
      if (repetidas.length) {
        avisos.push(`Não entraram de novo, por repetirem outra cidade ou a saída: ${[...new Set(repetidas)].join(", ")}.`);
      }

      mostrarRoteiro({
        origem,
        sequencia,
        trechos,
        garantida: garantida && !matriz.estimada,
        economiaKm: custoDigitado - custo,
        avisos,
        linhaMapa: trajeto?.linha ?? null,
      });
      status.textContent = "";
    } catch (erro) {
      console.error(erro);
      status.textContent = "Não foi possível gerar o roteiro. Tente novamente.";
      status.classList.add("erro");
    } finally {
      botaoGerar.disabled = false;
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    gerar();
  });

  CampoCidade.ativar(campoOrigem, {
    aoAlterar: aoAlterarCidades,
    aoConcluir: () => (camposEntrega().find((campo) => !campo.value.trim()) || botaoAdicionar).focus(),
  });

  botaoAdicionar.addEventListener("click", () => adicionarCampo().focus());
  adicionarCampo();

  $("copiar").addEventListener("click", async () => {
    const botao = $("copiar");
    try {
      await navigator.clipboard.writeText(textoRelacao);
      botao.textContent = "Copiado!";
    } catch {
      botao.textContent = "Não foi possível copiar";
    }
    setTimeout(() => { botao.textContent = "Copiar relação"; }, 2000);
  });

  $("imprimir").addEventListener("click", () => window.print());
})();
