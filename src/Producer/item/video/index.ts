import stringRandom from "../../../Utils/string-random";
import { createTransparentBg, createPreBlackFill } from "../../../Utils/filters";
export default class VideoItemProducer implements DramaItemProducer {
    item: DramaItem
    ctx: DramaContext
    constructor(item: DramaItem, ctx: DramaContext) {
        this.item = item;
        this.ctx = ctx;
        item.filter_output = item.id + '-item';
    }
    getPreBlackFill() {
        const { preItem, config: curItemConfig, id } = this.item;
        const preItemEt = preItem?.config?.et || 0;
        const { w, h } = this.ctx.baseInfo;
        const pbf = createPreBlackFill(id, w, h, curItemConfig.st - preItemEt);
        if (pbf) this.item.preBlackFill = `${id}-pbf`;
        return pbf;
    }
    getFilters() {
        const pbf = this.getPreBlackFill();
        const { effects, inputIndex, id, config, preBlackFill } = this.item;
        const { st, et, x = 0, y = 0, hasAudio } = config;
        let lastOutputName = `${inputIndex}`
        const filterList:DramaFilterforFFmpeg[] = [];
        // 分离音轨，如果不静音则添加
        if(hasAudio){
            filterList.push({
                inputs:`${inputIndex}:a`,
                filter:'volume',
                options:'1',
                outputs:`${id}-voice-track`
            },{
                inputs:`${id}-voice-track`,
                filter:'adelay',
                options: `${st * 1000}|${st * 1000}`,
                outputs: `${id}-voice-delay`
            })
            this.ctx.audioOutputs.push(`${id}-voice-delay`);
        }
        // 生成item的effect滤镜，缩放/高斯模糊……
        effects?.forEach(effect => {

            const { nm: effectName, options } = effect;

            const filter = {
                inputs: `${lastOutputName}`,
                filter: effectName,
                options,
                outputs: `${id}-${effectName}-${stringRandom(3)}`
            };
            lastOutputName = filter.outputs;
            filterList.push(filter)
        });
        // 添加前置黑场
        preBlackFill && filterList.push(...pbf);
        const { w, h } = this.ctx.baseInfo;
        // 生成透明背景与视频叠放
        filterList.push(
            ...createTransparentBg(id, w, h, et - st, `${id}-bg`),
            {
                inputs: [`${id}-bg`, lastOutputName],
                filter: 'overlay',
                options: {
                    x,
                    y,
                    'eof_action': 'endall'
                },
                outputs: `${id}-item`
            })
        return filterList;
    }
    getInputOptions() {
        const { seek = 0,st,et ,hasAudio} = this.item.config;
        const inputOptions = [];
        inputOptions.push('-ss', seek);
        if(et-st) inputOptions.push('-t', et-st);
        if(!hasAudio)inputOptions.push('-an')
        return inputOptions;
    }
}
