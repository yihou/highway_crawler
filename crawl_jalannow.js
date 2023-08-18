import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { getFolderName } from "./get_folder_name.js";
import dotenv from "dotenv";

async function takeScreenshotOnLoad(url, outputFilePath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "load" });

  await page.screenshot({ path: outputFilePath });

  await browser.close();
}

async function downloadImagesUsingFetch(images, page, outputDir) {
  for (let i = 0; i < images.length; i++) {
    const url = images[i];
    const contentType = await page.evaluate(async (url) => {
      // Download the resource as a binary buffer
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();

      // Convert the buffer to a data URL
      const contentType = response.headers.get("content-type");
      const dataUrl = `data:${contentType};base64,${Buffer.from(
        buffer
      ).toString("base64")}`;

      // Return the content type and data URL of the resource
      return { contentType, dataUrl };
    }, url);

    // Save the resource to a file
    fs.writeFileSync(
      `${outputDir}/resource_${i}.${contentType.contentType.split("/").pop()}`,
      Buffer.from(contentType.dataUrl.split(",")[1], "base64")
    );
  }
}

async function downloadImagesUsingCanvas(page, outputDir) {
  const images = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img")).filter((img) =>
      img.src.includes(".jpg")
    );
    return images.map((img) => ({
      url: img.src,
      element: img,
    }));
  });

  for (let i = 0; i < images.length; i++) {
    const { url, element } = images[i];
    const blob = await page.evaluateHandle(
      (element) =>
        new Promise((resolve) => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = 320;
          canvas.height = 240;
          ctx.drawImage(element, 0, 0);
          canvas.toBlob(resolve);
        }),
      element
    );
    const buffer = await blob.asElement().screenshot();
    const fileName = path.basename(url);
    const fileExtension = path.extname(url);
    const filePath = `${outputDir}/images/${fileName}`;
    fs.writeFileSync(filePath, buffer);
  }
}

async function downloadResources(url, outputDir) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Navigate to the page
  const res = await page.goto(url, { waitUntil: "networkidle0" });

  await page.waitForTimeout(1000);
  // const req = res.request();

  // Get the HTML content of the page
  // const htmlContent = await page.content();

  // Save the HTML content to a file
  // fs.writeFileSync('page.html', htmlContent);

  const resourceUrls = await page.evaluate(() => {
    const urls = [];

    // Get all resources loaded by the page
    const resources = performance.getEntriesByType("resource");

    // Get the URL of each resource
    resources.forEach((resource) => {
      if (resource.name.includes(".jpg")) {
        urls.push(resource.name);
      }
    });

    return urls;
  });

  // Download each resource and save it to a file
  // await downloadImagesUsingFetch(resourceUrls, page, outputDir);
  await downloadImagesUsingCanvas(page, outputDir);

  await browser.close();
}

async function downloadImagesFromScreenshot(page, outputDir) {
  fs.mkdir(outputDir, { recursive: true }, (err) => {
    console.log(err);
  });

  // Get the positions of all the images on the page
  const imagePositions = await page.$$eval("img", (images) =>
    images
      .filter((img) => img.src.includes(".jpg"))
      .map((image) => {
        const { x, y, width, height } = image.getBoundingClientRect();
        return { x, y, width, height, id: image.id };
      })
  );

  const fileName = getFolderName();

  // Crop out each image from the screenshot and save it to a file
  for (let i = 0; i < imagePositions.length; i++) {
    const { x, y, width, height, id } = imagePositions[i];
    const imageBuffer = await page.screenshot({
      clip: { x, y, width, height },
    });
    fs.mkdir(`${outputDir}/${id}`, { recursive: true }, (err) => {
      if (err) {
        console.log(err);
        return false;
      }

      fs.writeFileSync(`./${outputDir}/${id}/${fileName}.jpg`, imageBuffer);
    });
  }
}

(async () => {
  dotenv.config();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const url = process.env.JALANNOW_URL;

  await page.goto(url, { waitUntil: "networkidle0" });

  await downloadImagesFromScreenshot(page, `resources`);
  const one_minute = 60 * 1000 + 100;
  const one_hour = 60 * one_minute;

  const interval = setInterval(async () => {
    await downloadImagesFromScreenshot(page, `resources`);
  }, one_minute);

  setTimeout(async () => {
    clearInterval(interval);

    await browser.close();
  }, one_hour);
})();
