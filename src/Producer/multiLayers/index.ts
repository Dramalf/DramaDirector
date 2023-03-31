import DramaObserver from "../../Core/observer";
import VideoItemProducer from "../item/video";
import AudioItemProducer from "../item/audio";
export default class MultiLayersProducer implements DramaMultiLayerProducer {
    layers: DramaLayer[]
    constructor(layers) {
        this.layers = layers;
    }
    getFilters() {
        const visibleLayers = this.layers.filter(layer => layer.type !== 'audio');
        // const audioLayers = this.layers.filter(layer => layer.type === 'audio');
        const audioOutputsList=[...VideoItemProducer.AudioOutputsList,...AudioItemProducer.AudioOutputsList].filter(Boolean)
        let outv = null, outa = null;
        const overlayFilters = [];
        let volumeFilters = [];
        // 合成最终视频输出
        if (visibleLayers.length === 0) {
            outv = null;
        }
        else if (visibleLayers.length === 1) {
            outv = `layer-${visibleLayers[0].index}`;
        } else {
            let lastLayer = `layer-${visibleLayers[0].index}`
            let nextLayer = '';
            for (let i = 1; i < visibleLayers.length; i++) {
                const curIndex = `layer-${visibleLayers[i].index}`;
                nextLayer = `overlay-${i - 1}-${i}`;
                overlayFilters.push({
                    filter: 'overlay',
                    inputs: [lastLayer, curIndex],
                    options: {
                        x: 0,
                        y: 0,
                        eof_action: 'pass'
                    },
                    outputs: nextLayer,
                })
                lastLayer = nextLayer;

            }
            outv = nextLayer;
        }
        // 合成最终音频输出
        if(audioOutputsList?.length===1){
            outa=audioOutputsList[0];
        }else{
            const amixFilter:DramaFilterforFFmpeg = {
                inputs:audioOutputsList,
                filter:'amix',
                options:{
                    inputs: audioOutputsList.length,
                    dropout_transition: 500
                },
                outputs:'audio-all-amix',
            };
            const setVolumeFilter:DramaFilterforFFmpeg = {
                inputs: 'audio-all-amix',
                filter: 'volume',
                options: audioOutputsList.length,
                outputs: 'audio-all-output'
            }
            volumeFilters.push(amixFilter, setVolumeFilter)
            outa = 'audio-all-output'
        }
        DramaObserver.baseInfo.outv = outv;
        DramaObserver.baseInfo.outa = outa;
        return [...overlayFilters, ...volumeFilters].filter(Boolean)
    }
}