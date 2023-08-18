import { getFolderName } from "./get_folder_name.js";
import ytdl from "ytdl-core";
import fs from "fs";

(async () => {
  dotenv.config();

  const ytLink = process.env.YT_URL;
  const outputDir = "videos";
  // 4.5 minutes
  // const videoLength = 270000;
  const maxVideos = 10;
  const videoLength = 10000;
  let videoCounts = 1;

  const interval = setInterval(async () => {
    await downloadYoutubeVideo(ytLink, videoLength, outputDir);

    if (videoCounts >= maxVideos) {
      clearInterval(interval);
      console.log("END");
    } else {
      videoCounts++;
    }
  }, videoLength + 1000);
})();

function downloadYoutubeVideo(youtubeLink, videoLength, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      const fileName = getFolderName();

      const stream = ytdl(youtubeLink, {
        quality: "highest",
        // begin: '10m0s',
        // begin: '335h54m00s',
        // begin: '10s',
      });

      fs.mkdir(outputDir, { recursive: true }, (err) => {
        if (err) {
          console.log(err);
          return false;
        }
        const writeable = fs.createWriteStream(
          `${outputDir}/${fileName}_puchong_ioi.mp4`
        );

        stream.pipe(writeable);

        let count = 1;
        const splitCounts = 60;
        const lengthSegment = videoLength / splitCounts;

        const interval = setInterval(() => {
          const currentProgress = Math.round(100 * (count / splitCounts));
          const currentSeconds = Math.round((lengthSegment / 1000) * count);
          console.clear();
          console.log(`Progress ${currentProgress}%, ${currentSeconds}s ...`);
          count++;
        }, lengthSegment);

        // end stream
        setTimeout(() => {
          const currentSeconds = Math.round((lengthSegment / 1000) * count);
          stream.unpipe(writeable);
          stream.destroy();
          writeable.end();
          clearInterval(interval);
          console.clear();
          console.log(`Progress 100%, ${currentSeconds}s DONE !!!!`);
          resolve(true);
        }, videoLength);
      });
    } catch (e) {
      console.log(e);
      reject(e);
    }
  });
}
