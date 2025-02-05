import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function analyzeVideo(filePath: string, fileName: string) {
  const outputDirectory = path.resolve(
    process.cwd(),
    'public/images/' + fileName
  );
  fs.mkdir(outputDirectory, { recursive: true });
  try {
    ffmpeg(filePath)
      .on('end', () => {
        console.error('视频帧提取完成');
      })
      .on('error', (err) => {
        console.error('提取视频帧时出错:', err);
      })
      .output(path.join(outputDirectory, '%d.png'))
      .outputOptions(['-vf', 'fps=1'])
      .run();
  } catch (error) {
    console.error('提取视频帧时出错:', error);
  }
}
export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    const data = (await new Promise((resolve, reject) => {
      const form = new IncomingForm();
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    })) as any;
    try {
      const file = data.files.file[0];
      const filePath = file.filepath;
      const pathToWriteFile = `public/videos/${file.originalFilename}`;
      const fileName = file.originalFilename.slice(
        0,
        file.originalFilename.lastIndexOf('.')
      );
      const finallyFile = await fs.readFile(filePath);
      await fs.writeFile(pathToWriteFile, finallyFile);
      await analyzeVideo(pathToWriteFile, fileName);
      res.status(200).json({ message: '视频上传成功' });
    } catch (error) {
      res.status(500).json({ message: error });
      return;
    }
  }
};
