var map = L.map('map').setView([-15.8, -49.0], 7);
var originalCenter = map.getCenter();
var originalZoom = map.getZoom();

  map.createPane('snvPane');
  map.getPane('snvPane').style.zIndex = 200;

  map.createPane('sreBasePane');
  map.getPane('sreBasePane').style.zIndex = 300;

    map.createPane('servicosPane');
    map.getPane('servicosPane').style.zIndex = 500;

    map.createPane('localidadesPane');
    map.getPane('localidadesPane').style.zIndex = 550;

    map.createPane('oaePane');
    map.getPane('oaePane').style.zIndex = 600;

 const baseClaro = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
);

const baseClaroComNomes = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
);

const baseEscuro = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
);

const baseSatelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri',
    maxZoom: 19
  }
);

// base inicial
baseClaro.addTo(map);

// --- MÁSCARA DO BRASIL (Brasil menos Goiás) com 50% de transparência ---
var mascaraBrasilData = null;
var mascaraBrasilLayer = null;

function desenharMascaraBrasil() {
  if (!mascaraBrasilData) return;
  if (mascaraBrasilLayer) map.removeLayer(mascaraBrasilLayer);

  mascaraBrasilLayer = L.geoJSON(mascaraBrasilData, {
    style: {
      color: '#808080',
      weight: 1,
      fillColor: '#808080',
      fillOpacity: 0.25
    },
    interactive: false
  }).addTo(map);
}
// --- FIM MÁSCARA ---

// controle para trocar a base
const mapasBase = {
  "Claro limpo": baseClaro,
  "Claro com nomes": baseClaroComNomes,
  "Escuro": baseEscuro,
  "Satélite": baseSatelite
};

L.control.layers(mapasBase, null, {
  position: 'topleft',
  collapsed: true
}).addTo(map);

  map.on('zoomend', function() {
    atualizarVisibilidadeRotulos();
    atualizarVisibilidadeRotulosSRE();
  });

  var municipiosData = null;
  var localidadesData = null;
  var sreBaseData = null;
  var sreData = null;
  var oaeData = null;
  var estadosData = null;
  var snvData = null;

  var estadosLayer = null;
  var municipiosLayer = null;
  var localidadesLayer = null;
  var sreBaseLayer = null;
  var sreBaseLabelLayer = null;
  var snvLabelLayer = null;
  var oaeLayer = null;
  var snvLayer = null;
  var regraLayers = [];

  var programaAtivo = '';
  var programas = [];

    var servicosAtivos = {
      FUNDEINFRA: true,
      DOR: true
    };
    var servicoFiltroAtivo = '';

  var oaeFiltroAtivo = false;
  var sreBaseFiltroAtivo = true;
  var snvFiltroAtivo = true;
  var localidadeFiltroAtivo = true;
  var municipioBaseFiltroAtivo = true;

    var obrasFundeinfraData = [];
  var obrasFundeinfraPorLink = {};
  var obrasDorData = [];
  var obrasDorPorLink = {};

    function carregarTabelasFundeinfra() {
    fetch('data/OBRAS_LINHAS_FUNDEINFRA.json')
      .then(function(r) { return r.json(); })
      .then(function(resultado) {
        obrasFundeinfraData = Array.isArray(resultado) ? resultado : [];
        obrasFundeinfraPorLink = {};

        for (var i = 0; i < obrasFundeinfraData.length; i++) {
          var item = obrasFundeinfraData[i];
          var link = item && item.LINK_FUND;
          if (link && !obrasFundeinfraPorLink[String(link)]) {
            obrasFundeinfraPorLink[String(link)] = item;
          }
        }

                console.log('OBRAS_LINHAS_FUNDEINFRA carregado:', obrasFundeinfraData.length);
        preencherServicos();
        if (sreData && municipiosData) {
          preencherRodovias();
          preencherSREs();
          preencherPropostas();
          aplicarFiltros();
        }
      })
      .catch(function(e) {
        console.warn('Falha ao carregar OBRAS_LINHAS_FUNDEINFRA:', e);
      });
  }

  function carregarTabelasDor() {
    fetch('data/OBRAS_LINHAS_DOR.json')
      .then(function(r) { return r.json(); })
      .then(function(resultado) {
        obrasDorData = Array.isArray(resultado) ? resultado : [];
        obrasDorPorLink = {};

        for (var i = 0; i < obrasDorData.length; i++) {
          var item = obrasDorData[i];
          var link = item && item.LINK_FUND;
          if (link && !obrasDorPorLink[String(link)]) {
            obrasDorPorLink[String(link)] = item;
          }
        }

        console.log('OBRAS_LINHAS_DOR carregado:', obrasDorData.length);
        preencherServicos();
        if (sreData && municipiosData) {
          aplicarFiltros();
        }
      })
      .catch(function(e) {
        console.warn('Falha ao carregar OBRAS_LINHAS_DOR:', e);
      });
  }

  carregarTabelasFundeinfra();
  carregarTabelasDor();
  
  
  function atualizarBotoesBase() {
    var btnOAE = document.getElementById('toggleOAE');
    if (btnOAE) btnOAE.classList.toggle('ativo-filtro', oaeFiltroAtivo);
    document.getElementById('toggleSREBase').classList.toggle('ativo-filtro', sreBaseFiltroAtivo);
    document.getElementById('toggleSNV').classList.toggle('ativo-filtro', snvFiltroAtivo);
    var btnLocalidades = document.getElementById('toggleLocalidades');
    if (btnLocalidades) {
      btnLocalidades.classList.toggle('ativo-filtro', localidadeFiltroAtivo);
    }
    var btnMunicipios = document.getElementById('toggleMunicipiosBase');
    if (btnMunicipios) {
      btnMunicipios.classList.toggle('ativo-filtro', municipioBaseFiltroAtivo);
    }
  }


  function limparCamadasRegras() {
    for (var i = 0; i < regraLayers.length; i++) {
      map.removeLayer(regraLayers[i]);
    }
    regraLayers = [];
  }


  function valorSeguro(obj, campo) {
    if (!obj || !obj.properties) return '';
    if (obj.properties[campo] === null || obj.properties[campo] === undefined) return '';
    return obj.properties[campo];
  }

  function numeroSeguro(v) {
    if (v === null || v === undefined || String(v).trim() === '') return 0;
    return Number(v);
  }

  function numeroPrograma(feature, campo) {
    return numeroSeguro(valorSeguro(feature, campo));
  }

  function corOAE(eixo) {
    eixo = Number(eixo);
    if (eixo === 1) return '#00ffff';
    if (eixo === 2) return '#ffff00';
    if (eixo === 3) return '#ff0000';
    if (eixo === 4) return '#2f80ed';
    if (eixo === 5) return '#00ff00';
    if (eixo === 6) return '#ff4dc4';
    if (eixo === 100) return '#8B5A00';
    if (eixo === 101) return '#999999';
    return '#cccccc';
  }

  function nomeTipoOAE(eixo) {
    eixo = Number(eixo);
    if (eixo === 1) return 'Eixo 1';
    if (eixo === 2) return 'Eixo 2';
    if (eixo === 3) return 'Eixo 3';
    if (eixo === 4) return 'Eixo 4';
    if (eixo === 5) return 'Eixo 5';
    if (eixo === 6) return 'Eixo 6';
    if (eixo === 100) return 'Bueiro';
    if (eixo === 101) return 'Viaduto';
    return 'Outro';
  }

  function marcadorLosango(latlng, cor) {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: '',
        html:
          '<div style="' +
          'width:12px;' +
          'height:12px;' +
          'background:' + cor + ';' +
          'border:2px solid #000;' +
          'transform: rotate(45deg);' +
          'box-sizing:border-box;' +
          '"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    });
  }


  function rotuloRodoviaCampos(feature) {
    return (
      valorSeguro(feature, 'rodovia') ||
      valorSeguro(feature, 'RODOVIA') ||
      valorSeguro(feature, 'sg_rodovia') ||
      valorSeguro(feature, 'SNV') ||
      ''
    );
  }

  function podeMostrarRotulo() {
    return map.getZoom() >= 9;
  }

  function preencherRGPlan() {
    var select = document.getElementById('rgPlanSelect');
    var valores = [];

    for (var i = 0; i < municipiosData.features.length; i++) {
      var rg = valorSeguro(municipiosData.features[i], 'RG_PLAN');
      if (rg && valores.indexOf(rg) === -1) valores.push(rg);
    }

    valores.sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var j = 0; j < valores.length; j++) {
      var opt = document.createElement('option');
      opt.value = valores[j];
      opt.textContent = valores[j];
      select.appendChild(opt);
    }
  }


  function nomeRodoviaFeature(feature) {
    return (
      valorSeguro(feature, 'rodovia') ||
      valorSeguro(feature, 'RODOVIA') ||
      valorSeguro(feature, 'Rodovia') ||
      ''
    );
  }


  function nomeSREFeature(feature) {
    return (
      valorSeguro(feature, 'sre') ||
      valorSeguro(feature, 'SRE') ||
      ''
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function construirPopupRodoviaBase(feature) {
    var p = feature.properties || {};
    var html = '';

    // Ordem específica dos campos
    var campos = [
      { chave: 'rodovia', rotulo: 'RODOVIA' },
      { chave: 'trecho', rotulo: 'TRECHO' },
      { chave: 'situacao', rotulo: 'SITUAÇÃO' },
      { chave: 'sre', rotulo: 'SRE' },
      { chave: 'ext', rotulo: 'EXTENSÃO' }
    ];

    for (var i = 0; i < campos.length; i++) {
      var campo = campos[i];
      var valor = p[campo.chave];
      if (valor === null || valor === undefined || String(valor).trim() === '') continue;
      html += '<b>' + escapeHtml(campo.rotulo) + ':</b> ' + escapeHtml(valor) + '<br>';
    }

    if (!html) {
      html = '<b>Rodovia:</b> ' + escapeHtml(rotuloRodoviaCampos(feature));
    }

    return html;
  }

  function preencherSREs() {
    var select = document.getElementById('sreSelect');
    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sres = [];

    select.innerHTML = '<option value="">Todos</option>';

    function considerarFeature(feature) {
      var sre = nomeSREFeature(feature);
      var rodovia = nomeRodoviaFeature(feature);
      var nmMun = valorSeguro(feature, 'NM_MUN');
      var rgPlan = valorSeguro(feature, 'RG_PLAN');

      if (!valorSeguro(feature, 'LINK_FUND') || !dadosFundeinfraDaFeature(feature)) return;
      if (!sre) return;
      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) return;
      if (sres.indexOf(sre) === -1) sres.push(sre);
    }

    if (sreData && sreData.features) {
      sreData.features.forEach(considerarFeature);
    }

    sres.sort(function(a,b){ return String(a).localeCompare(String(b), 'pt-BR'); });
    sres.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
  }

    function preencherPropostas() {
    var select = document.getElementById('propostaSelect');
    if (!select) return;

    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;
    var propostas = [];

    select.innerHTML = '<option value="">Todas</option>';

    function considerarFeature(feature) {
      var dados = dadosFundeinfraDaFeature(feature);
      if (!valorSeguro(feature, 'LINK_FUND') || !dados) return;

      var proposta = dados.PROPOSTA;
      var sre = nomeSREFeature(feature);
      var rodovia = nomeRodoviaFeature(feature);
      var nmMun = valorSeguro(feature, 'NM_MUN');
      var rgPlan = valorSeguro(feature, 'RG_PLAN');

      if (proposta === null || proposta === undefined || String(proposta).trim() === '') return;
      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) return;
      if (sreSelecionado && sre !== sreSelecionado) return;

      var chave = String(proposta);
      if (propostas.indexOf(chave) === -1) propostas.push(chave);
    }

    if (sreData && sreData.features) {
      sreData.features.forEach(considerarFeature);
    }

    propostas.sort(function(a, b) { return Number(a) - Number(b); });
    propostas.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
  }

  function preencherServicos() {
    var select = document.getElementById('servicoSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Todos</option>';

    var servicos = [];

    function addServicos(lista) {
      for (var i = 0; i < lista.length; i++) {
        var s = lista[i] && lista[i].SERVICO;
        if (s && servicos.indexOf(s) === -1) servicos.push(s);
      }
    }

    addServicos(obrasFundeinfraData);
    addServicos(obrasDorData);

    servicos.sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    servicos.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
  }

  function obterFeaturesZoomServicos() {
    if (!sreData || !sreData.features) return [];

    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';

    var feats = [];
    for (var i = 0; i < sreData.features.length; i++) {
      var f = sreData.features[i];
      var nmMun = valorSeguro(f, 'NM_MUN');
      var rgPlan = valorSeguro(f, 'RG_PLAN');
      var rodovia = nomeRodoviaFeature(f);
      var sre = nomeSREFeature(f);

      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) continue;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) continue;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) continue;
      if (sreSelecionado && sre !== sreSelecionado) continue;
      if (propostaSelecionada) {
        var dados = dadosFundeinfraDaFeature(f);
        if (!dados || String(dados.PROPOSTA) !== String(propostaSelecionada)) continue;
      }

      feats.push(f);
    }
    return feats;
  }

  function preencherRodovias() {
    var select = document.getElementById('rodoviaSelect');
    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rodovias = [];

    select.innerHTML = '<option value="">Todas</option>';

    function considerarFeature(feature) {
      var nome = nomeRodoviaFeature(feature);
      var nmMun = valorSeguro(feature, 'NM_MUN');
      var rgPlan = valorSeguro(feature, 'RG_PLAN');

      if (!valorSeguro(feature, 'LINK_FUND') || !dadosFundeinfraDaFeature(feature)) return;
      if (!nome) return;
      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodovias.indexOf(nome) === -1) rodovias.push(nome);
    }

    if (sreData && sreData.features) {
      sreData.features.forEach(considerarFeature);
    }

    rodovias.sort(function(a,b){ return String(a).localeCompare(String(b), 'pt-BR'); });
    rodovias.forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      select.appendChild(opt);
    });
  }

  function preencherMunicipios() {
    var select = document.getElementById('municipioSelect');
    var nomes = [];
    select.innerHTML = '<option value="">Todos</option>';

    for (var i = 0; i < municipiosData.features.length; i++) {
      var nome = valorSeguro(municipiosData.features[i], 'NM_MUN');
      if (nome && nomes.indexOf(nome) === -1) nomes.push(nome);
    }

    nomes.sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var j = 0; j < nomes.length; j++) {
      var opt = document.createElement('option');
      opt.value = nomes[j];
      opt.textContent = nomes[j];
      select.appendChild(opt);
    }
  }

  function atualizarMunicipiosPorRegiao() {
    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var select = document.getElementById('municipioSelect');
    var nomes = [];
    select.innerHTML = '<option value="">Todos</option>';

    for (var i = 0; i < municipiosData.features.length; i++) {
      var f = municipiosData.features[i];
      var nome = valorSeguro(f, 'NM_MUN');
      var rg = valorSeguro(f, 'RG_PLAN');

      if (nome && (!rgSelecionada || rg === rgSelecionada) && nomes.indexOf(nome) === -1) {
        nomes.push(nome);
      }
    }

    nomes.sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var j = 0; j < nomes.length; j++) {
      var opt = document.createElement('option');
      opt.value = nomes[j];
      opt.textContent = nomes[j];
      select.appendChild(opt);
    }
  }

  function preencherLocalidades() {
    var select = document.getElementById('localidadeSelect');
    var nomes = [];
    select.innerHTML = '<option value="">Todas</option>';

    for (var i = 0; i < localidadesData.features.length; i++) {
      var nome = valorSeguro(localidadesData.features[i], 'NOME_ACEN');
      if (nome && nomes.indexOf(nome) === -1) nomes.push(nome);
    }

    nomes.sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var j = 0; j < nomes.length; j++) {
      var opt = document.createElement('option');
      opt.value = nomes[j];
      opt.textContent = nomes[j];
      select.appendChild(opt);
    }
  }

  function resetarBotoesPrograma() {
    var botoes = document.querySelectorAll('.programa-btn');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.remove('ativo-filtro');
      botoes[i].classList.remove('ativo-municipio');
    }
  }

    function resetarBotoesServico() {
    var botoes = document.querySelectorAll('.servico-btn');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.remove('ativo-filtro');
      botoes[i].classList.remove('ativo-municipio');
    }
  }

  function resetarSelectServico() {
    document.getElementById('servicoSelect').value = '';
    servicoFiltroAtivo = '';
  }

  function resetarBotaoOAE() {
    var botao = document.getElementById('toggleOAE');
    if (!botao) return;
    botao.classList.remove('ativo-filtro');
    botao.classList.remove('ativo-municipio');
  }

  function atualizarIndicadoresProgramaMunicipio(nomeMunicipio) {
    resetarBotoesPrograma();
  }

  function atualizarIndicadoresServicoEOAE(nomeMunicipio) {
    resetarBotoesServico();
    resetarBotaoOAE();

    var botoesServicoGerais = document.querySelectorAll('.servico-btn');
    for (var x = 0; x < botoesServicoGerais.length; x++) {
      var chaveGeral = botoesServicoGerais[x].getAttribute('data-servico');
      if (servicosAtivos[chaveGeral]) {
        botoesServicoGerais[x].classList.add('ativo-filtro');
      }
    }
  }

  function municipiosFiltrados() {
    var rg = document.getElementById('rgPlanSelect').value;
    var municipio = document.getElementById('municipioSelect').value;
    var lista = [];

    for (var i = 0; i < municipiosData.features.length; i++) {
      var f = municipiosData.features[i];
      var nome = valorSeguro(f, 'NM_MUN');
      var rgPlan = valorSeguro(f, 'RG_PLAN');

      if (rg && rgPlan !== rg) continue;
      if (municipio && nome !== municipio) continue;

      lista.push(f);
    }

    return lista;
  }

  function ehGoias(feature) {
    var props = feature.properties || {};
    var candidatos = [
      props.SIGLA_UF, props.UF, props.SIGLA, props.sg_uf,
      props.NM_UF, props.nome, props.NOME, props.estado
    ];

    for (var i = 0; i < candidatos.length; i++) {
      var v = String(candidatos[i] || '').trim().toUpperCase();
      if (v === 'GO' || v === 'GOIÁS' || v === 'GOIAS') return true;
    }
    return false;
  }

  function desenharEstados() {
    if (!estadosData) return;
    if (estadosLayer) map.removeLayer(estadosLayer);

    estadosLayer = L.geoJSON(estadosData, {
      style: function(feature) {
        if (ehGoias(feature)) {
          return {
            color: '#666666',
            weight: 1,
            fillColor: '#ffffff',
            fillOpacity: 0
          };
        }
        return {
          color: '#666666',
          weight: 1,
          fillColor: '#808080',
          fillOpacity: 0.28
        };
      }
    }).addTo(map);
  }

  function desenharMunicipiosBase(featuresSelecionados) {
    if (municipiosLayer) map.removeLayer(municipiosLayer);

    if (!municipioBaseFiltroAtivo) {
      municipiosLayer = null;
      return;
    }

    var selecionados = new Set(
      (featuresSelecionados || []).map(function(f) {
        return valorSeguro(f, 'NM_MUN');
      })
    );

    var haSelecao = selecionados.size > 0 &&
                    selecionados.size < municipiosData.features.length;

    municipiosLayer = L.geoJSON(municipiosData, {
      interactive: false,
      style: function(feature) {
        var nome = valorSeguro(feature, 'NM_MUN');
        var selecionado = selecionados.has(nome);

        if (!haSelecao) {
          return {
            color: '#888888',
            weight: 1,
            dashArray: '8, 5, 1, 5',
            fillColor: '#ffffff',
            fillOpacity: 0
          };
        }

        if (selecionado) {
          return {
            color: '#888888',
            weight: 1.5,
            dashArray: '8, 5, 1, 5',
            fillColor: '#ffffff',
            fillOpacity: 0
          };
        }

        return {
          color: '#888888',
          weight: 1.5,
          dashArray: '8, 5, 1, 5',
          fillColor: '#808080',
          fillOpacity: 0.28
        };
      }
    }).addTo(map);
  }

  function desenharLocalidades() {
    if (!localidadeFiltroAtivo) {
      if (localidadesLayer) { map.removeLayer(localidadesLayer); localidadesLayer = null; }
      return;
    }

    if (localidadesLayer) map.removeLayer(localidadesLayer);

    var localidadeSelecionada = document.getElementById('localidadeSelect').value;

    var featuresFiltradas = localidadesData.features.filter(function(feature) {
      var nome = valorSeguro(feature, 'NOME_ACEN');
      if (localidadeSelecionada && nome !== localidadeSelecionada) return false;
      return true;
    });

    // Ordenar por POPULACAO decrescente para priorizar rótulos
    featuresFiltradas.sort(function(a, b) {
      var popA = numeroSeguro(valorSeguro(a, 'POPULACAO'));
      var popB = numeroSeguro(valorSeguro(b, 'POPULACAO'));
      return popB - popA;
    });

    localidadesLayer = L.layerGroup();

    featuresFiltradas.forEach(function(feature) {
      var coords = feature.geometry.coordinates[0]; // MultiPoint, pegar primeiro ponto
      var latlng = [coords[1], coords[0]]; // GeoJSON é [lng, lat]
      var nome = valorSeguro(feature, 'NOME_ACEN');
      var populacao = numeroSeguro(valorSeguro(feature, 'POPULACAO'));

            // Criar marcador para o ponto
            var marker = L.circleMarker(latlng, {
              pane: 'localidadesPane',
              color: '#000000',
        fillColor: '#ffffff',
        fillOpacity: 1,
        radius: 5,
        weight: 1.5,
        populacao: populacao,
        nomeLocalidade: nome
      });

      // Adicionar popup
      marker.bindPopup('<b>' + nome + '</b><br>População: ' + populacao.toLocaleString('pt-BR'));

      localidadesLayer.addLayer(marker);

            // Adicionar rótulo baseado no zoom e população
      var label = L.marker(latlng, {
        pane: 'localidadesPane',
        icon: L.divIcon({
          className: 'localidade-label',
          html: '<div class="label-text">' + nome + '</div>',
          iconSize: [0, 0],
          iconAnchor: [-5, 20]
        }),
        populacao: populacao,
        nomeLocalidade: nome
      });

      localidadesLayer.addLayer(label);
    });

    localidadesLayer.addTo(map);

    // Atualizar visibilidade dos rótulos baseado no zoom
    atualizarVisibilidadeRotulos();
  }

    function atualizarVisibilidadeRotulos() {
    if (!localidadesLayer) return;

    var zoom = map.getZoom();
    var labels = [];
    var pontos = [];

    // Coletar todos os layers separando rótulos e pontos
    localidadesLayer.eachLayer(function(layer) {
      if (layer.options && layer.options.icon && layer.options.icon.options.className === 'localidade-label') {
        var populacao = layer.options.populacao;
        var latlng = layer.getLatLng();
        var pixelPos = map.latLngToContainerPoint(latlng);

        labels.push({
          layer: layer,
          populacao: populacao,
          nomeLocalidade: layer.options.nomeLocalidade || '',
          pixelPos: pixelPos,
          visible: false
        });
      } else if (layer instanceof L.CircleMarker) {
        pontos.push({
          layer: layer,
          populacao: layer.options.populacao || 0,
          nomeLocalidade: layer.options.nomeLocalidade || '',
          latlng: layer.getLatLng()
        });
      }
    });

    // Ordenar por população decrescente
    labels.sort(function(a, b) {
      return b.populacao - a.populacao;
    });

    var occupiedAreas = [];

    labels.forEach(function(label) {
      // Goiânia fica sempre visível
      if (label.nomeLocalidade === 'Goiânia') {
        label.layer.getElement().style.display = 'block';
        var labelRect = {
          left: label.pixelPos.x - 60,
          right: label.pixelPos.x + 60,
          top: label.pixelPos.y - 18,
          bottom: label.pixelPos.y + 6
        };
        occupiedAreas.push(labelRect);
        return;
      }

      var zoomNecessario;
      if (label.populacao > 0) {
        zoomNecessario = Math.max(8, 15 - Math.log10(label.populacao) * 2);
      } else {
        zoomNecessario = 12;
      }

      if (zoom < zoomNecessario) {
        label.layer.getElement().style.display = 'none';
        return;
      }

      // Verificar sobreposição
      var labelRect = {
        left: label.pixelPos.x - 60,
        right: label.pixelPos.x + 60,
        top: label.pixelPos.y - 18,
        bottom: label.pixelPos.y + 6
      };

      var overlaps = occupiedAreas.some(function(area) {
        return !(labelRect.right < area.left || labelRect.left > area.right ||
                 labelRect.bottom < area.top || labelRect.top > area.bottom);
      });

      if (!overlaps) {
        label.layer.getElement().style.display = 'block';
        occupiedAreas.push(labelRect);
      } else {
        label.layer.getElement().style.display = 'none';
      }
    });

    // Controlar visibilidade dos pontos (bolinhas brancas) com a MESMA lógica dos rótulos
    pontos.forEach(function(ponto) {
      if (!ponto.layer.getElement()) return;

      // Goiânia fica sempre visível
      if (ponto.nomeLocalidade === 'Goiânia') {
        ponto.layer.getElement().style.display = 'block';
        return;
      }

      var zoomNecessario;
      if (ponto.populacao > 0) {
        zoomNecessario = Math.max(8, 15 - Math.log10(ponto.populacao) * 2);
      } else {
        zoomNecessario = 12;
      }

      if (zoom >= zoomNecessario) {
        ponto.layer.getElement().style.display = 'block';
      } else {
        ponto.layer.getElement().style.display = 'none';
      }
    });
  }

  function criarMarcadorLabel(latlng, texto, rodovia) {
    return L.marker(latlng, {
      icon: L.divIcon({
        className: 'sre-label-escudo',
        html: '<div class="sre-escudo-circular">' + texto + '</div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
      rodovia: rodovia
    });
  }

    function atualizarVisibilidadeRotulosSRE() {
    if (!sreBaseLabelLayer && !snvLabelLayer) return;

    var zoom = map.getZoom();
    var labels = [];

    // --- COLETAR ÁREAS OCUPADAS PELOS RÓTULOS DE LOCALIDADES (prioridade) ---
    var occupiedAreas = [];

    if (localidadesLayer && localidadeFiltroAtivo) {
      localidadesLayer.eachLayer(function(layer) {
        // Rótulos de localidades
        if (layer.options && layer.options.icon && layer.options.icon.options.className === 'localidade-label') {
          var el = layer.getElement();
          if (el && el.style.display !== 'none') {
            var latlngLoc = layer.getLatLng();
            var pixelPosLoc = map.latLngToContainerPoint(latlngLoc);
            occupiedAreas.push({
              left: pixelPosLoc.x - 60,
              right: pixelPosLoc.x + 60,
              top: pixelPosLoc.y - 18,
              bottom: pixelPosLoc.y + 6
            });
          }
        }
        // Pontos das localidades (bolinhas brancas)
        else if (layer instanceof L.CircleMarker) {
          var elPonto = layer.getElement();
          if (elPonto && elPonto.style.display !== 'none') {
            var latlngPonto = layer.getLatLng();
            var pixelPosPonto = map.latLngToContainerPoint(latlngPonto);
            occupiedAreas.push({
              left: pixelPosPonto.x - 5,
              right: pixelPosPonto.x + 5,
              top: pixelPosPonto.y - 5,
              bottom: pixelPosPonto.y + 5
            });
          }
        }
      });
    }

    // Coletar labels do SRE Base
    if (sreBaseLabelLayer) {
      sreBaseLabelLayer.eachLayer(function(layer) {
        var latlng = layer.getLatLng();
        var pixelPos = map.latLngToContainerPoint(latlng);
        labels.push({
          layer: layer,
          pixelPos: pixelPos,
          rodovia: layer.options.rodovia || ''
        });
      });
    }

    // Coletar labels do SNV
    if (snvLabelLayer) {
      snvLabelLayer.eachLayer(function(layer) {
        var latlng = layer.getLatLng();
        var pixelPos = map.latLngToContainerPoint(latlng);
        labels.push({
          layer: layer,
          pixelPos: pixelPos,
          rodovia: layer.options.rodovia || ''
        });
      });
    }

    labels.forEach(function(label) {
      var zoomNecessario;
      if (zoom >= 10) {
        zoomNecessario = 9;
      } else if (zoom >= 9) {
        zoomNecessario = 9;
      } else {
        zoomNecessario = 99;
      }

      if (zoom < zoomNecessario) {
        if (label.layer.getElement()) {
          label.layer.getElement().style.display = 'none';
        }
        return;
      }

      // Verificar sobreposição entre escudos e com labels de localidades
      var labelRect = {
        left: label.pixelPos.x - 18,
        right: label.pixelPos.x + 18,
        top: label.pixelPos.y - 18,
        bottom: label.pixelPos.y + 18
      };

      var overlaps = occupiedAreas.some(function(area) {
        return !(labelRect.right < area.left || labelRect.left > area.right ||
                 labelRect.bottom < area.top || labelRect.top > area.bottom);
      });

      if (!overlaps) {
        if (label.layer.getElement()) {
          label.layer.getElement().style.display = 'block';
        }
        occupiedAreas.push(labelRect);
      } else {
        if (label.layer.getElement()) {
          label.layer.getElement().style.display = 'none';
        }
      }
    });
  }

  function desenharSREBase() {
    if (!sreBaseFiltroAtivo) {
      if (sreBaseLayer) { map.removeLayer(sreBaseLayer); sreBaseLayer = null; }
      if (sreBaseLabelLayer) { map.removeLayer(sreBaseLabelLayer); sreBaseLabelLayer = null; }
      return {};
    }
    if (!sreBaseData || !sreBaseData.features) return {};
    if (sreBaseLayer) map.removeLayer(sreBaseLayer);

    var dup = [];
    var eod = [];
    var eop = [];
    var pav = [];
    var imp = [];
    var len = [];
    var pla = [];

    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;

    for (var i = 0; i < sreBaseData.features.length; i++) {
      var f = sreBaseData.features[i];
      if (rodoviaSelecionada && nomeRodoviaFeature(f) !== rodoviaSelecionada) continue;
      if (sreSelecionado && nomeSREFeature(f) !== sreSelecionado) continue;
      var s = String(valorSeguro(f, 'situacao') || valorSeguro(f, 'SITUACAO')).toUpperCase();
      if (s === 'DUP') dup.push(f);
      else if (s === 'EOD') eod.push(f);
      else if (s === 'EOP') eop.push(f);
      else if (s === 'PAV') pav.push(f);
      else if (s === 'IMP') imp.push(f);
      else if (s === 'LEN') len.push(f);
      else if (s === 'PLA') pla.push(f);
      else pav.push(f);
    }

    var grupo = L.layerGroup();

    function addSimple(features, style) {
      if (!features.length) return;
      grupo.addLayer(L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'sreBasePane',
        style: function() { return style; },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupRodoviaBase(feature));
        }
      }));
    }

    if (dup.length) {
      grupo.addLayer(L.geoJSON({
        type: 'FeatureCollection',
        features: dup
      }, {
        pane: 'sreBasePane',
        style: function() {
          return { color:'#ef2020', weight:4, opacity:0.95 };
        }
      }));
      grupo.addLayer(L.geoJSON({
        type: 'FeatureCollection',
        features: dup
      }, {
        pane: 'sreBasePane',
        style: function() {
          return { color:'#ffffff', weight:1, opacity:1 };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupRodoviaBase(feature));
        }
      }));
    }

    if (eod.length) {
      grupo.addLayer(L.geoJSON({
        type: 'FeatureCollection',
        features: eod
      }, {
        pane: 'sreBasePane',
        style: function() {
          return { color:'#ef2020', weight:3, opacity:0.95 };
        }
      }));
      grupo.addLayer(L.geoJSON({
        type: 'FeatureCollection',
        features: eod
      }, {
        pane: 'sreBasePane',
        style: function() {
          return { color:'#ffffff', weight:1.2, opacity:1, dashArray:'6,4' };
        }
      }));
    }

    addSimple(eop, { color:'#ef2020', weight:2.2, opacity:0.95, dashArray:'12,8' });
    addSimple(pav, { color:'#ef2020', weight:2.2, opacity:0.95 });
    addSimple(imp, { color:'#f08a00', weight:2.2, opacity:0.95 });
    addSimple(len, { color:'#f08a00', weight:2.2, opacity:0.95 });
    addSimple(pla, { color:'#000000', weight:2.2, opacity:0.95 });

    sreBaseLayer = grupo.addTo(map);

    // --- CRIAR RÓTULOS EM FORMA DE CÍRCULO PARA OS TRECHOS ---
    if (sreBaseLabelLayer) {
      map.removeLayer(sreBaseLabelLayer);
      sreBaseLabelLayer = null;
    }
    sreBaseLabelLayer = L.layerGroup();

    var todosFeatures = [].concat(dup, eod, eop, pav, imp, len, pla);

    todosFeatures.forEach(function(feature) {
      var rodovia = nomeRodoviaFeature(feature);
      if (!rodovia) return;

      // Extrair os 3 últimos dígitos (ex: GO-338 -> 338)
      var partes = rodovia.split('-');
      var numeroRodovia = partes.length > 1 ? partes[1] : rodovia;
      var ultimos3Digitos = numeroRodovia.slice(-3);

      // Obter o ponto médio da LineString para posicionar o label
      var coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      var midIndex = Math.floor(coords.length / 2);
      var midCoord = coords[midIndex];
      var latlng = [midCoord[1], midCoord[0]];

      var labelLayer = criarMarcadorLabel(latlng, ultimos3Digitos, rodovia);
      sreBaseLabelLayer.addLayer(labelLayer);
    });

    sreBaseLabelLayer.addTo(map);
    atualizarVisibilidadeRotulosSRE();

    var vis = {};
    if (dup.length) vis.DUP = true;
    if (pav.length) vis.PAV = true;
    if (eod.length) vis.EOD = true;
    if (eop.length) vis.EOP = true;
    if (imp.length) vis.IMP = true;
    if (len.length) vis.LEN = true;
    if (pla.length) vis.PLA = true;
    return vis;
  }

    function desenharSNV() {
    if (!snvFiltroAtivo) {
      if (snvLayer) { map.removeLayer(snvLayer); snvLayer = null; }
      if (snvLabelLayer) { map.removeLayer(snvLabelLayer); snvLabelLayer = null; }
      return {};
    }
    if (!snvData || !snvData.features) return {};
    if (snvLayer) map.removeLayer(snvLayer);

    function estiloSNV(feature) {
      var s = String(valorSeguro(feature, 'SITUACAO')).toUpperCase();

      if (s === 'LEN') {
        return {
          pane: 'snvPane',
          color: '#e59b00',
          weight: 1,
          opacity: 0.95
        };
      }

      if (s === 'EOP') {
        return {
          pane: 'snvPane',
          color: '#33a21a',
          weight: 1,
          opacity: 0.95,
          dashArray: '14,10'
        };
      }

      return {
        pane: 'snvPane',
        color: '#33a21a',
        weight: 1,
        opacity: 0.95
      };
    }

    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;

    var pavLenEop = snvData.features.filter(function(f) {
      if (rodoviaSelecionada && nomeRodoviaFeature(f) !== rodoviaSelecionada) return false;
      if (sreSelecionado && nomeSREFeature(f) !== sreSelecionado) return false;
      return String(valorSeguro(f, 'SITUACAO')).toUpperCase() !== 'DUP';
    });

    var dup = snvData.features.filter(function(f) {
      if (rodoviaSelecionada && nomeRodoviaFeature(f) !== rodoviaSelecionada) return false;
      if (sreSelecionado && nomeSREFeature(f) !== sreSelecionado) return false;
      return String(valorSeguro(f, 'SITUACAO')).toUpperCase() === 'DUP';
    });

    var grupo = L.layerGroup();

    if (pavLenEop.length) {
      var camadaBase = L.geoJSON({
        type: 'FeatureCollection',
        features: pavLenEop
      }, {
        style: estiloSNV,
        onEachFeature: function(feature, layer) {
          var p = feature.properties || {};
          var nome = p.RODOVIA || p.SNV || '';
          layer.bindPopup(
            '<b>Rodovia:</b> ' + (p.RODOVIA || '') + '<br>' +
            '<b>SNV:</b> ' + (p.SNV || '') + '<br>' +
            '<b>Trecho:</b> ' + (p.TRECHO || '') + '<br>' +
            '<b>Extensão (km):</b> ' + (p.EXT_KM || '') + '<br>' +
            '<b>Situação:</b> ' + (p.SITUACAO || '')
          );
        }
      });
      grupo.addLayer(camadaBase);
    }

    if (dup.length) {
      var dupBase = L.geoJSON({
        type: 'FeatureCollection',
        features: dup
      }, {
        style: function() {
          return {
            pane: 'snvPane',
            color: '#33a21a',
            weight: 3,
            opacity: 0.95
          };
        }
      });

      var dupMiolo = L.geoJSON({
        type: 'FeatureCollection',
        features: dup
      }, {
        style: function() {
          return {
            pane: 'snvPane',
            color: '#ffffff',
            weight: 1,
            opacity: 1
          };
        },
        onEachFeature: function(feature, layer) {
          var p = feature.properties || {};
          var nome = p.RODOVIA || p.SNV || '';
          layer.bindPopup(
            '<b>Rodovia:</b> ' + (p.RODOVIA || '') + '<br>' +
            '<b>SNV:</b> ' + (p.SNV || '') + '<br>' +
            '<b>Trecho:</b> ' + (p.TRECHO || '') + '<br>' +
            '<b>Extensão (km):</b> ' + (p.EXT_KM || '') + '<br>' +
            '<b>Situação:</b> ' + (p.SITUACAO || '')
          );
        }
      });

      grupo.addLayer(dupBase);
      grupo.addLayer(dupMiolo);
    }

    snvLayer = grupo.addTo(map);

    // --- CRIAR RÓTULOS EM FORMA DE CÍRCULO PARA OS TRECHOS SNV ---
    if (snvLabelLayer) {
      map.removeLayer(snvLabelLayer);
      snvLabelLayer = null;
    }
    snvLabelLayer = L.layerGroup();

    var todosSnvFeatures = [].concat(dup, pavLenEop);
    todosSnvFeatures.forEach(function(feature) {
      var rodovia = valorSeguro(feature, 'RODOVIA');
      if (!rodovia) rodovia = valorSeguro(feature, 'SNV');
      if (!rodovia) return;

      // Extrair os 3 últimos dígitos (ex: GO-338 -> 338)
      var partes = rodovia.split('-');
      var numeroRodovia = partes.length > 1 ? partes[1] : rodovia;
      var ultimos3Digitos = numeroRodovia.slice(-3);

      // Obter o ponto médio da LineString para posicionar o label
      var coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      var midIndex = Math.floor(coords.length / 2);
      var midCoord = coords[midIndex];
      var latlng = [midCoord[1], midCoord[0]];

      var labelLayer = criarMarcadorLabel(latlng, ultimos3Digitos, rodovia);
      snvLabelLayer.addLayer(labelLayer);
    });

    snvLabelLayer.addTo(map);
    atualizarVisibilidadeRotulosSRE();

    var vis = {};
    if (dup.length) vis.DUP = true;
    pavLenEop.forEach(function(f) {
      var s = String(valorSeguro(f, 'SITUACAO')).toUpperCase();
      if (s) vis[s] = true;
    });
    return vis;
  }

  function comparar(valorFeature, comparador, valorRegra) {
    if (comparador === '=') return String(valorFeature) === String(valorRegra);
    if (comparador === '>') return numeroSeguro(valorFeature) > numeroSeguro(valorRegra);
    if (comparador === '>=') return numeroSeguro(valorFeature) >= numeroSeguro(valorRegra);
    if (comparador === '<') return numeroSeguro(valorFeature) < numeroSeguro(valorRegra);
    if (comparador === '<=') return numeroSeguro(valorFeature) <= numeroSeguro(valorRegra);
    return false;
  }

  function regraAtendida(feature, regra) {
    var condicoes = regra.regra.condicoes || [];
    var op = regra.regra.op || 'AND';

    if (op === 'OR') {
      for (var i = 0; i < condicoes.length; i++) {
        var c = condicoes[i];
        if (!servicosAtivos[c.grupo]) continue;
        if (comparar(valorSeguro(feature, c.campo), c.comparador, c.valor)) return true;
      }
      return false;
    }

    for (var j = 0; j < condicoes.length; j++) {
      var c2 = condicoes[j];
      if (!servicosAtivos[c2.grupo]) return false;
      if (!comparar(valorSeguro(feature, c2.campo), c2.comparador, c2.valor)) return false;
    }
    return true;
  }


    function dadosFundeinfraDaFeature(feature) {
    var link = valorSeguro(feature, 'LINK_FUND');
    if (!link) return null;
    return obrasFundeinfraPorLink[String(link)] || null;
  }

  function dadosDorDaFeature(feature) {
    var link = valorSeguro(feature, 'LINK_DOR');
    if (!link) return null;
    return obrasDorPorLink[String(link)] || null;
  }

    function estiloDor(dados) {
      var servico = String((dados && dados.SERVICO) || '').toLowerCase();
      var cor = '#666666';

      if (servico.indexOf('pavimenta') >= 0) cor = '#dc0101';
      else if (servico.indexOf('duplica') >= 0) cor = '#001efe';
      else if (servico.indexOf('restaura') >= 0) cor = '#10a000';
      else if (servico.indexOf('melhoria') >= 0) cor = '#ff9601';
      else if (servico === 'drenagem') cor = '#b398f3';
      else if (servico.indexOf('amplia') >= 0) cor = '#ff7bbd';
      else if (servico.indexOf('reforma') >= 0) cor = '#14b8a6';

      return {
        cor: cor,
        tipo_linha: 'NORMAL',
        espessura: 7,
        legenda: ((dados && dados.SERVICO) || 'Serviço') + ' - ' + ((dados && dados.ETAPA) || 'Etapa')
      };
    }

  function estiloFundeinfra(dados) {
    var servico = String((dados && dados.SERVICO) || '').toLowerCase();
    var etapa = String((dados && dados.ETAPA) || '').toLowerCase();
    var cor = '#666666';

    if (servico.indexOf('pavimenta') >= 0) cor = '#dc0101';
    else if (servico.indexOf('duplica') >= 0) cor = '#001efe';
    else if (servico.indexOf('restaura') >= 0) cor = '#10a000';
    else if (servico.indexOf('melhoria') >= 0) cor = '#ff9601';

    return {
      cor: cor,
      tipo_linha: etapa.indexOf('projeto') >= 0 ? 'COM LINHA BRANCA' : 'NORMAL',
      espessura: 9,
      legenda: ((dados && dados.SERVICO) || 'Serviço') + ' - ' + ((dados && dados.ETAPA) || 'Etapa')
    };
  }

    function construirPopupLinha(feature) {
      var p = feature.properties || {};
      var dadosFund = dadosFundeinfraDaFeature(feature);
      var dadosDor = dadosDorDaFeature(feature);

      var html = '';
      html += '<b>SRE:</b> ' + escapeHtml(p.sre || p.SRE || '') + '<br>';
      html += '<b>Rodovia:</b> ' + escapeHtml(p.RODOVIA || p.rodovia || '') + '<br>';
      html += '<b>Trecho:</b> ' + escapeHtml(p.TRECHO || p.trecho_go || '') + '<br>';
      html += '<b>Extensão:</b> ' + escapeHtml(p.EXT_KM || '') + ' km<br>';

      if (dadosFund) {
        html += '<br><b>— FUNDEINFRA —</b><br>';
        html += '<b>Proposta:</b> ' + escapeHtml(dadosFund.PROPOSTA || '') + '<br>';
        html += '<b>Serviço:</b> ' + escapeHtml(dadosFund.SERVICO || '') + '<br>';
        html += '<b>Etapa:</b> ' + escapeHtml(dadosFund.ETAPA || '') + '<br>';
        html += '<b>Status:</b> ' + escapeHtml(dadosFund.STATUS || '') + '<br>';
        html += '<b>SEI:</b> ' + escapeHtml(dadosFund.SEI || '') + '<br>';
        html += '<b>Conclusão:</b> ' + escapeHtml(dadosFund.CONCLUSAO || '');
      }

      if (dadosDor) {
        html += '<br><br><b>— DOR —</b><br>';
        html += '<b>Proposta:</b> ' + escapeHtml(dadosDor.PROPOSTA || '') + '<br>';
        html += '<b>Serviço:</b> ' + escapeHtml(dadosDor.SERVICO || '') + '<br>';
        html += '<b>Etapa:</b> ' + escapeHtml(dadosDor.ETAPA || '') + '<br>';
        html += '<b>Status:</b> ' + escapeHtml(dadosDor.STATUS || '') + '<br>';
        html += '<b>SEI:</b> ' + escapeHtml(dadosDor.SEI || '') + '<br>';
        html += '<b>Conclusão:</b> ' + escapeHtml(dadosDor.CONCLUSAO || '');
      }

      return html;
    }

    function construirLayerNormal(features, cor, espessura) {
      return L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        style: function() {
          return {
            color: cor,
            weight: espessura,
            opacity: 0.95
          };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupLinha(feature));

          layer.on('click', function() {
            atualizarPainelInferior(feature);
          });
        }
      });
    }

    function construirLayerLinhaBranca(features, cor, espessura) {
      var pesoBase = 9;
      var pesoTopo = 4.5;

      var base = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        style: function() {
          return {
            color: cor,
            weight: pesoBase,
            opacity: 0.95
          };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupLinha(feature));

          layer.on('click', function() {
            atualizarPainelInferior(feature);
          });
        }
      });

      var topo = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        style: function() {
          return {
            color: '#ffffff',
            weight: pesoTopo,
            opacity: 1
          };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupLinha(feature));

          layer.on('click', function() {
            atualizarPainelInferior(feature);
          });
        }
      });

      return L.layerGroup([base, topo]);
    }
  
  function criarLegendaLinha(tipo, cor) {
    if (tipo === 'dup') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha-dup-base" style="height:1px;background:' + cor + ';"></span>' +
        '<span class="legenda-linha-dup-miolo" style="height:1px;"></span>' +
      '</span>';
    }
    if (tipo === 'dashed-red') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha-eod-base" style="height:1px;background:' + cor + ';"></span>' +
        '<span class="legenda-linha-eod-miolo" style="border-top:1px dashed ' + cor + '; background:transparent; height:0;"></span>' +
      '</span>';
    }
    if (tipo === 'dashed-green') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha legenda-linha-tracejada" style="border-top-color:' + cor + '; border-top-width:1px;"></span>' +
      '</span>';
    }
    return '<span class="legenda-linha-wrap">' +
      '<span class="legenda-linha" style="height:1px;background:' + cor + ';"></span>' +
    '</span>';
  }

    function renderizarLegendaServicos(legendasVisiveis) {
    var alvo = document.getElementById('legendaServicos'); if(!alvo) return;
    var bloco = document.getElementById('legendaServicos').closest('.bloco');
    alvo.innerHTML = '';

    var total = 0;
    var nomes = Object.keys(legendasVisiveis || {}).sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var i = 0; i < nomes.length; i++) {
      var legenda = nomes[i];
      var cor = legendasVisiveis[legenda] || '#666666';
      var projeto = String(legenda).toLowerCase().indexOf('projeto') >= 0;
      var item = document.createElement('div');
      item.className = 'legenda-item';

      if (projeto) {
        item.innerHTML =
          '<span class="legenda-linha-wrap">' +
            '<span class="legenda-linha-projeto-base" style="height:9px;background:' + cor + ';"></span>' +
            '<span class="legenda-linha-projeto-topo" style="height:4.5px;"></span>' +
          '</span>' +
          legenda;
      } else {
        item.innerHTML =
          '<span class="legenda-linha-wrap">' +
            '<span class="legenda-linha" style="height:9px;background:' + cor + ';"></span>' +
          '</span>' +
          legenda;
      }

      alvo.appendChild(item);
      total++;
    }

    bloco.style.display = total > 0 ? '' : 'none';
  }

    function renderizarLegendaDor(legendasVisiveis) {
    var alvo = document.getElementById('legendaDor'); if(!alvo) return;
    var bloco = document.getElementById('legendaDor').closest('.bloco');
    alvo.innerHTML = '';

    var total = 0;
    var nomes = Object.keys(legendasVisiveis || {}).sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var i = 0; i < nomes.length; i++) {
      var legenda = nomes[i];
      var cor = legendasVisiveis[legenda] || '#666666';
      var item = document.createElement('div');
      item.className = 'legenda-item';
      item.innerHTML =
        '<span class="legenda-linha-wrap">' +
          '<span class="legenda-linha" style="height:7px;background:' + cor + ';"></span>' +
        '</span>' +
        legenda;
      alvo.appendChild(item);
      total++;
    }

    bloco.style.display = total > 0 ? '' : 'none';
  }

  function renderizarLegendaOAE(eixosVisiveis) {
    var alvo = document.getElementById('legendaOAE'); if(!alvo) return;
    var bloco = document.getElementById('blocoLegendaOAE');
    alvo.innerHTML = '';
    var total = 0;
    var ordem = [1,2,3,4,5,6,100,101];
    for (var i = 0; i < ordem.length; i++) {
      var e = ordem[i];
      if (!eixosVisiveis || !eixosVisiveis[e]) continue;
      total++;
      var info = OAE_LEGENDA_INFO[e];
      var item = document.createElement('div');
      item.className = 'legenda-item';
      item.innerHTML = '<span class="legenda-simbolo" style="background:' + info.cor + ';"></span>' +
        '<div class="legenda-texto"><b>' + info.titulo + '</b>' + (info.desc ? ' — ' + info.desc : '') + '</div>';
      alvo.appendChild(item);
    }
    bloco.style.display = total > 0 ? '' : 'none';
  }

  function renderizarLegendaRodEst(situacoesVisiveis) {
    var bloco = document.getElementById('blocoLegendaRodEst');
    var alvo = document.getElementById('legendaRodEst');
    if (!bloco || !alvo) return;
    if (typeof sreBaseFiltroAtivo !== 'undefined' && !sreBaseFiltroAtivo) {
      alvo.innerHTML = '';
      bloco.style.display = 'none';
      return;
    }
    
    alvo.innerHTML = '';
    var ordem = ['DUP','PAV','EOD','EOP','IMP','LEN','PLA'];
    var total = 0;
    for (var i = 0; i < ordem.length; i++) {
      var s = ordem[i];
      if (!situacoesVisiveis || !situacoesVisiveis[s]) continue;
      total++;
      var info = ROD_EST_INFO[s];
      var item = document.createElement('div');
      item.className = 'legenda-item';
      item.innerHTML = criarLegendaLinha(info.tipo, info.cor) + '<div class="legenda-texto"><b>' + info.label + '</b></div>';
      alvo.appendChild(item);
    }
    bloco.style.display = total > 0 ? '' : 'none';
  }

  function renderizarLegendaRodFed(situacoesVisiveis) {
    var bloco = document.getElementById('blocoLegendaRodFed');
    var alvo = document.getElementById('legendaRodFed');
    if (!bloco || !alvo) return;
    if (typeof snvFiltroAtivo !== 'undefined' && !snvFiltroAtivo) {
      alvo.innerHTML = '';
      bloco.style.display = 'none';
      return;
    }
    
    alvo.innerHTML = '';
    var ordem = ['DUP','LEN','EOP','PAV'];
    var total = 0;
    for (var i = 0; i < ordem.length; i++) {
      var s = ordem[i];
      if (!situacoesVisiveis || !situacoesVisiveis[s]) continue;
      total++;
      var info = ROD_FED_INFO[s];
      var item = document.createElement('div');
      item.className = 'legenda-item';
      item.innerHTML = criarLegendaLinha(info.tipo, info.cor) + '<div class="legenda-texto"><b>' + info.label + '</b></div>';
      alvo.appendChild(item);
    }
    bloco.style.display = total > 0 ? '' : 'none';
  }


  function zoomParaGoias() {
    var bounds = L.geoJSON(municipiosData).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, 20]
      });
    }
  }

  function zoomParaOriginal() {
    map.setView(originalCenter, originalZoom);
  }

  function zoomParaLocalidade(nomeLocalidade) {
    var feature = localidadesData.features.find(function(feature) {
      return valorSeguro(feature, 'NOME_ACEN') === nomeLocalidade;
    });

    if (!feature) {
      zoomParaGoias();
      return;
    }

    var coords = feature.geometry.coordinates[0];
    var latlng = [coords[1], coords[0]];
    var targetZoom = Math.min(map.getMaxZoom(), Math.round(originalZoom + Math.log2(70)));

    map.setView(latlng, targetZoom);
  }

  function zoomParaSelecao(features) {
    if (!features || !features.length) {
      zoomParaGoias();
      return;
    }

    var bounds = L.geoJSON({
      type: 'FeatureCollection',
      features: features
    }).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        paddingTopLeft: [60, 60],
        paddingBottomRight: [60, 60],
        maxZoom: 11
      });
    }
  }

    function desenharLinhasEPontos(featuresMunicipios) {
    limparCamadasRegras();

    if (oaeLayer) {
      map.removeLayer(oaeLayer);
      oaeLayer = null;
    }

    var situacoesFedVisiveis = desenharSNV();
    var situacoesEstVisiveis = desenharSREBase();

    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';

        var linhasBase = [];
    var linksFundIncluidos = {};

        // --- FUNDEINFRA ---
    if (sreData && sreData.features && servicosAtivos.FUNDEINFRA) {
      for (var j = 0; j < sreData.features.length; j++) {
        var f = sreData.features[j];
        var link = valorSeguro(f, 'LINK_FUND');
        if (!link) continue;
        var dadosF = dadosFundeinfraDaFeature(f);
        if (!dadosF) continue;
        if (servicoFiltroAtivo && dadosF.SERVICO !== servicoFiltroAtivo) continue;
        if (rodoviaSelecionada && nomeRodoviaFeature(f) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(f) !== sreSelecionado) continue;
        if (propostaSelecionada) {
          if (!dadosF || String(dadosF.PROPOSTA) !== String(propostaSelecionada)) continue;
        }
        linhasBase.push(f);
        linksFundIncluidos[String(link)] = true;
      }
    }

    // --- DOR (não inclui features que já entraram como FUNDEINFRA) ---
    if (sreData && sreData.features && servicosAtivos.DOR) {
      for (var d = 0; d < sreData.features.length; d++) {
        var fd = sreData.features[d];
        var linkDor = valorSeguro(fd, 'LINK_DOR');
        if (!linkDor) continue;
        var dadosD = dadosDorDaFeature(fd);
        if (!dadosD) continue;
        if (servicoFiltroAtivo && dadosD.SERVICO !== servicoFiltroAtivo) continue;
        // Se já tem LINK_FUND e FUNDEINFRA está ativo, pula (prioridade FUNDEINFRA)
        if (servicosAtivos.FUNDEINFRA && valorSeguro(fd, 'LINK_FUND') && linksFundIncluidos[String(valorSeguro(fd, 'LINK_FUND'))]) continue;
        if (rodoviaSelecionada && nomeRodoviaFeature(fd) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(fd) !== sreSelecionado) continue;
        if (propostaSelecionada) {
          if (!dadosD || String(dadosD.PROPOSTA) !== String(propostaSelecionada)) continue;
        }
        linhasBase.push(fd);
      }
    }

        var grupos = {};
    var servicosVisiveis = {};
    var servicosVisiveisDor = {};
    var idsUnicos = {};

        for (var k = 0; k < linhasBase.length; k++) {
      var feat = linhasBase[k];
      var linkFund = valorSeguro(feat, 'LINK_FUND');
      var linkDor = valorSeguro(feat, 'LINK_DOR');

      var dados, estilo, chaveId;

      // Prioridade FUNDEINFRA se ambos existirem e FUNDEINFRA estiver ativo
      if (linkFund && dadosFundeinfraDaFeature(feat) && servicosAtivos.FUNDEINFRA) {
        dados = dadosFundeinfraDaFeature(feat);
        estilo = estiloFundeinfra(dados);
        chaveId = 'FUND_' + String(linkFund) + '_' + k;
      } else if (linkDor && dadosDorDaFeature(feat) && servicosAtivos.DOR) {
        dados = dadosDorDaFeature(feat);
        estilo = estiloDor(dados);
        chaveId = 'DOR_' + String(linkDor) + '_' + k;
      } else if (linkFund && dadosFundeinfraDaFeature(feat)) {
        dados = dadosFundeinfraDaFeature(feat);
        estilo = estiloFundeinfra(dados);
        chaveId = 'FUND_' + String(linkFund) + '_' + k;
      } else if (linkDor && dadosDorDaFeature(feat)) {
        dados = dadosDorDaFeature(feat);
        estilo = estiloDor(dados);
        chaveId = 'DOR_' + String(linkDor) + '_' + k;
      } else {
        continue;
      }

      var chave = estilo.legenda + '|' + estilo.cor + '|' + estilo.tipo_linha;
      if (!grupos[chave]) grupos[chave] = { features: [], estilo: estilo };
      grupos[chave].features.push(feat);
      if (linkFund) {
        servicosVisiveis[estilo.legenda] = estilo.cor;
      } else {
        servicosVisiveisDor[estilo.legenda] = estilo.cor;
      }
      idsUnicos[chaveId] = true;
    }

    Object.keys(grupos).forEach(function(chave) {
      var grupo = grupos[chave];
      var camada;
      if (grupo.estilo.tipo_linha === 'COM LINHA BRANCA') {
        camada = construirLayerLinhaBranca(grupo.features, grupo.estilo.cor, grupo.estilo.espessura);
      } else if (grupo.estilo.tipo_linha === 'COM LINHA BRANCA DOR') {
        camada = construirLayerLinhaBranca(grupo.features, grupo.estilo.cor, grupo.estilo.espessura);
      } else {
        camada = construirLayerNormal(grupo.features, grupo.estilo.cor, grupo.estilo.espessura);
      }
      camada.addTo(map);
      regraLayers.push(camada);
    });

        document.getElementById('countMunicipios').textContent = featuresMunicipios.length;
    document.getElementById('countLinhas').textContent = Object.keys(idsUnicos).length;

    var countFund = 0;
    var countDor = 0;
    for (var ci = 0; ci < linhasBase.length; ci++) {
      if (valorSeguro(linhasBase[ci], 'LINK_FUND')) countFund++;
      if (valorSeguro(linhasBase[ci], 'LINK_DOR')) countDor++;
    }
    document.getElementById('countOAE').textContent = countFund;
    document.getElementById('countDor').textContent = countDor;

        renderizarLegendaServicos(servicosVisiveis);
    renderizarLegendaDor(servicosVisiveisDor);
    renderizarLegendaOAE({});
    renderizarLegendaRodEst(situacoesEstVisiveis);
    renderizarLegendaRodFed(situacoesFedVisiveis);
  }

    function atualizarPainelInferior(feature) {
      var p = feature.properties || {};
      var dadosFund = dadosFundeinfraDaFeature(feature);
      var dadosDor = dadosDorDaFeature(feature);

      var html = `
        <div class="bloco-servico">
          <div class="titulo-servico titulo-cinza">Dados do SRE</div>
          <table class="tabela-servico">
            <tr><th>SRE</th><th>Rodovia</th><th>Trecho</th><th>Extensão</th></tr>
            <tr>
              <td>${p.sre || p.SRE || ''}</td>
              <td>${p.RODOVIA || p.rodovia || ''}</td>
              <td>${p.TRECHO || p.trecho_go || ''}</td>
              <td>${p.EXT_KM || ''} km</td>
            </tr>
          </table>
        </div>`;

      if (dadosFund) {
        html += `
        <div class="bloco-servico">
          <div class="titulo-servico">Dados FUNDEINFRA</div>
          <table class="tabela-servico">
            <tr><th>Proposta</th><th>Serviço</th><th>Etapa</th><th>Status</th><th>SEI</th><th>Conclusão</th></tr>
            <tr>
              <td>${dadosFund.PROPOSTA || ''}</td>
              <td>${dadosFund.SERVICO || ''}</td>
              <td>${dadosFund.ETAPA || ''}</td>
              <td>${dadosFund.STATUS || ''}</td>
              <td>${dadosFund.SEI || ''}</td>
              <td>${dadosFund.CONCLUSAO || ''}</td>
            </tr>
          </table>
        </div>`;
      }

      if (dadosDor) {
        html += `
        <div class="bloco-servico">
          <div class="titulo-servico">Dados DOR</div>
          <table class="tabela-servico">
            <tr><th>Proposta</th><th>Serviço</th><th>Etapa</th><th>Status</th><th>SEI</th><th>Conclusão</th></tr>
            <tr>
              <td>${dadosDor.PROPOSTA || ''}</td>
              <td>${dadosDor.SERVICO || ''}</td>
              <td>${dadosDor.ETAPA || ''}</td>
              <td>${dadosDor.STATUS || ''}</td>
              <td>${dadosDor.SEI || ''}</td>
              <td>${dadosDor.CONCLUSAO || ''}</td>
            </tr>
          </table>
        </div>`;
      }

      document.getElementById('painelTabelaConteudo').innerHTML = html;
    }
  
    function atualizarTituloTopBar() {
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var elementoTitulo = document.querySelector('.topbar-right span');
    
    var novoTitulo = 'ESTADO DE GOIÁS';
    
    if (municipioSelecionado) {
      novoTitulo = municipioSelecionado;
    } else if (rgSelecionada) {
      novoTitulo = rgSelecionada;
    }
    
    if (elementoTitulo) {
      elementoTitulo.textContent = novoTitulo;
    }

    // Atualizar topbar-left conforme serviços ativos
    var topbarLeft = document.querySelector('.topbar-left');
    if (topbarLeft) {
      var strong = topbarLeft.querySelector('strong');
      var span = topbarLeft.querySelector('span');
      var fundAtivo = servicosAtivos.FUNDEINFRA;
      var dorAtivo = servicosAtivos.DOR;

      strong.textContent = 'PLANO GOINFRA';
      if (fundAtivo && dorAtivo) {
        span.textContent = '';
      } else if (fundAtivo && !dorAtivo) {
        span.textContent = '- FUNDEINFRA';
      } else if (!fundAtivo && dorAtivo) {
        span.textContent = '- DOR';
      } else {
        span.textContent = '';
      }
    }
  }function aplicarFiltros() {
    desenharMascaraBrasil();
    atualizarBotoesBase();
    var feats = municipiosFiltrados();
    var municipioSelecionado = document.getElementById('municipioSelect').value;

    desenharEstados();
    desenharMunicipiosBase(feats);
    desenharLocalidades();
    desenharLinhasEPontos(feats);
    atualizarIndicadoresProgramaMunicipio(municipioSelecionado);
    atualizarIndicadoresServicoEOAE(municipioSelecionado);

    var localidadeSelecionada = document.getElementById('localidadeSelect').value;
    if (localidadeFiltroAtivo && localidadeSelecionada) {
      zoomParaLocalidade(localidadeSelecionada);
    } else {
      var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
      var sreSelecionado = document.getElementById('sreSelect').value;
      var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
      var featsZoom = obterFeaturesZoomServicos();

      if ((rodoviaSelecionada || sreSelecionado || propostaSelecionada) && featsZoom.length > 0) {
        zoomParaSelecao(featsZoom);
      } else if (feats.length > 0 && feats.length < municipiosData.features.length) {
        zoomParaSelecao(feats);
      } else {
        zoomParaGoias();
      }
    }

    var blocoFed = document.getElementById('blocoLegendaRodFed');
    if (blocoFed && !snvFiltroAtivo) blocoFed.style.display = 'none';
    var blocoEst = document.getElementById('blocoLegendaRodEst');
    if (blocoEst && !sreBaseFiltroAtivo) blocoEst.style.display = 'none';

    atualizarTituloTopBar();
  }


  function desligarTudo() {
    programaAtivo = '';
    resetarBotoesPrograma();

    for (var chave in servicosAtivos) {
      servicosAtivos[chave] = false;
    }
    oaeFiltroAtivo = false;
        sreBaseFiltroAtivo = false;
    snvFiltroAtivo = false;
    servicoFiltroAtivo = '';

    var btnOAEOff = document.getElementById('toggleOAE');
    if (btnOAEOff) btnOAEOff.classList.remove('ativo-filtro');
    document.getElementById('toggleSREBase').classList.remove('ativo-filtro');
    document.getElementById('toggleSNV').classList.remove('ativo-filtro');
    document.getElementById('toggleLocalidades').classList.remove('ativo-filtro');
    localidadeFiltroAtivo = false;
    municipioBaseFiltroAtivo = false;
    var btnMunicipiosOff = document.getElementById('toggleMunicipiosBase');
    if (btnMunicipiosOff) btnMunicipiosOff.classList.remove('ativo-filtro');
    document.getElementById('localidadeSelect').value = '';
    document.getElementById('localidadeBusca').value = '';

    resetarBotoesServico();

    if (snvLayer) { map.removeLayer(snvLayer); snvLayer = null; }
    if (snvLabelLayer) { map.removeLayer(snvLabelLayer); snvLabelLayer = null; }
    if (sreBaseLayer) { map.removeLayer(sreBaseLayer); sreBaseLayer = null; }
    if (sreBaseLabelLayer) { map.removeLayer(sreBaseLabelLayer); sreBaseLabelLayer = null; }
    if (oaeLayer) { map.removeLayer(oaeLayer); oaeLayer = null; }
    limparCamadasRegras();

    var b1 = document.getElementById('blocoLegendaRodFed');
    var b2 = document.getElementById('blocoLegendaRodEst');
    var b3 = document.getElementById('blocoLegendaOAE');
        var b4 = document.getElementById('legendaServicos') ? document.getElementById('legendaServicos').closest('.bloco') : null;
    var b5 = document.getElementById('legendaDor') ? document.getElementById('legendaDor').closest('.bloco') : null;
    if (b1) b1.style.display = 'none';
    if (b2) b2.style.display = 'none';
    if (b3) b3.style.display = 'none';
    if (b4) b4.style.display = 'none';
    if (b5) b5.style.display = 'none';

    desenharEstados();
    desenharMunicipiosBase(municipiosFiltrados());

        document.getElementById('countMunicipios').textContent = municipiosFiltrados().length;
    document.getElementById('countLinhas').textContent = '0';
    document.getElementById('countOAE').textContent = '0';
    document.getElementById('countDor').textContent = '0';

    atualizarTituloTopBar();
  }

  function limparTudo() {
    document.getElementById('rgPlanSelect').value = '';
    document.getElementById('municipioSelect').value = '';
    document.getElementById('rodoviaSelect').value = '';
    document.getElementById('sreSelect').value = '';
        document.getElementById('propostaSelect').value = '';
    document.getElementById('servicoSelect').value = '';
    programaAtivo = '';
    resetarBotoesPrograma();

    for (var chave in servicosAtivos) {
      servicosAtivos[chave] = true;
    }
    oaeFiltroAtivo = true;
        sreBaseFiltroAtivo = true;
    snvFiltroAtivo = true;
    servicoFiltroAtivo = '';

    var btnOAEOn = document.getElementById('toggleOAE');
    if (btnOAEOn) btnOAEOn.classList.add('ativo-filtro');
    document.getElementById('toggleSREBase').classList.add('ativo-filtro');
    document.getElementById('toggleSNV').classList.add('ativo-filtro');
    localidadeFiltroAtivo = true;
    document.getElementById('toggleLocalidades').classList.add('ativo-filtro');
    // Municípios começam desligados
    municipioBaseFiltroAtivo = false;
    var btnMunicipiosOn = document.getElementById('toggleMunicipiosBase');
    if (btnMunicipiosOn) btnMunicipiosOn.classList.remove('ativo-filtro');
    document.getElementById('localidadeSelect').value = '';
    document.getElementById('localidadeBusca').value = '';
    atualizarBotoesBase();

    atualizarMunicipiosPorRegiao();
    preencherRodovias();
    preencherSREs();
    preencherPropostas();
    aplicarFiltros();
  }

  document.getElementById('rgPlanSelect').addEventListener('change', function() {
    document.getElementById('municipioSelect').value = '';
    document.getElementById('rodoviaSelect').value = '';
    document.getElementById('sreSelect').value = '';
    document.getElementById('propostaSelect').value = '';
    atualizarMunicipiosPorRegiao();
    preencherRodovias();
    preencherSREs();
    preencherPropostas();
    aplicarFiltros();
  });

  document.getElementById('municipioSelect').addEventListener('change', function() {
    document.getElementById('rodoviaSelect').value = '';
    document.getElementById('sreSelect').value = '';
    document.getElementById('propostaSelect').value = '';
    preencherRodovias();
    preencherSREs();
    preencherPropostas();
    aplicarFiltros();
  });

  document.getElementById('rodoviaSelect').addEventListener('change', function() {
    document.getElementById('sreSelect').value = '';
    document.getElementById('propostaSelect').value = '';
    preencherSREs();
    preencherPropostas();
    aplicarFiltros();
  });

  document.getElementById('sreSelect').addEventListener('change', function() {
    document.getElementById('propostaSelect').value = '';
    preencherPropostas();
    aplicarFiltros();
  });

    document.getElementById('propostaSelect').addEventListener('change', function() {
    aplicarFiltros();
  });

  document.getElementById('servicoSelect').addEventListener('change', function() {
    servicoFiltroAtivo = this.value;
    aplicarFiltros();
  });

  document.getElementById('localidadeSelect').addEventListener('change', function() {
    document.getElementById('localidadeBusca').value = this.value;
    aplicarFiltros();
  });

  document.getElementById('desligarTudo').addEventListener('click', function() {
    desligarTudo();
  });

  document.getElementById('limparFiltro').addEventListener('click', function() {
    limparTudo();
  });

  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  var indiceSugestaoMunicipio = -1;

  function selecionarMunicipio(nome) {
    var select = document.getElementById('municipioSelect');
    var busca = document.getElementById('municipioBusca');
    var sugestoes = document.getElementById('municipioSugestoes');

    select.value = nome;
    busca.value = nome;

    sugestoes.innerHTML = '';
    sugestoes.style.display = 'none';
    indiceSugestaoMunicipio = -1;

    document.getElementById('rodoviaSelect').value = '';
    document.getElementById('sreSelect').value = '';
    document.getElementById('propostaSelect').value = '';

    preencherRodovias();
    preencherSREs();
    preencherPropostas();
    aplicarFiltros();
  }

  var indiceSugestaoLocalidade = -1;

  function selecionarLocalidade(nome) {
    var select = document.getElementById('localidadeSelect');
    var busca = document.getElementById('localidadeBusca');
    var sugestoes = document.getElementById('localidadeSugestoes');

    select.value = nome;
    busca.value = nome;

    sugestoes.innerHTML = '';
    sugestoes.style.display = 'none';
    indiceSugestaoLocalidade = -1;

    aplicarFiltros();
  }

  function listarSugestoesLocalidade(textoDigitado) {
    var sugestoes = document.getElementById('localidadeSugestoes');
    var select = document.getElementById('localidadeSelect');

    var texto = normalizar(textoDigitado);
    sugestoes.innerHTML = '';
    indiceSugestaoLocalidade = -1;

    if (!texto) {
      sugestoes.style.display = 'none';
      select.value = '';
      aplicarFiltros();
      return;
    }

    var opcoes = Array.from(select.options)
      .map(function(opt) { return opt.value; })
      .filter(function(nome) { return nome; });

    var encontrados = opcoes
      .filter(function(nome) {
        return normalizar(nome).includes(texto);
      })
      .sort(function(a, b) {
        var na = normalizar(a);
        var nb = normalizar(b);

        var aComeca = na.startsWith(texto);
        var bComeca = nb.startsWith(texto);

        if (aComeca && !bComeca) return -1;
        if (!aComeca && bComeca) return 1;

        return a.localeCompare(b, 'pt-BR');
      })
      .slice(0, 8);

    if (!encontrados.length) {
      sugestoes.style.display = 'none';
      return;
    }

    encontrados.forEach(function(nome) {
      var item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = nome;

      item.addEventListener('mousedown', function() {
        selecionarLocalidade(nome);
      });

      sugestoes.appendChild(item);
    });

    sugestoes.style.display = 'block';
  }

  function listarSugestoesMunicipio(textoDigitado) {
    var sugestoes = document.getElementById('municipioSugestoes');
    var select = document.getElementById('municipioSelect');

    var texto = normalizar(textoDigitado);
    sugestoes.innerHTML = '';
    indiceSugestaoMunicipio = -1;

    if (!texto) {
      sugestoes.style.display = 'none';
      select.value = '';
      aplicarFiltros();
      return;
    }

    var opcoes = Array.from(select.options)
      .map(function(opt) { return opt.value; })
      .filter(function(nome) { return nome; });

    var encontrados = opcoes
      .filter(function(nome) {
        return normalizar(nome).includes(texto);
      })
      .sort(function(a, b) {
        var na = normalizar(a);
        var nb = normalizar(b);

        var aComeca = na.startsWith(texto);
        var bComeca = nb.startsWith(texto);

        if (aComeca && !bComeca) return -1;
        if (!aComeca && bComeca) return 1;

        return a.localeCompare(b, 'pt-BR');
      })
      .slice(0, 8);

    if (!encontrados.length) {
      sugestoes.style.display = 'none';
      return;
    }

    encontrados.forEach(function(nome) {
      var item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = nome;

      item.addEventListener('mousedown', function() {
        selecionarMunicipio(nome);
      });

      sugestoes.appendChild(item);
    });

    sugestoes.style.display = 'block';
  }

  document.getElementById('municipioBusca').addEventListener('input', function() {
    listarSugestoesMunicipio(this.value);
  });

  document.getElementById('municipioBusca').addEventListener('keydown', function(e) {
    var sugestoes = document.getElementById('municipioSugestoes');
    var itens = sugestoes.querySelectorAll('.autocomplete-item');

    if (!itens.length || sugestoes.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      indiceSugestaoMunicipio++;

      if (indiceSugestaoMunicipio >= itens.length) {
        indiceSugestaoMunicipio = 0;
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      indiceSugestaoMunicipio--;

      if (indiceSugestaoMunicipio < 0) {
        indiceSugestaoMunicipio = itens.length - 1;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (indiceSugestaoMunicipio >= 0 && itens[indiceSugestaoMunicipio]) {
        selecionarMunicipio(itens[indiceSugestaoMunicipio].textContent);
      }

      return;
    }

    itens.forEach(function(item) {
      item.classList.remove('ativo');
    });

    if (indiceSugestaoMunicipio >= 0 && itens[indiceSugestaoMunicipio]) {
      itens[indiceSugestaoMunicipio].classList.add('ativo');
    }
  });

  document.getElementById('localidadeBusca').addEventListener('input', function() {
    listarSugestoesLocalidade(this.value);
  });

  document.getElementById('localidadeBusca').addEventListener('keydown', function(e) {
    var sugestoes = document.getElementById('localidadeSugestoes');
    var itens = sugestoes.querySelectorAll('.autocomplete-item');

    if (!itens.length || sugestoes.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      indiceSugestaoLocalidade++;

      if (indiceSugestaoLocalidade >= itens.length) {
        indiceSugestaoLocalidade = 0;
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      indiceSugestaoLocalidade--;

      if (indiceSugestaoLocalidade < 0) {
        indiceSugestaoLocalidade = itens.length - 1;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (indiceSugestaoLocalidade >= 0 && itens[indiceSugestaoLocalidade]) {
        selecionarLocalidade(itens[indiceSugestaoLocalidade].textContent);
      }

      return;
    }

    itens.forEach(function(item) {
      item.classList.remove('ativo');
    });

    if (indiceSugestaoLocalidade >= 0 && itens[indiceSugestaoLocalidade]) {
      itens[indiceSugestaoLocalidade].classList.add('ativo');
    }
  });

  document.addEventListener('click', function(e) {
    var isInsideAutocomplete = !!e.target.closest('.autocomplete-wrap');
    var sugestoesMunicipio = document.getElementById('municipioSugestoes');
    var sugestoesLocalidade = document.getElementById('localidadeSugestoes');

    if (!isInsideAutocomplete) {
      sugestoesMunicipio.style.display = 'none';
      sugestoesLocalidade.style.display = 'none';
    }
  });

  var botoesPrograma = document.querySelectorAll('.programa-btn');
  for (var iBot = 0; iBot < botoesPrograma.length; iBot++) {
    botoesPrograma[iBot].addEventListener('click', function() {
      var prog = this.getAttribute('data-programa');

      if (programaAtivo === prog) {
        programaAtivo = '';
      } else {
        programaAtivo = prog;
      }

      resetarBotoesPrograma();

      if (programaAtivo) {
        var botao = document.querySelector('.programa-btn[data-programa="' + programaAtivo + '"]');
        if (botao) botao.classList.add('ativo-filtro');
      }

      aplicarFiltros();
    });
  }

  var botoesServico = document.querySelectorAll('.servico-btn');
  for (var iServ = 0; iServ < botoesServico.length; iServ++) {
    botoesServico[iServ].addEventListener('click', function() {
      var chave = this.getAttribute('data-servico');
      servicosAtivos[chave] = !servicosAtivos[chave];
      aplicarFiltros();
    });
  }

  var btnToggleOAE = document.getElementById('toggleOAE');
  if (btnToggleOAE) {
    btnToggleOAE.addEventListener('click', function() {
      oaeFiltroAtivo = !oaeFiltroAtivo;
      this.classList.toggle('ativo-filtro', oaeFiltroAtivo);
      if (!oaeFiltroAtivo && oaeLayer) { map.removeLayer(oaeLayer); oaeLayer = null; }
      aplicarFiltros();
    });
  }

  document.getElementById('toggleSREBase').addEventListener('click', function() {
    sreBaseFiltroAtivo = !sreBaseFiltroAtivo;
    atualizarBotoesBase();
    aplicarFiltros();
  });

  document.getElementById('toggleSNV').addEventListener('click', function() {
    snvFiltroAtivo = !snvFiltroAtivo;
    atualizarBotoesBase();
    aplicarFiltros();
  });

  document.getElementById('toggleLocalidades').addEventListener('click', function() {
    localidadeFiltroAtivo = !localidadeFiltroAtivo;
    atualizarBotoesBase();
    aplicarFiltros();
  });

  var btnToggleMunicipios = document.getElementById('toggleMunicipiosBase');
  if (btnToggleMunicipios) {
    btnToggleMunicipios.addEventListener('click', function() {
      municipioBaseFiltroAtivo = !municipioBaseFiltroAtivo;
      atualizarBotoesBase();
      aplicarFiltros();
    });
  }



    var botaoPainelTabela = document.getElementById('togglePainelTabela');
  if (botaoPainelTabela) {
    botaoPainelTabela.addEventListener('click', function() {
      var painel = document.getElementById('painelTabela');
      if (!painel) return;

      painel.classList.toggle('painel-fechado');

      this.textContent = painel.classList.contains('painel-fechado')
        ? 'Mostrar tabela'
        : 'Ocultar tabela';

      setTimeout(function() {
        map.invalidateSize();
      }, 200);
    });
  }

  // ===== TOGGLE DAS SIDEBARS (Filtros e Legendas) =====

  function toggleSidebar(sidebarId, appClass, btn) {
    var sidebar = document.getElementById(sidebarId);
    var app = document.getElementById('app');
    if (!sidebar || !app) return;

    sidebar.classList.toggle('sidebar-colapsed');
    app.classList.toggle(appClass);

    btn.textContent = sidebar.classList.contains('sidebar-colapsed')
      ? (sidebarId === 'sidebar-left' ? '»' : '«')
      : (sidebarId === 'sidebar-left' ? '«' : '»');

    setTimeout(function() {
      map.invalidateSize();
    }, 300);
  }

  var botaoSidebarLeft = document.getElementById('toggleSidebarLeft');
  if (botaoSidebarLeft) {
    botaoSidebarLeft.addEventListener('click', function() {
      toggleSidebar('sidebar-left', 'sidebar-left-collapsed', this);
    });
  }

  var botaoSidebarRight = document.getElementById('toggleSidebarRight');
  if (botaoSidebarRight) {
    botaoSidebarRight.addEventListener('click', function() {
      toggleSidebar('sidebar-right', 'sidebar-right-collapsed', this);
    });
  }

  function fetchGeoJSON(nome, obrigatorio) {
    return fetch(nome)
      .then(function(r) {
        if (!r.ok) {
          var err = new Error('HTTP ' + r.status + ' em ' + nome);
          err.fileName = nome;
          throw err;
        }
        return r.json().catch(function(jsonErr) {
          var err = new Error('JSON inválido em ' + nome);
          err.fileName = nome;
          throw err;
        });
      })
      .catch(function(e) {
        if (!e.fileName) e.fileName = nome;
        if (obrigatorio) throw e;
        console.warn('Camada opcional não carregada:', nome, e);
        return null;
      });
  }

  Promise.all([
    fetchGeoJSON('data/municipios.geojson', true),
    fetchGeoJSON('data/localidades.geojson', true),
    fetchGeoJSON('data/sre_base.geojson', false),
    fetchGeoJSON('data/obras_linhas.geojson', true),
    Promise.resolve(null),
    fetchGeoJSON('data/snv_goias.geojson', false),
    fetchGeoJSON('data/estados.geojson', false),
    fetchGeoJSON('data/mascara_brasil.geojson', false)
  ]).then(function(resultado) {
    municipiosData = resultado[0];
    localidadesData = resultado[1];
    sreBaseData = resultado[2];
    sreData = resultado[3];
    oaeData = resultado[4];
    snvData = resultado[5];
    estadosData = resultado[6];
    mascaraBrasilData = resultado[7];

    desenharMascaraBrasil();

    preencherRGPlan();
    preencherMunicipios();
    preencherLocalidades();
    preencherRodovias();
    preencherSREs();
    limparTudo();
  }).catch(function(e) {
    console.error('Falha detalhada no carregamento:', e);
    alert(
      'Falha ao carregar: ' + (e.fileName || 'arquivo desconhecido') +
      '\nDetalhe: ' + (e.message || e)
    );
  });