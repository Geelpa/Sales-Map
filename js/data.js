// js/data.js

const DataProcessor = {
  parseValor(valorString) {
    if (!valorString) return 0;

    // Se o valor já for um número, retorna ele mesmo
    if (typeof valorString === "number") return valorString;

    // Remove tudo exceto números, vírgulas e pontos, depois troca vírgula por ponto
    const limpo = valorString
      .toString()
      .replace(/[^\d,\.-]/g, "")
      .replace(",", ".");
    const valor = parseFloat(limpo);

    return isNaN(valor) ? 0 : valor;
  },

  getCategoriaStatus(row) {
    const statusString = row["Status contrato"] || "";
    const s = statusString.toString().toLowerCase().trim();

    // Normalizador de texto
    const normalizar = (texto) => {
      return (texto || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const statusNorm = normalizar(s);
    const dataCancelamento =
      row["Data do cancelamento"] || row["Data da desistência"] || "";

    const descCancelamento = normalizar(
      row["Descrição de cancelamento"] ||
        row["descrição de cancelamento"] ||
        row["Descrição de Cancelamento"] ||
        "",
    );
    const descDesistencia = normalizar(
      row["Descrição de desistência"] ||
        row["descrição de desistência"] ||
        row["Descrição de Desistência"] ||
        "",
    );

    // 1. REGRA DE INATIVO DEFINITIVA (Prioridade Máxima)
    // Se o status da linha é de inatividade, a LINHA é inativa.
    if (
      statusNorm.includes("inativo") ||
      statusNorm.includes("cancel") ||
      statusNorm.includes("desist")
    ) {
      return "inativo";
    }

    // 2. REGRA DE ATIVO CLARA
    if (
      statusNorm.includes("ativo") ||
      statusNorm.includes("instalado") ||
      statusNorm.includes("concluido") ||
      statusNorm.includes("concluído") ||
      statusNorm.includes("vigente")
    ) {
      return "ativo";
    }

    // 3. REGRA DE RETENÇÃO RESTRITA (Apenas se o status principal for vago)
    const palavrasChaveRetencao = [
      "migrou com sucesso",
      "cliente retido",
      "mantido na base",
    ];

    const isRetido = palavrasChaveRetencao.some(
      (palavra) =>
        descCancelamento.includes(palavra) || descDesistencia.includes(palavra),
    );

    if (isRetido) {
      return "ativo";
    }

    // Se não se enquadrou em nada acima, retorna como outro
    return "outro";
  },

  extrairAno(dataString) {
    if (!dataString) return null;
    const match = dataString.toString().match(/\b(20\d{2}|19\d{2})\b/);
    return match ? parseInt(match[0]) : null;
  },

  formatarClientes(rawData) {
    const clientesFormatados = [];

    rawData.forEach((row) => {
      let lat = parseFloat(row["Latitude"]);
      let lng = parseFloat(row["Longitude"]);

      if (isNaN(lat) || isNaN(lng)) {
        lat = parseFloat(row["Latitude Prospect"]);
        lng = parseFloat(row["Longitude Prospect"]);
      }

      if (!isNaN(lat) && !isNaN(lng)) {
        const anoAtivacao = this.extrairAno(row["Data ativação"]);
        const anoCancelamento = this.extrairAno(row["Data do cancelamento"]);
        const anoDesistecia = this.extrairAno(row["Data da desistência"]);
        const ano = anoAtivacao || anoCancelamento || anoDesistecia || null;

        const categoriaStatus = this.getCategoriaStatus(row);

        clientesFormatados.push({
          id: row["ID"] || "Sem ID",
          razao: row["Razão"] || "N/A",
          status: row["Status contrato"] || "Não Informado",
          categoriaStatus: categoriaStatus,
          isAtivo: categoriaStatus === "ativo",
          valor: row["Valor contrato"],
          ano: ano,
          lat: lat,
          lng: lng,
        });
      }
    });

    return clientesFormatados;
  },
};
