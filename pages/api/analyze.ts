import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { MessageRole, ResultType } from '@/types/common';
import globalConfig from '@/config/globalConfig';


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
      .on('end', () => {
        console.log('Keyframe image extraction completed:', imgFileOutputPath);
        resolve(imgFileOutputPath);
      })
      .on('error', (err) => {
        console.error('Error extracting video frames:', err);
        reject(err);
      })
      .output(imgFileOutputPath)
      .outputOptions(['-frames:v 1'])
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
    const { fileNameWithExt, text, credibility }: { fileNameWithExt: string, text: string, credibility: number } = req.body;
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
    globalConfig.ac[abortKey] = new AbortController();
    
    let currentDuration = 1;
    while (currentDuration <= videoDuration && currentDuration < 10) {
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
          signal: globalConfig.ac[abortKey].signal,
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `
          你是一个图片分析助手,请分析图片,回答以下问题
          问题：
          1. 图片中是否有 ${text}?
          2. 如果有，请详细描述其在图片中的外观和位置, 如果没有，请描述你在图片中看到的内容。
          3. 以 1-10 为标准，你对自己的答案有多大信心？`,
            image_path: imageFilePath.replace('public/images', '').replaceAll('/', '\\'),
          })
        });

        // const url = 'http://localhost:11434/api/chat';
        // const base64Image = await convertImageFileToBase64(imageFilePath);
        // const response = await fetch(url, {
        //   method: 'POST',
        //   body: JSON.stringify({
        //     model: 'llama3.2-vision:latest',
        //     messages: [{
        //       role: MessageRole.User, images: [base64Image], content: `
        //       你是一个图片分析助手,所有输出都应严格遵循JSON格式
        //       任务:请分析图片,回答以下问题并提取JSON中需要的关键信息,然后严格遵循JSON格式返回结果。
        //       问题：
        //       1. 图片中是否有 ${text}?
        //       2. 如果有，请详细描述其在图片中的外观和位置, 如果没有，请描述你在图片中看到的内容。
        //       3. 以 1-10 为标准，你对自己的答案有多大信心？
        //       所需JSON格式: { "Anwer": 是/否, "Description": 你对图片的详细描述, "Credibility": 1-10 }
        //       `}],
        //   })
        // });

        const decoder = new TextDecoder();
        let buffer = '';

        const reader = response.body?.getReader();
        if (!reader) {
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
