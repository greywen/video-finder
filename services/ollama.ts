import { MessageRole } from "@/types/common";

interface Message {
    role: MessageRole,
    content: string,
    images: string[] | null
}

export const OllamaStream = async (message: Message) => {
    const url = 'http://localhost:11434/api/chat';

    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            model: 'llama3.2-vision:latest',
            messages: [message],
        })
    });

    const stream = new ReadableStream({
        async start(controller) {
            const decoder = new TextDecoder();
            let buffer = '';

            const processLine = (line: string) => {
                console.log('line', line);
                try {
                    const json = JSON.parse(line);
                    if (json.done) {
                        controller.close();
                        return;
                    }
                    if (json?.error) {
                        controller.close();
                        throw json.error;
                    }
                    const text = json.message.content || '';
                    console.log(text);
                    controller.enqueue(JSON.stringify({ text }));
                } catch (error) {
                    controller.error(error);
                    controller.close();
                }
            };

            try {
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error('Response body is null or not readable');
                }

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });

                    let lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim() !== '') {
                            processLine(line);
                        }
                    }
                }

                if (buffer.trim() !== '') {
                    processLine(buffer);
                }
            } catch (error) {
                controller.error(error);
                controller.close();
            }
        },
    });

    return stream;
};