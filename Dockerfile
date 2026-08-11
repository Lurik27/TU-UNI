# Usamos una imagen ligera de Tomcat con Java 17
FROM tomcat:9.0-jdk17-openjdk-slim

# Borramos las aplicaciones por defecto de Tomcat
RUN rm -rf /usr/local/tomcat/webapps/*

# Copiamos TU archivo .war desde la raíz del repositorio
# y lo renombramos a ROOT.war para que sea la app principal
COPY ConexionJava.war /usr/local/tomcat/webapps/ROOT.war

# Exponemos el puerto 8080 (puerto por defecto de Tomcat)
EXPOSE 8080

# Comando para iniciar Tomcat
CMD ["catalina.sh", "run"]
