import globalConfig from '@/config/globalConfig';
import { NextApiRequest, NextApiResponse } from 'next';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
        const { fileNameWithExt }: { fileNameWithExt: string } = req.body;
        const abortKey = fileNameWithExt.replaceAll('.', '');
        console.log(globalConfig.ac[abortKey]);
        globalConfig.ac[abortKey]?.abort();
        res.end();
    }
};
