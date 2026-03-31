let ioInstance = null;

export function setIO(io) {
    ioInstance = io;
}

export function emitEvent(event, payload) {
    if (!ioInstance) return;
    ioInstance.emit(event, payload);
}

