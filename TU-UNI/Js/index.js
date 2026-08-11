const datos = new URLSearchParams();
datos.append('correo', correoIngresado);
datos.append('contrasena', passwordIngresado);

fetch("https://tu-uni.onrender.com/ApiLogin", {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded"
    },
    body: datos
})