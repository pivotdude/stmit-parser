const url = require('url');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const http = require('http');
const https = require('https');
const cron = require('node-cron');
require('dotenv').config();

const URL = 'http://stmit.ru/студенту/расписание/';
const previousHTMLFilePath = __dirname + "/temp.html"
// Токен вашего бота
const botToken = process.env.BOT_TOKEN;

// Идентификатор группы, в которую вы хотите отправить сообщение
const groupId = process.env.GROUP_ID;

// Путь к PDF-файлу
const DOCUMENT_PATH = __dirname + process.env.DOCUMENT_PATH

// Путь к папке, куда нужно сохранить файл
const folderPath = './document';

// Функция для получения HTML-страницы
async function getHTML(url) {
  try {
    console.log('Получение html')
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении HTML:', error);
    return null;
  }
}

async function runProgram () {
  // Получаем HTML-страницу
  const html = await getHTML(URL);

  if (!html) {
    throw new Error('Ошибка получения html')
  }
  // Проверяем изменения в HTML
  if (!hasHTMLChanged(html)) {
    return console.log("Изменений не найдено");
  }

  // Сохраняем текущую версию HTML
  saveHTMLToFile(html);

  // Загрузка Raw HTML в cheerio
  const $ = cheerio.load(html);

  // Поиск всех элементов "a"
  const links = $('a[download]');

  const extractedProps = links.map((index, element) => {
    const href = $(element).attr('href');
    const text = $(element).text();
    return { href, text };
  }).get();

  const reversed = extractedProps.reverse();

  reversed.map(async link => {
    // const fileName = await downloadAndSaveFile(prop.href);
    return sendMessage(link.href);
  })
}


const downloadAndSaveFile = async (fileUrl) => {
  // Извлекаем имя файла из URL
  const fileName = url.parse(fileUrl).pathname.split('/').pop();

  // Создаем папку, если она не существует
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  // Определяем, какой модуль использовать для загрузки файла (http или https)
  const downloadModule = url.parse(fileUrl).protocol === 'https:' ? https : http;

  // Создаем поток для записи файла
  const fileStream = fs.createWriteStream(`${folderPath}/${fileName}`);

  // Загружаем файл
  downloadModule.get(fileUrl, (response) => {
    response.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Файл ${fileName} успешно загружен и сохранен в папке document.`);
    });
  }).on('error', (err) => {
    console.error('Ошибка загрузки файла:', err.message);
  });

  return fileName;
}

// Функция для сохранения HTML в файл
function saveHTMLToFile(html) {
  fs.writeFileSync(previousHTMLFilePath, html);
}

// Функция для проверки изменений в HTML
function hasHTMLChanged(html) {
  if (!fs.existsSync(previousHTMLFilePath)) {
    // Если предыдущая версия HTML не существует, считаем, что HTML был изменен
    return true;
  }

  // Считываем предыдущую версию HTML из файла
  const previousHTML = fs.readFileSync(previousHTMLFilePath, 'utf8');

  // Сравниваем предыдущую версию HTML с текущей версией
  return previousHTML !== html;
}
console.log("Программа запущена")
// Определите расписание для выполнения функции runProgram каждые 30 минут
cron.schedule('*/30 10-16 * * *', () => {
  runProgram().catch(error => {
    throw new Error('Произошла ошибка при выполнении программы:', error);
  });
});
// runProgram()

async function sendMessage (fileName) {

  const options = {
    method: 'POST',
    url: `https://api.telegram.org/bot${botToken}/sendDocument`,
    headers: {
      accept: 'application/json',
      'User-Agent': 'Telegram Bot SDK - (https://github.com/irazasyed/telegram-bot-sdk)',
      'content-type': 'application/json'
    },
    data: {
      chat_id: groupId,
      document: fileName,
      // caption: 'Optional',
    }
  };
  
  axios
    .request(options)
    .then(function (response) {
      console.log("Сообщение отправлено");
    })
    .catch(function (error) {
      fs.writeFileSync(previousHTMLFilePath, "");
      throw new Error("Ошибка отправки сообщения");
    });
}  
