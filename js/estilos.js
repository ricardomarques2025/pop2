const REGRAS_ESTILO = [
    {
      legenda: "Pavimentação - Em Andamento",
      cor: "#dc0101",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 1,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_AND", campo: "TES.AND.SV", comparador: "=", valor: "Pavimentação" },
        { grupo: "FUN_AND", campo: "FUN.AND.SV", comparador: "=", valor: "Pavimentação" }
      ]}
    },
    {
      legenda: "Duplicação - Em Andamento",
      cor: "#001efe",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 2,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_AND", campo: "TES.AND.SV", comparador: "=", valor: "Duplicação" },
        { grupo: "FUN_AND", campo: "FUN.AND.SV", comparador: "=", valor: "Duplicação" }
      ]}
    },
    {
      legenda: "Restauração - Em Andamento",
      cor: "#10a000",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 3,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_AND", campo: "TES.AND.SV", comparador: "=", valor: "Restauração" },
        { grupo: "FUN_AND", campo: "FUN.AND.SV", comparador: "=", valor: "Restauração" }
      ]}
    },
    {
      legenda: "Melhoria Funcional - Em Andamento",
      cor: "#ff9601",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 4,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_AND", campo: "TES.AND.SV", comparador: "=", valor: "Melhoria Funcional" },
        { grupo: "FUN_AND", campo: "FUN.AND.SV", comparador: "=", valor: "Melhoria Funcional" }
      ]}
    },
    {
      legenda: "Pavimentação - Em Licitação",
      cor: "#dc8484",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 5,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_LIC", campo: "TES.LIC.SV", comparador: "=", valor: "Pavimentação" },
        { grupo: "FUN_LIC", campo: "FUN.LIC.SV", comparador: "=", valor: "Pavimentação" }
      ]}
    },
    {
      legenda: "Duplicação - Em Licitação",
      cor: "#7f90fe",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 6,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_LIC", campo: "TES.LIC.SV", comparador: "=", valor: "Duplicação" },
        { grupo: "FUN_LIC", campo: "FUN.LIC.SV", comparador: "=", valor: "Duplicação" }
      ]}
    },
    {
      legenda: "Restauração - Em Licitação",
      cor: "#8fd388",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 7,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_LIC", campo: "TES.LIC.SV", comparador: "=", valor: "Restauração" },
        { grupo: "FUN_LIC", campo: "FUN.LIC.SV", comparador: "=", valor: "Restauração" }
      ]}
    },
    {
      legenda: "Melhoria Funcional - Em Licitação",
      cor: "#ffd388",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 8,
      regra: { op: "OR", condicoes: [
        { grupo: "TES_LIC", campo: "TES.LIC.SV", comparador: "=", valor: "Melhoria Funcional" },
        { grupo: "FUN_LIC", campo: "FUN.LIC.SV", comparador: "=", valor: "Melhoria Funcional" }
      ]}
    },
    {
      legenda: "Pavimentação - Projeto",
      cor: "#dc0101",
      tipo_linha: "COM LINHA BRANCA",
      espessura: 9,
      prioridade: 9,
      regra: { op: "AND", condicoes: [
        { grupo: "DPJ", campo: "DPJ.SV", comparador: "=", valor: "Pavimentação" }
      ]}
    },
    {
      legenda: "Duplicação - Projeto",
      cor: "#001efe",
      tipo_linha: "COM LINHA BRANCA",
      espessura: 9,
      prioridade: 10,
      regra: { op: "AND", condicoes: [
        { grupo: "DPJ", campo: "DPJ.SV", comparador: "=", valor: "Duplicação" }
      ]}
    },
    {
      legenda: "Restauração - Projeto",
      cor: "#10a000",
      tipo_linha: "COM LINHA BRANCA",
      espessura: 9,
      prioridade: 11,
      regra: { op: "AND", condicoes: [
        { grupo: "DPJ", campo: "DPJ.SV", comparador: "=", valor: "Restauração" }
      ]}
    },
    {
      legenda: "Melhoria Funcional - Projeto",
      cor: "#ff9601",
      tipo_linha: "COM LINHA BRANCA",
      espessura: 9,
      prioridade: 12,
      regra: { op: "AND", condicoes: [
        { grupo: "DPJ", campo: "DPJ.SV", comparador: "=", valor: "Melhoria Funcional" }
      ]}
    },
    {
      legenda: "Federalização",
      cor: "#e0fe00",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 13,
      regra: { op: "AND", condicoes: [
        { grupo: "FEDER", campo: "FEDER", comparador: "=", valor: 1 }
      ]}
    },
    {
      legenda: "Microrrevestimento",
      cor: "#fe49e6",
      tipo_linha: "NORMAL",
      espessura: 9,
      prioridade: 14,
      regra: { op: "AND", condicoes: [
        { grupo: "MICRO", campo: "PMR", comparador: ">", valor: 0 }
      ]}
    }
  ];

  const OAE_LEGENDA_INFO = {
    1: { cor: '#00ffff', titulo: 'Eixo 1', desc: 'Manutenção e restauração de pontes em rodovias pavimentadas' },
    2: { cor: '#ffff00', titulo: 'Eixo 2', desc: 'GPP - Programa Goiás de Ponta a Ponte' },
    3: { cor: '#ff0000', titulo: 'Eixo 3', desc: 'Obras firmadas em parcerias com entes externos' },
    4: { cor: '#2f80ed', titulo: 'Eixo 4', desc: 'Novas Obras Estaduais' },
    5: { cor: '#00ff00', titulo: 'Eixo 5', desc: 'GME - Programa Goiás em Movimento Estruturas' },
    6: { cor: '#ff4dc4', titulo: 'Eixo 6', desc: 'GMK - Programa Goiás em Movimento Kalunga' },
    100: { cor: '#8B5A00', titulo: 'Bueiro', desc: '' },
    101: { cor: '#999999', titulo: 'Viaduto', desc: '' }
  };

  const ROD_EST_INFO = {
    DUP: { label: 'Duplicada', tipo: 'dup', cor: '#ef2020' },
    PAV: { label: 'Pavimentada', tipo: 'simple', cor: '#ef2020' },
    EOD: { label: 'Em Obras de Duplicação', tipo: 'dashed-red', cor: '#ef2020' },
    EOP: { label: 'Em Obras de Pavimentação', tipo: 'dashed-red', cor: '#ef2020' },
    IMP: { label: 'Implantada', tipo: 'simple', cor: '#f08a00' },
    LEN: { label: 'Leito Natural', tipo: 'simple', cor: '#f08a00' },
    PLA: { label: 'Planejada', tipo: 'simple', cor: '#000000' }
  };

  const ROD_FED_INFO = {
    DUP: { label: 'Duplicada', tipo: 'dup', cor: '#33a21a' },
    LEN: { label: 'Leito Natural', tipo: 'simple', cor: '#e59b00' },
    EOP: { label: 'Em Obras de Pavimentação', tipo: 'dashed-green', cor: '#33a21a' },
    PAV: { label: 'Pavimentada', tipo: 'simple', cor: '#33a21a' }
  };

  window.REGRAS_ESTILO = REGRAS_ESTILO;
  window.OAE_LEGENDA_INFO = OAE_LEGENDA_INFO;
  window.ROD_EST_INFO = ROD_EST_INFO;
  window.REGRAS_ESTILO = REGRAS_ESTILO;