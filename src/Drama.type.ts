import { PassThrough, Readable } from "stream"

declare global {

    interface DramaItemConfig {
        x: number,
        y: number,
        st: number,
        et: number,
        seek?: number,
        [key: string]: any
    }

    interface DramaItemEffect {
        nm: string,
        options?: {
            w?: number,
            h?: number,
            x?: number,
            y?: number,
            [key: string]: any
        }
    }

    interface DramaItem {
        id: string,
        url: string
        type: string,
        config: DramaItemConfig,
        effects: DramaItemEffect[],
        stream?: PassThrough | Readable,
        inputFile?: string | PassThrough | Readable,
        lottie?: any
        inputIndex?: number,
        filter_output?: string,
        preItem?: DramaItem | null,
        producer?: DramaItemProducer,
        preBlackFill?: string
    }

    interface DramaLayer {
        index: number,
        items: DramaItem[]
        type?: string,
        producer?: any,
        inputIndex?: number
    }

    interface DramaSchema {
        name: string,
        w: number,
        h: number,
        d: number,
        layers: DramaLayer[]
    }

    interface DramaInputForFFmpeg {
        url: string | Readable,
        inputOptions: string[]
    }

}
