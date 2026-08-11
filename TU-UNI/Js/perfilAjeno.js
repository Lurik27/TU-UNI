// =========================================================
// PERFILAJENO.JS — Ver el perfil de OTRO usuario
// (Sesión, sidebar, carrusel, reacciones y comentarios los
//  maneja inicio.js, que se carga antes que este archivo)
// =========================================================

const API_BASE = 'https://tu-uni.onrender.com';
let idPerfilVisitado = null;

document.addEventListener("DOMContentLoaded", function () {
    const idUsuarioSesion = localStorage.getItem('idUsuario');
    if (!idUsuarioSesion) return; // inicio.js ya redirige si no hay sesión

    // --- LEER ?id=X DE LA URL ---
    const params = new URLSearchParams(window.location.search);
    idPerfilVisitado = params.get('id');

    if (!idPerfilVisitado) {
        console.warn("No se especificó qué perfil cargar. Regresando a inicio.");
        window.location.href = "/html/vent/inicio.html";
        return;
    }

    // Si el usuario entra a su propio perfil por este enlace, lo mandamos al perfil real (con edición)
    if (String(idPerfilVisitado).trim() === String(idUsuarioSesion).trim()) {
        window.location.href = "/html/vent/perfil.html";
        return;
    }

    cargarPerfilAjenoCompleto(idPerfilVisitado, idUsuarioSesion);
    cargarPublicacionesPerfilAjeno(idPerfilVisitado);

    // --- PESTAÑAS ---
    const tabs = document.querySelectorAll('.profile-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            filtrarGridPorTab(this.dataset.tab);
        });
    });

    // --- CLICK EN CONTADORES PARA ABRIR LISTAS ---
    const statSeguidores = document.getElementById('profileSeguidores');
    const statSeguidos = document.getElementById('profileSeguidos');
    if (statSeguidores) {
        statSeguidores.closest('div').style.cursor = 'pointer';
        statSeguidores.closest('div').addEventListener('click', () => abrirModalListaUsuarios('seguidores', idPerfilVisitado));
    }
    if (statSeguidos) {
        statSeguidos.closest('div').style.cursor = 'pointer';
        statSeguidos.closest('div').addEventListener('click', () => abrirModalListaUsuarios('seguidos', idPerfilVisitado));
    }
});

// =========================================================
// 1. LLENAR LA TARJETA GRANDE DE PERFIL + BOTÓN SEGUIR
// =========================================================
function cargarPerfilAjenoCompleto(idPerfil, idUsuarioSesion) {
    fetch(`${API_BASE}/ApiObtenerUsuario?id=${idPerfil}&idUsuarioSesion=${idUsuarioSesion}`)
        .then(response => {
            if (!response.ok) throw new Error("Error en la respuesta del servidor");
            return response.json();
        })
        .then(usuario => {
            // Si volvió a resultar ser tu propio perfil (ej. buscaste por username), redirige
            if (usuario.esMiPerfil) {
                window.location.href = "/html/vent/perfil.html";
                return;
            }

            // Guardamos el ID real (por si se buscó por username en la URL)
            idPerfilVisitado = usuario.idUsuario;

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

            // --- Configurar botón Seguir ---
            const btnSeguir = document.getElementById('btnSeguirPerfil');
            if (btnSeguir) {
                pintarBotonSeguir(btnSeguir, usuario.yaLoSigo);
                btnSeguir.onclick = () => toggleSeguirPerfil(btnSeguir);
            }
        })
        .catch(error => {
            console.error("Error al cargar el perfil ajeno:", error);
        });
}

function pintarBotonSeguir(boton, activo) {
    boton.dataset.activo = activo;
    boton.innerText = activo ? 'Siguiendo' : 'Seguir';
    boton.style.background = activo ? '#eee' : '#3b5998';
    boton.style.color = activo ? '#333' : '#fff';
}

function toggleSeguirPerfil(boton) {
    const idSeguidor = localStorage.getItem('idUsuario') || "1";
    const idSeguido = idPerfilVisitado;

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
        if (data.status === 'success') {
            pintarBotonSeguir(boton, data.activo);
            const statSeguidores = document.getElementById('profileSeguidores');
            if (statSeguidores) statSeguidores.innerText = data.nuevosSeguidores;
        }
    })
    .catch(error => console.error("Error al seguir/dejar de seguir:", error));
}

// =========================================================
// 2. CARGAR SOLO LAS PUBLICACIONES DE ESE USUARIO
// =========================================================
function cargarPublicacionesPerfilAjeno(idPerfil) {
    const contenedor = document.getElementById('perfilGrid');
    if (!contenedor) return;

    const idUsuarioSesion = localStorage.getItem('idUsuario') || "1";

    fetch(`${API_BASE}/ApiObtenerPublicaciones?idUsuario=${idUsuarioSesion}`)
        .then(response => {
            if (!response.ok) throw new Error("Status HTTP erróneo: " + response.status);
            return response.json();
        })
        .then(publicaciones => {
            if (!Array.isArray(publicaciones)) {
                publicaciones = publicaciones ? [publicaciones] : [];
            }

            const postsDeEsteUsuario = publicaciones.filter(pub => {
                const idCreador = pub.ID_Usuario || pub.idUsuario || pub.id_usuario;
                return String(idCreador).trim() === String(idPerfil).trim();
            });

            if (postsDeEsteUsuario.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center; grid-column: 1/-1; padding: 40px; color: #666;">
                        <p style="font-size: 16px; font-weight: 500;">Este usuario aún no tiene publicaciones.</p>
                    </div>`;
                return;
            }

            // false = SIN controles de editar/eliminar (no es tu perfil)
            contenedor.innerHTML = postsDeEsteUsuario.map(pub => construirTarjetaPost(pub, idUsuarioSesion, false)).join('');
        })
        .catch(error => {
            console.error("Error al cargar publicaciones del perfil ajeno:", error);
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
// 4. MODAL: LISTA DE SEGUIDORES / SEGUIDOS (idéntico a perfil.js)
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
                    toggleSeguirDesdeModal(this.dataset.id, this);
                });
            });
        })
        .catch(error => {
            console.error(`Error al cargar ${tipo}:`, error);
            document.getElementById('listaUsuariosModal').innerHTML =
                `<p style="text-align:center; color:#e74c3c; font-size:13px;">Error al conectar con el servidor.</p>`;
        });
}

function toggleSeguirDesdeModal(idSeguido, boton) {
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
        if (data.status === 'success') {
            boton.dataset.activo = data.activo;
            boton.innerText = data.activo ? 'Siguiendo' : 'Seguir';
            boton.style.background = data.activo ? '#eee' : '#3b5998';
            boton.style.color = data.activo ? '#333' : '#fff';

            // Si estoy viendo la lista de seguidores del perfil que visito y me acabo de agregar/quitar,
            // refrescamos el botón principal también, por si coincide.
            const btnPrincipal = document.getElementById('btnSeguirPerfil');
            if (btnPrincipal && String(idSeguido) === String(idPerfilVisitado)) {
                pintarBotonSeguir(btnPrincipal, data.activo);
            }
        }
    })
    .catch(error => console.error("Error al seguir/dejar de seguir:", error));
}

// =========================================================
// 5. PLANTILLA DE TARJETA (SIN controles de editar/eliminar)
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

    // esMiPerfilVista siempre llega false desde este archivo, así que nunca se pintan
    // los botones de Editar/Eliminar en el perfil de otro usuario.
    let botonesAutorHTML = '';
    if (esMiPerfilVista) {
        botonesAutorHTML = `
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