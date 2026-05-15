import VideoItemProducer from './item/video'
import AudioItemProducer from './item/audio'
import ImageItemProducer from './item/image'
import TextLayerProducer from './singleLayer/textLayer'
import NormalLayerProducer from './singleLayer/normalLayer'
import LottieLayerProducer from './singleLayer/lottieLayer'
import MultiLayersProducer from './multiLayers'
class NullProducer {
    ctx: DramaContext
    constructor(_target?: any, ctx?: DramaContext) {
        this.ctx = ctx;
    }
    getFilters() {
        return []
    }
}
const ItemProduceMap = {
    video: VideoItemProducer,
    audio: AudioItemProducer,
    image: ImageItemProducer,
    text: NullProducer,
    lottie: NullProducer
}
const SingleLayerProducerMap = {
    text: TextLayerProducer,
    normal: NormalLayerProducer,
    audio: NullProducer,
    lottie: LottieLayerProducer
}
export function generateItemProducer(item: DramaItem, ctx: DramaContext) {
    const { type } = item;
    const Producer = ItemProduceMap[type];
    if (!Producer) {
        throw new Error(
            `Unknown item type "${type}" (item id: "${item.id}"). ` +
            `Expected one of: ${Object.keys(ItemProduceMap).join(', ')}.`
        );
    }
    return new Producer(item, ctx);
}
export function generateSingleLayerProducer(layer: DramaLayer, ctx: DramaContext) {
    const { type } = layer;
    const Producer = SingleLayerProducerMap[type];
    if (!Producer) {
        throw new Error(
            `Unknown layer type "${type}" (layer index: ${layer.index}). ` +
            `Expected one of: ${Object.keys(SingleLayerProducerMap).join(', ')}.`
        );
    }
    return new Producer(layer, ctx);
}
export function generateMultiLayerProducer(layers: DramaLayer[], ctx: DramaContext) {
    return new MultiLayersProducer(layers, ctx);
}
