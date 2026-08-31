// js/filters.js - Versão Otimizada e Dinâmica para Schemas

const FilterManager = (() => {
  let camposFiltroDisponiveis = [];

  function inicializarFiltrosDinamicos(clientes) {
    if (!clientes || clientes.length === 0) return;

    // 1. Coleta todas as chaves dinâmicas disponíveis nos dados filtrados/enxutos
    const chavesSet = new Set();
    clientes.forEach(c => {
      if (c.dadosFiltro) {
        Object.keys(c.dadosFiltro).forEach(k => chavesSet.add(k));
      }
    });
    camposFiltroDisponiveis = Array.from(chavesSet);

    // 2. Popula o Select de Campos Dinâmicos com base no que o usuário marcou no modal
    const campoSelect = document.getElementById("campoDinamicoSelect");
    if (!campoSelect) return;

    campoSelect.innerHTML = '<option value="">Filtrar por campo...</option>';

    camposFiltroDisponiveis.forEach(coluna => {
      const option = document.createElement("option");
      option.value = coluna;
      option.textContent = coluna;
      campoSelect.appendChild(option);
    });

    resetarValorDinamico();
  }

  function resetarValorDinamico() {
    const valorSelect = document.getElementById("valorDinamicoSelect");
    if (!valorSelect) return;
    valorSelect.innerHTML = '<option value="todos">Selecione o campo primeiro</option>';
    valorSelect.disabled = true;
    valorSelect.className = "bg-slate-100 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium outline-none text-slate-400 cursor-not-allowed";
  }

  function onCampoDinamicoChange(e, clientes) {
    const campoEscolhido = e.target.value;
    const valorSelect = document.getElementById("valorDinamicoSelect");

    if (!campoEscolhido || !valorSelect) {
      resetarValorDinamico();
      return;
    }

    // Extrai valores únicos presentes na propriedade dadosFiltro dos clientes
    const valoresUnicos = [...new Set(clientes.map(c => c.dadosFiltro ? c.dadosFiltro[campoEscolhido] : undefined))]
      .filter(v => v !== null && v !== undefined && v.toString().trim() !== "")
      .sort((a, b) => a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' }));

    valorSelect.innerHTML = '<option value="todos">Todos os valores</option>';

    if (valoresUnicos.length > 0) {
      valoresUnicos.forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        valorSelect.appendChild(option);
      });
      valorSelect.disabled = false;
      valorSelect.className = "bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium outline-none text-slate-800 cursor-pointer";
    } else {
      resetarValorDinamico();
    }
  }

  function filtrarDados(todosClientes) {
    const campoSelect = document.getElementById("campoDinamicoSelect");
    const valorSelect = document.getElementById("valorDinamicoSelect");

    const campoEscolhido = campoSelect ? campoSelect.value : "";
    const valorEscolhido = valorSelect ? valorSelect.value : "todos";

    return todosClientes.filter((cliente) => {
      let bateCampoDinamico = true;
      
      if (campoEscolhido && valorEscolhido !== "todos" && cliente.dadosFiltro) {
        const valorNaLinha = cliente.dadosFiltro[campoEscolhido];
        bateCampoDinamico = valorNaLinha !== undefined && valorNaLinha.toString() === valorEscolhido.toString();
      }

      return bateCampoDinamico;
    });
  }

  return {
    inicializarFiltrosDinamicos,
    onCampoDinamicoChange,
    filtrarDados
  };
})();