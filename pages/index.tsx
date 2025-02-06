import UploadButton from '@/components/UploadButton';
import Image from 'next/image';
import { useState } from 'react';

export default function Home() {
  const [fileName, setFileName] = useState('');
  const analyze = async () => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({ fileNameWithExt: fileName }),
    });
    const data = await response.json();
    console.log(data);
  };

  return (
    <div className='w-screen h-screen'>
      <div className='fixed bottom-8 left-1/2 -translate-x-1/2'>
        <div className='m-auto flex items-center gap-2'>
          <input
            type='text'
            className='border rounded-md outline-0 py-1 px-2 min-w-80 text-base'
          />
          <UploadButton
            onSuccessful={(name) => {
              setFileName(name);
            }}
          >
            <Image src='/upload.svg' alt='Upload File' width={24} height={24} />
          </UploadButton>
          <button onClick={analyze}>
            <Image
              className='translate -rotate-90'
              src='/send.svg'
              alt='Send Message'
              width={24}
              height={24}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
