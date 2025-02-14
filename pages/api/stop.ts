import { deleteAnalysisTracker, getAnalysisTracker } from '@/utils/analysisTracker';
import { NextApiRequest, NextApiResponse } from 'next';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
        const { fileNameWithExt }: { fileNameWithExt: string } = req.body;
        const abortKey = fileNameWithExt.replaceAll('.', '');
        deleteAnalysisTracker(abortKey);
        res.end();
    }
};
