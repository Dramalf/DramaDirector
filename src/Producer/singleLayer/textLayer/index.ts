import DramaObserver from "../../../Core/observer";
export default class TextLayerProducer implements DramaSingleLayerProducer {
    layer: DramaLayer
    constructor(layer) {
        this.layer = layer;
    }
    getFilters() {
        const textNum=this.layer?.items?.length;
        if (!textNum) {
            return []
        }
        const { w, h } = DramaObserver.baseInfo
        const d = this.layer?.items.reduce((pre, cur) => { return Math.max(cur.config.et, pre) }, 0)
        let lastOutputName = '';
        const blackBgFilters: DramaFilterforFFmpeg[] = [{
            filter: 'nullsrc',
            options: {
                size: `${w}x${h}`,
                duration: d,
            },
            outputs: 'text-layer-nullsrc'
        },
        {
            inputs: 'text-layer-nullsrc',
            filter: 'format',
            options: 'rgba',
            outputs: 'text-layer-format'
        },
        {
            inputs: 'text-layer-format',
            filter: 'colorchannelmixer',
            options: {
                aa: 0
            },
            outputs: 'text-layer-bg'
        }
        ];
        lastOutputName = 'text-layer-bg';
        let drawTextFilters: DramaFilterforFFmpeg[] = this.layer?.items?.map((item,index) => {
            const { id,
                config:
                { text, st, et, ttfPath, fontsize, x, y,
                    fontcolor = '0xFFF6AA', bordercolor = 'white', borderw = 3, line_spacing = 7,obw=0,obc="#000000" }
            } = item;
            const biggerTextFilter: DramaFilterforFFmpeg|null = !obw?null: {
                inputs: lastOutputName,
                filter: 'drawtext',
                options: {
                    text,
                    x,
                    y,
                    fontfile: ttfPath,
                    enable: `between(t,${st},${et})`,
                    fontsize,
                    fontcolor,
                    bordercolor:obc,
                    borderw:borderw+obw,
                    line_spacing
                },
                outputs: `bigger-${id}-drawText`
            };
            const textFilter: DramaFilterforFFmpeg = {
                inputs: obw?`bigger-${id}-drawText`:lastOutputName,
                filter: 'drawtext',
                options: {
                    text,
                    x,
                    y,
                    fontfile: ttfPath,
                    enable: `between(t,${st},${et})`,
                    fontsize,
                    fontcolor,
                    bordercolor,
                    borderw,
                    line_spacing
                },
                outputs: index===textNum-1?`layer-${this.layer.index}`:`${id}-drawText`
            };
            lastOutputName = `${id}-drawText`;
            return [biggerTextFilter,textFilter]
        }).flat()
        const textLayerFilter = [...blackBgFilters, ...drawTextFilters];
        return textLayerFilter;
    }
}