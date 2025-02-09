import { IncomingForm } from 'formidable';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      const finallyFile = await fs.readFile(filePath);
      await fs.writeFile(pathToWriteFile, finallyFile);
      res.status(200).json({ message: 'Video uploaded successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Video upload failed' });
      return;
    }
  }
};
