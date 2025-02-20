export enum MessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export enum ResultType {
    Image = 1,
    Text = 2,
    End = 3,
    Cancelled = 4,
    Error = 5
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


interface SseResponseLineCancelled {
    t: ResultType.Cancelled;
}


interface SseResponseLineError {
    t: ResultType.Error;
    r: string;
}

export type SseResponseLine =
    | SseResponseLineImage
    | SseResponseLineText
    | SseResponseLineEnd
    | SseResponseLineCancelled
    | SseResponseLineError;
