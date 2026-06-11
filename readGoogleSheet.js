// Importa las librerías necesarias
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

require('dotenv').config();

const { CREDENTIALS_PATH, GOOGLE_CREDENTIALS, SPREADSHEET_ID, TELEGRAM_TOKEN } = process.env

// En Railway usamos la variable de entorno GOOGLE_CREDENTIALS (contenido del JSON).
// En local seguimos usando el archivo apuntado por CREDENTIALS_PATH.
const googleAuthOptions = GOOGLE_CREDENTIALS
  ? { credentials: JSON.parse(GOOGLE_CREDENTIALS) }
  : { keyFile: CREDENTIALS_PATH };

// --- CONFIGURACIÓN ---
// Google Sheets
const RANGO = 'Calendario!H6:J17'; // ¡Ajusta el nombre de la hoja y el rango!
const MY_NAME = 'César Peralta';

// Último chat que interactuó con el bot; lo usa el cron diario como destino.
let ultimoChatId = null;

// Inicializa el bot de Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Registra los comandos para que aparezcan en el botón de menú de Telegram
bot.setMyCommands([
  { command: 'start', description: 'Iniciar el bot y ver el mensaje de bienvenida' },
  { command: 'check', description: 'Revisar el Google Sheet ahora' },
  { command: 'status', description: 'Ver el estado del bot' },
  { command: 'help', description: 'Ver la lista de comandos' },
]);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  ultimoChatId = chatId;
  const nombreUsuario = msg.from.first_name;

  const mensajeBienvenida = `¡Hola, ${nombreUsuario}! 👋\n\nSoy tu bot notificador. Estoy activo y funcionando.\n\nRevisaré tu Google Sheet todos los días a las 7:00 AM y te avisaré si encuentro datos nuevos.`;

  bot.sendMessage(chatId, mensajeBienvenida);
  console.log(`El usuario ${nombreUsuario} (ID: ${chatId}) ha iniciado el bot.`);
});

// Comando para forzar una revisión manual del Sheet
bot.onText(/\/check/, (msg) => {
  const chatId = msg.chat.id;
  ultimoChatId = chatId;
  console.log(`Revisión manual solicitada por chat ${chatId}.`);
  bot.sendMessage(chatId, '🔎 Revisando el Google Sheet...');
  leerSheetYNotificar(chatId, true);
});

// Comando para ver la lista de comandos disponibles
bot.onText(/\/help/, (msg) => {
  const ayuda = '🤖 *Comandos disponibles*\n\n' +
    '/start - Iniciar el bot y ver la bienvenida\n' +
    '/check - Revisar el Google Sheet ahora\n' +
    '/status - Ver el estado del bot\n' +
    '/help - Ver esta lista de comandos';
  bot.sendMessage(msg.chat.id, ayuda, { parse_mode: 'Markdown' });
});

// Comando para ver el estado del bot
bot.onText(/\/status/, (msg) => {
  const destino = ultimoChatId
    ? `\`${ultimoChatId}\``
    : 'ninguno todavía (escribí /check o /start)';
  const estado = '✅ *Bot activo*\n\n' +
    `👤 Monitoreando a: *${MY_NAME}*\n` +
    '⏰ Aviso automático: todos los días a las 7:00 AM (America/Asuncion)\n' +
    `📨 Chat de avisos: ${destino}`;
  bot.sendMessage(msg.chat.id, estado, { parse_mode: 'Markdown' });
});

// Arma una sola alerta por periodo combinando el turno entre semana y el de fin de semana.
// Devuelve null si en ese periodo no te toca soporte.
function construirAlerta(periodo, principalSemana, backupSemana, principalFinde, backupFinde) {
  const rolSemana = principalSemana == MY_NAME ? 'PRINCIPAL' : (backupSemana == MY_NAME ? 'BACKUP' : null);
  const rolFinde = principalFinde == MY_NAME ? 'PRINCIPAL' : (backupFinde == MY_NAME ? 'BACKUP' : null);

  if (!rolSemana && !rolFinde) return null;

  const partes = [];
  if (rolSemana) partes.push(`${rolSemana} entre semana`);
  if (rolFinde) partes.push(`${rolFinde} el fin de semana`);
  return `⚠️ ${periodo} estás de soporte ${partes.join(' y ')}`;
}

// forzar = true (comando /check manual) responde siempre, aunque no te toque soporte.
// forzar = false (cron automático) solo notifica cuando te toca soporte.
async function leerSheetYNotificar(destinoChatId, forzar = false) {
  console.log('Iniciando proceso...');
  if (!destinoChatId) {
    console.log('No hay un chat destino; nadie ha iniciado el bot todavía. Omitiendo notificación.');
    return;
  }
  try {
    // 1. AUTENTICACIÓN Y LECTURA DE GOOGLE SHEETS
    const auth = new google.auth.GoogleAuth({
      ...googleAuthOptions,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('Obteniendo datos del Sheet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGO,
    });
    
    const rows = response.data.values;

    // La API recorta las filas vacías del final, así que validamos antes de usarlas.
    if (!rows || !rows.length) {
      console.log('No se encontraron datos en el Sheet.');
      return;
    }
    console.log('Datos leídos correctamente.');

    // Acceso seguro: si la fila no existe (rango recortado) devuelve cadena vacía.
    const celda = (fila, col) => (rows[fila] && rows[fila][col]) || '';

    const soportePrincipalSemana = celda(0, 0);
    const soporteBackupSemana = celda(0, 2);

    const soportePrincipalWeekEnd = celda(3, 0);
    const soporteBackupWeekEnd = celda(3, 2);

    const soportePrincipalSemanaNextWeek = celda(8, 0);
    const soporteBackupSemanaNextWeek = celda(8, 2);

    const soportePrincipalWeekEndNextWeek = celda(11, 0);
    const soporteBackupWeekEndNextWeek = celda(11, 2);

    // 2. PROCESAMIENTO DE DATOS Y ENVÍO POR TELEGRAM
    {
      // Formatea los datos para el mensaje
      let mensaje = '🔔 **Soporte 24x7** 🔔\n\n';

        // Alertas: una sola línea por periodo, combinando semana y fin de semana.
        const alertas = [];
        const alertaEstaSemana = construirAlerta('Esta semana', soportePrincipalSemana, soporteBackupSemana, soportePrincipalWeekEnd, soporteBackupWeekEnd);
        const alertaProximaSemana = construirAlerta('La próxima semana', soportePrincipalSemanaNextWeek, soporteBackupSemanaNextWeek, soportePrincipalWeekEndNextWeek, soporteBackupWeekEndNextWeek);
        if (alertaEstaSemana) alertas.push(alertaEstaSemana);
        if (alertaProximaSemana) alertas.push(alertaProximaSemana);

        // Si no te toca soporte y es el aviso automático, no enviamos nada.
        if (!alertas.length && !forzar) {
            console.log('No te toca soporte. Aviso automático omitido.');
            return;
        }

        if (alertas.length) {
            mensaje += alertas.join('\n') + '\n\n';
        } else {
            mensaje += '✅ No te toca soporte por ahora.\n\n';
        }

        mensaje += 'Soporte Semana\n\n'
        mensaje += `Principal: ${soportePrincipalSemana}\n`
        mensaje += `Backup: ${soporteBackupSemana}`

        mensaje += '\n\nSoporte Fin de semana\n\n'

        mensaje += `Principal: ${soportePrincipalWeekEnd}\n`
        mensaje += `Backup: ${soporteBackupWeekEnd}\n\n`

      console.log('Enviando notificación a Telegram...');
      // Envía el mensaje usando el bot
      await bot.sendMessage(destinoChatId, mensaje, { parse_mode: 'Markdown' });

      console.log('¡Notificación enviada con éxito! ✅');
    }
  } catch (error) {
    console.error('Hubo un error en el proceso:', error.message);
    // Opcional: Notificar el error por Telegram
    try {
      await bot.sendMessage(destinoChatId, `❌ Hubo un error en el bot: ${error.message}`);
    } catch (telegramError) {
      console.error('Error al enviar la notificación de error:', telegramError.message);
    }
  }
}

// 2. PROGRAMA LA TAREA PARA QUE SE EJECUTE TODOS LOS DÍAS A LAS 7:00 AM
cron.schedule('0 7 * * *', () => {
  leerSheetYNotificar(ultimoChatId);
}, {
  scheduled: true,
  timezone: "America/Asuncion" // <-- Es buena práctica definir la zona horaria
});

// 3. MENSAJE PARA SABER QUE EL SCRIPT ESTÁ CORRIENDO
console.log('🤖 Bot iniciado. Esperando la hora programada para enviar notificaciones...');