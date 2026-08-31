// js/app.js

const AppController = (() => {
  let dadosTemporarios = [];
  let cabecalhosAtuais = [];
  let consultasSalvas = []; 
  let forcarNovoModelo = false;

  function init() {
    if (typeof MapManager !== 'undefined') {
      MapManager.initMap();
    }

    carregarModelosSalvos();

    // Eventos principais
    document.getElementById('fileInput')?.addEventListener('change', interceptarArquivoCSV);
    document.getElementById('salvarNovoModelo')?.addEventListener('click', salvarNovaConsulta);
    
    document.getElementById('btnNovoModelo')?.addEventListener('click', () => {
      forcarNovoModelo = true;
      document.getElementById('fileInput').click();
    });

    // Botão de Gerenciar Modelos (Modal)
    document.getElementById('btnGerenciarModelos')?.addEventListener('click', abrirModalGerenciar);

    // Evento ao trocar de modelo no select superior
    document.getElementById('tipoRelatorio')?.addEventListener('change', (e) => {
      const index = e.target.value;
      if (index !== "" && consultasSalvas[index] && dadosTemporarios.length > 0) {
        const modelo = consultasSalvas[index];
        processarDados(modelo.camposFiltro, modelo.camposMapa);
      }
    });

    // Eventos dos Filtros Dinâmicos
    const campoDinamicoSelect = document.getElementById('campoDinamicoSelect');
    if (campoDinamicoSelect) {
      campoDinamicoSelect.addEventListener('change', (e) => {
        if (typeof FilterManager !== 'undefined' && dadosTemporarios.length > 0) {
          // Recria os dados limpos atuais para passar pro evento
          const select = document.getElementById('tipoRelatorio');
          const modelo = consultasSalvas[select.value];
          if (modelo) {
            const dadosLimpos = gerarDadosLimpos(modelo.camposFiltro, modelo.camposMapa);
            FilterManager.onCampoDinamicoChange(e, dadosLimpos);
            aplicarFiltrosEPlotar(dadosLimpos);
          }
        }
      });
    }

    const valorDinamicoSelect = document.getElementById('valorDinamicoSelect');
    if (valorDinamicoSelect) {
      valorDinamicoSelect.addEventListener('change', () => {
        const select = document.getElementById('tipoRelatorio');
        const modelo = consultasSalvas[select.value];
        if (modelo) {
          const dadosLimpos = gerarDadosLimpos(modelo.camposFiltro, modelo.camposMapa);
          aplicarFiltrosEPlotar(dadosLimpos);
        }
      });
    }
  }

  function carregarModelosSalvos() {
    const salvos = localStorage.getItem('geo_consultas_salvas');
    const select = document.getElementById('tipoRelatorio');
    
    if (salvos) {
      try {
        consultasSalvas = JSON.parse(salvos);
        if (select && consultasSalvas.length > 0) {
          select.innerHTML = '';
          consultasSalvas.forEach((consulta, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = consulta.nome;
            select.appendChild(opt);
          });
        }
      } catch (e) {
        console.error("Erro ao carregar modelos salvos:", e);
      }
    }
  }

  function interceptarArquivoCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        dadosTemporarios = results.data;
        cabecalhosAtuais = results.meta.fields || [];
        
        if (cabecalhosAtuais.length === 0) {
          return alert("Não foi possível identificar as colunas deste arquivo.");
        }

        const select = document.getElementById('tipoRelatorio');
        
        if (forcarNovoModelo) {
          forcarNovoModelo = false;
          montarOpcoesNoModal();
          return;
        }

        const modeloCompativelIndex = consultasSalvas.findIndex(modelo => {
          const todosCamposModelo = [...new Set([...modelo.camposMapa, ...modelo.camposFiltro])];
          return todosCamposModelo.every(campo => cabecalhosAtuais.includes(campo));
        });

        if (modeloCompativelIndex !== -1) {
          select.value = modeloCompativelIndex;
          const modelo = consultasSalvas[modeloCompativelIndex];
          processarDados(modelo.camposFiltro, modelo.camposMapa);
        } else if (consultasSalvas.length > 0 && select.value !== "") {
          const modeloSelecionado = consultasSalvas[select.value];
          if (modeloSelecionado) {
            processarDados(modeloSelecionado.camposFiltro, modeloSelecionado.camposMapa);
          } else {
            montarOpcoesNoModal();
          }
        } else {
          montarOpcoesNoModal();
        }
      }
    });
  }

  function montarOpcoesNoModal() {
    const container = document.getElementById('mapeamentoCamposContainer');
    if (!container) return;
    
    container.innerHTML = ''; 

    cabecalhosAtuais.forEach(campo => {
      if (/lat|lng|latitude|longitude/i.test(campo)) return;

      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 gap-2 items-center px-2 py-2 border-b border-slate-50 hover:bg-slate-50 transition-colors';
      row.innerHTML = `
        <div class="col-span-6 text-xs font-semibold text-slate-700 truncate" title="${campo}">${campo}</div>
        <div class="col-span-3 flex justify-center">
          <input type="checkbox" class="cb-filtro w-4 h-4 accent-blue-600 cursor-pointer" data-campo="${campo}">
        </div>
        <div class="col-span-3 flex justify-center">
          <input type="checkbox" class="cb-mapa w-4 h-4 accent-emerald-600 cursor-pointer" data-campo="${campo}" checked>
        </div>
      `;
      container.appendChild(row);
    });

    const inputNome = document.getElementById('inputNomeModelo');
    if (inputNome) {
      inputNome.value = `Análise ${consultasSalvas.length + 1}`;
    }

    document.getElementById('modalSchemaBuilder')?.classList.remove('hidden');
  }

  function salvarNovaConsulta() {
    const nomeInput = document.getElementById('inputNomeModelo');
    const nome = nomeInput && nomeInput.value.trim() !== "" ? nomeInput.value : `Modelo ${consultasSalvas.length + 1}`;
    
    const camposFiltro = Array.from(document.querySelectorAll('.cb-filtro:checked')).map(cb => cb.dataset.campo);
    const camposMapa = Array.from(document.querySelectorAll('.cb-mapa:checked')).map(cb => cb.dataset.campo);

    const novaConsulta = { nome, camposFiltro, camposMapa };
    consultasSalvas.push(novaConsulta);

    localStorage.setItem('geo_consultas_salvas', JSON.stringify(consultasSalvas));

    const select = document.getElementById('tipoRelatorio');
    if (select) {
      select.innerHTML = '';
      consultasSalvas.forEach((consulta, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = consulta.nome;
        select.appendChild(opt);
      });
      select.value = consultasSalvas.length - 1;
    }

    document.getElementById('modalSchemaBuilder')?.classList.add('hidden');
    processarDados(camposFiltro, camposMapa);
  }

  function gerarDadosLimpos(camposFiltro, camposMapa) {
    if (!dadosTemporarios || dadosTemporarios.length === 0) return [];

    return dadosTemporarios.map((linha, index) => {
      const latKey = Object.keys(linha).find(k => /lat|latitude/i.test(k));
      const lngKey = Object.keys(linha).find(k => /lng|longitude/i.test(k));
      
      let clienteEnxuto = {
        id: index + 1,
        lat: latKey ? parseFloat(linha[latKey]) : null,
        lng: lngKey ? parseFloat(linha[lngKey]) : null,
        dadosOriginais: {},
        dadosFiltro: {}
      };

      const statusKey = Object.keys(linha).find(k => /status/i.test(k));
      if (statusKey) clienteEnxuto.status = linha[statusKey];

      camposMapa.forEach(c => { if (linha[c] !== undefined) clienteEnxuto.dadosOriginais[c] = linha[c]; });
      camposFiltro.forEach(c => { if (linha[c] !== undefined) clienteEnxuto.dadosFiltro[c] = linha[c]; });

      return clienteEnxuto;
    }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));
  }

  function processarDados(camposFiltro, camposMapa) {
    const dadosLimpos = gerarDadosLimpos(camposFiltro, camposMapa);
    if (dadosLimpos.length === 0) return;

    // 1. Inicializa os filtros dinâmicos com base nos novos dados
    if (typeof FilterManager !== 'undefined') {
      FilterManager.inicializarFiltrosDinamicos(dadosLimpos);
    }

    // 2. Plota tudo no mapa inicialmente
    aplicarFiltrosEPlotar(dadosLimpos);
  }

  function aplicarFiltrosEPlotar(dadosLimpos) {
    let dadosFiltrados = dadosLimpos;
    if (typeof FilterManager !== 'undefined') {
      dadosFiltrados = FilterManager.filtrarDados(dadosLimpos);
    }

    if (typeof MapManager !== 'undefined') {
      MapManager.plotarClientes(dadosFiltrados, true);
    }
  }

  function abrirModalGerenciar() {
    const container = document.getElementById('listaModelosContainer');
    if (!container) return;
    container.innerHTML = '';

    if (consultasSalvas.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-4">Nenhum modelo salvo ainda.</p>';
    } else {
      consultasSalvas.forEach((modelo, index) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-lg';
        item.innerHTML = `
          <span class="text-xs font-bold text-slate-700">${modelo.nome}</span>
          <div class="flex gap-1">
            <button onclick="AppController.excluirModelo(${index})" class="text-rose-500 hover:bg-rose-50 p-1 rounded text-xs font-bold px-2 transition-colors">Excluir</button>
          </div>
        `;
        container.appendChild(item);
      });
    }

    document.getElementById('modalGerenciar')?.classList.remove('hidden');
  }

  function excluirModelo(index) {
    if (confirm("Tem certeza que deseja excluir este modelo salvo?")) {
      consultasSalvas.splice(index, 1);
      localStorage.setItem('geo_consultas_salvas', JSON.stringify(consultasSalvas));
      
      carregarModelosSalvos();
      abrirModalGerenciar(); // Atualiza a lista no modal

      const select = document.getElementById('tipoRelatorio');
      if (consultasSalvas.length === 0 && select) {
        select.innerHTML = '<option value="">Crie ou importe uma consulta...</option>';
      }
    }
  }

  return { init, excluirModelo };
})();

document.addEventListener("DOMContentLoaded", AppController.init);