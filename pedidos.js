const colPedidos = db.collection("pedidos");
const colProdutos = db.collection("produtos");
const colClientes2 = db.collection("clientes");
let clientesCache = [];
let produtosCache = [];
let pedidosCache = {};

colClientes2.orderBy("nome").onSnapshot(snap => {
  clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

colProdutos.orderBy("nome").onSnapshot(snap => {
  produtosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

colPedidos.orderBy("criadoEm", "desc").onSnapshot(snap => {
  const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(pedidos);
});

function fmtData(criadoEm) {
  if (!criadoEm) return "";
  if (criadoEm.toDate) criadoEm = criadoEm.toDate().toISOString().replace("T", " ");
  const [data, hora] = String(criadoEm).split(" ");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} ${hora ? hora.substring(0, 5) : ""}`;
}

function render(pedidos) {
  const lista = document.getElementById("lista");
  pedidosCache = {};

  if (pedidos.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhum pedido cadastrado</div>';
    return;
  }

  lista.innerHTML = pedidos.map(p => {
    pedidosCache[p.id] = p;
    const statusClasse = p.status === "Entregue" ? "entregue" : "pendente";
    const itensHtml = (p.itens || []).map(i => `
      <div class="pedido-item-linha">
        <span>${escHtml(i.produto_nome)} x ${i.quantidade}</span>
        <span>${fmtMoeda(i.subtotal)}</span>
      </div>
    `).join("");

    const pagamentoTexto = p.pagamento === "avista" ? "À vista" : p.pagamento === "receber" ? "A receber" : "";
    const pagStr = p.pagamento ? `'${p.pagamento}'` : "null";

    return `
      <div class="card" style="cursor:pointer" onclick="mostrarImpressao('${p.id}')">
        <div class="card-acoes">
          <button class="btn-del" onclick="event.stopPropagation(); excluirPedido('${p.id}')">🗑️</button>
        </div>
        <div class="card-nome">
          ${escHtml(p.cliente_nome)}
          <button class="badge-status ${statusClasse}" onclick="event.stopPropagation(); toggleStatus('${p.id}', '${p.status}', ${pagStr})">${escHtml(p.status)}</button>
        </div>
        <div class="card-meta">${fmtData(p.criadoEm)}${pagamentoTexto ? ` · ${pagamentoTexto}` : ""}</div>
        <div class="pedido-itens">${itensHtml}</div>
        <div class="pedido-total">Total: ${fmtMoeda(p.total)}</div>
        ${p.observacoes ? `<div class="card-obs">${escHtml(p.observacoes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function mostrarImpressao(id) {
  const p = pedidosCache[id];
  if (!p) return;

  const itensHtml = (p.itens || []).map(i => `
    <tr>
      <td>${escHtml(i.produto_nome)}</td>
      <td>${i.quantidade}</td>
      <td>${fmtMoeda(i.valor_unitario)}</td>
      <td>${fmtMoeda(i.subtotal)}</td>
    </tr>
  `).join("");

  const logoUrl = new URL("./icone.png", window.location.href).href;
  const janela = window.open("", "_blank");
  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Pedido - ${escHtml(p.cliente_nome)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a2e; padding: 24px; }
        .imp-cabecalho { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .imp-cabecalho img { width: 70px; height: 70px; object-fit: contain; }
        .imp-titulo { font-size: 1.3rem; font-weight: 800; color: #1a3a8f; }
        .imp-info { margin-bottom: 16px; font-size: 0.95rem; }
        .imp-info strong { color: #1a3a8f; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 0.9rem; }
        th { color: #1a3a8f; }
        td:nth-child(2), td:nth-child(3), td:nth-child(4),
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
        .imp-total { text-align: right; font-size: 1.1rem; font-weight: 700; color: #1a3a8f; }
        .imp-obs { margin-top: 16px; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="imp-cabecalho">
        <img src="${logoUrl}" alt="IBIRÁ" onerror="this.style.display='none'" />
        <div class="imp-titulo">Pedido</div>
      </div>
      <div class="imp-info">
        <div><strong>Cliente:</strong> ${escHtml(p.cliente_nome)}</div>
        <div><strong>Data:</strong> ${fmtData(p.criadoEm)}</div>
        <div><strong>Status:</strong> ${escHtml(p.status)}</div>
      </div>
      <table>
        <thead>
          <tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr>
        </thead>
        <tbody>${itensHtml}</tbody>
      </table>
      <div class="imp-total">Total: ${fmtMoeda(p.total)}</div>
      ${p.observacoes ? `<div class="imp-obs"><strong>Observações:</strong> ${escHtml(p.observacoes)}</div>` : ""}
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `);
  janela.document.close();
}

function criarLinhaItem() {
  const opcoes = produtosCache.map(prod =>
    `<option value="${prod.id}" data-valor="${prod.valor}">${escHtml(prod.nome)} (${fmtMoeda(prod.valor)})</option>`
  ).join("");

  const linha = document.createElement("div");
  linha.className = "form-item-row";
  linha.innerHTML = `
    <select class="item-produto">${opcoes}</select>
    <input type="number" step="any" min="0" class="item-qtd" value="1" />
    <button type="button" class="btn-remove-item" onclick="removerItem(this)">✕</button>
  `;
  linha.querySelector(".item-produto").addEventListener("change", recalcularTotal);
  linha.querySelector(".item-qtd").addEventListener("input", recalcularTotal);
  return linha;
}

function adicionarItem() {
  document.getElementById("itens-container").appendChild(criarLinhaItem());
  recalcularTotal();
}

function removerItem(botao) {
  botao.closest(".form-item-row").remove();
  recalcularTotal();
}

function recalcularTotal() {
  let total = 0;
  document.querySelectorAll("#itens-container .form-item-row").forEach(linha => {
    const select = linha.querySelector(".item-produto");
    const opcao = select.options[select.selectedIndex];
    const valor = opcao ? parseFloat(opcao.dataset.valor) || 0 : 0;
    const qtd = parseFloat(linha.querySelector(".item-qtd").value) || 0;
    total += valor * qtd;
  });
  document.getElementById("form-total").textContent = "Total: " + fmtMoeda(total);
}

function abrirFormulario() {
  const select = document.getElementById("f-cliente");
  select.innerHTML = clientesCache.map(c => `<option value="${c.id}">${escHtml(c.nome)}</option>`).join("");

  const container = document.getElementById("itens-container");
  container.innerHTML = "";
  if (produtosCache.length > 0) container.appendChild(criarLinhaItem());

  document.getElementById("f-obs").value = "";
  recalcularTotal();
  document.getElementById("form-overlay").style.display = "flex";
}

function fecharFormulario() {
  document.getElementById("form-overlay").style.display = "none";
}

async function salvarPedido() {
  const clienteId = document.getElementById("f-cliente").value;
  if (!clienteId) { alert("Cadastre um cliente antes de criar um pedido"); return; }

  const itensSelecionados = [];
  document.querySelectorAll("#itens-container .form-item-row").forEach(linha => {
    const produtoId = linha.querySelector(".item-produto").value;
    const quantidade = parseFloat(linha.querySelector(".item-qtd").value) || 0;
    if (produtoId && quantidade > 0) {
      const prod = produtosCache.find(p => p.id === produtoId);
      if (prod) {
        itensSelecionados.push({
          produto_id: produtoId,
          produto_nome: prod.nome,
          ud: prod.ud || null,
          valor_unitario: prod.valor,
          quantidade,
          subtotal: prod.valor * quantidade
        });
      }
    }
  });

  if (itensSelecionados.length === 0) { alert("Inclua ao menos um item com quantidade maior que zero"); return; }

  const cliente = clientesCache.find(c => c.id === clienteId);
  if (!cliente) { alert("Cliente não encontrado"); return; }

  const total = itensSelecionados.reduce((s, i) => s + i.subtotal, 0);

  const batch = db.batch();
  const pedidoRef = colPedidos.doc();
  batch.set(pedidoRef, {
    cliente_id: clienteId,
    cliente_nome: cliente.nome,
    status: "Pendente",
    total,
    observacoes: document.getElementById("f-obs").value.trim() || null,
    itens: itensSelecionados,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  itensSelecionados.forEach(item => {
    batch.update(colProdutos.doc(item.produto_id), {
      estoque: firebase.firestore.FieldValue.increment(-item.quantidade)
    });
  });

  await batch.commit();
  fecharFormulario();
}

async function toggleStatus(id, statusAtual, pagamentoAtual) {
  const novoStatus = statusAtual === "Entregue" ? "Pendente" : "Entregue";

  if (novoStatus === "Entregue" && !pagamentoAtual) {
    const pagamento = await perguntarEscolha("Pagamento do pedido", [
      { label: "À vista", value: "avista" },
      { label: "A receber", value: "receber" }
    ]);

    const pedidoSnap = await colPedidos.doc(id).get();
    const pedido = pedidoSnap.data();
    const batch = db.batch();
    batch.update(colPedidos.doc(id), { status: novoStatus, pagamento });

    if (pagamento === "avista") {
      const lancRef = db.collection("caixaLancamentos").doc();
      batch.set(lancRef, {
        data: hoje(),
        descricao: `Pedido: ${pedido.cliente_nome}`,
        tipo: "entrada",
        valor: pedido.total,
        origem: "pedido",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const recRef = db.collection("contasReceber").doc();
      batch.set(recRef, {
        pedido_id: id,
        descricao: `Pedido: ${pedido.cliente_nome}`,
        valor: pedido.total,
        status: "Pendente",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
  } else {
    await colPedidos.doc(id).update({ status: novoStatus });
  }
}

async function excluirPedido(id) {
  if (!confirm("Excluir este pedido? O estoque dos produtos será devolvido.")) return;
  const snap = await colPedidos.doc(id).get();
  const pedido = snap.data();
  const batch = db.batch();
  batch.delete(colPedidos.doc(id));
  (pedido.itens || []).forEach(item => {
    batch.update(colProdutos.doc(item.produto_id), {
      estoque: firebase.firestore.FieldValue.increment(item.quantidade)
    });
  });
  await batch.commit();
}
