import { useEffect, useRef } from 'react';

interface Props {
  onSuccessful?: (fileName: string) => void;
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
    const file = event?.target?.files[0];
    fileForm.append('file', file);
    try {
      onUploading && onUploading();
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: fileForm,
      });
      const data = await response.json();
      if (!response.ok) {
        throw data;
      }
      onSuccessful && onSuccessful(file.name);
    } catch (error) {
      onFailed && onFailed();
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
