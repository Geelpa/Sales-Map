// js/map.js

const MapManager = (() => {
  let map = null;
  let markersCluster = null;
  let ultimosClientes = []; 

  function initMap() {
    if (map) return;
    
    map = L.map("map").setView([-14.235, -51.925], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    configurarModalCluster();
    criarCluster(80, 16);
    configurarControlesSliders();
  }

  function criarCluster(radius, zoomOff) {
    if (markersCluster) {
      map.removeLayer(markersCluster);
    }

    markersCluster = L.markerClusterGroup({
      maxClusterRadius: radius,
      disableClusteringAtZoom: zoomOff,
      zoomToBoundsOnClick: false, // <-- UX: Desliga o zoom automático ao clicar no cluster
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        
        let bgClass = 'bg-slate-700';
        let sizeClass = 'w-10 h-10 text-sm';
        
        if (count > 50) { bgClass = 'bg-blue-600'; sizeClass = 'w-12 h-12 text-base'; }
        if (count > 150) { bgClass = 'bg-indigo-800'; sizeClass = 'w-14 h-14 text-lg'; }

        return L.divIcon({
          html: `<div class="${bgClass} text-white font-bold rounded-full ${sizeClass} flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer" title="Clique para ver os itens">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: null 
        });
      }
    });

    // --- UX: Evento de clique no cluster para abrir o MODAL ---
    markersCluster.on('clusterclick', function (a) {
      const childMarkers = a.layer.getAllChildMarkers();
      const clientesNoCluster = childMarkers.map(marker => marker.clienteData);
      abrirModalCluster(clientesNoCluster);
    });

    map.addLayer(markersCluster);
  }

  function configurarControlesSliders() {
    const radiusRange = document.getElementById("radiusRange");
    const radiusVal = document.getElementById("radiusVal");
    const zoomRange = document.getElementById("zoomRange");
    const zoomVal = document.getElementById("zoomVal");

    if (radiusRange && radiusVal) {
      radiusRange.addEventListener("input", (e) => {
        radiusVal.textContent = e.target.value;
      });
      radiusRange.addEventListener("change", () => {
        atualizarConfiguracaoCluster();
      });
    }

    if (zoomRange && zoomVal) {
      zoomRange.addEventListener("input", (e) => {
        zoomVal.textContent = e.target.value;
      });
      zoomRange.addEventListener("change", () => {
        atualizarConfiguracaoCluster();
      });
    }
  }

  function atualizarConfiguracaoCluster() {
    const radius = parseInt(document.getElementById("radiusRange")?.value || 80, 10);
    const zoomOff = parseInt(document.getElementById("zoomRange")?.value || 16, 10);

    criarCluster(radius, zoomOff);

    if (ultimosClientes.length > 0) {
      plotarClientes(ultimosClientes, false);
    }
  }

  function plotarClientes(clientesFiltrados, ajustarZoom = true) {
    if (!map || !markersCluster) return;

    ultimosClientes = clientesFiltrados;
    markersCluster.clearLayers();

    if (!clientesFiltrados || clientesFiltrados.length === 0) return;

    const bounds = L.latLngBounds();
    let validos = 0;
    const novosMarcadores = [];

    clientesFiltrados.forEach((cliente) => {
      if (cliente.lat && cliente.lng) {
        const latLng = L.latLng(cliente.lat, cliente.lng);

        let corPin = 'bg-blue-500'; 
        
        if (cliente.dadosOriginais) {
          const chaveStatus = Object.keys(cliente.dadosOriginais).find(k => k.toLowerCase().includes('status'));
          
          if (chaveStatus) {
            const valorStatus = String(cliente.dadosOriginais[chaveStatus]).toLowerCase();
            if (valorStatus.includes('sem viabilidade')) {
              corPin = 'bg-slate-400'; 
            } else if (valorStatus.includes('inativo')) {
              corPin = 'bg-rose-500'; 
            } else if (valorStatus.includes('ativo')) {
              corPin = 'bg-emerald-500'; 
            }
          }
        }

        const iconeCustomizado = L.divIcon({
          className: 'custom-marker',
          html: `<div class="${corPin} w-4 h-4 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -10]
        });

        let conteudoPopup = `<div class="p-2 font-sans text-xs" style="min-width: 180px;">`;
        let titulo = cliente.razao || `ID ${cliente.id || validos + 1}`;
        conteudoPopup += `<b style="font-size: 13px; color: #1e293b; display: block; margin-bottom: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">${titulo}</b>`;

        if (cliente.dadosOriginais) {
          Object.entries(cliente.dadosOriginais).forEach(([chave, valor]) => {
            if (!/lat|lng|latitude|longitude/i.test(chave) && valor && valor.toString().trim() !== "") {
              let exibeValor = valor;
              if (/valor|mensal|faturamento|preço/i.test(chave)) {
                let valNum = parseFloat(valor.toString().replace(/\./g, '').replace(',', '.'));
                if (!isNaN(valNum)) {
                  exibeValor = `R$ ${valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
              }
              conteudoPopup += `<div style="margin-bottom: 3px;"><b style="color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em;">${chave}:</b> <span style="color: #334155;">${exibeValor}</span></div>`;
            }
          });
        }
        conteudoPopup += `</div>`;

        const marker = L.marker(latLng, { icon: iconeCustomizado }).bindPopup(conteudoPopup);
        
        // Salvando os dados no marcador para usarmos no modal depois
        marker.clienteData = cliente; 
        
        novosMarcadores.push(marker);
        bounds.extend(latLng);
        validos++;
      }
    });

    markersCluster.addLayers(novosMarcadores);

    if (ajustarZoom && validos > 0) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
      } catch (err) {
        console.log("Ajuste de zoom ignorado:", err);
      }
    }
  }

  // --- FUNÇÕES DO MODAL ---
  function configurarModalCluster() {
    const modal = document.getElementById("modalClusterInfo");
    const btnX = document.getElementById("fecharClusterModal");
    const btnFechar = document.getElementById("btnFecharClusterModal");

    const fecharModal = () => { if (modal) modal.classList.add("hidden"); };

    if (btnX) btnX.addEventListener("click", fecharModal);
    if (btnFechar) btnFechar.addEventListener("click", fecharModal);
  }

  function abrirModalCluster(clientes) {
    const modal = document.getElementById("modalClusterInfo");
    const container = document.getElementById("clusterListaItens");
    const subtitulo = document.getElementById("clusterSubtitulo");

    if (!modal || !container) return;

    subtitulo.textContent = `${clientes.length} registros agrupados nesta região`;
    container.innerHTML = "";

    // Monta um card visual para cada cliente dentro do cluster
    clientes.forEach((cliente, index) => {
      let titulo = cliente.razao || `Registro ${cliente.id || index + 1}`;
      let valorFormatado = "-";
      
      if (cliente.valor) {
        let valNum = parseFloat(cliente.valor);
        if (!isNaN(valNum)) valorFormatado = `R$ ${valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }

      const card = document.createElement("div");
      card.className = "bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-1";
      card.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <h4 class="font-bold text-sm text-slate-800 leading-tight">${titulo}</h4>
          <span class="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">ID: ${cliente.id || 'N/I'}</span>
        </div>
        <div class="text-xs text-slate-500 flex justify-between items-center mt-1">
          <span>Status: <strong class="text-slate-700">${cliente.status || 'Não Informado'}</strong></span>
          <span class="text-emerald-600 font-bold">${valorFormatado}</span>
        </div>
      `;
      container.appendChild(card);
    });

    modal.classList.remove("hidden");
  }

  return {
    initMap,
    plotarClientes,
    atualizarConfiguracaoCluster
  };
})();