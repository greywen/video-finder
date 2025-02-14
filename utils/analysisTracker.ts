export const generateAnalysisTracker = (key: string) => {
    if (!globalThis.analyzeMap) {
        globalThis.analyzeMap = {};
    }
    globalThis.analyzeMap[key] = true;
};

export const getAnalysisTracker = (key: string) => {
    return globalThis.analyzeMap[key];
};

export const deleteAnalysisTracker = (key: string) => {
    if (globalThis.analyzeMap[key]) {
        delete globalThis.analyzeMap[key];
    }
};
