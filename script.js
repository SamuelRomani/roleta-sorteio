
const nomes = [];
const valoresFixos = ["R$ 10", "R$ 20", "R$ 50", "R$ 100"];
const sorteados = [];
const relatorio = JSON.parse(localStorage.getItem('relatorio')) || [];

function mostrar(id) {
  document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (id === 'relatorio') preencherTabela();
  if (id === 'roletas') {
    desenharRoleta('roletaNomes', nomes, sorteados);
    desenharRoleta('roletaValores', valoresFixos, []);
  }
}

function resetar() {
  sorteados.length = 0;
  alert("Nomes resetados.");
}

document.getElementById('csvInput').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = () => {
    nomes.length = 0;
    reader.result.split('\n').slice(1).forEach(l => {
      const nome = l.trim();
      if (nome) nomes.push(nome);
    });
    desenharRoleta('roletaNomes', nomes, sorteados);
  };
  reader.readAsText(e.target.files[0]);
});

function tocarSom() {
  const som = document.getElementById('somGiro');
  som.currentTime = 0;
  som.play();
}

function sortearNome() {
  if (!nomes.length) return alert("Importe nomes primeiro.");
  const disp = nomes.filter(n => !sorteados.includes(n));
  if (!disp.length) return alert("Todos os nomes foram sorteados.");
  const nome = disp[Math.floor(Math.random() * disp.length)];
  sorteados.push(nome);
  desenharRoleta('roletaNomes', nomes, sorteados);
  document.getElementById('resultado').innerText = "Nome sorteado: " + nome;
  tocarSom();
}

function sortearValor() {
  const valor = valoresFixos[Math.floor(Math.random() * valoresFixos.length)];
  document.getElementById('resultado').innerText = "Valor sorteado: " + valor;
  desenharRoleta('roletaValores', valoresFixos, []);
  tocarSom();
}

function sortearAmbos() {
  sortearNome();
  setTimeout(sortearValor, 600);
}

function desenharRoleta(canvasId, itens, excluidos) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!itens.length) return;
  const ang = (2 * Math.PI) / itens.length;
  itens.forEach((item, i) => {
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.fillStyle = excluidos.includes(item) ? '#ccc' : '#fff';
    ctx.arc(150, 150, 140, i * ang, (i + 1) * ang);
    ctx.fill();
    ctx.stroke();
    const x = 150 + Math.cos(i * ang + ang / 2) * 100;
    const y = 150 + Math.sin(i * ang + ang / 2) * 100;
    ctx.fillStyle = '#000';
    ctx.font = '10px Roboto';
    ctx.fillText(item.slice(0, 12), x - 15, y);
  });
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

mostrar('inicio');
