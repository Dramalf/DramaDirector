import stringRandom from "../../../Utils/string-random";
import { createTransparentBg, createPreBlackFill } from "../../../Utils/filters";
export default class ImageItemProducer implements DramaItemProducer {
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
        const { st, et, x, y } = config;
        let lastOutputName = `${inputIndex}`
        const filterList: DramaFilterforFFmpeg[] = effects?.map(effect => {

            const { nm: effectName, options } = effect;

            const filter = {
                inputs: lastOutputName,
                filter: effectName,
                options,
                outputs: `${id}-${effectName}-${stringRandom(3)}`
            };
            lastOutputName = filter.outputs;
            return filter
        }) || [];
        preBlackFill && filterList.push(...pbf);
        const { w, h } = this.ctx.baseInfo;
        filterList.push(
            ...createTransparentBg(id, w, h, et - st, `${id}-bg`),
            {
                inputs: [`${id}-bg`, lastOutputName],
                filter: 'overlay',
                options: {
                    x,
                    y,
                    eof_action: 'repeat'
                },
                outputs: `${id}-item`
            })
        return filterList;
    }
    getInputOptions() {
        const { seek = 0, st, et } = this.item.config;
        const inputOptions = ['-ss','0','-t',`${et-st}`,'-loop','1'];
        return inputOptions;
    }
}
