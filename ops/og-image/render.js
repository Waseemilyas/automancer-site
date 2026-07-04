const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const inp=process.argv[2], out=process.argv[3];
  const W=parseInt(process.argv[4]||'1200',10), H=parseInt(process.argv[5]||'630',10);
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1229/chrome-linux64/chrome',
    chromiumSandbox:false, args:['--force-color-profile=srgb']
  });
  const page = await browser.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
  await page.goto('file://'+path.resolve(inp));
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path:out, clip:{x:0,y:0,width:W,height:H} });
  await browser.close();
  console.log('rendered',out,W+'x'+H);
})();
