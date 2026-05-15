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
        // text and lottie items have no external url; only video/image/audio do.
        url?: string
        type: string,
        config: DramaItemConfig,
        // text items carry their styling in config and need no effects.
        effects?: DramaItemEffect[],
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

    interface DramaBaseInfo {
        w: number,
        h: number,
        d: number,
        outv: string | null,
        outa: string | null
    }

    // Per-run state shared between the core and every producer.
    // Threaded explicitly so multiple compositions can run concurrently
    // without clobbering each other (previously this was static state).
    interface DramaContext {
        baseInfo: DramaBaseInfo,
        audioOutputs: string[]
    }

}
