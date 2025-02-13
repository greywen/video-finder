export enum MessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export enum ResultType {
    Image = 1,
    Text = 2,
    End = 3
}


interface SseResponseLineImage {
    i: number,
    t: ResultType.Image;
    r: string;
}


interface SseResponseLineText {
    i: number,
    t: ResultType.Text;
    r: string;
}

interface SseResponseLineEnd {
    t: ResultType.End;
}


export type SseResponseLine =
    | SseResponseLineImage
    | SseResponseLineText
    | SseResponseLineEnd
