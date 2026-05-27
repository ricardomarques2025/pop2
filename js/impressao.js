// Funcoes e eventos do modo de impressao/PDF.
// Depende das variaveis e funcoes globais carregadas por js/mapa.js.

// ===== IMPRESSAO / PDF =====

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
    if (legendaAmpliadaImpressao(d)) escalaLegenda = 0.9;
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



