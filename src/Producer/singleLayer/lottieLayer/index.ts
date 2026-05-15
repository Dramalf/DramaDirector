import LottieStream from "./LottieStream";
export default class LottieLayerProducer implements DramaSingleLayerProducer{
    layer: DramaLayer
    ctx: DramaContext
    lottieStream: LottieStream
    constructor(layer: DramaLayer, ctx: DramaContext) {
        this.layer = layer;
        this.ctx = ctx;
        const { w, h } = ctx.baseInfo;
        this.lottieStream = new LottieStream(w, h);
    }
    getStream() {
        let lastLottieEndTime = 0;
        const _lottieStream = this.lottieStream;
        this.layer.items.forEach(item => {
            const { lottie, config: { st, et, fps } } = item;
            let blackFillTime = st - lastLottieEndTime;
            _lottieStream.addEmpty(blackFillTime * fps);
            _lottieStream.addLottie(lottie);
            lastLottieEndTime = et;
        });
        return _lottieStream;
    }
    getFilters() {
        return [{
            filter: 'rotate',
            inputs: `${this.layer.inputIndex}`,
            options: '0',
            outputs: `layer-${this.layer.index}`
        }]
    }
    getInputOptions() {
        const { config: { w, h, fps,st,et, } } = this.layer.items[0];
        const inputOptions = [
            '-f', 'rawvideo',
            '-pixel_format', 'rgba',
            '-video_size', `${w}x${h}`,
            '-framerate', fps,
        ];
        return inputOptions;
    }
}