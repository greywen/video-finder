import UploadButton from '@/components/UploadButton';
import { ResultType, SseResponseLine } from '@/types/common';
import Image from 'next/image';
import { useState } from 'react';

export default function Home() {
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [messages, setMessages] = useState<{
    image?: string,
    text?: string
  }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const analyze = async () => {
    setDescription('');
    setAnalyzing(true);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({ fileNameWithExt: fileName, text: description }),
    });

    if (!response.ok) {
      return;
    }
    const data = response.body;
    if (!data) {
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
          if (line === '') {
            continue;
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
      }
    }
  };

  return (
    <div>
      <div className='overflow-x-hidden'>
        {messages.map((m, i) => <div className='flex flex-col border-t p-4' key={'message-' + i}>
          {m?.image && <img src={m.image} className='w-80 h-48 rounded-lg' />}
          <div className='py-2 text-wrap'>{m?.text}{analyzing && ' ▍'}</div>
        </div>)}
      </div>
      <div className='h-20'></div>
      <div className='fixed bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-md'>
        <div className='m-auto flex items-center gap-2'>
          <input
            type='text'
            value={description}
            onChange={(e) => { setDescription(e.target.value) }}
            className='border rounded-md outline-0 py-1 px-2 min-w-80 text-base'
          />
          {!analyzing && <UploadButton
            onSuccessful={(name) => {
              setFileName(name);
            }}
          >
            <Image src='/upload.svg' alt='Upload File' width={24} height={24} />
          </UploadButton>
          }
          <button onClick={analyze} disabled={analyzing}>
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
