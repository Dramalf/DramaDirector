import DramaObserver from "../../../Core/observer";
import stringRandom from "../../../Utils/string-random";
export default class ImageItemProducer implements DramaItemProducer {
    item: DramaItem
    constructor(item: DramaItem) {
        this.item = item;
        item.filter_output = item.id + '-item';
    }
    getPreBlackFill() {
        const { preItem, config: curItemConfig, id, type } = this.item;

        let preItemEt = preItem?.config?.et || 0;
        const blackFillTime = curItemConfig.st - preItemEt
        if (blackFillTime <= 0) return null
        const { w, h } = DramaObserver.baseInfo;
        this.item.preBlackFill = `${id}-pbf`;
        return [
            {
                filter: 'nullsrc',
                options: {
                    size: `${w}x${h}`,
                    duration: `${blackFillTime}`
                },
                outputs: `${id}-nullsrc`
            },
            {
                inputs: `${id}-nullsrc`,
                filter: 'format',
                options: 'rgba',
                outputs: `${id}-nullsrc-format`
            },
            {
                inputs: `${id}-nullsrc-format`,
                filter: 'colorchannelmixer',
                options: {
                    aa: 0
                },
                outputs: `${id}-pbf`
            },
        ]
    }
    getFilters() {
        const pbf = this.getPreBlackFill();
        const { effects, inputIndex, id, config, preBlackFill } = this.item;
        const { st, et, x, y } = config;
        let lastOutputName = `${inputIndex}`
        const filterList: any[] = effects?.map(effect => {

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
        const { w, h } = DramaObserver.baseInfo;
        filterList.push(
            {
                filter: 'nullsrc',
                options: {
                    size: `${w}x${h}`,
                    duration: `${et - st}`
                },
                outputs: `${id}-nullsrc`
            },
            {
                inputs: `${id}-nullsrc`,
                filter: 'format',
                options: 'rgba',
                outputs: `${id}-nullsrc-format`
            },
            {
                inputs: `${id}-nullsrc-format`,
                filter: 'colorchannelmixer',
                options: {
                    aa: 0
                },
                outputs: `${id}-bg`
            },
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