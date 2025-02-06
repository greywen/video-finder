import { useEffect, useRef } from 'react';

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

export default UploadButton;
