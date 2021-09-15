const telegramnotif = require('telegramnotif');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin());
require('dotenv').config();
(async () => {
  const browser = await puppeteer.launch({headless:true, defaultViewport: {width: 1280, height: 720}});
  const page = await browser.newPage();
  await page.goto('https://espacenumerique.turbo-self.com/Connexion.aspx', {waitUntil: 'networkidle0', timeout: 60000});

  await page.type('#ctl00_cntForm_txtLogin', process.env.email)
  await page.type('#ctl00_cntForm_txtMotDePasse', process.env.passwd)
  await page.click('#ctl00_cntForm_btnConnexion')
  await page.waitForSelector('#ctl00_cntForm_UC_collapseMenu_lbtReserver', {timeout: 60000})
  await page.click('#ctl00_cntForm_UC_collapseMenu_lbtReserver')
  await page.waitForSelector('#weeknumber_3')
  // await page.$$eval('[id^=weeknumber_]', els => {
  //   els.map(el => el.classList.remove('hidden'))
  // })
  const money = parseInt((await page.$eval('.prix', el => el.innerText)).split(' ')[0].replace(',', '.'))
  money <= 10 && telegramnotif(process.env.TgId, process.env.TgToken, `today is not reserved ! ${reservation.date}`)
    .catch(e => console.log('error in telegramnotif', e))
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

  const months = { "JAN.": 0, "FEV.": 1, "MAR.": 2, "AVR.": 3, "MAI.": 4, "JUIN.": 5, "JUIL.": 6, "AOU.": 7, "SEPT.": 8, "OCT.": 9, "NOV.": 10, "DEC.": 11 }

  for (reservation of reservations) {
    d = reservation.date.split(' ')
    date = new Date()
    date.setHours(0,0,0,0);
    date.setDate(parseInt(d[1]))
    date.setMonth(months[d[2]])

    today = new Date()
    today.setHours(0,0,0,0);

    nextweek = new Date()
    nextweek.setHours(0,0,0,0);
    nextweek.setDate(nextweek.getDate()+7)

    if (! reservation.reserved) {
      if (date.getTime() === today.getTime()) {
        telegramnotif(process.env.TgId, process.env.TgToken, `today is not reserved ! ${reservation.date}`)
          .catch(e => console.error('error in telegramnotif', e))
      } else if (date <= nextweek) {
        telegramnotif(process.env.TgId, process.env.TgToken, `${reservation.date} is not reserved in the following week !`)
          .catch(e => console.error('error in telegramnotif', e))
      }
    }
  }
  await browser.close()
})()
