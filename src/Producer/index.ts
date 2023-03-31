import VideoItemProducer from './item/video'
import AudioItemProducer from './item/audio'
import ImageItemProducer from './item/image'
import TextLayerProducer from './singleLayer/textLayer'
import NormalLayerProducer from './singleLayer/normalLayer'
import LottieLayerProducer from './singleLayer/lottieLayer'
import MultiLayersProducer from './multiLayers'
class NullProducer{
    getFilters(){
        return []
    }
}
const ItemProduceMap = {
    video: VideoItemProducer,
    audio: AudioItemProducer,
    image:ImageItemProducer,
    text:NullProducer,
    lottie:NullProducer
}
const SingleLayerProducerMap = {
    text: TextLayerProducer,
    normal: NormalLayerProducer,
    audio:NullProducer,
    lottie:LottieLayerProducer
}
export function generateItemProducer(item) {
    const { type } = item;
    return new ItemProduceMap[type](item);
}
export function generateSingleLayerProducer(layer) {
    const { type } = layer;
    return new SingleLayerProducerMap[type](layer);
}
export function generateMultiLayerProducer(layers){
    return new MultiLayersProducer(layers);
}