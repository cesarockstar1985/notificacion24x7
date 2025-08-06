// Importa las librerías necesarias
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// --- CONFIGURACIÓN ---
// Google Sheets
const CREDENTIALS_PATH = './southern-guild-468213-u3-5195747113a5.json';
const SPREADSHEET_ID = '1RKXHlQVJJqWr8zNG3rFHQdAGSRx6vOr4B5IFvPYzSQE'; // Tu ID de Sheet
const RANGO = 'Calendario!H6:J17'; // ¡Ajusta el nombre de la hoja y el rango!
const MY_NAME = 'César Peralta';
// const MY_NAME = 'Javier Villalba';

// Telegram
const TELEGRAM_TOKEN = '8362932181:AAGsx2VhUSOLaDzvxz_K2AQKlW__sQKWIMI';
const CHAT_ID = '1076817858'; // El ID que obtuviste de @userinfobot
// --- FIN DE LA CONFIGURACIÓN ---


// Inicializa el bot de Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN);

async function leerSheetYNotificar() {
  console.log('Iniciando proceso...');
  try {
    // 1. AUTENTICACIÓN Y LECTURA DE GOOGLE SHEETS
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
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
            mensaje += 'ESTÁS DE SOPORTE PRINCIPAL ESTA SEMANA ';
        }

        if(soporteBackupSemana == MY_NAME){
            mensaje += 'ESTÁS DE SOPORTE BACKUP ESTA SEMANA ';
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
            mensaje += 'ESTÁS DE SOPORTE PRINCIPAL LA SIGUIENTE SEMANA ';
        }

        if(soporteBackupSemanaNextWeek == MY_NAME){
            mensaje += 'ESTÁS DE SOPORTE BACKUP LA SIGUIENTE SEMANA ';
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