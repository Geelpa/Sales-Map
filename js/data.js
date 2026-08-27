// js/data.js

const DataProcessor = {
  parseValor(valorString) {
    if (!valorString) return 0;
    const apenasNumeros = valorString.toString().replace(/[^\d,-]/g, '').replace(',', '.');
    const valor = parseFloat(apenasNumeros);
    return isNaN(valor) ? 0 : valor;
  },

  getCategoriaStatus(row) {
    const statusString = row['Status contrato'] || '';
    const s = statusString.toString().toLowerCase().trim();

    // Captura as colunas de descrição de forma ampla
    const descCancelamento = (row['Descrição de cancelamento'] || row['descrição de cancelamento'] || row['Descrição de Cancelamento'] || '').toString();
    const descDesistencia = (row['Descrição de desistência'] || row['descrição de desistência'] || row['Descrição de Desistência'] || '').toString();

    // Normaliza os textos removendo acentos e convertendo para minúsculo 
    // (Isso resolve problemas como "Migrou", "MIGROU" ou "migrou")
    const normalizar = (texto) => {
      return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const descCancelamentoNorm = normalizar(descCancelamento);
    const descDesistenciaNorm = normalizar(descDesistencia);

    // Lista de palavras-chave normalizadas
    const palavrasChave = ['migrou', 'upgrade', '200mb', '100Mb', '50mb', '30mb'];
    
    // Verifica se alguma palavra-chave existe em qualquer uma das descrições
    const isRetido = palavrasChave.some(palavra => 
      descCancelamentoNorm.includes(palavra) || descDesistenciaNorm.includes(palavra)
    );

    // Se encontrou a palavra de retenção, ele continua sendo cliente ativo!
    if (isRetido) {
      return 'ativo';
    }

    // Regras normais de status
    if (s.includes('inativo') || s.includes('cancel') || s.includes('desist')) {
      return 'inativo';
    }

    if (s.includes('ativo') || s.includes('instalado') || s.includes('concluido') || s.includes('concluído')) {
      return 'ativo';
    }

    return 'outro'; 
  },

  extrairAno(dataString) {
    if (!dataString) return null;
    const match = dataString.toString().match(/\b(20\d{2}|19\d{2})\b/);
    return match ? parseInt(match[0]) : null;
  },

  formatarClientes(rawData) {
    const clientesFormatados = [];

    rawData.forEach(row => {
      let lat = parseFloat(row['Latitude']);
      let lng = parseFloat(row['Longitude']);

      if (isNaN(lat) || isNaN(lng)) {
        lat = parseFloat(row['Latitude Prospect']);
        lng = parseFloat(row['Longitude Prospect']);
      }

      if (!isNaN(lat) && !isNaN(lng)) {
        const anoAtivacao = this.extrairAno(row['Data ativação']);
        const anoCancelamento = this.extrairAno(row['Data do cancelamento']);
        const anoDesistecia = this.extrairAno(row['Data da desistência']);
        const ano = anoAtivacao || anoCancelamento || anoDesistecia || null;

        const categoriaStatus = this.getCategoriaStatus(row);

        clientesFormatados.push({
          id: row['ID'] || 'Sem ID',
          razao: row['Razão'] || 'N/A',
          status: row['Status contrato'] || 'Não Informado',
          categoriaStatus: categoriaStatus,
          isAtivo: categoriaStatus === 'ativo',
          valor: this.parseValor(row['Valor contrato']),
          ano: ano,
          lat: lat,
          lng: lng
        });
      }
    });

    return clientesFormatados;
  }
};