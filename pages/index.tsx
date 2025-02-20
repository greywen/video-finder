import UploadButton from '@/components/UploadButton';
import { ResultType, SseResponseLine } from '@/types/common';
import Image from 'next/image';
import { useState } from 'react';

export default function Home() {
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('请详细描述你在图片中看到的内容');
  const [messages, setMessages] = useState<{ image?: string; text?: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const analyze = async () => {
    if (!description) { alert("描述内容不能为空"); return; }
    if (!fileName) { alert("上传需要分析的视频"); return; }
    if (uploading) { alert("视频上传中，请稍后"); return; }
    setDescription('');
    setAnalyzing(true);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ fileNameWithExt: fileName, text: description }),
    });

    if (!response.ok) {
      setAnalyzing(false);
      return;
    }
    const data = response.body;
    if (!data) {
      setAnalyzing(false);
      return;
    }

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    async function* processBuffer() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\r\n\r\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex + 1).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line.startsWith('data: ')) {
            yield line.slice(6);
          }
        }
      }
    }

    const msgs = [...messages];
    for await (const message of processBuffer()) {
      const value: SseResponseLine = JSON.parse(message);
      if (value.t === ResultType.Image) {
        msgs.push({ image: value.r, text: '' });
        setMessages(msgs);
      } else if (value.t === ResultType.Text) {
        const index = value.i - 1;
        msgs[index].text += value.r;
        setMessages([...msgs]);
      } else if (value.t === ResultType.End) {
        setAnalyzing(false);
      } else if (value.t === ResultType.Cancelled) {
        setAnalyzing(false);
      } else if (value.t === ResultType.Error) {
        setAnalyzing(false);
        alert(value.r);
      }
    }
  };

  const stop = async () => {
    await fetch('/api/stop', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ fileNameWithExt: fileName }),
    });

  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-6">
        {messages.map((m, i) => (
          <div className="flex flex-col border border-gray-200 p-4 mb-6 rounded-lg" key={'message-' + i}>
            {m?.image && <img src={m.image} className="w-atuo h-2/3 rounded-lg mb-2" />}
            <div className="text-gray-800 text-base">
              <span dangerouslySetInnerHTML={{ __html: m?.text || '' }}></span>
            </div>
          </div>
        ))}
        {analyzing && '分析中...'}
      </div>
      <div className='h-16'></div>
      <div className="bg-white fixed bottom-0 left-0 w-full py-4 px-6">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <input
            onKeyDown={(e) => { e.key === 'Enter' && analyze() }}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入你要寻找的内容"
            className="flex-1 border border-gray-300 rounded-lg outline-none py-2 px-4 text-base"
          />
          {!analyzing && (
            <UploadButton
              onUploading={() => {
                setUploading(true);
              }}
              onSuccessful={(name) => {
                setFileName(name);
                setUploading(false);
              }}
              onFailed={() => {
                alert("Video upload failed")
                setUploading(false);
              }}
            >
              {fileName ? <video className='rounded-lg' width={64} height={64} src={`/videos/${fileName}`} /> : <Image src="/icons/upload.svg" alt="Upload File" width={24} height={24} />}
            </UploadButton>
          )}
          <button
            onClick={() => {
              if (analyzing) stop();
              else analyze();
            }}
            className={`p-2 rounded-lg ${analyzing ? 'bg-gray-300' : 'bg-blue-200 hover:bg-blue-400'} text-white`}>
            <Image className="transform -rotate-90" src={analyzing ? "/icons/stop.svg" : "/icons/send.svg"} alt="Send Message" width={24} height={24} />
          </button>
        </div>
      </div>
    </div>
  );
}