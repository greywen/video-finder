import { useEffect, useRef } from 'react';
import Image from 'next/image';

interface Props {
  onSuccessful?: (url: string) => void;
  onUploading?: () => void;
  onFailed?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const UploadButton: React.FunctionComponent<Props> = ({
  onSuccessful,
  onUploading,
  onFailed,
  className,
  children,
}: Props) => {
  const uploadRef = useRef<HTMLInputElement>(null);

  const changeFile = async (event: any) => {
    const fileForm = new FormData();
    fileForm.append('file', event?.target?.files[0]);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: fileForm,
      });
      const data = await response.json();
      if (!response.ok) {
        throw data;
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const fileInput = document.getElementById('upload')!;
    fileInput.addEventListener('change', changeFile);
    return () => {
      fileInput.removeEventListener('change', changeFile);
    };
  }, []);

  return (
    <div className={`cursor-pointer ${className}`}>
      <div
        onClick={() => {
          uploadRef.current?.click();
        }}
      >
        {children}
      </div>

      <input
        ref={uploadRef}
        style={{ display: 'none' }}
        id='upload'
        type='file'
        accept='video/mp4'
      />
    </div>
  );
};

export default function Home() {
  return (
    <div className='w-screen h-screen'>
      <div className='fixed bottom-8 left-1/2 -translate-x-1/2'>
        <div className='m-auto flex items-center gap-2'>
          <input
            type='text'
            className='border rounded-md outline-0 py-1 px-2 min-w-80 text-base'
          />
          <UploadButton>
            <Image
              className='dark:invert'
              src='/upload.svg'
              alt='Upload File'
              width={24}
              height={24}
            />
          </UploadButton>
          <button>
            <Image
              className='dark:invert translate -rotate-90'
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
