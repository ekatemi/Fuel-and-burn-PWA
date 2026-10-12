// Records a short voice note from the microphone. Works in installed web apps on iPhone too,
// where the browser's own speech recognition is not allowed.

/** iPhone records mp4 (AAC), most other browsers webm (Opus). */
function mimeType(): string | undefined {
  return ['audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
}

export const canRecord = () => typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

export interface Recording {
  /** Stops and returns the audio. */
  stop: () => Promise<Blob>
  /** Stops and throws the audio away. */
  cancel: () => void
}

/** Asks for the microphone (the first time) and starts recording. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType: mimeType() })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const release = () => stream.getTracks().forEach((track) => track.stop())
  recorder.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: recorder.mimeType }))
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = release
      if (recorder.state !== 'inactive') recorder.stop()
      else release()
    },
  }
}
