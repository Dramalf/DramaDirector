import { Readable } from 'stream';
import { Canvas, Image } from 'canvas';
import LottieNode from 'lottie-nodejs';
//@ts-ignore
LottieNode.setCanvas({
    Canvas,
    Image,
});
export default class LottieStream extends Readable {
    projectW: number
    projectH: number
    emptyFillData: Buffer
    lottieList: any[] = []
    frame: number = 0
    curItem: any
    constructor(w: number, h: number) {
        super({ objectMode: true });
        this.projectW = w;
        this.projectH = h;
        this.emptyFillData = Buffer.from(new Uint8Array(new Array(w * h * 4).fill(0)))
    }
    addEmpty(frames) {
        frames !== 0 && this.lottieList.push({
            empty: true,
            totalFrames: frames
        })
    }
    addLottie(lottieObj) {
        const { w, h } = lottieObj;
        const canvas = new Canvas(w, h);
        const anim = LottieNode.loadAnimation({
            //@ts-ignore
            container: canvas,
            renderer: 'canvas',
            loop: false,
            animationData: lottieObj,
        });
        const totalFrames = anim.getDuration(true);
        this.lottieList.push({
            empty: false,
            anim,
            canvas,
            totalFrames
        })
    }
    generateImageData(frame) {
        if (!this.curItem) return null;
        if (this.curItem.empty) return this.emptyFillData;
        const { anim, canvas } = this.curItem;
        anim.goToAndStop(frame, true);
        const imageData = canvas.getContext('2d').getImageData(0, 0, this.projectW, this.projectH);
        const { data } = imageData;
        const rgbaArray = new Uint8Array(data);
        return Buffer.from(rgbaArray);
    }
    _read() {
        if (!this.curItem) { this.curItem = this.lottieList.shift() }
        if (this.frame >= this.curItem.totalFrames) {

            !this.curItem.empty && this.curItem.anim.destroy()
            this.curItem = this.lottieList.shift();
            if (!this.curItem) {
                this.push(null);
                return
            }
            this.frame = 0
        }
        const imageData = this.generateImageData(this.frame)
        this.frame++;
        this.push(imageData);
    }
}