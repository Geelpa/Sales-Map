// js/map.js

const MapManager = {
  map: null,
  clusterGroup: null,
  activeCircle: null, // Armazena o círculo de abrangência abaixo do cluster
  DEFAULT_CENTER: [-15.7801, -47.9292],
  DEFAULT_ZOOM: 4,
  STORAGE_KEY: "map_geo_config",
  clientesAtuaisCache: [],

  carregarVisaoSalva() {
    const salva = localStorage.getItem(this.STORAGE_KEY);
    if (salva) {
      try {
        return JSON.parse(salva);
      } catch (e) {}
    }
    return { center: this.DEFAULT_CENTER, zoom: this.DEFAULT_ZOOM };
  },

  salvarVisaoAtual() {
    if (!this.map) return;
    const center = this.map.getCenter();
    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({
        center: [center.lat, center.lng],
        zoom: this.map.getZoom(),
      }),
    );
  },

  getCorClusterPorTicket(ticketMedio) {
    // Escala baseada nos seus valores (R$111 a R$278)
    if (ticketMedio < 140) return "#b1a682"; // Cinza Frio/Apagado (Abaixo do ideal)
    if (ticketMedio < 180) return "#dcdf5d"; // Azul (Intermediário Baixo)
    if (ticketMedio < 230) return "#4ec76c"; // Âmbar/Dourado (Intermediário Alto - Aquecendo)
    return "#00ff37"; // Verde Esmeralda (Quente/Ganhos/Alta Rentabilidade)
  },

  initMap() {
    const visao = this.carregarVisaoSalva();

    this.map = L.map("map", {
      preferCanvas: true,
    }).setView(visao.center, visao.zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(this.map);

    this.map.on("moveend", () => this.salvarVisaoAtual());

    this.atualizarConfiguracaoCluster(40, 22);
  },

  atualizarConfiguracaoCluster(radius, disableZoom) {
    if (this.clusterGroup) {
      this.map.removeLayer(this.clusterGroup);
    }

    this.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: parseInt(radius),
      disableClusteringAtZoom: parseInt(disableZoom),
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      iconCreateFunction: this.criarIconeCluster.bind(this),
    });

    // EVENTO DE HOVER SUPER OTIMIZADO (Fim do travamento)
    this.clusterGroup.on("clustermouseover", (a) => {
      const cluster = a.layer;

      if (this.activeCircle) {
        this.map.removeLayer(this.activeCircle);
        this.activeCircle = null;
      }

      // OTIMIZAÇÃO EXTREMA: Em vez de fazer um loop lento calculando a distância
      // de cada um dos milhares de clientes, pegamos as "fronteiras" geográficas do cluster!
      const bounds = cluster.getBounds();
      const centroCoord = bounds.getCenter(); // Acha o centro perfeito instantaneamente

      // Calcula a distância do centro até a ponta mais extrema (Nordeste)
      const maxDistanciaMetros = centroCoord.distanceTo(bounds.getNorthEast());

      // Aplica a margem de 15% + 20 metros (mínimo de 100m)
      const raioCalculado = Math.max(maxDistanciaMetros * 1.15 + 20, 100);

      this.activeCircle = L.circle(centroCoord, {
        radius: raioCalculado,
        color: "#3b82f6",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(this.map);
    });

    this.clusterGroup.on("clustermouseout", () => {
      if (this.activeCircle) {
        this.map.removeLayer(this.activeCircle);
        this.activeCircle = null;
      }
    });

    // EVENTO DE CLIQUE PARA ABRIR O MODAL
    this.clusterGroup.on("clusterclick", (a) => {
      const markers = a.layer.getAllChildMarkers();
      this.abrirModalCluster(markers);
    });

    this.map.addLayer(this.clusterGroup);

    if (this.clientesAtuaisCache.length > 0) {
      this.plotarClientes(this.clientesAtuaisCache, false);
    }
  },

  getCorPorCategoria(categoria) {
    if (categoria === "ativo") return "#10b981"; // Verde
    if (categoria === "inativo") return "#ef4444"; // Vermelho
    return "#6b7280"; // Cinza (Pré-contrato / Outros)
  },

  criarIconeCluster(cluster) {
    const markers = cluster.getAllChildMarkers();
    let ativos = 0;
    let inativos = 0;
    let outros = 0;
    let somaValorTotalContratos = 0;

    markers.forEach((m) => {
      const cliente = m.options.clienteData;
      const valorNumerico = Number(cliente.valor) || 0;
      somaValorTotalContratos += valorNumerico;

      if (cliente.categoriaStatus === "ativo") ativos++;
      else if (cliente.categoriaStatus === "inativo") inativos++;
      else outros++;
    });

    const totalClientesNoCluster = markers.length;
    const ticketMedioVal =
      totalClientesNoCluster > 0
        ? somaValorTotalContratos / totalClientesNoCluster
        : 0;

    const ticketMedioStr = ticketMedioVal.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const valorTotalStr = somaValorTotalContratos.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // Tamanho proporcional do cluster baseado na quantidade de clientes
    let tamanhoIcone = Math.min(40 + totalClientesNoCluster * 1.5, 75);
    if (tamanhoIcone < 40) tamanhoIcone = 40;

    const tooltipContent = `
      <div class="p-1 font-sans text-xs w-52 pointer-events-none">
        <div class="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-2">
          <span class="font-bold text-gray-800 uppercase tracking-wider text-[10px]">Agrupamento</span>
          <span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold text-[10px]">${totalClientesNoCluster} reg.</span>
        </div>
        <div class="grid grid-cols-3 gap-1 mb-2">
          <div class="bg-emerald-50 border border-emerald-200 rounded p-1 text-center">
            <span class="block text-[9px] text-emerald-700 font-semibold">Ativos</span>
            <span class="text-xs font-extrabold text-emerald-800">${ativos}</span>
          </div>
          <div class="bg-rose-50 border border-rose-200 rounded p-1 text-center">
            <span class="block text-[9px] text-rose-700 font-semibold">Inativos</span>
            <span class="text-xs font-extrabold text-rose-800">${inativos}</span>
          </div>
          <div class="bg-gray-50 border border-gray-200 rounded p-1 text-center">
            <span class="block text-[9px] text-gray-600 font-semibold">Pré/Outros</span>
            <span class="text-xs font-extrabold text-gray-700">${outros}</span>
          </div>
        </div>
        <div class="bg-slate-900 text-white rounded-lg p-2 text-center shadow-inner">
          <span class="block text-[10px] text-slate-300 font-medium">Ticket Médio (Soma / Total Clientes)</span>
          <span class="text-sm font-black text-emerald-400">${ticketMedioStr}</span>
          <span class="block text-[9px] text-slate-400 mt-0.5">Soma Total: ${valorTotalStr}</span>
        </div>
      </div>
    `;

    // Gera a cor baseada no ticket médio do cluster
    const corFundo = this.getCorClusterPorTicket(ticketMedioVal);

    // Removemos o 'bg-slate-900' e adicionamos o background-color dinâmico no style
    const iconHtml = `
      <div class="rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-xs transition-transform hover:scale-110" 
           style="background-color: ${corFundo}; width: ${tamanhoIcone}px; height: ${tamanhoIcone}px;">
        ${totalClientesNoCluster}
      </div>
    `;

    const divIcon = L.divIcon({
      html: iconHtml,
      className: "custom-cluster-icon",
      iconSize: [tamanhoIcone, tamanhoIcone],
      iconAnchor: [tamanhoIcone / 2, tamanhoIcone / 2],
    });

    const markerClusterObject = cluster;
    markerClusterObject.unbindTooltip();
    markerClusterObject.bindTooltip(tooltipContent, {
      direction: "top",
      offset: [0, -(tamanhoIcone / 2) - 4],
      opacity: 1,
      className: "cluster-custom-tooltip",
    });

    return divIcon;
  },

  plotarClientes(clientes, autoAjustarVisao = false) {
    this.clientesAtuaisCache = clientes;
    this.clusterGroup.clearLayers();
    const markers = [];

    clientes.forEach((cliente) => {
      const color = this.getCorPorCategoria(cliente.categoriaStatus);

      const marker = L.circleMarker([cliente.lat, cliente.lng], {
        radius: 6,
        fillColor: color,
        color: "#ffffff",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85,
        clienteData: cliente,
      });

      const valorFormatado = (Number(cliente.valor) || 0).toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL" },
      );
      marker.bindPopup(`
        <div class="text-xs font-sans">
          <strong>ID:</strong> ${cliente.id}<br/>
          <strong>Razão:</strong> ${cliente.razao}<br/>
          <strong>Status:</strong> <span style="color:${color};font-weight:bold">${cliente.status}</span><br/>
          <strong>Valor:</strong> ${valorFormatado}<br/>
          <strong>Ano:</strong> ${cliente.ano || "N/A"}
        </div>
      `);

      markers.push(marker);
    });

    this.clusterGroup.addLayers(markers);

    if (autoAjustarVisao && markers.length > 0) {
      const groupBounds = L.featureGroup(markers).getBounds();
      this.map.fitBounds(groupBounds, { padding: [20, 20] });
    }
  },

  resetarVisaoPadrao() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.map.setView(this.DEFAULT_CENTER, this.DEFAULT_ZOOM);
  },

  abrirModalCluster(markers) {
    const modal = document.getElementById("clusterModal");
    const content = document.getElementById("modalClusterContent");
    const count = document.getElementById("modalClusterCount");

    if (!modal || !content || !count) return;

    // Atualiza a contagem total no cabeçalho
    count.textContent = `${markers.length} clientes`;

    // Separa os clientes por status
    let ativos = [];
    let inativos = [];

    markers.forEach((m) => {
      const cliente = m.options.clienteData;
      if (cliente.categoriaStatus === "ativo") {
        ativos.push(cliente);
      } else {
        inativos.push(cliente);
      }
    });

    // Ordena as listas por ordem alfabética (Razão Social)
    ativos.sort((a, b) => a.razao.localeCompare(b.razao));
    inativos.sort((a, b) => a.razao.localeCompare(b.razao));

    // Função auxiliar para formatar a moeda
    const formatarMoeda = (val) =>
      (Number(val) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

    // Função auxiliar para construir as tabelas HTML
    const criarTabela = (titulo, clientes, corTexto, corFundo, corBorda) => {
      if (clientes.length === 0) return "";

      const linhas = clientes
        .map(
          (c) => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
          <td class="px-3 py-2 text-xs text-gray-500 font-mono">${c.id}</td>
          <td class="px-3 py-2 text-xs font-semibold text-gray-700">${c.razao}</td>
          <td class="px-3 py-2 text-xs text-gray-600 font-medium">${formatarMoeda(c.valor)}</td>
          <td class="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider" style="font-size: 10px;">${c.status}</td>
        </tr>
      `,
        )
        .join("");

      return `
        <div class="mb-6 rounded-lg border ${corBorda} overflow-hidden shadow-sm">
          <div class="${corFundo} px-4 py-2 border-b ${corBorda}">
            <h3 class="text-sm font-bold ${corTexto} flex justify-between items-center">
              ${titulo}
              <span class="bg-white bg-opacity-50 px-2 py-0.5 rounded text-xs">${clientes.length}</span>
            </h3>
          </div>
          <div class="overflow-x-auto bg-white">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-gray-50/50">
                  <th class="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID</th>
                  <th class="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Razão Social</th>
                  <th class="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plano</th>
                  <th class="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status ERP</th>
                </tr>
              </thead>
              <tbody>
                ${linhas}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    // Injeta as tabelas no modal (Ativos primeiro, depois Inativos)
    content.innerHTML = `
      ${criarTabela("Clientes Ativos", ativos, "text-emerald-800", "bg-emerald-100", "border-emerald-200")}
      ${criarTabela("Clientes Inativos / Outros", inativos, "text-rose-800", "bg-rose-100", "border-rose-200")}
    `;

    // Exibe o modal
    modal.classList.remove("hidden");
  },
};
