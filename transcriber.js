import { pipeline } from '@xenova/transformers';

// A singleton class for the transcriber
export class Transcriber {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await this.getNewInstance(progress_callback);
        }
        return this.instance;
    }

    static async getNewInstance(progress_callback = null) {
        return pipeline(this.task, this.model, { progress_callback });
    }
}