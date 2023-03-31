export default class DramaObserver {
    static baseInfo: {
        w: number,
        h: number,
        d: number,
        outv: string,
        outa: string
    } = { w: 0, h: 0, d: 0, outv: null, outa: null }
    schema: DramaSchema
    layers: DramaLayer[] = []
    itemsMap: { [key: string]: DramaItem } = {}
    textLayer: DramaItem[] = []
    constructor(schema: DramaSchema) {
        this.schema = schema;
        this.layers = schema.layers;   
        DramaObserver.baseInfo.w = schema.w;
        DramaObserver.baseInfo.h = schema.h;
        DramaObserver.baseInfo.d = schema.d;
        this.generateItemsMap();
    }

    generateItemsMap() {
        const _layers = this.layers;
        let inputIndex = 0;

        _layers.forEach(layer => {
            let preItem = null
            if (layer.type === 'lottie') {
                layer.inputIndex=inputIndex;
                inputIndex++
            }
            layer?.items?.forEach(item => {
                if (item.type !== 'text' && item.type !== 'lottie') {
                    item.inputIndex = inputIndex;
                    inputIndex++;
                } else {
                    this.textLayer.push(item);
                }
                const et=item?.config?.et||0;
                if(et>DramaObserver.baseInfo.d)DramaObserver.baseInfo.d=et
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