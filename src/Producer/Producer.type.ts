import { PassThrough, Stream, Writable } from "stream"

declare global {
    interface DramaFilterforFFmpeg {
        inputs?: string | string[],
        outputs?: string | string[],
        filter: string,
        options?: string | number | { [x: string]: string | number } | null
    }
    class DramaProducer {
        getFilters(): (string | DramaFilterforFFmpeg)[]
        getInputOptions?(): string[]
        getPreBlackFill?(): (string | DramaFilterforFFmpeg)[]
    }
    class DramaItemProducer extends DramaProducer {
        item: DramaItem
    }
    class DramaSingleLayerProducer extends DramaProducer {
        layer: DramaLayer
    }
    class DramaMultiLayerProducer extends DramaProducer {
        layers: DramaLayer[]
    }
}