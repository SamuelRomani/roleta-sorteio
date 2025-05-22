// script.js

// Variáveis globais (permanecem como antes)
let roletaEmEdicao = null;
let modalGerenciarItensBS = null;
let modalResultadoSorteioBS = null;
let itemInputModalEl, addItemBtnModalEl, listaItensModalEl, limparItensBtnModalEl, contadorItensModalEl, modalGerenciarItensLabelEl;

// --- FUNÇÃO HELPER para calcular a luminosidade de uma cor HEX ---
function getLuminance(hexColor) {
    const hex = hexColor.replace('#', '');
    const fullHex = hex.length === 3 ? hex.split('').map(char => char + char).join('') : hex;
    if (fullHex.length !== 6) { 
        console.warn("Cor HEX inválida para cálculo de luminância:", hexColor);
        return 128; 
    }
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// --- FUNÇÃO HELPER para obter uma cor de texto contrastante ---
function getContrastingTextColor(hexBackgroundColor, lightTextColor, darkTextColor, luminanceThreshold = 140) {
    if (typeof hexBackgroundColor !== 'string' || !hexBackgroundColor.startsWith('#')) {
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDarkMode ? lightTextColor : darkTextColor; 
    }
    const luminance = getLuminance(hexBackgroundColor);
    return luminance > luminanceThreshold ? darkTextColor : lightTextColor;
}


class Roleta {
    constructor(containerId, opcoesIniciais = [], config = {}) {
        this.containerElement = document.getElementById(containerId);
        if (!this.containerElement) { console.error(`Container com ID '${containerId}' não encontrado.`); return; }
        this.containerId = containerId; this.itens = []; this.anguloAtual = 0; this.girando = false; this.velocidadeGiro = 0; this.ultimoTempo = 0; this.idAnimacao = null;
        
        this.coresLight = ['#005C46', '#FEC92F', '#F58220', '#397039', '#D0D0CE', '#AC9351'];
        this.coresDark = ['#00A572', '#FDE93A', '#F9A832', '#428A42', '#939598', '#B89E56'];
        this.activeCores = [];

        this.TEXTO_COR_CLARA = "#FDFDFD";
        this.TEXTO_COR_ESCURA = "#212529";   
        this.TEXTO_SORTEADO_COR_CLARA = "#b0b0b0"; 
        this.TEXTO_SORTEADO_COR_ESCURA = "#727176";  

        this.pointerColorLight = "#005C46"; 
        this.pointerColorDark = "#FEC92F";   
        this.activePointerColor = "";

        this.sons = { giro: null, resultado: null, adicionar: null, remover: null, erro: null, reset: null };
        this._inicializarSons(); // Alterado para seus arquivos .wav

        this.enforceNoRepeats = config.enforceNoRepeats || false;
        this.drawnNames = new Set();
        this.canvas = null; this.ctx = null; this.girarBtn = null; this.resultadoDiv = null; 
        this.gerenciarItensBtn = null; this.contadorItensDisplay = null; this.resetSorteadosBtn = null;

        this._inicializarUI();
        this._applyTheme(); 
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this._applyTheme(); 
            this.desenharRoleta(); 
        });
        this._carregarItensDoLocalStorage(opcoesIniciais);
        if (this.enforceNoRepeats) { this._loadDrawnNames(); }
        this.desenharRoleta(); 
        this._atualizarEstadoRoletaPrincipal();
    }

    _applyTheme() {
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDarkMode) {
            this.activeCores = this.coresDark;
            this.activePointerColor = this.pointerColorDark;
        } else {
            this.activeCores = this.coresLight;
            this.activePointerColor = this.pointerColorLight;
        }
    }
    
    // --- MÉTODO _inicializarSons() ATUALIZADO ---
    _inicializarSons() {
        // Lembre-se de colocar seus arquivos .wav na pasta 'sons/' (ou outra de sua preferência)
        // e ajustar os nomes dos arquivos abaixo para corresponderem EXATAMENTE aos seus.
        try {
            // **ATENÇÃO:** Substitua 'SEU_ARQUIVO_DE_GIRO.wav' pelo nome do seu arquivo de som de roleta.
            this.sons.giro = new Audio('sons/som_giro_roleta.wav');
            // Se o som de giro for um loop curto e você quiser que ele repita:
            this.sons.giro.loop = true; 

            // **ATENÇÃO:** Substitua 'SEU_ARQUIVO_DE_PREMIO.wav' pelo nome do seu arquivo de som de resultado/prêmio.
            this.sons.resultado = new Audio('sons/som_resultado_roleta.wav');
            
            // Você também pode configurar os outros sons se tiver os arquivos .wav para eles:
            // Exemplo:
            // this.sons.adicionar = new Audio('sons/som_adicionar_item.wav');
            // this.sons.remover = new Audio('sons/som_remover_item.wav');
            // this.sons.erro = new Audio('sons/som_erro.wav');
            // this.sons.reset = new Audio('sons/som_reset.wav');

        } catch (e) {
            console.warn("Não foi possível carregar os arquivos de áudio .wav. Verifique os nomes e caminhos dos arquivos (Ex: 'sons/NOME_DO_ARQUIVO.wav').", e);
        }
    }

    _tocarSom(nomeSom) {
        if (this.sons[nomeSom]) {
            this.sons[nomeSom].currentTime = 0;
            this.sons[nomeSom].play().catch(error => {
                // O erro ao tocar som, especialmente o primeiro, pode ser devido à política de autoplay do navegador.
                // O usuário precisa interagir com a página (clicar em algo) antes que o áudio possa ser reproduzido.
                console.warn(`Erro ao tocar som '${nomeSom}': `, error, "Lembre-se que a interação do usuário pode ser necessária para habilitar o áudio.");
            });
        }
    }

    _pararSom(nomeSom) {
        if (this.sons[nomeSom] && !this.sons[nomeSom].paused) {
            this.sons[nomeSom].pause();
            this.sons[nomeSom].currentTime = 0;
        }
    }

    _inicializarUI() {
        this.containerElement.innerHTML = `
            <div class="roleta-wrapper p-2">
                <h3 class="roleta-titulo text-center mb-3">Roleta</h3>
                <canvas class="roletaCanvas mb-3" width="400" height="400"></canvas>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <button class="girarBtn btn btn-primary flex-grow-1 me-2" disabled>Girar Roleta</button>
                    <button class="gerenciarItensBtn btn btn-outline-secondary">
                        Gerenciar Itens (<span class="contador-itens-roleta">0</span>)
                    </button>
                </div>
                <div class="resultado alert alert-info text-center" role="alert" style="min-height: 50px;">
                    Pronto para girar!
                </div>
                <div class="reset-button-placeholder mt-2"></div> 
            </div>
        `;
        this.canvas = this.containerElement.querySelector('.roletaCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.girarBtn = this.containerElement.querySelector('.girarBtn');
        this.resultadoDiv = this.containerElement.querySelector('.resultado');
        this.gerenciarItensBtn = this.containerElement.querySelector('.gerenciarItensBtn');
        this.contadorItensDisplay = this.containerElement.querySelector('.contador-itens-roleta');
        const tituloElement = this.containerElement.querySelector('.roleta-titulo');
        if (tituloElement && this.containerElement.dataset.tituloRoleta) {
            tituloElement.textContent = this.containerElement.dataset.tituloRoleta;
        }
        if (this.enforceNoRepeats) {
            const placeholder = this.containerElement.querySelector('.reset-button-placeholder');
            this.resetSorteadosBtn = document.createElement('button');
            this.resetSorteadosBtn.className = 'btn btn-outline-warning btn-sm w-100 resetSorteadosBtn';
            this.resetSorteadosBtn.textContent = 'Resetar Nomes Sorteados';
            this.resetSorteadosBtn.onclick = () => this.resetDrawnNames();
            placeholder.appendChild(this.resetSorteadosBtn);
        }
        this.gerenciarItensBtn.addEventListener('click', () => { abrirModalGerenciarItens(this); });
        this.girarBtn.addEventListener('click', () => this.iniciarGiro());
    }

    _salvarItensNoLocalStorage() { /* ... como antes ... */ }
    _carregarItensDoLocalStorage(opcoesIniciaisPadrao) { /* ... como antes ... */ }
    _saveDrawnNames() { /* ... como antes ... */ }
    _loadDrawnNames() { /* ... como antes ... */ }
    resetDrawnNames() { /* ... como antes ... */ }
    
    desenharRoleta() { /* ... como na última versão completa, com contraste dinâmico ... */ }
    _popularListaItensModal(ulElementoModal, contadorElementoModal) { /* ... como antes ... */ }
    _atualizarEstadoRoletaPrincipal() { /* ... como antes ... */ }
    adicionarItem(novoItemTexto) { /* ... como antes ... */ }
    removerItem(index) { /* ... como antes ... */ }
    limparItens() { /* ... como antes ... */ }
    iniciarGiro() { /* ... como antes ... */ }
    pararGiro() { /* ... como na última versão completa, com mensagem amigável de pulo ... */ }

    // Cole aqui os métodos completos de:
    // _salvarItensNoLocalStorage, _carregarItensDoLocalStorage, _saveDrawnNames, _loadDrawnNames, 
    // resetDrawnNames, desenharRoleta, _popularListaItensModal, _atualizarEstadoRoletaPrincipal, 
    // adicionarItem, removerItem, limparItens, iniciarGiro, pararGiro
    // Exatamente como estavam na ÚLTIMA RESPOSTA COMPLETA que te enviei (resposta após corrigir o contraste do texto).
    // Para este exemplo, vou colar apenas o `desenharRoleta` e `pararGiro` por serem os mais complexos e relevantes para visualização.
    // É crucial que você use todos os métodos da última versão completa.

    desenharRoleta() {
        if (!this.ctx || !this.canvas) return;
        const numItens = this.itens.length;
        const { width, height } = this.canvas; 
        const raio = width / 2;
        this.ctx.clearRect(0, 0, width, height);

        if (numItens === 0) { 
            let textColorForEmpty = this.TEXTO_COR_ESCURA; 
            try {
                const wrapperBgColor = getComputedStyle(this.containerElement.querySelector('.roleta-wrapper')).backgroundColor;
                textColorForEmpty = getContrastingTextColor(wrapperBgColor, this.TEXTO_COR_CLARA, this.TEXTO_COR_ESCURA);
            } catch(e) { /* Usa o padrão em caso de erro */ }
            this.ctx.fillStyle = textColorForEmpty;
            this.ctx.font = "bold 16px Arial"; 
            this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; 
            this.ctx.fillText("Adicione itens via 'Gerenciar Itens'", width / 2, height / 2); 
            return; 
        }
        const anguloItem = (2 * Math.PI) / numItens;
        let fontSize = 12; 
        if (numItens > 16) fontSize = 8; 
        else if (numItens > 12) fontSize = 9; 
        else if (numItens > 8) fontSize = 10;
        this.ctx.font = `bold ${fontSize}px Arial`;

        for (let i = 0; i < numItens; i++) {
            const anguloInicioSetor = this.anguloAtual + i * anguloItem; 
            const anguloFimSetor = anguloInicioSetor + anguloItem;
            const sectorBgColor = this.activeCores[i % this.activeCores.length]; 
            this.ctx.beginPath(); this.ctx.moveTo(raio, raio); this.ctx.arc(raio, raio, raio - 5, anguloInicioSetor, anguloFimSetor); this.ctx.closePath();
            this.ctx.fillStyle = sectorBgColor; 
            this.ctx.fill(); 
            this.ctx.strokeStyle = getContrastingTextColor(sectorBgColor, this.TEXTO_COR_CLARA, this.TEXTO_COR_ESCURA, 100); 
            this.ctx.lineWidth = 0.5; 
            this.ctx.stroke();
            this.ctx.save();
            const textoItem = this.itens[i] || "";
            const isDrawn = this.enforceNoRepeats && this.drawnNames.has(textoItem);
            if (isDrawn) { this.ctx.fillStyle = getContrastingTextColor(sectorBgColor, this.TEXTO_SORTEADO_COR_CLARA, this.TEXTO_SORTEADO_COR_ESCURA); }
            else { this.ctx.fillStyle = getContrastingTextColor(sectorBgColor, this.TEXTO_COR_CLARA, this.TEXTO_COR_ESCURA); }
            this.ctx.translate(raio, raio); this.ctx.rotate(anguloInicioSetor + anguloItem / 2); this.ctx.textAlign = "right"; this.ctx.textBaseline = "middle";
            let margemTextoDaBorda = 15; 
            if (fontSize <= 9) margemTextoDaBorda = 10; 
            if (raio < 100 && fontSize > 10) margemTextoDaBorda = 10;
            const maxLarguraTexto = raio - margemTextoDaBorda - (fontSize * 1.5);
            let textoExibido = textoItem;
            if (this.ctx.measureText(textoItem).width > maxLarguraTexto && maxLarguraTexto > 0) {
                while (this.ctx.measureText(textoExibido + '...').width > maxLarguraTexto && textoExibido.length > 0) textoExibido = textoExibido.slice(0, -1);
                textoExibido += '...';
            } else if (maxLarguraTexto <= 0) textoExibido = "..";
            this.ctx.fillText(textoExibido, raio - margemTextoDaBorda, 0); 
            this.ctx.restore();
        }
        this.ctx.fillStyle = this.activePointerColor; 
        this.ctx.beginPath(); this.ctx.moveTo(width - 5, height / 2 - 10); this.ctx.lineTo(width - 20, height / 2); this.ctx.lineTo(width - 5, height / 2 + 10); this.ctx.closePath(); this.ctx.fill(); 
        let cardBgColorForPointerContrast = this.TEXTO_COR_CLARA; 
        try { const wrapperElement = this.containerElement.querySelector('.roleta-wrapper'); if (wrapperElement) { cardBgColorForPointerContrast = getComputedStyle(wrapperElement).backgroundColor; }
        } catch(e) { console.warn("Não foi possível obter a cor de fundo do wrapper para o ponteiro."); }
        this.ctx.strokeStyle = getContrastingTextColor(cardBgColorForPointerContrast, this.TEXTO_COR_CLARA, this.TEXTO_COR_ESCURA);
        this.ctx.lineWidth = 1; this.ctx.stroke();
    }

    pararGiro() {
        cancelAnimationFrame(this.idAnimacao); this.girando = false; this.gerenciarItensBtn.disabled = false; this._pararSom('giro');
        const numItens = this.itens.length; if (numItens === 0) { this._atualizarEstadoRoletaPrincipal(); return; }
        const anguloItem = (2 * Math.PI) / numItens; let anguloPonteiroRelativo = (-this.anguloAtual % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const indiceSorteadoInicial = Math.floor(anguloPonteiroRelativo / anguloItem); const itemSorteadoVisual = this.itens[indiceSorteadoInicial]; 
        let finalWinnerItem = null; let wasSkipped = false;
        if (this.enforceNoRepeats) {
            if (this.drawnNames.size >= numItens) {
                this.resultadoDiv.textContent = "Todos os nomes já foram sorteados! Resete para continuar."; this.resultadoDiv.className = 'resultado alert alert-warning text-center';
                document.getElementById('itemSorteadoNoModal').textContent = "Todos Sorteados!"; document.getElementById('skipInfoModal').innerHTML = '';
                const modalResultadoLabel = document.getElementById('modalResultadoSorteioLabel'); if (modalResultadoLabel) modalResultadoLabel.innerHTML = `🎉 ${this.containerElement.dataset.tituloRoleta || "Roleta"} 🎉`;
                if (modalResultadoSorteioBS) modalResultadoSorteioBS.show(); this._tocarSom('erro'); this._atualizarEstadoRoletaPrincipal(); return;
            }
            let currentAttemptIndex = indiceSorteadoInicial;
            for (let i = 0; i < numItens; i++) { 
                const candidateItem = this.itens[currentAttemptIndex];
                if (!this.drawnNames.has(candidateItem)) { finalWinnerItem = candidateItem; if (currentAttemptIndex !== indiceSorteadoInicial) { wasSkipped = true; } break; }
                currentAttemptIndex = (currentAttemptIndex + 1) % numItens;
            }
            if (finalWinnerItem) { this.drawnNames.add(finalWinnerItem); this._saveDrawnNames(); }
            else { console.error("Lógica de sorteio falhou..."); this.resultadoDiv.textContent = "Erro no sorteio..."; this.resultadoDiv.className = 'resultado alert alert-danger text-center'; this._atualizarEstadoRoletaPrincipal(); return; }
        } else { finalWinnerItem = itemSorteadoVisual; }
        this._atualizarEstadoRoletaPrincipal();
        const tituloRoletaOriginal = this.containerElement.dataset.tituloRoleta || "Esta Roleta";
        const modalResultadoLabel = document.getElementById('modalResultadoSorteioLabel');
        if (modalResultadoLabel) { modalResultadoLabel.innerHTML = `🎉 ${tituloRoletaOriginal} Sorteou: 🎉`; }
        const itemSorteadoModalEl = document.getElementById('itemSorteadoNoModal'); const skipInfoEl = document.getElementById('skipInfoModal');
        itemSorteadoModalEl.textContent = finalWinnerItem;
        if (skipInfoEl) { if (wasSkipped) { skipInfoEl.innerHTML = `A roleta parou em <strong>${itemSorteadoVisual}</strong> (já sorteado).<br>O próximo nome disponível foi selecionado!`; } else { skipInfoEl.innerHTML = ''; } }
        const sortearNovamenteBtn = document.getElementById('sortearNovamenteBtnModalResultado');
        if (sortearNovamenteBtn) {
            const novoBtnSortearNovamente = sortearNovamenteBtn.cloneNode(true); sortearNovamenteBtn.parentNode.replaceChild(novoBtnSortearNovamente, sortearNovamenteBtn);
            novoBtnSortearNovamente.addEventListener('click', () => { if (modalResultadoSorteioBS) modalResultadoSorteioBS.hide(); this.iniciarGiro(); });
        }
        if (modalResultadoSorteioBS) modalResultadoSorteioBS.show();
        if (wasSkipped) { this.resultadoDiv.textContent = `Sorteado: ${finalWinnerItem} (após pular '${itemSorteadoVisual}')`; }
        else { this.resultadoDiv.textContent = `Último sorteado: ${finalWinnerItem}`; }
        this.resultadoDiv.className = 'resultado alert alert-success text-center'; this._tocarSom('resultado'); this.desenharRoleta();
    }


} // Fim da Classe Roleta


// Funções de controle do modal (abrirModalGerenciarItens, setupListenersModalGerenciamento)
function abrirModalGerenciarItens(instanciaRoleta) { /* ... como antes ... */ }
function setupListenersModalGerenciamento() { /* ... como antes ... */ }

// Evento DOMContentLoaded para inicializar as roletas e modais
document.addEventListener('DOMContentLoaded', () => { /* ... como antes ... */ });


// --- Colar aqui as implementações completas de: ---
// _salvarItensNoLocalStorage, _carregarItensDoLocalStorage, _saveDrawnNames, _loadDrawnNames, 
// resetDrawnNames, _popularListaItensModal, _atualizarEstadoRoletaPrincipal, 
// adicionarItem, removerItem, limparItens, iniciarGiro,
// abrirModalGerenciarItens, setupListenersModalGerenciamento, e o DOMContentLoaded
// da RESPOSTA ANTERIOR COMPLETA (após corrigir contraste de texto) para ter o script funcional.
// Vou colar agora para garantir que esteja completo.

// (Implementações dos métodos omitidos na repetição anterior, mas presentes na versão completa anterior)
Roleta.prototype._salvarItensNoLocalStorage = function() {
    try { localStorage.setItem(`roleta-itens-${this.containerId}`, JSON.stringify(this.itens)); }
    catch (e) { console.error("Erro ao salvar itens:", e); }
};
Roleta.prototype._carregarItensDoLocalStorage = function(opcoesIniciaisPadrao) {
    try { const itensSalvos = localStorage.getItem(`roleta-itens-${this.containerId}`);
        if (itensSalvos) { this.itens = JSON.parse(itensSalvos); }
        else { this.itens = [...opcoesIniciaisPadrao]; }
    } catch (e) { console.error("Erro ao carregar itens:", e); this.itens = [...opcoesIniciaisPadrao]; }
    if (this.itens.length === 0 && opcoesIniciaisPadrao.length > 0 && localStorage.getItem(`roleta-itens-${this.containerId}`) === null) {
         this.itens = [...opcoesIniciaisPadrao];
    }
};
Roleta.prototype._saveDrawnNames = function() {
    if (!this.enforceNoRepeats) return;
    try { localStorage.setItem(`roleta-drawn-${this.containerId}`, JSON.stringify(Array.from(this.drawnNames))); }
    catch (e) { console.error("Erro ao salvar nomes sorteados:", e); }
};
Roleta.prototype._loadDrawnNames = function() {
    if (!this.enforceNoRepeats) return;
    try { const drawnNamesSaved = localStorage.getItem(`roleta-drawn-${this.containerId}`);
        if (drawnNamesSaved) { this.drawnNames = new Set(JSON.parse(drawnNamesSaved)); }
    } catch (e) { console.error("Erro ao carregar nomes sorteados:", e); this.drawnNames = new Set(); }
};
Roleta.prototype.resetDrawnNames = function() {
    if (!this.enforceNoRepeats) return;
    if (confirm("Tem certeza que deseja resetar a lista de nomes já sorteados para esta roleta?")) {
        this.drawnNames.clear(); this._saveDrawnNames(); this.desenharRoleta(); 
        this._atualizarEstadoRoletaPrincipal(); 
        this.resultadoDiv.textContent = "Lista de sorteados resetada. Pronto para girar!";
        this.resultadoDiv.className = 'resultado alert alert-info text-center';
        this._tocarSom('reset'); 
    }
};
Roleta.prototype._popularListaItensModal = function(ulElementoModal, contadorElementoModal) {
    if (!ulElementoModal || !contadorElementoModal) return;
    ulElementoModal.innerHTML = ''; 
    contadorElementoModal.textContent = this.itens.length;
    if (this.itens.length === 0) { const li = document.createElement('li'); li.className = 'list-group-item text-muted'; li.textContent = 'Nenhum item cadastrado.'; ulElementoModal.appendChild(li); return; }
    this.itens.forEach((item, index) => {
        const li = document.createElement('li'); li.className = 'list-group-item d-flex justify-content-between align-items-center'; li.textContent = item;
        const removeBtn = document.createElement('button'); removeBtn.className = 'btn btn-sm btn-outline-danger'; removeBtn.innerHTML = '&times;'; removeBtn.title = 'Remover item';
        removeBtn.onclick = () => { this.removerItem(index); if (roletaEmEdicao === this) { this._popularListaItensModal(listaItensModalEl, contadorItensModalEl); } };
        li.appendChild(removeBtn); ulElementoModal.appendChild(li);
    });
};
Roleta.prototype._atualizarEstadoRoletaPrincipal = function() {
    if (!this.girarBtn || !this.resultadoDiv || !this.contadorItensDisplay) return;
    this.contadorItensDisplay.textContent = this.itens.length;
    let todosSorteados = false;
    if (this.enforceNoRepeats && this.itens.length > 0) { todosSorteados = this.drawnNames.size >= this.itens.length; }
    this.girarBtn.disabled = this.itens.length < 2 || this.girando || todosSorteados;
    if (this.resetSorteadosBtn) { this.resetSorteadosBtn.disabled = this.girando || this.drawnNames.size === 0; }
    if (!this.girando) {
        if (todosSorteados) { this.resultadoDiv.textContent = "Todos os nomes sorteados! Resete a lista."; this.resultadoDiv.className = 'resultado alert alert-warning text-center'; }
        else if (this.itens.length < 2) { this.resultadoDiv.textContent = "Adicione pelo menos 2 itens."; this.resultadoDiv.className = 'resultado alert alert-warning text-center'; }
        else { if (!this.resultadoDiv.textContent.startsWith("Último sorteado:") && !this.resultadoDiv.textContent.startsWith("Lista de sorteados resetada")) { this.resultadoDiv.textContent = "Pronto para girar!"; this.resultadoDiv.className = 'resultado alert alert-info text-center'; } }
    }
};
Roleta.prototype.adicionarItem = function(novoItemTexto) { 
    if (this.girando) return false; const novoItem = novoItemTexto.trim();
    if (novoItem) { if (!this.itens.includes(novoItem)) { this.itens.push(novoItem); this._salvarItensNoLocalStorage(); this.desenharRoleta(); this._atualizarEstadoRoletaPrincipal(); this._tocarSom('adicionar'); return true; } else { this._tocarSom('erro'); return false; } }
    this._tocarSom('erro'); return false;
};
Roleta.prototype.removerItem = function(index) { 
    if (this.girando || index < 0 || index >= this.itens.length) return; const itemRemovido = this.itens.splice(index, 1)[0]; this._salvarItensNoLocalStorage(); 
    if (this.enforceNoRepeats && itemRemovido) { this.drawnNames.delete(itemRemovido); this._saveDrawnNames(); }
    this.desenharRoleta(); this._atualizarEstadoRoletaPrincipal(); this._tocarSom('remover');
};
Roleta.prototype.limparItens = function() { 
    if (this.girando) return; this.itens = []; this._salvarItensNoLocalStorage();
    if (this.enforceNoRepeats) { this.drawnNames.clear(); this._saveDrawnNames(); }
    this.desenharRoleta(); this._atualizarEstadoRoletaPrincipal(); this.resultadoDiv.textContent = 'Todos os itens foram removidos.'; this.resultadoDiv.className = 'resultado alert alert-secondary text-center';
};
Roleta.prototype.iniciarGiro = function() {
    if (this.enforceNoRepeats && this.itens.length > 0 && this.drawnNames.size >= this.itens.length) { this.resultadoDiv.textContent = "Todos já foram sorteados! Use o botão 'Resetar'."; this.resultadoDiv.className = 'resultado alert alert-warning text-center'; this._tocarSom('erro'); return; }
    if (this.girando || this.itens.length < 2) return;
    this.girando = true; this.girarBtn.disabled = true; this.gerenciarItensBtn.disabled = true; if(this.resetSorteadosBtn) this.resetSorteadosBtn.disabled = true;
    this.resultadoDiv.textContent = 'Girando...'; this.resultadoDiv.className = 'resultado alert alert-primary text-center fw-bold'; this._pararSom('resultado'); this._tocarSom('giro');
    const duracaoMinimaSegundos = 4; const duracaoMaximaSegundos = 7; const duracaoGiroMs = (Math.random() * (duracaoMaximaSegundos - duracaoMinimaSegundos) + duracaoMinimaSegundos) * 1000;
    const voltasExtras = Math.floor(Math.random() * 3) + 3; const anguloDeGiroTotal = (voltasExtras * 2 * Math.PI) + (Math.random() * 2 * Math.PI);
    let tempoInicioAnimacao = null; const duracaoGiroSeg = duracaoGiroMs / 1000; const aceleracao = (2 * anguloDeGiroTotal) / Math.pow(duracaoGiroSeg, 2);
    this.velocidadeGiro = aceleracao * duracaoGiroSeg; this.anguloAtual %= (2 * Math.PI);
    const animar = (tempoAtual) => {
        if (!tempoInicioAnimacao) tempoInicioAnimacao = tempoAtual; const deltaTempoSeg = (this.ultimoTempo ? (tempoAtual - this.ultimoTempo) / 1000 : 1/60);
        this.anguloAtual += this.velocidadeGiro * deltaTempoSeg; this.anguloAtual %= (2 * Math.PI); this.velocidadeGiro -= aceleracao * deltaTempoSeg;
        if(this.velocidadeGiro < 0) this.velocidadeGiro = 0; this.desenharRoleta(); this.ultimoTempo = tempoAtual; const tempoDecorridoMs = tempoAtual - tempoInicioAnimacao;
        if (tempoDecorridoMs < duracaoGiroMs && this.velocidadeGiro > 0.001) this.idAnimacao = requestAnimationFrame(animar); else this.pararGiro();
    };
    this.ultimoTempo = performance.now(); tempoInicioAnimacao = this.ultimoTempo; this.idAnimacao = requestAnimationFrame(animar);
};

// Colei as funções de modal e DOMContentLoaded aqui para garantir que está tudo.
function abrirModalGerenciarItens(instanciaRoleta) { 
    roletaEmEdicao = instanciaRoleta;
    if (modalGerenciarItensBS && roletaEmEdicao) {
        const tituloRoleta = roletaEmEdicao.containerElement.dataset.tituloRoleta || "Roleta";
        modalGerenciarItensLabelEl.textContent = `Gerenciar Itens - ${tituloRoleta}`;
        roletaEmEdicao._popularListaItensModal(listaItensModalEl, contadorItensModalEl);
        itemInputModalEl.value = '';
        modalGerenciarItensBS.show();
        itemInputModalEl.focus();
    }
}
function setupListenersModalGerenciamento() { 
    addItemBtnModalEl.addEventListener('click', () => {
        if (roletaEmEdicao) {
            const sucesso = roletaEmEdicao.adicionarItem(itemInputModalEl.value);
            if (sucesso) {
                roletaEmEdicao._popularListaItensModal(listaItensModalEl, contadorItensModalEl);
                itemInputModalEl.value = '';
            } else {
                alert("Item vazio ou já existe!");
            }
            itemInputModalEl.focus();
        }
    });
    itemInputModalEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') addItemBtnModalEl.click(); });
    limparItensBtnModalEl.addEventListener('click', () => {
        if (roletaEmEdicao && confirm("Tem certeza que deseja limpar todos os itens desta roleta?")) {
            roletaEmEdicao.limparItens();
            roletaEmEdicao._popularListaItensModal(listaItensModalEl, contadorItensModalEl);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const modalGerenciarEl = document.getElementById('modalGerenciarItens');
    if (modalGerenciarEl) {
        modalGerenciarItensBS = new bootstrap.Modal(modalGerenciarEl);
        itemInputModalEl = document.getElementById('itemInputModal');
        addItemBtnModalEl = document.getElementById('addItemBtnModal');
        listaItensModalEl = document.getElementById('listaItensModal');
        limparItensBtnModalEl = document.getElementById('limparItensBtnModal');
        contadorItensModalEl = document.getElementById('contadorItensModal');
        modalGerenciarItensLabelEl = document.getElementById('modalGerenciarItensLabel');
        setupListenersModalGerenciamento();
    }
    const modalResultadoEl = document.getElementById('modalResultadoSorteio');
    if (modalResultadoEl) {
        modalResultadoSorteioBS = new bootstrap.Modal(modalResultadoEl);
    }

    const containerRoleta1 = document.getElementById('roletaContainer1');
    if (containerRoleta1) {
        const nomesRoleta1 = [
            "Adriano Moreira", "Andre Landim", "Arthur Soldera", "Daniel Pelegrini", 
            "Fernanda Barreto", "Gabriel More", "Katiuce Dalcin", "Lais Stefany", 
            "Lucas Pereira", "Luiz Wippel", "Marcos Henrique", "Marcos Roberto", 
            "Matheus Eduardo", "Ramon Silveira", "Regis Eduardo", "Ronaldo Euclis", 
            "Thalyson Almeida", "Samuel Romani"
        ];
        const roleta1 = new Roleta('roletaContainer1', nomesRoleta1, { enforceNoRepeats: true });
    }

    const containerRoleta2 = document.getElementById('roletaContainer2');
    if (containerRoleta2) {
        const premiosRoleta2 = [
            "Vale-Presente R$50", "Caneca Exclusiva", "Rodada Grátis", 
            "Desconto Especial 10%", "Brinde Surpresa", "Consultoria Gratuita"
        ];
        const roleta2 = new Roleta('roletaContainer2', premiosRoleta2);
    }
});