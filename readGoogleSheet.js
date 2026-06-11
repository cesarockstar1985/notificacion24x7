// Importa las librerías necesarias
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

require('dotenv').config();

const { CREDENTIALS_PATH, GOOGLE_CREDENTIALS, SPREADSHEET_ID, TELEGRAM_TOKEN, CHAT_ID } = process.env

// En Railway usamos la variable de entorno GOOGLE_CREDENTIALS (contenido del JSON).
// En local seguimos usando el archivo apuntado por CREDENTIALS_PATH.
const googleAuthOptions = GOOGLE_CREDENTIALS
  ? { credentials: JSON.parse(GOOGLE_CREDENTIALS) }
  : { keyFile: CREDENTIALS_PATH };

// --- CONFIGURACIÓN ---
// Google Sheets
const RANGO = 'Calendario!H6:J17'; // ¡Ajusta el nombre de la hoja y el rango!
const MY_NAME = 'César Peralta';

// Inicializa el bot de Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const nombreUsuario = msg.from.first_name;

  const mensajeBienvenida = `¡Hola, ${nombreUsuario}! 👋\n\nSoy tu bot notificador. Estoy activo y funcionando.\n\nRevisaré tu Google Sheet todos los días a las 7:00 AM y te avisaré si encuentro datos nuevos.`;

  bot.sendMessage(chatId, mensajeBienvenida);
  console.log(`El usuario ${nombreUsuario} (ID: ${chatId}) ha iniciado el bot.`);

  leerSheetYNotificar()
});

async function formatText(mainText, weekText) {
  return `ESTÁS DE SOPORTE ${mainText} ${weekText} `;
}

async function leerSheetYNotificar() {
  console.log('Iniciando proceso...');
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
    console.log('Datos leídos correctamente.');
    const soportePrincipalSemana = rows[0][0];
    const soporteBackupSemana = rows[0][2];

    const soportePrincipalWeekEnd = rows[3][0];
    const soporteBackupWeekEnd = rows[3][2];

    const soportePrincipalSemanaNextWeek = rows[8][0];
    const soporteBackupSemanaNextWeek = rows[8][2];

    const soportePrincipalWeekEndNextWeek = rows[11][0];
    const soporteBackupWeekEndNextWeek = rows[11][2];

    // 2. PROCESAMIENTO DE DATOS Y ENVÍO POR TELEGRAM
    if (rows && rows.length) {
      // Formatea los datos para el mensaje
      let mensaje = '🔔 **Soporte 24x7** 🔔\n\n';

        if(soportePrincipalSemana == MY_NAME){
            mensaje += formatText('PRINCIPAL', 'ESTA SEMANA');
        }

        if(soporteBackupSemana == MY_NAME){
            mensaje += formatText('BACKUP', 'ESTA SEMANA');
        }

        if((soportePrincipalSemana == MY_NAME && soportePrincipalWeekEnd == MY_NAME) || (soporteBackupSemana == MY_NAME && soporteBackupWeekEnd == MY_NAME)){
            mensaje += 'Y '
        }

        if(soportePrincipalWeekEnd == MY_NAME || soporteBackupWeekEnd == MY_NAME){
            mensaje += 'ESTE FIN DE SEMANA!!\n\n';
        }

        mensaje += `Principal: ${soportePrincipalSemana}\n`
        mensaje += `Backup: ${soporteBackupSemana}`

        mensaje += '\n\nSoporte Fin de semana\n\n'

        mensaje += `Principal: ${soportePrincipalWeekEnd}\n`
        mensaje += `Backup: ${soporteBackupWeekEnd}\n\n`

        if(soportePrincipalSemanaNextWeek == MY_NAME){
            mensaje += formatText('PRINCIPAL', 'LA SIGUIENTE SEMANA');
        }

        if(soporteBackupSemanaNextWeek == MY_NAME){
            mensaje += formatText('BACKUP', 'LA SIGUIENTE SEMANA');
        }

        if((soportePrincipalSemanaNextWeek == MY_NAME && soportePrincipalWeekEndNextWeek == MY_NAME) || (soporteBackupSemanaNextWeek == MY_NAME && soporteBackupWeekEndNextWeek == MY_NAME)){
            mensaje += 'Y '
        }

        if(soportePrincipalWeekEndNextWeek == MY_NAME || soporteBackupWeekEndNextWeek == MY_NAME){
            mensaje += 'EL SIGUIENTE FIN DE SEMANA!!\n\n';
        }

      console.log('Enviando notificación a Telegram...');
      // Envía el mensaje usando el bot
      await bot.sendMessage(CHAT_ID, mensaje, { parse_mode: 'Markdown' });
      
      console.log('¡Notificación enviada con éxito! ✅');
    } else {
      console.log('No se encontraron datos en el Sheet.');
      // Opcional: enviar una notificación de que no se encontraron datos
      // await bot.sendMessage(CHAT_ID, 'No se encontraron datos nuevos en la revisión de hoy.');
    }
  } catch (error) {
    console.error('Hubo un error en el proceso:', error.message);
    // Opcional: Notificar el error por Telegram
    try {
      await bot.sendMessage(CHAT_ID, `❌ Hubo un error en el bot: ${error.message}`);
    } catch (telegramError) {
      console.error('Error al enviar la notificación de error:', telegramError.message);
    }
  }
}

// 2. PROGRAMA LA TAREA PARA QUE SE EJECUTE TODOS LOS DÍAS A LAS 9:00 AM
cron.schedule('0 7 * * *', () => {
  leerSheetYNotificar();
}, {
  scheduled: true,
  timezone: "America/Asuncion" // <-- Es buena práctica definir la zona horaria
});

// 3. MENSAJE PARA SABER QUE EL SCRIPT ESTÁ CORRIENDO
console.log('🤖 Bot iniciado. Esperando la hora programada para enviar notificaciones...');