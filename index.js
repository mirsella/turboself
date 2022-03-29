const telegramnotif = require('telegramnotif');
const axios = require('axios')
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
puppeteer.use(StealthPlugin());
require('dotenv').config();

const debug = true;

const minimal_args = [
'--autoplay-policy=user-gesture-required',
'--disable-background-networking',
'--disable-background-timer-throttling',
'--disable-backgrounding-occluded-windows',
'--disable-breakpad',
'--disable-client-side-phishing-detection',
'--disable-component-update',
'--disable-default-apps',
'--disable-dev-shm-usage',
'--disable-domain-reliability',
'--disable-features=AudioServiceOutOfProcess',
'--disable-hang-monitor',
'--disable-ipc-flooding-protection',
'--disable-notifications',
'--disable-offer-store-unmasked-wallet-cards',
'--disable-popup-blocking',
'--disable-print-preview',
'--disable-prompt-on-repost',
'--disable-renderer-backgrounding',
'--disable-setuid-sandbox',
'--disable-speech-api',
'--disable-sync',
'--hide-scrollbars',
'--ignore-gpu-blacklist',
'--metrics-recording-only',
'--mute-audio',
'--no-default-browser-check',
'--no-first-run',
'--no-pings',
'--no-sandbox',
'--no-zygote',
'--password-store=basic',
'--use-gl=swiftshader',
'--use-mock-keychain',
'--allow-insecure-localhost',
];

(async () => {
  const browser = await puppeteer.launch({headless:true, args: minimal_args, defaultViewport: {width: 1280, height: 720}});
  const page = await browser.newPage();
  await page.setDefaultTimeout(60000);
  await page.goto('https://espacenumerique.turbo-self.com/Connexion.aspx', {waitUntil: 'networkidle0'})
  .catch(err => {
    page.screenshot({path: 'screenshot.png'});
    telegramnotif(process.env.TgId, process.env.TgToken, 'error turboself' + err)
  });

  await page.waitForSelector('#ctl00_cntForm_txtLogin')
  await page.type('#ctl00_cntForm_txtLogin', process.env.email, { delay: 50} )
  await page.type('#ctl00_cntForm_txtMotDePasse', process.env.passwd, { delay: 50} )
  await page.click('#ctl00_cntForm_btnConnexion')
  await page.waitForSelector('#ctl00_cntForm_UC_collapseMenu_lbtReserver')
    .catch(err => {
      page.screenshot({path: 'screenshot.png'});
      telegramnotif(process.env.TgId, process.env.TgToken, 'error turboself' + err)
    });
  debug && console.log("logged in")
  await page.click('#ctl00_cntForm_UC_collapseMenu_lbtReserver')
  await page.waitForSelector('#weeknumber_3')

  const money = parseFloat((await page.$eval('.prix', el => el.innerText)).split(' ')[0].replace(',', '.'))
  money <= 2.56 && telegramnotif(process.env.TgId, process.env.TgToken, `money is low ${money}€`)
  const reservations = await page.$$eval('.day_line', lines => {
    let reservation = []
    for (line of lines) {
      if (line.childElementCount > 1 && ! line.childNodes[1].className.includes('disabled')) {
        // reservation.push(line)
        reservation.push({
          date: line.childNodes[1].innerText,
          reserved: line.childNodes[2].childNodes[3].classList[1] === 'on' ? true : false
        })
      }
    }
    return reservation
  })
  browser.close()

  const months = { "JANV.": 0, "FÉVR.": 1, "MARS": 2, "AVR.": 3, "MAI.": 4, "JUIN.": 5, "JUIL.": 6, "AOU.": 7, "SEPT.": 8, "OCT.": 9, "NOV.": 10, "DÉC.": 11 }

  // blacklist date in format DD/MM/YY+HowManyDays ex 20/12/21+14 to blacklist christmas holidays for me
  blacklist = []
  await axios.get(process.env.url)
  .then(res => {
    if (res.status === 200) {
      dateblacklist = res.data.split('+')
      d = dateblacklist[0].split('/')
      debug && console.log(d, dateblacklist[1])
      day = d[0]
      month = d[1] - 1
      year = d[2]
      currentyear = new Date().getFullYear()
      blacklistdate = new Date(currentyear.toString().substring(0,2) + year, month, day)
      blacklist = []
      for (let i = 0; i <= (dateblacklist[1] || 1); i += 1) {
        date = new Date(blacklistdate)
        date.setDate(date.getDate() + i)
        blacklist.push(date.getTime())
      }
    }
  })
  debug && console.log("blacklist", blacklist.map(date => new Date(date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris'})))

  today = new Date()
  today.setHours(0,0,0,0);

  nextweek = new Date()
  nextweek.setHours(0,0,0,0);
  nextweek.setDate(nextweek.getDate()+7)

  for (reservation of reservations) {
    d = reservation.date.split(' ')
    date = new Date()
    date.setHours(0,0,0,0);
    date.setDate(parseInt(d[1]))
    date.setMonth(months[d[2].toUpperCase()])

    if (! reservation.reserved && ! blacklist.includes(date.getTime())) {
      // debug && console.log('not reserved', date.toString())
      if (date.getTime() === today.getTime()) {
        telegramnotif(process.env.TgId, process.env.TgToken, `today is not reserved ! ${reservation.date}`)
      } else if (date <= nextweek) {
        telegramnotif(process.env.TgId, process.env.TgToken, `${reservation.date} is not reserved in the following week !`)
      }
    }
  }
})()
  .catch(e => {
    debug && console.log('catch', e)
    telegramnotif(process.env.TgId, process.env.TgToken, 'error turboself' + e)
      .catch(e => {
        fs.writeFileSync('error.txt', e)
      })
  })
