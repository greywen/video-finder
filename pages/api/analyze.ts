import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import { ResultType } from '@/types/common';
import { deleteAnalysisTracker, generateAnalysisTracker, getAnalysisTracker } from '@/utils/analysisTracker';

export const config = {
  api: {
    responseLimit: false,
  },
}

async function fileExists(filePath: string): Promise<boolean> {
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

function sendStreamData(res: NextApiResponse, data: any) {
  res.write(Buffer.from(`data: ${JSON.stringify(data)}\r\n\r\n`));
}

function handleStreamError(res: NextApiResponse, error: any, currentDuration?: number) {
  console.error("Stream Error:", error);
  sendStreamData(res, {
    i: currentDuration,
    t: ResultType.Error,
    r: error.message || 'An unexpected error occurred.',
  });
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { fileNameWithExt, text }: { fileNameWithExt: string, text: string } = req.body;
  const videoFilePath = `public/videos/` + fileNameWithExt;

  const abortKey = fileNameWithExt.replaceAll('.', '');
  generateAnalysisTracker(abortKey);

  try {
    if (!(await fileExists(videoFilePath))) {
      throw new Error('The video file does not exist');
    }

    const imgOutputPath = createImgOutputDirectory(fileNameWithExt);
    const videoDuration = await getVideoDuration(videoFilePath);

    if (!videoDuration || videoDuration < 1) {
      throw new Error('Failed to obtain video duration');
    }

    let currentDuration = 1;
    while (currentDuration <= videoDuration) {
      if (!getAnalysisTracker(abortKey)) {
        sendStreamData(res, { t: ResultType.Cancelled });
        break;
      }

      try {
        const imageFilePath = await getVideoKeyframeImg({
          imgOutputPath,
          videoFilePath,
          seek: currentDuration,
        });

        sendStreamData(res, {
          i: currentDuration,
          t: ResultType.Image,
          r: imageFilePath.replace('public', ''),
        });

        const url = 'http://localhost:8000/chat-stream';
        const response = await fetch(url, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            image_path: imageFilePath.replace('public/images', '').replaceAll('/', '\\'),
          }),
        });

        if (!response.ok) {
          throw new Error(`Chat Stream Error: ${response.status} ${response.statusText}`);
        }

        const decoder = new TextDecoder();
        let buffer = '';
        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error('Response body is null or not readable');
        }

        let accumulatedText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (accumulatedText.trim()) {
              sendStreamData(res, {
                i: currentDuration,
                t: ResultType.Text,
                r: accumulatedText.trim(),
              });
            }
            currentDuration += 1;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() !== '') {
              try {
                const json = JSON.parse(line);
                if (json.done) {
                  break;
                }
                if (json?.error) {
                  throw new Error(json.error);
                }
                const textContent = json.message?.content || '';
                accumulatedText += textContent;
              } catch (parseError) {
                console.warn("JSON parse error:", parseError, "on line:", line);
              }
            }
          }
        }
      } catch (innerError) {
        handleStreamError(res, innerError, currentDuration);
        break;
      }
    }

    if (getAnalysisTracker(abortKey)) {
      sendStreamData(res, {
        i: currentDuration,
        t: ResultType.End,
      });
    }

  } catch (error) {
    handleStreamError(res, error);
  } finally {
    deleteAnalysisTracker(abortKey);
    res.end();
  }
};