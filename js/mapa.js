var map = L.map('map', {
  zoomControl: false,
  zoomSnap: 0.1,
  zoomDelta: 0.1
}).setView([-15.8, -49.0], 7);
var originalCenter = map.getCenter();
var originalZoom = map.getZoom();

  map.createPane('snvPane');
  map.getPane('snvPane').style.zIndex = 200;

  map.createPane('sreBasePane');
  map.getPane('sreBasePane').style.zIndex = 300;

    map.createPane('servicosPane');
    map.getPane('servicosPane').style.zIndex = 500;

    map.createPane('rotulosServicosPane');
    map.getPane('rotulosServicosPane').style.zIndex = 900;

    map.createPane('localidadesPane');
    map.getPane('localidadesPane').style.zIndex = 550;

    map.createPane('oaePane');
    map.getPane('oaePane').style.zIndex = 600;

    map.createPane('anotacoesPane');
    map.getPane('anotacoesPane').style.zIndex = 850;

    map.createPane('anotacoesTextoPane');
    map.getPane('anotacoesTextoPane').style.zIndex = 950;

    map.createPane('medicaoPane');
    map.getPane('medicaoPane').style.zIndex = 875;

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

// ---- CONTROLE DE ZOOM POR VALOR ----
var ZoomValorControl = L.Control.extend({
  options: {
    position: 'topleft'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar zoom-valor-control');
    var label = L.DomUtil.create('label', '', container);

    label.title = 'Definir zoom';
    label.appendChild(document.createTextNode('Zoom'));
    var input = L.DomUtil.create('input', '', label);
    input.type = 'number';
    input.min = map.getMinZoom();
    input.max = map.getMaxZoom();
    input.step = '0.1';
    input.value = map.getZoom();

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    function atualizarCampo() {
      input.value = Number(map.getZoom().toFixed(1));
    }

    function aplicarZoom() {
      var valor = parseFloat(input.value);
      if (!isFinite(valor)) {
        atualizarCampo();
        return;
      }
      var minZoom = map.getMinZoom();
      var maxZoom = map.getMaxZoom();
      map.setZoom(Math.max(minZoom, Math.min(maxZoom, valor)));
    }

    L.DomEvent.on(input, 'change', aplicarZoom);
    L.DomEvent.on(input, 'keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        aplicarZoom();
        input.blur();
      }
    });
    map.on('zoomend', atualizarCampo);

    return container;
  }
});

map.addControl(new ZoomValorControl());

// ---- FERRAMENTA DE MEDIÇÃO ----
var medicaoAtiva = false;
var medicaoPontos = [];
var medicaoLayer = L.layerGroup().addTo(map);
var medicaoLinha = null;
var medicaoTooltip = null;
var medicaoBotao = null;

function formatarDistanciaMedicao(metros) {
  if (!isFinite(metros)) return '0 m';
  if (metros >= 1000) return (metros / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' km';
  return metros.toLocaleString('pt-BR', {
    maximumFractionDigits: 0
  }) + ' m';
}

function distanciaTotalMedicao(pontos) {
  var total = 0;
  for (var i = 1; i < pontos.length; i++) {
    total += pontos[i - 1].distanceTo(pontos[i]);
  }
  return total;
}

function atualizarBotaoMedicao() {
  if (medicaoBotao) medicaoBotao.classList.toggle('ativo', medicaoAtiva);
}

function limparMedicao() {
  medicaoPontos = [];
  medicaoLayer.clearLayers();
  medicaoLinha = null;
  medicaoTooltip = null;
}

function atualizarDesenhoMedicao(pontoPreview) {
  var pontosLinha = medicaoPontos.slice();
  if (pontoPreview && pontosLinha.length) pontosLinha.push(pontoPreview);

  if (medicaoLinha) medicaoLayer.removeLayer(medicaoLinha);
  if (pontosLinha.length > 1) {
    medicaoLinha = L.polyline(pontosLinha, {
      pane: 'medicaoPane',
      color: '#111827',
      weight: 3,
      opacity: 0.95,
      dashArray: '8,6'
    }).addTo(medicaoLayer);
  }

  if (medicaoTooltip) medicaoLayer.removeLayer(medicaoTooltip);
  if (pontosLinha.length) {
    var total = distanciaTotalMedicao(pontosLinha);
    var texto = formatarDistanciaMedicao(total);
    medicaoTooltip = L.marker(pontosLinha[pontosLinha.length - 1], {
      pane: 'medicaoPane',
      interactive: false,
      icon: L.divIcon({
        className: 'medicao-tooltip-icon',
        html: '<span class="medicao-tooltip">' + texto + '</span>',
        iconSize: [1, 1],
        iconAnchor: [0, 0]
      })
    }).addTo(medicaoLayer);
  }
}

function finalizarMedicao() {
  medicaoAtiva = false;
  map.dragging.enable();
  map.doubleClickZoom.enable();
  atualizarBotaoMedicao();
  atualizarDesenhoMedicao();
}

function alternarMedicao() {
  medicaoAtiva = !medicaoAtiva;
  atualizarBotaoMedicao();

  if (medicaoAtiva) {
    if (typeof anotacaoFerramenta !== 'undefined' && anotacaoFerramenta) {
      ativarFerramentaAnotacao(anotacaoFerramenta);
    }
    limparMedicao();
    map.dragging.disable();
    map.doubleClickZoom.disable();
  } else {
    finalizarMedicao();
  }
}

function adicionarPontoMedicao(e) {
  if (!medicaoAtiva) return;
  if (e.originalEvent) {
    L.DomEvent.preventDefault(e.originalEvent);
    L.DomEvent.stopPropagation(e.originalEvent);
  }
  if (e.originalEvent && e.originalEvent.detail >= 2) {
    finalizarMedicao();
    return;
  }

  medicaoPontos.push(e.latlng);
  L.circleMarker(e.latlng, {
    pane: 'medicaoPane',
    radius: 4,
    color: '#111827',
    weight: 2,
    fillColor: '#ffffff',
    fillOpacity: 1
  }).addTo(medicaoLayer);
  atualizarDesenhoMedicao();
}

function previewMedicao(e) {
  if (!medicaoAtiva || !medicaoPontos.length) return;
  atualizarDesenhoMedicao(e.latlng);
}

var MedicaoControl = L.Control.extend({
  options: {
    position: 'topleft'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar medicao-control');
    medicaoBotao = L.DomUtil.create('button', 'medicao-btn', container);
    medicaoBotao.type = 'button';
    medicaoBotao.title = 'Medir distância';
    medicaoBotao.textContent = 'Régua';

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(medicaoBotao, 'click', function(e) {
      L.DomEvent.preventDefault(e);
      alternarMedicao();
    });

    return container;
  }
});

map.addControl(new MedicaoControl());
map.on('click', adicionarPontoMedicao);
map.on('mousemove', previewMedicao);
map.on('dblclick', function(e) {
  if (!medicaoAtiva) return;
  if (e.originalEvent) {
    L.DomEvent.preventDefault(e.originalEvent);
    L.DomEvent.stopPropagation(e.originalEvent);
  }
  finalizarMedicao();
});
map.getContainer().addEventListener('contextmenu', function(e) {
  if (!medicaoAtiva) return;
  e.preventDefault();
  e.stopPropagation();
  finalizarMedicao();
}, true);

// ---- ESCALA GRÁFICA DINÂMICA ----
L.control.scale({
  position: 'bottomleft',
  maxWidth: 200,
  metric: true,
  imperial: false,
  updateWhenIdle: false
}).addTo(map);

// ---- SÍMBOLO DE NORTE (ROSA DOS VENTOS) ----
var NortheArrowControl = L.Control.extend({
  options: {
    position: 'topright'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'north-arrow-control');
    
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 120');
    svg.setAttribute('width', '56');
    svg.setAttribute('height', '66');
    
    var backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', '50');
    backgroundCircle.setAttribute('cy', '60');
    backgroundCircle.setAttribute('r', '46');
    backgroundCircle.setAttribute('fill', 'rgba(255, 255, 255, 0.82)');
    
    // Triângulo principal (norte) - preenchido
    var mainTriangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    mainTriangle.setAttribute('points', '50,35 78,91 50,72 22,91');
    mainTriangle.setAttribute('fill', '#1f2937');
    
    // Letra "N" no topo da seta
    var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50');
    text.setAttribute('y', '32');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '43');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#1f2937');
    text.textContent = 'N';
    
    svg.appendChild(backgroundCircle);
    svg.appendChild(mainTriangle);
    svg.appendChild(text);
    
    container.appendChild(svg);
    
    L.DomEvent.disableClickPropagation(container);
    
    return container;
  }
});

map.addControl(new NortheArrowControl());

  map.on('zoomend', function() {
    atualizarVisibilidadeRotulos();
    atualizarVisibilidadeRotulosSRE();
    atualizarVisibilidadeRotulosObras();
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
  var obrasLabelLayer = null;
  var regraLayers = [];
  var rotulosObrasPrintAtivos = false;

  var programaAtivo = '';
  var programas = [];

    var servicosAtivos = {
      FUNDEINFRA: true,
      DOR: true
    };
    var servicoFiltroAtivo = '';

  var anotacoesLayer = L.featureGroup().addTo(map);
  var anotacoesHistorico = [];
  var anotacaoFerramenta = null;
  var anotacaoInicio = null;
  var anotacaoPreview = null;
  var anotacaoLinhaPontos = [];
  var legendaAnotacoesAtiva = false;
  var ANOTACOES_STORAGE_KEY = 'mapa_pop2_anotacoes_v1';
  var estiloAnotacao = {
    pane: 'anotacoesPane',
    color: '#e11d48',
    weight: 4,
    opacity: 0.95,
    fillColor: '#f43f5e',
    fillOpacity: 0.14
  };
  var estiloTextoAnotacao = {
    cor: '#111827',
    tamanho: 13
  };
  var estiloPontoAnotacao = {
    formato: 'circulo',
    tamanho: 14
  };

  function setStatusAnotacao(texto) {
    var status = document.getElementById('drawStatus');
    if (status) status.textContent = texto;
  }

  function valorCampo(id, padrao) {
    var campo = document.getElementById(id);
    return campo && campo.value ? campo.value : padrao;
  }

  function lerEstiloFormaAnotacao() {
    var cor = valorCampo('drawCorLinha', estiloAnotacao.color);
    var espessura = parseInt(valorCampo('drawEspessuraLinha', estiloAnotacao.weight), 10);
    var opacidadePreenchimento = parseInt(valorCampo('drawOpacidadePreenchimento', estiloAnotacao.fillOpacity * 100), 10);
    if (!isFinite(espessura)) espessura = estiloAnotacao.weight;
    if (!isFinite(opacidadePreenchimento)) opacidadePreenchimento = estiloAnotacao.fillOpacity * 100;
    return {
      pane: 'anotacoesPane',
      color: cor,
      weight: Math.max(1, Math.min(12, espessura)),
      opacity: 0.95,
      fillColor: cor,
      fillOpacity: Math.max(0, Math.min(100, opacidadePreenchimento)) / 100
    };
  }

  function lerEstiloTextoAnotacao() {
    var tamanho = parseInt(valorCampo('drawTamanhoTexto', estiloTextoAnotacao.tamanho), 10);
    if (!isFinite(tamanho)) tamanho = estiloTextoAnotacao.tamanho;
    return {
      cor: valorCampo('drawCorTexto', estiloTextoAnotacao.cor),
      tamanho: Math.max(8, Math.min(36, tamanho))
    };
  }

  function lerEstiloPontoAnotacao() {
    var tamanho = parseInt(valorCampo('drawTamanhoPonto', estiloPontoAnotacao.tamanho), 10);
    if (!isFinite(tamanho)) tamanho = estiloPontoAnotacao.tamanho;
    return {
      formato: valorCampo('drawFormatoPonto', estiloPontoAnotacao.formato),
      tamanho: Math.max(6, Math.min(34, tamanho))
    };
  }

  function atualizarIndicadoresEstiloAnotacao() {
    var espessuraValor = document.getElementById('drawEspessuraValor');
    var opacidadeValor = document.getElementById('drawOpacidadeValor');
    var tamanhoPontoValor = document.getElementById('drawTamanhoPontoValor');
    var tamanhoValor = document.getElementById('drawTamanhoTextoValor');
    var estiloForma = lerEstiloFormaAnotacao();
    if (espessuraValor) espessuraValor.textContent = estiloForma.weight + ' px';
    if (opacidadeValor) opacidadeValor.textContent = Math.round(estiloForma.fillOpacity * 100) + '%';
    if (tamanhoPontoValor) tamanhoPontoValor.textContent = lerEstiloPontoAnotacao().tamanho + ' px';
    if (tamanhoValor) tamanhoValor.textContent = lerEstiloTextoAnotacao().tamanho + ' px';
  }

  function estiloFormaPorProps(props) {
    return Object.assign({}, estiloAnotacao, props && props.estilo ? props.estilo : {});
  }

  function estiloTextoPorProps(props) {
    return Object.assign({}, estiloTextoAnotacao, props && props.estiloTexto ? props.estiloTexto : {});
  }

  function estiloPontoPorProps(props) {
    return Object.assign({}, estiloPontoAnotacao, props && props.estiloPonto ? props.estiloPonto : {});
  }

  function estiloFormaDaCamada(layer) {
    var opcoes = layer.options || {};
    return {
      color: opcoes.color || estiloAnotacao.color,
      weight: opcoes.weight || estiloAnotacao.weight,
      opacity: opcoes.opacity == null ? estiloAnotacao.opacity : opcoes.opacity,
      fillColor: opcoes.fillColor || opcoes.color || estiloAnotacao.fillColor,
      fillOpacity: opcoes.fillOpacity == null ? estiloAnotacao.fillOpacity : opcoes.fillOpacity
    };
  }

  function nomeTipoAnotacao(tipo) {
    if (tipo === 'linha') return 'Linha';
    if (tipo === 'ponto') return 'Ponto';
    if (tipo === 'retangulo') return 'Retângulo';
    if (tipo === 'circulo') return 'Círculo';
    if (tipo === 'texto') return 'Texto';
    return 'Anotação';
  }

  function solicitarNomeLegendaAnotacao(tipo, padrao) {
    var nome = window.prompt('Nome para aparecer na legenda (' + nomeTipoAnotacao(tipo) + '):', padrao || '');
    if (nome === null) return padrao || '';
    nome = nome.trim();
    if (nome) {
      legendaAnotacoesAtiva = true;
      atualizarBotaoLegendaAnotacoes();
    }
    return nome;
  }

  function atualizarBotaoLegendaAnotacoes() {
    var botao = document.getElementById('toggleLegendaAnotacoes');
    if (!botao) return;
    botao.classList.toggle('ativo-filtro', legendaAnotacoesAtiva);
    botao.textContent = legendaAnotacoesAtiva ? 'Legenda das anotações: ligada' : 'Legenda das anotações: desligada';
  }

  function estiloCssCor(cor, fallback) {
    return String(cor || fallback || '#111827').replace(/[^#(),.%\w\s-]/g, '');
  }

  function corHexParaRgba(cor, opacidade) {
    cor = String(cor || '#111827').trim();
    opacidade = Math.max(0, Math.min(1, Number(opacidade)));
    var match = cor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return cor;
    var hex = match[1];
    if (hex.length === 3) {
      hex = hex.split('').map(function(ch) { return ch + ch; }).join('');
    }
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + opacidade.toFixed(2) + ')';
  }

  function classeFormatoPonto(formato) {
    if (formato === 'quadrado') return ' anotacao-ponto-quadrado';
    if (formato === 'losango') return ' anotacao-ponto-losango';
    if (formato === 'triangulo') return ' anotacao-ponto-triangulo';
    return ' anotacao-ponto-circulo';
  }

  function simboloLegendaAnotacao(tipo, extra) {
    extra = extra || {};
    var estilo = extra.estilo || {};
    var estiloTexto = extra.estiloTexto || {};
    var cor = estiloCssCor(estilo.color, estiloTexto.cor || '#111827');
    var espessura = Math.max(1, Math.min(12, Number(estilo.weight) || 3));
    var preenchimento = estiloCssCor(estilo.fillColor, cor);
    var opacidade = estilo.fillOpacity == null ? 0.14 : Math.max(0, Math.min(1, Number(estilo.fillOpacity)));

    if (tipo === 'linha') {
      return '<span class="legenda-anotacao-simbolo"><span class="legenda-anotacao-linha" style="border-top-color:' + cor + ';border-top-width:' + espessura + 'px"></span></span>';
    }
    if (tipo === 'ponto') {
      var ponto = extra.estiloPonto || {};
      var tamanho = Math.max(8, Math.min(22, Number(ponto.tamanho) || 14));
      return '<span class="legenda-anotacao-simbolo"><span class="anotacao-ponto-shape' + classeFormatoPonto(ponto.formato) + '" style="width:' + tamanho + 'px;height:' + tamanho + 'px;border-color:' + cor + ';border-width:' + espessura + 'px;background:' + corHexParaRgba(preenchimento, opacidade) + '"></span></span>';
    }
    if (tipo === 'retangulo') {
      return '<span class="legenda-anotacao-simbolo"><span class="legenda-anotacao-retangulo" style="border-color:' + cor + ';border-width:' + espessura + 'px;background:' + corHexParaRgba(preenchimento, opacidade) + '"></span></span>';
    }
    if (tipo === 'circulo') {
      return '<span class="legenda-anotacao-simbolo"><span class="legenda-anotacao-circulo" style="border-color:' + cor + ';border-width:' + espessura + 'px;background:' + corHexParaRgba(preenchimento, opacidade) + '"></span></span>';
    }
    return '<span class="legenda-anotacao-simbolo"><span class="legenda-anotacao-texto" style="color:' + cor + '">T</span></span>';
  }

  function renderizarLegendaAnotacoes() {
    var bloco = document.getElementById('blocoLegendaAnotacoes');
    var alvo = document.getElementById('legendaAnotacoes');
    if (!bloco || !alvo) return;

    alvo.innerHTML = '';
    if (!legendaAnotacoesAtiva) {
      bloco.style.display = 'none';
      return;
    }

    var total = 0;
    anotacoesLayer.eachLayer(function(layer) {
      var extra = layer._anotacaoExtra || {};
      if (layer._anotacaoTipo === 'texto') return;
      var nome = String(extra.nomeLegenda || '').trim();
      if (!nome) return;

      var item = document.createElement('div');
      item.className = 'legenda-item legenda-anotacao-item';
      item.innerHTML = simboloLegendaAnotacao(layer._anotacaoTipo, extra) +
        '<span class="legenda-texto">' + escaparHtml(nome) + '</span>';
      alvo.appendChild(item);
      total++;
    });

    bloco.style.display = total ? '' : 'none';
  }

  function nomeArquivoSeguroAnotacao(nome) {
    return String(nome || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function limparPreviewAnotacao() {
    if (anotacaoPreview) {
      map.removeLayer(anotacaoPreview);
      anotacaoPreview = null;
    }
    anotacaoInicio = null;
    anotacaoLinhaPontos = [];
  }

  function atualizarBotoesAnotacao() {
    var ids = {
      linha: 'drawLinha',
      ponto: 'drawPonto',
      retangulo: 'drawRetangulo',
      circulo: 'drawCirculo',
      texto: 'drawTexto'
    };
    Object.keys(ids).forEach(function(chave) {
      var botao = document.getElementById(ids[chave]);
      if (botao) botao.classList.toggle('ativo-filtro', anotacaoFerramenta === chave);
    });
  }

  function escaparHtml(valor) {
    return String(valor || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function criarIconeTextoAnotacao(texto, estiloTexto) {
    estiloTexto = Object.assign({}, estiloTextoAnotacao, estiloTexto || {});
    var tamanho = Number(estiloTexto.tamanho || estiloTextoAnotacao.tamanho);
    var style = 'color:' + escaparHtml(estiloTexto.cor) + ';' +
      'font-size:' + tamanho + 'px;' +
      'border-color:' + escaparHtml(estiloTexto.cor) + ';';
    return L.divIcon({
      className: 'anotacao-texto-icon',
      html: '<span class="anotacao-texto" style="' + style + '">' + escaparHtml(texto) + '</span>',
      iconSize: [1, 1],
      iconAnchor: [0, 0]
    });
  }

  function criarIconePontoAnotacao(estiloForma, estiloPonto) {
    estiloForma = Object.assign({}, estiloAnotacao, estiloForma || {});
    estiloPonto = Object.assign({}, estiloPontoAnotacao, estiloPonto || {});
    var tamanho = Number(estiloPonto.tamanho || estiloPontoAnotacao.tamanho);
    var borda = Number(estiloForma.weight || estiloAnotacao.weight);
    var cor = estiloCssCor(estiloForma.color, '#e11d48');
    var preenchimento = corHexParaRgba(estiloForma.fillColor || estiloForma.color, estiloForma.fillOpacity == null ? 0.14 : estiloForma.fillOpacity);
    var style = 'width:' + tamanho + 'px;height:' + tamanho + 'px;' +
      'border-color:' + cor + ';border-width:' + borda + 'px;' +
      'background:' + preenchimento + ';';
    return L.divIcon({
      className: 'anotacao-ponto-icon',
      html: '<span class="anotacao-ponto-shape' + classeFormatoPonto(estiloPonto.formato) + '" style="' + style + '"></span>',
      iconSize: [tamanho + borda * 2, tamanho + borda * 2],
      iconAnchor: [(tamanho + borda * 2) / 2, (tamanho + borda * 2) / 2]
    });
  }

  function configurarCamadaAnotacao(layer, tipo, extra) {
    layer._anotacaoTipo = tipo;
    layer._anotacaoExtra = extra || {};
    if (tipo === 'texto') {
      layer.on('dragend', salvarAnotacoesLocal);
      layer.on('click', function() {
        var textoAtual = layer._anotacaoExtra.texto || '';
        var novoTexto = window.prompt('Texto da anotação:', textoAtual);
        if (novoTexto === null) return;
        novoTexto = novoTexto.trim();
        if (!novoTexto) {
          removerAnotacao(layer);
          return;
        }
        layer._anotacaoExtra.texto = novoTexto;
        layer.setIcon(criarIconeTextoAnotacao(novoTexto, estiloTextoPorProps(layer._anotacaoExtra)));
        salvarAnotacoesLocal();
      });
    } else {
      layer.on('click', function() {
        if (anotacaoFerramenta) return;
        var nomeAtual = layer._anotacaoExtra.nomeLegenda || '';
        var novoNome = solicitarNomeLegendaAnotacao(tipo, nomeAtual);
        layer._anotacaoExtra.nomeLegenda = novoNome;
        salvarAnotacoesLocal();
        if (window.confirm('Remover esta anotação?')) removerAnotacao(layer);
      });
    }
    return layer;
  }

  function adicionarAnotacao(layer, tipo, extra) {
    configurarCamadaAnotacao(layer, tipo, extra);
    anotacoesLayer.addLayer(layer);
    anotacoesHistorico.push(layer);
    salvarAnotacoesLocal();
    renderizarLegendaAnotacoes();
  }

  function removerAnotacao(layer) {
    anotacoesLayer.removeLayer(layer);
    anotacoesHistorico = anotacoesHistorico.filter(function(item) {
      return item !== layer;
    });
    salvarAnotacoesLocal();
    renderizarLegendaAnotacoes();
  }

  function latLngsParaCoords(latlngs) {
    return latlngs.map(function(latlng) {
      return [latlng.lng, latlng.lat];
    });
  }

  function coordsParaLatLngs(coords) {
    return coords.map(function(coord) {
      return [coord[1], coord[0]];
    });
  }

  function coordenadasCirculoAproximado(centro, raioMetros) {
    var pontos = [];
    var lat1 = centro.lat * Math.PI / 180;
    var lng1 = centro.lng * Math.PI / 180;
    var distanciaAngular = raioMetros / 6378137;

    for (var i = 0; i <= 72; i++) {
      var bearing = (i * 5) * Math.PI / 180;
      var lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distanciaAngular) +
        Math.cos(lat1) * Math.sin(distanciaAngular) * Math.cos(bearing)
      );
      var lng2 = lng1 + Math.atan2(
        Math.sin(bearing) * Math.sin(distanciaAngular) * Math.cos(lat1),
        Math.cos(distanciaAngular) - Math.sin(lat1) * Math.sin(lat2)
      );
      pontos.push([lng2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
    }

    return [pontos];
  }

  function camadaAnotacaoParaFeature(layer) {
    var tipo = layer._anotacaoTipo;
    var props = Object.assign({ tipo: tipo }, layer._anotacaoExtra || {});

    if (tipo === 'linha') {
      props.estilo = estiloFormaDaCamada(layer);
      return {
        type: 'Feature',
        properties: props,
        geometry: {
          type: 'LineString',
          coordinates: latLngsParaCoords(layer.getLatLngs())
        }
      };
    }

    if (tipo === 'ponto') {
      var ponto = layer.getLatLng();
      return {
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [ponto.lng, ponto.lat] }
      };
    }

    if (tipo === 'retangulo') {
      var polygon = layer.toGeoJSON().geometry.coordinates;
      props.estilo = estiloFormaDaCamada(layer);
      return {
        type: 'Feature',
        properties: props,
        geometry: { type: 'Polygon', coordinates: polygon }
      };
    }

    if (tipo === 'circulo') {
      var centro = layer.getLatLng();
      props.raio = layer.getRadius();
      props.centro = [centro.lng, centro.lat];
      props.estilo = estiloFormaDaCamada(layer);
      return {
        type: 'Feature',
        properties: props,
        geometry: {
          type: 'Polygon',
          coordinates: coordenadasCirculoAproximado(centro, props.raio)
        }
      };
    }

    if (tipo === 'texto') {
      var pos = layer.getLatLng();
      return {
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }
      };
    }

    return null;
  }

  function exportarAnotacoesGeoJSON() {
    var features = [];
    anotacoesLayer.eachLayer(function(layer) {
      var feature = camadaAnotacaoParaFeature(layer);
      if (feature) features.push(feature);
    });
    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  function salvarAnotacoesLocal() {
    try {
      localStorage.setItem(ANOTACOES_STORAGE_KEY, JSON.stringify(exportarAnotacoesGeoJSON()));
      setStatusAnotacao(anotacoesLayer.getLayers().length + ' anotação(ões) salva(s) no navegador');
      renderizarLegendaAnotacoes();
    } catch (erro) {
      setStatusAnotacao('Não foi possível salvar no navegador');
      console.warn('Falha ao salvar anotações:', erro);
    }
  }

  function criarLayerDeFeatureAnotacao(feature) {
    if (!feature || !feature.geometry) return null;
    var props = feature.properties || {};
    var tipo = props.tipo;
    var geom = feature.geometry;
    var layer = null;
    var estiloForma = estiloFormaPorProps(props);

    if (tipo === 'linha' && geom.type === 'LineString') {
      layer = L.polyline(coordsParaLatLngs(geom.coordinates), estiloForma);
    } else if (tipo === 'ponto' && geom.type === 'Point') {
      layer = L.marker([geom.coordinates[1], geom.coordinates[0]], {
        pane: 'anotacoesPane',
        draggable: false,
        icon: criarIconePontoAnotacao(estiloForma, estiloPontoPorProps(props))
      });
    } else if (tipo === 'retangulo' && geom.type === 'Polygon') {
      layer = L.polygon(coordsParaLatLngs(geom.coordinates[0] || []), estiloForma);
    } else if (tipo === 'circulo' && geom.type === 'Polygon' && props.centro) {
      layer = L.circle([props.centro[1], props.centro[0]], Object.assign({}, estiloForma, {
        radius: Number(props.raio) || 1000
      }));
    } else if (tipo === 'circulo' && geom.type === 'Point') {
      layer = L.circle([geom.coordinates[1], geom.coordinates[0]], Object.assign({}, estiloForma, {
        radius: Number(props.raio) || 1000
      }));
    } else if (tipo === 'texto' && geom.type === 'Point') {
      layer = L.marker([geom.coordinates[1], geom.coordinates[0]], {
        pane: 'anotacoesTextoPane',
        draggable: true,
        icon: criarIconeTextoAnotacao(props.texto || '', estiloTextoPorProps(props))
      });
    }

    if (!layer) return null;
    return configurarCamadaAnotacao(layer, tipo, props);
  }

  function carregarAnotacoesGeoJSON(geojson, substituir) {
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      setStatusAnotacao('Arquivo de anotações inválido');
      return;
    }

    if (substituir) {
      anotacoesLayer.clearLayers();
      anotacoesHistorico = [];
    }

    geojson.features.forEach(function(feature) {
      var layer = criarLayerDeFeatureAnotacao(feature);
      if (layer) {
        anotacoesLayer.addLayer(layer);
        anotacoesHistorico.push(layer);
      }
    });
    salvarAnotacoesLocal();
  }

  function carregarAnotacoesLocal() {
    try {
      var bruto = localStorage.getItem(ANOTACOES_STORAGE_KEY);
      if (!bruto) return;
      carregarAnotacoesGeoJSON(JSON.parse(bruto), true);
    } catch (erro) {
      setStatusAnotacao('Não foi possível recuperar as anotações salvas');
      console.warn('Falha ao carregar anotações:', erro);
    }
  }

  function ativarFerramentaAnotacao(tipo) {
    limparPreviewAnotacao();
    anotacaoFerramenta = anotacaoFerramenta === tipo ? null : tipo;
    atualizarBotoesAnotacao();

    if (!anotacaoFerramenta) {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      setStatusAnotacao('Sem ferramenta ativa');
      return;
    }

    map.dragging.disable();
    map.doubleClickZoom.disable();

    if (tipo === 'linha') setStatusAnotacao('Linha: clique nos pontos e dê duplo clique para finalizar');
    if (tipo === 'ponto') setStatusAnotacao('Ponto: clique no local da anotação');
    if (tipo === 'retangulo') setStatusAnotacao('Retângulo: clique em dois cantos do retângulo');
    if (tipo === 'circulo') setStatusAnotacao('Círculo: clique no centro e depois no raio');
    if (tipo === 'texto') setStatusAnotacao('Texto: clique no local da anotação');
  }

  function finalizarLinhaAnotacao() {
    if (anotacaoLinhaPontos.length < 2) return;
    if (anotacaoPreview) map.removeLayer(anotacaoPreview);
    var estiloLinha = lerEstiloFormaAnotacao();
    var nomeLegenda = solicitarNomeLegendaAnotacao('linha', '');
    adicionarAnotacao(L.polyline(anotacaoLinhaPontos, estiloLinha), 'linha', {
      estilo: estiloFormaDaCamada({ options: estiloLinha }),
      nomeLegenda: nomeLegenda
    });
    limparPreviewAnotacao();
    ativarFerramentaAnotacao('linha');
  }

  function processarCliqueAnotacao(e) {
    if (!anotacaoFerramenta) return;
    if (e.originalEvent) {
      L.DomEvent.preventDefault(e.originalEvent);
      L.DomEvent.stopPropagation(e.originalEvent);
    }

    if (anotacaoFerramenta === 'texto') {
      var texto = window.prompt('Texto da anotação:');
      if (texto && texto.trim()) {
        var estiloTexto = lerEstiloTextoAnotacao();
        adicionarAnotacao(L.marker(e.latlng, {
          pane: 'anotacoesTextoPane',
          draggable: true,
          icon: criarIconeTextoAnotacao(texto.trim(), estiloTexto)
        }), 'texto', { texto: texto.trim(), estiloTexto: estiloTexto });
      }
      ativarFerramentaAnotacao('texto');
      return;
    }

    if (anotacaoFerramenta === 'ponto') {
      var estiloPontoForma = lerEstiloFormaAnotacao();
      var estiloPonto = lerEstiloPontoAnotacao();
      var nomeLegendaPonto = solicitarNomeLegendaAnotacao('ponto', '');
      adicionarAnotacao(L.marker(e.latlng, {
        pane: 'anotacoesPane',
        draggable: false,
        icon: criarIconePontoAnotacao(estiloPontoForma, estiloPonto)
      }), 'ponto', {
        estilo: estiloFormaDaCamada({ options: estiloPontoForma }),
        estiloPonto: estiloPonto,
        nomeLegenda: nomeLegendaPonto
      });
      ativarFerramentaAnotacao('ponto');
      return;
    }

    if (anotacaoFerramenta === 'linha') {
      if (e.originalEvent && e.originalEvent.detail >= 2) {
        finalizarLinhaAnotacao();
        return;
      }
      anotacaoLinhaPontos.push(e.latlng);
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      anotacaoPreview = L.polyline(anotacaoLinhaPontos, Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: '6,6'
      })).addTo(map);
      return;
    }

    if (!anotacaoInicio) {
      anotacaoInicio = e.latlng;
      return;
    }

    if (anotacaoFerramenta === 'retangulo') {
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      var estiloRetangulo = lerEstiloFormaAnotacao();
      var nomeLegendaRetangulo = solicitarNomeLegendaAnotacao('retangulo', '');
      adicionarAnotacao(L.rectangle(L.latLngBounds(anotacaoInicio, e.latlng), estiloRetangulo), 'retangulo', {
        estilo: estiloFormaDaCamada({ options: estiloRetangulo }),
        nomeLegenda: nomeLegendaRetangulo
      });
      limparPreviewAnotacao();
      ativarFerramentaAnotacao('retangulo');
      return;
    }

    if (anotacaoFerramenta === 'circulo') {
      var raio = anotacaoInicio.distanceTo(e.latlng);
      if (raio > 0) {
        if (anotacaoPreview) map.removeLayer(anotacaoPreview);
        var estiloCirculo = lerEstiloFormaAnotacao();
        var nomeLegendaCirculo = solicitarNomeLegendaAnotacao('circulo', '');
        adicionarAnotacao(L.circle(anotacaoInicio, Object.assign({}, estiloCirculo, {
          radius: raio
        })), 'circulo', {
          estilo: estiloFormaDaCamada({ options: estiloCirculo }),
          nomeLegenda: nomeLegendaCirculo
        });
      }
      limparPreviewAnotacao();
      ativarFerramentaAnotacao('circulo');
    }
  }

  function processarMousemoveAnotacao(e) {
    if (!anotacaoFerramenta) return;

    if (anotacaoFerramenta === 'linha' && anotacaoLinhaPontos.length) {
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      anotacaoPreview = L.polyline(anotacaoLinhaPontos.concat([e.latlng]), Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: '6,6'
      })).addTo(map);
      return;
    }

    if (!anotacaoInicio) return;
    if (anotacaoPreview) map.removeLayer(anotacaoPreview);

    if (anotacaoFerramenta === 'retangulo') {
      anotacaoPreview = L.rectangle(L.latLngBounds(anotacaoInicio, e.latlng), Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: '6,6'
      })).addTo(map);
    }

    if (anotacaoFerramenta === 'circulo') {
      anotacaoPreview = L.circle(anotacaoInicio, Object.assign({}, lerEstiloFormaAnotacao(), {
        radius: anotacaoInicio.distanceTo(e.latlng),
        dashArray: '6,6'
      })).addTo(map);
    }
  }

  function exportarArquivoAnotacoes() {
    var data = new Date().toISOString().slice(0, 10);
    var nomePadrao = 'anotacoes_mapa_pop2_' + data;
    var nomeInformado = window.prompt('Nome do arquivo GeoJSON:', nomePadrao);
    if (nomeInformado === null) return;
    var nomeArquivo = nomeArquivoSeguroAnotacao(nomeInformado) || nomePadrao;
    if (!/\.geojson$/i.test(nomeArquivo)) nomeArquivo += '.geojson';

    var blob = new Blob([JSON.stringify(exportarAnotacoesGeoJSON(), null, 2)], {
      type: 'application/geo+json'
    });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
    setStatusAnotacao('Anotações exportadas em GeoJSON');
  }

  function inicializarAnotacoes() {
    map.on('click', processarCliqueAnotacao);
    map.on('mousemove', processarMousemoveAnotacao);
    map.on('dblclick', function(e) {
      if (anotacaoFerramenta === 'linha') {
        if (e.originalEvent) {
          L.DomEvent.preventDefault(e.originalEvent);
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        finalizarLinhaAnotacao();
      }
    });
    map.getContainer().addEventListener('contextmenu', function(e) {
      if (!anotacaoFerramenta) return;
      e.preventDefault();
      e.stopPropagation();
      if (anotacaoFerramenta === 'linha') finalizarLinhaAnotacao();
    }, true);

    var botoes = [
      ['drawLinha', 'linha'],
      ['drawPonto', 'ponto'],
      ['drawRetangulo', 'retangulo'],
      ['drawCirculo', 'circulo'],
      ['drawTexto', 'texto']
    ];
    botoes.forEach(function(item) {
      var botao = document.getElementById(item[0]);
      if (botao) botao.addEventListener('click', function() {
        ativarFerramentaAnotacao(item[1]);
      });
    });

    var limpar = document.getElementById('drawLimpar');
    if (limpar) limpar.addEventListener('click', function() {
      if (!anotacoesLayer.getLayers().length) return;
      if (!window.confirm('Limpar todas as anotações salvas neste navegador?')) return;
      anotacoesLayer.clearLayers();
      anotacoesHistorico = [];
      salvarAnotacoesLocal();
      renderizarLegendaAnotacoes();
    });

    var exportar = document.getElementById('drawExportar');
    if (exportar) exportar.addEventListener('click', exportarArquivoAnotacoes);

    var botaoLegendaAnotacoes = document.getElementById('toggleLegendaAnotacoes');
    if (botaoLegendaAnotacoes) {
      botaoLegendaAnotacoes.addEventListener('click', function() {
        legendaAnotacoesAtiva = !legendaAnotacoesAtiva;
        atualizarBotaoLegendaAnotacoes();
        renderizarLegendaAnotacoes();
      });
      atualizarBotaoLegendaAnotacoes();
    }

    ['drawCorLinha', 'drawEspessuraLinha', 'drawOpacidadePreenchimento', 'drawFormatoPonto', 'drawTamanhoPonto', 'drawCorTexto', 'drawTamanhoTexto'].forEach(function(id) {
      var campo = document.getElementById(id);
      if (campo) campo.addEventListener('input', atualizarIndicadoresEstiloAnotacao);
    });
    atualizarIndicadoresEstiloAnotacao();

    var importar = document.getElementById('drawImportar');
    var arquivo = document.getElementById('drawImportArquivo');
    if (importar && arquivo) {
      importar.addEventListener('click', function() { arquivo.click(); });
      arquivo.addEventListener('change', function() {
        var file = arquivo.files && arquivo.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
          try {
            carregarAnotacoesGeoJSON(JSON.parse(reader.result), true);
            setStatusAnotacao('Anotações importadas e salvas no navegador');
          } catch (erro) {
            setStatusAnotacao('Não foi possível importar o arquivo');
            console.warn('Falha ao importar anotações:', erro);
          }
          arquivo.value = '';
        };
        reader.readAsText(file);
      });
    }

    carregarAnotacoesLocal();
    renderizarLegendaAnotacoes();
    if (!anotacoesLayer.getLayers().length) setStatusAnotacao('Sem ferramenta ativa');
  }

  inicializarAnotacoes();

  var oaeFiltroAtivo = false;
  var sreBaseFiltroAtivo = true;
  var snvFiltroAtivo = true;
  var localidadeFiltroAtivo = true;
  var municipioBaseFiltroAtivo = true;
  var densidadeRotulos = 0;

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
          var link = item && (item.LINK_DOR || item.LINK_FUND);
          if (link) {
            var chave = String(link);
            if (!obrasDorPorLink[chave]) obrasDorPorLink[chave] = [];
            obrasDorPorLink[chave].push(item);
          }
        }

        console.log('OBRAS_LINHAS_DOR carregado:', obrasDorData.length);
        preencherServicos();
        if (sreData && municipiosData) {
          preencherRodovias();
          preencherSREs();
          preencherPropostas();
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
    if (obrasLabelLayer) {
      map.removeLayer(obrasLabelLayer);
      obrasLabelLayer = null;
    }
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

      if (!sre) return;
      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) return;
      adicionarUnico(sres, sre);
    }

    if (sreData && sreData.features) {
      sreData.features.forEach(considerarFeature);
    }
    if (sreBaseData && sreBaseData.features) {
      sreBaseData.features.forEach(considerarFeature);
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
      var dadosFund = dadosFundeinfraDaFeature(feature);
      var dadosDorTodos = dadosDorDaFeatureTodos(feature);

      var sre = nomeSREFeature(feature);
      var rodovia = nomeRodoviaFeature(feature);
      var nmMun = valorSeguro(feature, 'NM_MUN');
      var rgPlan = valorSeguro(feature, 'RG_PLAN');

      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) return;
      if (sreSelecionado && sre !== sreSelecionado) return;

      if (servicosAtivos.FUNDEINFRA && dadosFund && dadosFund.PROPOSTA !== null && dadosFund.PROPOSTA !== undefined && String(dadosFund.PROPOSTA).trim() !== '') {
        adicionarUnico(propostas, String(dadosFund.PROPOSTA));
      }
      if (servicosAtivos.DOR) {
        for (var i = 0; i < dadosDorTodos.length; i++) {
          var dadosDor = dadosDorTodos[i];
          if (dadosDor.PROPOSTA !== null && dadosDor.PROPOSTA !== undefined && String(dadosDor.PROPOSTA).trim() !== '') {
            adicionarUnico(propostas, String(dadosDor.PROPOSTA));
          }
        }
      }
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
    var rgSelecionada = document.getElementById('rgPlanSelect').value;
    var municipioSelecionado = document.getElementById('municipioSelect').value;
    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';

    var feats = [];
    function considerarFeature(f, base) {
      var nmMun = valorSeguro(f, 'NM_MUN');
      var rgPlan = valorSeguro(f, 'RG_PLAN');
      var rodovia = nomeRodoviaFeature(f);
      var sre = nomeSREFeature(f);

      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      if (rodoviaSelecionada && rodovia !== rodoviaSelecionada) return;
      if (sreSelecionado && sre !== sreSelecionado) return;
      if (propostaSelecionada) {
        var dadosFund = dadosFundeinfraDaFeature(f);
        var dadosDorFiltrados = dadosDorDaFeatureFiltrados(f, '', propostaSelecionada);
        if ((!dadosFund || String(dadosFund.PROPOSTA) !== String(propostaSelecionada)) &&
            !dadosDorFiltrados.length) return;
      }

      feats.push(f);
    }

    if (sreData && sreData.features) {
      for (var i = 0; i < sreData.features.length; i++) considerarFeature(sreData.features[i]);
    }
    if (sreBaseData && sreBaseData.features && (rodoviaSelecionada || sreSelecionado) && !propostaSelecionada) {
      for (var j = 0; j < sreBaseData.features.length; j++) considerarFeature(sreBaseData.features[j], true);
    }
    if (snvData && snvData.features && rodoviaSelecionada && !propostaSelecionada) {
      for (var k = 0; k < snvData.features.length; k++) considerarFeature(snvData.features[k], true);
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

      if (!nome) return;
      if (municipioSelecionado && nmMun && nmMun !== municipioSelecionado) return;
      if (!municipioSelecionado && rgSelecionada && rgPlan && rgPlan !== rgSelecionada) return;
      adicionarUnico(rodovias, nome);
    }

    if (sreData && sreData.features) {
      sreData.features.forEach(considerarFeature);
    }
    if (sreBaseData && sreBaseData.features) {
      sreBaseData.features.forEach(considerarFeature);
    }
    if (snvData && snvData.features) {
      snvData.features.forEach(considerarFeature);
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

  function valorDensidadeRotulos() {
    return Math.max(0, Math.min(4, Number(densidadeRotulos) || 0));
  }

  function adicionarUnico(lista, valor) {
    if (valor && lista.indexOf(valor) === -1) lista.push(valor);
  }

  function featureTemServicoAtivo(feature) {
    var linkFund = valorSeguro(feature, 'LINK_FUND');
    var linkDor = valorSeguro(feature, 'LINK_DOR');
    return (
      (servicosAtivos.FUNDEINFRA && linkFund && dadosFundeinfraDaFeature(feature)) ||
      (servicosAtivos.DOR && linkDor && dadosDorDaFeature(feature))
    );
  }

  function textoDensidadeRotulos(valor) {
    return valor === 0 ? 'Automático' : String(valor);
  }

  function atualizarTextoDensidadeRotulos() {
    var alvo = document.getElementById('rotulosDensidadeValor');
    if (alvo) alvo.textContent = textoDensidadeRotulos(valorDensidadeRotulos());
  }

    function atualizarVisibilidadeRotulos() {
    if (!localidadesLayer) return;

    var zoom = map.getZoom();
    var densidade = valorDensidadeRotulos();
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
      var elLabel = label.layer.getElement();
      if (!elLabel) return;

      if (densidade === 4) {
        elLabel.style.display = 'block';
        return;
      }

      // Goiânia fica sempre visível
      if (label.nomeLocalidade === 'Goiânia') {
        elLabel.style.display = 'block';
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
      zoomNecessario = zoomNecessario - densidade;

      if (zoom < zoomNecessario) {
        elLabel.style.display = 'none';
        return;
      }

      // Verificar sobreposição
      var folga = densidade === 3 ? 0.55 : densidade === 2 ? 0.7 : densidade === 1 ? 0.85 : 1;
      var labelRect = {
        left: label.pixelPos.x - (60 * folga),
        right: label.pixelPos.x + (60 * folga),
        top: label.pixelPos.y - (18 * folga),
        bottom: label.pixelPos.y + (6 * folga)
      };

      var overlaps = densidade < 3 && occupiedAreas.some(function(area) {
        return !(labelRect.right < area.left || labelRect.left > area.right ||
                 labelRect.bottom < area.top || labelRect.top > area.bottom);
      });

      if (!overlaps) {
        elLabel.style.display = 'block';
        occupiedAreas.push(labelRect);
      } else {
        elLabel.style.display = 'none';
      }
    });

    // Controlar visibilidade dos pontos (bolinhas brancas) com a MESMA lógica dos rótulos
    pontos.forEach(function(ponto) {
      if (!ponto.layer.getElement()) return;

      if (densidade === 4) {
        ponto.layer.getElement().style.display = 'block';
        return;
      }

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
      zoomNecessario = zoomNecessario - densidade;

      if (zoom >= zoomNecessario) {
        ponto.layer.getElement().style.display = 'block';
      } else {
        ponto.layer.getElement().style.display = 'none';
      }
    });
  }

  function criarMarcadorLabel(latlng, texto, rodovia, tipo) {
    var federal = tipo === 'federal';
    var html = federal
      ? '<div class="snv-escudo-federal">' +
          '<svg viewBox="0 0 100 105" aria-hidden="true" focusable="false">' +
            '<path d="M50 9 C39 21 28 22 16 15 L5 29 C16 42 16 56 9 70 C4 82 12 92 27 94 C38 95 46 97 50 103 C54 97 62 95 73 94 C88 92 96 82 91 70 C84 56 84 42 95 29 L84 15 C72 22 61 21 50 9 Z"></path>' +
            '<text x="50" y="64">' + texto + '</text>' +
          '</svg>' +
        '</div>'
      : '<div class="sre-escudo-circular">' + texto + '</div>';

    return L.marker(latlng, {
      icon: L.divIcon({
        className: federal ? 'sre-label-escudo snv-label-escudo' : 'sre-label-escudo',
        html: html,
        iconSize: federal ? [26, 26] : [18, 18],
        iconAnchor: federal ? [13, 13] : [9, 9]
      }),
      rodovia: rodovia,
      tipoRotulo: tipo || 'estadual'
    });
  }

    function atualizarVisibilidadeRotulosSRE() {
    if (!sreBaseLabelLayer && !snvLabelLayer) return;

    var zoom = map.getZoom();
    var densidade = valorDensidadeRotulos();
    var labels = [];

    // --- COLETAR ÁREAS OCUPADAS PELOS RÓTULOS DE LOCALIDADES (prioridade) ---
    var occupiedAreas = [];

    if (localidadesLayer && localidadeFiltroAtivo && densidade < 3) {
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
          rodovia: layer.options.rodovia || '',
          tipoRotulo: layer.options.tipoRotulo || 'estadual'
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
          rodovia: layer.options.rodovia || '',
          tipoRotulo: layer.options.tipoRotulo || 'federal'
        });
      });
    }

    labels.forEach(function(label) {
      var elLabel = label.layer.getElement();
      if (!elLabel) return;

      if (densidade === 4) {
        elLabel.style.display = 'block';
        return;
      }

      var zoomNecessario;
      if (zoom >= 10) {
        zoomNecessario = 9;
      } else if (zoom >= 9) {
        zoomNecessario = 9;
      } else {
        zoomNecessario = 99;
      }
      if (densidade > 0) {
        zoomNecessario = Math.max(5, 9 - densidade);
      }
      if (zoom < zoomNecessario) {
        elLabel.style.display = 'none';
        return;
      }

      // Verificar sobreposição entre escudos e com labels de localidades
      var metade = label.tipoRotulo === 'federal' ? 22 : 18;
      var folga = densidade === 3 ? 0.55 : densidade === 2 ? 0.7 : densidade === 1 ? 0.85 : 1;
      var labelRect = {
        left: label.pixelPos.x - (metade * folga),
        right: label.pixelPos.x + (metade * folga),
        top: label.pixelPos.y - (metade * folga),
        bottom: label.pixelPos.y + (metade * folga)
      };

      var overlaps = densidade < 3 && occupiedAreas.some(function(area) {
        return !(labelRect.right < area.left || labelRect.left > area.right ||
                 labelRect.bottom < area.top || labelRect.top > area.bottom);
      });
      if (!overlaps) {
        elLabel.style.display = 'block';
        occupiedAreas.push(labelRect);
      } else {
        elLabel.style.display = 'none';
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

      var labelLayer = criarMarcadorLabel(latlng, ultimos3Digitos, rodovia, 'federal');
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
    var dados = dadosDorDaFeatureTodos(feature);
    return dados.length ? dados[0] : null;
  }

  function dadosDorDaFeatureTodos(feature) {
    var link = valorSeguro(feature, 'LINK_DOR');
    if (!link) return [];
    var dados = obrasDorPorLink[String(link)] || [];
    return Array.isArray(dados) ? dados : [dados];
  }

  function dadosDorDaFeatureFiltrados(feature, servico, proposta) {
    var todos = dadosDorDaFeatureTodos(feature);
    var filtrados = [];

    for (var i = 0; i < todos.length; i++) {
      var item = todos[i];
      if (servico && item.SERVICO !== servico) continue;
      if (proposta && String(item.PROPOSTA) !== String(proposta)) continue;
      filtrados.push(item);
    }

    return filtrados;
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

  function coordenadasLinhaPrincipal(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    if (geometry.type === 'LineString') return geometry.coordinates;
    if (geometry.type === 'MultiLineString') {
      var maior = null;
      for (var i = 0; i < geometry.coordinates.length; i++) {
        var linha = geometry.coordinates[i];
        if (!maior || (linha && linha.length > maior.length)) maior = linha;
      }
      return maior;
    }
    return null;
  }

  function pontoMedioLinha(feature) {
    var coords = coordenadasLinhaPrincipal(feature && feature.geometry);
    if (!coords || coords.length < 2) return null;
    var midIndex = Math.floor(coords.length / 2);
    var midCoord = coords[midIndex];
    if (!midCoord || midCoord.length < 2) return null;
    return [midCoord[1], midCoord[0]];
  }

  function segmentoMedioLinha(feature) {
    var coords = coordenadasLinhaPrincipal(feature && feature.geometry);
    if (!coords || coords.length < 2) return null;
    var midIndex = Math.floor(coords.length / 2);
    var anterior = coords[Math.max(0, midIndex - 1)];
    var proximo = coords[Math.min(coords.length - 1, midIndex + 1)];
    if (!anterior || !proximo || anterior.length < 2 || proximo.length < 2) return null;
    return {
      a: [anterior[1], anterior[0]],
      b: [proximo[1], proximo[0]]
    };
  }

  function anguloSegmentoMedio(feature) {
    var segmento = segmentoMedioLinha(feature);
    if (!segmento) return 0;
    var pontoA = map.latLngToLayerPoint(segmento.a);
    var pontoB = map.latLngToLayerPoint(segmento.b);
    return Math.atan2(pontoB.y - pontoA.y, pontoB.x - pontoA.x) * 180 / Math.PI;
  }

  function siglaOrigemEtapa(dados, origem, link) {
    var linkTxt = String(link || '');
    var prefixo = linkTxt.split('_')[0];
    if (prefixo && prefixo.length <= 3) {
      return prefixo.charAt(0).toUpperCase() + prefixo.slice(1).toLowerCase();
    }

    if (origem === 'DOR') return 'Do';

    var etapa = String((dados && dados.ETAPA) || '').toLowerCase();
    if (etapa.indexOf('projeto') >= 0) return 'Fp';
    return 'Fo';
  }

  function criarRotuloObra(latlng, dados, origem, link, cor, angulo) {
    var sigla = siglaOrigemEtapa(dados, origem, link);
    var proposta = dados && dados.PROPOSTA !== null && dados.PROPOSTA !== undefined ? String(dados.PROPOSTA) : '';
    var titulo = origem + ' - ' + ((dados && dados.SERVICO) || 'Servico') + ' - ' + ((dados && dados.ETAPA) || 'Etapa');
    var anguloOffset = isFinite(angulo) ? angulo + 90 : 0;

    return L.marker(latlng, {
      pane: 'rotulosServicosPane',
      interactive: false,
      anguloLinhaObra: isFinite(angulo) ? angulo : 0,
      anguloOffsetObra: anguloOffset,
      icon: L.divIcon({
        className: 'obra-label-icon',
        html:
          '<div class="obra-label-chamada" style="background:' + cor + ';"></div>' +
          '<div class="obra-label-offset">' +
          '<div class="obra-label" title="' + escapeHtml(titulo) + '">' +
            '<div class="obra-label-top">' + escapeHtml(sigla) + '</div>' +
            '<div class="obra-label-bottom" style="background:' + cor + ';">' + escapeHtml(proposta) + '</div>' +
          '</div>' +
          '</div>',
        iconSize: [42, 46],
        iconAnchor: [21, 23]
      })
    });
  }

  function adicionarRotuloObra(grupo, feature, dados, origem, link, cor) {
    var latlng = pontoMedioLinha(feature);
    if (!latlng) return;
    grupo.addLayer(criarRotuloObra(latlng, dados, origem, link, cor, anguloSegmentoMedio(feature)));
  }

  function retangulosOcupadosRotulosBase() {
    var ocupados = [];

    if (localidadesLayer && localidadeFiltroAtivo) {
      localidadesLayer.eachLayer(function(layer) {
        var el = layer.getElement && layer.getElement();
        if (!el || el.style.display === 'none') return;

        var p = map.latLngToContainerPoint(layer.getLatLng());
        if (layer.options && layer.options.icon && layer.options.icon.options.className === 'localidade-label') {
          ocupados.push({
            left: p.x - 66,
            right: p.x + 66,
            top: p.y - 22,
            bottom: p.y + 10,
            tipo: 'base'
          });
        } else if (layer instanceof L.CircleMarker) {
          ocupados.push({
            left: p.x - 8,
            right: p.x + 8,
            top: p.y - 8,
            bottom: p.y + 8,
            tipo: 'base'
          });
        }
      });
    }

    function adicionarEscudos(layerGroup) {
      if (!layerGroup) return;
      layerGroup.eachLayer(function(layer) {
        var el = layer.getElement && layer.getElement();
        if (!el || el.style.display === 'none') return;

        var p = map.latLngToContainerPoint(layer.getLatLng());
        var metade = layer.options && layer.options.tipoRotulo === 'federal' ? 24 : 20;
        ocupados.push({
          left: p.x - metade,
          right: p.x + metade,
          top: p.y - metade,
          bottom: p.y + metade,
          tipo: 'base'
        });
      });
    }

    adicionarEscudos(sreBaseLabelLayer);
    adicionarEscudos(snvLabelLayer);

    return ocupados;
  }

  function retangulosSobrepostos(a, b) {
    return !(a.right < b.left || a.left > b.right ||
             a.bottom < b.top || a.top > b.bottom);
  }

  function pontoDentroRetangulo(p, r) {
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }

  function orientacaoSegmento(a, b, c) {
    return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  }

  function segmentosCruzam(a, b, c, d) {
    var o1 = orientacaoSegmento(a, b, c);
    var o2 = orientacaoSegmento(a, b, d);
    var o3 = orientacaoSegmento(c, d, a);
    var o4 = orientacaoSegmento(c, d, b);
    return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
      ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
  }

  function segmentoCruzaRetangulo(a, b, r, margem) {
    var rect = {
      left: r.left - margem,
      right: r.right + margem,
      top: r.top - margem,
      bottom: r.bottom + margem
    };

    if (pontoDentroRetangulo(a, rect) || pontoDentroRetangulo(b, rect)) return true;

    var tl = { x: rect.left, y: rect.top };
    var tr = { x: rect.right, y: rect.top };
    var br = { x: rect.right, y: rect.bottom };
    var bl = { x: rect.left, y: rect.bottom };
    return segmentosCruzam(a, b, tl, tr) ||
      segmentosCruzam(a, b, tr, br) ||
      segmentosCruzam(a, b, br, bl) ||
      segmentosCruzam(a, b, bl, tl);
  }

  function atualizarVisibilidadeRotulosObras() {
    if (!obrasLabelLayer) return;
    var mostrar = document.body.classList.contains('modo-impressao') &&
      rotulosObrasPrintAtivos;
    var ocupados = retangulosOcupadosRotulosBase();

    obrasLabelLayer.eachLayer(function(layer) {
      var el = layer.getElement && layer.getElement();
      if (!el) return;

      el.style.display = mostrar ? 'block' : 'none';
      if (!mostrar) return;

      var offsetEl = el.querySelector('.obra-label-offset');
      var chamadaEl = el.querySelector('.obra-label-chamada');
      if (!offsetEl) return;

      var base = map.latLngToContainerPoint(layer.getLatLng());
      var anguloLinha = layer.options.anguloLinhaObra || 0;
      var anguloPerp = layer.options.anguloOffsetObra || 90;
      var radPerp = anguloPerp * Math.PI / 180;
      var radLinha = anguloLinha * Math.PI / 180;
      var largura = 50;
      var altura = 54;
      var raioRotulo = 21;
      var folga = 5;
      var distanciaInicial = 24;
      var distancias = [distanciaInicial, 29, 34, 40, 47, 55, 64, 74, 86, 100, 116];
      var deslocamentos = [0, 14, -14, 28, -28, 42, -42, 56, -56, 72, -72, 90, -90];
      var angulosRadiais = [90, -90, 67, -67, 112, -112, 45, -45, 135, -135];
      var melhor = null;

      function avaliarCandidato(cx, cy, prioridade, distancia, deslocamento) {
        var rect = {
          left: cx - largura / 2 - folga,
          right: cx + largura / 2 + folga,
          top: cy - altura / 2 - folga,
          bottom: cy + altura / 2 + folga
        };
        var centro = { x: cx, y: cy };
        var pontuacao = prioridade + distancia * 1.8 + Math.abs(deslocamento) * 0.7;
        var temSobreposicao = false;

        for (var oi = 0; oi < ocupados.length; oi++) {
          var area = ocupados[oi];
          if (retangulosSobrepostos(rect, area)) {
            temSobreposicao = true;
            pontuacao += area.tipo === 'base' ? 50000 : 120000;
          }
          if (segmentoCruzaRetangulo(base, centro, area, area.tipo === 'base' ? 5 : 2)) {
            pontuacao += area.tipo === 'base' ? 8000 : 4500;
          }
        }

        if (temSobreposicao) pontuacao += 20000;

        if (!melhor || pontuacao < melhor.pontuacao) {
          melhor = {
            pontuacao: pontuacao,
            rect: rect,
            dx: cx - base.x,
            dy: cy - base.y
          };
        }
      }

      for (var di = 0; di < distancias.length; di++) {
        for (var li = 0; li < deslocamentos.length; li++) {
          for (var ladoTentativa = 0; ladoTentativa < 2; ladoTentativa++) {
            var lado = ladoTentativa === 0 ? 1 : -1;
            var distanciaPerp = distancias[di];
            var deslocamentoLinha = deslocamentos[li];
            avaliarCandidato(
              base.x + Math.cos(radPerp) * distanciaPerp * lado + Math.cos(radLinha) * deslocamentoLinha,
              base.y + Math.sin(radPerp) * distanciaPerp * lado + Math.sin(radLinha) * deslocamentoLinha,
              ladoTentativa * 8,
              distanciaPerp,
              deslocamentoLinha
            );
          }
        }
      }

      for (var ai = 0; ai < angulosRadiais.length; ai++) {
        var rad = (anguloLinha + angulosRadiais[ai]) * Math.PI / 180;
        for (var ri = 0; ri < 6; ri++) {
          avaliarCandidato(
            base.x + Math.cos(rad) * distancias[ri],
            base.y + Math.sin(rad) * distancias[ri],
            18 + Math.abs(90 - Math.abs(angulosRadiais[ai])) * 0.25,
            distancias[ri],
            0
          );
        }
      }

      var escolhido = melhor || {
        rect: {
          left: base.x - largura / 2,
          right: base.x + largura / 2,
          top: base.y - altura / 2,
          bottom: base.y + altura / 2
        },
        dx: Math.cos(radPerp) * distanciaInicial,
        dy: Math.sin(radPerp) * distanciaInicial
      };

      offsetEl.style.transform =
        'translate(' + escolhido.dx.toFixed(1) + 'px, ' + escolhido.dy.toFixed(1) + 'px)';
      if (chamadaEl) {
        var comprimentoCentro = Math.sqrt(escolhido.dx * escolhido.dx + escolhido.dy * escolhido.dy);
        var comprimentoLinha = Math.max(0, comprimentoCentro - raioRotulo);
        var anguloChamada = Math.atan2(escolhido.dy, escolhido.dx) * 180 / Math.PI;
        chamadaEl.style.display = comprimentoLinha > 6 ? 'block' : 'none';
        chamadaEl.style.width = comprimentoLinha.toFixed(1) + 'px';
        chamadaEl.style.transform = 'rotate(' + anguloChamada.toFixed(2) + 'deg)';
      }
      ocupados.push(escolhido.rect);
    });
  }

    function construirPopupLinha(feature) {
      var p = feature.properties || {};
      var dadosFund = dadosFundeinfraDaFeature(feature);
      var dadosDorTodos = dadosDorDaFeatureTodos(feature);

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

      if (dadosDorTodos.length) {
        html += '<br><br><b>-- DOR --</b><br>';
        for (var i = 0; i < dadosDorTodos.length; i++) {
          var dadosDor = dadosDorTodos[i];
          if (dadosDorTodos.length > 1) {
            if (i > 0) html += '<br>';
            html += '<b>Registro ' + (i + 1) + '</b><br>';
          }
          html += '<b>Proposta:</b> ' + escapeHtml(dadosDor.PROPOSTA || '') + '<br>';
          html += '<b>Servico:</b> ' + escapeHtml(dadosDor.SERVICO || '') + '<br>';
          html += '<b>Etapa:</b> ' + escapeHtml(dadosDor.ETAPA || '') + '<br>';
          html += '<b>Status:</b> ' + escapeHtml(dadosDor.STATUS || '') + '<br>';
          html += '<b>SEI:</b> ' + escapeHtml(dadosDor.SEI || '') + '<br>';
          html += '<b>Conclusao:</b> ' + escapeHtml(dadosDor.CONCLUSAO || '');
          if (i < dadosDorTodos.length - 1) html += '<br>';
        }
      }

      if (false) {
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
      var sombra = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        interactive: false,
        style: function() {
          return {
            color: '#111827',
            weight: espessura + 5,
            opacity: 0.24,
            lineCap: 'round',
            lineJoin: 'round'
          };
        }
      });

      var linha = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        style: function() {
          return {
            color: cor,
            weight: espessura,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupLinha(feature));

          layer.on('click', function() {
            atualizarPainelInferior(feature);
          });
        }
      });

      return L.layerGroup([sombra, linha]);
    }

    function construirLayerLinhaBranca(features, cor, espessura) {
      var pesoBase = 9;
      var pesoTopo = 3;

      var sombra = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        interactive: false,
        style: function() {
          return {
            color: '#111827',
            weight: pesoBase + 5,
            opacity: 0.24,
            lineCap: 'round',
            lineJoin: 'round'
          };
        }
      });

      var base = L.geoJSON({
        type: 'FeatureCollection',
        features: features
      }, {
        pane: 'servicosPane',
        style: function() {
          return {
            color: cor,
            weight: pesoBase,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
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
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round'
          };
        },
        onEachFeature: function(feature, layer) {
          layer.bindPopup(construirPopupLinha(feature));

          layer.on('click', function() {
            atualizarPainelInferior(feature);
          });
        }
      });

      return L.layerGroup([sombra, base, topo]);
    }
  
  function criarLegendaLinha(tipo, cor) {
    if (tipo === 'dup') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha-dup-base" style="height:5px;background:' + cor + ';"></span>' +
        '<span class="legenda-linha-dup-miolo" style="height:2px;"></span>' +
      '</span>';
    }
    if (tipo === 'dashed-red') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha-eod-base" style="height:5px;background:' + cor + ';"></span>' +
        '<span class="legenda-linha-eod-miolo" style="border-top:2px dashed ' + cor + '; background:transparent; height:0;"></span>' +
      '</span>';
    }
    if (tipo === 'dashed-green') {
      return '<span class="legenda-linha-wrap">' +
        '<span class="legenda-linha legenda-linha-tracejada" style="border-top-color:' + cor + '; border-top-width:3px;"></span>' +
      '</span>';
    }
    return '<span class="legenda-linha-wrap">' +
      '<span class="legenda-linha" style="height:4px;background:' + cor + ';"></span>' +
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
        var dadosDFiltrados = dadosDorDaFeatureFiltrados(fd, servicoFiltroAtivo, propostaSelecionada);
        if (!dadosDFiltrados.length) continue;
        // Se já tem LINK_FUND e FUNDEINFRA está ativo, pula (prioridade FUNDEINFRA)
        if (servicosAtivos.FUNDEINFRA && valorSeguro(fd, 'LINK_FUND') && linksFundIncluidos[String(valorSeguro(fd, 'LINK_FUND'))]) continue;
        if (rodoviaSelecionada && nomeRodoviaFeature(fd) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(fd) !== sreSelecionado) continue;
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
        dados = dadosDorDaFeatureFiltrados(feat, servicoFiltroAtivo, propostaSelecionada)[0] || dadosDorDaFeature(feat);
        estilo = estiloDor(dados);
        chaveId = 'DOR_' + String(linkDor) + '_' + k;
      } else if (linkFund && dadosFundeinfraDaFeature(feat)) {
        dados = dadosFundeinfraDaFeature(feat);
        estilo = estiloFundeinfra(dados);
        chaveId = 'FUND_' + String(linkFund) + '_' + k;
      } else if (linkDor && dadosDorDaFeature(feat)) {
        dados = dadosDorDaFeatureFiltrados(feat, servicoFiltroAtivo, propostaSelecionada)[0] || dadosDorDaFeature(feat);
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

    obrasLabelLayer = L.layerGroup();
    var rotulosIncluidos = {};
    for (var rl = 0; rl < linhasBase.length; rl++) {
      var featRotulo = linhasBase[rl];
      var linkFundRotulo = valorSeguro(featRotulo, 'LINK_FUND');
      var linkDorRotulo = valorSeguro(featRotulo, 'LINK_DOR');
      var dadosRotulo = null;
      var estiloRotulo = null;
      var origemRotulo = '';
      var linkRotulo = '';

      if (linkFundRotulo && dadosFundeinfraDaFeature(featRotulo) && servicosAtivos.FUNDEINFRA) {
        dadosRotulo = dadosFundeinfraDaFeature(featRotulo);
        estiloRotulo = estiloFundeinfra(dadosRotulo);
        origemRotulo = 'FUNDEINFRA';
        linkRotulo = linkFundRotulo;
      } else if (linkDorRotulo && dadosDorDaFeature(featRotulo) && servicosAtivos.DOR) {
        dadosRotulo = dadosDorDaFeatureFiltrados(featRotulo, servicoFiltroAtivo, propostaSelecionada)[0] || dadosDorDaFeature(featRotulo);
        estiloRotulo = estiloDor(dadosRotulo);
        origemRotulo = 'DOR';
        linkRotulo = linkDorRotulo;
      }

      if (!dadosRotulo || !estiloRotulo) continue;

      var chaveRotulo = origemRotulo + '|' + String(linkRotulo) + '|' + String(dadosRotulo.PROPOSTA || '') + '|' + String(dadosRotulo.SERVICO || '');
      if (rotulosIncluidos[chaveRotulo]) continue;
      rotulosIncluidos[chaveRotulo] = true;
      adicionarRotuloObra(obrasLabelLayer, featRotulo, dadosRotulo, origemRotulo, linkRotulo, estiloRotulo.cor);
    }
    obrasLabelLayer.addTo(map);
    atualizarVisibilidadeRotulosObras();

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
      var dadosDorTodos = dadosDorDaFeatureTodos(feature);

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

      if (dadosDorTodos.length) {
        html += `
        <div class="bloco-servico">
          <div class="titulo-servico">Dados DOR</div>
          <table class="tabela-servico">
            <tr><th>Proposta</th><th>Servico</th><th>Etapa</th><th>Status</th><th>SEI</th><th>Conclusao</th></tr>`;
        for (var i = 0; i < dadosDorTodos.length; i++) {
          var dadosDor = dadosDorTodos[i];
          html += `
            <tr>
              <td>${dadosDor.PROPOSTA || ''}</td>
              <td>${dadosDor.SERVICO || ''}</td>
              <td>${dadosDor.ETAPA || ''}</td>
              <td>${dadosDor.STATUS || ''}</td>
              <td>${dadosDor.SEI || ''}</td>
              <td>${dadosDor.CONCLUSAO || ''}</td>
            </tr>`;
        }
        html += `
          </table>
        </div>`;
      }

      if (false) {
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
      preencherRodovias();
      preencherSREs();
      preencherPropostas();
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

  // ===== IMPRESSAO / PDF =====

  var FORMATOS_IMPRESSAO = {
    A4: { largura: 210, altura: 297 },
    A3: { largura: 297, altura: 420 },
    A2: { largura: 420, altura: 594 },
    A1: { largura: 594, altura: 841 },
    A0: { largura: 841, altura: 1189 }
  };

  var estadoMapaAntesImpressao = null;

  function dimensoesPapelImpressao() {
    var formato = document.getElementById('printFormato').value || 'A4';
    var orientacao = document.getElementById('printOrientacao').value || 'landscape';

    if (formato === 'personalizado') {
      var larguraPersonalizada = parseFloat(document.getElementById('printLarguraPersonalizada').value);
      var alturaPersonalizada = parseFloat(document.getElementById('printAlturaPersonalizada').value);
      if (!isFinite(larguraPersonalizada)) larguraPersonalizada = 1000;
      if (!isFinite(alturaPersonalizada)) alturaPersonalizada = 700;

      return {
        formato: formato,
        orientacao: orientacao,
        largura: Math.max(50, Math.min(3000, larguraPersonalizada)),
        altura: Math.max(50, Math.min(3000, alturaPersonalizada))
      };
    }

    var base = FORMATOS_IMPRESSAO[formato] || FORMATOS_IMPRESSAO.A4;
    var largura = orientacao === 'landscape' ? base.altura : base.largura;
    var altura = orientacao === 'landscape' ? base.largura : base.altura;

    return {
      formato: formato,
      orientacao: orientacao,
      largura: largura,
      altura: altura
    };
  }

  function formatoImpressaoGrande(dimensoes) {
    if (!dimensoes) dimensoes = dimensoesPapelImpressao();
    var ladoMenor = Math.min(dimensoes.largura, dimensoes.altura);
    var ladoMaior = Math.max(dimensoes.largura, dimensoes.altura);
    return ladoMenor >= FORMATOS_IMPRESSAO.A0.largura &&
      ladoMaior >= FORMATOS_IMPRESSAO.A0.altura;
  }

  function formatoAte(dimensoes, formato) {
    var base = FORMATOS_IMPRESSAO[formato];
    if (!base) return false;
    var ladoMenor = Math.min(dimensoes.largura, dimensoes.altura);
    var ladoMaior = Math.max(dimensoes.largura, dimensoes.altura);
    return ladoMenor <= base.largura && ladoMaior <= base.altura;
  }

  function tituloComCaixaImpressao(dimensoes) {
    return dimensoes.formato === 'A4' ||
      dimensoes.formato === 'A3' ||
      (dimensoes.formato === 'personalizado' && formatoAte(dimensoes, 'A3'));
  }

  function tituloAmpliadoImpressao(dimensoes) {
    return formatoAte(dimensoes, 'A1');
  }

  function legendaAmpliadaImpressao(dimensoes) {
    return dimensoes.formato === 'A4' ||
      dimensoes.formato === 'A3' ||
      dimensoes.formato === 'A2' ||
      dimensoes.formato === 'A1';
  }

  function atualizarBotaoRotulosObrasPrint() {
    var botao = document.getElementById('toggleRotulosObrasPrint');
    if (!botao) return;

    botao.classList.toggle('ativo-filtro', rotulosObrasPrintAtivos);
    botao.textContent = rotulosObrasPrintAtivos ? 'Rótulos das obras: ligados' : 'Rótulos das obras: desligados';
  }

  function aplicarPadraoRotulosObrasPrint() {
    rotulosObrasPrintAtivos = formatoImpressaoGrande(dimensoesPapelImpressao());
    atualizarBotaoRotulosObrasPrint();
    atualizarVisibilidadeRotulosObras();
  }

  function atualizarEstiloPaginaImpressao() {
    var d = dimensoesPapelImpressao();
    var margem = parseFloat(document.getElementById('printMargem').value);
    if (!isFinite(margem)) margem = 12;
    margem = Math.max(5, Math.min(40, margem));

    document.documentElement.style.setProperty('--print-page-width', d.largura + 'mm');
    document.documentElement.style.setProperty('--print-page-height', d.altura + 'mm');
    document.documentElement.style.setProperty('--print-margin', margem + 'mm');
    var larguraBaseA4 = d.orientacao === 'landscape' ? FORMATOS_IMPRESSAO.A4.altura : FORMATOS_IMPRESSAO.A4.largura;
    var escalaTitulo = d.largura / larguraBaseA4;
    var fatorTitulo = tituloAmpliadoImpressao(d) ? 1.2 : 1;
    document.documentElement.style.setProperty('--print-title-font-size', (13 * escalaTitulo * fatorTitulo).toFixed(2) + 'pt');
    var escalaLegenda = d.largura <= larguraBaseA4 ? 0.6 : 1;
    if (legendaAmpliadaImpressao(d)) escalaLegenda *= 1.5;
    document.documentElement.style.setProperty('--print-legend-scale', escalaLegenda.toFixed(2));

    var style = document.getElementById('printPageStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'printPageStyle';
      document.head.appendChild(style);
    }
    style.textContent = '@page { size: ' + d.largura + 'mm ' + d.altura + 'mm; margin: 0; }';

    return d;
  }

  function garantirElementosImpressao() {
    var mapWrap = document.getElementById('map-wrap');
    if (!mapWrap) return;

    if (!document.getElementById('printTitleBox')) {
      var titulo = document.createElement('div');
      titulo.id = 'printTitleBox';
      mapWrap.appendChild(titulo);
    }

    if (!document.getElementById('printLegendBox')) {
      var legenda = document.createElement('div');
      legenda.id = 'printLegendBox';
      mapWrap.appendChild(legenda);
    }

    if (!document.getElementById('printScaleText')) {
      var escala = document.createElement('div');
      escala.id = 'printScaleText';
      mapWrap.appendChild(escala);
    }

    if (!document.getElementById('printServiceTableBox')) {
      var tabela = document.createElement('div');
      tabela.id = 'printServiceTableBox';
      mapWrap.appendChild(tabela);
    }

    if (!document.getElementById('printStampBox')) {
      var carimbo = document.createElement('div');
      carimbo.id = 'printStampBox';
      carimbo.innerHTML =
        '<img src="data/Carimbo_POP2.png" alt="Carimbo do mapa">' +
        '<div class="print-stamp-info">' +
          '<div id="printStampServico" class="print-stamp-servico"></div>' +
          '<div id="printStampData" class="print-stamp-data"></div>' +
        '</div>';
      mapWrap.appendChild(carimbo);
    }
  }

  function atualizarTituloImpressao() {
    var destino = document.getElementById('printTitleBox');
    if (!destino) return;

    var tituloCustom = document.getElementById('printTituloCustom');
    if (tituloCustom && tituloCustom.value.trim()) {
      destino.textContent = tituloCustom.value.trim();
      return;
    }

    var titulo = document.querySelector('.topbar-left strong');
    var complemento = document.querySelector('.topbar-left span');
    var area = document.querySelector('.topbar-right span');
    var partes = [];

    if (titulo && titulo.textContent.trim()) partes.push(titulo.textContent.trim());
    if (complemento && complemento.textContent.trim()) {
      partes.push(complemento.textContent.trim().replace(/^\s*-\s*/, ''));
    }
    if (area && area.textContent.trim() && area.textContent.trim() !== 'ESTADO DE GOIÁS') {
      partes.push(area.textContent.trim());
    }

    destino.textContent = partes.join(' - ');
  }

  function textoMesAnoAtualImpressao() {
    var meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    var data = new Date();
    return meses[data.getMonth()] + ' / ' + data.getFullYear();
  }

  function atualizarCarimboImpressao(dimensoes) {
    var carimbo = document.getElementById('printStampBox');
    if (!carimbo) return;

    if (!formatoImpressaoGrande(dimensoes)) {
      carimbo.style.display = 'none';
      return;
    }

    var servico = document.getElementById('printStampServico');
    var data = document.getElementById('printStampData');
    var nomesServico = [];

    if (servicosAtivos.DOR) nomesServico.push('OBRAS');
    if (servicosAtivos.FUNDEINFRA) nomesServico.push('FUNDEINFRA');

    if (servico) servico.textContent = nomesServico.join(' / ');
    if (data) data.textContent = textoMesAnoAtualImpressao();
    carimbo.style.display = 'block';
  }

  function atualizarLegendaImpressao() {
    var destino = document.getElementById('printLegendBox');
    var origem = document.getElementById('sidebar-right-content');
    if (!destino || !origem) return;

    destino.innerHTML = '';
    var blocos = origem.querySelectorAll('.bloco');
    for (var i = 0; i < blocos.length; i++) {
      var bloco = blocos[i];
      if (bloco.style.display === 'none') continue;
      if (!bloco.textContent.trim()) continue;

      var clone = bloco.cloneNode(true);
      clone.removeAttribute('id');
      var elementosComId = clone.querySelectorAll('[id]');
      for (var j = 0; j < elementosComId.length; j++) {
        elementosComId[j].removeAttribute('id');
      }
      destino.appendChild(clone);
    }

    if (localidadeFiltroAtivo && localidadesLayer && map.hasLayer(localidadesLayer)) {
      var blocoLocalidade = document.createElement('div');
      blocoLocalidade.className = 'bloco legenda-categoria';
      blocoLocalidade.innerHTML =
        '<div class="subtitulo">Localidades</div>' +
        '<div class="legenda-item">' +
          '<span class="legenda-localidade-simbolo"></span>' +
          '<div class="legenda-texto"><b>Localidade</b></div>' +
        '</div>';
      destino.appendChild(blocoLocalidade);
    }

    destino.style.display = destino.children.length ? 'block' : 'none';
  }

  function atualizarTabelaServicosImpressao(dimensoes) {
    var destino = document.getElementById('printServiceTableBox');
    if (!destino) return;

    destino.innerHTML = '';

    if (!formatoImpressaoGrande(dimensoes)) {
      destino.style.display = 'none';
      return;
    }

    var rodoviaSelecionada = document.getElementById('rodoviaSelect').value;
    var sreSelecionado = document.getElementById('sreSelect').value;
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
    var linhasFund = [];
    var linhasDor = [];
    var vistosFund = {};
    var vistosDor = {};

    function valorTabela(valor) {
      return escapeHtml(valor === null || valor === undefined ? '' : valor);
    }

    function linhaTabela(dados, feature) {
      var p = feature.properties || {};
      return '<tr>' +
        '<td>' + valorTabela(dados.PROPOSTA) + '</td>' +
        '<td>' + valorTabela(p.RODOVIA || p.rodovia) + '</td>' +
        '<td>' + valorTabela(p.TRECHO || p.trecho_go) + '</td>' +
        '<td>' + valorTabela(p.EXT_KM || p.ext) + '</td>' +
        '<td>' + valorTabela(dados.SERVICO) + '</td>' +
        '<td>' + valorTabela(dados.ETAPA) + '</td>' +
        '<td>' + valorTabela(dados.STATUS) + '</td>' +
        '<td>' + valorTabela(dados.SEI) + '</td>' +
        '<td>' + valorTabela(dados.CONCLUSAO) + '</td>' +
      '</tr>';
    }

    function blocoTabela(titulo, linhas) {
      if (!linhas.length) return '';
      return '<div class="bloco-servico">' +
        '<div class="titulo-servico">' + escapeHtml(titulo) + '</div>' +
        '<table class="tabela-servico">' +
          '<tr><th>Proposta</th><th>Rodovia</th><th>Trecho</th><th>Ext. km</th><th>Serviço</th><th>Etapa</th><th>Status</th><th>SEI</th><th>Conclusão</th></tr>' +
          linhas.join('') +
        '</table>' +
      '</div>';
    }

    function compararProposta(a, b) {
      var propostaA = a && a.PROPOSTA;
      var propostaB = b && b.PROPOSTA;
      var numeroA = Number(propostaA);
      var numeroB = Number(propostaB);

      if (isFinite(numeroA) && isFinite(numeroB)) return numeroA - numeroB;
      return String(propostaA || '').localeCompare(String(propostaB || ''), 'pt-BR', { numeric: true });
    }

    if (sreData && sreData.features) {
      for (var i = 0; i < sreData.features.length; i++) {
        var feature = sreData.features[i];
        if (rodoviaSelecionada && nomeRodoviaFeature(feature) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(feature) !== sreSelecionado) continue;

        if (servicosAtivos.FUNDEINFRA) {
          var linkFund = valorSeguro(feature, 'LINK_FUND');
          var dadosFund = dadosFundeinfraDaFeature(feature);
          if (linkFund && dadosFund) {
            if (!servicoFiltroAtivo || dadosFund.SERVICO === servicoFiltroAtivo) {
              if (!propostaSelecionada || String(dadosFund.PROPOSTA) === String(propostaSelecionada)) {
                var chaveFund = String(linkFund) + '|' + String(dadosFund.PROPOSTA || '');
                if (!vistosFund[chaveFund]) {
                  linhasFund.push({ dados: dadosFund, feature: feature });
                  vistosFund[chaveFund] = true;
                }
              }
            }
          }
        }

        if (servicosAtivos.DOR) {
          var linkDor = valorSeguro(feature, 'LINK_DOR');
          if (linkDor) {
            var dadosDor = dadosDorDaFeatureFiltrados(feature, servicoFiltroAtivo, propostaSelecionada);
            for (var j = 0; j < dadosDor.length; j++) {
              var itemDor = dadosDor[j];
              var chaveDor = String(linkDor) + '|' + String(itemDor.PROPOSTA || '') + '|' + String(itemDor.SERVICO || '') + '|' + String(itemDor.SEI || '');
              if (!vistosDor[chaveDor]) {
                linhasDor.push({ dados: itemDor, feature: feature });
                vistosDor[chaveDor] = true;
              }
            }
          }
        }
      }
    }

    linhasFund.sort(function(a, b) { return compararProposta(a.dados, b.dados); });
    linhasDor.sort(function(a, b) { return compararProposta(a.dados, b.dados); });

    destino.innerHTML =
      blocoTabela('Dados FUNDEINFRA', linhasFund.map(function(item) { return linhaTabela(item.dados, item.feature); })) +
      blocoTabela('Dados DOR', linhasDor.map(function(item) { return linhaTabela(item.dados, item.feature); }));
    destino.style.display = destino.children.length ? 'block' : 'none';
  }

  function estenderBoundsComLayer(bounds, layer) {
    if (!layer || !map.hasLayer(layer)) return bounds;

    if (typeof layer.getBounds === 'function') {
      var lb = layer.getBounds();
      if (lb && lb.isValid && lb.isValid()) {
        return bounds ? bounds.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast());
      }
    }

    if (typeof layer.getLatLng === 'function') {
      var latlng = layer.getLatLng();
      return bounds ? bounds.extend(latlng) : L.latLngBounds(latlng, latlng);
    }

    if (typeof layer.eachLayer === 'function') {
      layer.eachLayer(function(subLayer) {
        bounds = estenderBoundsComLayer(bounds, subLayer);
      });
    }

    return bounds;
  }

  function obterBoundsGoiasImpressao() {
    if (municipiosData && municipiosData.features && municipiosData.features.length) {
      var boundsGoias = L.geoJSON(municipiosData).getBounds();
      if (boundsGoias && boundsGoias.isValid && boundsGoias.isValid()) return boundsGoias;
    }

    return map.getBounds();
  }

  function lerDenominadorEscala() {
    var campo = document.getElementById('printEscalaPersonalizada');
    var texto = campo ? campo.value : '';
    var somenteDigitos = String(texto).replace(/[^\d]/g, '');
    var denominador = parseInt(somenteDigitos, 10);

    if (!isFinite(denominador) || denominador <= 0) denominador = 1000000;
    if (campo) campo.value = String(denominador).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return denominador;
  }

  function textoEscalaPersonalizada(denominador) {
    return 'Escala 1:' + String(denominador).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function calcularZoomPorEscala(denominador, latCentro) {
    var metrosPorPixelPapel = 0.0254 / 96;
    var resolucaoAlvo = denominador * metrosPorPixelPapel;
    var latitude = Math.max(-85, Math.min(85, latCentro || 0));
    var resolucaoZoomZero = 156543.03392804097 * Math.cos(latitude * Math.PI / 180);
    var zoom = Math.log(resolucaoZoomZero / resolucaoAlvo) / Math.LN2;
    var minZoom = typeof map.getMinZoom === 'function' ? map.getMinZoom() : 0;
    var maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 20;
    if (!isFinite(minZoom)) minZoom = 0;
    if (!isFinite(maxZoom)) maxZoom = 20;

    return Math.max(minZoom, Math.min(maxZoom, zoom));
  }

  function aplicarEscalaPersonalizadaNoMapa() {
    var boundsGoias = obterBoundsGoiasImpressao();
    if (!boundsGoias || !boundsGoias.isValid || !boundsGoias.isValid()) return null;

    var centroGoias = boundsGoias.getCenter();
    var denominador = lerDenominadorEscala();
    map.options.zoomSnap = 0;
    map.invalidateSize(true);
    map.setView(centroGoias, calcularZoomPorEscala(denominador, centroGoias.lat), { animate: false });
    map.panTo(centroGoias, { animate: false });

    return denominador;
  }

  function deslocarMapaParaTabelaA0(dimensoes) {
    if (!formatoImpressaoGrande(dimensoes)) return;
    var tabela = document.getElementById('printServiceTableBox');
    if (!tabela || tabela.style.display === 'none') return;

    var larguraTabela = tabela.offsetWidth || 0;
    if (!larguraTabela) return;
    map.panBy([larguraTabela * 0.42, 0], { animate: false });
  }

  function ajustarMapaParaImpressao(dimensoes) {
    var modoEscala = document.getElementById('printEscala').value || 'tela';
    var textoEscala = document.getElementById('printScaleText');

    map.invalidateSize(true);

    if (modoEscala === 'personalizada') {
      var denominador = aplicarEscalaPersonalizadaNoMapa();
      if (textoEscala) {
        if (denominador) {
          textoEscala.textContent = textoEscalaPersonalizada(denominador);
          textoEscala.style.display = '';
        } else {
          textoEscala.textContent = '';
          textoEscala.style.display = 'none';
        }
      }
      deslocarMapaParaTabelaA0(dimensoes);
      return;
    }

    if (textoEscala) {
      textoEscala.textContent = '';
      textoEscala.style.display = 'none';
    }
    map.setView(estadoMapaAntesImpressao.center, estadoMapaAntesImpressao.zoom, { animate: false });
    deslocarMapaParaTabelaA0(dimensoes);
  }

  function atualizarCampoEscalaPersonalizada() {
    var modo = document.getElementById('printEscala');
    var label = document.getElementById('printEscalaPersonalizadaLabel');
    var campo = document.getElementById('printEscalaPersonalizada');
    var mostrar = modo && modo.value === 'personalizada';

    if (label) label.style.display = mostrar ? '' : 'none';
    if (campo) campo.style.display = mostrar ? '' : 'none';

    if (mostrar) aplicarEscalaPersonalizadaNoMapa();
  }

  function atualizarCamposPapelPersonalizado() {
    var formato = document.getElementById('printFormato');
    var camposPersonalizados = document.getElementById('printPapelPersonalizadoCampos');
    var mostrar = formato && formato.value === 'personalizado';

    if (camposPersonalizados) {
      camposPersonalizados.hidden = !mostrar;
      camposPersonalizados.style.display = mostrar ? 'block' : 'none';
    }
  }

  function sairModoImpressao() {
    document.body.classList.remove('preparando-impressao');
    document.body.classList.remove('modo-impressao');
    document.body.classList.remove('print-formato-a0');
    document.body.classList.remove('print-titulo-com-caixa');
    atualizarVisibilidadeRotulosObras();
    var carimbo = document.getElementById('printStampBox');
    if (carimbo) carimbo.style.display = 'none';

    if (estadoMapaAntesImpressao) {
      map.options.zoomSnap = estadoMapaAntesImpressao.zoomSnap;
      map.setView(estadoMapaAntesImpressao.center, estadoMapaAntesImpressao.zoom, { animate: false });
      estadoMapaAntesImpressao = null;
    }

    setTimeout(function() {
      map.invalidateSize(true);
    }, 100);
  }

  function imprimirMapaAtual() {
    garantirElementosImpressao();

    estadoMapaAntesImpressao = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      zoomSnap: map.options.zoomSnap
    };

    var dimensoes = atualizarEstiloPaginaImpressao();

    document.body.classList.add('modo-impressao');
    document.body.classList.add('preparando-impressao');
    document.body.classList.toggle('print-formato-a0', formatoImpressaoGrande(dimensoes));
    document.body.classList.toggle('print-titulo-com-caixa', tituloComCaixaImpressao(dimensoes));
    atualizarVisibilidadeRotulosObras();

    atualizarLegendaImpressao();
    atualizarTituloImpressao();
    atualizarCarimboImpressao(dimensoes);
    atualizarTabelaServicosImpressao(dimensoes);

    setTimeout(function() {
      ajustarMapaParaImpressao(dimensoes);
      atualizarVisibilidadeRotulosObras();
      setTimeout(function() {
        map.invalidateSize(true);
        ajustarMapaParaImpressao(dimensoes);
        atualizarVisibilidadeRotulosObras();
        setTimeout(function() {
          window.print();
        }, 450);
      }, 250);
    }, 150);
  }

  var botaoPrintMapa = document.getElementById('printMapa');
  if (botaoPrintMapa) {
    botaoPrintMapa.addEventListener('click', imprimirMapaAtual);
  }

  var seletorPrintEscala = document.getElementById('printEscala');
  if (seletorPrintEscala) {
    seletorPrintEscala.addEventListener('change', atualizarCampoEscalaPersonalizada);
    atualizarCampoEscalaPersonalizada();
  }

  var campoPrintEscalaPersonalizada = document.getElementById('printEscalaPersonalizada');
  if (campoPrintEscalaPersonalizada) {
    campoPrintEscalaPersonalizada.addEventListener('blur', function() {
      if (document.getElementById('printEscala').value === 'personalizada') {
        aplicarEscalaPersonalizadaNoMapa();
      } else {
        lerDenominadorEscala();
      }
    });

    campoPrintEscalaPersonalizada.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('printEscala').value === 'personalizada') {
          aplicarEscalaPersonalizadaNoMapa();
        } else {
          lerDenominadorEscala();
        }
      }
    });
  }

  var controleDensidadeRotulos = document.getElementById('rotulosDensidade');
  if (controleDensidadeRotulos) {
    densidadeRotulos = Number(controleDensidadeRotulos.value) || 0;
    atualizarTextoDensidadeRotulos();
    controleDensidadeRotulos.addEventListener('input', function() {
      densidadeRotulos = Number(this.value) || 0;
      atualizarTextoDensidadeRotulos();
      atualizarVisibilidadeRotulos();
      atualizarVisibilidadeRotulosSRE();
      atualizarVisibilidadeRotulosObras();
    });
  }

  var botaoRotulosObrasPrint = document.getElementById('toggleRotulosObrasPrint');
  if (botaoRotulosObrasPrint) {
    botaoRotulosObrasPrint.addEventListener('click', function() {
      rotulosObrasPrintAtivos = !rotulosObrasPrintAtivos;
      atualizarBotaoRotulosObrasPrint();
      atualizarVisibilidadeRotulosObras();
    });
  }

  var seletorPrintFormato = document.getElementById('printFormato');
  if (seletorPrintFormato) {
    seletorPrintFormato.addEventListener('change', function() {
      atualizarCamposPapelPersonalizado();
      aplicarPadraoRotulosObrasPrint();
    });
    atualizarCamposPapelPersonalizado();
  }

  var printLarguraPersonalizada = document.getElementById('printLarguraPersonalizada');
  var printAlturaPersonalizada = document.getElementById('printAlturaPersonalizada');
  if (printLarguraPersonalizada) {
    printLarguraPersonalizada.addEventListener('change', aplicarPadraoRotulosObrasPrint);
  }
  if (printAlturaPersonalizada) {
    printAlturaPersonalizada.addEventListener('change', aplicarPadraoRotulosObrasPrint);
  }
  aplicarPadraoRotulosObrasPrint();

  window.addEventListener('afterprint', sairModoImpressao);

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
