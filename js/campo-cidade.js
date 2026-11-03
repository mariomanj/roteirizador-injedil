// Campo de cidade com lista de sugestões, usado na saída e em cada entrega.
const CampoCidade = (() => {
  const LIMITE_SUGESTOES = 30;
  let contador = 0;

  function ativar(campo, { aoAlterar, aoConcluir }) {
    const id = `sugestoes-${++contador}`;
    const lista = document.createElement("ul");
    lista.id = id;
    lista.className = "sugestoes";
    lista.setAttribute("role", "listbox");
    lista.hidden = true;
    campo.parentElement.append(lista);

    campo.setAttribute("role", "combobox");
    campo.setAttribute("aria-autocomplete", "list");
    campo.setAttribute("aria-controls", id);
    campo.setAttribute("aria-expanded", "false");
    campo.autocomplete = "off";
    campo.spellcheck = false;

    let resultados = [];
    let ativo = -1;

    function fechar() {
      lista.hidden = true;
      lista.replaceChildren();
      resultados = [];
      ativo = -1;
      campo.setAttribute("aria-expanded", "false");
      campo.removeAttribute("aria-activedescendant");
    }

    function destacar(indice) {
      lista.querySelector(".ativa")?.classList.remove("ativa");
      ativo = indice;
      const opcao = lista.querySelector(`[data-indice="${indice}"]`);
      if (!opcao) return;
      opcao.classList.add("ativa");
      opcao.scrollIntoView({ block: "nearest" });
      campo.setAttribute("aria-activedescendant", opcao.id);
    }

    function adicionarNota(texto) {
      const nota = document.createElement("li");
      nota.className = "sugestoes-nota";
      nota.setAttribute("role", "option");
      nota.setAttribute("aria-disabled", "true");
      nota.textContent = texto;
      lista.append(nota);
    }

    function atualizar() {
      fechar();
      if (Cidades.normalizar(campo.value).length < Cidades.MINIMO_BUSCA) return;

      const encontrados = Cidades.buscar(campo.value);
      resultados = encontrados.slice(0, LIMITE_SUGESTOES);
      resultados.forEach((municipio, i) => {
        const opcao = document.createElement("li");
        opcao.id = `${id}-${i}`;
        opcao.dataset.indice = String(i);
        opcao.setAttribute("role", "option");
        opcao.textContent = municipio.rotulo;
        lista.append(opcao);
      });
      if (!encontrados.length) adicionarNota("Nenhuma cidade encontrada");
      if (encontrados.length > resultados.length) {
        adicionarNota(`Mais ${encontrados.length - resultados.length}: continue digitando`);
      }

      lista.hidden = false;
      campo.setAttribute("aria-expanded", "true");
      if (resultados.length) destacar(0);
    }

    function escolher(municipio) {
      campo.value = municipio.rotulo;
      fechar();
      aoAlterar();
      aoConcluir();
    }

    campo.addEventListener("input", () => {
      aoAlterar();
      atualizar();
    });
    campo.addEventListener("blur", fechar);

    // Sem isso, clicar na lista tira o foco do campo e a fecha antes de a escolha acontecer.
    lista.addEventListener("mousedown", (evento) => evento.preventDefault());
    lista.addEventListener("click", (evento) => {
      const opcao = evento.target.closest("[data-indice]");
      if (opcao) escolher(resultados[Number(opcao.dataset.indice)]);
    });

    campo.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter") {
        evento.preventDefault();
        if (resultados[ativo]) escolher(resultados[ativo]);
        else if (campo.value.trim()) aoConcluir();
      } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        evento.preventDefault();
        if (lista.hidden) atualizar();
        if (!resultados.length) return;
        const passo = evento.key === "ArrowDown" ? 1 : -1;
        destacar((ativo + passo + resultados.length) % resultados.length);
      } else if (evento.key === "Escape") {
        fechar();
      }
    });
  }

  return { ativar };
})();
