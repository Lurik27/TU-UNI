// =========================================================
// GESTIÓN DEL LOGIN Y CONTROL DE ALERTAS (TOAST)
// =========================================================
document.getElementById('btnIngresar').addEventListener('click', function() {
    const identificador = document.getElementById('identificador').value.trim();
    const password = document.getElementById('password').value;

    // 1. Validar que no haya campos vacíos en el formulario
    if (!identificador || !password) {
        mostrarToast("Por favor, ingresa tu usuario/correo y contraseña.", "red");
        return;
    }

    mostrarToast("Validando credenciales...", "orange");

    // Enviamos los datos ordenados al Servlet ApiLogin en NetBeans
    const urlNetBeans = 'https://tu-uni.onrender.com/ApiLogin';
    
    fetch(urlNetBeans, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `identificador=${encodeURIComponent(identificador)}&password=${encodeURIComponent(password)}`
    })
    .then(response => {
        // Si el servidor responde con un error de código (Ej: 500 o 404), saltamos directo al catch
        if (!response.ok) throw new Error("Error de comunicación con el servidor.");
        return response.json();
    })
    .then(data => {
        if (data && data.status === "success") {
            // PROTECCIÓN: Si data.message no existe o es nulo, usa este texto por defecto
            const msgExito = data.message || "¡Inicio de sesión correcto! Redirigiendo...";
            mostrarToast(msgExito, "green");
            
            // Guardamos las variables de sesión de manera segura
            localStorage.setItem('idUsuario', data.idUsuario); 
            localStorage.setItem('usuarioLogueado', data.usuario);
            localStorage.setItem('nombreLogueado', data.nombre);
            localStorage.setItem('correoLogueado', data.correo);
            localStorage.setItem('fotoLogueado', data.foto);
            
            // Redirigir al usuario al inicio después de 1 segundo
            setTimeout(() => { window.location.href = "/html/inicio.html"; }, 1000);
        } else {
            // PROTECCIÓN: Si las credenciales fallan y Java no envía un texto, se evita el undefined
            const msgError = (data && data.message) ? data.message : "Usuario o contraseña incorrectos. Inténtalo de nuevo.";
            mostrarToast(msgError, "red");
        }
    })
    .catch(error => {
        console.error('Error de Login:', error);
        // PROTECCIÓN: Si NetBeans está apagado o el JSON está roto, se muestra este aviso fijo
        mostrarToast("No se pudo conectar con el servidor de la universidad. Inténtalo más tarde.", "red");
    });
});

let toastTimeout;

// Función con estilos inyectados directamente para garantizar el comportamiento flotante
function mostrarToast(mensaje, color) {
    const alerta = document.getElementById('mensaje-alerta');
    if (!alerta) return; // Protección por si no existe el contenedor en el HTML

    alerta.style.position = "fixed";
    alerta.style.top = "20px";
    alerta.style.right = "20px";
    alerta.style.padding = "15px 25px";
    alerta.style.color = "white";
    alerta.style.fontWeight = "bold";
    alerta.style.borderRadius = "8px";
    alerta.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
    alerta.style.fontFamily = "Arial, sans-serif";
    alerta.style.fontSize = "14px";
    alerta.style.zIndex = "99999";
    alerta.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    alerta.style.opacity = "1";
    alerta.style.transform = "translateY(0)";

    // Asignación de colores según el estado
    if (color === "red") alerta.style.backgroundColor = "#e74c3c";
    else if (color === "orange") alerta.style.backgroundColor = "#f39c12";
    else if (color === "green") alerta.style.backgroundColor = "#2ecc71";
    
    // Inyectamos el texto limpio
    alerta.innerText = mensaje;

    // Reseteamos el temporizador para que no se encimen los cierres si dan muchos clics
    clearTimeout(toastTimeout);

    // Animación de salida a los 3.5 segundos
    toastTimeout = setTimeout(() => {
        alerta.style.opacity = "0";
        alerta.style.transform = "translateY(-20px)";
    }, 3500);
}