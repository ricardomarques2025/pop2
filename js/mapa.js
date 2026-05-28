var map = L.map('map', {
  zoomControl: false,
  zoomSnap: 0.1,
  zoomDelta: 0.1
}).setView([-15.8, -49.0], 7);
var originalCenter = map.getCenter();
var originalZoom = map.getZoom();

function criarPanesMapa() {
  Object.keys(MAPA_PANES).forEach(function(nomePane) {
    map.createPane(nomePane);
    map.getPane(nomePane).style.zIndex = MAPA_PANES[nomePane];
  });
}

criarPanesMapa();

function criarMapasBase() {
  var mapas = {};
  var mapaInicial = null;

  Object.keys(MAPAS_BASE_CONFIG).forEach(function(nome) {
    var config = MAPAS_BASE_CONFIG[nome];
    var camada = L.tileLayer(config.url, config.opcoes);
    mapas[nome] = camada;
    if (config.inicial) mapaInicial = camada;
  });

  if (mapaInicial) mapaInicial.addTo(map);
  return mapas;
}

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
const mapasBase = criarMapasBase();

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
  if (medicaoPontos.length >= 2) finalizarMedicao();
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
    position: 'bottomleft'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'north-arrow-control');
    
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 120');
    svg.setAttribute('width', '45');
    svg.setAttribute('height', '53');
    
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

// ---- LOGO INSTITUCIONAL NO MAPA ----
var LogoMapaControl = L.Control.extend({
  options: {
    position: 'topright'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'logo-mapa-control');
    var img = L.DomUtil.create('img', '', container);
    img.src = 'data/Logo_GOINFRA_DPL_2025.png';
    img.alt = 'GOINFRA DPL Governo de Goiás';

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    return container;
  }
});

map.addControl(new LogoMapaControl());

  map.on('zoomend', function() {
    atualizarVisibilidadeRotulos();
    atualizarVisibilidadeRotulosSRE();
    atualizarVisibilidadeRotulosObras();
  });

  var municipiosData = null;
  var localidadesData = null;
  var areasUrbanasData = null;
  var sreBaseData = null;
  var sreData = null;
  var obrasPontosData = null;
  var oaeData = null;
  var estadosData = null;
  var snvData = null;

  var estadosLayer = null;
  var municipiosLayer = null;
  var localidadesLayer = null;
  var areasUrbanasLayer = null;
  var sreBaseLayer = null;
  var sreBaseLabelLayer = null;
  var snvLabelLayer = null;
  var obrasPontosLayer = null;
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
  var anotacaoMedicaoTooltip = null;
  var anotacaoMedicaoPontosPreview = [];
  var anotacaoLinhaPontos = [];
  var anotacaoMedicaoFormaModo = null;
  var legendaAnotacoesAtiva = false;
  var ANOTACOES_STORAGE_KEY = 'mapa_pop2_anotacoes_v1';
  var estiloAnotacao = Object.assign({}, ESTILO_ANOTACAO_PADRAO);
  var estiloTextoAnotacao = Object.assign({}, ESTILO_TEXTO_ANOTACAO_PADRAO);
  var estiloPontoAnotacao = Object.assign({}, ESTILO_PONTO_ANOTACAO_PADRAO);

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
      fillOpacity: opcoes.fillOpacity == null ? estiloAnotacao.fillOpacity : opcoes.fillOpacity,
      dashArray: opcoes.dashArray || ''
    };
  }

  function nomeTipoAnotacao(tipo) {
    if (tipo === 'linha') return 'Linha';
    if (tipo === 'poligono') return 'Polígono';
    if (tipo === 'medicao') return 'Medição';
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

    if (tipo === 'linha' || tipo === 'medicao') {
      var tracejado = tipo === 'medicao' ? ';border-top-style:dashed' : '';
      return '<span class="legenda-anotacao-simbolo"><span class="legenda-anotacao-linha" style="border-top-color:' + cor + ';border-top-width:' + espessura + 'px' + tracejado + '"></span></span>';
    }
    if (tipo === 'ponto') {
      var ponto = extra.estiloPonto || {};
      var tamanho = Math.max(8, Math.min(22, Number(ponto.tamanho) || 14));
      return '<span class="legenda-anotacao-simbolo"><span class="anotacao-ponto-shape' + classeFormatoPonto(ponto.formato) + '" style="width:' + tamanho + 'px;height:' + tamanho + 'px;border-color:' + cor + ';border-width:' + espessura + 'px;background:' + corHexParaRgba(preenchimento, opacidade) + '"></span></span>';
    }
    if (tipo === 'retangulo' || tipo === 'poligono') {
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
    if (anotacaoMedicaoTooltip) {
      map.removeLayer(anotacaoMedicaoTooltip);
      anotacaoMedicaoTooltip = null;
    }
    anotacaoMedicaoPontosPreview.forEach(function(layer) {
      map.removeLayer(layer);
    });
    anotacaoMedicaoPontosPreview = [];
    anotacaoInicio = null;
    anotacaoLinhaPontos = [];
  }

  function limparPreviewMedicoesAnotacao() {
    if (anotacaoMedicaoTooltip) {
      map.removeLayer(anotacaoMedicaoTooltip);
      anotacaoMedicaoTooltip = null;
    }
    anotacaoMedicaoPontosPreview.forEach(function(layer) {
      map.removeLayer(layer);
    });
    anotacaoMedicaoPontosPreview = [];
  }

  function atualizarBotoesAnotacao() {
    var ids = {
      linha: 'drawLinha',
      poligono: 'drawPoligono',
      medicao: 'drawMedicao',
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
    var rotacao = Number(estiloTexto.rotacao) || 0;
    var style = 'color:' + escaparHtml(estiloTexto.cor) + ';' +
      'font-size:' + tamanho + 'px;' +
      'border-color:' + escaparHtml(estiloTexto.cor) + ';' +
      'transform:rotate(' + rotacao + 'deg);';
    return L.divIcon({
      className: 'anotacao-texto-icon',
      html: '<span class="anotacao-texto" style="' + style + '">' + escaparHtml(texto) + '</span>',
      iconSize: [1, 1],
      iconAnchor: [0, 0]
    });
  }

  function anguloEntreLatLngs(origem, destino) {
    if (!origem || !destino) return 0;
    var p1 = map.latLngToLayerPoint(origem);
    var p2 = map.latLngToLayerPoint(destino);
    if (p1.equals && p1.equals(p2)) return 0;
    return Math.round(Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI);
  }

  function rotacaoTextoLegivel(angulo) {
    var rotacao = Number(angulo) || 0;
    while (rotacao > 180) rotacao -= 360;
    while (rotacao < -180) rotacao += 360;
    if (rotacao > 90) rotacao -= 180;
    if (rotacao < -90) rotacao += 180;
    return rotacao;
  }

  function destinoLatLng(centro, metros, graus) {
    var raioTerra = 6378137;
    var brng = graus * Math.PI / 180;
    var lat1 = centro.lat * Math.PI / 180;
    var lng1 = centro.lng * Math.PI / 180;
    var distanciaAngular = metros / raioTerra;
    var lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanciaAngular) +
      Math.cos(lat1) * Math.sin(distanciaAngular) * Math.cos(brng)
    );
    var lng2 = lng1 + Math.atan2(
      Math.sin(brng) * Math.sin(distanciaAngular) * Math.cos(lat1),
      Math.cos(distanciaAngular) - Math.sin(lat1) * Math.sin(lat2)
    );
    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
  }

  function formatarCoordenadasMedicao(latlng) {
    return 'Lat: ' + latlng.lat.toFixed(6).replace('.', ',') +
      ' | Lon: ' + latlng.lng.toFixed(6).replace('.', ',');
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

  function criarIconeKmRodoviaAnotacao(texto, estiloForma, estiloPonto, estiloTexto, latlng) {
    estiloForma = Object.assign({}, estiloAnotacao, estiloForma || {});
    estiloPonto = Object.assign({}, estiloPontoAnotacao, estiloPonto || {});
    estiloTexto = Object.assign({}, estiloTextoAnotacao, estiloTexto || {});
    var tamanho = Number(estiloPonto.tamanho || estiloPontoAnotacao.tamanho);
    var borda = Number(estiloForma.weight || estiloAnotacao.weight);
    var cor = estiloCssCor(estiloForma.color, '#e11d48');
    var corTexto = estiloCssCor(estiloTexto.cor, estiloTextoAnotacao.cor);
    var tamanhoTexto = Number(estiloTexto.tamanho || estiloTextoAnotacao.tamanho);
    var preenchimento = corHexParaRgba(estiloForma.fillColor || estiloForma.color, estiloForma.fillOpacity == null ? 0.14 : estiloForma.fillOpacity);
    var pontoStyle = 'width:' + tamanho + 'px;height:' + tamanho + 'px;' +
      'border-color:' + cor + ';border-width:' + borda + 'px;' +
      'background:' + preenchimento + ';';
    var textoStyle = 'color:' + corTexto + ';font-size:' + tamanhoTexto + 'px;';
    var tamanhoIcone = tamanho + borda * 2;
    var coordsHtml = latlng ?
      '<span class="anotacao-km-coord">Lat: ' + escaparHtml(formatarCoordenadaKm(latlng.lat)) + '</span>' +
      '<span class="anotacao-km-coord">Long: ' + escaparHtml(formatarCoordenadaKm(latlng.lng)) + '</span>' :
      '';
    return L.divIcon({
      className: 'anotacao-km-icon',
      html: '<span class="anotacao-km-wrap">' +
        '<span class="anotacao-ponto-shape' + classeFormatoPonto(estiloPonto.formato) + '" style="' + pontoStyle + '"></span>' +
        '<span class="anotacao-km-label" style="' + textoStyle + '">' +
          '<span class="anotacao-km-titulo">' + escaparHtml(texto) + '</span>' +
          coordsHtml +
        '</span>' +
        '</span>',
      iconSize: [tamanhoIcone, tamanhoIcone],
      iconAnchor: [tamanhoIcone / 2, tamanhoIcone / 2]
    });
  }

  function criarIconeMedicaoAnotacao(texto, estiloTexto) {
    estiloTexto = Object.assign({}, estiloTextoAnotacao, estiloTexto || {});
    var tamanho = Number(estiloTexto.tamanho || estiloTextoAnotacao.tamanho);
    var cor = estiloCssCor(estiloTexto.cor, estiloTextoAnotacao.cor);
    var rotacao = Number(estiloTexto.rotacao) || 0;
    var deslocamento = estiloTexto.ancora === 'inferiorDireito' ? 'translate(10px, 10px)' : 'translate(-50%, -50%)';
    var style = 'color:' + cor + ';' +
      'font-size:' + tamanho + 'px;' +
      'border-color:' + cor + ';' +
      'transform:' + deslocamento + ' rotate(' + rotacao + 'deg);';
    return L.divIcon({
      className: 'medicao-tooltip-icon',
      html: '<span class="medicao-tooltip anotacao-medicao-tooltip" style="' + style + '">' + escaparHtml(texto) + '</span>',
      iconSize: [1, 1],
      iconAnchor: [0, 0]
    });
  }

  function textoMedicaoAnotacao(layer) {
    var extra = layer._anotacaoExtra || {};
    if (extra.texto) return extra.texto;
    return formatarDistanciaMedicao(distanciaTotalMedicao(layer.getLatLngs()));
  }

  function criarPontoExtremoMedicao(latlng, estiloForma) {
    estiloForma = Object.assign({}, estiloAnotacao, estiloForma || {});
    return L.circleMarker(latlng, {
      pane: 'anotacoesPane',
      interactive: false,
      radius: 4,
      color: estiloForma.color || '#111827',
      weight: 2,
      fillColor: '#ffffff',
      fillOpacity: 1
    }).addTo(map);
  }

  function removerPontosExtremosMedicao(layer) {
    if (!layer || !layer._anotacaoMedicaoPontos) return;
    layer._anotacaoMedicaoPontos.forEach(function(ponto) {
      map.removeLayer(ponto);
    });
    layer._anotacaoMedicaoPontos = [];
  }

  function sincronizarPontosExtremosMedicao(layer) {
    if (!layer || layer._anotacaoTipo !== 'medicao') return;
    removerPontosExtremosMedicao(layer);
    var pontos = layer.getLatLngs();
    if (pontos.length < 2) return;
    var estiloForma = estiloFormaPorProps(layer._anotacaoExtra || {});
    layer._anotacaoMedicaoPontos = [
      criarPontoExtremoMedicao(pontos[0], estiloForma),
      criarPontoExtremoMedicao(pontos[pontos.length - 1], estiloForma)
    ];
  }

  function sincronizarMarcadorMedicaoAnotacao(layer) {
    if (!layer || layer._anotacaoTipo !== 'medicao') return;
    var pontos = layer.getLatLngs();
    if (!pontos.length) return;
    sincronizarPontosExtremosMedicao(layer);
    var texto = textoMedicaoAnotacao(layer);
    var estiloTexto = estiloTextoPorProps(layer._anotacaoExtra || {});
    if (layer._anotacaoMedicaoMarcador) {
      layer._anotacaoMedicaoMarcador.setLatLng(pontos[pontos.length - 1]);
      layer._anotacaoMedicaoMarcador.setIcon(criarIconeMedicaoAnotacao(texto, estiloTexto));
      return;
    }
    layer._anotacaoMedicaoMarcador = L.marker(pontos[pontos.length - 1], {
      pane: 'anotacoesTextoPane',
      interactive: true,
      icon: criarIconeMedicaoAnotacao(texto, estiloTexto)
    }).addTo(map);
    layer._anotacaoMedicaoMarcador.on('click', function(e) {
      if (e.originalEvent) {
        L.DomEvent.preventDefault(e.originalEvent);
        L.DomEvent.stopPropagation(e.originalEvent);
      }
      editarMedicaoAnotacao(layer);
    });
  }

  function removerMedicoesFormaAnotacao(layer) {
    if (!layer) return;
    (layer._anotacaoMedicaoFormaLayers || []).forEach(function(item) {
      map.removeLayer(item);
    });
    layer._anotacaoMedicaoFormaLayers = [];
  }

  function adicionarMarcadorMedicaoForma(layer, latlng, texto, rotacao, opcoes) {
    var estiloTexto = estiloTextoPorProps(layer._anotacaoExtra || {});
    estiloTexto.rotacao = rotacao || 0;
    if (opcoes && opcoes.ancora) estiloTexto.ancora = opcoes.ancora;
    var marcador = L.marker(latlng, {
      pane: 'anotacoesTextoPane',
      interactive: false,
      icon: criarIconeMedicaoAnotacao(texto, estiloTexto)
    }).addTo(map);
    layer._anotacaoMedicaoFormaLayers.push(marcador);
  }

  function adicionarMarcadorPreviewMedicao(latlng, texto, rotacao, opcoes) {
    var estiloTexto = lerEstiloTextoAnotacao();
    estiloTexto.rotacao = rotacao || 0;
    if (opcoes && opcoes.ancora) estiloTexto.ancora = opcoes.ancora;
    anotacaoMedicaoPontosPreview.push(L.marker(latlng, {
      pane: 'anotacoesTextoPane',
      interactive: false,
      icon: criarIconeMedicaoAnotacao(texto, estiloTexto)
    }).addTo(map));
  }

  function pontoMedioLatLng(a, b) {
    return L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
  }

  function adicionarMedicaoSegmentoForma(layer, a, b) {
    adicionarMarcadorMedicaoForma(
      layer,
      pontoMedioLatLng(a, b),
      formatarDistanciaMedicao(a.distanceTo(b)),
      rotacaoTextoLegivel(anguloEntreLatLngs(a, b))
    );
  }

  function adicionarMedicaoSegmentoPreview(a, b) {
    adicionarMarcadorPreviewMedicao(
      pontoMedioLatLng(a, b),
      formatarDistanciaMedicao(a.distanceTo(b)),
      rotacaoTextoLegivel(anguloEntreLatLngs(a, b))
    );
  }

  function areaPoligonoMetrosQuadrados(pontos) {
    if (!pontos || pontos.length < 3) return 0;
    var raioTerra = 6378137;
    var area = 0;
    for (var i = 0; i < pontos.length; i++) {
      var atual = pontos[i];
      var prox = pontos[(i + 1) % pontos.length];
      area += (prox.lng - atual.lng) * Math.PI / 180 *
        (2 + Math.sin(atual.lat * Math.PI / 180) + Math.sin(prox.lat * Math.PI / 180));
    }
    return Math.abs(area * raioTerra * raioTerra / 2);
  }

  function formatarAreaMedicao(area) {
    if (!isFinite(area)) return '0 m²';
    if (area >= 1000000) return (area / 1000000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' km²';
    if (area >= 10000) return (area / 10000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ha';
    return area.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' m²';
  }

  function centroideLatLng(pontos) {
    if (!pontos || !pontos.length) return null;
    var lat = 0;
    var lng = 0;
    pontos.forEach(function(ponto) {
      lat += ponto.lat;
      lng += ponto.lng;
    });
    return L.latLng(lat / pontos.length, lng / pontos.length);
  }

  function adicionarMedicoesPoligono(layer, pontos, incluirArea) {
    if (!pontos || pontos.length < 2) return;
    if (pontos.length > 2 && pontos[0].equals && pontos[0].equals(pontos[pontos.length - 1])) {
      pontos = pontos.slice(0, -1);
    }
    for (var i = 1; i < pontos.length; i++) {
      adicionarMedicaoSegmentoForma(layer, pontos[i - 1], pontos[i]);
    }
    if (pontos.length > 2) {
      adicionarMedicaoSegmentoForma(layer, pontos[pontos.length - 1], pontos[0]);
      if (incluirArea) {
        adicionarMarcadorMedicaoForma(
          layer,
          centroideLatLng(pontos),
          'Área = ' + formatarAreaMedicao(areaPoligonoMetrosQuadrados(pontos)),
          0
        );
      }
    }
  }

  function atualizarPreviewMedicoesForma(tipo, pontos, incluirArea) {
    limparPreviewMedicoesAnotacao();
    if (!pontos || !pontos.length) return;

    if (tipo === 'linha') {
      for (var i = 1; i < pontos.length; i++) adicionarMedicaoSegmentoPreview(pontos[i - 1], pontos[i]);
      return;
    }

    if (tipo === 'poligono') {
      for (var j = 1; j < pontos.length; j++) adicionarMedicaoSegmentoPreview(pontos[j - 1], pontos[j]);
      if (pontos.length > 2) {
        adicionarMedicaoSegmentoPreview(pontos[pontos.length - 1], pontos[0]);
        if (incluirArea) {
          adicionarMarcadorPreviewMedicao(
            centroideLatLng(pontos),
            'Área = ' + formatarAreaMedicao(areaPoligonoMetrosQuadrados(pontos)),
            0
          );
        }
      }
      return;
    }

    if (tipo === 'retangulo' && pontos.length > 1) {
      var bounds = L.latLngBounds(pontos[0], pontos[1]);
      var nw = bounds.getNorthWest();
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      adicionarMedicaoSegmentoPreview(nw, ne);
      adicionarMedicaoSegmentoPreview(nw, sw);
      return;
    }

    if (tipo === 'circulo' && pontos.length > 1) {
      adicionarMedicaoSegmentoPreview(pontos[0], pontos[1]);
    }
  }

  function sincronizarMedicoesFormaAnotacao(layer) {
    if (!layer || !layer._anotacaoExtra || !layer._anotacaoExtra.medirForma) return;
    removerMedicoesFormaAnotacao(layer);
    layer._anotacaoMedicaoFormaLayers = [];
    var tipo = layer._anotacaoTipo;
    var estiloForma = estiloFormaPorProps(layer._anotacaoExtra);

    if (tipo === 'ponto') {
      adicionarMarcadorMedicaoForma(layer, layer.getLatLng(), formatarCoordenadasMedicao(layer.getLatLng()), 0, {
        ancora: 'inferiorDireito'
      });
      return;
    }

    if (tipo === 'retangulo') {
      var bounds = layer.getBounds();
      var nw = bounds.getNorthWest();
      var ne = bounds.getNorthEast();
      var sw = bounds.getSouthWest();
      adicionarMedicaoSegmentoForma(layer, nw, ne);
      adicionarMedicaoSegmentoForma(layer, nw, sw);
      return;
    }

    if (tipo === 'linha') {
      var pontosLinha = layer.getLatLngs();
      for (var i = 1; i < pontosLinha.length; i++) {
        adicionarMedicaoSegmentoForma(layer, pontosLinha[i - 1], pontosLinha[i]);
      }
      return;
    }

    if (tipo === 'poligono') {
      adicionarMedicoesPoligono(layer, layer.getLatLngs()[0] || [], true);
      return;
    }

    if (tipo === 'circulo') {
      var centro = layer.getLatLng();
      var raio = layer.getRadius();
      var pontoRaio = layer._anotacaoExtra.pontoRaio ?
        L.latLng(layer._anotacaoExtra.pontoRaio[1], layer._anotacaoExtra.pontoRaio[0]) :
        destinoLatLng(centro, raio, 90);
      var linhaRaio = L.polyline([centro, pontoRaio], Object.assign({}, estiloForma, {
        pane: 'anotacoesPane',
        dashArray: '8,6',
        fillOpacity: 0,
        interactive: false
      })).addTo(map);
      layer._anotacaoMedicaoFormaLayers.push(linhaRaio);
      adicionarMarcadorMedicaoForma(layer, pontoMedioLatLng(centro, pontoRaio), formatarDistanciaMedicao(raio), rotacaoTextoLegivel(anguloEntreLatLngs(centro, pontoRaio)));
    }
  }

  function editarMedicaoAnotacao(layer) {
    if (anotacaoFerramenta) return;
    var textoAtual = textoMedicaoAnotacao(layer);
    var novoTexto = window.prompt('Texto da medição:', textoAtual);
    if (novoTexto === null) return;
    novoTexto = novoTexto.trim();
    if (!novoTexto) {
      removerAnotacao(layer);
      return;
    }

    var nomeAtual = layer._anotacaoExtra.nomeLegenda || '';
    var novoNome = solicitarNomeLegendaAnotacao('medicao', nomeAtual);
    layer._anotacaoExtra.texto = novoTexto;
    layer._anotacaoExtra.nomeLegenda = novoNome;
    sincronizarMarcadorMedicaoAnotacao(layer);
    salvarAnotacoesLocal();
  }

  function atualizarPreviewMedicaoAnotacao(pontos) {
    if (anotacaoMedicaoTooltip) {
      map.removeLayer(anotacaoMedicaoTooltip);
      anotacaoMedicaoTooltip = null;
    }
    anotacaoMedicaoPontosPreview.forEach(function(layer) {
      map.removeLayer(layer);
    });
    anotacaoMedicaoPontosPreview = [];
    if (!pontos || !pontos.length) return;
    var texto = formatarDistanciaMedicao(distanciaTotalMedicao(pontos));
    anotacaoMedicaoTooltip = L.marker(pontos[pontos.length - 1], {
      pane: 'anotacoesTextoPane',
      interactive: false,
      icon: criarIconeMedicaoAnotacao(texto, lerEstiloTextoAnotacao())
    }).addTo(map);
    if (pontos.length > 1) {
      var estiloForma = lerEstiloFormaAnotacao();
      anotacaoMedicaoPontosPreview = [
        criarPontoExtremoMedicao(pontos[0], estiloForma),
        criarPontoExtremoMedicao(pontos[pontos.length - 1], estiloForma)
      ];
    }
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
    } else if (tipo === 'medicao') {
      sincronizarMarcadorMedicaoAnotacao(layer);
      layer.on('click', function() {
        editarMedicaoAnotacao(layer);
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
    sincronizarMedicoesFormaAnotacao(layer);
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
    if (layer && layer._anotacaoMedicaoMarcador) {
      map.removeLayer(layer._anotacaoMedicaoMarcador);
      layer._anotacaoMedicaoMarcador = null;
    }
    removerMedicoesFormaAnotacao(layer);
    removerPontosExtremosMedicao(layer);
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

    if (tipo === 'linha' || tipo === 'medicao') {
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

    if (tipo === 'retangulo' || tipo === 'poligono') {
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
    } else if (tipo === 'medicao' && geom.type === 'LineString') {
      layer = L.polyline(coordsParaLatLngs(geom.coordinates), Object.assign({}, estiloForma, {
        dashArray: estiloForma.dashArray || '8,6'
      }));
    } else if (tipo === 'ponto' && geom.type === 'Point') {
      var latlngPonto = L.latLng(geom.coordinates[1], geom.coordinates[0]);
      var iconePonto = props.rotuloKm ?
        criarIconeKmRodoviaAnotacao(props.rotuloKm, estiloForma, estiloPontoPorProps(props), estiloTextoPorProps(props), latlngPonto) :
        criarIconePontoAnotacao(estiloForma, estiloPontoPorProps(props));
      layer = L.marker(latlngPonto, {
        pane: 'anotacoesPane',
        draggable: false,
        icon: iconePonto
      });
    } else if (tipo === 'retangulo' && geom.type === 'Polygon') {
      layer = L.polygon(coordsParaLatLngs(geom.coordinates[0] || []), estiloForma);
    } else if (tipo === 'poligono' && geom.type === 'Polygon') {
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
      anotacoesLayer.eachLayer(function(layer) {
        if (layer._anotacaoMedicaoMarcador) map.removeLayer(layer._anotacaoMedicaoMarcador);
        removerMedicoesFormaAnotacao(layer);
        removerPontosExtremosMedicao(layer);
      });
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

  function lerNumeroDecimal(valor) {
    var texto = String(valor || '').trim();
    texto = texto.indexOf(',') !== -1 ? texto.replace(/\./g, '').replace(',', '.') : texto;
    var numero = Number(texto);
    return isFinite(numero) ? numero : null;
  }

  function formatarKmRodovia(km) {
    return Number(km).toLocaleString('pt-BR', {
      minimumFractionDigits: Math.abs(km % 1) > 0.0001 ? 1 : 0,
      maximumFractionDigits: 3
    });
  }

  function formatarCoordenadaKm(valor) {
    return Number(valor).toFixed(6).replace('.', ',');
  }

  function coordenadasLinhaFeature(feature) {
    var geom = feature && feature.geometry;
    if (!geom || !geom.coordinates) return [];
    if (geom.type === 'LineString') return geom.coordinates;
    if (geom.type === 'MultiLineString') {
      var coords = [];
      geom.coordinates.forEach(function(parte) {
        if (Array.isArray(parte)) coords = coords.concat(parte);
      });
      return coords;
    }
    return [];
  }

  function interpolarPontoNaLinha(coords, fator) {
    if (!coords || !coords.length) return null;
    var pontos = coords
      .filter(function(coord) { return coord && coord.length >= 2; })
      .map(function(coord) { return L.latLng(Number(coord[1]), Number(coord[0])); })
      .filter(function(latlng) { return isFinite(latlng.lat) && isFinite(latlng.lng); });

    if (!pontos.length) return null;
    if (pontos.length === 1) return pontos[0];

    fator = Math.max(0, Math.min(1, Number(fator) || 0));
    var distancias = [];
    var total = 0;
    for (var i = 1; i < pontos.length; i++) {
      var d = pontos[i - 1].distanceTo(pontos[i]);
      distancias.push(d);
      total += d;
    }
    if (!total) return pontos[0];

    var alvo = total * fator;
    var acumulado = 0;
    for (var j = 1; j < pontos.length; j++) {
      var segmento = distancias[j - 1];
      if (acumulado + segmento >= alvo) {
        var t = segmento ? (alvo - acumulado) / segmento : 0;
        return L.latLng(
          pontos[j - 1].lat + (pontos[j].lat - pontos[j - 1].lat) * t,
          pontos[j - 1].lng + (pontos[j].lng - pontos[j - 1].lng) * t
        );
      }
      acumulado += segmento;
    }
    return pontos[pontos.length - 1];
  }

  function localizarKmNaRodovia(rodovia, km) {
    if (!sreBaseData || !sreBaseData.features) return null;
    var segmentos = sreBaseData.features
      .filter(function(feature) {
        return nomeRodoviaFeature(feature) === rodovia &&
          valorSeguro(feature, 'km_ini') !== '' &&
          valorSeguro(feature, 'km_fim') !== '';
      })
      .sort(function(a, b) {
        return Number(valorSeguro(a, 'km_ini')) - Number(valorSeguro(b, 'km_ini')) ||
          String(nomeSREFeature(a)).localeCompare(String(nomeSREFeature(b)), 'pt-BR');
      });

    for (var i = 0; i < segmentos.length; i++) {
      var feature = segmentos[i];
      var kmIni = Number(valorSeguro(feature, 'km_ini'));
      var kmFim = Number(valorSeguro(feature, 'km_fim'));
      if (!isFinite(kmIni) || !isFinite(kmFim)) continue;
      var min = Math.min(kmIni, kmFim);
      var max = Math.max(kmIni, kmFim);
      if (km < min || km > max) continue;
      var fator = kmFim === kmIni ? 0 : (km - kmIni) / (kmFim - kmIni);
      var latlng = interpolarPontoNaLinha(coordenadasLinhaFeature(feature), fator);
      if (latlng) return { feature: feature, latlng: latlng, kmIni: kmIni, kmFim: kmFim };
    }

    return null;
  }

  function intervaloKmRodovia(rodovia) {
    if (!sreBaseData || !sreBaseData.features) return null;
    var minimo = Infinity;
    var maximo = -Infinity;
    sreBaseData.features.forEach(function(feature) {
      if (nomeRodoviaFeature(feature) !== rodovia) return;
      var kmIni = Number(valorSeguro(feature, 'km_ini'));
      var kmFim = Number(valorSeguro(feature, 'km_fim'));
      if (!isFinite(kmIni) || !isFinite(kmFim)) return;
      minimo = Math.min(minimo, kmIni, kmFim);
      maximo = Math.max(maximo, kmIni, kmFim);
    });
    if (!isFinite(minimo) || !isFinite(maximo)) return null;
    return { minimo: minimo, maximo: maximo };
  }

  function marcarKmRodoviaSelecionada() {
    var rodovia = document.getElementById('rodoviaSelect').value;
    var campoKm = document.getElementById('drawKmRodovia');
    var km = lerNumeroDecimal(campoKm ? campoKm.value : '');

    if (!rodovia) {
      setStatusAnotacao('Selecione uma rodovia no filtro antes de localizar o km');
      return;
    }
    if (km === null) {
      setStatusAnotacao('Informe um km válido para localizar na rodovia');
      return;
    }

    var resultado = localizarKmNaRodovia(rodovia, km);
    if (!resultado) {
      var intervalo = intervaloKmRodovia(rodovia);
      var complemento = intervalo ?
        ' Intervalo disponível: km ' + formatarKmRodovia(intervalo.minimo) + ' a km ' + formatarKmRodovia(intervalo.maximo) + '.' :
        '';
      setStatusAnotacao('Km não encontrado na rodovia selecionada.' + complemento);
      return;
    }

    if (anotacaoFerramenta) ativarFerramentaAnotacao(anotacaoFerramenta);

    var estiloPontoForma = lerEstiloFormaAnotacao();
    var estiloPonto = lerEstiloPontoAnotacao();
    var estiloTexto = lerEstiloTextoAnotacao();
    var texto = rodovia + ', km ' + formatarKmRodovia(km);
    var props = resultado.feature.properties || {};

    adicionarAnotacao(L.marker(resultado.latlng, {
      pane: 'anotacoesPane',
      draggable: false,
      icon: criarIconeKmRodoviaAnotacao(texto, estiloPontoForma, estiloPonto, estiloTexto, resultado.latlng)
    }), 'ponto', {
      estilo: estiloFormaDaCamada({ options: estiloPontoForma }),
      estiloPonto: estiloPonto,
      estiloTexto: estiloTexto,
      rotuloKm: texto,
      nomeLegenda: texto,
      rodoviaKm: rodovia,
      km: km,
      latitude: Number(resultado.latlng.lat.toFixed(6)),
      longitude: Number(resultado.latlng.lng.toFixed(6)),
      sre: props.sre || props.SRE || '',
      trecho: props.trecho || props.TRECHO || ''
    });

    map.setView(resultado.latlng, Math.max(map.getZoom(), 13));
    setStatusAnotacao(texto + ' marcado no SRE ' + (props.sre || props.SRE || ''));
  }

  function ativarFerramentaAnotacao(tipo) {
    var ferramentaAnterior = anotacaoFerramenta;
    limparPreviewAnotacao();
    anotacaoMedicaoFormaModo = tipo === 'medicao' && ['linha', 'poligono', 'ponto', 'retangulo', 'circulo'].indexOf(ferramentaAnterior) !== -1 ?
      ferramentaAnterior :
      null;
    anotacaoFerramenta = anotacaoFerramenta === tipo ? null : tipo;
    if (!anotacaoFerramenta) anotacaoMedicaoFormaModo = null;
    atualizarBotoesAnotacao();

    if (!anotacaoFerramenta) {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      setStatusAnotacao('Sem ferramenta ativa');
      return;
    }

    map.dragging.disable();
    map.doubleClickZoom.disable();

    if (tipo === 'linha') {
      setStatusAnotacao('Linha: clique nos pontos e dê duplo clique para finalizar');
      return;
    }
    if (tipo === 'poligono') {
      setStatusAnotacao('Polígono: clique nos vértices e dê duplo clique para finalizar');
      return;
    }
    if (tipo === 'medicao') {
      if (anotacaoMedicaoFormaModo === 'ponto') setStatusAnotacao('Medição de ponto: clique no local para inserir as coordenadas');
      else if (anotacaoMedicaoFormaModo === 'linha') setStatusAnotacao('Medição de linha: clique nos pontos e dê duplo clique para finalizar');
      else if (anotacaoMedicaoFormaModo === 'poligono') setStatusAnotacao('Medição de polígono: clique nos vértices e dê duplo clique para finalizar');
      else if (anotacaoMedicaoFormaModo === 'retangulo') setStatusAnotacao('Medição de retângulo: clique em dois cantos para medir os lados');
      else if (anotacaoMedicaoFormaModo === 'circulo') setStatusAnotacao('Medição de círculo: clique no centro e depois no raio');
      else setStatusAnotacao('Medição: clique nos pontos e dê duplo clique para finalizar');
      return;
    }
    if (tipo === 'ponto') {
      setStatusAnotacao('Ponto: clique no local da anotação');
      return;
    }
    if (tipo === 'retangulo') {
      setStatusAnotacao('Retângulo: clique em dois cantos do retângulo');
      return;
    }
    if (tipo === 'circulo') {
      setStatusAnotacao('Círculo: clique no centro e depois no raio');
      return;
    }
    if (tipo === 'texto') {
      setStatusAnotacao('Texto: clique no local, mova para escolher a rotação e clique para digitar');
      return;
    }
  }

  function finalizarLinhaAnotacao() {
    if (anotacaoLinhaPontos.length < 2) return;
    if (anotacaoPreview) map.removeLayer(anotacaoPreview);
    var medirSegmentosLinha = anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'linha';
    var medirPoligono = anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'poligono';
    var tipoPoligono = anotacaoFerramenta === 'poligono' || medirPoligono;
    if (tipoPoligono && anotacaoLinhaPontos.length < 3) return;
    var tipoLinha = anotacaoFerramenta === 'medicao' && !medirSegmentosLinha ? 'medicao' : 'linha';
    if (tipoPoligono) tipoLinha = 'poligono';
    var estiloLinha = lerEstiloFormaAnotacao();
    if (tipoLinha === 'medicao') estiloLinha.dashArray = '8,6';
    var nomeLegenda = solicitarNomeLegendaAnotacao(tipoLinha, '');
    var extra = {
      estilo: estiloFormaDaCamada({ options: estiloLinha }),
      nomeLegenda: nomeLegenda
    };
    if (medirSegmentosLinha || medirPoligono) {
      extra.estiloTexto = lerEstiloTextoAnotacao();
      extra.medirForma = true;
    }
    if (tipoLinha === 'medicao') {
      extra.texto = formatarDistanciaMedicao(distanciaTotalMedicao(anotacaoLinhaPontos));
      extra.estiloTexto = lerEstiloTextoAnotacao();
    }
    adicionarAnotacao(tipoPoligono ? L.polygon(anotacaoLinhaPontos, estiloLinha) : L.polyline(anotacaoLinhaPontos, estiloLinha), tipoLinha, extra);
    limparPreviewAnotacao();
    ativarFerramentaAnotacao((medirSegmentosLinha || medirPoligono) ? 'medicao' : tipoLinha);
  }

  function processarCliqueAnotacao(e) {
    if (!anotacaoFerramenta) return;
    if (e.originalEvent) {
      L.DomEvent.preventDefault(e.originalEvent);
      L.DomEvent.stopPropagation(e.originalEvent);
    }

    if (anotacaoFerramenta === 'texto') {
      if (!anotacaoInicio) {
        anotacaoInicio = e.latlng;
        setStatusAnotacao('Texto: mova o mouse para escolher a rotação e clique para digitar');
        return;
      }
      var rotacaoTexto = anguloEntreLatLngs(anotacaoInicio, e.latlng);
      if (anotacaoPreview) {
        map.removeLayer(anotacaoPreview);
        anotacaoPreview = null;
      }
      var textoRotacionado = window.prompt('Texto da anotação:');
      if (textoRotacionado && textoRotacionado.trim()) {
        var estiloTextoRotacionado = lerEstiloTextoAnotacao();
        estiloTextoRotacionado.rotacao = rotacaoTexto;
        adicionarAnotacao(L.marker(anotacaoInicio, {
          pane: 'anotacoesTextoPane',
          draggable: true,
          icon: criarIconeTextoAnotacao(textoRotacionado.trim(), estiloTextoRotacionado)
        }), 'texto', { texto: textoRotacionado.trim(), estiloTexto: estiloTextoRotacionado });
      }
      limparPreviewAnotacao();
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

    if (anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'ponto') {
      var estiloPontoMedicaoForma = lerEstiloFormaAnotacao();
      var estiloPontoMedicao = lerEstiloPontoAnotacao();
      var nomeLegendaPontoMedicao = solicitarNomeLegendaAnotacao('ponto', '');
      adicionarAnotacao(L.marker(e.latlng, {
        pane: 'anotacoesPane',
        draggable: false,
        icon: criarIconePontoAnotacao(estiloPontoMedicaoForma, estiloPontoMedicao)
      }), 'ponto', {
        estilo: estiloFormaDaCamada({ options: estiloPontoMedicaoForma }),
        estiloPonto: estiloPontoMedicao,
        estiloTexto: lerEstiloTextoAnotacao(),
        medirForma: true,
        nomeLegenda: nomeLegendaPontoMedicao
      });
      limparPreviewAnotacao();
      ativarFerramentaAnotacao('medicao');
      return;
    }

    if (anotacaoFerramenta === 'medicao' && (anotacaoMedicaoFormaModo === 'retangulo' || anotacaoMedicaoFormaModo === 'circulo')) {
      if (!anotacaoInicio) {
        anotacaoInicio = e.latlng;
        return;
      }

      if (anotacaoMedicaoFormaModo === 'retangulo') {
        if (anotacaoPreview) map.removeLayer(anotacaoPreview);
        var estiloRetanguloMedicao = lerEstiloFormaAnotacao();
        var nomeLegendaRetanguloMedicao = solicitarNomeLegendaAnotacao('retangulo', '');
        adicionarAnotacao(L.rectangle(L.latLngBounds(anotacaoInicio, e.latlng), estiloRetanguloMedicao), 'retangulo', {
          estilo: estiloFormaDaCamada({ options: estiloRetanguloMedicao }),
          estiloTexto: lerEstiloTextoAnotacao(),
          medirForma: true,
          nomeLegenda: nomeLegendaRetanguloMedicao
        });
      }

      if (anotacaoMedicaoFormaModo === 'circulo') {
        var raioMedicao = anotacaoInicio.distanceTo(e.latlng);
        if (raioMedicao > 0) {
          if (anotacaoPreview) map.removeLayer(anotacaoPreview);
          var estiloCirculoMedicao = lerEstiloFormaAnotacao();
          var nomeLegendaCirculoMedicao = solicitarNomeLegendaAnotacao('circulo', '');
          adicionarAnotacao(L.circle(anotacaoInicio, Object.assign({}, estiloCirculoMedicao, {
            radius: raioMedicao
          })), 'circulo', {
            estilo: estiloFormaDaCamada({ options: estiloCirculoMedicao }),
            estiloTexto: lerEstiloTextoAnotacao(),
            medirForma: true,
            pontoRaio: [e.latlng.lng, e.latlng.lat],
            nomeLegenda: nomeLegendaCirculoMedicao
          });
        }
      }

      limparPreviewAnotacao();
      ativarFerramentaAnotacao('medicao');
      return;
    }

    if (anotacaoFerramenta === 'linha' || anotacaoFerramenta === 'poligono' || anotacaoFerramenta === 'medicao') {
      if (e.originalEvent && e.originalEvent.detail >= 2) {
        finalizarLinhaAnotacao();
        return;
      }
      anotacaoLinhaPontos.push(e.latlng);
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      var desenhandoPoligono = anotacaoFerramenta === 'poligono' || (anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'poligono');
      anotacaoPreview = (desenhandoPoligono ? L.polygon : L.polyline)(anotacaoLinhaPontos, Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: anotacaoFerramenta === 'medicao' ? '8,6' : '6,6'
      })).addTo(map);
      if (anotacaoFerramenta === 'medicao' && !anotacaoMedicaoFormaModo) atualizarPreviewMedicaoAnotacao(anotacaoLinhaPontos);
      else atualizarPreviewMedicoesForma(desenhandoPoligono ? 'poligono' : 'linha', anotacaoLinhaPontos, desenhandoPoligono);
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

    if (anotacaoFerramenta === 'texto' && anotacaoInicio) {
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      var estiloTextoPreview = lerEstiloTextoAnotacao();
      estiloTextoPreview.rotacao = anguloEntreLatLngs(anotacaoInicio, e.latlng);
      anotacaoPreview = L.marker(anotacaoInicio, {
        pane: 'anotacoesTextoPane',
        interactive: false,
        icon: criarIconeTextoAnotacao('Texto', estiloTextoPreview)
      }).addTo(map);
      return;
    }

    if ((anotacaoFerramenta === 'linha' || anotacaoFerramenta === 'poligono' || anotacaoFerramenta === 'medicao') && anotacaoLinhaPontos.length) {
      if (anotacaoPreview) map.removeLayer(anotacaoPreview);
      var pontosPreviewLinha = anotacaoLinhaPontos.concat([e.latlng]);
      var previewPoligono = anotacaoFerramenta === 'poligono' || (anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'poligono');
      anotacaoPreview = (previewPoligono ? L.polygon : L.polyline)(pontosPreviewLinha, Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: anotacaoFerramenta === 'medicao' ? '8,6' : '6,6'
      })).addTo(map);
      if (anotacaoFerramenta === 'medicao' && !anotacaoMedicaoFormaModo) atualizarPreviewMedicaoAnotacao(pontosPreviewLinha);
      else atualizarPreviewMedicoesForma(previewPoligono ? 'poligono' : 'linha', pontosPreviewLinha, previewPoligono);
      return;
    }

    if (!anotacaoInicio) return;
    if (anotacaoPreview) map.removeLayer(anotacaoPreview);

    if (anotacaoFerramenta === 'retangulo' || (anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'retangulo')) {
      anotacaoPreview = L.rectangle(L.latLngBounds(anotacaoInicio, e.latlng), Object.assign({}, lerEstiloFormaAnotacao(), {
        dashArray: '6,6'
      })).addTo(map);
      atualizarPreviewMedicoesForma('retangulo', [anotacaoInicio, e.latlng], false);
    }

    if (anotacaoFerramenta === 'circulo' || (anotacaoFerramenta === 'medicao' && anotacaoMedicaoFormaModo === 'circulo')) {
      anotacaoPreview = L.circle(anotacaoInicio, Object.assign({}, lerEstiloFormaAnotacao(), {
        radius: anotacaoInicio.distanceTo(e.latlng),
        dashArray: '6,6'
      })).addTo(map);
      atualizarPreviewMedicoesForma('circulo', [anotacaoInicio, e.latlng], false);
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
      if (anotacaoFerramenta === 'linha' || anotacaoFerramenta === 'poligono' || anotacaoFerramenta === 'medicao') {
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
      if (anotacaoFerramenta === 'linha' || anotacaoFerramenta === 'poligono' || anotacaoFerramenta === 'medicao') finalizarLinhaAnotacao();
    }, true);

    var botoes = [
      ['drawLinha', 'linha'],
      ['drawPoligono', 'poligono'],
      ['drawMedicao', 'medicao'],
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
      anotacoesLayer.eachLayer(function(layer) {
        if (layer._anotacaoMedicaoMarcador) map.removeLayer(layer._anotacaoMedicaoMarcador);
        removerMedicoesFormaAnotacao(layer);
        removerPontosExtremosMedicao(layer);
      });
      anotacoesLayer.clearLayers();
      anotacoesHistorico = [];
      salvarAnotacoesLocal();
      renderizarLegendaAnotacoes();
    });

    var exportar = document.getElementById('drawExportar');
    if (exportar) exportar.addEventListener('click', exportarArquivoAnotacoes);

    var localizarKm = document.getElementById('drawLocalizarKm');
    var campoKmRodovia = document.getElementById('drawKmRodovia');
    if (localizarKm) localizarKm.addEventListener('click', marcarKmRodoviaSelecionada);
    if (campoKmRodovia) {
      campoKmRodovia.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          marcarKmRodoviaSelecionada();
        }
      });
    }

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
            carregarAnotacoesGeoJSON(JSON.parse(reader.result), false);
            setStatusAnotacao('Anotações importadas e acrescentadas ao mapa');
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
  var areasUrbanasFiltroAtivo = false;
  var densidadeRotulos = 0;

  var obrasFundeinfraData = [];
  var obrasFundeinfraPorLink = {};
  var obrasDorData = [];
  var obrasDorPorLink = {};
  var obrasPontosTabelaData = [];
  var obrasPontosPorLink = {};

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

  function carregarTabelaObrasPontos() {
    fetch('data/OBRAS_PONTOS.json')
      .then(function(r) { return r.json(); })
      .then(function(resultado) {
        obrasPontosTabelaData = Array.isArray(resultado) ? resultado : [];
        obrasPontosPorLink = {};

        for (var i = 0; i < obrasPontosTabelaData.length; i++) {
          var item = obrasPontosTabelaData[i];
          var link = item && item.LINK;
          if (!link) continue;
          var chave = String(link);
          if (!obrasPontosPorLink[chave]) obrasPontosPorLink[chave] = [];
          obrasPontosPorLink[chave].push(item);
        }

        console.log('OBRAS_PONTOS carregado:', obrasPontosTabelaData.length);
        if (municipiosData) preencherPropostas();
        if (obrasPontosData && municipiosData) aplicarFiltros();
      })
      .catch(function(e) {
        console.warn('Falha ao carregar OBRAS_PONTOS:', e);
      });
  }

  carregarTabelasFundeinfra();
  carregarTabelasDor();
  carregarTabelaObrasPontos();
  
  
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
    var btnAreasUrbanas = document.getElementById('toggleAreasUrbanas');
    if (btnAreasUrbanas) {
      btnAreasUrbanas.classList.toggle('ativo-filtro', areasUrbanasFiltroAtivo);
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
    if (obrasPontosLayer) {
      map.removeLayer(obrasPontosLayer);
      obrasPontosLayer = null;
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
    if (obrasPontosData && obrasPontosData.features) {
      obrasPontosData.features.forEach(considerarFeature);
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
    var municipiosSelecionadosParaPontos = municipiosFiltrados();

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

    if (obrasPontosData && obrasPontosData.features && servicosAtivos.FUNDEINFRA) {
      for (var p = 0; p < obrasPontosData.features.length; p++) {
        var featurePonto = obrasPontosData.features[p];
        var coordsPonto = featurePonto.geometry && featurePonto.geometry.coordinates;
        if (coordsPonto && coordsPonto.length >= 2 && !pontoDentroSelecaoMunicipios(coordsPonto[0], coordsPonto[1], municipiosSelecionadosParaPontos)) continue;
        if (rodoviaSelecionada && nomeRodoviaFeature(featurePonto) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(featurePonto) !== sreSelecionado) continue;
        var dadosPonto = dadosObrasPontosDaFeature(featurePonto);
        if (dadosPonto && dadosPonto.PROPOSTA !== null && dadosPonto.PROPOSTA !== undefined && String(dadosPonto.PROPOSTA).trim() !== '') {
          adicionarUnico(propostas, String(dadosPonto.PROPOSTA));
        }
      }
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
    var featuresMunicipios = municipiosFiltrados();

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
        var dadosFund = servicosAtivos.FUNDEINFRA ? dadosFundeinfraDaFeatureFiltrado(f, propostaSelecionada) : null;
        var dadosDorFiltrados = servicosAtivos.DOR ? dadosDorDaFeatureFiltrados(f, servicoFiltroAtivo, propostaSelecionada) : [];
        if (!dadosFund && !dadosDorFiltrados.length) return;
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
    if (obrasPontosData && obrasPontosData.features && servicosAtivos.FUNDEINFRA) {
      for (var p = 0; p < obrasPontosData.features.length; p++) {
        var featurePonto = obrasPontosData.features[p];
        var coordsPonto = featurePonto.geometry && featurePonto.geometry.coordinates;
        if (!coordsPonto || coordsPonto.length < 2) continue;
        if (!pontoDentroSelecaoMunicipios(coordsPonto[0], coordsPonto[1], featuresMunicipios)) continue;
        if (rodoviaSelecionada && nomeRodoviaFeature(featurePonto) !== rodoviaSelecionada) continue;
        if (sreSelecionado && nomeSREFeature(featurePonto) !== sreSelecionado) continue;
        if (servicoFiltroAtivo) continue;
        if (propostaSelecionada && !dadosObrasPontosFiltrados(featurePonto, propostaSelecionada).length) continue;
        feats.push(featurePonto);
      }
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
    if (obrasPontosData && obrasPontosData.features) {
      obrasPontosData.features.forEach(considerarFeature);
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

  function desenharAreasUrbanas() {
    if (areasUrbanasLayer) {
      map.removeLayer(areasUrbanasLayer);
      areasUrbanasLayer = null;
    }

    if (!areasUrbanasFiltroAtivo || !areasUrbanasData || !areasUrbanasData.features) return;

    areasUrbanasLayer = L.geoJSON(areasUrbanasData, {
      interactive: false,
      pane: 'areasUrbanasPane',
      style: function() {
        return {
          color: '#ffb5b5',
          weight: 1.5,
          opacity: 1,
          fillColor: '#ffb5b5',
          fillOpacity: 0.42
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
              pane: 'rotulosBasePane',
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
        pane: 'rotulosBasePane',
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
      pane: 'rotulosBasePane',
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

  function dadosFundeinfraDaFeatureFiltrado(feature, proposta) {
    var dados = dadosFundeinfraDaFeature(feature);
    if (!dados) return null;
    if (!servicosAtivos.FUNDEINFRA) return null;
    if (servicoFiltroAtivo && dados.SERVICO !== servicoFiltroAtivo) return null;
    if (proposta && String(dados.PROPOSTA) !== String(proposta)) return null;
    return dados;
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

  function dadosObrasPontosDaFeatureTodos(feature) {
    var link = valorSeguro(feature, 'LINK');
    if (!link) return [];
    var dados = obrasPontosPorLink[String(link)] || [];
    return Array.isArray(dados) ? dados : [dados];
  }

  function dadosObrasPontosDaFeature(feature) {
    var dados = dadosObrasPontosDaFeatureTodos(feature);
    return dados.length ? dados[0] : null;
  }

  function dadosObrasPontosFiltrados(feature, proposta) {
    var todos = dadosObrasPontosDaFeatureTodos(feature);
    var filtrados = [];

    for (var i = 0; i < todos.length; i++) {
      var item = todos[i];
      if (!servicosAtivos.FUNDEINFRA) continue;
      if (proposta && String(item.PROPOSTA) !== String(proposta)) continue;
      filtrados.push(item);
    }

    return filtrados;
  }

  function estiloObraPonto(dados) {
    var etapa = String((dados && dados.ETAPA) || '').toLowerCase();
    if (etapa.indexOf('projeto') >= 0) return OBRAS_PONTOS_INFO.Projeto;
    if (etapa.indexOf('obra') >= 0) return OBRAS_PONTOS_INFO.Obra;
    return OBRAS_PONTOS_INFO.Padrao;
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
      var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
      var dadosFund = dadosFundeinfraDaFeatureFiltrado(feature, propostaSelecionada);
      var dadosDorTodos = servicosAtivos.DOR ? dadosDorDaFeatureFiltrados(feature, servicoFiltroAtivo, propostaSelecionada) : [];

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
    var linhas = (legendasVisiveis && legendasVisiveis.linhas) || legendasVisiveis || {};
    var pontos = (legendasVisiveis && legendasVisiveis.pontos) || {};
    var nomes = Object.keys(linhas || {}).sort(function(a, b) {
      return String(a).localeCompare(String(b), 'pt-BR');
    });

    for (var i = 0; i < nomes.length; i++) {
      var legenda = nomes[i];
      var cor = linhas[legenda] || '#666666';
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

    var ordemPontos = ['Projeto', 'Obra', 'Padrao'];
    for (var p = 0; p < ordemPontos.length; p++) {
      var chavePonto = ordemPontos[p];
      if (!pontos[chavePonto]) continue;
      var info = OBRAS_PONTOS_INFO[chavePonto];
      var itemPonto = document.createElement('div');
      itemPonto.className = 'legenda-item';
      itemPonto.innerHTML =
        criarHtmlSimboloObraPonto(info.classe, 'legenda-ponto-simbolo') +
        '<div class="legenda-texto">' + escapeHtml(info.label) + '</div>';
      alvo.appendChild(itemPonto);
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
          '<span class="legenda-linha" style="height:9px;background:' + cor + ';"></span>' +
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
      item.innerHTML = criarLegendaLinha(info.tipo, info.cor) + '<div class="legenda-texto">' + info.label + '</div>';
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
      item.innerHTML = criarLegendaLinha(info.tipo, info.cor) + '<div class="legenda-texto">' + info.label + '</div>';
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

  function tabelaHtmlObjeto(titulo, dados, classeTitulo) {
    dados = dados || {};
    var chaves = Object.keys(dados);
    if (!chaves.length) return '';

    var html = '<div class="bloco-servico">' +
      '<div class="titulo-servico ' + (classeTitulo || '') + '">' + escapeHtml(titulo) + '</div>' +
      '<table class="tabela-servico">';

    for (var i = 0; i < chaves.length; i++) {
      var chave = chaves[i];
      html += '<tr><th>' + escapeHtml(chave) + '</th><td>' + escapeHtml(dados[chave]) + '</td></tr>';
    }

    html += '</table></div>';
    return html;
  }

  function construirPopupObraPonto(feature) {
    var p = feature.properties || {};
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
    var dadosTodos = dadosObrasPontosFiltrados(feature, propostaSelecionada);
    var html = '';

    html += '<b>SRE:</b> ' + escapeHtml(p.SRE || '') + '<br>';
    html += '<b>Rodovia:</b> ' + escapeHtml(p.RODOVIA || '') + '<br>';
    html += '<b>Trecho:</b> ' + escapeHtml(p.Trecho || p.TRECHO || '') + '<br>';
    html += '<b>Extensão:</b> ' + escapeHtml(p.EXT_M || '') + ' m';

    for (var i = 0; i < dadosTodos.length; i++) {
      var dados = dadosTodos[i];
      html += '<br><br><b>— FUNDEINFRA';
      if (dadosTodos.length > 1) html += ' ' + (i + 1);
      html += ' —</b><br>';
      html += '<b>Proposta:</b> ' + escapeHtml(dados.PROPOSTA || '') + '<br>';
      html += '<b>Etapa:</b> ' + escapeHtml(dados.ETAPA || '') + '<br>';
      html += '<b>Status:</b> ' + escapeHtml(dados.STATUS || '') + '<br>';
      html += '<b>SEI:</b> ' + escapeHtml(dados.SEI || '') + '<br>';
      html += '<b>Conclusão:</b> ' + escapeHtml(dados.CONCLUSAO || '');
    }

    return html;
  }

  function atualizarPainelInferiorObraPonto(feature) {
    var p = feature.properties || {};
    var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
    var dadosTodos = dadosObrasPontosFiltrados(feature, propostaSelecionada);
    var html = `
        <div class="bloco-servico">
          <div class="titulo-servico titulo-cinza">Dados do ponto</div>
          <table class="tabela-servico">
            <tr><th>SRE</th><th>Rodovia</th><th>Trecho</th><th>Extensão</th><th>Link</th></tr>
            <tr>
              <td>${escapeHtml(p.SRE || '')}</td>
              <td>${escapeHtml(p.RODOVIA || '')}</td>
              <td>${escapeHtml(p.Trecho || p.TRECHO || '')}</td>
              <td>${escapeHtml(p.EXT_M || '')} m</td>
              <td>${escapeHtml(p.LINK || '')}</td>
            </tr>
          </table>
        </div>`;

    for (var i = 0; i < dadosTodos.length; i++) {
      var dados = dadosTodos[i];
      html += `
        <div class="bloco-servico">
          <div class="titulo-servico">Dados FUNDEINFRA</div>
          <table class="tabela-servico">
            <tr><th>Proposta</th><th>Etapa</th><th>Status</th><th>SEI</th><th>Conclusão</th><th>Origem</th></tr>
            <tr>
              <td>${escapeHtml(dados.PROPOSTA || '')}</td>
              <td>${escapeHtml(dados.ETAPA || '')}</td>
              <td>${escapeHtml(dados.STATUS || '')}</td>
              <td>${escapeHtml(dados.SEI || '')}</td>
              <td>${escapeHtml(dados.CONCLUSAO || '')}</td>
              <td>${escapeHtml(dados.ORIGEM || '')}</td>
            </tr>
          </table>
        </div>`;
    }

    document.getElementById('painelTabelaConteudo').innerHTML = html || '<b>Nenhum dado encontrado</b>';
  }

  function criarIconeObraPonto(dados) {
    var estilo = estiloObraPonto(dados);
    return L.divIcon({
      className: 'obra-ponto-icon',
      html: criarHtmlSimboloObraPonto(estilo.classe),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -10]
    });
  }

  function criarHtmlSimboloObraPonto(classe, classeExtra) {
    var classes = ['obra-ponto-simbolo'];
    if (classeExtra) classes.push(classeExtra);
    if (classe) classes.push(classe);
    return '<span class="' + classes.join(' ') + '">' +
      '<svg viewBox="0 0 268.18307 268.18396" aria-hidden="true" focusable="false">' +
        '<g transform="translate(-511.05083,580.11813)">' +
          '<path fill="var(--obra-ponto-fill)" fill-opacity="1" d="m 640.89944,-312.84081 c -2.34343,-1.27137 -124.35457,-123.00021 -127.42572,-127.13088 -2.80683,-3.77514 -3.18674,-7.56496 -1.07818,-10.75574 2.27986,-3.45002 125.74826,-126.89418 128.24864,-128.22348 2.91343,-1.54889 6.08942,-1.55642 9.02824,-0.0214 2.6714,1.39535 126.92093,125.61018 128.51354,128.47769 1.49348,2.68893 1.3778,6.69768 -0.26493,9.18355 -2.27987,3.45003 -125.74824,126.89419 -128.24861,128.22349 -2.70759,1.43944 -6.38403,1.54285 -8.77298,0.24677 z"/>' +
          '<path fill="currentColor" d="m 643.55505,-568.15193 c -5.90332,0.84574 -9.46768,4.85646 -13.49375,8.88254 l -15.34583,15.34583 -67.73333,67.73334 -16.13959,16.13958 c -4.24629,4.2463 -8.66487,8.80651 -7.86176,15.34584 1.10312,8.98202 10.60192,15.44017 16.59301,21.43126 l 45.50833,45.50833 41.27501,41.27501 c 5.4398,5.43981 11.39237,13.69469 20.10833,12.62426 5.88756,-0.72307 9.49533,-4.6571 13.49375,-8.65551 l 15.34583,-15.34584 67.99792,-67.99792 16.13959,-16.13958 c 4.24199,-4.24199 8.66344,-8.81814 7.86176,-15.34585 -1.10311,-8.98201 -10.60192,-15.44016 -16.59301,-21.43125 l -45.50834,-45.50833 -41.53958,-41.53959 c -5.44571,-5.44571 -11.37568,-13.5732 -20.10834,-12.32212 m 0,5.79369 c 7.3523,-1.22774 13.18051,7.80269 17.72709,12.34926 l 41.80417,41.80417 43.12708,43.12709 10.58333,10.58333 c 2.05803,2.05803 4.34183,4.07899 4.7137,7.14375 0.60783,5.00942 -2.79632,7.87222 -6.03661,11.11251 l -17.72709,17.72709 -65.35208,65.35209 -16.66875,16.66875 c -2.57409,2.57408 -5.17675,6.15527 -8.99584,6.79301 -7.35228,1.22775 -13.18051,-7.80269 -17.72708,-12.34926 l -41.80417,-41.80417 -43.12708,-43.12709 -10.58333,-10.58333 c -2.05803,-2.05803 -4.34185,-4.07899 -4.71371,-7.14376 -0.60782,-5.00942 2.79632,-7.8722 6.03662,-11.1125 l 17.72708,-17.72709 65.35209,-65.35209 16.66875,-16.66875 c 2.57408,-2.57408 5.17676,-6.15528 8.99583,-6.79301 m -39.95209,62.88468 c 2.93303,7.04287 8.59625,13.56279 10.6793,20.90209 0.58852,2.07356 0.16862,4.73414 0.16862,6.87917 v 14.2875 29.63334 c 0,4.47941 0.84252,9.91225 -0.1033,14.2875 -1.62753,7.52868 -9.13138,13.6056 -10.48003,21.16667 l 17.72709,9.26042 c 3.09961,-5.31063 5.67266,-10.96561 8.54547,-16.40417 1.47757,-2.79721 3.74647,-5.92419 4.53629,-8.99583 0.56091,-2.18136 0.1474,-4.8998 0.1474,-7.14375 v -14.55209 -36.77709 c 0,-5.03062 1.10433,-11.53622 -0.1474,-16.40417 -0.4847,-1.885 -1.79726,-3.83585 -2.70503,-5.55625 -2.60262,-4.93247 -5.14262,-9.89825 -7.77418,-14.81667 -0.60566,-1.132 -1.57431,-4.46746 -2.92348,-4.81109 -1.30583,-0.3326 -3.57083,1.53045 -4.70616,2.09994 -4.36032,2.18717 -8.75263,4.48378 -12.96459,6.94448 m 82.81459,106.89169 c -1.47148,-5.09824 -5.1193,-10.3894 -7.62963,-15.08125 -0.96813,-1.80947 -2.41265,-3.79596 -2.85039,-5.82084 -0.94584,-4.37523 -0.10331,-9.8081 -0.10331,-14.2875 v -29.63334 -14.2875 c 0,-2.14503 -0.4199,-4.80561 0.16863,-6.87917 2.08395,-7.34238 7.73435,-13.86592 10.67929,-20.90209 -4.05973,-2.6774 -8.68629,-4.64701 -12.96459,-6.96083 -1.12735,-0.6097 -3.35538,-2.42816 -4.70615,-2.08359 -1.31102,0.33443 -2.20229,3.46045 -2.81446,4.54651 -2.67746,4.75011 -5.18228,9.67727 -7.62596,14.55208 -0.96123,1.91754 -2.48673,3.99286 -2.96963,6.08542 -0.53072,2.29979 -0.14005,5.05499 -0.14005,7.40833 v 14.55209 50.27084 c 2.5e-4,3.67019 1.99589,6.64159 3.74093,9.78959 2.0142,3.63356 3.83674,7.4088 5.71956,11.1125 0.75622,1.48757 2.25613,5.90761 3.82502,6.55089 1.23756,0.5074 3.66574,-1.35425 4.70616,-1.94069 4.26056,-2.4015 8.87905,-4.29704 12.96458,-6.99145 z"/>' +
        '</g>' +
      '</svg>' +
    '</span>';
  }

  function pontoEmAnel(lon, lat, anel) {
    var dentro = false;
    for (var i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      var xi = anel[i][0], yi = anel[i][1];
      var xj = anel[j][0], yj = anel[j][1];
      var cruza = ((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (cruza) dentro = !dentro;
    }
    return dentro;
  }

  function pontoEmPoligonoFeature(lon, lat, feature) {
    var geom = feature && feature.geometry;
    if (!geom || !geom.coordinates) return false;
    var poligonos = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

    for (var i = 0; i < poligonos.length; i++) {
      var poligono = poligonos[i];
      if (!poligono || !poligono.length) continue;
      if (!pontoEmAnel(lon, lat, poligono[0])) continue;

      var emBuraco = false;
      for (var j = 1; j < poligono.length; j++) {
        if (pontoEmAnel(lon, lat, poligono[j])) {
          emBuraco = true;
          break;
        }
      }
      if (!emBuraco) return true;
    }

    return false;
  }

  function pontoDentroSelecaoMunicipios(lon, lat, featuresMunicipios) {
    if (!featuresMunicipios || !featuresMunicipios.length) return true;
    if (municipiosData && featuresMunicipios.length >= municipiosData.features.length) return true;

    for (var i = 0; i < featuresMunicipios.length; i++) {
      if (pontoEmPoligonoFeature(lon, lat, featuresMunicipios[i])) return true;
    }

    return false;
  }

  function desenharObrasPontos(rodoviaSelecionada, sreSelecionado, propostaSelecionada, featuresMunicipios) {
    if (obrasPontosLayer) {
      map.removeLayer(obrasPontosLayer);
      obrasPontosLayer = null;
    }

    var tiposVisiveis = {};
    var total = 0;

    if (!obrasPontosData || !obrasPontosData.features || !servicosAtivos.FUNDEINFRA) {
      return { total: total, legenda: tiposVisiveis };
    }

    obrasPontosLayer = L.layerGroup();

    for (var i = 0; i < obrasPontosData.features.length; i++) {
      var feature = obrasPontosData.features[i];
      var p = feature.properties || {};
      var dadosFiltrados = dadosObrasPontosFiltrados(feature, propostaSelecionada);
      if (!dadosFiltrados.length) continue;
      if (rodoviaSelecionada && nomeRodoviaFeature(feature) !== rodoviaSelecionada) continue;
      if (sreSelecionado && nomeSREFeature(feature) !== sreSelecionado) continue;
      if (servicoFiltroAtivo) continue;

      var coords = feature.geometry && feature.geometry.coordinates;
      if (!coords || coords.length < 2) continue;
      if (!pontoDentroSelecaoMunicipios(coords[0], coords[1], featuresMunicipios)) continue;

      var dados = dadosFiltrados[0];
      var estilo = estiloObraPonto(dados);
      var tipoLegenda = estilo === OBRAS_PONTOS_INFO.Projeto ? 'Projeto' :
        estilo === OBRAS_PONTOS_INFO.Obra ? 'Obra' : 'Padrao';
      tiposVisiveis[tipoLegenda] = true;

      var marker = L.marker([coords[1], coords[0]], {
        pane: 'oaePane',
        icon: criarIconeObraPonto(dados),
        title: (p.Trecho || p.TRECHO || '') + ' - ' + ((dados && dados.ETAPA) || '')
      });

      marker.bindPopup(construirPopupObraPonto(feature));
      marker.on('click', function(f) {
        return function() {
          atualizarPainelInferiorObraPonto(f);
        };
      }(feature));

      obrasPontosLayer.addLayer(marker);
      total++;
    }

    if (total) obrasPontosLayer.addTo(map);
    return { total: total, legenda: tiposVisiveis };
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
    var resultadoObrasPontos = desenharObrasPontos(rodoviaSelecionada, sreSelecionado, propostaSelecionada, featuresMunicipios);
    var totalObrasPontos = resultadoObrasPontos.total;

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
    var contadorObrasPontos = document.getElementById('countObrasPontos');
    if (contadorObrasPontos) contadorObrasPontos.textContent = totalObrasPontos;
    document.getElementById('countDor').textContent = countDor;

        renderizarLegendaServicos({
      linhas: servicosVisiveis,
      pontos: resultadoObrasPontos.legenda
    });
    renderizarLegendaDor(servicosVisiveisDor);
    renderizarLegendaOAE({});
    renderizarLegendaRodEst(situacoesEstVisiveis);
    renderizarLegendaRodFed(situacoesFedVisiveis);
  }

    function atualizarPainelInferior(feature) {
      var p = feature.properties || {};
      var propostaSelecionada = document.getElementById('propostaSelect') ? document.getElementById('propostaSelect').value : '';
      var dadosFund = dadosFundeinfraDaFeatureFiltrado(feature, propostaSelecionada);
      var dadosDorTodos = servicosAtivos.DOR ? dadosDorDaFeatureFiltrados(feature, servicoFiltroAtivo, propostaSelecionada) : [];

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
    desenharAreasUrbanas();
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
    areasUrbanasFiltroAtivo = false;
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
    var btnAreasUrbanasOff = document.getElementById('toggleAreasUrbanas');
    if (btnAreasUrbanasOff) btnAreasUrbanasOff.classList.remove('ativo-filtro');
    document.getElementById('localidadeSelect').value = '';
    document.getElementById('localidadeBusca').value = '';

    resetarBotoesServico();

    if (snvLayer) { map.removeLayer(snvLayer); snvLayer = null; }
    if (snvLabelLayer) { map.removeLayer(snvLabelLayer); snvLabelLayer = null; }
    if (sreBaseLayer) { map.removeLayer(sreBaseLayer); sreBaseLayer = null; }
    if (sreBaseLabelLayer) { map.removeLayer(sreBaseLabelLayer); sreBaseLabelLayer = null; }
    if (areasUrbanasLayer) { map.removeLayer(areasUrbanasLayer); areasUrbanasLayer = null; }
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
    var contadorObrasPontosOff = document.getElementById('countObrasPontos');
    if (contadorObrasPontosOff) contadorObrasPontosOff.textContent = '0';
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
    areasUrbanasFiltroAtivo = false;
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
    var btnAreasUrbanasOn = document.getElementById('toggleAreasUrbanas');
    if (btnAreasUrbanasOn) btnAreasUrbanasOn.classList.remove('ativo-filtro');
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

  var btnToggleAreasUrbanas = document.getElementById('toggleAreasUrbanas');
  if (btnToggleAreasUrbanas) {
    btnToggleAreasUrbanas.addEventListener('click', function() {
      areasUrbanasFiltroAtivo = !areasUrbanasFiltroAtivo;
      atualizarBotoesBase();
      desenharAreasUrbanas();
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
    fetchGeoJSON('data/areas_urbanas.geojson', false),
    fetchGeoJSON('data/sre_base.geojson', false),
    fetchGeoJSON('data/obras_linhas.geojson', true),
    fetchGeoJSON('data/obras_pontos.geojson', false),
    fetchGeoJSON('data/snv_goias.geojson', false),
    fetchGeoJSON('data/estados.geojson', false),
    fetchGeoJSON('data/mascara_brasil.geojson', false)
  ]).then(function(resultado) {
    municipiosData = resultado[0];
    localidadesData = resultado[1];
    areasUrbanasData = resultado[2];
    sreBaseData = resultado[3];
    sreData = resultado[4];
    obrasPontosData = resultado[5];
    oaeData = null;
    snvData = resultado[6];
    estadosData = resultado[7];
    mascaraBrasilData = resultado[8];

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

