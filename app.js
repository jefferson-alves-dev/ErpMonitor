const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');
const dotenv = require('dotenv').config();

const url = 'https://accounts.google.com/';
const dirSession = path.resolve(__dirname, 'dirSession');

async function runBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: dirSession,
    devtools: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--single-process',
      '--no-zygote',
      '--no-first-run',
      '--window-size=640,400',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-skip-list',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-notifications',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
    ],
  });
  const page = await browser.newPage();
  return page;
}

async function init() {
  const page = await runBrowser();
  await page.goto(url);
  const currentUrl = page.url();

  // Need to do login
  if (currentUrl.indexOf('signin/identifier') !== -1) {
    console.log('Iniciando login do zero...');
    const inputEmail = await page.waitForXPath('//input[@type="email"]');
    await inputEmail.type(process.env.GOOGLE_USERNAME_LOGIN, { delay: 50 });

    const btnNext = await page.waitForXPath(
      '/html/body/div[1]/div[1]/div[2]/div/c-wiz/div/div[2]/div/div[2]/div/div[1]/div/div/button'
    );
    await btnNext.click();

    await delay(2000);

    const inputPassword = await page.waitForXPath('//input[@type="password"]');
    await inputPassword.type(process.env.GOOGLE_PASSWORD_LOGIN, { delay: 50 });
    await page.keyboard.press('Enter');

    try {
      await page.waitForXPath(
        '//h2[contains(text(),"Privacidade e personalização")]',
        { timeout: 10000 }
      );
      console.log('Iniciando função para chamar ERP.');
      erpInit(page);
    } catch (error) {
      console.log(
        `There was an erro to do login Google account!\nError: ${error}`
      );
    }
  }

  // Need to select email to do login
  if (currentUrl.indexOf('ServiceLogin/signinchooser') !== -1) {
    console.log('Selecionando email para logar...');
    const emailElement = await page.waitForXPath(
      '/html/body/div[1]/div[1]/div[2]/div/div[2]/div/div/div[2]/div/div[1]/div/form/span/section/div/div/div/div/ul/li[1]'
    );
    await emailElement.click();

    await delay(2000);

    const inputPassword = await page.waitForXPath('//input[@type="password"]');
    await inputPassword.type(process.env.GOOGLE_PASSWORD_LOGIN, { delay: 80 });
    await page.keyboard.press('Enter');

    try {
      await page.waitForXPath(
        '//h2[contains(text(),"Privacidade e personalização")]'
      );
      console.log('Iniciando função para chamar ERP.');
      erpInit(page);
    } catch (error) {
      console.log(
        `There was an erro to do login Google account!\nError: ${error}`
      );
    }
  }

  //Already logged
  if (currentUrl.indexOf('myaccount.google.com/') !== -1) {
    erpInit(page);
  }
}

async function erpInit(browserInstance) {
  console.log('Navegando para o ERP');
  const page = browserInstance;
  await page.goto(process.env.URL_LOGIN_ERP);

  await delay(2000);

  const needLogin = await page.waitForXPath(
    '//h3[contains(text(),"Login administrativo")]',
    {
      timeout: 10000,
    }
  );

  if (needLogin) {
    console.log('Iniciando clique para autenticar ERP no Google.');
    const btnLogin = await page.waitForXPath(
      '/html/body/div[1]/form[1]/div[1]/div/button'
    );
    await btnLogin.click();
  }

  console.log('Aguardando 5 segundos antes de iniciar.');
  await delay(5000);

  await page.goto(process.env.URL_BASE_ERP);

  console.log('Aguardando navbar ficar disponível.');
  await page.waitForXPath('/html/body/div[1]'); // wait navbar element

  const cookies = await page.cookies();
  let arrayCookies = [];
  cookies.forEach((cookie) => {
    cookie.name == 'ERP'
      ? arrayCookies.push(`${cookie.name}=${cookie.value}`)
      : null;
  });
  workOrderHandler(arrayCookies[0]);
}

async function workOrderHandler(cookie) {
  console.log('Obtendo ordens de serviço em aberto...');
  const openOrders = await getOrders(cookie);
  const orders = { ...openOrders };
  console.log(orders);
}

async function getOrders(cookie) {
  const options = {
    method: 'POST',
    url: process.env.URL_ORDERS_LIST_ERP,
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'pt-BR',
      Cookie: `${cookie}`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: { 'cod_setor[]': '3', 'cod_tipo_status_oco[]': '1' },
  };

  const response = await axios.request(options);

  return response.data;
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

init();
