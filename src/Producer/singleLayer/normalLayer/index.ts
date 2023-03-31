export default class NormalLayerProducer implements DramaSingleLayerProducer {
    layer: DramaLayer
    constructor(layer) {
        this.layer = layer;
    }
    getFilters() {
        const itemList = this.layer?.items || []
        let resFilters = [];
        if (itemList.length === 1) {
            const item = itemList[0];
            if (!item.preBlackFill) {
                resFilters.push({
                    inputs: `${item.filter_output}`,
                    filter: 'rotate',
                    options: '0',
                    outputs: `layer-${this.layer.index}`
                })
            } else {
                resFilters.push({
                    inputs: [item.preBlackFill, item.filter_output],
                    filter: 'concat',
                    options: {
                        n: '2',
                        v: '1'
                    },
                    outputs: `layer-${this.layer.index}`
                });
            }
        } else {

            let layerConcatFilter = {
                inputs: [],
                filter: 'concat',
                options: {
                    n: 0,
                    v: 1
                },
                outputs: `layer-${this.layer.index}`
            }
            this.layer?.items.forEach(item => {
                if (item.preBlackFill) {
                    layerConcatFilter.inputs.push(item.preBlackFill);
                    layerConcatFilter.options.n++;
                }
                layerConcatFilter.inputs.push(item.filter_output);
                layerConcatFilter.options.n++;
            });
            resFilters.push(layerConcatFilter)
        }

        return resFilters
    }
}