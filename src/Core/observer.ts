export default class DramaObserver implements DramaContext {
    baseInfo: DramaBaseInfo
    audioOutputs: string[] = []
    schema: DramaSchema
    layers: DramaLayer[] = []
    itemsMap: { [key: string]: DramaItem } = {}
    textLayer: DramaItem[] = []
    constructor(schema: DramaSchema) {
        this.schema = schema;
        this.layers = schema.layers;
        this.baseInfo = {
            w: schema.w,
            h: schema.h,
            d: schema.d,
            outv: null,
            outa: null
        };
        this.generateItemsMap();
    }

    generateItemsMap() {
        const _layers = this.layers;
        let inputIndex = 0;

        _layers.forEach(layer => {
            let preItem = null
            if (layer.type === 'lottie') {
                layer.inputIndex = inputIndex;
                inputIndex++
            }
            layer?.items?.forEach(item => {
                if (item.type !== 'text' && item.type !== 'lottie') {
                    item.inputIndex = inputIndex;
                    inputIndex++;
                } else {
                    this.textLayer.push(item);
                }
                const et = item?.config?.et || 0;
                if (et > this.baseInfo.d) this.baseInfo.d = et
                this.itemsMap[item.id] = item;
                item.preItem = preItem;
                preItem = item;
            })

        })
    }

    getItemById(id) {
        return this.itemsMap[id] || null;
    }
    getLayers() {
        return this.layers
    }
}
