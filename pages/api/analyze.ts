import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

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

async function getVideoKeyframeImg(params: GetVideoKeyframeImgParams) {
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

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const { fileNameWithExt } = req.body;
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
    res.json({ data: { imageFilePath } });
  }
};
