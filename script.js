const nomes = [];
const valoresFixos = ["R$ 10", "R$ 20", "R$ 50", "R$ 100"];
const sorteados = [];
const relatorio = JSON.parse(localStorage.getItem('relatorio')) || [];

let animacaoNome;
let animacaoValor;
let anguloInicialNome = 0;
let anguloInicialValor = 0;
const velocidadeInicial = 0.15;
const desaceleracao = 0.003;
let velocidadeNome = 0;
let velocidadeValor = 0;
let nomeSorteado = null;
let valorSorteado = null;
let isGirando = false;

function mostrar(id) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    if (id === 'relatorio') preencherTabela();
    if (id === 'roletas') {
        desenharRoleta('roletaNomes', nomes, sorteados, 0);
        desenharRoleta('roletaValores', valoresFixos, [], 0);
    }
}

function resetar() {
    sorteados.length = 0;
    alert("Nomes resetados.");
    desenharRoleta('roletaNomes', nomes, sorteados, 0);
}

document.getElementById('csvInput').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = () => {
        nomes.length = 0;
        reader.result.split('\n').slice(1).forEach(l => {
            const nome = l.trim();
            if (nome) nomes.push(nome);
        });
        desenharRoleta('roletaNomes', nomes, sorteados, 0);
    };
    reader.readAsText(e.target.files[0]);
});

function sortearAmbos() {
    if (isGirando) return;
    isGirando = true;
    document.getElementById('resultadoNome').innerText = "";
    document.getElementById('resultadoValor').innerText = "";
    nomeSorteado = null;
    valorSorteado = null;

    if (!nomes.length) {
        alert("Importe nomes primeiro.");
        isGirando = false;
        return;
    }

    const dispNomes = nomes.filter(n => !sorteados.includes(n));
    if (!dispNomes.length) {
        alert("Todos os nomes foram sorteados.");
        isGirando = false;
        return;
    }

    const indiceNomeSorteado = Math.floor(Math.random() * dispNomes.length);
    nomeSorteado = dispNomes[indiceNomeSorteado];
    const indiceValorSorteado = Math.floor(Math.random() * valoresFixos.length);
    valorSorteado = valoresFixos[indiceValorSorteado];

    const numSpinsNome = 5 + Math.random() * 3;
    const numSpinsValor = 5 + Math.random() * 3;

    const anguloFinalNome = (indiceNomeSorteado / nomes.length) * 2 * Math.PI + numSpinsNome * 2 * Math.PI;
    const anguloFinalValor = (indiceValorSorteado / valoresFixos.length) * 2 * Math.PI + numSpinsValor * 2 * Math.PI;

    velocidadeNome = velocidadeInicial;
    velocidadeValor = velocidadeInicial;
    anguloInicialNome = 0;
    anguloInicialValor = 0;

    tocarSom('somGiro');
    animarRoletas(anguloFinalNome, anguloFinalValor);
}

function animarRoletas(anguloFinalNome, anguloFinalValor) {
    animacaoNome = requestAnimationFrame(() => {
        anguloInicialNome += velocidadeNome;
        velocidadeNome = Math.max(0, velocidadeNome - desaceleracao);
        desenharRoleta('roletaNomes', nomes, sorteados, anguloInicialNome);

        anguloInicialValor += velocidadeValor;
        velocidadeValor = Math.max(0, velocidadeValor - desaceleracao);
        desenharRoleta('roletaValores', valoresFixos, [], anguloInicialValor);

        if (velocidadeNome > 0 || velocidadeValor > 0) {
            animarRoletas(anguloFinalNome, anguloFinalValor);
        } else {
            finalizarSorteio();
        }
    });
}

function finalizarSorteio() {
    isGirando = false;
    document.getElementById('resultadoNome').innerText = nomeSorteado;
    document.getElementById('resultadoValor').innerText = valorSorteado;
    tocarSom('somResultado');

    sorteados.push(nomeSorteado);
    desenharRoleta('roletaNomes', nomes, sorteados, 0); // Redesenha sem ângulo para parar na posição final

    const resultado = { nome: nomeSorteado, valor: valorSorteado, pago: false };
    relatorio.push(resultado);
    localStorage.setItem('relatorio', JSON.stringify(relatorio));
    preencherTabela();
}

function desenharRoleta(canvasId, itens, excluidos, anguloRotacao = 0) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const centroX = canvas.width / 2;
    const centroY = canvas.height / 2;
    const raio = Math.min(centroX, centroY) - 10;
    const numItens = itens.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!numItens) return;

    const angItem = (2 * Math.PI) / numItens;

    for (let i = 0; i < numItens; i++) {
        const startAngle = i * angItem + anguloRotacao;
        const endAngle = (i + 1) * angItem + anguloRotacao;

        ctx.beginPath();
        ctx.moveTo(centroX, centroY);
        ctx.fillStyle = excluidos.includes(itens[i]) ? '#ccc' : '#fff';
        ctx.arc(centroX, centroY, raio, startAngle, endAngle);
        ctx.fill();
        ctx.stroke();

        const textoAngulo = startAngle + angItem / 2;
        const x = centroX + Math.cos(textoAngulo) * (raio * 0.7);
        const y = centroY + Math.sin(textoAngulo) * (raio * 0.7);
        ctx.fillStyle = '#000';
        ctx.font = '10px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText(itens[i].slice(0, 12), x, y);
    }

    // Desenhar a seta
    ctx.beginPath();
    ctx.moveTo(centroX, 20);
    ctx.lineTo(centroX - 10, 40);
    ctx.lineTo(centroX + 10, 40);
    ctx.fillStyle = 'red';
    ctx.fill();
}

function preencherTabela() {
    const tbody = document.getElementById('tabelaRelatorio');
    tbody.innerHTML = '';
    relatorio.forEach((r, i) => {
        const tr = document.createElement('tr');
        if (r.pago) tr.classList.add('pago');
        tr.innerHTML = `<td>${r.nome || '-'}</td><td>${r.valor || '-'}</td>
            <td><input type='checkbox' ${r.pago ? 'checked' : ''} onchange='marcarPago(${i}, this.checked)'></td>`;
        tbody.appendChild(tr);
    });
}

function marcarPago(index, check) {
    relatorio[index].pago = check;
    localStorage.setItem('relatorio', JSON.stringify(relatorio));
    preencherTabela();
}

function tocarSom(idAudio) {
    const som = document.getElementById(idAudio);
    som.currentTime = 0;
    som.play();
}

mostrar('inicio');