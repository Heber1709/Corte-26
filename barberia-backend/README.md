# Ejecutar el backend localmente

Requisitos: Node.js compatible con el proyecto y PostgreSQL en ejecución.

1. Desde esta carpeta, ejecutar `npm ci`.
2. Copiar `.env.example` a `.env` y completar las credenciales propias.
   No sobrescribir un `.env` existente ni subirlo a GitHub.
3. Crear una base PostgreSQL de desarrollo vacía llamada `corte26`.
4. Ejecutar `npx prisma generate` y `npx prisma migrate deploy`.
5. Opcional, solo en una base de pruebas: `npx prisma db seed`.
   ATENCIÓN: el seed actual borra usuarios, servicios, citas y registros existentes.
6. Ejecutar `npm run start:dev`.

API: http://localhost:3000
Documentación: http://localhost:3000/api/docs
Frontend: en otra terminal, ir a `../barberia-frontend` y ejecutar `npm start`.
Abrir http://localhost:4200.

## Credenciales

- `DATABASE_URL`: conexión a la base PostgreSQL propia. Codificar los caracteres
  especiales de usuario/contraseña cuando se incluyan en la URL.
- `JWT_SECRET`: clave aleatoria propia para firmar sesiones.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: cliente OAuth de tipo Aplicación web
  creado en Google Cloud / Google Auth Platform.
- `GOOGLE_CALLBACK_URL`: http://localhost:3000/auth/google/callback.
  Registrar esa misma URI en el cliente OAuth de Google.
- `GEMINI_API_KEY`: clave personal de Google AI Studio para el chatbot y visagismo.

El backend actual requiere las credenciales de Google y Gemini para iniciar.
La carga de `.env` se realiza al arrancar el backend.

## Trabajo en equipo

Compartir el código, `package-lock.json`, `.env.example` y las migraciones de Prisma.
Cada integrante mantiene su propio `.env` y sus datos locales.
Después de descargar cambios, ejecutar `npm ci` si cambiaron dependencias,
`npx prisma generate` y `npx prisma migrate deploy` si cambiaron modelos/migraciones.
Quien modifique modelos debe crear y revisar una migración con
`npx prisma migrate dev --name descripcion` en su base de desarrollo y subirla.
No ejecutar `db seed` sobre datos que se quieran conservar.

En Windows se puede usar `npm.cmd` y `npx.cmd` si PowerShell bloquea los scripts.
Desde la carpeta raíz, VS Code ofrece Terminal > Ejecutar tarea >
Frontend: iniciar / Backend: iniciar.

## Funciones integradas y permisos

La interfaz conserva Dashboard, Clientes, Barberos, Servicios, Agendar cita y
Fidelización. Clientes usa registros reales y permite registro, edición e historial.
Administradores gestionan barberos y servicios; los barberos gestionan su agenda.
Clientes consultan su propia información y citas. Todos pueden consultar el catálogo,
reservar con su cuenta y usar el asistente y análisis de imágenes autenticados.

Horario de reservas: 11:00 a 19:30, zona de Guatemala (UTC-06), con 5 minutos
entre servicios. Reservas simultáneas se validan dentro de una transacción.
Completar una cita acredita puntos una sola vez. Cancelar devuelve los puntos
originalmente descontados, aunque cambie el precio de canje del servicio.
Tres inasistencias bloquean nuevas reservas; el administrador puede reactivar
la cuenta desde Fidelización. No se reinicia ni se vacía la base al arrancar.

`FRONTEND_URL` configura CORS y el regreso de OAuth; por defecto localhost:4200.
`GEMINI_MODEL` permite elegir un modelo disponible para la cuenta de Google.
`ENABLE_DEV_LOGIN` está desactivado por defecto; el acceso normal usa Google.
No activar acceso por correo sin verificación en un servidor compartido.

Para asignar el primer administrador, actualizar explícitamente el rol del usuario
correspondiente en la base local después de su primer ingreso con Google.
Registrar un barbero con el mismo correo que utilizará para entrar con Google.

## Verificación de integración local

Con el backend en ejecución: `node scripts/integration.cjs`.
La prueba crea registros temporales y los elimina al terminar. Verifica acceso,
roles, validación, reservas simultáneas, propiedad de citas, devoluciones, puntos,
inasistencias y reactivación. No usa credenciales de Google ni imprime tokens.
No ejecutar sobre una base de producción.

Para compartir los cambios hay que incluir todas las migraciones nuevas,
el código y `.env.example`; cada compañero ejecuta `npx prisma migrate deploy`
y `npx prisma generate` después de descargar el código. No usar `db seed` para
actualizar una base existente: ese script borra los datos anteriores.

## Invitaciones de administradores

Configurar RESEND_API_KEY e INVITATION_FROM (correo de un dominio verificado en Resend) solo en el backend. FRONTEND_URL debe ser la dirección pública del frontend para invitaciones reales. Aplicar las migraciones con npx prisma migrate deploy.

Crear una cuenta administradora envía una invitación de 48 horas. Hasta aceptarla con la misma cuenta de Google, el usuario sigue siendo CLIENT. El panel se actualiza cada 10 segundos cuando está visible. Las cuentas administradoras anteriores mantienen el acceso. Reenviar invalida el enlace anterior; quitar acceso también cancela cualquier invitación pendiente. Los tokens se guardan como hashes y la aceptación es de un solo uso. Si el proveedor rechaza el correo, se muestra Error de envío, no Solicitud enviada. Enviado significa aceptado por el proveedor; no confirma la entrega en la bandeja del destinatario.

### Envio con Gmail sin dominio propio

Configurar MAIL_PROVIDER=gmail, GMAIL_USER (cuenta remitente) y GMAIL_APP_PASSWORD (contraseña de aplicación de Google, nunca la contraseña normal). Para Gmail no se usan RESEND_API_KEY ni INVITATION_FROM. La conexión usa SMTP con STARTTLS obligatorio en smtp.gmail.com:587. Guardar las variables tanto en .env local como en Vercel/backend y volver a desplegar. FRONTEND_URL en producción debe apuntar a https://barberia-corte-26.vercel.app para que el destinatario pueda aceptar desde su dispositivo.

### Registro por correo y contraseña

El login permite registrar cuentas nuevas de cliente. POST /auth/register envía un enlace de un solo uso (24 horas); POST /auth/accept-registration lo consume y crea la cuenta. POST /auth/login requiere correo y contraseña; ya no permite el acceso de desarrollo solo con correo. Las cuentas existentes de Google mantienen ese método y no se les asigna una contraseña mediante registro público.

Aplicar 20261019000000_email_registration con `npx prisma migrate deploy` antes de iniciar el backend. Reutiliza MAIL_PROVIDER, GMAIL_USER, GMAIL_APP_PASSWORD y FRONTEND_URL existentes. No agrega dependencias. Las contraseñas se derivan con scrypt y sal aleatoria; los tokens de confirmación se guardan como SHA-256. Tras 5 contraseñas incorrectas se bloquea ese acceso durante 15 minutos. El reenvío al mismo correo tiene una espera de 60 segundos y reemplaza la invitación anterior.

Validación local: `npm run build` y `node scripts/password-auth.cjs`. La prueba requiere base local, crea y elimina solo sus fixtures y sustituye el envío por un mock; no envía correos reales. La entrega real debe verificarse con una cuenta nueva desde producción.
