import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { MessageRole } from '@/types/common';

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
  const imgFileOutputPath = path.join(imgOutputPath, seek + '.png');
  return new Promise((resolve, reject) => {
    ffmpeg(videoFilePath)
      .seekInput(seek)
      .on('end', () => {
        console.log('关键帧图片提取完成:', imgFileOutputPath);
        resolve(imgFileOutputPath);
      })
      .on('error', (err) => {
        console.error('提取视频帧时出错:', err);
        reject(err);
      })
      .output(imgFileOutputPath)
      .outputOptions(['-frames:v 1'])
      .run();
  });
}

async function getVideoMetadata(videoFilePath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoFilePath, (error, metadata) => {
      if (error) reject(error);
      const format = metadata.format;
      resolve({
        duration: format.duration,
      });
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
    // const { fileNameWithExt } = req.body;
    const fileNameWithExt = 'car.mp4'
    const videoFilePath = `public/videos/` + fileNameWithExt;
    if (!(await fileExists(videoFilePath))) {
      res.json({ message: '视频文件不存在' });
      return;
    }
    const imgOutputPath = createImgOutputDirectory(fileNameWithExt);
    const imageFilePath = await getVideoKeyframeImg({
      imgOutputPath,
      videoFilePath,
      seek: 10,
    });

    const base64Image = await convertImageFileToBase64(imageFilePath);

    const url = 'http://localhost:11434/api/chat';

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3.2-vision:latest',
        messages: [{ role: MessageRole.User, images: [base64Image], content: '图片中有什么？' }],
      })
    });

    const decoder = new TextDecoder();
    let buffer = '';

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is null or not readable');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() !== '') {
          const json = JSON.parse(line);
          if (json.done) {
            res.end();
            return;
          }
          if (json?.error) {
            throw json.error;
          }
          const text = json.message.content || '';
          res.write(
            Buffer.from(
              `data: ${JSON.stringify({
                result: text,
                success: true,
              })}\r\n\r\n`,
            ),
          );
        }
      }
    }
  }
};
