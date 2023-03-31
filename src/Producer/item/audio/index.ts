import stringRandom from "../../../Utils/string-random";
export default class AudioItemProducer implements DramaItemProducer {
    static AudioOutputsList:string[]=[]
    item: DramaItem
    constructor(item: DramaItem) {
        this.item = item;
        item.filter_output = `${item.id}-item`;
    }
    getFilters() {
        const { effects, inputIndex, id, config } = this.item;
        const { st, et } = config;
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
        filterList.push(
            {
                inputs: lastOutputName,
                filter: 'adelay',
                options: `${st * 1000}|${st * 1000}`,
                outputs: `${id}-item`
            })
            AudioItemProducer.AudioOutputsList.push(`${id}-item`);
        return filterList;
    }
    getInputOptions() {
        const { seek = 0, st, et } = this.item.config;
        const inputOptions = [];
        inputOptions.push('-ss', seek);
        if (et - st) inputOptions.push('-t', et - st);
        return inputOptions;
    }
}
