// =========================================================
// PERFIL.JS — Lógica EXCLUSIVA de la vista de perfil propio
// (Sesión, sidebar, carrusel, reacciones y comentarios los
//  maneja inicio.js, que se carga antes que este archivo)
// =========================================================

const API_BASE = 'https://tu-uni.onrender.com';
let datosPerfilActual = null; // guardamos aquí lo que devuelve ApiObtenerUsuario

document.addEventListener("DOMContentLoaded", function () {
    const idUsuario = localStorage.getItem('idUsuario');
    if (!idUsuario) return; // inicio.js ya redirige si no hay sesión

    cargarPerfilCompleto(idUsuario);
    cargarPublicacionesPerfil();

    // --- PESTAÑAS (Post / Fotos / Respuestas) ---
    const tabs = document.querySelectorAll('.profile-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filtrarGridPorTab(this.dataset.tab);
        });
    });

    // --- BOTÓN DE EDITAR PERFIL (el lápiz) ---
    const btnEdit = document.getElementById('btnEditProfile');
    if (btnEdit) {
        btnEdit.addEventListener('click', abrirModalEditarPerfil);
    }

    // --- CLICK EN CONTADORES PARA ABRIR LISTAS ---
    const statSeguidores = document.getElementById('profileSeguidores');
    const statSeguidos = document.getElementById('profileSeguidos');
    if (statSeguidores) {
        statSeguidores.closest('div').style.cursor = 'pointer';
        statSeguidores.closest('div').addEventListener('click', () => abrirModalListaUsuarios('seguidores', idUsuario));
    }
    if (statSeguidos) {
        statSeguidos.closest('div').style.cursor = 'pointer';
        statSeguidos.closest('div').addEventListener('click', () => abrirModalListaUsuarios('seguidos', idUsuario));
    }
});

// =========================================================
// 1. LLENAR LA TARJETA GRANDE DE PERFIL
// =========================================================
function cargarPerfilCompleto(idUsuario) {
    fetch(`${API_BASE}/ApiObtenerUsuario?id=${idUsuario}&idUsuarioSesion=${idUsuario}`)
        .then(response => {
            if (!response.ok) throw new Error("Error en la respuesta del servidor");
            return response.json();
        })
        .then(usuario => {
            datosPerfilActual = usuario;

            const set = (id, valor) => {
                const el = document.getElementById(id);
                if (el) el.innerText = valor ?? '';
            };
            const setSrc = (id, valor) => {
                const el = document.getElementById(id);
                if (el) el.src = valor || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
            };

            setSrc('profileAvatar', usuario.foto);
            set('profileNombre', usuario.nombre);
            set('profileUsername', '@' + (usuario.usuario || usuario.nombre || 'usuario'));
            set('profileCorreo', usuario.correo);
            set('profileSeguidores', usuario.seguidores || 0);
            set('profileSeguidos', usuario.seguidos || 0);
            set('profilePostsCount', usuario.totalPosts || 0);
            set('profileBio', usuario.bio && usuario.bio.trim() !== "" ? usuario.bio : 'Este usuario aún no ha escrito una biografía.');
            set('profileCarrera', usuario.carrera && usuario.carrera.trim() !== "" ? usuario.carrera : 'Carrera no especificada');
            set('profileCuatrimestre', usuario.cuatrimestre && usuario.cuatrimestre.trim() !== "" ? usuario.cuatrimestre : 'Cuatrimestre no especificado');
        })
        .catch(error => {
            console.error("Error al cargar la ficha de perfil:", error);
        });
}

// =========================================================
// 2. CARGAR SOLO LAS PUBLICACIONES DEL USUARIO EN #perfilGrid
// =========================================================
function cargarPublicacionesPerfil() {
    const contenedor = document.getElementById('perfilGrid');
    if (!contenedor) return;

    const idUsuarioActual = String(localStorage.getItem('idUsuario') || "1").trim();

    fetch(`${API_BASE}/ApiObtenerPublicaciones?idUsuario=${idUsuarioActual}`)
        .then(response => {
            if (!response.ok) throw new Error("Status HTTP erróneo: " + response.status);
            return response.json();
        })
        .then(publicaciones => {
            if (!Array.isArray(publicaciones)) {
                publicaciones = publicaciones ? [publicaciones] : [];
            }

            const misPosts = publicaciones.filter(pub => {
                const idCreador = pub.ID_Usuario || pub.idUsuario || pub.id_usuario;
                return idCreador === undefined || idCreador === null
                    ? true
                    : String(idCreador).trim() === idUsuarioActual;
            });

            if (misPosts.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center; grid-column: 1/-1; padding: 40px; color: #666;">
                        <p style="font-size: 16px; font-weight: 500;">Aún no tienes publicaciones.</p>
                    </div>`;
                return;
            }

            // true = mostrar controles de edición/eliminación (es tu propio perfil)
            contenedor.innerHTML = misPosts.map(pub => construirTarjetaPost(pub, idUsuarioActual, true)).join('');
        })
        .catch(error => {
            console.error("Error al cargar publicaciones del perfil:", error);
        });
}

// =========================================================
// 3. FILTRO DE PESTAÑAS
// =========================================================
function filtrarGridPorTab(tipo) {
    const cards = document.querySelectorAll('#perfilGrid .card');
    const tipoNormalizado = (tipo || 'TODOS').toUpperCase().trim();
    cards.forEach(card => {
        if (tipoNormalizado === 'TODOS') {
            card.style.display = '';
        } else {
            card.style.display = (card.dataset.tipo === tipoNormalizado) ? '' : 'none';
        }
    });
}

// =========================================================
// 4. MODAL: EDITAR PERFIL
// =========================================================
function abrirModalEditarPerfil() {
    if (!datosPerfilActual) return;

    const overlay = document.getElementById('modalOverlay');
    const contenido = document.getElementById('modalContent');
    if (!overlay || !contenido) return;

    contenido.innerHTML = `
        <h3 style="margin-top:0;">Editar perfil</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size:13px; font-weight:600; color:#333;">
                Nombre
                <input type="text" id="editNombre" value="${datosPerfilActual.nombre || ''}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                URL de foto de perfil
                <input type="text" id="editFoto" value="${datosPerfilActual.foto || ''}" placeholder="https://..." style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                Biografía
                <textarea id="editBio" rows="3" maxlength="200" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; resize:vertical;">${datosPerfilActual.bio || ''}</textarea>
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                Carrera
                <input type="text" id="editCarrera" value="${datosPerfilActual.carrera || ''}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                Cuatrimestre
                <input type="text" id="editCuatrimestre" value="${datosPerfilActual.cuatrimestre || ''}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <button id="btnGuardarPerfil" style="background:#3b5998; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:8px;">
                Guardar cambios
            </button>
            <p id="editPerfilError" style="color:#e74c3c; font-size:13px; margin:0; display:none;"></p>
        </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('btnGuardarPerfil').addEventListener('click', guardarEdicionPerfil);

    const btnClose = document.getElementById('modalClose');
    if (btnClose) {
        btnClose.onclick = () => { overlay.style.display = 'none'; };
    }
}

function guardarEdicionPerfil() {
    const idUsuario = localStorage.getItem('idUsuario');
    const nombre = document.getElementById('editNombre').value.trim();
    const foto = document.getElementById('editFoto').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const carrera = document.getElementById('editCarrera').value.trim();
    const cuatrimestre = document.getElementById('editCuatrimestre').value.trim();
    const errorEl = document.getElementById('editPerfilError');

    const params = new URLSearchParams();
    params.append('idUsuarioSesion', idUsuario);
    params.append('idUsuario', idUsuario);
    params.append('nombre', nombre);
    params.append('foto', foto);
    params.append('bio', bio);
    params.append('carrera', carrera);
    params.append('cuatrimestre', cuatrimestre);

    fetch(`${API_BASE}/ApiActualizarPerfil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('modalOverlay').style.display = 'none';
            cargarPerfilCompleto(idUsuario);
            cargarDatosUsuario(idUsuario); // refresca también el sidebar (función de inicio.js)
        } else {
            errorEl.innerText = data.message || 'No se pudo actualizar el perfil.';
            errorEl.style.display = 'block';
        }
    })
    .catch(error => {
        console.error("Error al actualizar perfil:", error);
        errorEl.innerText = 'Error de conexión con el servidor.';
        errorEl.style.display = 'block';
    });
}

// =========================================================
// 5. MODAL: LISTA DE SEGUIDORES / SEGUIDOS
// =========================================================
function abrirModalListaUsuarios(tipo, idUsuarioObjetivo) {
    const overlay = document.getElementById('modalOverlay');
    const contenido = document.getElementById('modalContent');
    if (!overlay || !contenido) return;

    const idUsuarioSesion = localStorage.getItem('idUsuario') || "1";
    const endpoint = tipo === 'seguidores' ? 'ApiObtenerSeguidores' : 'ApiObtenerSeguidos';
    const titulo = tipo === 'seguidores' ? 'Seguidores' : 'Seguidos';

    contenido.innerHTML = `
        <h3 style="margin-top:0;">${titulo}</h3>
        <div id="listaUsuariosModal" style="max-height:400px; overflow-y:auto;">
            <p style="text-align:center; color:#888; font-size:14px;">Cargando...</p>
        </div>
    `;
    overlay.style.display = 'flex';

    const btnClose = document.getElementById('modalClose');
    if (btnClose) {
        btnClose.onclick = () => { overlay.style.display = 'none'; };
    }

    fetch(`${API_BASE}/${endpoint}?idUsuario=${idUsuarioObjetivo}&idUsuarioActual=${idUsuarioSesion}`)
        .then(response => response.json())
        .then(usuarios => {
            const lista = document.getElementById('listaUsuariosModal');
            if (!Array.isArray(usuarios) || usuarios.length === 0) {
                lista.innerHTML = `<p style="text-align:center; color:#999; font-size:13px; padding:20px 0;">No hay ${titulo.toLowerCase()} por mostrar.</p>`;
                return;
            }

            lista.innerHTML = usuarios.map(u => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 4px; border-bottom:1px solid #f3f4f6;">
                    <a href="/html/vent/perfilAjeno.html?id=${u.idUsuario}" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit;">
                        <img src="${u.foto || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight:600; font-size:14px; color:#111;">${u.nombre}</div>
                            <div style="font-size:12px; color:#888;">@${u.usuario}</div>
                        </div>
                    </a>
                    ${String(u.idUsuario) === String(idUsuarioSesion) ? '' : `
                        <button class="btn-toggle-seguir" data-id="${u.idUsuario}" data-activo="${u.loSigo}"
                            style="padding:6px 14px; border-radius:8px; border:none; cursor:pointer; font-size:12px; font-weight:600;
                            background:${u.loSigo ? '#eee' : '#3b5998'}; color:${u.loSigo ? '#333' : '#fff'};">
                            ${u.loSigo ? 'Siguiendo' : 'Seguir'}
                        </button>
                    `}
                </div>
            `).join('');

            lista.querySelectorAll('.btn-toggle-seguir').forEach(btn => {
                btn.addEventListener('click', function () {
                    toggleSeguir(this.dataset.id, this);
                });
            });
        })
        .catch(error => {
            console.error(`Error al cargar ${tipo}:`, error);
            document.getElementById('listaUsuariosModal').innerHTML =
                `<p style="text-align:center; color:#e74c3c; font-size:13px;">Error al conectar con el servidor.</p>`;
        });
}

// =========================================================
// 6. SEGUIR / DEJAR DE SEGUIR (reutilizable desde cualquier vista)
// =========================================================
function toggleSeguir(idSeguido, boton) {
    const idSeguidor = localStorage.getItem('idUsuario') || "1";
    if (String(idSeguidor) === String(idSeguido)) return;

    const params = new URLSearchParams();
    params.append('idSeguidor', idSeguidor);
    params.append('idSeguido', idSeguido);

    fetch(`${API_BASE}/ApiSeguirUsuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success' && boton) {
            boton.dataset.activo = data.activo;
            boton.innerText = data.activo ? 'Siguiendo' : 'Seguir';
            boton.style.background = data.activo ? '#eee' : '#3b5998';
            boton.style.color = data.activo ? '#333' : '#fff';
        }
    })
    .catch(error => console.error("Error al seguir/dejar de seguir:", error));
}

// =========================================================
// 7. PLANTILLA DE TARJETA (con botón Editar si es tu perfil)
// =========================================================
function construirTarjetaPost(pub, usuarioActual, esMiPerfilVista) {
    const inicialAutor = pub.usuario ? pub.usuario.charAt(0).toUpperCase() : 'U';
    const idPub = pub.ID_Publicacion || pub.idPublicacion || pub.id_publicacion || '';

    const imagenPublicacion = pub.imagen && pub.imagen.trim() !== ""
        ? `<img src="${pub.imagen}" class="card-img" alt="${pub.titulo}">`
        : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;background:#eef1f6;color:#aaa;font-size:12px;height:180px;">Sin imagen adjunta</div>`;

    let tipoVisual = pub.tipo ? pub.tipo.toUpperCase().trim() : 'FORO';
    if (['GENERAL', 'PUBLICACION', 'FORO'].includes(tipoVisual)) tipoVisual = 'FORO';
    else if (['PROMOCION', 'VENTA', 'VENTAS'].includes(tipoVisual)) tipoVisual = 'VENTAS';
    else if (['AVISO', 'AVISOS'].includes(tipoVisual)) tipoVisual = 'AVISO';

    const yaDioLike = pub.miLike === true || pub.miLike === 1;
    const yaEsFavorito = pub.miFavorito === true || pub.miFavorito === 1;

    let botonesAutorHTML = '';
    if (esMiPerfilVista) {
        botonesAutorHTML = `
            <button class="btn-editar-pub" onclick='abrirModalEditarPost(${JSON.stringify({
                id: idPub, titulo: pub.titulo, descripcion: pub.descripcion, imagen: pub.imagen || '', tipo: tipoVisual,
                precio: pub.precio || pub.Precio || '', categoria: pub.categoria || pub.Categoria || 'OTROS',
                lugar: pub.lugar || pub.Lugar || '', hora: pub.hora || pub.Hora || ''
            })})' style="background:none; border:none; color:#3b5998; cursor:pointer; padding:5px; font-weight:bold; font-size:13px;">
                Editar
            </button>
            <button class="btn-eliminar-pub" data-id="${idPub}" onclick="eliminarPublicacion(this)" style="background:none; border:none; color:#e74c3c; cursor:pointer; padding:5px; font-weight:bold; font-size:13px;">
                Eliminar
            </button>
        `;
    }

    return `
        <div class="card" data-tipo="${tipoVisual}" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.04);display:flex;flex-direction:column;justify-content:space-between;">
            ${imagenPublicacion}
            <div class="card-body" style="padding:16px;display:flex;flex-direction:column;justify-content:space-between;flex-grow:1;">
                <div>
                    <div class="card-icons" style="display:flex;align-items:center;margin-bottom:12px;">
                        <span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#666;font-weight:600;">${tipoVisual}</span>
                        <span style="font-size:12px;color:#888;margin-left:8px;">• ${pub.fecha ? pub.fecha.substring(0, 10) : 'Recién'}</span>
                        <div class="interacciones-top">
                            <button class="btn-mini-accion btn-like ${yaDioLike ? 'activo-like' : ''}" onclick="reaccionar('like', ${idPub}, this)" title="Me gusta">
                                <span>❤️</span><span class="contador-mini contador">${pub.totalLikes || 0}</span>
                            </button>
                            <button class="btn-mini-accion btn-comentario" onclick="abrirModalComentarios(${idPub})" title="Comentar">
                                <span>💬</span><span class="contador-mini contador">${pub.totalComentarios || 0}</span>
                            </button>
                            <button class="btn-mini-accion btn-favorito ${yaEsFavorito ? 'activo-favorito' : ''}" onclick="reaccionar('favorito', ${idPub}, this)" title="Añadir a favoritos">
                                <span>⭐</span><span class="contador-mini contador">${pub.totalFavoritos || 0}</span>
                            </button>
                        </div>
                    </div>
                    <h3 class="card-title" style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#111;">${pub.titulo}</h3>
                    <p class="card-desc" style="font-size:14px;color:#555;line-height:1.5;margin-bottom:16px;">${pub.descripcion}</p>
                </div>
                <div class="card-author" style="border-top:1px solid #f3f4f6;padding-top:12px;display:flex;align-items:center;justify-content:space-between;">
                    <div class="author-left" style="display:flex;align-items:center;gap:8px;">
                        <img src="${pub.fotoPerfil || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="avatar-letter" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                        <div class="avatar-letter" style="background-color:#3b5998;width:28px;height:28px;border-radius:50%;display:none;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold;">${inicialAutor}</div>
                        <span style="font-size:13px;font-weight:600;color:#333;">${pub.usuario || 'Anónimo'}</span>
                    </div>
                    <div class="author-right" style="display:flex;align-items:center;gap:6px;">
                        ${botonesAutorHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =========================================================
// 8. MODAL: EDITAR PUBLICACIÓN
// =========================================================
function abrirModalEditarPost(post) {
    const overlay = document.getElementById('modalOverlay');
    const contenido = document.getElementById('modalContent');
    if (!overlay || !contenido) return;

    const categoriasOpciones = Object.entries(typeof CATEGORIAS_VENTA !== 'undefined' ? CATEGORIAS_VENTA : {
        COMIDA: 'Comida y bebidas', ROPA: 'Ropa y accesorios', TECNOLOGIA: 'Tecnología',
        SERVICIOS: 'Servicios', PAPELERIA: 'Papelería y útiles', HOGAR: 'Hogar', OTROS: 'Otros'
    }).map(([valor, etiqueta]) => `<option value="${valor}" ${post.categoria === valor ? 'selected' : ''}>${etiqueta}</option>`).join('');

    contenido.innerHTML = `
        <h3 style="margin-top:0;">Editar publicación</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="font-size:13px; font-weight:600; color:#333;">
                Título
                <input type="text" id="editPostTitulo" value="${(post.titulo || '').replace(/"/g, '&quot;')}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                Descripción
                <textarea id="editPostDescripcion" rows="4" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; resize:vertical;">${post.descripcion || ''}</textarea>
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                URL de imagen (opcional)
                <input type="text" id="editPostImagen" value="${(post.imagen || '').replace(/"/g, '&quot;')}" placeholder="https://..." style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
            </label>
            <label style="font-size:13px; font-weight:600; color:#333;">
                Tipo
                <select id="editPostTipo" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                    <option value="FORO" ${post.tipo === 'FORO' ? 'selected' : ''}>Foro</option>
                    <option value="VENTAS" ${post.tipo === 'VENTAS' ? 'selected' : ''}>Ventas</option>
                    <option value="EVENTOS" ${post.tipo === 'EVENTOS' ? 'selected' : ''}>Evento</option>
                    <option value="AVISO" ${post.tipo === 'AVISO' ? 'selected' : ''}>Aviso</option>
                </select>
            </label>

            <div id="editCamposVenta" style="display:${post.tipo === 'VENTAS' ? 'flex' : 'none'}; flex-direction:column; gap:12px;">
                <label style="font-size:13px; font-weight:600; color:#333;">
                    Precio ($ MXN)
                    <input type="number" id="editPostPrecio" value="${post.precio || ''}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                </label>
                <label style="font-size:13px; font-weight:600; color:#333;">
                    Tipo de producto
                    <select id="editPostCategoria" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                        ${categoriasOpciones}
                    </select>
                </label>
            </div>

            <div id="editCamposEvento" style="display:${post.tipo === 'EVENTOS' ? 'flex' : 'none'}; flex-direction:column; gap:12px;">
                <label style="font-size:13px; font-weight:600; color:#333;">
                    Lugar del evento
                    <input type="text" id="editPostLugar" value="${(post.lugar || '').replace(/"/g, '&quot;')}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                </label>
                <label style="font-size:13px; font-weight:600; color:#333;">
                    Fecha y hora
                    <input type="datetime-local" id="editPostHora" value="${post.hora || ''}" style="width:100%; padding:8px; margin-top:4px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box;">
                </label>
            </div>

            <button id="btnGuardarPost" data-id="${post.id}" style="background:#3b5998; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:8px;">
                Guardar cambios
            </button>
            <p id="editPostError" style="color:#e74c3c; font-size:13px; margin:0; display:none;"></p>
        </div>
    `;

    overlay.style.display = 'flex';
    document.getElementById('btnGuardarPost').addEventListener('click', guardarEdicionPost);

    const selectTipo = document.getElementById('editPostTipo');
    const camposVenta = document.getElementById('editCamposVenta');
    const camposEvento = document.getElementById('editCamposEvento');
    if (selectTipo) {
        selectTipo.addEventListener('change', function () {
            const valor = selectTipo.value;
            if (camposVenta) camposVenta.style.display = (valor === 'VENTAS') ? 'flex' : 'none';
            if (camposEvento) camposEvento.style.display = (valor === 'EVENTOS') ? 'flex' : 'none';
        });
    }

    const btnClose = document.getElementById('modalClose');
    if (btnClose) {
        btnClose.onclick = () => { overlay.style.display = 'none'; };
    }
}

function guardarEdicionPost() {
    const idUsuarioSesion = localStorage.getItem('idUsuario');
    const idPublicacion = document.getElementById('btnGuardarPost').dataset.id;
    const titulo = document.getElementById('editPostTitulo').value.trim();
    const descripcion = document.getElementById('editPostDescripcion').value.trim();
    const imagen = document.getElementById('editPostImagen').value.trim();
    const tipo = document.getElementById('editPostTipo').value;
    const errorEl = document.getElementById('editPostError');

    const params = new URLSearchParams();
    params.append('idUsuarioSesion', idUsuarioSesion);
    params.append('idPublicacion', idPublicacion);
    params.append('titulo', titulo);
    params.append('descripcion', descripcion);
    params.append('imagen', imagen);
    params.append('tipo', tipo);

    if (tipo === 'VENTAS') {
        const precioEl = document.getElementById('editPostPrecio');
        const categoriaEl = document.getElementById('editPostCategoria');
        params.append('precio', precioEl ? precioEl.value.trim() : '');
        params.append('categoria', categoriaEl ? categoriaEl.value : 'OTROS');
    } else if (tipo === 'EVENTOS') {
        const lugarEl = document.getElementById('editPostLugar');
        const horaEl = document.getElementById('editPostHora');
        params.append('lugar', lugarEl ? lugarEl.value.trim() : '');
        params.append('hora', horaEl ? horaEl.value.trim() : '');
    }

    fetch(`${API_BASE}/ApiEditarPublicacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            document.getElementById('modalOverlay').style.display = 'none';
            cargarPublicacionesPerfil();
        } else {
            errorEl.innerText = data.message || 'No se pudo actualizar la publicación.';
            errorEl.style.display = 'block';
        }
    })
    .catch(error => {
        console.error("Error al editar publicación:", error);
        errorEl.innerText = 'Error de conexión con el servidor.';
        errorEl.style.display = 'block';
    });
}