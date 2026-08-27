// js/map.js

const MapManager = {
  map: null,
  clusterGroup: null,
  DEFAULT_CENTER: [-15.7801, -47.9292],
  DEFAULT_ZOOM: 4,
  STORAGE_KEY: 'map_geo_config',

  carregarVisaoSalva() {
    const salva = localStorage.getItem(this.STORAGE_KEY);
    if (salva) {
      try { return JSON.parse(salva); } catch (e) {}
    }
    return { center: this.DEFAULT_CENTER, zoom: this.DEFAULT_ZOOM };
  },

  salvarVisaoAtual() {
    if (!this.map) return;
    const center = this.map.getCenter();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      center: [center.lat, center.lng],
      zoom: this.map.getZoom()
    }));
  },

  initMap() {
    const visao = this.carregarVisaoSalva();

    this.map = L.map('map', {
      preferCanvas: true
    }).setView(visao.center, visao.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    this.map.on('moveend', () => this.salvarVisaoAtual());

    this.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: 80,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      iconCreateFunction: this.criarIconeCluster.bind(this)
    });

    this.map.addLayer(this.clusterGroup);
  },

  getCorPorCategoria(categoria) {
    if (categoria === 'ativo') return '#10b981';   // Verde
    if (categoria === 'inativo') return '#ef4444'; // Vermelho
    return '#6b7280';                              // Cinza (Pré-contrato / Outros)
  },

  criarIconeCluster(cluster) {
    const markers = cluster.getAllChildMarkers();
    let ativos = 0;
    let inativos = 0;
    let outros = 0;
    let somaValorTotalContratos = 0;

    markers.forEach(m => {
      const cliente = m.options.clienteData;
      somaValorTotalContratos += cliente.valor;

      if (cliente.categoriaStatus === 'ativo') ativos++;
      else if (cliente.categoriaStatus === 'inativo') inativos++;
      else outros++;
    });

    const ticketMedioVal = ativos > 0 ? (somaValorTotalContratos / ativos) : 0;
    const ticketMedioStr = ticketMedioVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const valorTotalStr = somaValorTotalContratos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const tooltipContent = `
      <div class="p-1 font-sans text-xs w-52">
        <div class="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-2">
          <span class="font-bold text-gray-800 uppercase tracking-wider text-[10px]">Agrupamento</span>
          <span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold text-[10px]">${markers.length} reg.</span>
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
          <span class="block text-[10px] text-slate-300 font-medium">Ticket Médio (Total / Ativos)</span>
          <span class="text-sm font-black text-emerald-400">${ticketMedioStr}</span>
          <span class="block text-[9px] text-slate-400 mt-0.5">Soma Total: ${valorTotalStr}</span>
        </div>
      </div>
    `;

    cluster.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -12],
      opacity: 1,
      className: 'cluster-custom-tooltip'
    });

    const html = `
      <div class="w-10 h-10 rounded-full bg-slate-900 border-2 border-white shadow-lg flex items-center justify-center text-white font-extrabold text-xs transition-transform hover:scale-110">
        ${markers.length}
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-cluster-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  },

  plotarClientes(clientes, autoAjustarVisao = false) {
    this.clusterGroup.clearLayers();
    const markers = [];

    clientes.forEach(cliente => {
      const color = this.getCorPorCategoria(cliente.categoriaStatus);

      const marker = L.circleMarker([cliente.lat, cliente.lng], {
        radius: 6,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85,
        clienteData: cliente
      });

      const valorFormatado = cliente.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      marker.bindPopup(`
        <div class="text-xs font-sans">
          <strong>ID:</strong> ${cliente.id}<br/>
          <strong>Razão:</strong> ${cliente.razao}<br/>
          <strong>Status:</strong> <span style="color:${color};font-weight:bold">${cliente.status}</span><br/>
          <strong>Valor:</strong> ${valorFormatado}<br/>
          <strong>Ano:</strong> ${cliente.ano || 'N/A'}
        </div>
      `);

      markers.push(marker);
    });

    this.clusterGroup.addLayers(markers);

    if (autoAjustarVisao && markers.length > 0) {
      const groupBounds = L.featureGroup(markers).getBounds();
      this.map.fitBounds(groupBounds, { padding: [40, 40] });
    }
  },

  resetarVisaoPadrao() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.map.setView(this.DEFAULT_CENTER, this.DEFAULT_ZOOM);
  }
};