
const nomes = [];
const sorteados = [];
const valores = ["R$ 10,00", "R$ 20,00", "R$ 50,00", "R$ 100,00"];
const relatorio = JSON.parse(localStorage.getItem('relatorio')) || [];

function mostrar(id) {
  document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (id === 'relatorio') preencherTabela();
  if (id === 'roleta') desenharRoleta();
}

function resetar() {
  sorteados.length = 0;
  alert("Nomes resetados para sorteio.");
}

document.getElementById('csvInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    nomes.length = 0;
    reader.result.split('\n').slice(1).forEach(linha => {
      const nome = linha.trim();
      if (nome) nomes.push(nome);
    });
    desenharRoleta();
  };
  reader.readAsText(file);
});

function sortear() {
  const disponiveis = nomes.filter(n => !sorteados.includes(n));
  if (!disponiveis.length) return alert("Todos os nomes foram sorteados!");
  const nome = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  const valor = valores[Math.floor(Math.random() * valores.length)];
  sorteados.push(nome);
  relatorio.push({ nome, valor, pago: false });
  localStorage.setItem('relatorio', JSON.stringify(relatorio));
  document.getElementById('resultado').innerText = `Sorteado: ${nome} - ${valor}`;
  desenharRoleta();
}

function desenharRoleta() {
  const canvas = document.getElementById('roletaCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const total = nomes.length;
  if (!total) return;
  const angulo = (2 * Math.PI) / total;
  nomes.forEach((nome, i) => {
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.fillStyle = sorteados.includes(nome) ? '#aaa' : '#fff';
    ctx.arc(150, 150, 140, i * angulo, (i + 1) * angulo);
    ctx.fill();
    ctx.stroke();
    const x = 150 + Math.cos(i * angulo + angulo / 2) * 100;
    const y = 150 + Math.sin(i * angulo + angulo / 2) * 100;
    ctx.fillStyle = '#000';
    ctx.font = '10px Roboto';
    ctx.fillText(nome.slice(0, 10), x - 15, y);
  });
}

function preencherTabela() {
  const corpo = document.getElementById('tabelaRelatorio');
  corpo.innerHTML = '';
  relatorio.forEach((item, i) => {
    const tr = document.createElement('tr');
    if (item.pago) tr.classList.add('pago');
    tr.innerHTML = `
      <td>${item.nome}</td>
      <td>${item.valor}</td>
      <td><input type="checkbox" ${item.pago ? 'checked' : ''} onchange="marcarPago(${i}, this.checked)"></td>
    `;
    corpo.appendChild(tr);
  });
}

function marcarPago(index, checked) {
  relatorio[index].pago = checked;
  localStorage.setItem('relatorio', JSON.stringify(relatorio));
  preencherTabela();
}

mostrar('inicio');
