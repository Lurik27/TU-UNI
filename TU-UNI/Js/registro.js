// =========================================================
// REGISTRO DE USUARIOS
// =========================================================
document.getElementById('btnRegistrar').addEventListener('click', function() {
    const usuario = document.getElementById('usuario').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;

    // 1. Validar campos vacíos
    if(!usuario || !nombre || !correo || !password || !password2) {
        mostrarToast("Por favor, llena todos los campos.", "red");
        return;
    }

    // 2. Validar que las contraseñas coincidan
    if(password !== password2) {
        mostrarToast("Las contraseñas no coinciden.", "red");
        return;
    }

    // 3. Validar terminación obligatoria @upsin.edu.mx
    const regexUpsin = /^[a-zA-Z0-9._%+-]+@upsin\.edu\.mx$/;
    if(!regexUpsin.test(correo)) {
        mostrarToast("El correo debe de ser institucional", "red");
        return;
    }

    mostrarToast("Conectando al servidor...", "orange");

    // Enviamos los datos ordenados a NetBeans
    const urlNetBeans = 'https://tu-uni.onrender.com/ApiConexion';
    
    fetch(urlNetBeans, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `usuario=${encodeURIComponent(usuario)}&nombre=${encodeURIComponent(nombre)}&correo=${encodeURIComponent(correo)}&contrasena=${encodeURIComponent(password)}`
    })
    .then(response => {
        if (!response.ok) {
            // Si el servidor responde con un error (ej. 400 o 500), intentamos leer el JSON de error
            return response.json().then(errData => { throw new Error(errData.message || "Error en el registro"); });
        }
        return response.json();
    })
.then(data => {
        if(data.status === "success" || data.status === "ok") {
            mostrarToast("¡Registro exitoso! Por favor, inicia sesión con tu nueva cuenta.", "green");
            document.getElementById('formRegistro').reset(); // Limpia el formulario
            
            // Redirigir al LOGIN manual después de 2 segundos (NO al inicio de sesión automático)
            setTimeout(() => {
                window.location.href = "/Index.html"; // Cambia esta URL por la de tu pantalla de Login manual
            }, 2000);
        } else {
            mostrarToast(data.message, "red");
        }
    })    .catch(error => {
        console.error('Error:', error);
        mostrarToast(error.message || "Error: No se pudo comunicar con NetBeans.", "red");
    });
});

// =========================================================
// FUNCIÓN PARA MOSTRAR ALERTAS (TOAST)
// =========================================================
let toastTimeout;

function mostrarToast(mensaje, color) {
    let alerta = document.getElementById('mensaje-alerta');
    
    // Si por alguna razón no existe el contenedor en tu HTML, lo creamos dinámicamente
    if (!alerta) {
        alerta = document.createElement('div');
        alerta.id = 'mensaje-alerta';
        document.body.appendChild(alerta);
    }
    
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

    if (color === "red") alerta.style.backgroundColor = "#e74c3c";
    else if (color === "orange") alerta.style.backgroundColor = "#f39c12";
    else if (color === "green") alerta.style.backgroundColor = "#2ecc71";
    
    alerta.innerText = mensaje;

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        alerta.style.opacity = "0";
        alerta.style.transform = "translateY(-20px)";
    }, 3500);
}