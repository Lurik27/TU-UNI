// Variable global para almacenar el criterio de ordenamiento/filtro seleccionado
let filtroActual = 'RECIENTES';

// Variable global para el filtro de categoría de producto (solo sección VENTAS)
let filtroCategoriaActual = 'TODAS';

// Guarda un resumen de la última tanda de publicaciones renderizada,
// para no tocar el DOM cuando no hay cambios reales (evita "parpadeos").
let ultimoResumenPublicaciones = null;

// Caché en memoria de la última respuesta cruda del servidor. Cambiar el
// orden o la categoría no requiere una nueva petición HTTP: se reutiliza
// esta copia y solo se vuelve a pedir al servidor cuando de verdad hace
// falta (carga inicial, refresco periódico o tras crear/editar/eliminar).
let publicacionesCache = null;

// Catálogo único de categorías de producto para el Mercado (VENTAS).
// Se usa tanto para pintar el filtro/selector como para mostrar la
// etiqueta legible en cada tarjeta.
const CATEGORIAS_VENTA = {
    COMIDA: 'Comida y bebidas',
    ROPA: 'Ropa y accesorios',
    TECNOLOGIA: 'Tecnología',
    SERVICIOS: 'Servicios',
    PAPELERIA: 'Papelería y útiles',
    HOGAR: 'Hogar',
    OTROS: 'Otros'
};

function formatearCategoria(valor) {
    const clave = (valor || 'OTROS').toUpperCase().trim();
    return CATEGORIAS_VENTA[clave] || (valor ? valor : 'Otros');
}

// =========================================================
// DISPARADOR CENTRAL DE CARGA Y VALIDACIÓN DE SESIÓN
// =========================================================
document.addEventListener("DOMContentLoaded", function () {
    // 1. VALIDACIÓN DE SESIÓN (OBLIGATORIA)
    const idUsuario = localStorage.getItem('idUsuario');

    if (!idUsuario) {
        console.warn("No se encontró ningún ID de usuario. Redirigiendo al login...");
        window.location.href = "/Index.html"; 
        return; 
    }

    // 2. CONFIGURACIÓN Y CARGA INICIAL
    cargarDatosUsuario(idUsuario);
    cargarCarruselDinamico();
    cargarPublicaciones(true); 
    inicializarElementosTopbar(); 
    inicializarModalPublicarDinamico(); 

    // --- LÓGICA DE FILTROS ---
    const selectorFiltro = document.getElementById('filtroPublicaciones');
    if (selectorFiltro) {
        filtroActual = selectorFiltro.value.toUpperCase().trim();
        
        selectorFiltro.addEventListener('change', function(e) {
            filtroActual = e.target.value.toUpperCase().trim();
            // No hace falta volver a pedir los datos al servidor: se
            // reordena/filtra la copia que ya tenemos en memoria.
            cargarPublicaciones(false);
        });
    }

    // --- FILTRO POR CATEGORÍA DE PRODUCTO (solo existe en Mercado/Ventas) ---
    const selectorCategoria = document.getElementById('filtroCategoriaVentas');
    if (selectorCategoria) {
        filtroCategoriaActual = selectorCategoria.value.toUpperCase().trim();

        selectorCategoria.addEventListener('change', function (e) {
            filtroCategoriaActual = e.target.value.toUpperCase().trim();
            cargarPublicaciones(false);
        });
    }

    // --- LÓGICA PARA EL BOTÓN DE CERRAR SESIÓN ---
    const botonLogout = document.getElementById('btnLogout');
    if (botonLogout) {
        botonLogout.addEventListener('click', function () {
            localStorage.removeItem('idUsuario');
            localStorage.removeItem('usuarioActivo'); 
            window.location.href = "/Index.html"; 
        });
    }

    // --- ACTUALIZACIÓN AUTOMÁTICA EN SEGUNDO PLANO ---
    setInterval(() => {
        cargarPublicaciones(true);
        cargarDatosUsuario(idUsuario);
    }, 10000); 
});

// =========================================================
// INTEGRACIÓN: SISTEMA DE NOTIFICACIONES REALES Y AJUSTES
// =========================================================
function inicializarElementosTopbar() {
    const btnNotif = document.getElementById("btnNotif");
    const btnConfig = document.getElementById("btnConfig");
    const modalOverlay = document.getElementById("modalOverlay");
    const modalClose = document.getElementById("modalClose");
    const modalContent = document.getElementById("modalContent");
    const idUsuario = localStorage.getItem('idUsuario');

    if (!modalOverlay || !modalContent) {
        console.warn("No se encontró el contenedor del modal reutilizable en el HTML.");
        return;
    }

    // --- FUNCIÓN PARA ABRIR EL MODAL REUTILIZABLE ---
    const abrirModal = (titulo, htmlContenido) => {
        modalContent.innerHTML = `
            <div style="font-family: system-ui, sans-serif; padding: 10px 5px;">
                <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; color: #111; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    ${titulo}
                </h3>
                ${htmlContenido}
            </div>
        `;
        modalOverlay.style.display = "flex"; 
    };

    // --- FUNCIÓN PARA CERRAR EL MODAL ---
    const cerrarModal = () => {
        modalOverlay.style.display = "none";
        modalContent.innerHTML = "";
    };

    if (modalClose) {
        modalClose.addEventListener("click", cerrarModal);
    }

    modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            cerrarModal();
        }
    });

    // =========================================================
    // 1. COMPORTAMIENTO DE NOTIFICACIONES (DESDE BASE DE DATOS)
    // =========================================================
    if (btnNotif) {
        btnNotif.addEventListener("click", () => {
            abrirModal("🔔 Notificaciones", `<p style="text-align:center; color:#888;">Cargando tus notificaciones...</p>`);

            fetch(`https://tu-uni.onrender.com/ApiObtenerNotificaciones?idUsuario=${idUsuario}`)
                .then(response => {
                    if (!response.ok) throw new Error("Error al consultar notificaciones");
                    return response.json();
                })
                .then(notificaciones => {
                    if (!notificaciones || notificaciones.length === 0) {
                        abrirModal("🔔 Notificaciones", `
                            <div style="text-align: center; padding: 20px; color: #888;">
                                <span style="font-size: 40px; display:block; margin-bottom:10px;">📭</span>
                                <p style="margin:0; font-size:14px;">No tienes notificaciones por el momento.</p>
                            </div>
                        `);
                        return;
                    }

                    let htmlNotificaciones = `<div style="display: flex; flex-direction: column; gap: 12px; max-height: 350px; overflow-y: auto; padding-right: 4px;">`;
                    
                    notificaciones.forEach(notif => {
                        let icono = "🔔";
                        let colorBorde = "#1da1f2"; 
                        const descLower = notif.Descripcion.toLowerCase();

                        if (descLower.includes("coment") || descLower.includes("respondi")) {
                            icono = "💬";
                            colorBorde = "#2ecc71"; 
                        } else if (descLower.includes("gusto") || descLower.includes("like") || descLower.includes("reaccion")) {
                            icono = "❤️";
                            colorBorde = "#e0245e"; 
                        } else if (descLower.includes("asist")) {
                            icono = "📅";
                            colorBorde = "#fab818"; 
                        }

                        htmlNotificaciones += `
                            <div style="display: flex; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; align-items: center; border-left: 4px solid ${colorBorde}; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                                <span style="font-size: 20px; flex-shrink: 0;">${icono}</span>
                                <div style="flex-grow: 1;">
                                    <p style="margin: 0; font-size: 13px; color: #111; line-height: 1.4;">${notif.Descripcion}</p>
                                    <span style="font-size: 11px; color: #888; display: block; margin-top: 4px;">📅 ${notif.Fecha}</span>
                                </div>
                            </div>
                        `;
                    });

                    htmlNotificaciones += `</div>`;
                    abrirModal("🔔 Notificaciones", htmlNotificaciones);
                })
                .catch(error => {
                    console.error("Error cargando notificaciones:", error);
                    abrirModal("🔔 Notificaciones", `<p style="text-align:center; color:#e74c3c;">Hubo un error al conectar con el servidor.</p>`);
                });
        });
    }

    // =========================================================
    // 2. COMPORTAMIENTO DE AJUSTES
    // =========================================================
    if (btnConfig) {
        btnConfig.addEventListener("click", () => {
            const htmlAjustes = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6;">
                        <div>
                            <strong style="font-size: 14px; color: #111; display: block;">Modo Oscuro</strong>
                            <span style="font-size: 12px; color: #666;">Cambiar la apariencia de la interfaz</span>
                        </div>
                        <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                            <input type="checkbox" id="chkModoOscuro" style="opacity: 0; width: 0; height: 0;" onchange="alternarModoOscuro(this)">
                            <span id="switchTrack" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px;">
                                <span id="switchKnob" style="position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: #fff; transition: .4s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></span>
                            </span>
                        </label>
                    </div>
                    <button onclick="document.getElementById('modalClose').click()" 
                            style="background: #1da1f2; color: white; border: none; font-weight: bold; font-size: 14px; padding: 10px; border-radius: 8px; cursor: pointer; margin-top: 10px;">
                        Guardar Configuración
                    </button>
                </div>
            `;
            abrirModal("⚙️ Ajustes de Cuenta", htmlAjustes);
            
            setTimeout(() => {
                const chk = document.getElementById("chkModoOscuro");
                if (chk) {
                    chk.checked = document.body.classList.contains("dark-mode");
                    actualizarVisualSwitch(chk.checked);
                }
            }, 50);
        });
    }
}

// Actualiza visualmente el interruptor (color de fondo + posición de la perilla)
function actualizarVisualSwitch(activo) {
    const track = document.getElementById("switchTrack");
    const knob = document.getElementById("switchKnob");
    if (track) track.style.backgroundColor = activo ? "#1da1f2" : "#ccc";
    if (knob) knob.style.transform = activo ? "translateX(20px)" : "translateX(0)";
}

window.alternarModoOscuro = function(checkbox) {
    if (checkbox.checked) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("tema", "dark");
    } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("tema", "light");
    }
    actualizarVisualSwitch(checkbox.checked);
};

if (localStorage.getItem("tema") === "dark") {
    document.body.classList.add("dark-mode");
}

// =========================================================
// CARGA DINÁMICA DEL CARRUSEL
// =========================================================
function cargarCarruselDinamico() {
    fetch('https://tu-uni.onrender.com/ApiObtenerCarrusel')
        .then(response => {
            if (!response.ok) throw new Error("Error en el servidor de NetBeans");
            return response.json();
        })
        .then(itemsCarrusel => {
            const track = document.getElementById('carouselTrack');
            const dotsContainer = document.getElementById('carDots');
            
            if (!track || !dotsContainer) return;

            if (!itemsCarrusel || itemsCarrusel.length === 0) {
                track.innerHTML = `<div class="slide"><div class="slide-text"><h1>No hay anuncios activos</h1></div></div>`;
                return;
            }

            track.innerHTML = '';
            dotsContainer.innerHTML = '';

            itemsCarrusel.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = 'slide';
                slide.style.backgroundImage = `url('${item.imagen}')`;
                slide.innerHTML = `
                    <div class="slide-text">
                        <span>${item.fecha || ''}</span>
                        <h1>${item.titulo}</h1>
                    </div>`;
                track.appendChild(slide);

                const dot = document.createElement('div');
                dot.className = `dot ${index === 0 ? 'active' : ''}`;
                dotsContainer.appendChild(dot);
            });

            inicializarMovimientoCarrusel(itemsCarrusel.length);
        })
        .catch(error => console.error("Error al cargar el carrusel dinámico:", error));
}

function inicializarMovimientoCarrusel(totalSlides) {
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('#carDots .dot');
    const btnNext = document.getElementById('carNext');
    const btnPrev = document.getElementById('carPrev');
    
    if (!track || totalSlides === 0) return;
    let currentIndex = 0;

    function updateCarousel(index) {
        currentIndex = index;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    }

    if (btnNext) btnNext.addEventListener('click', () => updateCarousel((currentIndex + 1) % totalSlides));
    if (btnPrev) btnPrev.addEventListener('click', () => updateCarousel((currentIndex - 1 + totalSlides) % totalSlides));
    dots.forEach((dot, index) => dot.addEventListener('click', () => updateCarousel(index)));
}

function cargarDatosUsuario(idUsuario) {
    fetch(`https://tu-uni.onrender.com/ApiObtenerUsuario?id=${idUsuario}`)
    .then(response => {
        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        return response.json();
    })
    .then(usuario => {
        if (document.getElementById('userNombre')) document.getElementById('userNombre').innerText = usuario.nombre;
        if (document.getElementById('userCorreo')) document.getElementById('userCorreo').innerText = usuario.correo;
        if (document.getElementById('userAvatar')) document.getElementById('userAvatar').src = usuario.foto;
        if (document.getElementById('statSeguidores')) document.getElementById('statSeguidores').innerText = usuario.seguidores;
        if (document.getElementById('statSeguidos')) document.getElementById('statSeguidos').innerText = usuario.seguidos;
        if (document.getElementById('statPosts')) document.getElementById('statPosts').innerText = usuario.totalPosts;
    })
    .catch(error => console.error("Error al cargar el perfil en el Sidebar:", error));
}

// =========================================================
// CARGA DINÁMICA DE PUBLICACIONES CON FILTRO POR SECCIÓN
// =========================================================
function cargarPublicaciones(forzarFetch = true) {
    const idUsuarioActualParaFetch = localStorage.getItem('idUsuario') || "1";

    // Si ya tenemos datos en caché y no se pidió refrescar (p.ej. el usuario
    // solo cambió el orden o la categoría), evitamos otra petición HTTP y
    // re-renderizamos al instante con lo que ya tenemos.
    if (!forzarFetch && publicacionesCache) {
        procesarYRenderizarPublicaciones(publicacionesCache, idUsuarioActualParaFetch);
        return;
    }

    fetch(`https://tu-uni.onrender.com/ApiObtenerPublicaciones?idUsuario=${idUsuarioActualParaFetch}`)
        .then(response => {
            if (!response.ok) throw new Error("Status HTTP erróneo: " + response.status);
            return response.json();
        })
        .then(publicaciones => {
            if (!Array.isArray(publicaciones)) {
                if (publicaciones && publicaciones.status === "error") {
                    alert("❌ ERROR DEL SERVIDOR:\n\n" + publicaciones.message);
                    return;
                }
                publicaciones = publicaciones ? [publicaciones] : [];
            }

            publicacionesCache = publicaciones;
            procesarYRenderizarPublicaciones(publicaciones, idUsuarioActualParaFetch);
        })
        .catch(error => {
            console.error("Error al cargar publicaciones:", error);
        });
}

// Toma la última respuesta (fresca o en caché) y se encarga de filtrar,
// ordenar y pintar las tarjetas. Separarlo de la petición fetch es lo que
// permite reutilizar los datos sin volver a golpear el servidor.
function procesarYRenderizarPublicaciones(publicaciones, idUsuarioActualParaFetch) {
            const contenedor = document.getElementById('inicioGrid');
            if (!contenedor) return;

            // 1. Obtener la sección del atributo HTML
            const seccionActual = (contenedor.getAttribute('data-seccion') || 'INICIO').toUpperCase().trim();
            let usuarioActual = String(idUsuarioActualParaFetch).trim();

            // 2. Aplicar filtros combinados (Sección de la página + Filtro de la Topbar)
            let publicacionesProcesadas = publicaciones.filter(pub => {
                let tipoPub = (pub.tipo || pub.Tipo_Publicacion || pub.tipo_publicacion || 'FORO').toUpperCase().trim();
                
                // Homologar tipos similares
                if (tipoPub === 'VENTA' || tipoPub === 'PROMOCION') tipoPub = 'VENTAS';
                if (tipoPub === 'EVENTO') tipoPub = 'EVENTOS';
                if (tipoPub === 'FORO' || tipoPub === 'DEBATE' || tipoPub === 'PUBLICACION' || tipoPub === '') tipoPub = 'FOROS';

                // A) Filtrar por la página en la que se encuentra el usuario.
                // En INICIO solo deben aparecer publicaciones de VENTAS y EVENTOS
                // (los FOROS quedan fuera de la página de inicio).
                if (seccionActual === 'INICIO') {
                    if (tipoPub !== 'VENTAS' && tipoPub !== 'EVENTOS') {
                        return false;
                    }
                } else if (tipoPub !== seccionActual) {
                    return false;
                }

                // El filtro de la topbar (Recientes/Antiguas/Mis publicaciones) y el
                // de categoría solo tienen sentido en las secciones de VENTAS y
                // EVENTOS; en FOROS (o INICIO general) se ignoran por completo.
                const filtroTopbarAplica = (tipoPub === 'VENTAS' || tipoPub === 'EVENTOS');

                // B) Filtrar por el selector de ordenamiento (ej. Mis Publicaciones)
                if (filtroTopbarAplica && filtroActual === 'MIS_POSTS') {
                    const idCreadorPost = pub.ID_Usuario || pub.idUsuario || pub.id_usuario;
                    if (idCreadorPost === undefined || idCreadorPost === null) return true; 
                    return String(idCreadorPost).trim() === usuarioActual;
                }

                // C) Filtrar por tipo de producto/categoría (solo aplica en Mercado/Ventas)
                if (filtroTopbarAplica && tipoPub === 'VENTAS' && filtroCategoriaActual && filtroCategoriaActual !== 'TODAS') {
                    const categoriaPub = (pub.categoria || pub.Categoria || 'OTROS').toUpperCase().trim();
                    return categoriaPub === filtroCategoriaActual;
                }

                return true; 
            });

            // 3. Ordenamiento temporal (Recientes / Antiguas)
            const parsearFechaSegura = (fechaStr) => {
                if (!fechaStr) return 0;
                if (fechaStr.includes('/')) {
                    const partes = fechaStr.split(' ')[0].split('/');
                    if (partes.length === 3) fechaStr = `${partes[2]}-${partes[1]}-${partes[0]}`;
                }
                const timestamp = Date.parse(fechaStr);
                return isNaN(timestamp) ? 0 : timestamp;
            };

            publicacionesProcesadas.sort((a, b) => {
                const idA = a.ID_Publicacion || a.idPublicacion || a.id_publicacion || 0;
                const idB = b.ID_Publicacion || b.idPublicacion || b.id_publicacion || 0;
                const fechaA = parsearFechaSegura(a.fecha);
                const fechaB = parsearFechaSegura(b.fecha);

                if (filtroActual === 'ANTIGUAS') {
                    return fechaA !== fechaB ? fechaA - fechaB : idA - idB; 
                } else {
                    return fechaA !== fechaB ? fechaB - fechaA : idB - idA;
                }
            });

            // 4. ¿Hay algo realmente nuevo? Si no, no tocamos el DOM (sin parpadeos)
            const resumenActual = publicacionesProcesadas.map(p => {
                const id = p.ID_Publicacion || p.idPublicacion || p.id_publicacion || '';
                return [
                    id, p.titulo, p.descripcion, p.totalLikes, p.totalComentarios,
                    p.totalFavoritos, p.totalAsistentes, p.miLike, p.miFavorito, p.miAsistencia
                ].join('|');
            }).join('~');

            if (resumenActual === ultimoResumenPublicaciones) {
                return; // sin cambios reales: dejamos el DOM tal cual está
            }
            ultimoResumenPublicaciones = resumenActual;

            // 5. Renderizado en el DOM
            if (publicacionesProcesadas.length === 0) {
                contenedor.innerHTML = `
                    <div style="text-align:center; grid-column: 1/-1; padding: 40px; color: #666;">
                        <p style="font-size: 16px; font-weight: 500;">No hay publicaciones disponibles para esta sección.</p>
                    </div>`;
                return;
            }

            // --- Preservar estado visual antes de reconstruir el HTML ---
            const scrollYActual = window.scrollY;
            const panelesAbiertos = new Set();
            contenedor.querySelectorAll('[id^="respuestas-contenedor-"]').forEach(panel => {
                if (panel.style.display === 'block') {
                    panelesAbiertos.add(panel.id.replace('respuestas-contenedor-', ''));
                }
            });
            const valoresInputRespuesta = {};
            contenedor.querySelectorAll('[id^="input-respuesta-"]').forEach(input => {
                if (input.value) {
                    valoresInputRespuesta[input.id.replace('input-respuesta-', '')] = input.value;
                }
            });
            const idElementoActivo = document.activeElement ? document.activeElement.id : null;

            let htmlCards = '';

            publicacionesProcesadas.forEach(pub => {
                const inicialAutor = pub.usuario ? pub.usuario.charAt(0).toUpperCase() : 'U';
                const idPub = pub.ID_Publicacion || pub.idPublicacion || pub.id_publicacion || '';
                let tipoVisual = (pub.tipo || pub.Tipo_Publicacion || pub.tipo_publicacion || 'FORO').toUpperCase().trim();
                const esForo = (tipoVisual === 'FORO' || tipoVisual === 'FOROS' || tipoVisual === 'DEBATE' || tipoVisual === 'PUBLICACION' || tipoVisual === '');
                const idCreadorPost = pub.ID_Usuario || pub.idUsuario || pub.id_usuario;

                let deleteBtn = "";
                if (!idCreadorPost || String(idCreadorPost).trim() === usuarioActual) {
                    deleteBtn = `
                        <button class="btn-eliminar-pub" data-id="${idPub}" onclick="event.stopPropagation(); eliminarPublicacion(this)" style="background: none; border: none; color: #e74c3c; cursor: pointer; padding: 5px; font-weight: bold; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                            🗑️ Eliminar
                        </button>`;
                }

                const yaDioLike = pub.miLike === true || pub.miLike === 1;
                const yaEsFavorito = pub.miFavorito === true || pub.miFavorito === 1;

                if (esForo) {
                    const imagenEnHilo = pub.imagen && pub.imagen.trim() !== "" 
                        ? `<div style="margin: -16px -16px 0 -16px; border-radius: 16px 16px 0 0; overflow: hidden; max-height: 200px;">
                               <img src="${pub.imagen}" alt="${pub.titulo}" style="width:100%; height:100%; object-fit:cover; max-height:200px;">
                           </div>`
                        : `<div style="margin: -16px -16px 0 -16px; border-radius: 16px 16px 0 0; height: 180px; display: flex; align-items: center; justify-content: center; background: #eef1f6; color: #aaa; font-size: 12px;">Sin imagen adjunta</div>`;

                    const fotoPerfilSrc = pub.fotoPerfil || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

                    htmlCards += `
                        <div class="card card-foro" data-tipo="FORO" onclick="abrirDetallePublicacion(this)" style="background: #ffffff; border-radius: 16px; border: 1px solid #e1e8ed; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 16px; display: flex; flex-direction: column; gap: 12px; cursor: pointer;">
                            ${imagenEnHilo}
                            <div style="display: flex; gap: 12px; align-items: flex-start;">
                                <a href="${idCreadorPost && String(idCreadorPost).trim() === usuarioActual ? '/html/vent/perfil.html' : `/html/vent/perfilAjeno.html?id=${idCreadorPost}`}" onclick="event.stopPropagation();" style="text-decoration: none; flex-shrink: 0;">
                                    <img src="${fotoPerfilSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div style="background-color: #1da1f2; width: 40px; height: 40px; border-radius: 50%; display: none; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">${inicialAutor}</div>
                                </a>
                                <div style="display: flex; flex-direction: column; flex-grow: 1;">
                                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                        <a href="${idCreadorPost && String(idCreadorPost).trim() === usuarioActual ? '/html/vent/perfil.html' : `/html/vent/perfilAjeno.html?id=${idCreadorPost}`}" onclick="event.stopPropagation();" style="text-decoration: none; font-weight: 700; color: #14171a; font-size: 15px;">${pub.usuario || 'Anónimo'}</a>
                                        <span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666; font-weight: 600; background: #f3f4f6; padding: 2px 8px; border-radius: 12px;">${tipoVisual}</span>
                                        <span style="color: #657786; font-size: 13px;">•</span>
                                        <span style="color: #657786; font-size: 13px;" title="${pub.fecha}">${pub.fecha ? pub.fecha.substring(0, 10) : 'Recién'}</span>
                                    </div>
                                    <div style="margin-top: 4px;">
                                        <h4 style=" width: 100%; margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #14171a; line-height: 1.3;">${pub.titulo}</h4>
                                        <p style="width: 10px;margin: 0; font-size: 14px; color: #1c2126; line-height: 1.5; white-space: pre-wrap;">${pub.descripcion}</p>
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f3f4f6; padding-top: 10px; margin-top: 4px;">
                                <div style="display: flex; gap: 20px; align-items: center;">
                                    <button id="btn-toggle-respuestas-${idPub}" class="btn-toggle-respuestas" onclick="event.stopPropagation(); toggleRespuestas(${idPub}, this)" style="background: none; border: none; color: #657786; display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; padding: 0;">
                                        <span style="font-size: 16px;">💬</span>
                                        <span style="font-weight: 600; color: #657786;">${pub.totalComentarios || 0} hilos</span>
                                        <span class="flecha-toggle" style="display: inline-block; font-size: 11px; transition: transform 0.2s ease; transform: rotate(0deg);">▾</span>
                                    </button>
                                    <button class="btn-mini-accion btn-like ${yaDioLike ? 'activo-like' : ''}" onclick="event.stopPropagation(); darLike(${idPub}, this)" style="background: none; border: none; color: ${yaDioLike ? '#e0245e' : '#657786'}; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: color 0.2s;">
                                        <span style="font-size: 16px;">❤️</span>
                                        <span style="font-weight: 600;">${pub.totalLikes || 0}</span>
                                    </button>
                                    <button class="btn-mini-accion btn-favorito ${yaEsFavorito ? 'activo-favorito' : ''}" onclick="event.stopPropagation(); darFavorito(${idPub}, this)" style="background: none; border: none; color: ${yaEsFavorito ? '#fab818' : '#657786'}; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: color 0.2s;">
                                        <span style="font-size: 16px;">⭐</span>
                                        <span style="font-weight: 600;">${pub.totalFavoritos || 0}</span>
                                    </button>
                                </div>
                                <div>${deleteBtn}</div>
                            </div>

                            <div id="respuestas-contenedor-${idPub}" onclick="event.stopPropagation();" style="display: none; background: #f8f9fa; border-radius: 12px; padding: 12px; border: 1px solid #e1e8ed;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                                    <span style="font-size: 12px; font-weight: 700; color: #657786; text-transform: uppercase; letter-spacing: .3px;">Respuestas</span>
                                    <button onclick="event.stopPropagation(); cerrarRespuestas(${idPub})" title="Cerrar" style="background: none; border: none; color: #657786; font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px;">×</button>
                                </div>
                                <div id="lista-respuestas-${idPub}" style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; margin-bottom: 12px;">
                                    <p style="font-size: 12px; color: #888; text-align: center; margin: 10px 0;">Cargando respuestas...</p>
                                </div>
                                <div style="display: flex; gap: 8px; border-top: 1px solid #e1e8ed; padding-top: 10px;">
                                    <input type="text" id="input-respuesta-${idPub}" placeholder="Escribe tu respuesta..." onkeydown="if(event.key === 'Enter') enviarRespuestaRapida(${idPub})" style="flex-grow: 1; border: 1px solid #ccd6dd; border-radius: 20px; padding: 6px 12px; font-size: 13px; outline: none; background-color: #ffffff;">
                                    <button onclick="enviarRespuestaRapida(${idPub})" style="background: #1da1f2; color: white; border: none; font-weight: bold; font-size: 13px; padding: 6px 16px; border-radius: 20px; cursor: pointer;">Responder</button>
                                </div>
                            </div>
                        </div>
                    `;
                    setTimeout(() => { cargarRespuestasHilos(idPub); }, 50);
                } else {
                    const imagenPublicacion = pub.imagen && pub.imagen.trim() !== "" 
                        ? `<img src="${pub.imagen}" class="card-img" alt="${pub.titulo}" style="width:100%; height:180px; object-fit:cover;">` 
                        : `<div class="card-img-placeholder" style="display: flex; align-items: center; justify-content: center; background: #eef1f6; color: #aaa; font-size: 12px; height: 180px; width: 100%;">Sin imagen adjunta</div>`;

                    let htmlEstructuraExtra = "";
                    if (tipoVisual === 'VENTAS' || tipoVisual === 'VENTA' || tipoVisual === 'PROMOCION') {
                        const precioCrudo = pub.precio || pub.Precio;
                        const precioFormateado = (precioCrudo !== undefined && precioCrudo !== null) ? parseFloat(precioCrudo).toFixed(2) : null;
                        const categoriaPub = pub.categoria || pub.Categoria || '';
                        const chipCategoria = categoriaPub
                            ? `<span style="font-size: 11px; font-weight: 700; color: #27ae60; background: #eafaf1; padding: 3px 9px; border-radius: 999px; display: inline-block; margin-bottom: 6px;">${formatearCategoria(categoriaPub)}</span><br>`
                            : '';
                        if (precioFormateado) {
                            htmlEstructuraExtra = `
                                <div style="background: #e8f8f5; border-left: 4px solid #2ecc71; padding: 10px; margin: 10px 0; border-radius: 4px;">
                                    ${chipCategoria}
                                    <span style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #27ae60; display: block;">Precio Estimado</span>
                                    <span style="font-size: 18px; font-weight: 800; color: #219f56;">$${precioFormateado} MXN</span>
                                </div>`;
                        } else if (chipCategoria) {
                            htmlEstructuraExtra = `<div style="margin: 10px 0;">${chipCategoria}</div>`;
                        }
                    } else if (tipoVisual === 'EVENTOS' || tipoVisual === 'EVENTO') {
                        const lugar = pub.lugar || pub.Lugar || "Por confirmar";
                        let hora = pub.hora || pub.Hora || "Por definir";
                        if (hora !== "Por definir" && hora.includes("T")) {
                            const partes = hora.split("T");
                            hora = `${partes[0]} a las ${partes[1]}`;
                        }
                        const asistentes = pub.totalAsistentes || 0;
                        const yaAsiste = pub.miAsistencia === true || pub.miAsistencia === 1;

                        htmlEstructuraExtra = `
                            <div style="background: #ebf5fb; border-radius: 8px; padding: 12px; margin: 10px 0; font-size: 13px; color: #2c3e50;">
                                <div style="margin-bottom: 6px;">📍 <strong>Lugar:</strong> ${lugar}</div>
                                <div style="margin-bottom: 10px;">📅 <strong>Fecha/Hora:</strong> ${hora}</div>
                                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #d4e6f1; padding-top: 8px;">
                                    <span style="font-weight: bold; color: #2980b9;">👥 ${asistentes} asistirán</span>
                                    <button onclick="event.stopPropagation(); marcarAsistencia(${idPub}, this)" style="background: ${yaAsiste ? '#27ae60' : '#2980b9'}; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px;">
                                        ${yaAsiste ? '✓ Confirmado' : 'Asistir'}
                                    </button>
                                </div>
                            </div>`;
                    }

                    const fotoPerfilSrc = pub.fotoPerfil || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

                    htmlCards += `
                        <div class="card" data-tipo="${tipoVisual}" onclick="abrirDetallePublicacion(this)" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer;">
                            ${imagenPublicacion}
                            <div class="card-body" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1;">
                                <div>
                                    <div class="card-icons" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f0f2f5;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                        <img src="${fotoPerfilSrc}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                                        <span style="font-size: 12px; font-weight: 600; color: #333;">${pub.usuario || 'Anónimo'}</span>
                                        </div>
                                        <span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666; font-weight: 600; background: #f3f4f6; padding: 2px 8px; border-radius: 12px;">${tipoVisual}</span>
                                        <span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888; margin-left: 8px;">• ${pub.fecha ? pub.fecha.substring(0, 10) : 'Recién'}</span>

                                    </div>
                                    <h3 class="card-title" style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #111;">${pub.titulo}</h3>
                                    <p class="card-desc" style="margin: 0; font-size: 14px; color: #555; line-height: 1.4;">${pub.descripcion}</p>
                                    ${htmlEstructuraExtra}
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 12px;">
                                    <div>${deleteBtn}</div>
                                                                            <div class="interacciones-top" style="margin-left: auto; display: flex; gap: 6px;">
                                            <button class="btn-mini-accion btn-like ${yaDioLike ? 'activo-like' : ''}" onclick="event.stopPropagation(); darLike(${idPub}, this)">
                                                <span>❤️</span>
                                                <span class="contador-mini contador">${pub.totalLikes || 0}</span>
                                            </button>
                                            <button class="btn-mini-accion btn-comentario" onclick="event.stopPropagation(); abrirModalComentarios(${idPub}, '${tipoVisual}')">
                                                <span>💬</span>
                                                <span class="contador-mini contador">${pub.totalComentarios || 0}</span>
                                            </button>
                                            <button class="btn-mini-accion btn-favorito ${yaEsFavorito ? 'activo-favorito' : ''}" onclick="event.stopPropagation(); darFavorito(${idPub}, this)">
                                                <span>⭐</span>
                                                <span class="contador-mini contador">${pub.totalFavoritos || 0}</span>
                                            </button>
                                        </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            contenedor.innerHTML = htmlCards;

            // --- Restaurar estado visual tras reconstruir el HTML ---
            panelesAbiertos.forEach(idPub => {
                const panel = document.getElementById(`respuestas-contenedor-${idPub}`);
                const btnToggle = document.getElementById(`btn-toggle-respuestas-${idPub}`);
                if (panel) panel.style.display = 'block';
                if (btnToggle) {
                    const flecha = btnToggle.querySelector('.flecha-toggle');
                    if (flecha) flecha.style.transform = 'rotate(180deg)';
                }
            });

            Object.keys(valoresInputRespuesta).forEach(idPub => {
                const input = document.getElementById(`input-respuesta-${idPub}`);
                if (input) input.value = valoresInputRespuesta[idPub];
            });

            if (idElementoActivo) {
                const elementoARestaurar = document.getElementById(idElementoActivo);
                if (elementoARestaurar) {
                    elementoARestaurar.focus();
                    if (typeof elementoARestaurar.selectionStart === 'number') {
                        const pos = elementoARestaurar.value.length;
                        elementoARestaurar.setSelectionRange(pos, pos);
                    }
                }
            }

            window.scrollTo(0, scrollYActual);
}

// =========================================================
// TOGGLE DE RESPUESTAS EN PUBLICACIONES TIPO FORO
// =========================================================
window.toggleRespuestas = function(idPub, btn) {
    const cont = document.getElementById(`respuestas-contenedor-${idPub}`);
    if (!cont) return;

    const estaOculto = cont.style.display === 'none';
    cont.style.display = estaOculto ? 'block' : 'none';

    const flecha = btn.querySelector('.flecha-toggle');
    if (flecha) flecha.style.transform = estaOculto ? 'rotate(180deg)' : 'rotate(0deg)';
};

// =========================================================================
// MÓDULO CONTROLADOR DEL MODAL DE PUBLICACIÓN (DINÁMICO & COMPLETO)
// =========================================================================
function inicializarModalPublicarDinamico() {
    const camposVenta = document.getElementById("camposVenta");
    const camposEvento = document.getElementById("camposEvento");

    // Buscamos las tarjetas usando la clase definida en common.css
    const tarjetasTipo = document.querySelectorAll("#modalPublicar .type-option");

    if (tarjetasTipo.length === 0) return;

    tarjetasTipo.forEach(tarjeta => {
        tarjeta.addEventListener("click", () => {
            const texto = tarjeta.innerText.trim().toLowerCase();

            // Quitamos la clase 'active' de todas las tarjetas
            tarjetasTipo.forEach(t => t.classList.remove("active"));
            
            // Le agregamos la clase 'active' a la tarjeta clickeada para aplicar tus estilos CSS
            tarjeta.classList.add("active");

            // Ocultamos las secciones especiales por defecto
            if (camposVenta) camposVenta.style.display = "none";
            if (camposEvento) camposEvento.style.display = "none";

            // Mostramos la sección que corresponda
            if (texto.includes("venta") && camposVenta) {
                camposVenta.style.display = "block";
            } else if (texto.includes("evento") && camposEvento) {
                camposEvento.style.display = "block";
            }
        });
    });


    // 2. Si las encuentra por selector, les asignamos el evento click
    tarjetasTipo.forEach(tarjeta => {
        const texto = tarjeta.innerText.trim().toLowerCase();
        tarjeta.style.cursor = "pointer"; // Nos aseguramos que muestre la mano al pasar el mouse
        
        tarjeta.addEventListener("click", () => {
            // Quitamos el estilo activo visual a todas las tarjetas
            tarjetasTipo.forEach(t => t.style.border = "1px solid #cbd5e1"); // Pon un borde gris normal
            
            // Resaltamos la tarjeta seleccionada (puedes cambiar el color al de tu tema)
            tarjeta.style.border = "2px solid #3b5998"; 

            // Ocultamos las secciones especiales por defecto
            if (camposVenta) camposVenta.style.display = "none";
            if (camposEvento) camposEvento.style.display = "none";

            // Mostramos la sección que corresponda según el texto de la tarjeta
            if (texto.includes("venta") && camposVenta) {
                camposVenta.style.display = "block";
            } else if (texto.includes("evento") && camposEvento) {
                camposEvento.style.display = "block";
            }
        });
    });
}

// Función auxiliar en caso de que usemos la búsqueda por texto directo
function configurarClickTarjeta(tarjeta, tipo, camposVenta, camposEvento, todasLasTarjetas) {
    tarjeta.style.cursor = "pointer";
    tarjeta.addEventListener("click", () => {
        if (camposVenta) camposVenta.style.display = "none";
        if (camposEvento) camposEvento.style.display = "none";

        if (tipo === "venta" && camposVenta) camposVenta.style.display = "block";
        if (tipo === "evento" && camposEvento) camposEvento.style.display = "block";
    });
}
// --- Funciones globales de activación de ventanas modales ---
window.abrirModalPublicar = function() {
    const modal = document.getElementById("modalPublicar");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("activo");
    }
};

window.cerrarModalPublicar = function() {
    const modal = document.getElementById("modalPublicar");
    const form = document.getElementById("formPublicar");
    const vistaPrevia = document.getElementById("vistaPrevia");
    
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("activo");
    }
    if (form) form.reset();
    if (vistaPrevia) vistaPrevia.style.display = "none";
    
    const camposVenta = document.getElementById("camposVenta");
    const camposEvento = document.getElementById("camposEvento");
    if (camposVenta) camposVenta.style.display = "none";
    if (camposEvento) camposEvento.style.display = "none";
};
function abrirModalPublicar() {
    const modal = document.getElementById('modalPublicar');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('activo');
    }
}

function cerrarModalPublicar() {
    const modal = document.getElementById('modalPublicar');
    const formulario = document.getElementById('formPublicar');
    const preview = document.getElementById('vistaPrevia');
    
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('activo');
    }
    if (formulario) formulario.reset(); 
    if (preview) {
        preview.src = "";
        preview.style.display = 'none'; 
    }
    document.getElementById('camposVenta').style.display = 'none';
    document.getElementById('camposEvento').style.display = 'none';

    // Reset del selector visual de tipo
    document.querySelectorAll('#pubTipoSelector .type-option').forEach(el => el.classList.remove('active'));
    document.getElementById('pubTipo').value = '';
}

document.addEventListener("DOMContentLoaded", function () {
    const inputTipo = document.getElementById('pubTipo');
    const camposVenta = document.getElementById('camposVenta');
    const camposEvento = document.getElementById('camposEvento');

    // --- Selector visual de tipo (iconos) ---
    const tipoSelector = document.getElementById('pubTipoSelector');
    if (tipoSelector) {
        tipoSelector.addEventListener('click', function (e) {
            const btn = e.target.closest('.type-option');
            if (!btn) return;

            tipoSelector.querySelectorAll('.type-option').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            inputTipo.value = btn.getAttribute('data-tipo');
            inputTipo.dispatchEvent(new Event('change'));
        });
    }

    // --- Mostrar/ocultar campos extra según el tipo elegido ---
    if (inputTipo) {
        inputTipo.addEventListener('change', function () {
            const valor = inputTipo.value;
            camposVenta.style.display = (valor === 'VENTAS') ? 'flex' : 'none';
            camposEvento.style.display = (valor === 'EVENTOS') ? 'flex' : 'none';
        });
    }

    // Miniatura de imagen
    const localFileInput = document.getElementById('pubImagenFile');
    if (localFileInput) {
        localFileInput.addEventListener('change', function(e) {
            const archivo = e.target.files[0];
            const preview = document.getElementById('vistaPrevia');
            
            if (archivo && preview) {
                const lector = new FileReader();
                lector.onload = function(event) {
                    preview.src = event.target.result;
                    preview.style.display = 'block';
                };
                lector.readAsDataURL(archivo);
            }
        });
    }

    // Envío del Formulario
    const formPublicar = document.getElementById('formPublicar');
    if (formPublicar) {
        formPublicar.addEventListener('submit', function (event) {
            event.preventDefault();

            const titulo = document.getElementById('pubTitulo').value.trim();
            const tipo = document.getElementById('pubTipo').value;
            const descripcion = document.getElementById('pubDescripcion').value.trim();

            if (!tipo) {
                alert("Selecciona un tipo de publicación.");
                return;
            }

            let idUsuario = localStorage.getItem('idUsuario') || "1";

            const vistaPrevia = document.getElementById('vistaPrevia');
            const imagenBase64 = (vistaPrevia && vistaPrevia.style.display !== 'none') ? vistaPrevia.src : "";

            const datosFormulario = new URLSearchParams();
            datosFormulario.append('idUsuario', idUsuario.trim());
            datosFormulario.append('titulo', titulo);
            datosFormulario.append('descripcion', descripcion);
            datosFormulario.append('tipo', tipo);
            datosFormulario.append('imagen', imagenBase64);

            if (tipo === 'VENTAS') {
                const precio = document.getElementById('extraPrecio').value;
                datosFormulario.append('precio', precio);
            } else if (tipo === 'EVENTOS') {
                const lugar = document.getElementById('extraLugar').value.trim();
                const hora = document.getElementById('extraHora').value;
                datosFormulario.append('lugar', lugar);
                datosFormulario.append('hora', hora);
            }

            fetch('https://tu-uni.onrender.com/ApiCrearPublicacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: datosFormulario
            })
            .then(response => {
                if (!response.ok) throw new Error("Error al publicar.");
                return response.json();
            })
            .then(data => {
                cerrarModalPublicar();
                if (typeof cargarPublicaciones === 'function') {
                    cargarPublicaciones();
                } else {
                    // Si no usas recarga dinámica por fetch, recargamos la página para mostrar el nuevo post
                    location.reload();
                }
            })
            .catch(error => {
                console.error("Error al publicar:", error);
                alert("Ocurrió un error al intentar crear la publicación.");
            });
        });
    }

    // 🔥 EL NUEVO ACOMPAÑANTE: Redimensiona de forma automática las tarjetas cargadas en la vista
    function adaptarTamañoPublicacionesExistentes() {
        const tarjetas = document.querySelectorAll(".card");
        tarjetas.forEach(tarjeta => {
            const textoTarjeta = tarjeta.innerText.toUpperCase();
            
            // Si el texto de la tarjeta contiene la palabra EVENTO o FORO, le asigna la clase CSS para estirarla
            if (textoTarjeta.includes("EVENTO") || textoTarjeta.includes("EVENTOS")) {
                tarjeta.classList.add("card-evento");
            } else if (textoTarjeta.includes("FORO")) {
                tarjeta.classList.add("card-foro");
            }
        });
    }

    // Lo ejecutamos inmediatamente al cargar el documento
    adaptarTamañoPublicacionesExistentes();
});

// =========================================================
// ACCIÓN INDEPENDIENTE: DAR LIKE (ApiLike)
// =========================================================
window.darLike = function(idPub, elemento) {
    const idUsuario = localStorage.getItem('idUsuario');

    fetch(`https://tu-uni.onrender.com/ApiLike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `idPublicacion=${idPub}&idUsuario=${idUsuario}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== "success") return;

        // Actualiza SOLO este botón con lo que ya nos regresó el servidor,
        // sin volver a pedir ni re-renderizar todas las publicaciones.
        document.querySelectorAll(`.btn-like[onclick*="darLike(${idPub},"]`).forEach(btn => {
            const contador = btn.querySelector('.contador-mini, .contador');
            if (contador) contador.textContent = data.totalLikes;

            btn.classList.toggle('activo-like', data.dioLike);
            btn.style.color = data.dioLike ? '#e0245e' : '#657786';
        });
    })
    .catch(err => console.error("Error al enviar reacción de like:", err));
};

// =========================================================
// ACCIÓN INDEPENDIENTE: GUARDAR FAVORITO (ApiFavorito)
// =========================================================
window.darFavorito = function(idPub, elemento) {
    const idUsuario = localStorage.getItem('idUsuario');

    fetch(`https://tu-uni.onrender.com/ApiFavorito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `idPublicacion=${idPub}&idUsuario=${idUsuario}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== "success") return;

        document.querySelectorAll(`.btn-favorito[onclick*="darFavorito(${idPub},"]`).forEach(btn => {
            const contador = btn.querySelector('.contador-mini, .contador');
            if (contador) contador.textContent = data.totalFavoritos;

            btn.classList.toggle('activo-favorito', data.esFavorito);
            btn.style.color = data.esFavorito ? '#fab818' : '#657786';
        });
    })
    .catch(err => console.error("Error al enviar reacción de favorito:", err));
};

// =========================================================
// ACCIÓN DE EVENTOS: CONFIRMAR ASISTENCIA
// =========================================================
window.marcarAsistencia = function(idPub, elemento) {
    const idUsuario = localStorage.getItem('idUsuario');
    fetch(`https://tu-uni.onrender.com/ApiAsistencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `idPublicacion=${idPub}&idUsuario=${idUsuario}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status !== "success") return;

        if (elemento) {
            elemento.textContent = data.activo ? '✓ Confirmado' : 'Asistir';
            elemento.style.background = data.activo ? '#27ae60' : '#2980b9';
        }

        const contadorAsistentes = elemento
            ? elemento.closest('div[style*="border-top"]')?.querySelector('span[style*="color: #2980b9"]')
            : null;
        if (contadorAsistentes) {
            contadorAsistentes.textContent = `👥 ${data.nuevoContador} asistirán`;
        }
    })
    .catch(err => console.error("Error al marcar asistencia:", err));
}

function cargarRespuestasHilos(idPub) {
    const lista = document.getElementById(`lista-respuestas-${idPub}`);
    if (!lista) return;

    fetch(`https://tu-uni.onrender.com/ApiObtenerComentarios?idPublicacion=${idPub}`)
    .then(response => response.json())
    .then(comentarios => {
        if (!comentarios || comentarios.length === 0) {
            lista.innerHTML = `<p style="font-size: 12px; color: #888; text-align: center; margin: 10px 0;">Sé el primero en responder.</p>`;
            return;
        }

        lista.innerHTML = "";
        comentarios.forEach(coment => {
            const div = document.createElement("div");
            div.style = "background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e1e8ed; display: flex; flex-direction: column; gap: 4px;";
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 12px; color: #14171a;">${coment.autor}</strong>
                    <span style="font-size: 10px; color: #888;">${coment.fecha || ''}</span>
                </div>
                <p style="margin: 0; font-size: 13px; color: #333;">${coment.descripcion}</p>
            `;
            lista.appendChild(div);
        });
        lista.scrollTop = lista.scrollHeight; 
    })
    .catch(err => {
        console.error("Error cargando comentarios:", err);
        lista.innerHTML = `<p style="font-size: 12px; color: #e74c3c; text-align: center; margin: 10px 0;">Error al conectar respuestas.</p>`;
    });
}

function enviarRespuestaRapida(idPub) {
    const input = document.getElementById(`input-respuesta-${idPub}`);
    if (!input) return;

    const contenido = input.value.trim();
    if (contenido === "") return;

    const idUsuario = localStorage.getItem('idUsuario');

    fetch(`https://tu-uni.onrender.com/ApiGuardarComentario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `idPublicacion=${idPub}&idUsuarioAutor=${idUsuario}&descripcion=${encodeURIComponent(contenido)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            input.value = "";
            cargarRespuestasHilos(idPub);
            cargarPublicaciones();
        } else {
            alert("No se pudo enviar la respuesta.");
        }
    })
    .catch(err => console.error("Error al comentar:", err));
}

function eliminarPublicacion(boton) {
    const idPub = boton.getAttribute("data-id");
    if (!idPub) return;

    if (confirm("¿Estás seguro de que deseas eliminar esta publicación permanentemente?")) {
        fetch(`https://tu-uni.onrender.com/ApiEliminarPublicacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id=${idPub}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                cargarPublicaciones();
            } else {
                alert("Error al eliminar la publicación: " + (data.message || "Permiso denegado"));
            }
        })
        .catch(err => console.error("Error al eliminar:", err));
    }
}

// =========================================================
// MODAL DE COMENTARIOS PARA PUBLICACIONES (VENTAS, EVENTOS, ETC.)
// =========================================================
window.abrirModalComentarios = function(idPub, tipoVisual) {
    const modalOverlay = document.getElementById("modalOverlay");
    const modalContent = document.getElementById("modalContent");

    if (!modalOverlay || !modalContent) {
        console.warn("No se encontró el modal reutilizable en el HTML.");
        return;   // <-- se sale sin hacer nada, sin error visible
    }

    modalContent.innerHTML = `
        <div style="font-family: system-ui, sans-serif;">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; color: #12203a; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                💬 Comentarios <span style="font-size: 12px; background: #eef1f6; color: #666; padding: 2px 8px; border-radius: 12px;">${tipoVisual}</span>
            </h3>
            
            <div id="modalListaComentarios" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; padding-right: 4px;">
                <p style="text-align: center; color: #888; font-size: 13px;">Cargando comentarios...</p>
            </div>

            <div style="display: flex; gap: 8px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                <input type="text" id="modalInputComentario" placeholder="Escribe un comentario..." 
                       style="flex-grow: 1; border: 1px solid #ccd6dd; border-radius: 20px; padding: 10px 14px; font-size: 13px; outline: none; background-color: #f8f9fa;">
                <button onclick="enviarComentarioModal(${idPub}, '${tipoVisual}')" 
                        style="background: #1da1f2; color: white; border: none; font-weight: bold; font-size: 13px; padding: 10px 18px; border-radius: 20px; cursor: pointer; transition: background 0.2s;">
                    Enviar
                </button>
            </div>
        </div>
    `;

    modalOverlay.style.display = "flex";

    setTimeout(() => {
        const input = document.getElementById("modalInputComentario");
        if (input) {
            input.addEventListener("keydown", function(e) {
                if (e.key === "Enter") {
                    enviarComentarioModal(idPub, tipoVisual);
                }
            });
        }
    }, 50);

    actualizarComentariosModal(idPub);
};

window.actualizarComentariosModal = function(idPub) {
    const lista = document.getElementById("modalListaComentarios");
    if (!lista) return;

    fetch(`https://tu-uni.onrender.com/ApiObtenerComentarios?idPublicacion=${idPub}`)
    .then(response => response.json())
    .then(comentarios => {
        if (!comentarios || comentarios.length === 0) {
            lista.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #888;">
                    <span style="font-size: 30px; display: block; margin-bottom: 6px;">💬</span>
                    <p style="margin: 0; font-size: 13px;">Aún no hay comentarios. ¡Sé el primero en opinar!</p>
                </div>`;
            return;
        }

        lista.innerHTML = "";
        comentarios.forEach(coment => {
            const div = document.createElement("div");
            div.style = "background: #f8f9fa; padding: 10px 12px; border-radius: 10px; border: 1px solid #e1e8ed; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.01);";
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 13px; color: #14171a;">${coment.autor}</strong>
                    <span style="font-size: 10px; color: #888;">${coment.fecha || ''}</span>
                </div>
                <p style="margin: 0; font-size: 13px; color: #333; line-height: 1.4;">${coment.descripcion}</p>
            `;
            lista.appendChild(div);
        });
        
        lista.scrollTop = lista.scrollHeight;
    })
    .catch(err => {
        console.error("Error al cargar comentarios del modal:", err);
        lista.innerHTML = `<p style="font-size: 12px; color: #e74c3c; text-align: center; margin: 10px 0;">Error al conectar con el servidor.</p>`;
    });
};

window.enviarComentarioModal = function(idPub, tipoVisual) {
    const input = document.getElementById("modalInputComentario");
    if (!input) return;

    const contenido = input.value.trim();
    if (contenido === "") return;

    const idUsuario = localStorage.getItem('idUsuario');

    fetch(`https://tu-uni.onrender.com/ApiGuardarComentario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `idPublicacion=${idPub}&idUsuarioAutor=${idUsuario}&descripcion=${encodeURIComponent(contenido)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            input.value = ""; 
            actualizarComentariosModal(idPub); 
            cargarPublicaciones(); 
        } else {
            alert("No se pudo enviar el comentario.");
        }
    })
    .catch(err => console.error("Error al comentar desde el modal:", err));
};
// =========================================================
// MODAL DETALLE DE PUBLICACIÓN (GLASSMORPHISM)
// =========================================================

// Abre el modal y clona visualmente la tarjeta seleccionada
function abrirDetallePublicacion(elementoCard) {
    const modal = document.getElementById('modalDetalle');
    const cuerpo = document.getElementById('modalDetalleCuerpo');
    
    if (!modal || !cuerpo) return;

    // Clonamos el contenido interno de la tarjeta que recibió el clic
    let contenidoClonado = elementoCard.innerHTML;

    // Quitamos botones o inputs que no queramos duplicar o que se rompan en el modal
    // Por ejemplo, el campo de responder rápido de foros si prefieres dejarlo limpio:
    const contenedorTemporal = document.createElement('div');
    contenedorTemporal.innerHTML = contenidoClonado;
    
    // (Opcional) Si quieres quitar la caja de "Escribe tu respuesta..." del clon en el modal:
    const respuestaRapida = contenedorTemporal.querySelector('[id^="respuestas-contenedor-"]');
    if (respuestaRapida) respuestaRapida.remove();

    // Inyectamos el contenido limpio en el cuerpo del modal
    cuerpo.innerHTML = contenedorTemporal.innerHTML;
    
    // Mostramos el modal aplicando la clase CSS
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden'; // Bloquea el scroll del fondo
}

// Cierra el modal de forma limpia
function cerrarModalDetalle(event) {
    // Si se hace clic en el fondo o en la X, cerramos
    if (!event || event.target === document.getElementById('modalDetalle')) {
        const modal = document.getElementById('modalDetalle');
        if (modal) {
            modal.classList.remove('activo');
            document.body.style.overflow = ''; // Devuelve el scroll a la página
        }
    }
}
// Función puente para compatibilidad con perfil.js y perfilAjeno.js
function reaccionar(tipo, idPublicacion) {
    if (tipo === 'like') {
        darLike(idPublicacion);
    } else if (tipo === 'favorito') {
        darFavorito(idPublicacion);
    }
}