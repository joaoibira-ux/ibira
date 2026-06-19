const colClientes = db.collection("clientes");
let clientesCache = {};
let clienteEditando = null;

colClientes.orderBy("nome").onSnapshot(snap => {
  const clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(clientes);
});

function render(clientes) {
  const lista = document.getElementById("lista");
  clientesCache = {};

  if (clientes.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhum cliente cadastrado</div>';
    return;
  }

  lista.innerHTML = clientes.map(c => {
    clientesCache[c.id] = c;
    let loc = "";
    if (c.latitude != null && c.longitude != null) {
      loc = `<a class="card-loc" target="_blank" href="https://www.google.com/maps?q=${c.latitude},${c.longitude}">📍 Ver localização no mapa</a>`;
    }
    return `
      <div class="card">
        <div class="card-acoes">
          <button class="btn-edit" onclick="abrirFormulario('${c.id}')">✏️</button>
          <button class="btn-del" onclick="excluirCliente('${c.id}')">🗑️</button>
        </div>
        <div class="card-nome">${escHtml(c.nome)}</div>
        ${c.cnpj ? `<div class="card-info">🏢 ${escHtml(c.cnpj)}</div>` : ""}
        ${c.telefone ? `<div class="card-info">📞 ${escHtml(c.telefone)}</div>` : ""}
        ${c.endereco ? `<div class="card-info">🏠 ${escHtml(c.endereco)}</div>` : ""}
        ${loc}
        ${c.observacoes ? `<div class="card-obs">${escHtml(c.observacoes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function mascararCnpjCpf(input) {
  let v = input.value.replace(/\D/g, "").slice(0, 14);
  if (v.length > 11) {
    // CNPJ: 00.000.000/0000-00
    if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
    else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
    else v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  } else {
    // CPF: 000.000.000-00
    if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
    else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
    else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
  }
  input.value = v;
}

function mascararCep(input) {
  let v = input.value.replace(/\D/g, "").slice(0, 8);
  if (v.length > 5) v = v.replace(/^(\d{5})(\d{0,3})/, "$1-$2");
  input.value = v;
}

async function buscarCep() {
  const cep = document.getElementById("f-cep").value.replace(/\D/g, "");
  const status = document.getElementById("cep-status");
  if (cep.length !== 8) return;

  status.textContent = "Consultando CEP...";
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) { status.textContent = "CEP não encontrado"; return; }
    const d = await res.json();
    if (d.erro) { status.textContent = "CEP não encontrado"; return; }

    const partes = [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean);
    const endereco = partes.join(", ");
    if (endereco) document.getElementById("f-endereco").value = endereco;
    status.textContent = "Endereço preenchido";
    setTimeout(() => { status.textContent = ""; }, 3000);
  } catch {
    status.textContent = "Erro ao consultar CEP";
  }
}

async function buscarCnpj() {
  const cnpj = document.getElementById("f-cnpj").value.replace(/\D/g, "");
  const status = document.getElementById("cnpj-status");
  if (cnpj.length !== 14) return;

  status.textContent = "Consultando CNPJ...";
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!res.ok) { status.textContent = "CNPJ não encontrado"; return; }
    const d = await res.json();

    const nome = d.razao_social || "";
    const partes = [d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf].filter(Boolean);
    const endereco = partes.join(", ");

    if (nome) document.getElementById("f-nome").value = nome;
    if (d.cep) {
      const cepNum = d.cep.replace(/\D/g, "");
      document.getElementById("f-cep").value = cepNum.slice(0,5) + (cepNum.length > 5 ? "-" + cepNum.slice(5) : "");
    }
    if (endereco) document.getElementById("f-endereco").value = endereco;
    status.textContent = "Dados preenchidos automaticamente";
    setTimeout(() => { status.textContent = ""; }, 3000);
  } catch {
    status.textContent = "Erro ao consultar CNPJ";
  }
}

function abrirFormulario(id) {
  clienteEditando = id || null;
  document.getElementById("cnpj-status").textContent = "";
  document.getElementById("cep-status").textContent = "";

  if (clienteEditando) {
    const c = clientesCache[clienteEditando];
    document.getElementById("f-cnpj").value = c.cnpj || "";
    document.getElementById("f-nome").value = c.nome || "";
    document.getElementById("f-telefone").value = c.telefone || "";
    document.getElementById("f-cep").value = c.cep || "";
    document.getElementById("f-endereco").value = c.endereco || "";
    document.getElementById("f-obs").value = c.observacoes || "";
  } else {
    document.getElementById("form").reset();
  }

  document.getElementById("form-overlay").style.display = "flex";
}

function fecharFormulario() {
  document.getElementById("form-overlay").style.display = "none";
}

async function salvarCliente() {
  const nome = document.getElementById("f-nome").value.trim();
  if (!nome) { alert("Informe o nome do cliente"); return; }

  const payload = {
    cnpj: document.getElementById("f-cnpj").value.trim(),
    nome,
    telefone: document.getElementById("f-telefone").value.trim(),
    cep: document.getElementById("f-cep").value.trim(),
    endereco: document.getElementById("f-endereco").value.trim(),
    observacoes: document.getElementById("f-obs").value.trim()
  };

  if (clienteEditando) {
    await colClientes.doc(clienteEditando).update(payload);
  } else {
    payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    await colClientes.add(payload);
  }

  fecharFormulario();
}

async function excluirCliente(id) {
  if (!confirm("Excluir este cliente?")) return;
  await colClientes.doc(id).delete();
}
