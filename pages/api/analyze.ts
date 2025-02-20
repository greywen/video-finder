import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { ResultType } from '@/types/common';
import { deleteAnalysisTracker, generateAnalysisTracker, getAnalysisTracker } from '@/utils/analysisTracker';


export const config = {
  api: {
    responseLimit: false,
  },
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

interface GetVideoKeyframeImgParams {
  videoFilePath: string;
  seek: number;
  imgOutputPath: string;
}

async function getVideoKeyframeImg(params: GetVideoKeyframeImgParams): Promise<string> {
  const { videoFilePath, seek, imgOutputPath } = params;
  const imgFileOutputPath = `${imgOutputPath}/${seek}.png`;
  return new Promise((resolve, reject) => {
    ffmpeg(videoFilePath)
      .seekInput(seek)
      .output(imgFileOutputPath)
      .outputOptions(['-frames:v 1'])
      .on('end', () => resolve(imgFileOutputPath))
      .on('error', err => reject(err))
      .run();
  });
}

async function getVideoDuration(videoFilePath: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFilePath, (error, metadata) => {
      if (error) reject(error);
      const format = metadata.format;
      resolve(format.duration);
    });
  });
}

function createImgOutputDirectory(fileNameWithExt: string) {
  const fileName = fileNameWithExt.slice(0, fileNameWithExt.lastIndexOf('.'));
  const outputPath = 'public/images/' + fileName;
  fs.mkdir(outputPath, { recursive: true });
  return outputPath;
}

async function convertImageFileToBase64(filePath: string) {
  const imagePath = path.resolve(filePath);
  const imageBuffer = await fs.readFile(imagePath);
  return imageBuffer.toString('base64');
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const { fileNameWithExt, text }: { fileNameWithExt: string, text: string } = req.body;
    const videoFilePath = `public/videos/` + fileNameWithExt;
    if (!(await fileExists(videoFilePath))) {
      res.json({ message: 'The video file does not exist' });
      return;
    }

    const imgOutputPath = createImgOutputDirectory(fileNameWithExt);

    const videoDuration = await getVideoDuration(videoFilePath);
    if (!videoDuration || videoDuration < 1) {
      res.json({ message: 'Failed to obtain video duration' });
      return;
    }

    const abortKey = fileNameWithExt.replaceAll('.', '');
    generateAnalysisTracker(abortKey);

    let currentDuration = 1;
    while (currentDuration <= videoDuration) {
      if (!getAnalysisTracker(abortKey)) {
        break;
      }
      const imageFilePath = await getVideoKeyframeImg({
        imgOutputPath,
        videoFilePath,
        seek: currentDuration,
      });

      res.write(
        Buffer.from(
          `data: ${JSON.stringify({
            i: currentDuration,
            t: ResultType.Image,
            r: imageFilePath.replace('public', ''),
          })}\r\n\r\n`,
        ),
      );

      const url = 'http://localhost:8000/chat-stream';
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            image_path: imageFilePath.replace('public/images', '').replaceAll('/', '\\'),
          })
        });

        const decoder = new TextDecoder();
        let buffer = '';

        const reader = response.body?.getReader();
        if (!reader) {
          deleteAnalysisTracker(abortKey);
          throw new Error('Response body is null or not readable');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            currentDuration += 1;
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          let lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() !== '') {
              const json = JSON.parse(line);
              if (json.done) {
                break;
              }
              if (json?.error) {
                throw json.error;
              }
              const text = json.message.content || '';
              res.write(
                Buffer.from(
                  `data: ${JSON.stringify({
                    i: currentDuration,
                    t: ResultType.Text,
                    r: text,
                  })}\r\n\r\n`,
                ),
              );
            }
          }
        }
      }
      catch (error) {
        if (error.name === 'AbortError') {
          break;
        }
      }
    }
    deleteAnalysisTracker(abortKey);
    res.write(
      Buffer.from(
        `data: ${JSON.stringify({
          i: currentDuration,
          t: ResultType.End,
        })}\r\n\r\n`,
      ),
    );
    res.end();
  }
};
