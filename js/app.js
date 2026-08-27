// js/app.js

document.addEventListener('DOMContentLoaded', () => {
  MapManager.initMap();

  let todosClientes = [];
  const fileInput = document.getElementById('csvFileInput');
  const btnReset = document.getElementById('btnResetView');
  const yearFilter = document.getElementById('yearFilter');
  const statusFilter = document.getElementById('statusFilter');

  // Popula o <select> com o intervalo de anos encontrado
  function atualizarFiltroAnos(clientes) {
    const anos = clientes
      .map(c => c.ano)
      .filter((ano, index, self) => ano && self.indexOf(ano) === index)
      .sort((a, b) => a - b);

    yearFilter.innerHTML = '<option value="todos">Todos os Anos</option>';

    if (anos.length > 0) {
      anos.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = `Ano ${ano}`;
        yearFilter.appendChild(option);
      });
      yearFilter.disabled = false;
      statusFilter.disabled = false; // Libera o filtro de status também
    } else {
      yearFilter.disabled = true;
      statusFilter.disabled = true;
    }
  }

  // NOVA FUNÇÃO: Aplica todos os filtros simultaneamente
  function aplicarFiltros() {
    const anoSelecionado = yearFilter.value;
    const statusSelecionado = statusFilter.value;

    const clientesFiltrados = todosClientes.filter(cliente => {
      // Regra 1: Passa no filtro de Ano?
      const passaAno = (anoSelecionado === 'todos') || (cliente.ano == anoSelecionado);
      
      // Regra 2: Passa no filtro de Status?
      const passaStatus = (statusSelecionado === 'todos') || (cliente.categoriaStatus === statusSelecionado);
      
      // Só retorna para o mapa se passar nas duas regras juntas
      return passaAno && passaStatus;
    });

    MapManager.plotarClientes(clientesFiltrados, false);
  }

  // Leitura do arquivo CSV via Worker
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: function(results) {
        todosClientes = DataProcessor.formatarClientes(results.data);
        
        // Configura as opções do filtro
        atualizarFiltroAnos(todosClientes);
        
        // Renderiza aplicando os filtros padrão (Todos e Todos)
        aplicarFiltros();
      }
    });
  });

  // Escutadores de eventos: se mudar qualquer um dos filtros, recalcula tudo
  yearFilter.addEventListener('change', aplicarFiltros);
  statusFilter.addEventListener('change', aplicarFiltros);

  if (btnReset) {
    btnReset.addEventListener('click', () => MapManager.resetarVisaoPadrao());
  }
});